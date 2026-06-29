# Pass 3 DB Wiring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Pass 3 against DB-resident data — new `adaptation_suggestions` table, modified `Pass3GenerationService` (takes `macroPlanId`/`forWeekStart`, persists), new `pnpm adapt:current-week` CLI, `PlanTree` gains `currentAdaptation`.

**Architecture:** Single new table + repo. Pass3Service constructor gains the repo. CLI does the orchestration: macro plan → current-week target → WeeklyDetail → recent workouts (canonical converter) → athlete profile → Pass 3 → persist.

**Tech Stack:** NestJS + Drizzle + postgres-js + Zod + Vitest + `@testcontainers/postgresql`.

**Spec:** `docs/superpowers/specs/2026-06-17-pass3-wiring-design.md`

---

## File Map

**Create:**
- `apps/api/src/db/schema/adaptation-suggestions.ts`
- `apps/api/drizzle/0003_*.sql` (generated)
- `apps/api/src/db/repositories/adaptations.repository.ts`
- `apps/api/src/db/repositories/adaptations.repository.test.ts`
- `apps/api/src/db/repositories/workouts-completed.repository.test.ts` (new — converter unit tests)
- `apps/api/scripts/adapt-current-week.ts`

**Modify:**
- `apps/api/src/db/schema/index.ts` — export the new schema
- `apps/api/src/db/repositories/workouts-completed.repository.ts` — add converter + `findCanonicalForUserAndDateRange`
- `apps/api/src/modules/plan-generation/pass3/types.ts` — Pass3Input gains `macroPlanId` + `forWeekStart`
- `apps/api/src/modules/plan-generation/pass3/pass3.service.ts` — add repo dep + persist + `adaptationId` in result
- `apps/api/src/modules/plan-generation/pass3/pass3.service.test.ts` — add persist assertion
- `apps/api/src/modules/plan-generation/plan-generation.module.ts` — provide AdaptationsRepository + Pass3 factory update
- `apps/api/src/modules/plans/plans.service.ts` — extend PlanTree with `currentAdaptation` + lookup
- `apps/api/src/modules/plans/plans.service.test.ts` — assert currentAdaptation populated
- `apps/api/src/modules/plans/plans.module.ts` — provide AdaptationsRepository (or import via DbModule pattern)
- `apps/api/package.json` — add `adapt:current-week` script
- `apps/api/scripts/generate-test-adaptation.ts` — TYPECHECK FIX ONLY: if Pass3Input requires `macroPlanId`/`forWeekStart`, pass sentinel values (`'00000000-…'` / scenario's `weekStartDate`) — this CLI is not being rewired, just kept compiling

---

## Task 1: Schema + migration for `adaptation_suggestions`

**Files:**
- Create: `apps/api/src/db/schema/adaptation-suggestions.ts`
- Modify: `apps/api/src/db/schema/index.ts`
- Generate: `apps/api/drizzle/0003_*.sql`

- [ ] **Step 1: Write the schema**

```typescript
import { type AdaptationSuggestion } from '@eta/shared-types';
import { date, index, jsonb, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { macroPlans } from './macro-plans.js';

/**
 * One row per Pass 3 generation. Append-only — re-running Pass 3 for the same
 * upcoming week inserts a new row. `findLatestForWeek` uses DISTINCT ON.
 * Cascade delete from `macro_plans` cleans up children.
 */
export const adaptationSuggestions = pgTable(
  'adaptation_suggestions',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    macroPlanId: uuid('macro_plan_id')
      .notNull()
      .references(() => macroPlans.id, { onDelete: 'cascade' }),

    forWeekStart: date('for_week_start').notNull(),

    data: jsonb('data').$type<AdaptationSuggestion>().notNull(),

    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    macroForWeekIdx: index('adaptation_suggestions_macro_week_idx').on(
      table.macroPlanId,
      table.forWeekStart,
    ),
  }),
);

export type AdaptationSuggestionRow = typeof adaptationSuggestions.$inferSelect;
export type NewAdaptationSuggestionRow = typeof adaptationSuggestions.$inferInsert;
```

- [ ] **Step 2: Update `apps/api/src/db/schema/index.ts`**

Add one line at the end:

```typescript
export * from './adaptation-suggestions.js';
```

- [ ] **Step 3: Generate + apply migration**

```bash
cd /Users/arkadiy.smirnov/Documents/studying/eta/apps/api && pnpm db:generate
cd /Users/arkadiy.smirnov/Documents/studying/eta/apps/api && pnpm db:migrate
```

Migration should ONLY add the new table + index + FK. Verify with `psql -c "\d adaptation_suggestions"`.

- [ ] **Step 4: Typecheck + commit**

```bash
pnpm --filter @eta/api typecheck
git add apps/api/src/db/schema/adaptation-suggestions.ts \
        apps/api/src/db/schema/index.ts \
        apps/api/drizzle/
git commit -m "feat(poc-b): adaptation_suggestions schema + migration"
```

---

## Task 2: `AdaptationsRepository` (TDD, testcontainers)

**Files:**
- Create: `apps/api/src/db/repositories/adaptations.repository.ts`
- Create: `apps/api/src/db/repositories/adaptations.repository.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { type AdaptationSuggestion, type AthleteProfile, type MacroPlan } from '@eta/shared-types';
import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../schema/index.js';
import { AdaptationsRepository } from './adaptations.repository.js';
import { AthleteProfileRepository } from './athlete-profile.repository.js';
import { MacroPlansRepository } from './macro-plans.repository.js';

type Db = PostgresJsDatabase<typeof schema>;

const USER_ID = '44444444-4444-4444-4444-444444444444';

const sampleProfile = (): AthleteProfile => ({
  experienceLevel: 'tri_experienced',
  raceDate: new Date('2026-09-21T00:00:00Z'),
  raceType: 'full_ironman',
  weeksUntilRace: 14,
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
  generatedAt: new Date('2026-06-17T00:00:00Z'),
  warnings: [],
});

const sampleMacroPlan = (athleteProfileId: string): MacroPlan => ({
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

const sampleSuggestion = (note: string): AdaptationSuggestion => ({
  forWeekStart: '2026-06-15',
  adjustments: [
    {
      originalDate: '2026-06-20',
      originalWorkoutCode: 'B/AE1',
      action: 'keep',
      reasoning: note,
      citation: 'knowledge-base/05-recovery.md',
    },
  ],
});

let container: StartedPostgreSqlContainer;
let client: ReturnType<typeof postgres>;
let db: Db;
let repo: AdaptationsRepository;
let macroRepo: MacroPlansRepository;
let profileRepo: AthleteProfileRepository;
let macroPlanId: string;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  client = postgres(container.getConnectionUri(), { max: 5 });
  db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  repo = new AdaptationsRepository(db);
  macroRepo = new MacroPlansRepository(db);
  profileRepo = new AthleteProfileRepository(db);
}, 120_000);

afterAll(async () => {
  if (client) await client.end();
  if (container) await container.stop();
}, 30_000);

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE athlete_profiles, macro_plans, weekly_details, adaptation_suggestions RESTART IDENTITY CASCADE`);
  const profile = await profileRepo.create({ userId: USER_ID, profile: sampleProfile() });
  const macro = await macroRepo.create({ userId: USER_ID, athleteProfileId: profile.id, plan: sampleMacroPlan(profile.id) });
  macroPlanId = macro.id;
});

