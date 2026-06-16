# AthleteProfile Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the HTTP + CLI entry points so an `AthleteProfile` can be persisted and consumed end-to-end, flipping the 89 `pending_inference` Strava rows to `computed` for the bike-with-power subset.

**Architecture:** New unconditional `AthleteProfileModule` exposes `POST /athlete-profiles` + `GET /athlete-profiles/me`. POST returns 201 immediately and fires a `setImmediate` background renormalisation. A new `StravaRenormalizeService` (file in `modules/integrations/strava/`, provider registered on `AthleteProfileModule`) walks `pending_inference` rows for a user, re-runs the existing pure `normalizeStravaActivity` against stored `raw` JSONB, upserts the bike-with-power rows. New `pnpm seed:profile` CLI seeds `DEV_USER_ID` from `test-profile.json`. Four CLIs (`generate-test-plan`, `generate-test-week`, `generate-test-adaptation`, `render-plan`) flip to default-to-DB profile lookup via a shared `loadProfile()` helper, with `--profile=<path>` still overriding.

**Tech Stack:** NestJS (Fastify adapter) + Drizzle ORM + postgres-js + Zod (`@eta/shared-types`) + Vitest + `@testcontainers/postgresql`.

**Spec:** `docs/superpowers/specs/2026-06-16-athlete-profile-path-design.md`

---

## File Map

**Create:**
- `apps/api/src/modules/athlete-profile/athlete-profile.module.ts`
- `apps/api/src/modules/athlete-profile/athlete-profile.controller.ts`
- `apps/api/src/modules/athlete-profile/athlete-profile.controller.test.ts`
- `apps/api/src/modules/athlete-profile/athlete-profile.service.ts`
- `apps/api/src/modules/athlete-profile/athlete-profile.service.test.ts`
- `apps/api/src/modules/integrations/strava/strava-renormalize.service.ts`
- `apps/api/src/modules/integrations/strava/strava-renormalize.service.test.ts`
- `apps/api/scripts/lib/load-profile.ts`
- `apps/api/scripts/seed-profile.ts`

**Modify:**
- `apps/api/src/db/repositories/workouts-completed.repository.ts` — add `findPendingByUserAndSource`
- `apps/api/src/app.module.ts` — import `AthleteProfileModule`
- `apps/api/package.json` — add `seed:profile` script
- `apps/api/scripts/generate-test-plan.ts` — use `loadProfile`
- `apps/api/scripts/generate-test-week.ts` — use `loadProfile`
- `apps/api/scripts/generate-test-adaptation.ts` — use `loadProfile`
- `apps/api/scripts/render-plan.ts` — use `loadProfile`
- `docs/strava-dev.md` — add the smoke recipe for seed-profile + renormalise

**No-change but referenced:**
- `apps/api/src/db/repositories/athlete-profile.repository.ts` — `create()` + `findByUserId()` used as-is
- `apps/api/src/modules/integrations/strava/strava-normalizer.ts` — pure `normalizeStravaActivity()` reused

---

## Task 1: Renormalise service (TDD with mocked repos)

**Files:**
- Create: `apps/api/src/modules/integrations/strava/strava-renormalize.service.ts`
- Create: `apps/api/src/modules/integrations/strava/strava-renormalize.service.test.ts`
- Modify: `apps/api/src/db/repositories/workouts-completed.repository.ts` (add `findPendingByUserAndSource`)

This task includes the new repo method because the renormalise service is its only caller in v1 and an integration test covers it (see Task 2). No standalone repo test.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/modules/integrations/strava/strava-renormalize.service.test.ts`:

```typescript
import type { AthleteProfile } from '@eta/shared-types';
import { describe, expect, it, vi } from 'vitest';
import type { AthleteProfileRepository } from '../../../db/repositories/athlete-profile.repository.js';
import type { WorkoutsCompletedRepository } from '../../../db/repositories/workouts-completed.repository.js';
import type { WorkoutsCompletedRow } from '../../../db/schema/workouts-completed.js';
import { StravaRenormalizeService } from './strava-renormalize.service.js';

const USER_ID = '00000000-0000-0000-0000-000000000001';

function profileWithFtp(ftpWatts: number): AthleteProfile {
  return {
    experienceLevel: 'tri_experienced',
    raceDate: new Date('2026-08-22T00:00:00Z'),
    raceType: 'full_ironman',
    weeksUntilRace: 10,
    recentWeeklyHours: { value: 9, confidence: 'medium', source: 'self_reported' },
    plannedWeeklyHours: 11,
    longestRecentSessions: {
      swimMeters: { value: 3000, confidence: 'high', source: 'self_reported' },
      bikeMinutes: { value: 300, confidence: 'high', source: 'self_reported' },
      runMinutes: { value: 240, confidence: 'high', source: 'self_reported' },
    },
    thresholds: {
      swimTPacePer100m: { value: '2:30', confidence: 'medium', source: 'estimated' },
      bikeFtpWatts: { value: ftpWatts, confidence: 'high', source: 'measured' },
      bikeThresholdHr: { value: 165, confidence: 'medium', source: 'estimated' },
      runThresholdPacePerKm: { value: '4:00', confidence: 'high', source: 'self_reported' },
      runThresholdHr: { value: 180, confidence: 'high', source: 'self_reported' },
    },
    disciplineDistribution: { swimPercent: 15, bikePercent: 50, runPercent: 35 },
    fitnessTrend: 'stable',
    trainingDaysPerWeek: 6,
    longSessionDays: ['sat', 'sun'],
    mandatoryRestDays: [],
    maxWeekdaySessionMinutes: 90,
    currentInjuries: [],
    recentIllnessOrTimeOff: false,
    raceHistory: [],
    source: 'mixed',
    overallConfidence: 'medium',
    generatedAt: new Date('2026-06-16T12:00:00Z'),
    warnings: [],
  };
}

