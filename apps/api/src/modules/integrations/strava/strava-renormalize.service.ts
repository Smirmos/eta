import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { AthleteProfileRepository } from '../../../db/repositories/athlete-profile.repository.js';
import { WorkoutsCompletedRepository } from '../../../db/repositories/workouts-completed.repository.js';
import { normalizeStravaActivity } from './strava-normalizer.js';
import type { StravaActivity } from './strava.types.js';

/**
 * Minimal guard that ensures the stored raw JSONB has the fields that
 * `normalizeStravaActivity` reads unconditionally. Deliberately lenient on
 * `id` (coerced to number so NaN is accepted — the normalizer calls
 * `String(activity.id)` which handles NaN gracefully).
 */
const rawActivityGuard = z.object({
  id: z.union([z.number(), z.nan()]),
  type: z.string(),
  start_date_local: z.string(),
  moving_time: z.number().int().nonnegative(),
  elapsed_time: z.number().int().nonnegative(),
});

export interface RenormalizeResult {
  userId: string;
  considered: number;
  recomputed: number;
  stillPending: number;
  failed: number;
}

/**
 * Walks `pending_inference` Strava rows for a user, re-runs the pure
 * `normalizeStravaActivity` against the stored `raw` JSONB using the user's
 * latest AthleteProfile. Bike-with-power rows flip to `computed`; run/swim
 * stay `pending_inference` until those TSS paths land.
 *
 * No Strava API calls. Safe to re-run — already-computed rows are excluded by
 * the SQL filter.
 */
@Injectable()
export class StravaRenormalizeService {
  private readonly logger = new Logger(StravaRenormalizeService.name);

  constructor(
    private readonly workoutsRepo: WorkoutsCompletedRepository,
    private readonly profilesRepo: AthleteProfileRepository,
  ) {}

  async run(userId: string): Promise<RenormalizeResult> {
    const summary: RenormalizeResult = {
      userId,
      considered: 0,
      recomputed: 0,
      stillPending: 0,
      failed: 0,
    };

    const profile = await this.profilesRepo.findByUserId(userId);
    if (!profile) {
      this.logger.warn(`Renormalize requested for ${userId} but no AthleteProfile exists.`);
      return summary;
    }

    const rows = await this.workoutsRepo.findPendingByUserAndSource(userId, 'strava');
    summary.considered = rows.length;

    for (const row of rows) {
      try {
        rawActivityGuard.parse(row.raw);
        const activity = row.raw as StravaActivity;
        const normalized = normalizeStravaActivity({
          userId,
          activity,
          athleteProfile: profile,
        });
        if (normalized && normalized.tssStatus === 'computed') {
          await this.workoutsRepo.upsert(normalized);
          summary.recomputed += 1;
        } else {
          summary.stillPending += 1;
        }
      } catch (err) {
        summary.failed += 1;
        const detail = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Renormalize failed for (strava, ${row.externalId}): ${detail}`,
        );
      }
    }

    this.logger.log(
      `Renormalize done for ${userId}: considered=${summary.considered}, ` +
        `recomputed=${summary.recomputed}, stillPending=${summary.stillPending}, ` +
        `failed=${summary.failed}.`,
    );
    return summary;
  }
}
