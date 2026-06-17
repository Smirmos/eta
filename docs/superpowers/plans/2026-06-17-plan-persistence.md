# Plan Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist Pass 1 MacroPlans + Pass 2 WeeklyDetails to Postgres; expose `GET /plans/me` + `GET /plans/:id`; flip `generate:test-plan` and `generate:test-week` to persist as a side-effect.

**Architecture:** Two append-only tables (`macro_plans` + `weekly_details`) with JSONB blob columns. `PlansModule` provides read-only HTTP. `PlanGenerationService` / `Pass2GenerationService` gain repo dependencies and persist after successful LLM generation. CLIs gain a `--plan-id` flag (default: latest for `DEV_USER_ID`) and print the new ids.

**Tech Stack:** NestJS (Fastify) + Drizzle ORM + postgres-js + Zod (`@eta/shared-types`) + Vitest + `@testcontainers/postgresql`.

**Spec:** `docs/superpowers/specs/2026-06-17-plan-persistence-design.md`

---

## File Map

**Create:**
- `apps/api/src/db/schema/macro-plans.ts`
- `apps/api/src/db/schema/weekly-details.ts`
- `apps/api/drizzle/0002_*.sql` (generated via `pnpm db:generate`)
- `apps/api/src/db/repositories/macro-plans.repository.ts`
- `apps/api/src/db/repositories/macro-plans.repository.test.ts`
- `apps/api/src/db/repositories/weekly-details.repository.ts`
- `apps/api/src/db/repositories/weekly-details.repository.test.ts`
- `apps/api/src/modules/plans/plans.module.ts`
- `apps/api/src/modules/plans/plans.controller.ts`
- `apps/api/src/modules/plans/plans.controller.test.ts`
- `apps/api/src/modules/plans/plans.service.ts`
- `apps/api/src/modules/plans/plans.service.test.ts`

**Modify:**
- `apps/api/src/db/schema/index.ts` — export the new schemas
- `apps/api/src/modules/plan-generation/plan-generation.service.ts` — add `MacroPlansRepository` dep + persist + userId
- `apps/api/src/modules/plan-generation/plan-generation.service.test.ts` — add persistence test
- `apps/api/src/modules/plan-generation/pass2/pass2.service.ts` — add `WeeklyDetailsRepository` dep + persist + macroPlanId
- `apps/api/src/modules/plan-generation/pass2/pass2.service.test.ts` — add persistence test
- `apps/api/src/modules/plan-generation/pass2/types.ts` — Pass2Input gains `macroPlanId`
- `apps/api/src/modules/plan-generation/plan-generation.module.ts` — register repos, wire factories
- `apps/api/src/app.module.ts` — import `PlansModule`
- `apps/api/scripts/generate-test-plan.ts` — pass `userId`, capture `macroPlanId`, auto-seed when `--profile=<path>`
- `apps/api/scripts/generate-test-week.ts` — `--plan-id` flag, fetch macro from DB, pass `macroPlanId`

---

## Task 1: Schema + migration

**Files:**
- Create: `apps/api/src/db/schema/macro-plans.ts`
- Create: `apps/api/src/db/schema/weekly-details.ts`
- Modify: `apps/api/src/db/schema/index.ts`
- Create: `apps/api/drizzle/0002_*.sql` (generated)

- [ ] **Step 1: Write `macro-plans.ts`**

```typescript
import { type MacroPlan } from '@eta/shared-types';
import { date, index, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { athleteProfiles } from './athlete-profile.js';

/**
 * One row per LLM-generated macro plan. Append-only — re-running Pass 1 inserts
 * a new row. The full MacroPlan is stored as JSONB; `race_date` is denormalised
 * for filtering. JSONB roundtrip turns Date instances into ISO strings — always
 * pass `data` through `planSchema` before use.
 */
export const macroPlans = pgTable(
  'macro_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // TODO(eta-future): replace with FK to users table.
    userId: uuid('user_id').notNull(),

    athleteProfileId: uuid('athlete_profile_id')
      .notNull()
      .references(() => athleteProfiles.id, { onDelete: 'restrict' }),

    raceDate: date('race_date').notNull(),

    data: jsonb('data').$type<MacroPlan>().notNull(),

    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    userIdIdx: index('macro_plans_user_id_idx').on(table.userId),
    athleteProfileIdx: index('macro_plans_athlete_profile_idx').on(table.athleteProfileId),
  }),
);

export type MacroPlanRow = typeof macroPlans.$inferSelect;
export type NewMacroPlanRow = typeof macroPlans.$inferInsert;
```

- [ ] **Step 2: Write `weekly-details.ts`**

```typescript
import { type WeeklyDetail } from '@eta/shared-types';
import { date, index, integer, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { macroPlans } from './macro-plans.js';

/**
 * One row per Pass 2 generation. Append-only — re-running Pass 2 for the same
 * week inserts a new row. `findLatestForMacroPlan` uses DISTINCT ON (week_number).
 * Cascade delete from `macro_plans` so a parent removal cleans up children.
 */
export const weeklyDetails = pgTable(
  'weekly_details',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    macroPlanId: uuid('macro_plan_id')
      .notNull()
      .references(() => macroPlans.id, { onDelete: 'cascade' }),

    weekNumber: integer('week_number').notNull(),
    weekStartDate: date('week_start_date').notNull(),

    data: jsonb('data').$type<WeeklyDetail>().notNull(),

    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => ({
    macroPlanWeekIdx: index('weekly_details_macro_plan_week_idx').on(
      table.macroPlanId,
      table.weekNumber,
    ),
  }),
);

export type WeeklyDetailRow = typeof weeklyDetails.$inferSelect;
export type NewWeeklyDetailRow = typeof weeklyDetails.$inferInsert;
```

- [ ] **Step 3: Update `apps/api/src/db/schema/index.ts`**

Currently exports `./athlete-profile.js`, `./oauth-credentials.js`, `./workouts-completed.js`. Add two lines:

```typescript
export * from './macro-plans.js';
export * from './weekly-details.js';
```

- [ ] **Step 4: Generate migration**

```bash
cd apps/api && pnpm db:generate
```

Inspect the generated `apps/api/drizzle/0002_*.sql` — it should add both tables, the FK constraints, and the three new indexes. No data migration. If Drizzle wants to drop unrelated tables, STOP and investigate (probably an out-of-date snapshot in `apps/api/drizzle/meta/`).

- [ ] **Step 5: Apply the migration against the dev DB**

```bash
cd apps/api && pnpm db:migrate
```

Then verify:

```bash
docker exec eta-postgres psql -U eta -d eta_dev -c "\d macro_plans" 2>&1 | head -20
docker exec eta-postgres psql -U eta -d eta_dev -c "\d weekly_details" 2>&1 | head -20
```

(Adjust user/db to match local `.env`; could be `postgres`/`eta`.)

Confirm both tables exist with the expected columns.

- [ ] **Step 6: Typecheck**

```bash
pnpm --filter @eta/api typecheck
```

Clean.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/db/schema/macro-plans.ts \
        apps/api/src/db/schema/weekly-details.ts \
        apps/api/src/db/schema/index.ts \
        apps/api/drizzle/
git commit -m "feat(poc-a): macro_plans + weekly_details schemas and migration"
```

---

## Task 2: `MacroPlansRepository` (TDD, testcontainers)

**Files:**
- Create: `apps/api/src/db/repositories/macro-plans.repository.ts`
- Create: `apps/api/src/db/repositories/macro-plans.repository.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/db/repositories/macro-plans.repository.test.ts`:

```typescript
import { type MacroPlan } from '@eta/shared-types';
import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../schema/index.js';
import { AthleteProfileRepository } from './athlete-profile.repository.js';
import { MacroPlansRepository } from './macro-plans.repository.js';