function bikeWithPowerRow(externalId: string): WorkoutsCompletedRow {
  return {
    id: `id-${externalId}`,
    userId: USER_ID,
    source: 'strava',
    externalId,
    date: '2026-06-01',
    discipline: 'bike',
    workoutCode: null,
    actualTss: null,
    tssStatus: 'pending_inference',
    plannedTss: null,
    plannedDurationSeconds: null,
    actualDurationSeconds: 3600,
    perceivedExertion: null,
    notes: null,
    raw: {
      id: Number(externalId),
      type: 'Ride',
      start_date_local: '2026-06-01T08:00:00Z',
      moving_time: 3600,
      elapsed_time: 3700,
      name: 'Bike with power',
      weighted_average_watts: 200,
      average_watts: 195,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as WorkoutsCompletedRow;
}

function runRow(externalId: string): WorkoutsCompletedRow {
  const row = bikeWithPowerRow(externalId);
  return {
    ...row,
    discipline: 'run',
    raw: {
      id: Number(externalId),
      type: 'Run',
      start_date_local: '2026-06-01T08:00:00Z',
      moving_time: 3600,
      elapsed_time: 3700,
      name: 'Easy run',
    },
  } as WorkoutsCompletedRow;
}

function makeProfilesRepo(profile: AthleteProfile | null): AthleteProfileRepository {
  return { findByUserId: vi.fn(async () => profile) } as unknown as AthleteProfileRepository;
}

function makeWorkoutsRepo(rows: WorkoutsCompletedRow[]): {
  repo: WorkoutsCompletedRepository;
  findSpy: ReturnType<typeof vi.fn>;
  upsertSpy: ReturnType<typeof vi.fn>;
} {
  const findSpy = vi.fn(async () => rows);
  const upsertSpy = vi.fn(async (row: unknown) => row);
  const repo = {
    findPendingByUserAndSource: findSpy,
    upsert: upsertSpy,
  } as unknown as WorkoutsCompletedRepository;
  return { repo, findSpy, upsertSpy };
}

describe('StravaRenormalizeService', () => {
  it('flips a bike-with-power pending row to computed', async () => {
    const profile = profileWithFtp(200);
    const { repo: workoutsRepo, upsertSpy } = makeWorkoutsRepo([bikeWithPowerRow('1')]);
    const svc = new StravaRenormalizeService(workoutsRepo, makeProfilesRepo(profile));

    const result = await svc.run(USER_ID);

    expect(result).toEqual({
      userId: USER_ID,
      considered: 1,
      recomputed: 1,
      stillPending: 0,
      failed: 0,
    });
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    const upserted = upsertSpy.mock.calls[0]![0] as { tssStatus: string; actualTss: string };
    expect(upserted.tssStatus).toBe('computed');
    expect(Number(upserted.actualTss)).toBeGreaterThan(0);
  });

  it('keeps run rows pending (run TSS path deferred)', async () => {
    const profile = profileWithFtp(200);
    const { repo: workoutsRepo, upsertSpy } = makeWorkoutsRepo([runRow('2')]);
    const svc = new StravaRenormalizeService(workoutsRepo, makeProfilesRepo(profile));

    const result = await svc.run(USER_ID);

    expect(result.stillPending).toBe(1);
    expect(result.recomputed).toBe(0);
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('returns zeros and does not throw when no profile exists', async () => {
    const { repo: workoutsRepo, findSpy, upsertSpy } = makeWorkoutsRepo([bikeWithPowerRow('3')]);
    const svc = new StravaRenormalizeService(workoutsRepo, makeProfilesRepo(null));

    const result = await svc.run(USER_ID);

    expect(result).toEqual({
      userId: USER_ID,
      considered: 0,
      recomputed: 0,
      stillPending: 0,
      failed: 0,
    });
    expect(findSpy).not.toHaveBeenCalled();
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('isolates per-row failures', async () => {
    const profile = profileWithFtp(200);
    const bad = bikeWithPowerRow('bad');
    (bad as { raw: unknown }).raw = { not: 'an activity' };
    const good = bikeWithPowerRow('good');
    const { repo: workoutsRepo, upsertSpy } = makeWorkoutsRepo([bad, good]);
    const svc = new StravaRenormalizeService(workoutsRepo, makeProfilesRepo(profile));

    const result = await svc.run(USER_ID);

    expect(result.considered).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.recomputed).toBe(1);
    expect(upsertSpy).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @eta/api vitest run src/modules/integrations/strava/strava-renormalize.service.test.ts
```

Expected: FAIL — module `./strava-renormalize.service.js` not found.

- [ ] **Step 3: Add `findPendingByUserAndSource` to the workouts repository**

Modify `apps/api/src/db/repositories/workouts-completed.repository.ts`. Add this method inside the class (after `upsert`, before any closing brace; preserve other methods exactly as-is). Also add the `and` import is already there. Verify the import list still includes `and` and `eq`.

```typescript
  async findPendingByUserAndSource(userId: string, source: string): Promise<WorkoutsCompletedRow[]> {
    return this.db
      .select()
      .from(workoutsCompleted)
      .where(
        and(
          eq(workoutsCompleted.userId, userId),
          eq(workoutsCompleted.source, source),
          eq(workoutsCompleted.tssStatus, 'pending_inference'),
        ),
      );
  }
```

- [ ] **Step 4: Write the renormalise service**

Create `apps/api/src/modules/integrations/strava/strava-renormalize.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { AthleteProfileRepository } from '../../../db/repositories/athlete-profile.repository.js';
import { WorkoutsCompletedRepository } from '../../../db/repositories/workouts-completed.repository.js';
import { normalizeStravaActivity } from './strava-normalizer.js';
import type { StravaActivity } from './strava.types.js';

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
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm --filter @eta/api vitest run src/modules/integrations/strava/strava-renormalize.service.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 6: Run typecheck**

```bash
pnpm --filter @eta/api typecheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/integrations/strava/strava-renormalize.service.ts \
        apps/api/src/modules/integrations/strava/strava-renormalize.service.test.ts \
        apps/api/src/db/repositories/workouts-completed.repository.ts
git commit -m "feat(eta-25): StravaRenormalizeService + findPendingByUserAndSource"
```

---

## Task 2: Renormalise integration test (real Postgres via testcontainers)

**Files:**
- Modify: `apps/api/src/modules/integrations/strava/strava-renormalize.service.test.ts` (append integration block)

- [ ] **Step 1: Append the integration `describe` block**

Add to the end of `strava-renormalize.service.test.ts`, after the existing `describe('StravaRenormalizeService', …)` block:

```typescript
import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import * as schema from '../../../db/schema/index.js';
import { AthleteProfileRepository } from '../../../db/repositories/athlete-profile.repository.js';
import { WorkoutsCompletedRepository } from '../../../db/repositories/workouts-completed.repository.js';

describe('StravaRenormalizeService (real Postgres)', () => {
  let container: StartedPostgreSqlContainer;
  let client: ReturnType<typeof postgres>;
  let db: PostgresJsDatabase<typeof schema>;
  let svc: StravaRenormalizeService;
  let workoutsRepo: WorkoutsCompletedRepository;
  let profilesRepo: AthleteProfileRepository;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    client = postgres(container.getConnectionUri(), { max: 5 });
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: './drizzle' });
    workoutsRepo = new WorkoutsCompletedRepository(db);
    profilesRepo = new AthleteProfileRepository(db);
    svc = new StravaRenormalizeService(workoutsRepo, profilesRepo);
  }, 120_000);

  afterAll(async () => {
    if (client) await client.end();
    if (container) await container.stop();
  }, 30_000);

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE athlete_profiles, workouts_completed RESTART IDENTITY CASCADE`);
  });

  it('flips only the bike-with-power row and leaves others pending', async () => {
    const userId = '22222222-2222-2222-2222-222222222222';
    await profilesRepo.create({ userId, profile: profileWithFtp(200) });
    await workoutsRepo.upsert({
      ...bikeWithPowerRow('100'),
      userId,
      id: undefined as unknown as string,
      createdAt: undefined as unknown as Date,
      updatedAt: undefined as unknown as Date,
    } as never);
    // Bike no-power row
    await workoutsRepo.upsert({
      ...bikeWithPowerRow('101'),
      userId,
      raw: {
        id: 101,
        type: 'Ride',
        start_date_local: '2026-06-01T08:00:00Z',
        moving_time: 3600,
        elapsed_time: 3700,
        name: 'Bike no power',
      },
      id: undefined as unknown as string,
      createdAt: undefined as unknown as Date,
      updatedAt: undefined as unknown as Date,
    } as never);
    // Run row
    await workoutsRepo.upsert({
      ...runRow('102'),
      userId,
      id: undefined as unknown as string,
      createdAt: undefined as unknown as Date,
      updatedAt: undefined as unknown as Date,
    } as never);

    const result = await svc.run(userId);

    expect(result.considered).toBe(3);
    expect(result.recomputed).toBe(1);
    expect(result.stillPending).toBe(2);
    expect(result.failed).toBe(0);

    const bikeRow = await workoutsRepo.findBySourceAndExternalId('strava', '100');
    expect(bikeRow?.tssStatus).toBe('computed');
    expect(bikeRow?.actualTss).not.toBeNull();

    const noPower = await workoutsRepo.findBySourceAndExternalId('strava', '101');
    expect(noPower?.tssStatus).toBe('pending_inference');

    const run = await workoutsRepo.findBySourceAndExternalId('strava', '102');
    expect(run?.tssStatus).toBe('pending_inference');
  });
});
```

- [ ] **Step 2: Run the integration block to verify it passes**

```bash
pnpm --filter @eta/api vitest run src/modules/integrations/strava/strava-renormalize.service.test.ts
```

Expected: 5 tests pass total (4 unit + 1 integration). May take ~30s on first run while the Postgres container boots.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/integrations/strava/strava-renormalize.service.test.ts
git commit -m "test(eta-25): integration test for StravaRenormalizeService"
```

---

## Task 3: AthleteProfileService (TDD with mocks)

**Files:**
- Create: `apps/api/src/modules/athlete-profile/athlete-profile.service.ts`
- Create: `apps/api/src/modules/athlete-profile/athlete-profile.service.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/modules/athlete-profile/athlete-profile.service.test.ts`:

```typescript
import type { AthleteProfile } from '@eta/shared-types';
import { describe, expect, it, vi } from 'vitest';
import type {
  AthleteProfileRecord,
  AthleteProfileRepository,
} from '../../db/repositories/athlete-profile.repository.js';
import type { StravaRenormalizeService } from '../integrations/strava/strava-renormalize.service.js';
import { AthleteProfileService } from './athlete-profile.service.js';

const USER_ID = '00000000-0000-0000-0000-000000000001';

function profile(): AthleteProfile {
  return {
    experienceLevel: 'tri_experienced',
    raceDate: new Date('2026-08-22T00:00:00Z'),
    raceType: 'full_ironman',
    weeksUntilRace: 10,
    recentWeeklyHours: { value: 9, confidence: 'medium', source: 'self_reported' },
    plannedWeeklyHours: 11,
    longestRecentSessions: {
      swimMeters: { value: 3000, confidence: 'high', source: 'self_reported' },
      bikeMinutes: { value: 300, confidence: 'high', source: 'self_reported' },
      runMinutes: { value: 240, confidence: 'high', source: 'self_reported' },
    },
    thresholds: {
      swimTPacePer100m: { value: '2:30', confidence: 'medium', source: 'estimated' },
      bikeFtpWatts: { value: 200, confidence: 'high', source: 'measured' },
      bikeThresholdHr: { value: 165, confidence: 'medium', source: 'estimated' },
      runThresholdPacePerKm: { value: '4:00', confidence: 'high', source: 'self_reported' },
      runThresholdHr: { value: 180, confidence: 'high', source: 'self_reported' },
    },
    disciplineDistribution: { swimPercent: 15, bikePercent: 50, runPercent: 35 },
    fitnessTrend: 'stable',
    trainingDaysPerWeek: 6,
    longSessionDays: ['sat', 'sun'],
    mandatoryRestDays: [],
    maxWeekdaySessionMinutes: 90,
    currentInjuries: [],
    recentIllnessOrTimeOff: false,
    raceHistory: [],
    source: 'mixed',
    overallConfidence: 'medium',
    generatedAt: new Date(),
    warnings: [],
  };
}

function record(): AthleteProfileRecord {
  return {
    id: 'profile-id-1',
    userId: USER_ID,
    profile: profile(),
    source: 'mixed',
    overallConfidence: 'medium',
    generatedAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeRepo(opts: { latest?: AthleteProfile | null } = {}): AthleteProfileRepository {
  return {
    create: vi.fn(async () => record()),
    findByUserId: vi.fn(async () => opts.latest ?? null),
  } as unknown as AthleteProfileRepository;
}

function makeRenormalize(opts: { throwInside?: boolean } = {}): {
  svc: StravaRenormalizeService;
  runSpy: ReturnType<typeof vi.fn>;
} {
  const runSpy = vi.fn(async () => {
    if (opts.throwInside) throw new Error('renorm boom');
    return { userId: USER_ID, considered: 0, recomputed: 0, stillPending: 0, failed: 0 };
  });
  const svc = { run: runSpy } as unknown as StravaRenormalizeService;
  return { svc, runSpy };
}

// Helper: flush all pending microtasks + setImmediate callbacks.
function flushImmediates(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('AthleteProfileService', () => {
  it('creates a profile and schedules a background renormalise', async () => {
    const repo = makeRepo();
    const { svc: renorm, runSpy } = makeRenormalize();
    const service = new AthleteProfileService(repo, renorm);

    const out = await service.create({ userId: USER_ID, profile: profile() });
    expect(out.id).toBe('profile-id-1');

    expect(runSpy).not.toHaveBeenCalled(); // not yet — runs on next tick
    await flushImmediates();
    expect(runSpy).toHaveBeenCalledTimes(1);
    expect(runSpy).toHaveBeenCalledWith(USER_ID);
  });

  it('returning of latest is a thin pass-through', async () => {
    const stored = profile();
    const repo = makeRepo({ latest: stored });
    const { svc: renorm } = makeRenormalize();
    const service = new AthleteProfileService(repo, renorm);
    const out = await service.getLatestFor(USER_ID);
    expect(out).toBe(stored);
  });

  it('background renormalise failure does not propagate to the caller', async () => {
    const repo = makeRepo();
    const { svc: renorm } = makeRenormalize({ throwInside: true });
    const service = new AthleteProfileService(repo, renorm);

    await expect(service.create({ userId: USER_ID, profile: profile() })).resolves.toBeDefined();
    await flushImmediates();
    // Test passes if no unhandled rejection. The service's internal logger
    // swallows the error.
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @eta/api vitest run src/modules/athlete-profile/athlete-profile.service.test.ts
```

Expected: FAIL — module `./athlete-profile.service.js` not found.

- [ ] **Step 3: Write the service**

Create `apps/api/src/modules/athlete-profile/athlete-profile.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import type { AthleteProfile } from '@eta/shared-types';
import {
  AthleteProfileRepository,
  type AthleteProfileRecord,
} from '../../db/repositories/athlete-profile.repository.js';
import { StravaRenormalizeService } from '../integrations/strava/strava-renormalize.service.js';

@Injectable()
export class AthleteProfileService {
  private readonly logger = new Logger(AthleteProfileService.name);

  constructor(
    private readonly repo: AthleteProfileRepository,
    private readonly renormalize: StravaRenormalizeService,
  ) {}

  async create(input: { userId: string; profile: AthleteProfile }): Promise<AthleteProfileRecord> {
    const record = await this.repo.create(input);
    setImmediate(() => {
      this.renormalize.run(input.userId).catch((err: unknown) => {
        const detail = err instanceof Error ? err.stack ?? err.message : String(err);
        this.logger.error(`Background renormalize failed for ${input.userId}: ${detail}`);
      });
    });
    return record;
  }

  async getLatestFor(userId: string): Promise<AthleteProfile | null> {
    return this.repo.findByUserId(userId);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @eta/api vitest run src/modules/athlete-profile/athlete-profile.service.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/athlete-profile/athlete-profile.service.ts \
        apps/api/src/modules/athlete-profile/athlete-profile.service.test.ts
git commit -m "feat(eta-25): AthleteProfileService"
```

---

## Task 4: AthleteProfileController (TDD with mocks)

**Files:**
- Create: `apps/api/src/modules/athlete-profile/athlete-profile.controller.ts`
- Create: `apps/api/src/modules/athlete-profile/athlete-profile.controller.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/modules/athlete-profile/athlete-profile.controller.test.ts`:

```typescript
import type { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { AthleteProfile } from '@eta/shared-types';
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../../config/env.schema.js';
import type {
  AthleteProfileRecord,
  AthleteProfileRepository,
} from '../../db/repositories/athlete-profile.repository.js';
import { AthleteProfileService } from './athlete-profile.service.js';
import { AthleteProfileController } from './athlete-profile.controller.js';

const USER_ID = '00000000-0000-0000-0000-000000000001';

function makeConfig(): ConfigService<Env, true> {
  return { get: (_k: string) => USER_ID } as unknown as ConfigService<Env, true>;
}

function validProfileBody(): unknown {
  return {
    experienceLevel: 'tri_experienced',
    raceDate: '2026-08-22T00:00:00Z',
    raceType: 'full_ironman',
    weeksUntilRace: 10,
    recentWeeklyHours: { value: 9, confidence: 'medium', source: 'self_reported' },
    plannedWeeklyHours: 11,
    longestRecentSessions: {
      swimMeters: { value: 3000, confidence: 'high', source: 'self_reported' },
      bikeMinutes: { value: 300, confidence: 'high', source: 'self_reported' },
      runMinutes: { value: 240, confidence: 'high', source: 'self_reported' },
    },
    thresholds: {
      swimTPacePer100m: { value: '2:30', confidence: 'medium', source: 'estimated' },
      bikeFtpWatts: { value: 200, confidence: 'high', source: 'measured' },
      bikeThresholdHr: { value: 165, confidence: 'medium', source: 'estimated' },
      runThresholdPacePerKm: { value: '4:00', confidence: 'high', source: 'self_reported' },
      runThresholdHr: { value: 180, confidence: 'high', source: 'self_reported' },
    },
    disciplineDistribution: { swimPercent: 15, bikePercent: 50, runPercent: 35 },
    fitnessTrend: 'stable',
    trainingDaysPerWeek: 6,
    longSessionDays: ['sat', 'sun'],
    mandatoryRestDays: [],
    maxWeekdaySessionMinutes: 90,
    currentInjuries: [],
    recentIllnessOrTimeOff: false,
    raceHistory: [],
    source: 'mixed',
    overallConfidence: 'medium',
    generatedAt: '2026-06-16T12:00:00Z',
    warnings: [],
  };
}

function makeService(opts: {
  createReturns?: AthleteProfileRecord;
  latest?: AthleteProfile | null;
}): {
  service: AthleteProfileService;
  createSpy: ReturnType<typeof vi.fn>;
} {
  const createSpy = vi.fn(async () => opts.createReturns ?? ({} as AthleteProfileRecord));
  const getLatestSpy = vi.fn(async () => opts.latest ?? null);
  const service = {
    create: createSpy,
    getLatestFor: getLatestSpy,
  } as unknown as AthleteProfileService;
  return { service, createSpy };
}

describe('AthleteProfileController', () => {
  it('POST validates the body and creates a profile', async () => {
    const createReturns: AthleteProfileRecord = {
      id: 'p-1',
      userId: USER_ID,
      profile: {} as AthleteProfile,
      source: 'mixed',
      overallConfidence: 'medium',
      generatedAt: new Date('2026-06-16T12:00:00Z'),
      updatedAt: new Date('2026-06-16T12:00:00Z'),
    };
    const { service, createSpy } = makeService({ createReturns });
    const controller = new AthleteProfileController(service, makeConfig());

    const out = await controller.create(validProfileBody());

    expect(out).toEqual({
      id: 'p-1',
      userId: USER_ID,
      generatedAt: createReturns.generatedAt.toISOString(),
      updatedAt: createReturns.updatedAt.toISOString(),
    });
    expect(createSpy).toHaveBeenCalledTimes(1);
    const callArg = createSpy.mock.calls[0]![0] as { userId: string };
    expect(callArg.userId).toBe(USER_ID);
  });

  it('POST rejects invalid bodies with BadRequestException', async () => {
    const { service } = makeService({});
    const controller = new AthleteProfileController(service, makeConfig());
    await expect(controller.create({ not: 'a profile' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('GET /me returns the latest profile', async () => {
    const stored = {
      experienceLevel: 'tri_experienced',
    } as unknown as AthleteProfile;
    const { service } = makeService({ latest: stored });
    const controller = new AthleteProfileController(service, makeConfig());
    const out = await controller.getMe();
    expect(out).toBe(stored);
  });

  it('GET /me throws NotFoundException when no profile exists', async () => {
    const { service } = makeService({ latest: null });
    const controller = new AthleteProfileController(service, makeConfig());
    await expect(controller.getMe()).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @eta/api vitest run src/modules/athlete-profile/athlete-profile.controller.test.ts
```

Expected: FAIL — module `./athlete-profile.controller.js` not found.

- [ ] **Step 3: Write the controller**

Create `apps/api/src/modules/athlete-profile/athlete-profile.controller.ts`:

```typescript
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type AthleteProfile, athleteProfileSchema } from '@eta/shared-types';
import type { Env } from '../../config/env.schema.js';
import { AthleteProfileService } from './athlete-profile.service.js';

interface CreateProfileResponse {
  id: string;
  userId: string;
  generatedAt: string;
  updatedAt: string;
}

@Controller('athlete-profiles')
export class AthleteProfileController {
  constructor(
    private readonly service: AthleteProfileService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post()
  @HttpCode(201)
  async create(@Body() body: unknown): Promise<CreateProfileResponse> {
    const parsed = athleteProfileSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        error: 'invalid_profile',
        issues: parsed.error.issues,
      });
    }
    const userId = this.getCurrentUserId();
    const record = await this.service.create({ userId, profile: parsed.data });
    return {
      id: record.id,
      userId: record.userId,
      generatedAt: record.generatedAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  @Get('me')
  async getMe(): Promise<AthleteProfile> {
    const userId = this.getCurrentUserId();
    const profile = await this.service.getLatestFor(userId);
    if (!profile) {
      throw new NotFoundException({ error: 'no_profile_for_user', userId });
    }
    return profile;
  }

  private getCurrentUserId(): string {
    return this.config.get('DEV_USER_ID', { infer: true });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @eta/api vitest run src/modules/athlete-profile/athlete-profile.controller.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/athlete-profile/athlete-profile.controller.ts \
        apps/api/src/modules/athlete-profile/athlete-profile.controller.test.ts
git commit -m "feat(eta-25): AthleteProfileController (POST + GET /me)"
```

---

## Task 5: Module wiring (AthleteProfileModule + AppModule)

**Files:**
- Create: `apps/api/src/modules/athlete-profile/athlete-profile.module.ts`
- Modify: `apps/api/src/app.module.ts` (add import)

- [ ] **Step 1: Create the module**

Create `apps/api/src/modules/athlete-profile/athlete-profile.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module.js';
import { AthleteProfileRepository } from '../../db/repositories/athlete-profile.repository.js';
import { WorkoutsCompletedRepository } from '../../db/repositories/workouts-completed.repository.js';
import { StravaRenormalizeService } from '../integrations/strava/strava-renormalize.service.js';
import { AthleteProfileController } from './athlete-profile.controller.js';
import { AthleteProfileService } from './athlete-profile.service.js';

@Module({
  imports: [DbModule],
  controllers: [AthleteProfileController],
  providers: [
    AthleteProfileRepository,
    WorkoutsCompletedRepository,
    StravaRenormalizeService,
    AthleteProfileService,
  ],
  exports: [AthleteProfileService, StravaRenormalizeService],
})
export class AthleteProfileModule {}
```

- [ ] **Step 2: Wire into AppModule**

Modify `apps/api/src/app.module.ts`. Add the import near the other module imports and include it in the `imports:` array. The file currently looks like:

```typescript
import { PlanGenerationModule } from './modules/plan-generation/plan-generation.module.js';
import { StravaModule } from './modules/integrations/strava/strava.module.js';
```

Add right after the `PlanGenerationModule` import:

```typescript
import { AthleteProfileModule } from './modules/athlete-profile/athlete-profile.module.js';
```

Then update the `imports:` array. Currently:

```typescript
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: ['../../.env', '.env'],
    }),
    PlanGenerationModule,
    ...optionalStravaModule(),
  ],
```

Change to:

```typescript
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      envFilePath: ['../../.env', '.env'],
    }),
    PlanGenerationModule,
    AthleteProfileModule,
    ...optionalStravaModule(),
  ],
```

- [ ] **Step 3: Run typecheck + all tests to verify nothing broke**

```bash
pnpm --filter @eta/api typecheck && pnpm --filter @eta/api test
```

Expected: typecheck clean, all existing tests pass (including new ones from Tasks 1–4).

- [ ] **Step 4: Boot the API and verify the routes are mapped**

```bash
STRAVA_ENABLED=false pnpm --filter @eta/api dev &
sleep 6 && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/athlete-profiles/me
kill %1 2>/dev/null
```

Expected: `404` (no profile exists in the empty/in-memory test DB, but the route is responding).

If you're using the dev DB (which has data), expect either `200` (if a profile exists) or `404`. The key signal is that you do NOT see a connection-refused or 404 from the framework's "route not found" handler.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/athlete-profile/athlete-profile.module.ts \
        apps/api/src/app.module.ts
git commit -m "feat(eta-25): wire AthleteProfileModule into AppModule"
```

---

## Task 6: Shared `loadProfile` CLI helper

**Files:**
- Create: `apps/api/scripts/lib/load-profile.ts`

No test (per spec — thin glue). Manual sanity in Task 7 + Task 8 exercise it.

- [ ] **Step 1: Create the helper**

Create `apps/api/scripts/lib/load-profile.ts`:

```typescript
import { readFileSync } from 'node:fs';
import { type AthleteProfile, athleteProfileSchema } from '@eta/shared-types';
import type { AthleteProfileRepository } from '../../src/db/repositories/athlete-profile.repository.js';

export interface LoadProfileArgs {
  /** If provided, load + validate from a JSON file. Overrides DB lookup. */
  fromPath?: string;
  /** Used when fromPath is absent. Looks up the latest profile in the DB. */
  fromDb?: { userId: string; repo: AthleteProfileRepository };
}

/**
 * Resolve an AthleteProfile for a CLI script. JSON path wins when present.
 * Throws with a user-actionable message when no DB profile exists and no
 * --profile path was provided.
 */
export async function loadProfile(args: LoadProfileArgs): Promise<AthleteProfile> {
  if (args.fromPath) {
    const raw = readFileSync(args.fromPath, 'utf-8');
    const json = JSON.parse(raw) as unknown;
    const parsed = athleteProfileSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error(
        `Profile at ${args.fromPath} failed schema validation: ${parsed.error.message}`,
      );
    }
    return parsed.data;
  }
  if (!args.fromDb) {
    throw new Error('loadProfile: no fromPath and no fromDb provided');
  }
  const profile = await args.fromDb.repo.findByUserId(args.fromDb.userId);
  if (!profile) {
    throw new Error(
      `No profile in DB for ${args.fromDb.userId}. ` +
        `Run \`pnpm seed:profile\` first, or pass --profile=<path>.`,
    );
  }
  return profile;
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @eta/api typecheck
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add apps/api/scripts/lib/load-profile.ts
git commit -m "feat(eta-25): shared loadProfile CLI helper"
```

---

## Task 7: `pnpm seed:profile` CLI

**Files:**
- Create: `apps/api/scripts/seed-profile.ts`
- Modify: `apps/api/package.json` (add `seed:profile` script)

- [ ] **Step 1: Add the npm script**

Modify `apps/api/package.json`. Find the `scripts` block:

```json
    "strava:backfill": "node --import @swc-node/register/esm-register scripts/strava-backfill.ts"
```

Add a new line right after it (mind the trailing comma on the preceding line):

```json
    "strava:backfill": "node --import @swc-node/register/esm-register scripts/strava-backfill.ts",
    "seed:profile": "node --import @swc-node/register/esm-register scripts/seed-profile.ts"
```

- [ ] **Step 2: Create the script**

Create `apps/api/scripts/seed-profile.ts`:

```typescript
/* eslint-disable no-console */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../src/app.module.js';
import type { Env } from '../src/config/env.schema.js';
import { AthleteProfileService } from '../src/modules/athlete-profile/athlete-profile.service.js';
import { StravaRenormalizeService } from '../src/modules/integrations/strava/strava-renormalize.service.js';
import { loadProfile } from './lib/load-profile.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const DEFAULT_PROFILE_PATH = resolve(HERE, 'test-profile.json');

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: false });
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const service = app.get(AthleteProfileService);
  const renormalize = app.get(StravaRenormalizeService);

  const userArg = process.argv.find((a) => a.startsWith('--user='));
  const userId = userArg ? (userArg.split('=')[1] as string) : config.get('DEV_USER_ID', { infer: true });

  const profileArg = process.argv.find((a) => a.startsWith('--profile='));
  const profilePath = profileArg ? (profileArg.split('=')[1] as string) : DEFAULT_PROFILE_PATH;

  console.log(`Seeding profile for user ${userId} from ${profilePath}...`);
  const profile = await loadProfile({ fromPath: profilePath });

  const record = await service.create({ userId, profile });
  console.log(`Created profile ${record.id} (generatedAt=${record.generatedAt.toISOString()}).`);

  // Synchronous renormalise — we want the summary in the CLI output, not
  // fire-and-forget like the HTTP path. Also blocks until done so the script
  // exits with a complete picture.
  const result = await renormalize.run(userId);
  console.log(`Renormalize result: ${JSON.stringify(result, null, 2)}`);

  await app.close();
}

void main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
```

- [ ] **Step 3: Run the seed against the dev DB and verify output**

Ensure Postgres is running (`docker ps | grep eta-postgres`). Then:

```bash
cd apps/api && pnpm seed:profile
```

Expected output (timings and counts may vary):

```
Seeding profile for user 00000000-0000-0000-0000-000000000001 from .../test-profile.json...
Created profile <uuid> (generatedAt=2026-06-16T...Z).
Renormalize result: {
  "userId": "00000000-0000-0000-0000-000000000001",
  "considered": <some number ≤ 89>,
  "recomputed": <bike-with-power count>,
  "stillPending": <89 - recomputed>,
  "failed": 0
}
```

The script must exit on its own without SIGTERM (verified by the prompt returning).

- [ ] **Step 4: Spot-check the DB to confirm rows flipped**

```bash
docker exec eta-postgres psql -U postgres -d eta -c "SELECT tss_status, COUNT(*) FROM workouts_completed GROUP BY tss_status;"
```

Expected: a `computed` row count > 0 alongside `pending_inference`. Before this task, only `pending_inference`.

Also verify a profile row exists:

```bash
docker exec eta-postgres psql -U postgres -d eta -c "SELECT id, user_id, generated_at FROM athlete_profiles ORDER BY generated_at DESC LIMIT 5;"
```

Expected: at least one row.

(The exact DB / user / password may differ — adjust the command to match your local dev setup, or skip this step if you prefer to verify via Drizzle Studio.)

- [ ] **Step 5: Commit**

```bash
git add apps/api/scripts/seed-profile.ts apps/api/package.json
git commit -m "feat(eta-25): pnpm seed:profile CLI seeds DEV_USER_ID + renormalises"
```

---

## Task 8: Flip the four generate/render CLIs

**Files:**
- Modify: `apps/api/scripts/generate-test-plan.ts`
- Modify: `apps/api/scripts/generate-test-week.ts`
- Modify: `apps/api/scripts/generate-test-adaptation.ts`
- Modify: `apps/api/scripts/render-plan.ts`

Each script currently reads `test-profile.json` directly via `readFileSync`. After this task, each script:
- Bootstraps `NestApplicationContext` (some already do)
- Uses `loadProfile()` from `lib/load-profile.js`
- Defaults to DB lookup for `DEV_USER_ID`
- Honors `--profile=<path>` as override

Approach: do them one at a time, smoke-test each immediately after.

### 8a: `generate-test-plan.ts`

- [ ] **Step 1: Inspect the current top of `generate-test-plan.ts`**

Read the file to find:
- The existing `--profile=<path>` parsing
- The existing `readFileSync` + `athleteProfileSchema.parse` block
- Whether the script already bootstraps `NestApplicationContext`

- [ ] **Step 2: Replace the profile-loading block**

Replace the existing "read JSON + validate" section with:

```typescript
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../src/app.module.js';
import type { Env } from '../src/config/env.schema.js';
import { AthleteProfileRepository } from '../src/db/repositories/athlete-profile.repository.js';
import { loadProfile } from './lib/load-profile.js';
```

Inside `main()`, replace the existing profile-loading code with:

```typescript
  const profileArg = process.argv.find((a) => a.startsWith('--profile='));
  const profilePath = profileArg?.split('=')[1];

  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: false });
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const repo = app.get(AthleteProfileRepository);
  const userId = config.get('DEV_USER_ID', { infer: true });

  const profile = await loadProfile({
    fromPath: profilePath,
    fromDb: profilePath ? undefined : { userId, repo },
  });
