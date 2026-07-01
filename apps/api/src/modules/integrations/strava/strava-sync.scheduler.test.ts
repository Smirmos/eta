import { describe, expect, it, vi } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.schema.js';
import type { StravaBackfillService } from './strava-backfill.service.js';
import { StravaSyncScheduler } from './strava-sync.scheduler.js';

const USER_ID = '00000000-0000-0000-0000-000000000001';

function makeConfig(overrides: Partial<Record<keyof Env, unknown>> = {}): ConfigService<Env, true> {
  const values: Record<string, unknown> = {
    STRAVA_ENABLED: true,
    STRAVA_SYNC_INTERVAL_MINUTES: 60,
    DEV_USER_ID: USER_ID,
    ...overrides,
  };
  return { get: (key: string) => values[key] } as unknown as ConfigService<Env, true>;
}

function makeBackfill(impl?: () => Promise<unknown>): {
  backfill: StravaBackfillService;
  spy: ReturnType<typeof vi.fn>;
} {
  const spy = vi.fn(impl ?? (async () => ({ userId: USER_ID, considered: 1, ingested: 1, skipped: 0, failed: 0 })));
  return { backfill: { syncRecent: spy } as unknown as StravaBackfillService, spy };
}

describe('StravaSyncScheduler', () => {
  it('runOnce delegates to the incremental syncRecent for the dev user', async () => {
    const { backfill, spy } = makeBackfill();
    const sched = new StravaSyncScheduler(makeConfig(), backfill);
    await sched.runOnce();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(USER_ID);
  });

  it('runOnce swallows sync errors so the schedule keeps ticking', async () => {
    const { backfill, spy } = makeBackfill(async () => {
      throw new Error('strava down');
    });
    const sched = new StravaSyncScheduler(makeConfig(), backfill);
    await expect(sched.runOnce()).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('skips overlapping runs while one is already in flight', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { backfill, spy } = makeBackfill(async () => {
      await gate;
      return { userId: USER_ID, considered: 0, ingested: 0, skipped: 0, failed: 0 };
    });
    const sched = new StravaSyncScheduler(makeConfig(), backfill);

    const first = sched.runOnce();
    const second = sched.runOnce(); // should no-op: first is still running
    expect(spy).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([first, second]);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('does not arm timers when the scheduler is disabled (interval 0)', () => {
    const { backfill } = makeBackfill();
    const sched = new StravaSyncScheduler(makeConfig({ STRAVA_SYNC_INTERVAL_MINUTES: 0 }), backfill);
    expect(sched.isEnabled()).toBe(false);
    sched.onModuleInit();
    sched.onModuleDestroy();
  });
});
