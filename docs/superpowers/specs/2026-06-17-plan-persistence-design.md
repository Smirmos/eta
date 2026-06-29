# Plan Persistence — Design Spec

**Date:** 2026-06-17
**Status:** Draft (autonomous-mode: skipping user review per directive)
**POC phase:** A (of A→B→C: persist → adapt → view)

## Problem

Pass 1 (MacroPlan) and Pass 2 (WeeklyDetail) generation pipelines exist as services with LLM calls and validated output, but **nothing persists**. Plans land in stdout / `apps/api/scripts/output/*.json`. Without persistence:

- Pass 3 (adaptation, Phase B) has no plan to adapt — it needs to read the current macro plan + weekly details from somewhere
- The frontend / read-only HTML view (Phase C) has no source of truth
- "The plan I'm following" is a file on someone's laptop, not a queryable state

## Goal

Persist generated MacroPlans and WeeklyDetails to Postgres; expose read-only HTTP GETs to retrieve the latest tree or a specific version; modify the existing generation CLIs (`generate:test-plan`, `generate:test-week`) to persist as a side effect of generation. After this lands:

1. `pnpm generate:test-plan` produces a macro plan and persists it; prints the new `macroPlanId` alongside the existing file output
2. `pnpm generate:test-week` defaults to the latest macro plan for `DEV_USER_ID`, generates Pass 2 for the requested week, persists it; `--plan-id=<uuid>` overrides
3. `GET /plans/me` returns a nested `PlanTree` (macro plan + latest weekly detail per week, or `null` for un-generated weeks)
4. `GET /plans/:id` returns the tree for a specific macro plan version

Non-goals (deferred):

- Pass 3 (adaptation) persistence — Phase B
- HTML rendering of the tree from DB (`render-plan.ts` flip) — Phase C
- HTTP POST endpoints that trigger LLM generation — explicit choice; LLM-triggering stays via CLI (slow + costly fits CLI semantics)
- Plan editing endpoints
- Workouts-vs-plan join queries

## Decisions (frozen)

| Topic | Decision | Reason |
|---|---|---|
| Storage shape | Two tables: `macro_plans` + `weekly_details`. JSONB blob columns store the full TS types. FK from `weekly_details.macro_plan_id` to `macro_plans.id` with `ON DELETE CASCADE` | Mirrors `athlete_profiles` precedent (JSONB-as-canonical, denormed scalar columns for filtering). 1:1 with TS types. FK enforces invariant |
| Versioning | Append-only for both tables. Latest by `generated_at DESC`. No `UNIQUE` constraint on `(macro_plan_id, week_number)` so multiple versions per week are first-class | Matches `athlete_profiles`. Re-generating a week creates a new row; `findLatestForMacroPlan` returns the latest per week via `DISTINCT ON` |
| HTTP shape | Read-only GETs only: `GET /plans/me` and `GET /plans/:id`. No POST | LLM-triggering through HTTP risks accidental $5+ calls from curl. CLIs are the trigger; future Phase B may add a POST for the on-demand "generate next week" flow |
| CLI side-effects | Persistence is additive. The existing stdout output + `scripts/output/*.json` file write both continue | Reversible — easy to remove later if redundant. Useful for diffing LLM output across runs. File-output runs BEFORE persistence so LLM result is preserved even if DB write fails |
| Persistence location | Inside the generation services (`PlanGenerationService.generateMacroPlan`, `Pass2GenerationService.generateWeeklyDetail`), not in CLI scripts | Future POST endpoints (Phase B) reuse the same service code path |
| Fixture-vs-DB profile path | When `generate-test-plan` runs with `--profile=<path>`, auto-seed the JSON profile into `athlete_profiles` and use its new id as the FK | Keeps FK invariant clean. The "fixture override" semantic becomes "seed-and-use" |

## Architecture

```
apps/api/src/db/schema/
├── macro-plans.ts                          NEW
└── weekly-details.ts                       NEW

apps/api/src/db/repositories/
├── macro-plans.repository.ts               NEW
└── weekly-details.repository.ts            NEW

apps/api/src/modules/plans/                 NEW unconditional module
├── plans.module.ts
├── plans.controller.ts                     GET /plans/me, GET /plans/:id
├── plans.service.ts                        getLatestTreeForUser, getTreeById
├── plans.controller.test.ts                NEW
└── plans.service.test.ts                   NEW

apps/api/src/modules/plan-generation/
├── plan-generation.service.ts              MODIFIED (persist after Pass 1)
└── pass2/pass2.service.ts                  MODIFIED (persist after Pass 2)

apps/api/scripts/
├── generate-test-plan.ts                   MODIFIED (resolve athleteProfileId, persist, print id)
└── generate-test-week.ts                   MODIFIED (--plan-id flag, persist, print id)

apps/api/drizzle/0002_<name>.sql            NEW Drizzle migration
```