type Db = PostgresJsDatabase<typeof schema>;

const USER_ID = '11111111-1111-1111-1111-111111111111';

const sampleMacroPlan = (athleteProfileId: string): MacroPlan => ({
  athleteProfileId,
  raceDate: '2026-09-21',
  generatedAt: '2026-06-17T12:00:00Z',
  totalWeeks: 2,
  weeks: [
    {
      weekNumber: 14,
      weekStartDate: '2026-06-15',
      phase: 'base_2',
      isRecoveryWeek: false,
      weeklyVolumeHours: 9,
      keySessions: [
        {
          workoutCode: 'BIKE-Z2-LONG',
          discipline: 'bike',
          dayOfWeek: 'sat',
          rationale: 'Anchor aerobic volume.',
          citation: 'knowledge-base/02-atp-structure.md#base-2',
        },
      ],
    },
    {
      weekNumber: 13,
      weekStartDate: '2026-06-22',
      phase: 'base_2',
      isRecoveryWeek: false,
      weeklyVolumeHours: 9.5,
      keySessions: [],
    },
  ],
});

const sampleProfile = () => ({
  experienceLevel: 'tri_experienced' as const,
  raceDate: new Date('2026-09-21T00:00:00Z'),
  raceType: 'full_ironman' as const,
  weeksUntilRace: 14,
  recentWeeklyHours: { value: 9, confidence: 'medium' as const, source: 'self_reported' as const },
  plannedWeeklyHours: 11,
  longestRecentSessions: {
    swimMeters: { value: 3000, confidence: 'high' as const, source: 'self_reported' as const },
    bikeMinutes: { value: 300, confidence: 'high' as const, source: 'self_reported' as const },
    runMinutes: { value: 240, confidence: 'high' as const, source: 'self_reported' as const },
  },
  thresholds: {
    swimTPacePer100m: { value: '2:30', confidence: 'medium' as const, source: 'estimated' as const },
    bikeFtpWatts: { value: 200, confidence: 'high' as const, source: 'measured' as const },
    bikeThresholdHr: { value: 165, confidence: 'medium' as const, source: 'estimated' as const },
    runThresholdPacePerKm: { value: '4:00', confidence: 'high' as const, source: 'self_reported' as const },
    runThresholdHr: { value: 180, confidence: 'high' as const, source: 'self_reported' as const },
  },
  disciplineDistribution: { swimPercent: 15, bikePercent: 50, runPercent: 35 },
  fitnessTrend: 'stable' as const,
  trainingDaysPerWeek: 6,
  longSessionDays: ['sat' as const, 'sun' as const],
  mandatoryRestDays: [],
  maxWeekdaySessionMinutes: 90,
  currentInjuries: [],
  recentIllnessOrTimeOff: false,
  raceHistory: [],
  source: 'mixed' as const,
  overallConfidence: 'medium' as const,
  generatedAt: new Date('2026-06-17T00:00:00Z'),
  warnings: [],
});

let container: StartedPostgreSqlContainer;
let client: ReturnType<typeof postgres>;
let db: Db;
let macroRepo: MacroPlansRepository;
let profileRepo: AthleteProfileRepository;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  client = postgres(container.getConnectionUri(), { max: 5 });
  db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  macroRepo = new MacroPlansRepository(db);
  profileRepo = new AthleteProfileRepository(db);
}, 120_000);

afterAll(async () => {
  if (client) await client.end();
  if (container) await container.stop();
}, 30_000);

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE athlete_profiles, macro_plans RESTART IDENTITY CASCADE`);
});

describe('MacroPlansRepository', () => {
  it('creates a row and round-trips through findById', async () => {
    const profile = await profileRepo.create({ userId: USER_ID, profile: sampleProfile() });
    const plan = sampleMacroPlan(profile.id);
    const created = await macroRepo.create({ userId: USER_ID, athleteProfileId: profile.id, plan });

    expect(created.id).toBeDefined();
    expect(created.userId).toBe(USER_ID);
    expect(created.athleteProfileId).toBe(profile.id);
    expect(created.plan.raceDate).toBe('2026-09-21');
    expect(created.plan.weeks).toHaveLength(2);

    const found = await macroRepo.findById(created.id);
    expect(found).not.toBeNull();
    expect(found!.plan.weeks[0]!.weekNumber).toBe(14);
  });

  it('findLatestForUser returns the most-recent row', async () => {
    const profile = await profileRepo.create({ userId: USER_ID, profile: sampleProfile() });
    const first = await macroRepo.create({ userId: USER_ID, athleteProfileId: profile.id, plan: sampleMacroPlan(profile.id) });
    // Small wait so generated_at differs.
    await new Promise((r) => setTimeout(r, 50));
    const second = await macroRepo.create({ userId: USER_ID, athleteProfileId: profile.id, plan: sampleMacroPlan(profile.id) });

    const latest = await macroRepo.findLatestForUser(USER_ID);
    expect(latest).not.toBeNull();
    expect(latest!.id).toBe(second.id);
    expect(latest!.id).not.toBe(first.id);
  });

  it('findLatestForUser returns null when no rows exist', async () => {
    const result = await macroRepo.findLatestForUser(USER_ID);
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run — verify failure**

```bash
pnpm --filter @eta/api vitest run src/db/repositories/macro-plans.repository.test.ts
```

Expected: FAIL — module `./macro-plans.repository.js` not found.

- [ ] **Step 3: Write the repository**

Create `apps/api/src/db/repositories/macro-plans.repository.ts`:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { type MacroPlan, planSchema } from '@eta/shared-types';
import { desc, eq } from 'drizzle-orm';
import { DB, type Db } from '../db.module.js';
import { macroPlans } from '../schema/macro-plans.js';

export interface MacroPlanRecord {
  id: string;
  userId: string;
  athleteProfileId: string;
  plan: MacroPlan;
  generatedAt: Date;
  updatedAt: Date;
}

export interface CreateMacroPlanInput {
  userId: string;
  athleteProfileId: string;
  plan: MacroPlan;
}

@Injectable()
export class MacroPlansRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  async create(input: CreateMacroPlanInput): Promise<MacroPlanRecord> {
    const [row] = await this.db
      .insert(macroPlans)
      .values({
        userId: input.userId,
        athleteProfileId: input.athleteProfileId,
        raceDate: input.plan.raceDate,
        data: input.plan,
      })
      .returning();

    if (!row) throw new Error('Insert into macro_plans returned no row');
    return rowToRecord(row);
  }

  async findById(id: string): Promise<MacroPlanRecord | null> {
    const rows = await this.db
      .select()
      .from(macroPlans)
      .where(eq(macroPlans.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return rowToRecord(row);
  }

  async findLatestForUser(userId: string): Promise<MacroPlanRecord | null> {
    const rows = await this.db
      .select()
      .from(macroPlans)
      .where(eq(macroPlans.userId, userId))
      .orderBy(desc(macroPlans.generatedAt))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return rowToRecord(row);
  }
}

function rowToRecord(row: typeof macroPlans.$inferSelect): MacroPlanRecord {
  const parsed = planSchema.safeParse(row.data);
  if (!parsed.success) {
    throw new Error(
      `Failed to parse MacroPlan from JSONB at macro_plans.id=${row.id}: ${parsed.error.message}`,
    );
  }
  return {
    id: row.id,
    userId: row.userId,
    athleteProfileId: row.athleteProfileId,
    plan: parsed.data,
    generatedAt: row.generatedAt,
    updatedAt: row.updatedAt,
  };
}
```