```

Then at the very end of `main()` (after generation output is printed), close the app:

```typescript
  await app.close();
```

And wrap the outer call in the now-canonical exit pattern (matching `strava-backfill.ts` and `seed-profile.ts`):

```typescript
void main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
```

If the existing outer wrapper is already `.catch(...) → exit(1)` only, add the `.then(...) → exit(0)`.

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @eta/api typecheck
```

Expected: clean.

- [ ] **Step 4: Smoke-test using DB profile (no `--profile`)**

```bash
cd apps/api && pnpm generate:test-plan
```

Expected: same output as before (a macro plan), now sourced from DB profile. Script exits cleanly.

- [ ] **Step 5: Smoke-test using the JSON override**

```bash
cd apps/api && pnpm generate:test-plan -- --profile=scripts/test-profile-5day.json
```

Expected: plan reflects the 5-day fixture (different from DB profile). Script exits cleanly.

### 8b–8d: repeat for the other three

Apply the same change to `generate-test-week.ts`, `generate-test-adaptation.ts`, and `render-plan.ts`. For each:

- [ ] Inspect the current profile-loading code in the script
- [ ] Replace with the `NestApplicationContext + loadProfile` pattern from 8a
- [ ] Add `.then(() => process.exit(0))` if missing from the outer wrapper
- [ ] Run `pnpm --filter @eta/api typecheck` (clean)
- [ ] Smoke-test once with no `--profile` (DB path) and once with `--profile=scripts/test-profile-5day.json` (override)

