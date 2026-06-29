# POC Read-Only View — Design Spec

**Date:** 2026-06-23
**Status:** Autonomous-mode (no user review gate per directive)
**POC phase:** C (final phase of A→B→C: persist → adapt → view)

## Problem

We have a fully wired pipeline: profile + macro plan + weekly details + adaptations all persisted, plus Strava-ingested completed workouts. But the user can't SEE any of it — `pnpm render:plan` still reads from filesystem fixtures (the `scripts/output/test-plan-*.json` files), and there's no view that combines the macro plan structure with the populated weekly details and the latest adaptation.

## Goal

Make the system viewable. After this phase:

1. `pnpm render:tree` produces a combined HTML view containing:
   - Macro plan overview (all 14 weeks)
   - Per-week structure with the latest `WeeklyDetail` inlined when present
   - The current week visually highlighted
   - The latest `AdaptationSuggestion` for the current week shown as a card
   - Completed workouts surfaced inline alongside planned workouts for weeks that have a `WeeklyDetail`
2. Existing `pnpm render:plan` keeps working with filesystem fixtures (a `--from-file=<path>` mode) for ad-hoc debugging of specific LLM outputs

Non-goals (deferred):
- A real frontend with interactive controls
- Editing adaptations / accepting suggestions
- Showing TSB/CTL/ATL charts (numbers are computed and could be displayed, but charting needs js)
- Real-time auto-refresh
- Authentication / multi-user views

## Frozen decisions

| Topic | Decision | Reason |
|---|---|---|
| Output | Static HTML written to `apps/api/scripts/output/tree-<timestamp>.html` | Matches existing `render-plan.ts` output pattern |
| Trigger | New CLI `pnpm render:tree` (NOT replacing `render:plan`) | Keep the filesystem-fixture path alive for debug |
| Data source | `PlansService.getLatestTreeForUser(userId)` for the tree; `WorkoutsCompletedRepository.findCanonicalForUserAndDateRange` for recent workouts | Reuse Phase A + B service surface, no new repos |
| Workouts window | All completed workouts from `weekStartDate(firstWeek)` through today | Easy: pulls the full athlete-history-since-plan-start. For weeks with no WeeklyDetail, only the "current week" highlighting matters; we don't need to show completed-vs-planned per week unless WeeklyDetail exists |
| Per-week workouts join | Group `WorkoutsCompleted` by date, slot them into `WeeklyDetail.workouts[].date` matches. Unmatched-by-date completed workouts (e.g., athlete worked out on a rest day) appear as "extra" entries in the week | Simple — date-based join, no fuzzy matching |
| Adaptation card | Rendered as a single block above the current week's section: "What Pass 3 suggested for this week" with the list of adjustments grouped by date | YAGNI — no acceptance UI, no per-adjustment buttons. Just visibility |
| HTML structure | Self-contained — inline CSS, no JS, no external assets | Easy to share, view offline, no deploy infra needed |
| No CLI tests | The script is composition glue; correctness comes from underlying service tests | Existing render-plan.ts also untested |

## Architecture

```
apps/api/scripts/
├── render-plan.ts                    UNCHANGED (existing fixture-based renderer)
├── render-tree.ts                    NEW — orchestrator (small)
└── lib/
    └── tree-html-renderer.ts         NEW — the rendering function (large)

apps/api/package.json                 MODIFIED — add `render:tree` script
```

### Why split into two files

`render-plan.ts` is already 1336 lines and contains a lot of weekly + macro rendering helpers. Phase C reuses none of that — the tree view has a different layout. Putting the new renderer in a separate file keeps:
- `render-plan.ts` untouched and focused on its filesystem-fixture flow
- `tree-html-renderer.ts` focused on the new combined view
- The two scripts can evolve independently

### `render-tree.ts` (the CLI)

