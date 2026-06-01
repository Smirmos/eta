import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { AthleteProfileRepository } from '../../../db/repositories/athlete-profile.repository.js';
import { WorkoutsCompletedRepository } from '../../../db/repositories/workouts-completed.repository.js';
import { StravaClientService } from './strava-client.service.js';
import { normalizeStravaActivity } from './strava-normalizer.js';

const BACKFILL_DAYS = 90;
const PAGE_SIZE = 30;

/** Sparse subset of SummaryActivity — only `id` is needed for the detail fetch. */
const summaryActivitySchema = z.object({ id: z.number().int() });

export interface BackfillResult {
  userId: string;
  considered: number;
  ingested: number;
  skipped: number;
  failed: number;
}

@Injectable()
export class StravaBackfillService {
  private readonly logger = new Logger(StravaBackfillService.name);

  constructor(
    private readonly client: StravaClientService,
    private readonly profilesRepo: AthleteProfileRepository,
    private readonly workoutsRepo: WorkoutsCompletedRepository,
  ) {}

  /** Fire-and-forget. Returns immediately; backfill runs in the background. */
  trigger(userId: string): void {
    setImmediate(() => {
      this.run(userId).catch((err: unknown) => {
        const detail = err instanceof Error ? err.stack ?? err.message : String(err);
        this.logger.error(`Strava backfill for user ${userId} failed: ${detail}`);
      });
    });
  }

  /**
   * Synchronous core. Pulls every activity in the trailing 90 days, paginated,
   * normalises each one, and upserts. Idempotent — re-running upserts on
   * (source, external_id) without duplication.
   */
  async run(userId: string, now: Date = new Date()): Promise<BackfillResult> {
    const afterUnix = Math.floor((now.getTime() - BACKFILL_DAYS * 86_400_000) / 1000);
    this.logger.log(
      `Strava backfill starting for user ${userId} — ${BACKFILL_DAYS} days back (after=${afterUnix}).`,
    );

    const profile = await this.profilesRepo.findByUserId(userId);
    const summary: BackfillResult = {
      userId,
      considered: 0,
      ingested: 0,
      skipped: 0,
      failed: 0,
    };

    let page = 1;
    while (true) {
      const rawList = await this.client.listAthleteActivities(userId, {
        after: afterUnix,
        page,
        perPage: PAGE_SIZE,
      });
      if (rawList.length === 0) break;

      for (const raw of rawList) {
        summary.considered += 1;
        const parsed = summaryActivitySchema.safeParse(raw);
        if (!parsed.success) {
          summary.failed += 1;
          this.logger.warn(`Strava list returned an entry without a numeric id; skipping.`);
          continue;
        }
        try {
          const activity = await this.client.getActivity(userId, parsed.data.id);
          const row = normalizeStravaActivity({ userId, activity, athleteProfile: profile });
          if (!row) {
            summary.skipped += 1;
            continue;
          }
          await this.workoutsRepo.upsert(row);
          summary.ingested += 1;
        } catch (err) {
          summary.failed += 1;
          const detail = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Strava activity ${parsed.data.id} ingest failed: ${detail}`);
        }
      }
      if (rawList.length < PAGE_SIZE) break;
      page += 1;
    }

    this.logger.log(
      `Strava backfill finished for user ${userId}: considered=${summary.considered}, ` +
        `ingested=${summary.ingested}, skipped=${summary.skipped}, failed=${summary.failed}.`,
    );
    return summary;
  }
}