If `planSchema` isn't exported from `@eta/shared-types`, check `packages/shared-types/src/plan.schema.ts` and `packages/shared-types/src/index.ts` for the actual name (probably `macroPlanSchema` or `planSchema`). The shared-types package re-exports through `src/index.ts`.

- [ ] **Step 4: Run — verify pass**

```bash
pnpm --filter @eta/api vitest run src/db/repositories/macro-plans.repository.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter @eta/api typecheck
```

Clean.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/db/repositories/macro-plans.repository.ts \
        apps/api/src/db/repositories/macro-plans.repository.test.ts
git commit -m "feat(poc-a): MacroPlansRepository (create + findById + findLatestForUser)"
```

---

## Task 3: `WeeklyDetailsRepository` (TDD, testcontainers)

**Files:**
- Create: `apps/api/src/db/repositories/weekly-details.repository.ts`
- Create: `apps/api/src/db/repositories/weekly-details.repository.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/db/repositories/weekly-details.repository.test.ts`:

```typescript
import { type MacroPlan, type WeeklyDetail } from '@eta/shared-types';
import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../schema/index.js';
import { AthleteProfileRepository } from './athlete-profile.repository.js';
import { MacroPlansRepository } from './macro-plans.repository.js';
import { WeeklyDetailsRepository } from './weekly-details.repository.js';

type Db = PostgresJsDatabase<typeof schema>;

const USER_ID = '22222222-2222-2222-2222-222222222222';

const detail = (weekNumber: number, hours: number): WeeklyDetail => ({
  weekNumber,
  weekStartDate: '2026-06-15',
  phase: 'base_2',
  workouts: [
    {
      workoutCode: 'BIKE-Z2-LONG',
      discipline: 'bike',
      date: '2026-06-20',
      totalDurationSeconds: 7200,
      segments: [
        { label: 'Warmup', durationSeconds: 600, zone: 'z1', description: 'Easy spin' },
        { label: 'Main set', durationSeconds: 6000, zone: 'z2', description: 'Steady Z2' },
        { label: 'Cooldown', durationSeconds: 600, zone: 'z1', description: 'Easy spin' },
      ],
      rationale: 'Anchor aerobic volume.',
      citation: 'knowledge-base/03-workouts.md#bike-z2-long',
    },
  ],
  weeklyTotalHours: hours,
});

const macroPlan = (athleteProfileId: string): MacroPlan => ({
  athleteProfileId,
  raceDate: '2026-09-21',
  generatedAt: '2026-06-17T12:00:00Z',
  totalWeeks: 1,
  weeks: [
    {
      weekNumber: 14,
      weekStartDate: '2026-06-15',
      phase: 'base_2',
      isRecoveryWeek: false,
      weeklyVolumeHours: 9,
      keySessions: [],
    },
  ],
});

const sampleProfile = () => ({
  // copy the same shape from macro-plans.repository.test.ts — see that file
  // for the full inline. Use the same factory there or inline it here.
  experienceLevel: 'tri_experienced' as const,
  raceDate: new Date('2026-09-21T00:00:00Z'),
  raceType: 'full_ironman' as const,
  weeksUntilRace: 14,
  recentWeeklyHours: { value: 9, confidence: 'medium' as const, source: 'self_reported' as const },
  plannedWeeklyHours: 11,
  longestRecentSessions: {
    swimMeters: { value: 3000, confidence: 'high' as const, source: 'self_reported' as const },
    bikeMinutes: { value: 300, confidence: 'high' as const, source: 'self_reported' as const },
    runMinutes: { value: 240, confidence: 'high' as const, source: 'self_reported' as const },
  },
  thresholds: {
    swimTPacePer100m: { value: '2:30', confidence: 'medium' as const, source: 'estimated' as const },
    bikeFtpWatts: { value: 200, confidence: 'high' as const, source: 'measured' as const },
    bikeThresholdHr: { value: 165, confidence: 'medium' as const, source: 'estimated' as const },
    runThresholdPacePerKm: { value: '4:00', confidence: 'high' as const, source: 'self_reported' as const },
    runThresholdHr: { value: 180, confidence: 'high' as const, source: 'self_reported' as const },
  },
  disciplineDistribution: { swimPercent: 15, bikePercent: 50, runPercent: 35 },
  fitnessTrend: 'stable' as const,
  trainingDaysPerWeek: 6,
  longSessionDays: ['sat' as const, 'sun' as const],
  mandatoryRestDays: [],
  maxWeekdaySessionMinutes: 90,
  currentInjuries: [],
  recentIllnessOrTimeOff: false,
  raceHistory: [],
  source: 'mixed' as const,
  overallConfidence: 'medium' as const,
  generatedAt: new Date('2026-06-17T00:00:00Z'),
  warnings: [],
});

let container: StartedPostgreSqlContainer;
let client: ReturnType<typeof postgres>;
let db: Db;
let weeklyRepo: WeeklyDetailsRepository;
let macroRepo: MacroPlansRepository;
let profileRepo: AthleteProfileRepository;
let macroPlanId: string;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  client = postgres(container.getConnectionUri(), { max: 5 });
  db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  weeklyRepo = new WeeklyDetailsRepository(db);
  macroRepo = new MacroPlansRepository(db);
  profileRepo = new AthleteProfileRepository(db);
}, 120_000);

afterAll(async () => {
  if (client) await client.end();
  if (container) await container.stop();
}, 30_000);

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE athlete_profiles, macro_plans, weekly_details RESTART IDENTITY CASCADE`);
  const profile = await profileRepo.create({ userId: USER_ID, profile: sampleProfile() });
  const created = await macroRepo.create({ userId: USER_ID, athleteProfileId: profile.id, plan: macroPlan(profile.id) });
  macroPlanId = created.id;
});

describe('WeeklyDetailsRepository', () => {
  it('creates a row and round-trips through findLatestForMacroPlan', async () => {
    const created = await weeklyRepo.create({ macroPlanId, detail: detail(14, 9) });
    expect(created.id).toBeDefined();
    expect(created.macroPlanId).toBe(macroPlanId);
    expect(created.weekNumber).toBe(14);

    const map = await weeklyRepo.findLatestForMacroPlan(macroPlanId);
    expect(map.size).toBe(1);
    const week = map.get(14);
    expect(week).toBeDefined();
    expect(week!.weeklyTotalHours).toBe(9);
  });

  it('findLatestForMacroPlan returns latest version per week (DISTINCT ON)', async () => {
    await weeklyRepo.create({ macroPlanId, detail: detail(14, 9) });
    await new Promise((r) => setTimeout(r, 50));
    await weeklyRepo.create({ macroPlanId, detail: detail(14, 9.5) });
    await weeklyRepo.create({ macroPlanId, detail: detail(13, 8) });

    const map = await weeklyRepo.findLatestForMacroPlan(macroPlanId);
    expect(map.size).toBe(2);
    expect(map.get(14)!.weeklyTotalHours).toBe(9.5); // newest wins
    expect(map.get(13)!.weeklyTotalHours).toBe(8);
  });

  it('findLatestForMacroPlan returns empty Map when no rows', async () => {
    const map = await weeklyRepo.findLatestForMacroPlan(macroPlanId);
    expect(map.size).toBe(0);
  });

  it('cascades on parent macro plan delete', async () => {
    await weeklyRepo.create({ macroPlanId, detail: detail(14, 9) });
    await db.execute(sql`DELETE FROM macro_plans WHERE id = ${macroPlanId}`);
    const remaining = await db.execute(sql`SELECT COUNT(*)::int AS c FROM weekly_details`);
    expect((remaining as unknown as Array<{ c: number }>)[0]!.c).toBe(0);
  });

  it('rejects insert when macro_plan_id does not exist', async () => {
    const bogus = '99999999-9999-9999-9999-999999999999';
    await expect(weeklyRepo.create({ macroPlanId: bogus, detail: detail(1, 5) })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run — verify failure**

```bash
pnpm --filter @eta/api vitest run src/db/repositories/weekly-details.repository.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the repository**