`PlansModule` registers in `AppModule.imports` unconditionally, before `optionalStravaModule()`. Pattern matches `AthleteProfileModule`.

`PlanGenerationModule` gains injection of `MacroPlansRepository` (provider already on `PlansModule`; needs adding to `PlanGenerationModule.providers` directly to avoid circular imports — same convention as `AthleteProfileRepository` registered in `StravaModule`).

## Components

### `macro_plans` table

```ts
pgTable('macro_plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull(),                    // non-FK stand-in
  athleteProfileId: uuid('athlete_profile_id')
    .notNull()
    .references(() => athleteProfiles.id, { onDelete: 'restrict' }),
  raceDate: date('race_date').notNull(),                // denorm from data.raceDate
  data: jsonb('data').$type<MacroPlan>().notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true })
    .notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  userIdIdx: index('macro_plans_user_id_idx').on(t.userId),
  athleteProfileIdx: index('macro_plans_athlete_profile_idx').on(t.athleteProfileId),
}));
```

`ON DELETE RESTRICT` on the athlete-profile FK — don't allow deleting a profile if plans still reference it.

### `weekly_details` table

```ts
pgTable('weekly_details', {
  id: uuid('id').primaryKey().defaultRandom(),
  macroPlanId: uuid('macro_plan_id')
    .notNull()
    .references(() => macroPlans.id, { onDelete: 'cascade' }),
  weekNumber: integer('week_number').notNull(),
  weekStartDate: date('week_start_date').notNull(),
  data: jsonb('data').$type<WeeklyDetail>().notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true })
    .notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull().defaultNow().$onUpdate(() => new Date()),
}, (t) => ({
  macroPlanWeekIdx: index('weekly_details_macro_plan_week_idx')
    .on(t.macroPlanId, t.weekNumber),
}));
```

`ON DELETE CASCADE` — deleting a macro plan cleans up its weekly details. No `UNIQUE` — multiple versions per (plan, week) is the model.

### `MacroPlansRepository`

```ts
export interface MacroPlanRecord {
  id: string;
  userId: string;
  athleteProfileId: string;
  plan: MacroPlan;
  generatedAt: Date;
  updatedAt: Date;
}

class MacroPlansRepository {
  async create(input: {
    userId: string;
    athleteProfileId: string;
    plan: MacroPlan;
  }): Promise<MacroPlanRecord>;

  async findById(id: string): Promise<MacroPlanRecord | null>;

  async findLatestForUser(userId: string): Promise<MacroPlanRecord | null>;
}
```

Uses `planSchema.parse(row.data)` (from `@eta/shared-types/plan.schema`) on the JSONB roundtrip. Throws `Error` with `(table, id)` locator on parse failure.

### `WeeklyDetailsRepository`

```ts
export interface WeeklyDetailRecord {
  id: string;
  macroPlanId: string;
  weekNumber: number;
  detail: WeeklyDetail;
  generatedAt: Date;
}

class WeeklyDetailsRepository {
  async create(input: {
    macroPlanId: string;
    detail: WeeklyDetail;
  }): Promise<WeeklyDetailRecord>;

  /** Returns latest WeeklyDetail per weekNumber for the given macro plan. */
  async findLatestForMacroPlan(macroPlanId: string): Promise<Map<number, WeeklyDetail>>;
}
```

Implementation of `findLatestForMacroPlan` uses Drizzle's raw SQL escape hatch for `DISTINCT ON`:

```ts
const rows = await this.db.execute(sql`
  SELECT DISTINCT ON (week_number) id, week_number, data, generated_at
  FROM weekly_details
  WHERE macro_plan_id = ${macroPlanId}
  ORDER BY week_number, generated_at DESC
`);
```

Each row's `data` is parsed via `weeklyDetailSchema` (from `@eta/shared-types/plan.schema`) and inserted into the Map keyed by `weekNumber`.

### `PlansService`

```ts
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

class PlansService {
  async getLatestTreeForUser(userId: string): Promise<PlanTree | null>;
  async getTreeById(id: string): Promise<PlanTree | null>;
}
```

`getLatestTreeForUser`:
1. `macroPlansRepo.findLatestForUser(userId)` — null short-circuit
2. `weeklyDetailsRepo.findLatestForMacroPlan(record.id)` — gets the Map
3. Zip: walk `record.plan.weeks`, look up each by `weekNumber`, build `PlanTreeWeek[]`