describe('AdaptationsRepository', () => {
  it('create round-trips through findLatestForWeek', async () => {
    const created = await repo.create({
      macroPlanId,
      forWeekStart: '2026-06-15',
      suggestion: sampleSuggestion('first'),
    });
    expect(created.id).toBeDefined();
    expect(created.macroPlanId).toBe(macroPlanId);
    expect(created.forWeekStart).toBe('2026-06-15');

    const found = await repo.findLatestForWeek(macroPlanId, '2026-06-15');
    expect(found).not.toBeNull();
    expect(found!.suggestion.adjustments[0]!.reasoning).toBe('first');
  });

  it('findLatestForWeek returns the most recent version', async () => {
    await repo.create({ macroPlanId, forWeekStart: '2026-06-15', suggestion: sampleSuggestion('older') });
    await new Promise((r) => setTimeout(r, 50));
    await repo.create({ macroPlanId, forWeekStart: '2026-06-15', suggestion: sampleSuggestion('newer') });

    const latest = await repo.findLatestForWeek(macroPlanId, '2026-06-15');
    expect(latest!.suggestion.adjustments[0]!.reasoning).toBe('newer');
  });

  it('findLatestForWeek returns null when no row matches', async () => {
    const result = await repo.findLatestForWeek(macroPlanId, '2099-01-01');
    expect(result).toBeNull();
  });

  it('cascades on parent macro plan delete', async () => {
    await repo.create({ macroPlanId, forWeekStart: '2026-06-15', suggestion: sampleSuggestion('x') });
    await db.execute(sql`DELETE FROM macro_plans WHERE id = ${macroPlanId}`);
    const count = await db.execute(sql`SELECT COUNT(*)::int AS c FROM adaptation_suggestions`);
    expect((count as unknown as Array<{ c: number }>)[0]!.c).toBe(0);
  });

  it('rejects insert when macro_plan_id does not exist', async () => {
    const bogus = '99999999-9999-9999-9999-999999999999';
    await expect(
      repo.create({ macroPlanId: bogus, forWeekStart: '2026-06-15', suggestion: sampleSuggestion('x') }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run — verify fail**

```bash
pnpm --filter @eta/api vitest run src/db/repositories/adaptations.repository.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write the repository**

```typescript
import { Inject, Injectable } from '@nestjs/common';
import { type AdaptationSuggestion, adaptationSuggestionSchema } from '@eta/shared-types';
import { sql } from 'drizzle-orm';
import { DB, type Db } from '../db.module.js';
import { adaptationSuggestions } from '../schema/adaptation-suggestions.js';

export interface AdaptationRecord {
  id: string;
  macroPlanId: string;
  forWeekStart: string;
  suggestion: AdaptationSuggestion;
  generatedAt: Date;
}

export interface CreateAdaptationInput {
  macroPlanId: string;
  forWeekStart: string;
  suggestion: AdaptationSuggestion;
}

@Injectable()
export class AdaptationsRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  async create(input: CreateAdaptationInput): Promise<AdaptationRecord> {
    const [row] = await this.db
      .insert(adaptationSuggestions)
      .values({
        macroPlanId: input.macroPlanId,
        forWeekStart: input.forWeekStart,
        data: input.suggestion,
      })
      .returning();
    if (!row) throw new Error('Insert into adaptation_suggestions returned no row');
    return rowToRecord(row);
  }

  async findLatestForWeek(macroPlanId: string, forWeekStart: string): Promise<AdaptationRecord | null> {
    const rows = await this.db.execute<{
      id: string;
      macro_plan_id: string;
      for_week_start: string;
      data: unknown;
      generated_at: Date;
    }>(sql`
      SELECT id, macro_plan_id, for_week_start, data, generated_at
      FROM adaptation_suggestions
      WHERE macro_plan_id = ${macroPlanId} AND for_week_start = ${forWeekStart}
      ORDER BY generated_at DESC
      LIMIT 1
    `);
    const row = rows[0];
    if (!row) return null;
    const parsed = adaptationSuggestionSchema.safeParse(row.data);
    if (!parsed.success) {
      throw new Error(
        `Failed to parse AdaptationSuggestion from JSONB at adaptation_suggestions.id=${row.id}: ${parsed.error.message}`,
      );
    }
    return {
      id: row.id,
      macroPlanId: row.macro_plan_id,
      forWeekStart: row.for_week_start,
      suggestion: parsed.data,
      generatedAt: row.generated_at,
    };
  }
}

function rowToRecord(row: typeof adaptationSuggestions.$inferSelect): AdaptationRecord {
  const parsed = adaptationSuggestionSchema.safeParse(row.data);
  if (!parsed.success) {
    throw new Error(
      `Failed to parse AdaptationSuggestion from JSONB at adaptation_suggestions.id=${row.id}: ${parsed.error.message}`,
    );
  }
  return {
    id: row.id,
    macroPlanId: row.macroPlanId,
    forWeekStart: row.forWeekStart,
    suggestion: parsed.data,
    generatedAt: row.generatedAt,
  };
}
```

- [ ] **Step 4: Run — verify pass**

```bash
pnpm --filter @eta/api vitest run src/db/repositories/adaptations.repository.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/db/repositories/adaptations.repository.ts \
        apps/api/src/db/repositories/adaptations.repository.test.ts
git commit -m "feat(poc-b): AdaptationsRepository (create + findLatestForWeek)"
```

---

## Task 3: Workouts repo converter + canonical query

**Files:**
- Modify: `apps/api/src/db/repositories/workouts-completed.repository.ts`
- Create: `apps/api/src/db/repositories/workouts-completed.repository.test.ts`

- [ ] **Step 1: Write the converter unit tests + canonical query test**

Create `apps/api/src/db/repositories/workouts-completed.repository.test.ts`:

```typescript
import { type Discipline, type TssStatus } from '@eta/shared-types';
import { describe, expect, it } from 'vitest';
import type { WorkoutsCompletedRow } from '../schema/workouts-completed.js';
import { rowToWorkoutCompleted } from './workouts-completed.repository.js';

function row(overrides: Partial<WorkoutsCompletedRow> = {}): WorkoutsCompletedRow {
  return {
    id: 'row-id',
    userId: 'user-id',
    source: 'strava',
    externalId: 'ext-1',
    date: '2026-06-10',
    discipline: 'bike',
    workoutCode: null,
    actualTss: '50.00',
    tssStatus: 'computed',
    plannedTss: null,
    plannedDurationSeconds: null,
    actualDurationSeconds: 3600,
    perceivedExertion: null,
    notes: null,
    raw: {} as never,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as WorkoutsCompletedRow;
}

describe('rowToWorkoutCompleted', () => {
  it('converts a bike row with all fields populated', () => {
    const out = rowToWorkoutCompleted(row({ perceivedExertion: 7, notes: 'good ride' }));
    expect(out.date).toBe('2026-06-10');
    expect(out.discipline).toBe('bike');
    expect(out.actualTss).toBe(50);
    expect(out.tssStatus).toBe('computed');
    expect(out.perceivedExertion).toBe(7);
    expect(out.notes).toBe('good ride');
    expect(out.actualDurationSeconds).toBe(3600);
    expect(out.workoutCode).toBe('B/AE1'); // sentinel for bike
  });

  it('uses run sentinel when discipline=run and workoutCode is null', () => {
    const out = rowToWorkoutCompleted(row({ discipline: 'run' }));
    expect(out.workoutCode).toBe('C/AE1');
  });

  it('uses swim sentinel when discipline=swim and workoutCode is null', () => {
    const out = rowToWorkoutCompleted(row({ discipline: 'swim' }));
    expect(out.workoutCode).toBe('D/AE1');
  });

  it('preserves workoutCode when present (overrides sentinel)', () => {
    const out = rowToWorkoutCompleted(row({ workoutCode: 'B/SS1' }));
    expect(out.workoutCode).toBe('B/SS1');
  });

  it('converts null actualTss to undefined', () => {
    const out = rowToWorkoutCompleted(row({ actualTss: null, tssStatus: 'pending_inference' }));
    expect(out.actualTss).toBeUndefined();
    expect(out.tssStatus).toBe('pending_inference');
  });
});
```

- [ ] **Step 2: Run — verify fail**

```bash
pnpm --filter @eta/api vitest run src/db/repositories/workouts-completed.repository.test.ts
```

Expected: FAIL — `rowToWorkoutCompleted` not exported.

- [ ] **Step 3: Modify the repository file**

Read `apps/api/src/db/repositories/workouts-completed.repository.ts`. Add at the bottom of the file (outside the class):

```typescript
import type { Discipline, WorkoutCode, WorkoutCompleted } from '@eta/shared-types';

function sentinelWorkoutCodeForDiscipline(d: Discipline): WorkoutCode {
  if (d === 'bike') return 'B/AE1';
  if (d === 'run') return 'C/AE1';
  return 'D/AE1'; // swim
}

/**
 * Convert a DB row into the canonical `WorkoutCompleted` shape.
 * Strava-ingested rows have `workoutCode=null`; we substitute a discipline-
 * specific sentinel so the strict `WorkoutCode` union holds. Downstream Pass 3
 * postprocess discards these as non-plan-matches.
 */
export function rowToWorkoutCompleted(row: typeof workoutsCompleted.$inferSelect): WorkoutCompleted {
  return {
    date: row.date,
    workoutCode: (row.workoutCode as WorkoutCode | null) ?? sentinelWorkoutCodeForDiscipline(row.discipline as Discipline),
    actualTss: row.actualTss !== null ? Number(row.actualTss) : undefined,
    tssStatus: (row.tssStatus as 'computed' | 'pending_inference' | undefined) ?? undefined,
    perceivedExertion: row.perceivedExertion ?? undefined,
    notes: row.notes ?? undefined,
    discipline: row.discipline as Discipline,
    actualDurationSeconds: row.actualDurationSeconds ?? undefined,
  };
}
```

Also add a new method inside the class (after the existing `findByUserAndDateRange`):

```typescript
  /**
   * Return canonical-shaped completed workouts for a user in [fromDate, toDate).
   * Strava-only rows substitute discipline-based sentinel workoutCodes.
   */
  async findCanonicalForUserAndDateRange(
    userId: string,
    fromDate: string,
    toDate: string,
  ): Promise<WorkoutCompleted[]> {
    const rows = await this.findByUserAndDateRange(userId, fromDate, toDate);
    return rows.map(rowToWorkoutCompleted);
  }
```

Make sure `WorkoutCompleted` is imported alongside the existing imports at the top of the file:

```typescript
import type { WorkoutCompleted } from '@eta/shared-types';
```

- [ ] **Step 4: Run — verify pass**

```bash
pnpm --filter @eta/api vitest run src/db/repositories/workouts-completed.repository.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Typecheck + commit**

```bash
pnpm --filter @eta/api typecheck
git add apps/api/src/db/repositories/workouts-completed.repository.ts \
        apps/api/src/db/repositories/workouts-completed.repository.test.ts
git commit -m "feat(poc-b): rowToWorkoutCompleted converter + findCanonicalForUserAndDateRange"
```

---

## Task 4: `Pass3GenerationService` modifications (persist)

**Files:**
- Modify: `apps/api/src/modules/plan-generation/pass3/types.ts`
- Modify: `apps/api/src/modules/plan-generation/pass3/pass3.service.ts`
- Modify: `apps/api/src/modules/plan-generation/pass3/pass3.service.test.ts`
- Modify: `apps/api/src/modules/plan-generation/plan-generation.module.ts`
- Modify: `apps/api/scripts/generate-test-adaptation.ts` (typecheck fix only)

- [ ] **Step 1: Add `macroPlanId` and `forWeekStart` to Pass3Input**

In `apps/api/src/modules/plan-generation/pass3/types.ts`, add to the top of `Pass3Input`:

```typescript
export interface Pass3Input {
  /** FK to the macro plan this adaptation belongs to. */
  macroPlanId: string;
  /** ISO date of the Monday of the upcoming week (matches weeklyDraft.weekStartDate). */
  forWeekStart: string;
  // ...existing fields preserved...
  weeklyDraft: WeeklyDetail;
  completedLastWeek: WorkoutCompleted[];
  readinessHistory: DailyReadinessReading[];
  athleteProfile: AthleteProfile;
  seedDailyTss?: DailyTss[];
}
```

- [ ] **Step 2: Modify Pass3GenerationService**

In `apps/api/src/modules/plan-generation/pass3/pass3.service.ts`:

Add at the top imports:

```typescript
import { AdaptationsRepository } from '../../../db/repositories/adaptations.repository.js';
```

Update `GenerateAdaptationResult` (find existing interface — add field):

```typescript
export interface GenerateAdaptationResult {
  // ...existing fields...
  adaptationId: string;
}
```

Update the constructor to take `adaptationsRepo` as 3rd positional param:

```typescript
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly kbLoader: KnowledgeBaseLoader,
    private readonly adaptationsRepo: AdaptationsRepository,
    anthropicFactory: AnthropicFactory = defaultAnthropicFactory,
  ) {
    // existing body
  }
```

At the very end of `generateAdaptation`, after `validatePass3Suggestion` succeeds, persist:

```typescript
    const record = await this.adaptationsRepo.create({
      macroPlanId: input.macroPlanId,
      forWeekStart: input.forWeekStart,
      suggestion: validated, // whatever the validated AdaptationSuggestion local is
    });
    this.logger.log(
      `Persisted adaptation ${record.id} for macroPlan ${input.macroPlanId} week starting ${input.forWeekStart}.`,
    );
```

Update the existing `return { ... }` to include `adaptationId: record.id`.

- [ ] **Step 3: Update the module factory**

Modify `apps/api/src/modules/plan-generation/plan-generation.module.ts`. Add import:

```typescript
import { AdaptationsRepository } from '../../db/repositories/adaptations.repository.js';
```

Add `AdaptationsRepository` to providers (alongside `MacroPlansRepository` and `WeeklyDetailsRepository`).

Update the `Pass3GenerationService` factory:

```typescript
    {
      provide: Pass3GenerationService,
      inject: [ConfigService, KnowledgeBaseLoader, AdaptationsRepository],
      useFactory: (
        config: ConfigService<Env, true>,
        kbLoader: KnowledgeBaseLoader,
        adaptationsRepo: AdaptationsRepository,
      ): Pass3GenerationService => new Pass3GenerationService(config, kbLoader, adaptationsRepo),
    },
```

- [ ] **Step 4: Update Pass3 tests**

In `apps/api/src/modules/plan-generation/pass3/pass3.service.test.ts`:

- Add type-only imports:
  ```typescript
  import type {
    AdaptationRecord,
    AdaptationsRepository,
  } from '../../../db/repositories/adaptations.repository.js';
  ```
- Add a `makeAdaptationsRepo()` factory similar to Phase A's `makeMacroRepo()` / `makeWeeklyRepo()` patterns
- Update every `new Pass3GenerationService(...)` call to pass `adaptationsRepo`
- Update every input passed to `generateAdaptation(...)` to include `macroPlanId: 'macro-plan-id-1'` and `forWeekStart: <weeklyDraft.weekStartDate>`
- Add a new test "persists the adaptation after successful generation":
  - Mock Anthropic to return valid AdaptationSuggestion JSON
  - Call `service.generateAdaptation({...})`
  - Assert `createSpy` called once with `{ macroPlanId: 'macro-plan-id-1', forWeekStart: <date>, suggestion: <validated> }`
  - Assert result includes `adaptationId === 'adaptation-id-1'`

- [ ] **Step 5: Patch `apps/api/scripts/generate-test-adaptation.ts` for typecheck**

That CLI passes Pass3Input to the service. Since the input now requires `macroPlanId` + `forWeekStart`, add sentinel values to each `input` constructed there. Inspect the file to find where the inputs come from (likely `pass3Scenarios[name]()`).

The cleanest fix: wrap each scenario invocation:

```typescript
const scenarioInput = pass3Scenarios[scenario]();
const input = {
  ...scenarioInput,
  macroPlanId: '00000000-0000-0000-0000-000000000000', // sentinel — this CLI runs against fixtures, no DB
  forWeekStart: scenarioInput.weeklyDraft.weekStartDate,
};
```

But then the persist call would fail at runtime due to FK violation. To prevent that, the scenario CLI needs to NOT persist. Two options:
- (a) Mock the repo at the CLI layer — ugly
- (b) Add a `dryRun?: boolean` option to `Pass3Input` that skips persistence — clean

Choose **(b)**: add `dryRun?: boolean` to Pass3Input. In the service, wrap the persist call:

```typescript
let adaptationId: string | undefined;
if (!input.dryRun) {
  const record = await this.adaptationsRepo.create({...});
  adaptationId = record.id;
  this.logger.log(...);
}
return {
  ...
  adaptationId: adaptationId ?? 'dry-run',
};
```

Update the existing scenario CLI to pass `dryRun: true`. Add the field to `Pass3Input` type. Update the `adaptationId` type to be `string` (with `'dry-run'` literal allowed by being `string`).

Document the `dryRun` mode in `Pass3Input` with a JSDoc comment.

- [ ] **Step 6: Run pass3 tests + typecheck + full suite**

```bash
pnpm --filter @eta/api vitest run src/modules/plan-generation/pass3/pass3.service.test.ts
pnpm --filter @eta/api typecheck
pnpm --filter @eta/api test
```

All clean.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/plan-generation/pass3/ \
        apps/api/src/modules/plan-generation/plan-generation.module.ts \
        apps/api/scripts/generate-test-adaptation.ts
git commit -m "feat(poc-b): Pass3GenerationService persists adaptation; dryRun for fixture CLI"
```

---

## Task 5: Extend `PlansService.getLatestTreeForUser` with `currentAdaptation`

**Files:**
- Modify: `apps/api/src/modules/plans/plans.service.ts`
- Modify: `apps/api/src/modules/plans/plans.service.test.ts`
- Modify: `apps/api/src/modules/plans/plans.module.ts`

- [ ] **Step 1: Modify `plans.service.ts`**

Add import:

```typescript
import { AdaptationsRepository } from '../../db/repositories/adaptations.repository.js';
```

Extend `PlanTree`:

```typescript
import type { AdaptationSuggestion, MacroPlan, MacroPlanWeek, WeeklyDetail } from '@eta/shared-types';

export interface PlanTree {
  macroPlanId: string;
  athleteProfileId: string;
  macroPlan: MacroPlan;
  generatedAt: Date;
  weeks: PlanTreeWeek[];
  currentAdaptation: AdaptationSuggestion | null;
}
```

Add the helper at the bottom of the file (outside the class):

```typescript
/**
 * Find the macro plan week that contains today's date (or the last week if
 * today is past the race). Returns the weekStartDate as an ISO string, or
 * null if the plan has no weeks.
 */
export function currentWeekStartDate(plan: MacroPlan, today: Date): string | null {
  if (plan.weeks.length === 0) return null;
  const todayIso = today.toISOString().slice(0, 10);
  for (const week of plan.weeks) {
    const startMs = Date.parse(week.weekStartDate + 'T00:00:00Z');
    const endMs = startMs + 7 * 86_400_000;
    const todayMs = Date.parse(todayIso + 'T00:00:00Z');
    if (todayMs >= startMs && todayMs < endMs) {
      return week.weekStartDate;
    }
  }
  // Past race or before plan start — return the last week
  return plan.weeks[plan.weeks.length - 1]!.weekStartDate;
}
```

Update the constructor:

```typescript
  constructor(
    private readonly macroRepo: MacroPlansRepository,
    private readonly weeklyRepo: WeeklyDetailsRepository,
    private readonly adaptationsRepo: AdaptationsRepository,
  ) {}
```

Update `buildTree` to include the adaptation lookup:

```typescript
  private async buildTree(record: MacroPlanRecord): Promise<PlanTree> {
    const weeklyMap = await this.weeklyRepo.findLatestForMacroPlan(record.id);

    const currentWeekStart = currentWeekStartDate(record.plan, new Date());
    const adaptationRecord =
      currentWeekStart !== null
        ? await this.adaptationsRepo.findLatestForWeek(record.id, currentWeekStart)
        : null;

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
      currentAdaptation: adaptationRecord?.suggestion ?? null,
    };
  }
```

- [ ] **Step 2: Update `plans.service.test.ts`**

Add type-only import:

```typescript
import type {
  AdaptationRecord,
  AdaptationsRepository,
} from '../../db/repositories/adaptations.repository.js';
```

Add a factory:

```typescript
function makeAdaptationsRepo(opts: { latest?: AdaptationRecord | null } = {}): AdaptationsRepository {
  return {
    findLatestForWeek: vi.fn(async () => opts.latest ?? null),
  } as unknown as AdaptationsRepository;
}
```

Update every `new PlansService(...)` call to pass the adaptations repo.

Add 3 new tests inside the existing describe:

1. "currentAdaptation populated when latest adaptation exists" — set the macro plan's first week's `weekStartDate` to a date matching today (use `vi.setSystemTime` and a fixed date); mock the adaptations repo to return a record; assert `tree.currentAdaptation` is the suggestion
2. "currentAdaptation null when no adaptation exists" — mock returns null; assert null
3. "currentWeekStartDate helper picks the right week" — direct test of the exported helper using a 3-week macro plan and a today-date inside week 2

- [ ] **Step 3: Update `plans.module.ts`**

Add to imports + providers:

```typescript
import { AdaptationsRepository } from '../../db/repositories/adaptations.repository.js';

@Module({
  imports: [DbModule],
  controllers: [PlansController],
  providers: [
    MacroPlansRepository,
    WeeklyDetailsRepository,
    AdaptationsRepository,        // NEW
    PlansService,
  ],
  exports: [PlansService, MacroPlansRepository, WeeklyDetailsRepository, AdaptationsRepository],
})
```

- [ ] **Step 4: Run tests + typecheck + commit**

```bash
pnpm --filter @eta/api vitest run src/modules/plans/
pnpm --filter @eta/api typecheck
git add apps/api/src/modules/plans/
git commit -m "feat(poc-b): PlansService returns currentAdaptation in PlanTree"
```

---

## Task 6: `adapt-current-week.ts` CLI

**Files:**
- Create: `apps/api/scripts/adapt-current-week.ts`
- Modify: `apps/api/package.json` (add script)

- [ ] **Step 1: Add the npm script**

In `apps/api/package.json`, add after the existing CLI scripts:

```json
    "adapt:current-week": "node --import @swc-node/register/esm-register scripts/adapt-current-week.ts"
```

(Mind the JSON commas.)

- [ ] **Step 2: Create the CLI**

Create `apps/api/scripts/adapt-current-week.ts`:

```typescript
/* eslint-disable no-console */
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../src/app.module.js';
import type { Env } from '../src/config/env.schema.js';
import { AthleteProfileRepository } from '../src/db/repositories/athlete-profile.repository.js';
import { MacroPlansRepository } from '../src/db/repositories/macro-plans.repository.js';
import { WeeklyDetailsRepository } from '../src/db/repositories/weekly-details.repository.js';
import { WorkoutsCompletedRepository } from '../src/db/repositories/workouts-completed.repository.js';
import { Pass3GenerationService } from '../src/modules/plan-generation/pass3/pass3.service.js';
import { currentWeekStartDate } from '../src/modules/plans/plans.service.js';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: false });
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  const userArg = process.argv.find((a) => a.startsWith('--user='));
  const userId: string = userArg
    ? (userArg.split('=')[1] ?? config.get('DEV_USER_ID', { infer: true }))
    : config.get('DEV_USER_ID', { infer: true });

  const weekStartArg = process.argv.find((a) => a.startsWith('--week-start='));
  const explicitWeekStart = weekStartArg?.split('=')[1];

  const macroRepo = app.get(MacroPlansRepository);
  const weeklyRepo = app.get(WeeklyDetailsRepository);
  const workoutsRepo = app.get(WorkoutsCompletedRepository);
  const profileRepo = app.get(AthleteProfileRepository);
  const pass3 = app.get(Pass3GenerationService);

  const macroRecord = await macroRepo.findLatestForUser(userId);
  if (!macroRecord) {
    throw new Error(`No macro plan in DB for ${userId}. Run \`pnpm generate:test-plan\` first.`);
  }
  console.log(`Loaded macro plan ${macroRecord.id} (race ${macroRecord.plan.raceDate}).`);

  const targetWeekStart =
    explicitWeekStart ?? currentWeekStartDate(macroRecord.plan, new Date());
  if (!targetWeekStart) {
    throw new Error('Macro plan has no weeks — cannot adapt.');
  }
  console.log(`Adapting week starting ${targetWeekStart}.`);

  const targetWeek = macroRecord.plan.weeks.find((w) => w.weekStartDate === targetWeekStart);
  if (!targetWeek) {
    throw new Error(`No macro plan week with weekStartDate=${targetWeekStart}.`);
  }

  const weeklyMap = await weeklyRepo.findLatestForMacroPlan(macroRecord.id);
  const weeklyDraft = weeklyMap.get(targetWeek.weekNumber);
  if (!weeklyDraft) {
    throw new Error(
      `No WeeklyDetail for week ${targetWeek.weekNumber}. Run \`pnpm generate:test-week -- --week-index=<N>\` first.`,
    );
  }

  // 7 days immediately preceding the upcoming week
  const fromMs = Date.parse(targetWeekStart + 'T00:00:00Z') - 7 * 86_400_000;
  const fromDate = new Date(fromMs).toISOString().slice(0, 10);
  const completedLastWeek = await workoutsRepo.findCanonicalForUserAndDateRange(
    userId,
    fromDate,
    targetWeekStart,
  );
  console.log(`Found ${completedLastWeek.length} completed workouts in [${fromDate}, ${targetWeekStart}).`);

  const profileRecord = await profileRepo.findLatestRecordForUser(userId);
  if (!profileRecord) {
    throw new Error(`No profile in DB for ${userId}. Run \`pnpm seed:profile\` first.`);
  }

  console.log('Calling Pass 3...');
  const result = await pass3.generateAdaptation({
    macroPlanId: macroRecord.id,
    forWeekStart: targetWeekStart,
    weeklyDraft,
    completedLastWeek,
    readinessHistory: [],
    athleteProfile: profileRecord.profile,
  });

  console.log(`Persisted adaptation ${result.adaptationId}.`);
  console.log(`Hard-rule firings: ${result.hardRuleOutput.forcedAdjustments.length}`);
  console.log(`LLM adjustments: ${result.suggestion.adjustments.length}`);

  await app.close();
}

void main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @eta/api typecheck
```

Clean.

- [ ] **Step 4: Smoke test (best effort)**

```bash
cd /Users/arkadiy.smirnov/Documents/studying/eta/apps/api && pnpm adapt:current-week 2>&1 | tail -30
```

Preconditions: Postgres up, profile + macro plan + at least week-0 detail already exist from Phase A smoke. Expected: prints "Loaded macro plan...", "Adapting week starting 2026-06-15", "Found N completed workouts", "Calling Pass 3..." and either succeeds (prints "Persisted adaptation <uuid>") or fails at the LLM call (still valid — confirms wiring through to the API call).

- [ ] **Step 5: Commit**

```bash
git add apps/api/scripts/adapt-current-week.ts apps/api/package.json
git commit -m "feat(poc-b): pnpm adapt:current-week — Pass 3 against live DB"
```

---

## Task 7: Final smoke

- [ ] **Step 1: Full end-to-end against live DB**

```bash
# Preconditions: pnpm seed:profile, pnpm generate:test-plan, pnpm generate:test-week have all run
# (Phase A smoke already established the macro plan + week 0 detail.)

# Run the new CLI
cd /Users/arkadiy.smirnov/Documents/studying/eta/apps/api && pnpm adapt:current-week
# Expect: "Persisted adaptation <uuid>" near end. Pass 3 call may take 60-120s.

# Verify the row
docker exec eta-postgres psql -U eta -d eta_dev -c "SELECT id, for_week_start, generated_at FROM adaptation_suggestions ORDER BY generated_at DESC LIMIT 5;"

# Boot API and check the tree
cd /Users/arkadiy.smirnov/Documents/studying/eta/apps/api && STRAVA_ENABLED=false PORT=3099 pnpm dev > /tmp/api-task7-smoke.log 2>&1 &
sleep 8
curl -s http://localhost:3099/plans/me | jq '{macroPlanId, currentAdaptation: (.currentAdaptation != null), adjustmentCount: (.currentAdaptation.adjustments | length)}'
kill %1
wait 2>/dev/null
```

Expected: `currentAdaptation: true`, adjustment count matches what was persisted.

- [ ] **Step 2: No commit** (verification only)

---

## Spec coverage check

| Spec requirement | Task |
|---|---|
| `adaptation_suggestions` table (JSONB, FK + cascade, `for_week_start` denorm) | 1 |
| Drizzle migration | 1 |
| `AdaptationsRepository.create / findLatestForWeek` | 2 |
| `rowToWorkoutCompleted` converter + sentinel discipline codes | 3 |
| `findCanonicalForUserAndDateRange` | 3 |
| `Pass3GenerationService` persists; takes `macroPlanId`/`forWeekStart` | 4 |
| `dryRun` mode on Pass3Input for scenario CLI | 4 |
| `PlanTree.currentAdaptation` + `currentWeekStartDate` helper | 5 |
| `pnpm adapt:current-week` CLI | 6 |
| Manual smoke documented | 7 |
| Repo integration test (testcontainers) | 2 |
| Converter unit tests | 3 |
| Pass3Service persist test | 4 |
| PlansService currentAdaptation tests | 5 |

No gaps.
