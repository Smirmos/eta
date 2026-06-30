# Next-Week Workout Generator — Design

**Date:** 2026-06-30
**Status:** Approved (brainstorming) — ready for implementation plan
**Slice:** B of the history-driven training loop (follows Slice A, the training summary)

## Goal

Generate a detailed plan of workouts for the **next 7 days**, derived from three
inputs the system already holds:

1. **Recent training** — the `TrainingAnalysis` (last-4-weeks actuals: volume,
   trend, sport balance) produced by Slice A.
2. **The athlete's goal / event date** — the stored `AthleteProfile` (`raceDate`,
   `raceType`, capacity, day constraints, thresholds, discipline mix).
3. **Periodization derived from the event date** — the app decides which phase
   the athlete is in from weeks-until-race; there is *no* pre-existing detailed
   macro plan to follow.

The output is **detailed workouts** (interval structure with zones), reusing the
existing `WeeklyDetail` contract.

### Decisions locked during brainstorming (2026-06-30)

- **"Training plan" = app-derived from the goal.** Not a revival of the
  Pass 1 → Pass 2 → Pass 3 macro-plan pipeline; not pure bottom-up either. The
  app reads the race date + capacity, computes the phase, and shapes the week
  from that + recent actuals.
- **Detail level = detailed workouts** (warmup / main set / cooldown, zones,
  durations) — i.e. the existing `WeeklyDetail` / `PlannedWorkout` /
  `WorkoutSegment` shape. No new output type.
- **Approach A** — deterministic safety frame + a single LLM expansion pass
  (same pattern as the old Pass 2). Chosen over a fully deterministic template
  engine (too rigid, brittle to author) and over reviving the full multi-pass
  pipeline (heavier than needed).
- **v1 is stateless** — generated on demand, rendered immediately, no new
  persistence table. Persisting generated weeks (for planned-vs-actual history)
  is a deferred follow-up.

## Non-goals (v1)

- Persisting generated weeks / planned-vs-actual tracking.
- A UI to edit the event date or profile (reads the stored profile as-is).
- Multi-week horizons (strictly the next 7 days).
- Wearable-readiness (HRV/Oura) inputs — the Pass 3 hard-rules engine stays out
  of scope here; volume safety comes from the deterministic ramp.

## Architecture & data flow

```
AthleteProfile ─┐
                ├─► buildNextWeekFrame()  (NEW, pure, deterministic)
TrainingAnalysis┘            │  NextWeekFrame
                             ▼
                  NextWeekGenerationService  (LLM pass, mirrors Pass 2)
                             │  WeeklyDetail (existing contract)
                             ▼
              GET /training/next-week  →  web "Next week" view
                                          (reuses WeekCard / WorkoutCard / SegmentRow)
```

The deterministic frame guarantees safety (volume never spikes, rest/long-day
constraints always hold, phase matches the race date, number of hard sessions is
fixed in code). The LLM only fills interval structure and writes coach-voice
rationale **within** that frame.

## Component 1 — `buildNextWeekFrame()` (deterministic, pure)

**Signature (conceptual):**
`buildNextWeekFrame(profile: AthleteProfile, analysis: TrainingAnalysis, asOf: Date): NextWeekFrame`

`asOf` = the day the next week starts from (default: the Monday following the
analysis `asOf`). Pure — no I/O, no clock reads beyond the injected `asOf`.

**`NextWeekFrame`** (new type in `@eta/shared-types`) — shaped like a
`MacroPlanWeek` so the LLM prompt and postprocess can treat it uniformly:

