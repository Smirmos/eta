# Training Analysis & Summary — Slice A (Design)

**Date:** 2026-06-29
**Status:** Approved (design)
**Branch:** `eta/training-analysis`

## Context

Product pivot: the app moves from a **goal-driven, top-down** race-periodized plan
(athlete profile + race date → fixed 14-week macro plan, Pass 1/2/3) to a
**history-driven, bottom-up** loop:

1. Analyze the athlete's recent training → a summary ("resume").
2. Generate the next week from observed patterns (adaptive) — *Slice B, later*.

The race-plan system (Pass 1 macro plan, athlete profile, race date) is set aside.
The web viewer built in the previous slices is replaced by this new experience.
Existing infrastructure is reused: the `workouts_completed` table (Strava data),
the Anthropic client + config, persistence/repository patterns, and the dark
"instrument-panel" web design system.

**This document specifies Slice A only:** the analysis + summary screen. Slice B
(the next-week generator) gets its own spec/plan/build cycle and consumes Slice
A's analysis as input.

## Data reality (verified against the dev DB, 2026-06-29)

`workouts_completed` for the dev user: run 45 sessions / 61.6h (no TSS), bike 37 /
53.0h (36 with TSS), swim 11 / 8.9h (no TSS); recent weekly volume ~5–17h across
all three sports with natural lighter weeks. **Latest activity is 2026-06-15**
(Strava sync stopped mid-June). Two consequences:

- **TSS is bike-only** — run/swim are `tss_status='pending_inference'`. Volume
  (duration) and session frequency are the reliable signals; TSS is a bike-only
  supplement, never the primary metric.
- **The analysis window anchors to the most recent activity date, not literal
  `today`** — otherwise the gap since 06-15 would show an empty "last 30 days."

## Goal

A new screen that computes and displays a training summary over the last ~4 weeks
of available data, with computed metrics plus a short LLM-written narrative.
Read-only; no generation. Becomes the app's primary view.

## Non-goals (Slice A)

- The next-week generator (Slice B).
- Removing the old race-plan code (`PlanTree` viewer components may be reused by
  Slice B; left in the tree, just unreferenced by `App`).
- Configurable analysis window / date pickers.
- Charting libraries (simple CSS bars only).
- Re-syncing Strava / closing the data-staleness gap (separate, already-built path).
- Auth / multi-user (single-user `DEV_USER_ID` throughout).

## Analysis (backend, deterministic)

`TrainingAnalysisService.analyze(userId): Promise<TrainingAnalysis>`:

- **Window:** find the user's most recent workout `date` (`asOf`); the window is
  the 28 days ending at `asOf` (`from = asOf − 27 days`). Group into **4 rolling
  7-day buckets counting back from `asOf`** (bucket 1 = `asOf−6 … asOf`, bucket 2
  = `asOf−13 … asOf−7`, etc.) — NOT ISO/Monday-anchored weeks, to keep bucketing
  deterministic and gap-proof. Each bucket's `weekStart` is its earliest date.
  `perWeek[]` is ordered oldest→newest. If the user has no workouts, return an
  empty analysis (the UI shows the empty state).
- Load `workouts_completed` in `[from, asOf]` via the repository.
- **Compute (pure, deterministic):**
  - `overall`: `totalSessions`, `totalHours` (sum `actual_duration_seconds`/3600),
    `trainingDays` (distinct dates), `avgSessionsPerWeek`, `avgTrainingDaysPerWeek`,
    and `sportSplit` = per-discipline `{ sessions, hours, pctHours }`.
  - `perWeek[]`: `{ weekStart, sessions, hours, byDiscipline: Record<discipline,
    { sessions, hours }>, bikeTss }` (bikeTss = sum of `actual_tss` over bike
    sessions that have it; null if none).
  - `trend`: compare the most-recent week's hours to the mean of the prior weeks
    → `'building'` (> +10%), `'tapering'` (< −10%), else `'steady'`.
  - `longestSessions`: per discipline, the session with max
    `actual_duration_seconds` → `{ discipline, date, minutes }`.
  - `dataNote`: `{ tssCoverage: 'bike_only', staleDays }` where `staleDays =
    today − asOf`; UI flags staleness when `staleDays > 7`.

A best-effort **narrative**: `TrainingNarrativeService.summarize(analysis):
Promise<string | null>` builds a compact prompt from the computed numbers and
calls the existing Anthropic client (a fast model) for one short paragraph
(consistency, sport balance, trend, notable sessions). On any error it resolves
`null` — metrics must still return.

## API

`GET /training/analysis` (single-user; resolves `DEV_USER_ID` via `ConfigService`
like `PlansController`) →

```
TrainingAnalysisResponse = TrainingAnalysis & { narrative: string | null }
```

The handler computes metrics (fast) and attaches the narrative (best-effort). The
UI shows one loading state covering the narrative latency. Returns a deterministic
empty-shaped analysis (not 404) when there are no workouts, so the UI can render a
clear "no recent training" state. The `TrainingAnalysis` / `TrainingAnalysisResponse`
types and a Zod schema live in `@eta/shared-types` so API and web share one contract.

## Web

A `TrainingSummary` view becomes `App`'s rendered content. It fetches
`GET /api/training/analysis` (a typed, schema-validated wrapper modeled on Slice
1's `fetchPlanTree`), and renders in the existing dark instrument-panel style:

- Header: "Last 4 weeks" + the `from–asOf` range + a staleness note when
  `staleDays > 7` ("data is N days old — sync Strava for current numbers").
- Headline stats: total hours, total sessions, training-days/week, and a `trend`
  chip.
- Sport-split bar (run/bike/swim by % hours).
- Per-week breakdown: one row per week with an hours bar (sport-tinted segments)
  + session count.
- Longest sessions per sport.
- Narrative paragraph (omitted/placeholder when `narrative` is null).
- States: loading, error, empty (no recent training), loaded.

`App` no longer renders the `PlanTree` viewer; those components remain in the
codebase (candidate reuse in Slice B) but are unreferenced. The reusable design
tokens/fonts in `styles.css` stay; summary-specific styles are added.

## Testing

- **API:** `TrainingAnalysisService` unit over a fixture workout set — window
  anchored to latest activity, per-week aggregation, sport split + pct, trend
  thresholds (building/steady/tapering), longest-session, distinct-training-days,
  bike-only TSS, empty-input case, staleness computation. Endpoint test with the
  Anthropic client mocked, including the narrative-failure-still-returns-metrics
  path.
- **Web:** `TrainingSummary` across loading/error/empty/loaded from a fixture
  analysis; the analysis-fetch wrapper (success / schema-fail / empty).

## Done criteria

- `GET /training/analysis` returns correct computed metrics for the dev user plus a
  narrative (or null), and an empty-shaped result when there's no data.
- The web app's primary screen shows the summary — stats, sport split, per-week
  breakdown, longest sessions, trend, narrative — with all four states handled.
- API + web tests pass; lint + typecheck clean.
