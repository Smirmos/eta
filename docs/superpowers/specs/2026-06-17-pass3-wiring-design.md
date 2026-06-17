# Pass 3 DB Wiring — Design Spec

**Date:** 2026-06-17
**Status:** Autonomous-mode (no user review gate per directive)
**POC phase:** B (of A→B→C: persist → adapt → view)

## Problem

`Pass3GenerationService` exists, validated, with full hard-rules pre-pass + LLM call + postprocess. But it's only callable today via `pnpm generate:test-adaptation` against hardcoded synthetic scenarios. There's no path to run Pass 3 against the *real* data we now have:

- Macro plan in `macro_plans` (Phase A)
- Latest weekly detail per week in `weekly_details` (Phase A)
- Real completed Strava activities in `workouts_completed`
- Athlete profile in `athlete_profiles`

The output (an `AdaptationSuggestion`) is also not persisted — Pass 3 has nowhere to land its recommendations.

## Goal

Land the persistence layer for adaptation suggestions and a CLI that runs Pass 3 against DB-resident data:

1. New `adaptation_suggestions` table — append-only, FK to `macro_plans`, JSONB blob of the `AdaptationSuggestion` shape
2. New `AdaptationsRepository` — `create` + `findLatestForWeek(macroPlanId, forWeekStart)` + `findLatestForMacroPlan(macroPlanId)`
3. `Pass3GenerationService` modified to accept `macroPlanId` + persist after generation
4. New CLI `pnpm adapt:current-week` — picks the "upcoming week" from the macro plan based on today's date, fetches its WeeklyDetail + recent workouts from DB, runs Pass 3 with empty `readinessHistory`, persists
5. `PlansService.getLatestTreeForUser` extended to include `currentAdaptation: AdaptationSuggestion | null` — latest adaptation for the upcoming week of the latest macro plan, or null

Existing `pnpm generate:test-adaptation` CLI stays untouched (uses hardcoded scenarios for hard-rule branch coverage).

