# Next-week board redesign — design

**Date:** 2026-07-01
**Branch:** `eta/next-week-generator`
**Scope:** Web-only. Redesign how the generated next week is rendered in `apps/web`.

## Problem

The "Next week" section (Slice B) reuses the old race-plan viewer components
(`WeekCard → WorkoutCard → SegmentRow`). That renders a flat, chronological list
of workout rows (`workoutCode · discipline · date · duration`, then segment
bullets, then a rationale + citation line). User feedback:

- **Not visual enough** — no color, no per-discipline volume sense; doesn't match
  the redesigned training-summary above it (which uses instrument-panel `.panel`
  sections, discipline-colored bars, and strong/weak insights).
- **Not organized the way the user thinks about the week** — the user does *not*
  care about which weekday a session lands on. They think in terms of **each
  discipline: how much volume and what type of workouts to do.**
- **Wants more detail, not less** — full per-session detail (segments/zones) plus
  a recommendation per session and a week-level recommendation, and the full
  volume totals shown.

## Decisions (locked in brainstorming)

- **Organize by discipline**, not by day. Sections: Swim / Bike / Run. Day-of-week
  scheduling is intentionally **not** displayed.
- Each discipline section shows its **total volume + session count**, then its
  sessions listed by **type**.
- **Full detail, always visible** per session: type/focus label, duration, segment
  breakdown (label · duration · zone · description), and a one-line coach
  recommendation. Nothing hidden behind expanders.
- A **week-level recommendation** on top.
- Keep the dark instrument-panel aesthetic; reuse the summary's discipline colors
  (swim = cyan `--cyan`, bike = volt `--volt`, run = amber `--amber`).
- **No backend / prompt / shared-type change** — all required data is already in
  the `NextWeekResponse` payload.

## Approach

**Approach A (chosen): new dedicated `NextWeekBoard` component.** `NextWeekPlan`
stops calling `WeekCard` and renders a purpose-built board. The old
`WeekCard`/`WorkoutCard`/`SegmentRow` components are left untouched for any future
race-plan reuse. Clean separation, no risk to existing viewer tests.

Rejected — Approach B (restyle `WeekCard`/`WorkoutCard` in place): would push
discipline-grouping logic into components built for chronological rendering, rework
their tests, and couple two different visual intents into components still shared
with the set-aside plan viewer.

## Data — all present in the payload

From `NextWeekResponse` (`status: 'ok'`): `frame: NextWeekFrame` + `weeklyDetail: WeeklyDetail`.

- Per workout (`PlannedWorkout`): `discipline`, `date`, `totalDurationSeconds`,
  `segments[]` (`label`, `durationSeconds`, `zone`, `description`), `rationale`
  (coach-voice "why this workout"), `workoutCode`, optional `expectedTss`.
- `frame.days[]` (`NextWeekDay`): `dayOfWeek`, `role` (`rest | long | quality |
  aerobic | recovery`), used to derive a plain-language session **type** by joining
  on date.
- `frame.rationale`: `weeksUntilRace`, `volumeAnchorHours`, `rampPct`,
  `easeTriggered`; plus `frame.phase`, `frame.isRecoveryWeek`,
  `frame.targetVolumeHours`.
- `weeklyDetail.globalNotes` (optional): the week-level coach recommendation.

No new fields required.

## Components & modules

### `apps/web/src/lib/nextWeekView.ts` (new, pure, unit-tested)

Follows the tested-helper precedent set by `lib/insights.ts`.

- `groupByDiscipline(workouts): DisciplineGroup[]`
  - Returns groups in fixed order `swim, bike, run`.
  - Each group: `{ discipline, totalSeconds, sessionCount, sessions: PlannedWorkout[] }`.
  - Disciplines with zero sessions are **omitted**.
- `sessionType(workout, frame): string`
  - Joins `workout.date` → `frame.days[]` by computing the day index from
    `frame.weekStartDate` (ISO Monday). Maps `role` + `discipline` to a label:
    `long`→"Long ride/run/swim", `quality`→"Threshold / quality",
    `aerobic`→"Aerobic", `recovery`→"Recovery".
  - Falls back to `workoutCode` if the date→day join misses.
- Volume formatting reuses existing `lib/format.ts` (`formatDuration`); add an
  hours formatter if needed for the `Xh` totals.

### `apps/web/src/components/NextWeekBoard.tsx` (new)

Renders the full `ok` result (replaces the `WeekCard` call inside
`NextWeekPlan.renderResult`). Structure:

1. **Header panel**
   - Week total `~{targetVolumeHours}h`.
   - Discipline-split bar (cyan/volt/amber), widths proportional to each
     discipline's `totalSeconds`, with per-discipline `Xh` labels + session counts.
   - `phase` tag, `recovery` badge when `isRecoveryWeek`.
   - Ramp line: `{+8%} on {14.3}h avg · {3} wks to race` (from `frame.rationale`);
     note when `easeTriggered`.
2. **Week recommendation** — `weeklyDetail.globalNotes` as a coach's-read line;
   omitted when null.
3. **Discipline sections** (one per non-empty group), each:
   - Colored header: `SWIM — 2.5h · 2 sessions`.
   - Each session, always expanded:
     - Type label + duration + small `workoutCode` tag.
     - Segment list: `label · duration · zone chip · description` (description is
       currently dropped by `SegmentRow`; surface it here).
     - `↳ rationale` recommendation line.

`NextWeekPlan.tsx` keeps its idle/loading/error/`needs_profile`/`needs_history`
handling unchanged; only the `ok` branch swaps `WeekCard` → `NextWeekBoard`. The
existing `toPlanTreeWeek` adapter becomes unused and is removed.

### `apps/web/src/styles.css`

- New `.next-week-board` block styled to match the summary's `.panel` sections.
- Reuse the existing discipline-color variables and split-bar/track styling from
  the Training-summary block.
- Remove the now-unused `.next-week-why` rules; the section keeps `.next-week` /
  `.next-week-bar` for the Generate/Regenerate control.

## Testing

- `nextWeekView.test.ts`: `groupByDiscipline` ordering + omission of empty
  disciplines + totals/counts; `sessionType` date→role join and `workoutCode`
  fallback.
- Update `NextWeekPlan.test.tsx`: assert the new board — discipline headers,
  per-discipline totals, at least one segment `description`, and a session
  `rationale` — instead of `WeekCard` output. Keep the existing
  error/`needs_*`/loading assertions.
- All existing suites (shared-types / api / web) stay green; no api changes.

## Out of scope

- Day-of-week scheduling display.
- Any backend, prompt, or shared-type change.
- The long-session-cap / long-code-guard follow-ups noted in project memory.
- Finishing the branch (merge/PR) — handled after implementation, per the user's
  earlier lean toward feature-branch + PR.