### `PlansController`

```
GET /plans/me        → 200 PlanTree | 404 { error: 'no_plan_for_user', userId }
GET /plans/:id       → 200 PlanTree | 404 { error: 'plan_not_found', id }
                     → 400 { error: 'invalid_id', id }  // when :id isn't uuid-shaped
```

`getCurrentUserId()` same as the AthleteProfileController.

### Generation-side modifications

**`PlanGenerationService.generateMacroPlan`** — new dependency: `MacroPlansRepository`. After the existing LLM call + postprocess + schema validation, calls `macroPlansRepo.create({ userId, athleteProfileId: input.athleteProfileId, plan })`. The input type already has `athleteProfileId`; the service now also needs `userId` (add to `GenerateMacroPlanInput`). Return type extended with `macroPlanId: string`.

**`Pass2GenerationService.generateWeeklyDetail`** — new dependency: `WeeklyDetailsRepository`. Input gains `macroPlanId: string`. After generation, calls `weeklyDetailsRepo.create({ macroPlanId, detail })`. Return type gains `weeklyDetailId: string`.

### CLI modifications

**`generate-test-plan.ts`** — flow:
1. Bootstrap Nest (existing)
2. Resolve athlete profile via `loadProfile`. If `--profile=<path>` → also call `athleteProfileService.create({ userId, profile })` to seed, capture the new record's `id`. If DB-default → use the record's existing id.
3. Call `PlanGenerationService.generateMacroPlan({ athleteProfile, athleteProfileId, userId, … })`
4. The service persists internally
5. Print the `macroPlanId` returned by the service, alongside existing JSON-to-stdout + file output

**`generate-test-week.ts`** — flow:
1. Parse `--plan-id=<uuid>` (optional)
2. Resolve macroPlanId: if flag → use it (validate it exists with `repo.findById`); otherwise → `repo.findLatestForUser(DEV_USER_ID)`, error if null
3. Fetch the macro plan + the athlete profile (same loadProfile resolution as before)
4. Call `Pass2GenerationService.generateWeeklyDetail({ macroPlanId, macroPlan, athleteProfile, weekIndex, … })`
5. Print `weeklyDetailId` + existing outputs

## Data flow

### POST nothing — generation is via CLI. The HTTP read flow:

```
GET /plans/me
  → controller getCurrentUserId() = DEV_USER_ID
  → service.getLatestTreeForUser(userId)
    → macroPlansRepo.findLatestForUser(userId)        — null → 404
    → weeklyDetailsRepo.findLatestForMacroPlan(macroId) → Map<weekNumber, WeeklyDetail>
    → zip into PlanTree
  → 200 PlanTree
```

### CLI flow A — `pnpm generate:test-plan`

```
Bootstrap Nest
loadProfile({fromPath?, fromDb})
if --profile and DB-default-not-used:
  record = service.create({userId, profile})        — seed
  athleteProfileId = record.id
else:
  athleteProfileId = (loaded record id)
PlanGenerationService.generateMacroPlan({
  athleteProfileId, athleteProfile, userId, …
})
  ├── LLM call + postprocess
  ├── write file to scripts/output/ (existing)
  └── macroPlansRepo.create({userId, athleteProfileId, plan})
returns { plan, macroPlanId, warnings }
CLI: console.log(`Persisted macro plan ${macroPlanId}`)
app.close(); exit(0)
```

### CLI flow B — `pnpm generate:test-week`

```
Bootstrap Nest
parse --plan-id, --week-index, --profile
resolve macroPlanId:
  if --plan-id: macroPlansRepo.findById; error if null
  else: macroPlansRepo.findLatestForUser; error if null
load athlete profile (same loadProfile)
Pass2GenerationService.generateWeeklyDetail({
  macroPlanId, macroPlan, athleteProfile, weekIndex, …
})
  ├── LLM call + postprocess
  ├── write file to scripts/output/
  └── weeklyDetailsRepo.create({macroPlanId, detail})
returns { detail, weeklyDetailId, warnings }
CLI: console.log(`Persisted weekly detail ${weeklyDetailId}`)
app.close(); exit(0)
```

### Idempotency

- Repeated `generate-test-plan` → new macro_plan row. `findLatestForUser` returns newest.
- Repeated `generate-test-week` for same week → new `weekly_details` row. `findLatestForMacroPlan` returns latest per week.
- `GET /plans/me` always returns the latest macro plan + latest-per-week tree.

## Error handling