`render-plan.ts` is 1310 lines — be careful to only touch the profile-loading block. Use grep to locate it:

```bash
grep -n 'test-profile.json\|readFileSync\|athleteProfileSchema' apps/api/scripts/render-plan.ts
```

The change there is identical in shape to 8a.

- [ ] **Step Final: Commit all four flips together**

```bash
git add apps/api/scripts/generate-test-plan.ts \
        apps/api/scripts/generate-test-week.ts \
        apps/api/scripts/generate-test-adaptation.ts \
        apps/api/scripts/render-plan.ts
git commit -m "feat(eta-25): CLIs default to DB profile, --profile=<path> overrides"
```

---

## Task 9: Docs + final smoke

**Files:**
- Modify: `docs/strava-dev.md` (add a section near the bottom)

- [ ] **Step 1: Append a section to `docs/strava-dev.md`**

Add at the end of the file:

```markdown
## AthleteProfile seeding + renormalisation

After OAuth + backfill have populated `workouts_completed` rows, seed an
`AthleteProfile` so TSS can be computed for bike-with-power activities.

```sh
pnpm seed:profile                  # uses test-profile.json + DEV_USER_ID
pnpm seed:profile -- --profile=<path>
pnpm seed:profile -- --user=<uuid>
```

The script creates a new profile row (append-only history) and immediately
runs a renormalise pass that walks existing `pending_inference` rows for that
user, recomputes TSS where possible (today: bike-with-power), and upserts.

Equivalent HTTP path:

```sh
curl -X POST http://localhost:3000/athlete-profiles \
  -H 'content-type: application/json' \
  -d @apps/api/scripts/test-profile.json