Non-goals (deferred):
- Real readiness ingest (Oura/HealthKit — that's a separate phase)
- Multi-week adaptation generation (`generate:test-adaptation-all-future-weeks` style)
- HTTP POST endpoint that triggers Pass 3 (LLM-triggering stays via CLI, matching Phase A)
- Cron/scheduler for automatic Pass 3 runs (A2 daily-replay caller — explicitly deferred per ETA-21)
- Seed daily TSS for accurate CTL/ATL bootstrap (start fresh — TSB will be approximate for v1)
- Frontend view of adaptations (Phase C: HTML render extension)
- Per-day readiness rules firing (Strava-only mode → empty readinessHistory → hard-rules engine produces zero firings, which is OK per existing decision memory)

## Frozen decisions

| Topic | Decision | Reason |
|---|---|---|
| Table shape | Single `adaptation_suggestions` table, JSONB blob, FK to `macro_plans` with `ON DELETE CASCADE`, append-only | Mirrors Phase A `weekly_details` |
| `forWeekStart` denorm column | Yes — ISO date stored as `date`, used to index lookups | Matches Phase A's `week_start_date` pattern on `weekly_details` |
| Latest-per-week query | `DISTINCT ON (for_week_start)` ordered by `generated_at DESC` (Postgres feature, same as `WeeklyDetailsRepository.findLatestForMacroPlan`) | Consistent with established pattern |
| Pass3Service persistence location | Inside the service, after successful postprocess + validation. Persist the returned `AdaptationSuggestion` only (the other `Pass3Output` fields like `computed`, `hardRulesApplied`, `appliedSources` are derivable + not load-bearing for read consumers) | YAGNI on persisting intermediate computation state |
| "Current week" definition | The macro plan week whose `weekStartDate <= today < weekStartDate + 7d`. If today is past the race date, return the last week. | Simple, deterministic, doesn't require config |
| `WorkoutCompleted` from DB | New helper `rowToWorkoutCompleted(row)` converts `WorkoutsCompletedRow` → canonical `WorkoutCompleted`. Rows without a `workoutCode` (all current Strava-ingested rows) use the row's `discipline` as the placeholder code (e.g., bike row → `'B/AE1'` as a sentinel general-bike code) | Pragmatic: Pass 3 uses workoutCode only for plan-match in postprocess; the placeholder gets discarded by postprocess since these aren't planned workouts. The sentinel is documented and limited to ingest-only rows |
| Empty readiness | `readinessHistory: []` passed unconditionally for v1 | Strava-only mode already verified at the Pass 3 service level (per ETA-25 decisions memory). Hard-rules engine produces zero firings; LLM gets `avgReadinessLast7d=50` neutral stub |
| Seed daily TSS | Omitted (`seedDailyTss` undefined). CTL/ATL start fresh at zero | YAGNI for v1. Real seed would require backfilling daily TSS aggregates — separate ticket |
| New CLI vs flip existing | NEW CLI `pnpm adapt:current-week`. `pnpm generate:test-adaptation` left untouched | The scenario CLI's hardcoded profiles + readiness histories exercise specific hard-rule branches; flipping it would lose coverage. Two CLIs serve two purposes |
| Extending PlanTree | Add `currentAdaptation: AdaptationSuggestion \| null` to `PlanTree`. Filled by `PlansService.getLatestTreeForUser` via a `findLatestForWeek(macroPlanId, currentWeekStart)` call | Single GET round-trip stays single-trip; clients see "here's my plan + latest adjustments for this week" in one shot |

## Architecture

```
apps/api/src/db/schema/
└── adaptation-suggestions.ts                 NEW

apps/api/drizzle/0003_*.sql                   NEW migration

apps/api/src/db/repositories/
├── adaptations.repository.ts                 NEW
└── adaptations.repository.test.ts            NEW

apps/api/src/db/repositories/
└── workouts-completed.repository.ts          MODIFIED: add findCanonicalForUserAndDateRange
                                              (returns canonical WorkoutCompleted[])

apps/api/src/modules/plan-generation/
├── pass3/pass3.service.ts                    MODIFIED: take macroPlanId in input, persist
├── pass3/pass3.service.test.ts               MODIFIED: add persist assertion
├── pass3/types.ts                            MODIFIED: Pass3Input gains macroPlanId
└── plan-generation.module.ts                 MODIFIED: register AdaptationsRepository + Pass3 factory

apps/api/src/modules/plans/
└── plans.service.ts                          MODIFIED: PlanTree.currentAdaptation + lookup
└── plans.service.test.ts                     MODIFIED: assert currentAdaptation populated

apps/api/scripts/
└── adapt-current-week.ts                     NEW CLI

apps/api/package.json                         MODIFIED: add `adapt:current-week` script
```

## Components

### `adaptation_suggestions` table

```ts
pgTable('adaptation_suggestions', {
  id: uuid().primaryKey().defaultRandom(),
  macroPlanId: uuid()
    .notNull()
    .references(() => macroPlans.id, { onDelete: 'cascade' }),
  forWeekStart: date('for_week_start').notNull(),    // upcoming week's Monday ISO date
  data: jsonb().$type<AdaptationSuggestion>().notNull(),
  generatedAt: timestamptz().notNull().defaultNow(),
}, t => ({
  macroForWeekIdx: index('adaptation_suggestions_macro_week_idx')
    .on(t.macroPlanId, t.forWeekStart),
}));
```

No `updatedAt` needed (append-only, no UPDATE path exposed).

### `AdaptationsRepository`

```ts
interface AdaptationRecord {
  id: string;
  macroPlanId: string;
  forWeekStart: string;
  suggestion: AdaptationSuggestion;
  generatedAt: Date;
}

class AdaptationsRepository {
  async create(input: { macroPlanId: string; forWeekStart: string; suggestion: AdaptationSuggestion }): Promise<AdaptationRecord>;
  async findLatestForWeek(macroPlanId: string, forWeekStart: string): Promise<AdaptationRecord | null>;
}
```

Both use `adaptationSuggestionSchema` (existing, exported from `@eta/shared-types/plan.schema`) for JSONB roundtrip parsing.

### `WorkoutsCompletedRepository.findCanonicalForUserAndDateRange`

New method:

```ts
async findCanonicalForUserAndDateRange(
  userId: string,
  fromDate: string,  // ISO date inclusive
  toDate: string,    // ISO date exclusive
): Promise<WorkoutCompleted[]>;
```

Implementation: query `workouts_completed` rows in range, convert each via `rowToWorkoutCompleted(row)`. The converter:

```ts
function rowToWorkoutCompleted(row: WorkoutsCompletedRow): WorkoutCompleted {
  return {
    date: row.date,
    workoutCode: row.workoutCode ?? sentinelCodeForDiscipline(row.discipline),
    actualTss: row.actualTss !== null ? Number(row.actualTss) : undefined,
    tssStatus: row.tssStatus as TssStatus | undefined,
    perceivedExertion: row.perceivedExertion ?? undefined,
    notes: row.notes ?? undefined,
    discipline: row.discipline,
    actualDurationSeconds: row.actualDurationSeconds ?? undefined,
  };
}

function sentinelCodeForDiscipline(d: Discipline): WorkoutCode {
  if (d === 'bike') return 'B/AE1';
  if (d === 'run')  return 'C/AE1';
  return 'D/AE1';  // swim
}
```

The sentinel is documented: Strava ingest rows don't carry a workout code; the placeholder lets the canonical type's strict typing hold without changing the schema. Postprocess discards these as non-plan-matches anyway.

### `Pass3GenerationService` modifications

- Constructor gains `private readonly adaptationsRepo: AdaptationsRepository`
- `Pass3Input` gains `macroPlanId: string` and `forWeekStart: string` fields (the latter denormalised from `weeklyDraft.weekStartDate` to be explicit)
- After successful `validatePass3Suggestion`, persist:
  ```ts
  const record = await this.adaptationsRepo.create({
    macroPlanId: input.macroPlanId,
    forWeekStart: input.forWeekStart,
    suggestion: validated,
  });
  ```
- `GenerateAdaptationResult` gains `adaptationId: string`

### `PlansService.getLatestTreeForUser` — extended

`PlanTree` gains a top-level field:

```ts
interface PlanTree {
  // ... existing ...
  currentAdaptation: AdaptationSuggestion | null;
}
```

Populated by:
1. Find the "current week" from `record.plan.weeks` via a small helper `currentWeekStartDate(plan, today)`:
   - Walk `weeks[]` in order
   - Return the first week whose `weekStartDate <= today < weekStartDate + 7d`
   - If past race, return the last week's `weekStartDate`
2. `adaptationsRepo.findLatestForWeek(macroPlanId, currentWeekStart)` → `AdaptationRecord | null`
3. Map `record?.suggestion ?? null` onto `currentAdaptation`

`getTreeById` does the same.

### `adapt-current-week.ts` CLI

```
pnpm adapt:current-week                      # default user
pnpm adapt:current-week -- --user=<uuid>
pnpm adapt:current-week -- --week-start=YYYY-MM-DD  # override which upcoming week
```

Flow:
1. Bootstrap Nest
2. Resolve `userId` from `--user=` or config
3. Fetch latest macro plan: `MacroPlansRepository.findLatestForUser(userId)` — null → error
4. Resolve target week: explicit `--week-start=` or computed via `currentWeekStartDate(plan, today)`
5. Find the macro week object (`plan.weeks.find(w => w.weekStartDate === targetWeekStart)`) — null → error
6. Fetch the latest `WeeklyDetail` for that week from `weeklyDetailsRepo.findLatestForMacroPlan` — `Map.get(weekNumber)` returns null if Pass 2 hasn't run for the target week → error
7. Fetch recent workouts: `workoutsRepo.findCanonicalForUserAndDateRange(userId, weekStartMinus7d, weekStart)` (the 7 days immediately preceding the upcoming week)
8. Fetch athlete profile: `athleteProfileRepo.findLatestRecordForUser(userId)` — null → error
9. Call `pass3Service.generateAdaptation({ macroPlanId, forWeekStart: targetWeekStart, weeklyDraft, completedLastWeek, readinessHistory: [], athleteProfile })`
10. Print the adaptation id + summary, exit cleanly

## Data flow

### CLI flow

```
pnpm adapt:current-week
  ↓
Bootstrap Nest
  ↓
Resolve userId, fetch macro plan
  ↓
Compute current-week start date (today-based, or explicit override)
  ↓
Fetch latest WeeklyDetail for that week
  ↓
Fetch canonical WorkoutCompleted[] for (weekStart - 7d, weekStart)
  ↓
Fetch athlete profile record
  ↓
pass3Service.generateAdaptation({
  macroPlanId, forWeekStart,
  weeklyDraft, completedLastWeek, readinessHistory: [],
  athleteProfile, seedDailyTss: undefined,
})
  ├── LLM call + postprocess + validation
  └── adaptationsRepo.create({ macroPlanId, forWeekStart, suggestion })
  ↓
Return { suggestion, computed, hardRulesApplied, ..., adaptationId }
  ↓
CLI prints adaptationId + summary, exit(0)
```

### HTTP read flow (already wired in Phase A — just extended)

```
GET /plans/me
  ↓
service.getLatestTreeForUser(userId)
  ├── macroPlansRepo.findLatestForUser  → macroRecord
  ├── weeklyDetailsRepo.findLatestForMacroPlan  → Map<weekNumber, WeeklyDetail>
  ├── compute currentWeekStartDate(plan, today)  → ISO date
  ├── adaptationsRepo.findLatestForWeek(macroPlanId, currentWeekStartDate)
  │     → AdaptationRecord | null
  └── zip into PlanTree { ..., currentAdaptation: record?.suggestion ?? null }
  ↓
200 PlanTree
```

### Idempotency

- Re-running `adapt:current-week` for the same week → new `adaptation_suggestions` row
- `GET /plans/me` always returns the latest adaptation per week (via `findLatestForWeek`)
- `WeeklyDetail` regeneration (Phase A) doesn't affect adaptations — they're keyed on `(macroPlanId, forWeekStart)`, agnostic to which WeeklyDetail version drove the suggestion

## Error handling

### HTTP

GET behavior unchanged from Phase A. The new `currentAdaptation` field is optional — null when no adaptation exists or when the macro plan has no current week (e.g., race already happened).

### CLI

| Failure | Behavior |
|---|---|
| No macro plan in DB | error: "Run `pnpm generate:test-plan` first", exit(1) |
| No WeeklyDetail for the target week | error: "Run `pnpm generate:test-week -- --week-index=<N>` first", exit(1) |
| `--week-start=` provided but not in macro plan | clear error, exit(1) |
| No athlete profile | error: "Run `pnpm seed:profile` first", exit(1) |
| Pass3GenerationError | propagated (raw response dumped to scripts/output/, exit codes 1/2 same as existing Pass 3 CLI) |
| Persist fails after successful LLM | bubble up, exit(1). LLM output preserved in `scripts/output/` (file output runs BEFORE persistence) |

### Pass3Service

Existing error handling unchanged. The persist call goes at the end; failure throws.

### Logging

Same Nest `Logger` convention:
- `log`: "Persisted adaptation `<id>` for macroPlan `<macroPlanId>` week starting `<forWeekStart>`"
- `error`: persist failure
- `warn`: row→canonical conversion encountered ambiguous data

## Testing

### Repository tests (testcontainers — real Postgres)

| File | Coverage |
|---|---|
| `adaptations.repository.test.ts` | create round-trips through JSONB; findLatestForWeek returns latest (multiple inserts for same week); returns null for unseen week; cascade delete from macro_plans removes children; FK rejects insert with bogus macroPlanId |

### Service tests

| File | Coverage |
|---|---|
| `pass3.service.test.ts` (modified) | Add "persists the adaptation after successful generation" — mock `adaptationsRepo.create`, assert call args + result includes `adaptationId` |
| `plans.service.test.ts` (modified) | Add "currentAdaptation populated when adaptation exists for current week"; "currentAdaptation null when none exists"; "currentAdaptation uses computed currentWeekStartDate based on today" (mock Date with vi.setSystemTime) |

### Repository converter test (light unit)

| File | Coverage |
|---|---|
| `workouts-completed.repository.test.ts` (new — file doesn't exist yet, OK to create) | rowToWorkoutCompleted converter — bike row with all fields populated; row with null workoutCode → sentinel based on discipline; row with null actualTss → undefined |

These can be unit tests against the converter function (export it from the repo file). No DB needed for the converter itself.

### Manual smoke

| Step | Expected |
|---|---|
| `pnpm seed:profile` (existing, idempotent) | Profile + 36 computed Strava rows |
| `pnpm generate:test-plan` (Phase A) | Macro plan exists for user |
| `pnpm generate:test-week -- --week-index=0` (Phase A) | WeeklyDetail for week 14 exists |
| `pnpm adapt:current-week` | Prints "Persisted adaptation `<uuid>`", runs Pass 3 against real DB data |
| `curl /plans/me` | Returns PlanTree with `currentAdaptation` populated (not null) |
| `psql -c "SELECT id, for_week_start FROM adaptation_suggestions ORDER BY generated_at DESC;"` | One row visible |

### Not tested

- No HTTP-level e2e
- No CLI script tests (convention)

## Migration

Drizzle generates `0003_*.sql` for the new table + indexes + FK. Apply via `pnpm db:migrate`.

## Out of scope (revisit later)

- Real readiness ingest (Oura, HealthKit) — readiness rules currently dormant
- Multi-week-ahead adaptation generation
- POST endpoint for HTTP-triggered Pass 3
- Cron / scheduler / daily-replay
- CTL/ATL seed from historical daily TSS aggregates
- Adaptation application — i.e., editing the WeeklyDetail to reflect accepted suggestions (Phase C may surface this; not in B)