### HTTP

| Failure | Status | Body |
|---|---|---|
| `GET /plans/me` and no macro plan | 404 | `{ error: 'no_plan_for_user', userId }` |
| `GET /plans/:id` no match | 404 | `{ error: 'plan_not_found', id }` |
| `GET /plans/:id` non-uuid | 400 | `{ error: 'invalid_id', id }` |
| `planSchema.parse(row.data)` rejects (data drift after schema change) | 500 | `{ error: 'internal' }`; log `(table, id)` |
| DB connection error | 500 | `{ error: 'internal' }` |

### Generation services

LLM/postprocess errors: existing handling (throw). New persistence failure: bubble up to caller. File output runs **before** persistence so the LLM result is recoverable from disk if the persist write fails.

### CLI

| Failure | Behavior |
|---|---|
| `--plan-id=<uuid>` doesn't exist | clear error, `exit(1)` |
| No `--plan-id`, no macro plan in DB | error referencing `pnpm generate:test-plan`, `exit(1)` |
| Persist fails after successful LLM | LLM output preserved in `scripts/output/`, error printed, `exit(1)` |

### Logging

Standard Nest `Logger`:
- `log`: "Persisted macro plan `<id>` for user `<userId>`"; "Persisted weekly detail `<id>` for macroPlan `<macroPlanId>` week `<n>`"
- `warn`: weekly detail's `weekNumber` doesn't match any week in the parent macro plan (non-fatal, surface in case of data drift)
- `error`: JSONB roundtrip parse failure, DB write failure

### Explicitly not added

- No retry logic on persist
- No append-only enforcement (convention via API surface — no UPDATE method exposed)
- No transactional wrapper around macro plan + first weekly detail (separate CLI calls, separate atomic ops)
- No DELETE endpoint

## Testing

### Repository tests (testcontainers — real Postgres)

| File | Coverage |
|---|---|
| `macro-plans.repository.test.ts` | create round-trips through JSONB (dates coerced via `planSchema`); findById returns parsed `MacroPlan`; findLatestForUser returns latest by generatedAt DESC; multiple rows for same user — newest wins |
| `weekly-details.repository.test.ts` | create round-trips; FK on `macro_plan_id` enforced (bogus parent id → throws); findLatestForMacroPlan returns Map keyed by weekNumber, latest version per week; empty Map when no rows; cascade-on-delete of parent removes the child rows |

### Service test (unit, mocked repos)

| File | Coverage |
|---|---|
| `plans.service.test.ts` | getLatestTreeForUser returns null when no macro plan; otherwise returns PlanTree with weeks zipped from macro + map; null weeklyDetail for un-generated weeks; getTreeById likewise |

### Controller test (unit, mocked service)

| File | Coverage |
|---|---|
| `plans.controller.test.ts` | GET /me returns tree or 404; GET /:id returns tree or 404; invalid uuid → 400; userId via `getCurrentUserId` |

### Generation-service test additions

| File | Add test |
|---|---|
| `plan-generation.service.test.ts` | "persists the macro plan after successful generation" — mock `macroPlansRepo.create`, assert call args + return shape includes `macroPlanId` |
| `pass2.service.test.ts` | "persists the weekly detail after successful generation" — mock `weeklyDetailsRepo.create`, assert call args + return shape includes `weeklyDetailId` |

### Manual smoke

| Step | Expected |
|---|---|
| `pnpm seed:profile` | (existing precondition) |
| `pnpm generate:test-plan` | Prints `Persisted macro plan <uuid>`; row in `macro_plans` |
| `pnpm generate:test-week -- --week-index=0` | Prints `Persisted weekly detail <uuid> for week 1`; row in `weekly_details` |
| `curl /plans/me` | 200 with full PlanTree, week 1 populated, others `null` |
| Re-run `generate:test-week --week-index=0` | New `weekly_details` row; `/plans/me` shows the newer version for week 1 |
| `curl /plans/<old-macro-plan-id>` | Specific older version still reachable |

### Not tested

- No HTTP-level e2e (supertest). Pattern matches AthleteProfile path.
- No tests on modified CLI scripts.

## Migration

New Drizzle migration `apps/api/drizzle/0002_<name>.sql` added via `pnpm db:generate` after the schema files land.

Migration adds the two tables + indexes + FK constraints. No data migration needed.

## Out of scope (revisit later)

- Pass 3 adaptation persistence — Phase B (next)
- HTML rendering from DB — Phase C
- POST endpoints that trigger LLM
- Cross-plan queries (e.g., "all my historical race-week plans")
- Pagination of historical versions
