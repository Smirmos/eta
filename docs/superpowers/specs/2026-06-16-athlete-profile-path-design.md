# AthleteProfile Path — Design Spec

**Date:** 2026-06-16
**Status:** Draft (awaiting user review)
**Closes:** ETA-25 follow-up #2 ("TSS pending_inference for all 88 rows because no AthleteProfile exists for DEV_USER_ID")

## Problem

The `athlete_profiles` table, `AthleteProfileRepository`, and the `AthleteProfile` Zod schema all exist, but there is no path to put a profile *into* the DB. As a result:

- All 89 Strava activities backfilled for `DEV_USER_ID` sit at `tss_status='pending_inference'` because `normalizeStravaActivity()` receives `athleteProfile=null` and returns `tss=null`.
- The Pass 1/2/3 + render CLIs all read `apps/api/scripts/test-profile.json` directly from disk. The persistence layer is unused by the generation pipeline.
- The "real prototype" shape — *user fills a profile, system uses it everywhere* — has no entry point.

## Goal

Add the HTTP + CLI entry points so an `AthleteProfile` can be persisted and consumed end-to-end. After this lands:

1. `pnpm seed:profile` seeds `DEV_USER_ID`'s profile from `test-profile.json` into the DB.
2. `POST /athlete-profiles` accepts a profile body and stores it. Auto-renormalises existing `pending_inference` rows for that user in the background.
3. `GET /athlete-profiles/me` returns the latest profile.
4. The Pass 1/2/3 + render CLIs default to DB lookup for the current user; `--profile=<path>` still overrides with a JSON fixture.
5. The bike-with-power subset of the 89 Strava rows flips from `pending_inference` → `computed` with valid `actual_tss`.

Non-goals (deferred):

