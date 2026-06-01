import { Injectable, Logger } from '@nestjs/common';

/**
 * Placeholder — C4 of ETA-25 fills this in with the 90-day backfill flow:
 *   list /athlete/activities since now-90d → fetch each → normalize → upsert.
 *
 * The controller injects this so the OAuth callback can trigger backfill on
 * first connect without depending on a stub-vs-real swap later.
 */
@Injectable()
export class StravaBackfillService {
  private readonly logger = new Logger(StravaBackfillService.name);

  /** Fire-and-forget. Returns immediately; runs async. */
  trigger(userId: string): void {
    this.logger.log(`Backfill trigger received for user ${userId} (stub — C4 implements).`);
  }
}
