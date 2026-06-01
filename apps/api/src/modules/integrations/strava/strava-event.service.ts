import { Injectable, Logger } from '@nestjs/common';
import { AthleteProfileRepository } from '../../../db/repositories/athlete-profile.repository.js';
import { OauthCredentialsRepository } from '../../../db/repositories/oauth-credentials.repository.js';
import { WorkoutsCompletedRepository } from '../../../db/repositories/workouts-completed.repository.js';
import { StravaClientService } from './strava-client.service.js';
import { normalizeStravaActivity } from './strava-normalizer.js';
import { STRAVA_PROVIDER } from './strava-oauth.service.js';
import type { StravaWebhookEvent } from './strava.types.js';

@Injectable()
export class StravaEventService {
  private readonly logger = new Logger(StravaEventService.name);

  constructor(
    private readonly credentialsRepo: OauthCredentialsRepository,
    private readonly profilesRepo: AthleteProfileRepository,
    private readonly workoutsRepo: WorkoutsCompletedRepository,
    private readonly client: StravaClientService,
  ) {}

  /**
   * Ingest one Strava webhook event. Idempotent on (source, external_id) —
   * 'update' events upsert the existing row. Deletes are logged but not
   * destructive in v1 (we keep the historical row).
   */
  async handle(event: StravaWebhookEvent): Promise<void> {
    if (event.object_type !== 'activity') {
      this.logger.log(`Ignoring Strava webhook event with object_type=${event.object_type}.`);
      return;
    }
    if (event.aspect_type === 'delete') {
      this.logger.log(
        `Strava activity ${event.object_id} deleted upstream — keeping local row.`,
      );
      return;
    }

    const ownerId = String(event.owner_id);
    const creds = await this.credentialsRepo.findByProviderAndExternalId(
      STRAVA_PROVIDER,
      ownerId,
    );
    if (!creds) {
      this.logger.warn(
        `Strava webhook event for unknown owner_id=${ownerId}; no credentials on file.`,
      );
      return;
    }

    const activity = await this.client.getActivity(creds.userId, event.object_id);
    const profile = await this.profilesRepo.findByUserId(creds.userId);
    const row = normalizeStravaActivity({
      userId: creds.userId,
      activity,
      athleteProfile: profile,
    });
    if (!row) {
      this.logger.log(
        `Strava activity ${activity.id} type=${activity.type} is not swim/bike/run — skipped.`,
      );
      return;
    }
    await this.workoutsRepo.upsert(row);
    this.logger.log(
      `Ingested Strava activity ${activity.id} (${row.discipline}, tss=${row.actualTss ?? 'pending'})`,
    );
  }
}
