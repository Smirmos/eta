# Web UI — Slice 1: Live Plan Viewer (Design)

**Date:** 2026-06-29
**Status:** Approved (design)
**Branch:** `eta/web-viewer`

## Context

The ETA POC pipeline (`seed:profile → generate:test-plan → generate:test-week →
adapt:current-week → render:tree`) is merged to `main` and runs end-to-end against
live Postgres. The only ways to *view* a plan today are a read-only JSON endpoint
(`GET /plans/me`, returning a nested `PlanTree`) and a throwaway static-HTML dump
(`pnpm render:tree`). Neither is a usable product surface.

The agreed goal is a **real, full interactive web UI**, single-user (the POC's
`DEV_USER_ID`, no auth), built as **Vite + React in a new `apps/web` workspace**.
Because "full interactive app" stacks three independent layers, it is decomposed
into three slices, each with its own spec → plan → build cycle:

- **Slice 1 (this doc):** Live read-only viewer. No backend changes.
- **Slice 2 (future):** Trigger actions — "generate this week", "adapt current
  week" — requiring new POST endpoints and async UX for 60–130s LLM calls.
- **Slice 3 (future):** Athlete write-actions — mark workouts done, log completed
  sessions, edit profile — requiring new write endpoints.

This document specifies **Slice 1 only**.

## Goal

A React app at `apps/web` that fetches `GET /plans/me` and renders the full
`PlanTree` — macro overview, per-week workouts, and the current adaptation — live
and always current, replacing the manual `render:tree` step. Zero backend changes.

## Non-goals (Slice 1)

- Any generate/adapt triggers or new POST endpoints (Slice 2).
- Any athlete write-actions: mark-done, log sessions, profile edit (Slice 3).
- Authentication / multi-user / users table.
- Production hosting / deployment.
- E2E / browser-driven test harness.

## Architecture

- **New workspace `apps/web`:** Vite + React + TypeScript. Added to
  `pnpm-workspace.yaml`. Its own `package.json`, `vite.config.ts`, `tsconfig`.
- **Shared types:** depends on `@eta/shared-types`. The client never redefines the
  nested payload shapes — `MacroPlan`, `WeeklyDetail`, `AdaptationSuggestion`,
  `PlannedWorkout`, `WorkoutSegment`, `WorkoutAdjustment` are imported. The
  `PlanTree` *envelope* itself currently lives in `apps/api/.../plans.service.ts`
  (not in `@eta/shared-types`), so Slice 1 defines a thin client-side `PlanTree`
  type — `macroPlanId`, `athleteProfileId`, `macroPlan`, `generatedAt`, `weeks[]`,
  `currentAdaptation` — composed from those shared members. No API refactor
  required.
- **Dev wiring:** Vite dev-server proxy forwards `/api/*` →
  `http://localhost:${PORT}` (the Nest API, default 3000). This avoids any CORS
  change on the API and keeps a single dev origin. Dev runs two processes:
  `pnpm dev:api` and `pnpm dev:web`.
- **Typed fetch wrapper** `fetchPlanTree()`: calls `/api/plans/me`, and parses the
  response with the existing Zod schema in `@eta/shared-types` (`plan.schema.ts`)
  for the macro plan plus light validation of the envelope, so a malformed or
  drifted response fails loudly (error state) rather than rendering garbage.

## Data flow & states

Single data source, one GET on load. The UI is a pure function of four states:

1. **Loading** — skeleton / spinner.
2. **Error** — network failure or schema-validation failure; shows the error
   message and a **Retry** button.
3. **Empty** — API returns 404 `no_plan_for_user`; shows a "no plan yet — run the
   pipeline" message naming the CLI steps.
4. **Loaded** — renders the tree.

No client-side mutation and no caching layer. A manual **Refresh** button
re-triggers `fetchPlanTree()`. "Current week" detection ports the existing
renderer logic: the week whose `[weekStartDate, weekStartDate+7d)` contains today
(UTC), else the last week.

## Components

Mirrors the proven static-renderer content vocabulary, re-expressed as focused,
independently-testable React presentational components fed plain props:

- **`App`** — owns the fetch + the four-state machine; renders the others.
- **`PlanHeader`** — race date, race type, weeks-until-race, planned weekly hours,
  `macroPlanId`.
- **`AdaptationCard`** — current-week Pass 3 adjustments: per adjustment the action
  (keep/modify/replace), original code + date, changes, reasoning, citation, plus
  an optional week-level note. Hidden when `currentAdaptation` is null.
- **`WeekOverview`** — the 14-week countdown list, current week highlighted,
  recovery and "P2 detail present" badges; clicking a row scrolls to that
  `WeekCard`.
- **`WeekCard`** — one macro week: header (week number, start date, phase, volume,
  recovery badge) + body. With a Pass 2 detail, renders `WorkoutCard`s; without,
  renders a "no Pass 2 generated yet" placeholder.
- **`WorkoutCard`** — one planned workout: code, discipline, date, duration,
  segments, rationale, citation.
- **`SegmentRow`** — one workout segment: label, duration, zone.

Each component answers cleanly: what it shows, what props it takes, what it
depends on — and can be rendered in isolation in a test.

## Visual direction

**Fresh, polished design** (user's choice). At build time the `frontend-design`
skill produces the visual treatment — modern layout, clear hierarchy, good
typography, responsive, with deliberate emphasis on the current week and the
adaptation card. The static renderer's *information architecture* is the proven
content map; the *visual treatment* is new, not a port of the warm-paper CSS.
Figma assets are available via the Figma integration if a design-file workflow is
wanted; default is code-first via `frontend-design`.

## Testing

- **Component tests** (Vitest + React Testing Library) for each presentational
  component, fed fixture `PlanTree` JSON derived from the canonical Tallinn
  fixture. Cover: adaptation present vs null, week with vs without Pass 2 detail,
  current-week highlighting, empty plan.
- **State-machine tests** for `App` across loading / error / empty / loaded.
- **Fetch-wrapper test** asserting a schema-validation failure surfaces as the
  error state (not a silent render).
- No E2E / browser harness in Slice 1.

## Risks / open points

- `PlanTree` is defined in the API app, not in `@eta/shared-types`. Slice 1 avoids
  coupling to the API package by composing the envelope client-side from shared
  members. If Slice 2/3 grow the contract, promoting `PlanTree` into
  `@eta/shared-types` is a candidate refactor — out of scope here.
- `generatedAt` and other dates arrive as JSON strings over HTTP (not `Date`
  objects as in the in-process service). The fetch wrapper normalizes/parses dates
  explicitly; components receive predictable types.
- Vite proxy assumes the API runs on `localhost:${PORT}`; `PORT` is read from the
  same `.env` convention. Documented in `apps/web` README.

## Done criteria (Slice 1)

- `pnpm dev:web` serves the app; with the API up and a seeded plan, it renders the
  full current `PlanTree` (header, overview, weeks, workouts, current adaptation).
- Loading, error, empty, and loaded states all render correctly.
- Component + state tests pass under the repo's Vitest setup.
- No changes to `apps/api` source.