curl http://localhost:3000/athlete-profiles/me
```

The POST kicks off renormalisation in the background (fire-and-forget); tail
the API logs to see its summary.

`pnpm generate:test-plan`, `generate:test-week`, `generate:test-adaptation`,
and `render:plan` now default to the DB profile for `DEV_USER_ID`. Pass
`--profile=<path>` to override with a JSON fixture (e.g. for synthetic
scenarios like `test-profile-5day.json`).
```

- [ ] **Step 2: Final end-to-end smoke**

Run through these manually, in order, to verify the full path. Notes are for the executor — don't commit anything from this step.

```bash
# 1. Confirm Postgres is up + has the prior backfilled data
docker exec eta-postgres psql -U postgres -d eta -c "SELECT COUNT(*), tss_status FROM workouts_completed GROUP BY tss_status;"

# 2. Seed (creates a new profile + renormalises)
cd apps/api && pnpm seed:profile

# 3. Confirm rows flipped to computed
docker exec eta-postgres psql -U postgres -d eta -c "SELECT tss_status, COUNT(*) FROM workouts_completed GROUP BY tss_status;"

# 4. Run a generation CLI to confirm DB-default path works
cd apps/api && pnpm generate:test-plan
# Should print a plan and exit cleanly.

# 5. Run the same CLI with the JSON override
cd apps/api && pnpm generate:test-plan -- --profile=scripts/test-profile-5day.json
# Plan reflects the 5-day fixture; exits cleanly.

# 6. Start API and hit the endpoints
pnpm --filter @eta/api dev &
sleep 6

curl -s http://localhost:3000/athlete-profiles/me | jq .experienceLevel
# Expect: "tri_experienced"

curl -s -X POST http://localhost:3000/athlete-profiles \
  -H 'content-type: application/json' \
  -d @apps/api/scripts/test-profile.json
# Expect: 201 with { id, userId, generatedAt, updatedAt }

# 7. Tail the API log for "Renormalize done" line.
# Kill the dev server.
kill %1 2>/dev/null
```

