import { Logger } from '@nestjs/common';
import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.schema.js';
import type { StravaBackfillService } from './strava-backfill.service.js';

/** Wait this long after boot before the first sync, so the app finishes starting. */
const STARTUP_DELAY_MS = 4_000;

/**
 * Keeps the local DB fresh without a live Strava webhook: runs an incremental
 * sync once shortly after boot, then every STRAVA_SYNC_INTERVAL_MINUTES.
 * Disabled (no timers armed) when the interval is 0. Only constructed when the
 * Strava module is registered (STRAVA_ENABLED=true).
 */
export class StravaSyncScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StravaSyncScheduler.name);
  private readonly userId: string;
  private readonly intervalMs: number;
  private running = false;
  private startupTimer: NodeJS.Timeout | null = null;
  private intervalTimer: NodeJS.Timeout | null = null;

  constructor(
    config: ConfigService<Env, true>,
    private readonly backfill: StravaBackfillService,
  ) {
    this.userId = config.get('DEV_USER_ID', { infer: true });
    const minutes = config.get('STRAVA_SYNC_INTERVAL_MINUTES', { infer: true });
    this.intervalMs = minutes * 60_000;
  }

  isEnabled(): boolean {
    return this.intervalMs > 0;
  }

  onModuleInit(): void {
    if (!this.isEnabled()) {
      this.logger.log('Strava background sync disabled (STRAVA_SYNC_INTERVAL_MINUTES=0).');
      return;
    }
    this.logger.log(
      `Strava background sync enabled — first run in ${STARTUP_DELAY_MS / 1000}s, then every ${this.intervalMs / 60_000}min.`,
    );
    this.startupTimer = setTimeout(() => void this.runOnce(), STARTUP_DELAY_MS);
    this.intervalTimer = setInterval(() => void this.runOnce(), this.intervalMs);
    // Don't keep the process (or a standalone CLI context) alive just for these.
    this.startupTimer.unref?.();
    this.intervalTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.startupTimer) clearTimeout(this.startupTimer);
    if (this.intervalTimer) clearInterval(this.intervalTimer);
    this.startupTimer = null;
    this.intervalTimer = null;
  }

  /** One guarded sync tick. Never throws — errors are logged so the schedule survives. */
  async runOnce(): Promise<void> {
    if (this.running) {
      this.logger.debug('Strava sync already in progress; skipping this tick.');
      return;
    }
    this.running = true;
    try {
      const result = await this.backfill.syncRecent(this.userId);
      this.logger.log(
        `Strava sync done — ingested=${result.ingested}, skipped=${result.skipped}, failed=${result.failed}.`,
      );
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Strava background sync failed: ${detail}`);
    } finally {
      this.running = false;
    }
  }
}