Create `apps/api/src/db/repositories/weekly-details.repository.ts`:

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { type WeeklyDetail, weeklyDetailSchema } from '@eta/shared-types';
import { sql } from 'drizzle-orm';
import { DB, type Db } from '../db.module.js';
import { weeklyDetails } from '../schema/weekly-details.js';

export interface WeeklyDetailRecord {
  id: string;
  macroPlanId: string;
  weekNumber: number;
  detail: WeeklyDetail;
  generatedAt: Date;
}

export interface CreateWeeklyDetailInput {
  macroPlanId: string;
  detail: WeeklyDetail;
}

@Injectable()
export class WeeklyDetailsRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  async create(input: CreateWeeklyDetailInput): Promise<WeeklyDetailRecord> {
    const [row] = await this.db
      .insert(weeklyDetails)
      .values({
        macroPlanId: input.macroPlanId,
        weekNumber: input.detail.weekNumber,
        weekStartDate: input.detail.weekStartDate,
        data: input.detail,
      })
      .returning();
    if (!row) throw new Error('Insert into weekly_details returned no row');
    return {
      id: row.id,
      macroPlanId: row.macroPlanId,
      weekNumber: row.weekNumber,
      detail: parseDetail(row.data, `weekly_details.id=${row.id}`),
      generatedAt: row.generatedAt,
    };
  }

  async findLatestForMacroPlan(macroPlanId: string): Promise<Map<number, WeeklyDetail>> {
    // DISTINCT ON (week_number) is a Postgres-specific feature; Drizzle's
    // query-builder doesn't expose it directly, so use raw SQL.
    const rows = await this.db.execute<{ id: string; week_number: number; data: unknown }>(sql`
      SELECT DISTINCT ON (week_number) id, week_number, data
      FROM weekly_details
      WHERE macro_plan_id = ${macroPlanId}
      ORDER BY week_number, generated_at DESC
    `);

    const out = new Map<number, WeeklyDetail>();
    for (const row of rows) {
      const detail = parseDetail(row.data, `weekly_details.id=${row.id}`);
      out.set(row.week_number, detail);
    }
    return out;
  }
}