- [ ] **Step 3: Commit the docs update**

```bash
git add docs/strava-dev.md
git commit -m "docs(eta-25): document seed:profile + AthleteProfile HTTP path"
```

- [ ] **Step 4: Update memory**

After the implementation lands and the smoke passes, update:
- `~/.claude/projects/-Users-arkadiy-smirnov-Documents-studying-eta/memory/project_eta25_smoke_test.md` — move follow-up #2 to "Closed follow-ups" with the date and a one-liner of how it was closed
- `~/.claude/projects/-Users-arkadiy-smirnov-Documents-studying-eta/memory/project_eta_overview.md` — note that AthleteProfile persistence + HTTP path now exists (single line under the ETA-25 entry)

This is a manual edit, not committed.

---

## Spec coverage check

| Spec requirement | Implemented by |
|---|---|
| `POST /athlete-profiles` with Zod validation, returns 201 | Task 4 |
| `GET /athlete-profiles/me` returns latest or 404 | Task 4 |
| `userId` resolved server-side from `DEV_USER_ID` | Task 4 (`getCurrentUserId`) |
| Append-only versioning (every save = new row) | Tasks 3, 4 (use existing `repo.create()`) |
| Auto-renormalise on POST via `setImmediate` (fire-and-forget, doesn't affect HTTP response) | Task 3 |
| `StravaRenormalizeService` walks `pending_inference` rows for `source='strava'`, uses `raw` JSONB | Task 1 |
| Renormalise file lives in `modules/integrations/strava/`, provider on `AthleteProfileModule` | Tasks 1, 5 |
| `findPendingByUserAndSource` repo method | Task 1 |
| `pnpm seed:profile` CLI (synchronous renormalise; clean exit) | Task 7 |
| Shared `loadProfile` helper | Task 6 |
| CLIs default to DB lookup, `--profile=<path>` overrides | Task 8 |
| Clear "Run `pnpm seed:profile` first" error when no DB profile | Task 6 |
| Renormalise: bike-with-power flips, run/swim stay pending | Task 1 (tests + impl) |
| No retries, no transactions wrapping create+renormalise | Tasks 1, 3 (by omission) |
| Integration test with real Postgres | Task 2 |
| Unit tests for service, controller, renormalise service | Tasks 1, 3, 4 |
| No tests on CLI scripts | Tasks 7, 8 (manual smoke only) |
| Smoke recipe in `docs/strava-dev.md` | Task 9 |
| No DB migration needed | Confirmed in spec — `athlete_profiles` already exists |
| Outer CLI exit pattern (`.then(exit(0)).catch(...exit(1))`) | Tasks 7, 8 |

No gaps.