```typescript
async function main(): Promise<void> {
  // Bootstrap Nest
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: false });
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const userId = config.get('DEV_USER_ID', { infer: true });

  // Fetch the tree
  const plansService = app.get(PlansService);
  const tree = await plansService.getLatestTreeForUser(userId);
  if (!tree) throw new Error(`No plan in DB for ${userId}. Run pnpm generate:test-plan first.`);

  // Fetch the profile
  const profileRepo = app.get(AthleteProfileRepository);
  const profileRecord = await profileRepo.findLatestRecordForUser(userId);
  if (!profileRecord) throw new Error('No profile in DB.');

  // Fetch completed workouts in the plan's range
  const workoutsRepo = app.get(WorkoutsCompletedRepository);
  const fromDate = tree.macroPlan.weeks[0]!.weekStartDate;
  const toDate = new Date().toISOString().slice(0, 10);
  const completedWorkouts = await workoutsRepo.findCanonicalForUserAndDateRange(userId, fromDate, toDate);

  // Render
  const html = renderTreeHtml({ tree, profile: profileRecord.profile, completedWorkouts });

  // Write
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5) + 'Z';
  const outPath = resolve(HERE, 'output', `tree-${timestamp}.html`);
  writeFileSync(outPath, html);
  console.log(`Wrote: ${outPath}`);
  console.log(`Size: ${(html.length / 1024).toFixed(1)} KB`);

  await app.close();
}
```

### `tree-html-renderer.ts` (the renderer)

Pure function. Takes `PlanTree`, `AthleteProfile`, `WorkoutCompleted[]`. Produces HTML string.

Structure of the output HTML:

```
<html>
  <head><style>... inline CSS ...</style></head>
  <body>
    <header>
      Athlete profile summary: name, raceDate, race type, weeksUntilRace
    </header>

    <section class="adaptation-card">  (only if tree.currentAdaptation present)
      "Pass 3 — current week adjustments"
      List of adjustments with reasoning + citation
    </section>

    <section class="overview">
      Macro plan overview — list of weeks (number, phase, volume, recovery week badge)
      Current week marked
    </section>

    <section class="weeks">
      For each macro week:
        <article class="week" data-current="true|false">
          Header: weekNumber, weekStartDate, phase, volumeHours
          Key sessions list (always shown — from macro plan)
          If WeeklyDetail present:
            Daily breakdown — for each PlannedWorkout in week.workouts:
              Date, workoutCode, discipline, duration, segments
              + any completed workouts on that date (planned-vs-actual signal)
          Completed-but-unplanned workouts for this week (date in range, no plan match): "extras" list
        </article>
    </section>
  </body>
</html>
```

CSS goals:
- Print-friendly (one column, readable fonts)
- Current-week highlighted with a colored border
- Completed workouts marked with a checkmark or "✓ done" indicator
- Adaptations grouped by date for the current week

## Data flow

```
pnpm render:tree
  ↓
Bootstrap Nest
  ↓
PlansService.getLatestTreeForUser(DEV_USER_ID)        → PlanTree | null
  ├── macroPlansRepo.findLatestForUser
  ├── weeklyDetailsRepo.findLatestForMacroPlan       → Map<weekNumber, WeeklyDetail>
  └── adaptationsRepo.findLatestForWeek(plan, current) → AdaptationRecord | null
  ↓
profileRepo.findLatestRecordForUser                   → AthleteProfileRecord
  ↓
workoutsRepo.findCanonicalForUserAndDateRange         → WorkoutCompleted[]
  ↓
renderTreeHtml({tree, profile, completedWorkouts})    → HTML string
  ↓
writeFileSync to scripts/output/tree-<ts>.html
  ↓
print path, app.close, exit(0)
```

## Error handling

| Failure | Behavior |
|---|---|
| No macro plan in DB | error "Run pnpm generate:test-plan first", exit(1) |
| No profile in DB | error "Run pnpm seed:profile first", exit(1) |
| Write fails | error propagates to outer catch, exit(1) |

No retries. Single-user, single-shot.

## Testing

| File | Coverage |
|---|---|
| `tree-html-renderer.test.ts` (NEW, unit) | Renders a minimal PlanTree → HTML contains macroPlanId, all week numbers, phase labels; with currentAdaptation populated → adaptation-card section present; with completed workouts → "✓ done" markers per matched date; with no adaptation → no adaptation card |

CLI has no test (matches existing convention).

The unit test is light — just structural assertions on the rendered HTML (DOM parsing not needed, string `includes()` checks are enough).

## Manual smoke

```bash
pnpm render:tree
# expect: "Wrote: .../scripts/output/tree-<ts>.html"
open apps/api/scripts/output/tree-*.html
# inspect visually — should see macro overview + adaptation card + week 15 detail with workouts + completed sessions marked
```

## Out of scope

- HTML routes that serve the tree from the API server (`GET /plans/me/view`)
- React/Vue frontend
- Adjustment-acceptance UI
- Real-time updates
- Per-athlete views (single-user prototype)