```
NextWeekFrame {
  weekStartDate: string            // ISO Monday
  phase: Phase                     // existing union
  isRecoveryWeek: boolean
  targetVolumeHours: number        // the safety-capped target
  days: NextWeekDay[]              // exactly 7, mon..sun
  rationale: {                     // concrete numbers for prompt + UI "why"
    weeksUntilRace: number
    volumeAnchorHours: number      // recent-actual anchor
    rampPct: number                // applied ramp (may be negative)
    easeTriggered: boolean
  }
}
NextWeekDay {
  dayOfWeek: DayOfWeek
  role: 'rest' | 'long' | 'quality' | 'aerobic' | 'recovery'
  disciplines: Discipline[]        // 0 for rest; 1–2 otherwise
  targetDurationMinutes: number    // per-day budget; 0 for rest
}
```

### ① Phase — weeks-until-race → `Phase`

Default table (tuned against KB `02-atp-structure.md`):

| Weeks out | Phase | | Weeks out | Phase |
|---|---|---|---|---|
| ≤1 | `race_week` | | 11–14 | `base_3` |
| 2–3 | `peak` | | 15–19 | `base_2` |
| 4–6 | `build_2` | | 20–25 | `base_1` |
| 7–10 | `build_1` | | 26+ | `prep` |

Past the race date → `transition`. (Aug 22 from late June ≈ 7–8 weeks →
`build_1`.)

### ② Volume target

- `anchor` = mean of the **last 3 complete** 7-day buckets from the analysis
  (excludes a partial current week); uses however many complete buckets exist if
  fewer than 3.
- Phase ramp (pinned constants, not a range): `base_*` **+5%**, `build_*`
  **+8%**, `peak` **0%**, `race_week` **−50%**, `prep`/`transition` **0%**;
  recovery week **−40%** (overrides the phase ramp).
- **Hard safety cap:** the target may not exceed **anchor × 1.10** (max +10%
  week-over-week).
- **Auto-ease:** if the trailing weeks show a sustained build (≥3 rising/high
  weeks), force `isRecoveryWeek = true` and apply the recovery cut regardless of
  phase.
- The stated `plannedWeeklyHours` is **not** a forced ceiling — anchor on what
  the body is adapted to (actual). It is passed to the LLM as context only.

### ③ Day skeleton

- `trainingDaysPerWeek` training days + the remainder rest. Rest days use
  `mandatoryRestDays`; if none set, default to Monday.
- Long sessions pinned to `longSessionDays` (e.g. Fri run-long, Sun ride-long).
- Each training day tagged with a `role`. Phase sets the number of `quality`
  days (build → 2, base → 1, taper → short sharp), so the **amount of hard work
  is fixed in code**.
- Per-day discipline intent nudged by recent sport balance (e.g. an underweight
  swim → ensure ≥2 swim days). Weekday `targetDurationMinutes` capped by
  `maxWeekdaySessionMinutes`; the long days carry the remaining volume.
- Days sum to `targetVolumeHours` (within rounding).

### ④ Rationale

Records `weeksUntilRace`, `volumeAnchorHours`, `rampPct`, `easeTriggered` so the
prompt can cite concrete numbers and the UI can show a plain-language "why".

## Component 2 — `NextWeekGenerationService` (LLM expansion)

Mirrors `Pass2GenerationService`:

- Same Anthropic factory pattern (injected `anthropicFactory` default for tests),
  `ConfigService`, `KnowledgeBaseLoader`, request timeout, typed error class
  (`NextWeekGenerationError` with `rawResponse` / `validationIssues` /
  `constraintViolations`).
- Flow: `buildKbSlice` for the frame's phase → build system/user prompt → call
  Anthropic → extract text → `JSON.parse` → `weeklyDetailSchema.safeParse` →
  postprocess guards → `computeWeeklySummary` + `annotateWithComputedFields`.
- **Prompt** receives: the `NextWeekFrame` (phase, target volume, day skeleton
  with roles + per-day sport + duration ceilings), the recent `TrainingAnalysis`
  (so rationale can reference real numbers like "swim is 16% of your volume"),
  and the KB slice. Instruction: fill only interval structure + rationale +
  citations within the frame; do not change volume, the rest day, or the number
  of hard sessions.

### Postprocess guards