- Run + swim TSS computation (ETA-25 follow-up #3 — separate ticket).
- Users table + auth (`DEV_USER_ID` env var continues to stand in).
- A profile-editing UI.
- Profile inference from Strava history (Pass 0).
- Multi-source dispatch beyond Strava (Luna/ETA-27 lands separately).

## Decisions (frozen)

These were settled during brainstorming. Any change requires re-opening the spec.

| Topic | Decision | Reason |
|---|---|---|
| Versioning | Append-only — every save creates a new row, `findByUserId` returns latest | Matches the existing repo shape (`findByUserId` already does `ORDER BY generated_at DESC LIMIT 1`); no `update()` method needed; preserves history of how the profile drifted |
| Renormalisation strategy | In-place, from stored `raw` JSONB | No Strava API call, no rate-limit cost, fast (~1s for 89 rows) |
| Auto-renormalise on POST | Yes, fire-and-forget via `setImmediate` | Single user action, no extra step to remember; failure logged, not surfaced |
| CLI source | Default to DB lookup for `DEV_USER_ID`; `--profile=<path>` overrides with JSON | Preserves ad-hoc fixture switching (e.g., `test-profile-5day.json`) for dev |
| Seed flow | `pnpm seed:profile` CLI reads `test-profile.json` and inserts via the repo | Same pattern as `strava:backfill`; one-shot; re-usable after schema changes |
| Renormalise service location | File at `modules/integrations/strava/strava-renormalize.service.ts`; Nest provider registered on `AthleteProfileModule` | Source-specific code colocated with the source; provider registered on the unconditional module so it works regardless of `STRAVA_ENABLED` |
| HTTP endpoint shape | `POST /athlete-profiles`, `GET /athlete-profiles/me` | `userId` resolved server-side from `DEV_USER_ID` (single point to change when auth lands); resource-oriented |

## Architecture

```
apps/api/src/modules/
├── athlete-profile/                       ← NEW module, UNCONDITIONAL
│   ├── athlete-profile.module.ts
│   ├── athlete-profile.controller.ts      POST + GET /me
│   ├── athlete-profile.service.ts         orchestrates create + dispatch renormalise
│   ├── athlete-profile.dto.ts             request body type (re-exports athleteProfileSchema)
│   ├── athlete-profile.service.test.ts
│   └── athlete-profile.controller.test.ts
├── integrations/strava/
│   ├── strava-renormalize.service.ts      ← NEW (file lives here)
│   ├── strava-renormalize.service.test.ts ← NEW (unit + integration with testcontainers)
│   └── (existing files unchanged)
└── (everything else unchanged)

apps/api/src/db/repositories/
└── workouts-completed.repository.ts       ← MODIFIED: add findPendingByUserAndSource()

apps/api/scripts/
├── seed-profile.ts                        ← NEW (`pnpm seed:profile`)
├── lib/
│   └── load-profile.ts                    ← NEW (shared CLI helper)
├── generate-test-plan.ts                  ← MODIFIED (default DB, --profile overrides)
├── generate-test-week.ts                  ← MODIFIED (same)
├── generate-test-adaptation.ts            ← MODIFIED (same)
└── render-plan.ts                         ← MODIFIED (same)

apps/api/package.json                      ← MODIFIED: add `seed:profile` script
```

### Module wiring wrinkle

`StravaModule` is conditional on `STRAVA_ENABLED`. `AthleteProfileModule` must be unconditional because the CLI scripts need profile access regardless of Strava being enabled.

Resolution: the file `strava-renormalize.service.ts` lives in the Strava directory (source-specific code colocated with its normaliser), but the Nest **provider** is registered on `AthleteProfileModule`. The service has no env-var dependencies — it imports the pure `normalizeStravaActivity` function and uses the repos. When `STRAVA_ENABLED=false`, it finds zero `source='strava'` rows and returns `{considered:0,...}`.

`AthleteProfileRepository` and `WorkoutsCompletedRepository` end up registered on both `AthleteProfileModule` and `StravaModule`. Same convention used today (the Strava module already registers `AthleteProfileRepository` as a provider directly). Two stateless wrapper instances is benign.

## Components

### `AthleteProfileController`

```
POST /athlete-profiles       body: AthleteProfile                  → 201 { id, userId, generatedAt, updatedAt }
GET  /athlete-profiles/me                                          → 200 AthleteProfile | 404 { error: 'no_profile_for_user', userId }
```

- `userId` is resolved server-side via `getCurrentUserId()`, which in v1 returns `config.DEV_USER_ID`. When real auth lands, this becomes the single place to swap to the request principal.
- Body is validated with the existing `athleteProfileSchema`. Failures → 400 with `{ error: 'invalid_profile', issues: ZodIssue[] }`.

### `AthleteProfileService`

```ts
class AthleteProfileService {
  constructor(
    private readonly repo: AthleteProfileRepository,
    private readonly renormalize: StravaRenormalizeService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async create(input: { userId: string; profile: AthleteProfile }): Promise<AthleteProfileRecord>;
  async getLatestFor(userId: string): Promise<AthleteProfile | null>;
}
```

`create()` calls `repo.create()`, then `setImmediate(() => this.renormalize.run(userId).catch(err => logger.error(err)))`. Returns the new record immediately. The fire-and-forget renormalise is independent of the HTTP response.

`getLatestFor()` is a thin pass-through to `repo.findByUserId()`.

### `StravaRenormalizeService`

```ts
interface RenormalizeResult {
  userId: string;
  considered: number;   // pending_inference rows scanned
  recomputed: number;   // upgraded to computed
  stillPending: number; // still pending (e.g., swim/run — TSS path not implemented)
  failed: number;       // per-row failures
}

class StravaRenormalizeService {
  constructor(
    private readonly workoutsRepo: WorkoutsCompletedRepository,
    private readonly profilesRepo: AthleteProfileRepository,
  ) {}

  async run(userId: string): Promise<RenormalizeResult>;
}
```

Algorithm:

1. `profile = profilesRepo.findByUserId(userId)`. If `null` → log `warn`, return `{considered:0, recomputed:0, stillPending:0, failed:0}`.
2. `rows = workoutsRepo.findPendingByUserAndSource(userId, 'strava')`.
3. For each row: parse `raw` JSONB as `StravaActivity`, call `normalizeStravaActivity({userId, activity, athleteProfile: profile})`.
   - If `tssStatus === 'computed'` → upsert, `recomputed += 1`.
   - Else → `stillPending += 1` (swim/run; or bike with no power data).
   - Per-row try/catch — failures `failed += 1`, log warn with `(source, externalId)`, continue.
4. Log + return summary.

### `WorkoutsCompletedRepository.findPendingByUserAndSource`

```ts
async findPendingByUserAndSource(userId: string, source: WorkoutSource): Promise<WorkoutsCompletedRow[]>
```

Single query: `WHERE user_id = ? AND source = ? AND tss_status = 'pending_inference'`. No new test file — exercised through the renormalise integration test.

### `seed-profile.ts` CLI

Bootstraps `NestApplicationContext(AppModule)`. Args:

- `--profile=<path>` (default: `apps/api/scripts/test-profile.json`).
- `--user=<uuid>` (default: `config.DEV_USER_ID`).

Flow:
1. Read + parse JSON, validate with `athleteProfileSchema`. On failure → `console.error` + `process.exit(1)`.
2. `record = service.create({ userId, profile })` (repo insert).
3. `result = await renormalize.run(userId)` — **synchronous**, blocks until done (unlike the controller path).
4. Print `{ created: record.id, renormalize: result }`.
5. `await app.close()`; `process.exit(0)`.

Outer wrapper uses the same `.then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); })` pattern as `strava-backfill.ts` (closed under follow-up #1).

### `lib/load-profile.ts` — shared CLI helper

```ts
export async function loadProfile(opts: {
  fromPath?: string;
  fromDb?: { userId: string; repo: AthleteProfileRepository };
}): Promise<AthleteProfile>
```

If `fromPath` → read JSON, validate. Else → `repo.findByUserId(userId)`; throw a clear error referencing `pnpm seed:profile` when null.

Each of the four generation/render scripts consumes this in their existing `main()`:

```ts
const profile = await loadProfile({
  fromPath: argProfilePath,
  fromDb: argProfilePath ? undefined : { userId: DEV_USER_ID, repo: profilesRepo },
});
```

~3 lines of glue per script.

## Data flow

### POST /athlete-profiles (HTTP)

```
client → POST /athlete-profiles { profile }
   ▼
AthleteProfileController.create()
   userId = getCurrentUserId() = DEV_USER_ID
   Zod validation of body
   ▼
AthleteProfileService.create({ userId, profile })
   ├── repo.create({ userId, profile })           ── INSERT … RETURNING * (new versioned row)
   └── setImmediate(() =>
         renormalize.run(userId)                  ── fire-and-forget background
         .catch(err => logger.error(err))
       )
   ▼
HTTP 201 { id, userId, generatedAt, updatedAt }   ◀── returns immediately
```

### Background renormalise

```
StravaRenormalizeService.run(userId)
   profile = profilesRepo.findByUserId(userId)
   if null → log warn, return zeros
   rows = workoutsRepo.findPendingByUserAndSource(userId, 'strava')
   for each row:
      activity = parse(row.raw as StravaActivity)
      normalized = normalizeStravaActivity({userId, activity, athleteProfile: profile})
      if normalized.tssStatus === 'computed':
         workoutsRepo.upsert(normalized)          ── flips row to computed + actualTss
         recomputed += 1
      else:
         stillPending += 1
   log + return summary
```

### GET /athlete-profiles/me

```
client → GET /athlete-profiles/me
   ▼
AthleteProfileController.getMe()
   userId = getCurrentUserId()
   ▼
service.getLatestFor(userId) → repo.findByUserId(userId)
   ▼
profile ? 200 AthleteProfile : 404 { error: 'no_profile_for_user', userId }
```

### `pnpm seed:profile` CLI

```
seed-profile.ts
   bootstrap NestApplicationContext
   parse args (--profile, --user)
   read JSON, validate
   record = service.create({ userId, profile })
   result = await renormalize.run(userId)          ── SYNCHRONOUS
   console.log({ created: record.id, renormalize: result })
   app.close()
   process.exit(0)
```

### Plan/render CLI startup (the flip)

Same pattern in `generate-test-plan`, `generate-test-week`, `generate-test-adaptation`, `render-plan`:

```
parse --profile=<path>
profile = await loadProfile({fromPath, fromDb: {userId: DEV_USER_ID, repo}})
… existing pipeline …
```

`loadProfile()` produces a clear error when no DB profile exists and no `--profile` flag was passed:

> No profile in DB for `${DEV_USER_ID}`. Run `pnpm seed:profile` first, or pass `--profile=<path>`.

### Idempotency

- **POST + auto-renormalise**: safe to re-POST. Each POST adds a new versioned row. Renormalise reads the *latest* profile and only operates on `pending_inference` rows — already-`computed` rows are skipped by the SQL filter.
- **`pnpm seed:profile`**: re-running adds another version row + re-renormalises (no-op on already-computed rows).
- **Plan/render CLIs**: stateless reads.

## Error handling

### HTTP boundary

| Failure | Status | Body |
|---|---|---|
| Body fails `athleteProfileSchema` | 400 | `{ error: 'invalid_profile', issues: ZodIssue[] }` |
| `GET /me` with no profile row | 404 | `{ error: 'no_profile_for_user', userId }` |
| DB insert fails | 500 | `{ error: 'internal' }` (stack logged server-side) |
| Renormalise fails | — | Doesn't affect HTTP response (already returned 201). Logged at `error` level via the `setImmediate` catch |

### Renormalise service

- No profile when called → log `warn`, return zeros. No throw.
- Per-row failures (malformed `raw`, upsert failure) → `failed += 1`, log `warn` with `(source, externalId)`, continue.
- Whole-batch failure (DB down) → throws; the controller's `setImmediate` catch logs at `error`. No retry.

### Seed CLI

| Failure | Behavior |
|---|---|
| `--profile=<path>` file missing / unparseable | `console.error` + `exit(1)` |
| `athleteProfileSchema` rejects | print Zod error, `exit(1)` |
| `repo.create` throws | print error, `exit(1)` |
| `renormalize.run` throws (whole-batch) | print partial result + error, `exit(1)` |
| Per-row `failed > 0` but `run` returned | print summary, `exit(0)` (matches backfill convention) |

### Plan/render CLIs

| Failure | Behavior |
|---|---|
| No `--profile` flag AND `repo.findByUserId` returns null | print "Run `pnpm seed:profile` first…" + `exit(1)` |
| `--profile=<path>` missing/invalid | existing behavior, `exit(1)` |
| DB connection fails | bubbles up to outer `.catch`, `exit(1)` |

### Logging convention

Nest's `Logger`. Levels:

- `log`: profile created, renormalise summary
- `warn`: per-row failures, "no profile to renormalise against"
- `error`: unrecoverable errors

### Explicitly not added

- No retry logic. Personal-use, single-tenant; the right answer to a DB outage is to fix the DB and re-trigger, not silently retry.
- No transaction wrapping create + renormalise. They're two independent operations; renormalise is best-effort.
- No idempotency tokens on POST. Append-only versioning makes double-posts benign.

## Testing

### Unit tests (mocked deps)

| File | What it covers |
|---|---|
| `athlete-profile.service.test.ts` | `create()` calls `repo.create` then schedules `renormalize.run` via `setImmediate`; `getLatestFor()` pass-through; renormalise failure inside `setImmediate` is caught and logged |
| `athlete-profile.controller.test.ts` | POST returns 201; GET /me returns latest or 404; invalid body → 400 with Zod issues; userId comes from `DEV_USER_ID` config |
| `strava-renormalize.service.test.ts` (unit block) | With profile + bike-with-power row → flips to `computed`; without profile → returns zeros + warns; swim/run rows stay pending; per-row failures isolated; already-`computed` rows excluded by the query filter |

Hand-rolled fakes via `vi.fn()` for both repositories, matching `strava-backfill.service.test.ts`.

### Integration test (real Postgres via testcontainers)

| File | What it covers |
|---|---|
| `strava-renormalize.service.test.ts` (`describe('with real db', …)` block) | Seed a profile + 3 `pending_inference` rows (bike-with-power, bike-no-power, run) → call `renormalize.run` → assert only the bike-with-power row flipped to `computed` with the expected TSS; others remain pending; no rows duplicated |

Pattern matches `athlete-profile.repository.test.ts` — `PostgreSqlContainer` lifecycle in `beforeAll`/`afterAll`, migrations run in `beforeAll`, `beforeEach` truncates.

### Manual smoke (documented, not automated)

| Step | Expected |
|---|---|
| `pnpm seed:profile` against current DB (89 `pending_inference` rows) | Creates profile, renormalises, summary `recomputed: N` where N = bike-with-power count, `stillPending: 89-N`. Clean exit |
| `curl POST /athlete-profiles -d @test-profile.json` | 201 with `id`; logs show fire-and-forget renormalise summary |
| `curl GET /athlete-profiles/me` | 200 with profile JSON; if no profile, 404 |
| `pnpm --filter @eta/api generate:test-plan` (no `--profile`) after seed | Uses DB profile, generates plan |
| Same with `--profile=scripts/test-profile-5day.json` | Uses fixture, ignores DB |
| `pnpm --filter @eta/api generate:test-plan` with no DB profile and no flag | Clear error: "Run `pnpm seed:profile` first…", exit 1 |

Manual smoke steps go into a short note in `docs/strava-dev.md` (or a sibling `docs/athlete-profile-dev.md`).

### Not tested

- No e2e HTTP test for POST → background renormalise. The `setImmediate` is hard to assert deterministically; the renormalise service integration test covers higher-value behavior; the controller unit test covers HTTP wiring.
- No tests on the four modified CLI scripts. They're thin glue around `loadProfile()`. Existing convention: `generate-test-plan.ts` etc. have no tests today.

## Migration / rollout

No DB migration — `athlete_profiles` already exists.

Rollout sequence on the dev box:
1. Land code + migrations: nothing new schema-wise; just `pnpm install` + restart `pnpm dev:api`.
2. Run `pnpm seed:profile` once. Expect summary showing `recomputed: N` for current bike rows.
3. Verify with a Drizzle Studio query or `psql` that the bike-with-power rows now have `tss_status='computed'` and non-null `actual_tss`.

## Future work this enables

- **Follow-up #3 (run + swim TSS)**: once the run NGP / swim T-pace paths land in `strava-normalizer.ts`, re-POSTing the profile (or running `pnpm seed:profile` again) will renormalise those rows. The renormalise service is the natural caller.
- **ETA-26 (Oura)**: when readiness ingest lands, the same pattern applies — its rows go through a `*-renormalize.service.ts` keyed on `source='oura'`. The dispatcher pattern will emerge cleanly.
- **Real auth + users table**: `getCurrentUserId()` in the controller is the single place that needs to change.

## Out of scope (revisit later)

- Profile editing UI.
- Pass-0 inference from Strava history.
- Multi-source renormalisation dispatcher (today: hardcoded to Strava).
- Background queue for renormalise (currently in-process `setImmediate`).
- Authorization beyond "trust the request" (no auth in v1).