function parseDetail(data: unknown, locator: string): WeeklyDetail {
  const parsed = weeklyDetailSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Failed to parse WeeklyDetail from JSONB at ${locator}: ${parsed.error.message}`);
  }
  return parsed.data;
}
```

If `weeklyDetailSchema` isn't the right export name, check `packages/shared-types/src/plan.schema.ts` and `index.ts`. Use the correct exported schema name.

- [ ] **Step 4: Run — verify pass**

```bash
pnpm --filter @eta/api vitest run src/db/repositories/weekly-details.repository.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter @eta/api typecheck
```

Clean.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/db/repositories/weekly-details.repository.ts \
        apps/api/src/db/repositories/weekly-details.repository.test.ts
git commit -m "feat(poc-a): WeeklyDetailsRepository with DISTINCT ON latest-per-week"
```

---

## Task 4: `PlansService` (TDD, mocked repos)

**Files:**
- Create: `apps/api/src/modules/plans/plans.service.ts`
- Create: `apps/api/src/modules/plans/plans.service.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/modules/plans/plans.service.test.ts`:

```typescript
import { type MacroPlan, type WeeklyDetail } from '@eta/shared-types';
import { describe, expect, it, vi } from 'vitest';
import type {
  MacroPlanRecord,
  MacroPlansRepository,
} from '../../db/repositories/macro-plans.repository.js';
import type { WeeklyDetailsRepository } from '../../db/repositories/weekly-details.repository.js';
import { PlansService } from './plans.service.js';

const USER_ID = '00000000-0000-0000-0000-000000000001';

const macroPlan = (): MacroPlan => ({
  athleteProfileId: 'profile-id-1',
  raceDate: '2026-09-21',
  generatedAt: '2026-06-17T12:00:00Z',
  totalWeeks: 3,
  weeks: [
    { weekNumber: 14, weekStartDate: '2026-06-15', phase: 'base_2', isRecoveryWeek: false, weeklyVolumeHours: 9, keySessions: [] },
    { weekNumber: 13, weekStartDate: '2026-06-22', phase: 'base_2', isRecoveryWeek: false, weeklyVolumeHours: 9.5, keySessions: [] },
    { weekNumber: 12, weekStartDate: '2026-06-29', phase: 'base_3', isRecoveryWeek: false, weeklyVolumeHours: 10, keySessions: [] },
  ],
});

const weeklyDetail = (weekNumber: number): WeeklyDetail => ({
  weekNumber,
  weekStartDate: '2026-06-15',
  phase: 'base_2',
  workouts: [],
});

function macroRecord(): MacroPlanRecord {
  return {
    id: 'macro-plan-id-1',
    userId: USER_ID,
    athleteProfileId: 'profile-id-1',
    plan: macroPlan(),
    generatedAt: new Date('2026-06-17T12:00:00Z'),
    updatedAt: new Date('2026-06-17T12:00:00Z'),
  };
}

function makeMacroRepo(opts: { latest?: MacroPlanRecord | null; byId?: MacroPlanRecord | null }): MacroPlansRepository {
  return {
    findLatestForUser: vi.fn(async () => opts.latest ?? null),
    findById: vi.fn(async () => opts.byId ?? null),
  } as unknown as MacroPlansRepository;
}

function makeWeeklyRepo(map: Map<number, WeeklyDetail>): WeeklyDetailsRepository {
  return {
    findLatestForMacroPlan: vi.fn(async () => map),
  } as unknown as WeeklyDetailsRepository;
}

describe('PlansService', () => {
  it('getLatestTreeForUser returns null when no macro plan exists', async () => {
    const svc = new PlansService(makeMacroRepo({ latest: null }), makeWeeklyRepo(new Map()));
    const tree = await svc.getLatestTreeForUser(USER_ID);
    expect(tree).toBeNull();
  });

  it('getLatestTreeForUser zips macro weeks with weekly details, null when missing', async () => {
    const record = macroRecord();
    const map = new Map<number, WeeklyDetail>([
      [14, weeklyDetail(14)],
      [12, weeklyDetail(12)],
    ]);
    const svc = new PlansService(makeMacroRepo({ latest: record }), makeWeeklyRepo(map));
    const tree = await svc.getLatestTreeForUser(USER_ID);
    expect(tree).not.toBeNull();
    expect(tree!.macroPlanId).toBe('macro-plan-id-1');
    expect(tree!.weeks).toHaveLength(3);
    expect(tree!.weeks[0]!.weekNumber).toBe(14);
    expect(tree!.weeks[0]!.weeklyDetail).not.toBeNull();
    expect(tree!.weeks[1]!.weekNumber).toBe(13);
    expect(tree!.weeks[1]!.weeklyDetail).toBeNull();
    expect(tree!.weeks[2]!.weekNumber).toBe(12);
    expect(tree!.weeks[2]!.weeklyDetail).not.toBeNull();
  });

  it('getTreeById returns null when not found', async () => {
    const svc = new PlansService(makeMacroRepo({ byId: null }), makeWeeklyRepo(new Map()));
    const tree = await svc.getTreeById('does-not-exist');
    expect(tree).toBeNull();
  });

  it('getTreeById returns the tree when found', async () => {
    const svc = new PlansService(makeMacroRepo({ byId: macroRecord() }), makeWeeklyRepo(new Map()));
    const tree = await svc.getTreeById('macro-plan-id-1');
    expect(tree).not.toBeNull();
    expect(tree!.weeks).toHaveLength(3);
    expect(tree!.weeks.every((w) => w.weeklyDetail === null)).toBe(true);
  });
});
```

- [ ] **Step 2: Run — verify failure**

```bash
pnpm --filter @eta/api vitest run src/modules/plans/plans.service.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the service**

Create `apps/api/src/modules/plans/plans.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import type { MacroPlan, MacroPlanWeek, WeeklyDetail } from '@eta/shared-types';
import {
  MacroPlansRepository,
  type MacroPlanRecord,
} from '../../db/repositories/macro-plans.repository.js';
import { WeeklyDetailsRepository } from '../../db/repositories/weekly-details.repository.js';

export interface PlanTreeWeek {
  weekNumber: number;
  macroWeek: MacroPlanWeek;
  weeklyDetail: WeeklyDetail | null;
}

export interface PlanTree {
  macroPlanId: string;
  athleteProfileId: string;
  macroPlan: MacroPlan;
  generatedAt: Date;
  weeks: PlanTreeWeek[];
}

@Injectable()
export class PlansService {
  constructor(
    private readonly macroRepo: MacroPlansRepository,
    private readonly weeklyRepo: WeeklyDetailsRepository,
  ) {}

  async getLatestTreeForUser(userId: string): Promise<PlanTree | null> {
    const record = await this.macroRepo.findLatestForUser(userId);
    if (!record) return null;
    return this.buildTree(record);
  }

  async getTreeById(id: string): Promise<PlanTree | null> {
    const record = await this.macroRepo.findById(id);
    if (!record) return null;
    return this.buildTree(record);
  }

  private async buildTree(record: MacroPlanRecord): Promise<PlanTree> {
    const weeklyMap = await this.weeklyRepo.findLatestForMacroPlan(record.id);
    return {
      macroPlanId: record.id,
      athleteProfileId: record.athleteProfileId,
      macroPlan: record.plan,
      generatedAt: record.generatedAt,
      weeks: record.plan.weeks.map((w) => ({
        weekNumber: w.weekNumber,
        macroWeek: w,
        weeklyDetail: weeklyMap.get(w.weekNumber) ?? null,
      })),
    };
  }
}
```

- [ ] **Step 4: Run — verify pass**

```bash
pnpm --filter @eta/api vitest run src/modules/plans/plans.service.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/plans/plans.service.ts \
        apps/api/src/modules/plans/plans.service.test.ts
git commit -m "feat(poc-a): PlansService — zips macro plan + weekly details into PlanTree"
```

---

## Task 5: `PlansController` (TDD, mocked service)

**Files:**
- Create: `apps/api/src/modules/plans/plans.controller.ts`
- Create: `apps/api/src/modules/plans/plans.controller.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/modules/plans/plans.controller.test.ts`:

```typescript
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../../config/env.schema.js';
import type { PlanTree } from './plans.service.js';
import { PlansService } from './plans.service.js';
import { PlansController } from './plans.controller.js';

const USER_ID = '00000000-0000-0000-0000-000000000001';

function makeConfig(): ConfigService<Env, true> {
  return {
    get: (k: string) => (k === 'DEV_USER_ID' ? USER_ID : undefined),
  } as unknown as ConfigService<Env, true>;
}

function makeService(opts: { latest?: PlanTree | null; byId?: PlanTree | null }): PlansService {
  return {
    getLatestTreeForUser: vi.fn(async () => opts.latest ?? null),
    getTreeById: vi.fn(async () => opts.byId ?? null),
  } as unknown as PlansService;
}

const sampleTree = (): PlanTree => ({
  macroPlanId: 'macro-plan-id-1',
  athleteProfileId: 'profile-id-1',
  macroPlan: {
    athleteProfileId: 'profile-id-1',
    raceDate: '2026-09-21',
    generatedAt: '2026-06-17T12:00:00Z',
    totalWeeks: 0,
    weeks: [],
  },
  generatedAt: new Date('2026-06-17T12:00:00Z'),
  weeks: [],
});

describe('PlansController', () => {
  it('GET /me returns the latest tree', async () => {
    const tree = sampleTree();
    const ctrl = new PlansController(makeService({ latest: tree }), makeConfig());
    const out = await ctrl.getMe();
    expect(out).toBe(tree);
  });

  it('GET /me throws NotFoundException when no plan exists', async () => {
    const ctrl = new PlansController(makeService({ latest: null }), makeConfig());
    await expect(ctrl.getMe()).rejects.toBeInstanceOf(NotFoundException);
  });

  it('GET /:id returns the tree', async () => {
    const tree = sampleTree();
    const ctrl = new PlansController(makeService({ byId: tree }), makeConfig());
    const out = await ctrl.getById('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    expect(out).toBe(tree);
  });

  it('GET /:id throws NotFoundException when not found', async () => {
    const ctrl = new PlansController(makeService({ byId: null }), makeConfig());
    await expect(ctrl.getById('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('GET /:id throws BadRequestException when id is not a uuid', async () => {
    const ctrl = new PlansController(makeService({}), makeConfig());
    await expect(ctrl.getById('not-a-uuid')).rejects.toBeInstanceOf(BadRequestException);
  });
});
```

- [ ] **Step 2: Run — verify failure**

```bash
pnpm --filter @eta/api vitest run src/modules/plans/plans.controller.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the controller**

Create `apps/api/src/modules/plans/plans.controller.ts`:

```typescript
import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema.js';
import { PlansService, type PlanTree } from './plans.service.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller('plans')
export class PlansController {
  constructor(
    private readonly service: PlansService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get('me')
  async getMe(): Promise<PlanTree> {
    const userId = this.getCurrentUserId();
    const tree = await this.service.getLatestTreeForUser(userId);
    if (!tree) throw new NotFoundException({ error: 'no_plan_for_user', userId });
    return tree;
  }

  @Get(':id')
  async getById(@Param('id') id: string): Promise<PlanTree> {
    if (!UUID_RE.test(id)) throw new BadRequestException({ error: 'invalid_id', id });
    const tree = await this.service.getTreeById(id);
    if (!tree) throw new NotFoundException({ error: 'plan_not_found', id });
    return tree;
  }

  private getCurrentUserId(): string {
    return this.config.get('DEV_USER_ID', { infer: true });
  }
}
```

NOTE on route ordering: in Nest+Fastify, `/plans/me` must be declared BEFORE `/plans/:id` in source order (otherwise `:id` matches `'me'` first). The decorators above are correct as-written.

- [ ] **Step 4: Run — verify pass**

```bash
pnpm --filter @eta/api vitest run src/modules/plans/plans.controller.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Typecheck**

```bash
pnpm --filter @eta/api typecheck
```

Clean.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/plans/plans.controller.ts \
        apps/api/src/modules/plans/plans.controller.test.ts
git commit -m "feat(poc-a): PlansController (GET /plans/me + GET /plans/:id)"
```

---

## Task 6: `PlansModule` + AppModule wiring

**Files:**
- Create: `apps/api/src/modules/plans/plans.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create the module**

Create `apps/api/src/modules/plans/plans.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { DbModule } from '../../db/db.module.js';
import { MacroPlansRepository } from '../../db/repositories/macro-plans.repository.js';
import { WeeklyDetailsRepository } from '../../db/repositories/weekly-details.repository.js';
import { PlansController } from './plans.controller.js';
import { PlansService } from './plans.service.js';

@Module({
  imports: [DbModule],
  controllers: [PlansController],
  providers: [MacroPlansRepository, WeeklyDetailsRepository, PlansService],
  exports: [PlansService, MacroPlansRepository, WeeklyDetailsRepository],
})
export class PlansModule {}
```

- [ ] **Step 2: Wire into AppModule**

Read `apps/api/src/app.module.ts`. Currently:

```typescript
import { AthleteProfileModule } from './modules/athlete-profile/athlete-profile.module.js';
import { StravaModule } from './modules/integrations/strava/strava.module.js';
```

Add after `AthleteProfileModule` import:

```typescript
import { PlansModule } from './modules/plans/plans.module.js';
```

And in the `imports:` array, insert `PlansModule,` after `AthleteProfileModule,`:

```typescript
  imports: [
    ConfigModule.forRoot({...}),
    PlanGenerationModule,
    AthleteProfileModule,
    PlansModule,
    ...optionalStravaModule(),
  ],
```

- [ ] **Step 3: Typecheck + full test run**

```bash
pnpm --filter @eta/api typecheck && pnpm --filter @eta/api test
```

Both clean. Test count should bump (~13 new tests this phase so far).

- [ ] **Step 4: Boot smoke**

```bash
cd /Users/arkadiy.smirnov/Documents/studying/eta/apps/api && STRAVA_ENABLED=false PORT=3099 pnpm dev > /tmp/api-task6-smoke.log 2>&1 &
sleep 8
curl -s -o /tmp/getme.txt -w "HTTP %{http_code}\n" http://localhost:3099/plans/me
cat /tmp/getme.txt
kill %1 2>/dev/null
wait 2>/dev/null
grep -E "PlansController|Mapped \{/plans" /tmp/api-task6-smoke.log
```

Expected: log lines confirming `RoutesResolver: PlansController` and `Mapped {/plans/me, GET}` and `Mapped {/plans/:id, GET}`. HTTP response 404 with body `{"error":"no_plan_for_user", ...}` because no plans are persisted yet (this validates the route is mapped to OUR controller, not the framework's not-found handler).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/plans/plans.module.ts apps/api/src/app.module.ts
git commit -m "feat(poc-a): wire PlansModule into AppModule"
```

---

## Task 7: Modify `PlanGenerationService` to persist after Pass 1

**Files:**
- Modify: `apps/api/src/modules/plan-generation/plan-generation.service.ts`
- Modify: `apps/api/src/modules/plan-generation/plan-generation.service.test.ts`
- Modify: `apps/api/src/modules/plan-generation/plan-generation.module.ts`

- [ ] **Step 1: Update the service signature**

Read `apps/api/src/modules/plan-generation/plan-generation.service.ts`. The constructor currently takes `(config, kbLoader, anthropicFactory?)`. Update to add `macroPlansRepo`:

Add to imports at the top:

```typescript
import { MacroPlansRepository } from '../../db/repositories/macro-plans.repository.js';
```

Change the constructor signature to:

```typescript
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly kbLoader: KnowledgeBaseLoader,
    private readonly macroPlansRepo: MacroPlansRepository,
    anthropicFactory: AnthropicFactory = defaultAnthropicFactory,
  ) {
    // existing body unchanged
  }
```

Change the `GenerateMacroPlanResult` interface (currently around line 17) to add `macroPlanId`:

```typescript
export interface GenerateMacroPlanResult {
  plan: MacroPlan;
  rawResponse: string;
  usage: { /* existing */ };
  durationMs: number;
  warnings: string[];
  macroPlanId: string;
}
```

Change the `generateMacroPlan` signature to take a `userId`:

```typescript
  async generateMacroPlan(
    rawProfile: unknown,
    athleteProfileId: string,
    userId: string,
  ): Promise<GenerateMacroPlanResult> {
```

At the END of the method (after postprocess + schema validation succeeds), persist:

```typescript
    const record = await this.macroPlansRepo.create({
      userId,
      athleteProfileId,
      plan: validated,
    });
    this.logger.log(`Persisted macro plan ${record.id} for user ${userId}.`);

    return {
      plan: validated,
      rawResponse,
      usage,
      durationMs,
      warnings,
      macroPlanId: record.id,
    };
```

(Replace whatever the existing return-statement looks like with this enriched return.)

- [ ] **Step 2: Update the module wiring**

Modify `apps/api/src/modules/plan-generation/plan-generation.module.ts`. Add imports at the top:

```typescript
import { DbModule } from '../../db/db.module.js';
import { MacroPlansRepository } from '../../db/repositories/macro-plans.repository.js';
import { WeeklyDetailsRepository } from '../../db/repositories/weekly-details.repository.js';
```

Add `DbModule` to `imports:`:

```typescript
@Module({
  imports: [DbModule],
  providers: [
    /* existing providers */
    MacroPlansRepository,
    WeeklyDetailsRepository,
    /* update useFactory entries — see below */
  ],
  exports: [...],
})
```

Update the `PlanGenerationService` factory entry to inject the repo:

```typescript
    {
      provide: PlanGenerationService,
      inject: [ConfigService, KnowledgeBaseLoader, MacroPlansRepository],
      useFactory: (
        config: ConfigService<Env, true>,
        kbLoader: KnowledgeBaseLoader,
        macroPlansRepo: MacroPlansRepository,
      ): PlanGenerationService => new PlanGenerationService(config, kbLoader, macroPlansRepo),
    },
```

Similarly update the `Pass2GenerationService` factory entry (preview for Task 8) — but DON'T add `WeeklyDetailsRepository` injection yet (Task 8 will modify Pass2 service signature).

- [ ] **Step 3: Update the existing test**

Read `apps/api/src/modules/plan-generation/plan-generation.service.test.ts`. The existing tests call `new PlanGenerationService(config, kbLoader, anthropicFactory)` — they need to add the repo argument. Find each constructor invocation and update to:

```typescript
const repo = {
  create: vi.fn(async (input) => ({
    id: 'macro-plan-id-1',
    userId: input.userId,
    athleteProfileId: input.athleteProfileId,
    plan: input.plan,
    generatedAt: new Date(),
    updatedAt: new Date(),
  })),
} as unknown as MacroPlansRepository;
const service = new PlanGenerationService(config, kbLoader, repo, anthropicFactory);
```

Add a new test "persists the macro plan after successful generation" that:
1. Mocks the Anthropic client to return a valid plan JSON
2. Spies on `repo.create`
3. Calls `service.generateMacroPlan(rawProfile, athleteProfileId, userId)`
4. Asserts `repo.create` was called with `{userId, athleteProfileId, plan: <validated plan>}`
5. Asserts the result includes `macroPlanId === 'macro-plan-id-1'`

Find the existing test that exercises a successful generation and use it as the structural template — just add the new assertions on top.

- [ ] **Step 4: Run all tests**

```bash
pnpm --filter @eta/api vitest run src/modules/plan-generation/plan-generation.service.test.ts
```

Expected: existing tests still pass; new test passes.

```bash
pnpm --filter @eta/api typecheck
```

Clean.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/plan-generation/plan-generation.service.ts \
        apps/api/src/modules/plan-generation/plan-generation.service.test.ts \
        apps/api/src/modules/plan-generation/plan-generation.module.ts
git commit -m "feat(poc-a): PlanGenerationService persists macro plan after generation"
```

---

## Task 8: Modify `Pass2GenerationService` to persist after Pass 2

**Files:**
- Modify: `apps/api/src/modules/plan-generation/pass2/pass2.service.ts`
- Modify: `apps/api/src/modules/plan-generation/pass2/types.ts`
- Modify: `apps/api/src/modules/plan-generation/pass2/pass2.service.test.ts`
- Modify: `apps/api/src/modules/plan-generation/plan-generation.module.ts`

- [ ] **Step 1: Add `macroPlanId` to `Pass2Input`**

Read `apps/api/src/modules/plan-generation/pass2/types.ts`. The `Pass2Input` interface currently has `macroPlan, targetWeekIndex, athleteProfile, recentWorkouts`. Add:

```typescript
export interface Pass2Input {
  macroPlanId: string;
  macroPlan: MacroPlan;
  targetWeekIndex: number;
  athleteProfile: AthleteProfile;
  recentWorkouts: WorkoutCompleted[];
}
```

- [ ] **Step 2: Update the service signature**

Modify `apps/api/src/modules/plan-generation/pass2/pass2.service.ts`. Add import:

```typescript
import { WeeklyDetailsRepository } from '../../../db/repositories/weekly-details.repository.js';
```

Constructor:

```typescript
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly kbLoader: KnowledgeBaseLoader,
    private readonly weeklyRepo: WeeklyDetailsRepository,
    anthropicFactory: AnthropicFactory = defaultAnthropicFactory,
  ) {
    // existing body
  }
```

`GenerateWeeklyDetailResult` interface — add `weeklyDetailId: string`:

```typescript
export interface GenerateWeeklyDetailResult {
  output: Pass2Output;
  rawResponse: string;
  usage: { inputTokens: number; outputTokens: number };
  durationMs: number;
  weeklyDetailId: string;
}
```

At the end of `generateWeeklyDetail`, after the postprocess + schema validation succeeds, persist. Find the line that returns the result and replace it with:

```typescript
    const record = await this.weeklyRepo.create({
      macroPlanId: input.macroPlanId,
      detail: validated, // whatever the local variable for the validated WeeklyDetail is
    });
    this.logger.log(
      `Persisted weekly detail ${record.id} for macroPlan ${input.macroPlanId} week ${record.weekNumber}.`,
    );

    return {
      output: { weeklyDetail: validated, computed, warnings, postprocessNotes },
      rawResponse,
      usage,
      durationMs,
      weeklyDetailId: record.id,
    };
```

(Adapt to match the existing locals — the `output: ...` shape depends on what the existing service returns. Don't lose any fields; the new `weeklyDetailId` is additive.)

- [ ] **Step 3: Update the module wiring**

Modify `apps/api/src/modules/plan-generation/plan-generation.module.ts`. Update the `Pass2GenerationService` factory:

```typescript
    {
      provide: Pass2GenerationService,
      inject: [ConfigService, KnowledgeBaseLoader, WeeklyDetailsRepository],
      useFactory: (
        config: ConfigService<Env, true>,
        kbLoader: KnowledgeBaseLoader,
        weeklyRepo: WeeklyDetailsRepository,
      ): Pass2GenerationService => new Pass2GenerationService(config, kbLoader, weeklyRepo),
    },
```

- [ ] **Step 4: Update tests**

Read `apps/api/src/modules/plan-generation/pass2/pass2.service.test.ts`. Existing tests call `new Pass2GenerationService(config, kbLoader, anthropicFactory)` — add a mock repo argument:

```typescript
const weeklyRepo = {
  create: vi.fn(async (input) => ({
    id: 'weekly-detail-id-1',
    macroPlanId: input.macroPlanId,
    weekNumber: input.detail.weekNumber,
    detail: input.detail,
    generatedAt: new Date(),
  })),
} as unknown as WeeklyDetailsRepository;
const service = new Pass2GenerationService(config, kbLoader, weeklyRepo, anthropicFactory);
```

Add `macroPlanId: 'macro-plan-id-1'` to test inputs (the `Pass2Input` shape now requires it).

Add a new test "persists the weekly detail after successful generation":
1. Mocks Anthropic to return a valid weekly detail JSON
2. Spies on `weeklyRepo.create`
3. Calls `service.generateWeeklyDetail({macroPlanId, ...})`
4. Asserts `weeklyRepo.create` called with `{macroPlanId, detail: <validated>}`
5. Asserts result includes `weeklyDetailId === 'weekly-detail-id-1'`

- [ ] **Step 5: Run all tests + typecheck**

```bash
pnpm --filter @eta/api vitest run src/modules/plan-generation/pass2/pass2.service.test.ts
pnpm --filter @eta/api typecheck
```

Both clean.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/plan-generation/pass2/pass2.service.ts \
        apps/api/src/modules/plan-generation/pass2/types.ts \
        apps/api/src/modules/plan-generation/pass2/pass2.service.test.ts \
        apps/api/src/modules/plan-generation/plan-generation.module.ts
git commit -m "feat(poc-a): Pass2GenerationService persists weekly detail after generation"
```

---

## Task 9: Flip `generate-test-plan.ts` to capture `macroPlanId`

**Files:**
- Modify: `apps/api/scripts/generate-test-plan.ts`

- [ ] **Step 1: Inspect the current script**

```bash
sed -n '1,150p' apps/api/scripts/generate-test-plan.ts
```

Understand: where `loadProfile` is called, where `generateMacroPlan` is called, what's printed.

- [ ] **Step 2: Modify the script**

After the `loadProfile` call, resolve the `athleteProfileId`:

- If `--profile=<path>` was used (the path-based override): the profile was NOT loaded from DB. Auto-seed it via `AthleteProfileService.create` and capture the new record's `id` as the athlete profile id.
- If DB-default: the profile came from `repo.findByUserId`. The record's `id` is needed too — change the loader pattern: instead of calling `loadProfile` and getting only the `AthleteProfile`, fetch the full `AthleteProfileRecord` from the repo first when going through the DB path.

Pseudocode for the new resolution:

```typescript
let athleteProfileId: string;
let profile: AthleteProfile;

if (profilePath) {
  // Override path
  profile = await loadProfile({ fromPath: profilePath });
  // Auto-seed
  const profileService = app.get(AthleteProfileService);
  const record = await profileService.create({ userId, profile });
  athleteProfileId = record.id;
  console.log(`Auto-seeded profile ${record.id} from ${profilePath}.`);
} else {
  // DB path — need the full record, not just the profile
  const profileRepo = app.get(AthleteProfileRepository);
  const record = await profileRepo.findLatestRecordForUser(userId);
  if (!record) {
    throw new Error(`No profile in DB for ${userId}. Run \`pnpm seed:profile\` first.`);
  }
  athleteProfileId = record.id;
  profile = record.profile;
}
```

Wait — `AthleteProfileRepository.findByUserId` returns `AthleteProfile | null`, not the record. The repo has `findLatestRecordForUser`? Check the file. If not, the choices are:

A. Add a `findLatestRecordForUser` method to `AthleteProfileRepository` (returns `AthleteProfileRecord | null`)
B. Inline a small SELECT in the script (ugly)

Choose A. Add the method to `AthleteProfileRepository`:

```typescript
  async findLatestRecordForUser(userId: string): Promise<AthleteProfileRecord | null> {
    const rows = await this.db
      .select()
      .from(athleteProfiles)
      .where(eq(athleteProfiles.userId, userId))
      .orderBy(desc(athleteProfiles.generatedAt))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return rowToRecord(row);
  }
```

(Where `rowToRecord` already exists in that file — re-use it.) This is a small additive change; add a test for it in `apps/api/src/db/repositories/athlete-profile.repository.test.ts`:

```typescript
  it('findLatestRecordForUser returns the latest record for a user', async () => {
    const userId = '33333333-3333-3333-3333-333333333333';
    await repo.create({ userId, profile: sampleProfile() });
    await new Promise((r) => setTimeout(r, 50));
    const second = await repo.create({ userId, profile: sampleProfile() });
    const latest = await repo.findLatestRecordForUser(userId);
    expect(latest).not.toBeNull();
    expect(latest!.id).toBe(second.id);
  });
```

(Add to the existing `describe('AthleteProfileRepository', ...)` block.)

Update `generate-test-plan.ts` to use this. Then update the call to `PlanGenerationService.generateMacroPlan`:

```typescript
const result = await planService.generateMacroPlan(profile, athleteProfileId, userId);
console.log(`Persisted macro plan ${result.macroPlanId}.`);
// existing file output, stdout JSON, etc. continues
```

The rest of the script (file output to `scripts/output/`, stdout JSON, etc.) stays unchanged.

- [ ] **Step 3: Run typecheck**

```bash
pnpm --filter @eta/api typecheck
```

Clean.

- [ ] **Step 4: Smoke**

Make sure Postgres is up (`docker ps | grep eta-postgres`), profile exists (`pnpm seed:profile` if not). Then:

```bash
cd /Users/arkadiy.smirnov/Documents/studying/eta/apps/api && pnpm generate:test-plan 2>&1 | head -30
```

Expected output: validation may fail at the prompt-generation stage (the existing pipeline's PlanGenerationError for stale `weeksUntilRace`) — that's fine, it means the script reached the LLM call. We DON'T need to actually run the LLM to verify persistence wiring; we just need the script to not crash before the call.

If you want to fully smoke the persistence path, you need a running ANTHROPIC_API_KEY and a valid profile. If you have both:
- The script should print `Persisted macro plan <uuid>` after the LLM responds
- `docker exec eta-postgres psql -U eta -d eta_dev -c "SELECT count(*) FROM macro_plans;"` should show 1+

- [ ] **Step 5: Run all tests**

```bash
pnpm --filter @eta/api test
```

All pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/scripts/generate-test-plan.ts \
        apps/api/src/db/repositories/athlete-profile.repository.ts \
        apps/api/src/db/repositories/athlete-profile.repository.test.ts
git commit -m "feat(poc-a): generate-test-plan persists macro plan + auto-seeds --profile fixture"
```

---

## Task 10: Flip `generate-test-week.ts` to use `--plan-id` + persist

**Files:**
- Modify: `apps/api/scripts/generate-test-week.ts`

- [ ] **Step 1: Inspect**

```bash
sed -n '1,150p' apps/api/scripts/generate-test-week.ts
```

Currently it reads a macro plan from disk (`scripts/output/test-plan.json` or similar). We're replacing that with DB lookup.

- [ ] **Step 2: Modify the script**

Add to the imports near the top:

```typescript
import { MacroPlansRepository } from '../src/db/repositories/macro-plans.repository.js';
```

In `main()`, replace the macro-plan-loading block with:

```typescript
const planIdArg = process.argv.find((a) => a.startsWith('--plan-id='));
const explicitPlanId = planIdArg?.split('=')[1];

const macroRepo = app.get(MacroPlansRepository);
let macroPlanId: string;
let macroPlan: MacroPlan;

if (explicitPlanId) {
  const record = await macroRepo.findById(explicitPlanId);
  if (!record) throw new Error(`No macro plan with id ${explicitPlanId}.`);
  macroPlanId = record.id;
  macroPlan = record.plan;
} else {
  const record = await macroRepo.findLatestForUser(userId);
  if (!record) throw new Error(`No macro plan in DB for ${userId}. Run \`pnpm generate:test-plan\` first.`);
  macroPlanId = record.id;
  macroPlan = record.plan;
}
```

In the `generateWeeklyDetail` call, pass `macroPlanId`:

```typescript
const result = await pass2Service.generateWeeklyDetail({
  macroPlanId,
  macroPlan,
  targetWeekIndex: weekIndex,
  athleteProfile: profile,
  recentWorkouts,
});
console.log(`Persisted weekly detail ${result.weeklyDetailId} for week ${macroPlan.weeks[weekIndex]!.weekNumber}.`);
// existing output continues
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @eta/api typecheck
```

Clean.

- [ ] **Step 4: Smoke**

```bash
cd /Users/arkadiy.smirnov/Documents/studying/eta/apps/api && pnpm generate:test-week -- --week-index=0 2>&1 | head -30
```

Expected: script reaches the LLM call (or completes if `ANTHROPIC_API_KEY` is set). If you don't have a key, you can verify the persistence wiring by checking that the script gets past the "load macro plan from DB" step before failing at the LLM call.

If `--plan-id=<bad-uuid>` is passed, script exits with clear error message.

- [ ] **Step 5: Commit**

```bash
git add apps/api/scripts/generate-test-week.ts
git commit -m "feat(poc-a): generate-test-week defaults to latest macro plan from DB; --plan-id overrides"
```

---

## Task 11: Manual end-to-end smoke

This task does no code changes — only documentation that the end-to-end pipeline works.

- [ ] **Step 1: Full smoke against the dev DB**

```bash
# Confirm seed profile exists
docker exec eta-postgres psql -U eta -d eta_dev -c "SELECT count(*) FROM athlete_profiles;"
# If 0: cd apps/api && pnpm seed:profile

# Run Pass 1 — generates macro plan, persists, prints id
cd /Users/arkadiy.smirnov/Documents/studying/eta/apps/api && pnpm generate:test-plan
# Expect: "Persisted macro plan <uuid>" near the end

# Verify
docker exec eta-postgres psql -U eta -d eta_dev -c "SELECT id, race_date, generated_at FROM macro_plans ORDER BY generated_at DESC LIMIT 1;"

# Run Pass 2 for the first week
cd /Users/arkadiy.smirnov/Documents/studying/eta/apps/api && pnpm generate:test-week -- --week-index=0
# Expect: "Persisted weekly detail <uuid> for week N"

# Verify
docker exec eta-postgres psql -U eta -d eta_dev -c "SELECT week_number, week_start_date FROM weekly_details ORDER BY generated_at DESC LIMIT 5;"

# Boot API + check the read endpoint
cd /Users/arkadiy.smirnov/Documents/studying/eta/apps/api && STRAVA_ENABLED=false PORT=3099 pnpm dev &
sleep 8
curl -s http://localhost:3099/plans/me | jq '.macroPlanId, .weeks | length, .weeks[0].weeklyDetail.workouts | length'
kill %1
wait 2>/dev/null
```

Expected: macroPlanId visible, 28 weeks total, week 0 has a non-null weeklyDetail with workouts.

- [ ] **Step 2: No commit** (this is verification, not code)

If anything fails, fix it in the relevant task. If everything passes, this task is done.

---

## Spec coverage check

| Spec requirement | Task |
|---|---|
| `macro_plans` table with denorm `race_date` + FK to athlete_profiles | Task 1 |
| `weekly_details` table with FK to macro_plans (cascade) | Task 1 |
| Drizzle migration | Task 1 |
| `MacroPlansRepository.create/findById/findLatestForUser` | Task 2 |
| `WeeklyDetailsRepository.create/findLatestForMacroPlan` (Map, DISTINCT ON) | Task 3 |
| `PlansService.getLatestTreeForUser/getTreeById` | Task 4 |
| `GET /plans/me` (404 on no plan) | Task 5 |
| `GET /plans/:id` (404 + 400 on invalid uuid) | Task 5 |
| `PlansModule` registered unconditionally in AppModule | Task 6 |
| `PlanGenerationService.generateMacroPlan` persists + returns `macroPlanId` | Task 7 |
| `Pass2GenerationService.generateWeeklyDetail` persists + returns `weeklyDetailId` | Task 8 |
| `generate-test-plan` flips to use DB profile id + auto-seed `--profile` path | Task 9 |
| `generate-test-week` `--plan-id` flag, default to latest | Task 10 |
| Manual smoke documented | Task 11 |
| Repository tests with testcontainers | Tasks 2, 3 |
| Service + controller unit tests | Tasks 4, 5 |
| Updated generation-service tests with persist assertion | Tasks 7, 8 |

No gaps.