Reuse `pass2-postprocess` (`computeWeeklySummary`, `annotateWithComputedFields`,
constraint helpers) plus frame-specific checks. On any failure →
`NextWeekGenerationError`:

- total hours within **±10%** of `frame.targetVolumeHours`;
- the rest day(s) carry no workouts; long sessions land on `longSessionDays`;
- weekday durations ≤ `maxWeekdaySessionMinutes`;
- count of hard-zone (`z4`/`z5*`) / `quality` sessions ≤ what the phase allows;
- TSS/hours are **code-computed**, never taken from the LLM.

## Component 3 — API

`GET /training/next-week` in the existing `TrainingModule` (beside
`/training/analysis`). Loads profile + runs/loads analysis, builds the frame,
generates, returns:

```
{ status: 'ok', frame: NextWeekFrame, weeklyDetail: WeeklyDetail }
```

Degraded / error responses (best-effort, like the narrative service):
- no profile → `{ status: 'needs_profile' }`
- no training history → `{ status: 'needs_history' }`
- LLM / schema / guard failure → `{ status: 'error', message }`

A `nextWeekResponseSchema` in `@eta/shared-types` validates the wire shape (the
web fetch wrapper safe-parses it, same as `analysis.ts`).

## Component 4 — Web

A **"Next week"** section below the training summary in `App`:

- Header strip: phase + target volume + plain-language "why" (e.g.
  *"Build week · ~14.5h · +5% on your recent average"*), built from
  `frame.rationale`.
- Days render with the existing `WeekCard` / `WorkoutCard` / `SegmentRow`
  (adapter maps `WeeklyDetail` → the props those components expect).
- **Generate / Regenerate** button (re-runs the pass; LLM variance → a fresh but
  still-safe week).
- States: idle/loading/error/`needs_profile`/`needs_history`, consistent with the
  current dark instrument-panel UI. Reuses the documented render-loop-safe fetch
  pattern (module-scope-stable default fetcher).

## Error handling

- `buildNextWeekFrame` never throws on a valid profile+analysis; insufficient
  inputs surface as `needs_profile` / `needs_history` from the controller.
- LLM/network/schema/guard failures → typed error → UI shows retry; the training
  summary above stays usable.

## Testing

- **Frame builder (bulk of safety coverage):** phase boundaries, volume ramp +
  the +10% cap, auto-ease trigger, rest/long-day placement, sport-balance nudge,
  weekday duration cap, days-sum-to-target.
- **Generation service:** mocked Anthropic returning a fixture `WeeklyDetail` —
  schema-valid happy path + one test per guard rejection (mirrors Pass 2 tests).
- **Web:** renders frame header + days from a fixture; loading/error/needs-profile
  states; no-prop default-fetch calls fetch exactly once (render-loop guard).
- **Manual:** `pnpm generate:next-week` CLI for live runs; browser verification.

## Files (anticipated)

- `packages/shared-types/src/next-week.ts` + `.schema.ts` (+ tests) —
  `NextWeekFrame`, `NextWeekDay`, response union + schema.
- `apps/api/src/modules/training/next-week-frame.builder.ts` (+ test) — pure.
- `apps/api/src/modules/training/next-week-generation.service.ts` (+ test).
- `apps/api/src/modules/training/next-week-prompt.ts` — system/user prompt build.
- `TrainingController` + `TrainingModule` — new route + wiring.
- `apps/api/scripts/next-week.ts` — `pnpm generate:next-week`.
- `apps/web/src/api/next-week.ts` (+ fixture), web section in `App`, small
  adapter for the existing WeekCard/WorkoutCard.

## Open questions / follow-ups (post-v1)

- Persist generated weeks for planned-vs-actual comparison.
- Reconcile the profile's `raceDate` (Aug 22) vs the stale macro-plan dates
  (Sept/Oct) — v1 trusts the profile.
- Bring HRV/readiness (Pass 3 hard rules) into the ease logic once a wearable
  source exists.
