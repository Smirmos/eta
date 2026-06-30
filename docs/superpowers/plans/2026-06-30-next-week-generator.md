# Next-Week Workout Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate a detailed 7-day workout plan from the athlete's race date + capacity (profile) and recent training actuals (analysis), served at `GET /training/next-week` and rendered in the web app.

**Architecture:** A pure, deterministic `buildNextWeekFrame()` decides the safe frame of the week (phase from weeks-until-race, volume anchored on recent actuals with a +10% week-over-week cap and auto-ease, day skeleton from profile constraints). A single LLM pass (mirroring the existing `Pass2GenerationService`) fills that frame with detailed workouts, validated by the existing `weeklyDetailSchema` + `validateWeeklyDetailConstraints` (reused against a synthesized `MacroPlanWeek`) plus one new ±10% volume guard. Output is the existing `WeeklyDetail`, rendered with the existing `WeekCard`/`WorkoutCard`. Stateless — generated on demand.

**Tech Stack:** TypeScript, NestJS (API), Vite + React 18 (web), Zod (`@eta/shared-types`), Anthropic SDK, Vitest. Monorepo via pnpm workspaces.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-06-30-next-week-generator-design.md`.
- **v1 is stateless** — no new DB table; generated on demand.
- **Reuse, don't reinvent:** import `buildKbSlice`, `validateWeeklyDetailConstraints`, `computeWeeklySummary`, `annotateWithComputedFields`, `extractAppliedSources`, `plannedTssRounded` from `apps/api/src/modules/plan-generation/pass2/pass2-postprocess.ts` and `pass2-context-builder.ts`. Output type is the existing `WeeklyDetail` — no new workout/segment types.
- **Phase ramp constants (pinned):** `base_*` +5%, `build_*` +8%, `peak`/`prep`/`transition` 0%, `race_week` −50%; recovery week −40% (overrides). Hard cap: never > +10% week-over-week.
- **Single-user:** `DEV_USER_ID` from config; no auth.
- **Test imports:** `import { describe, expect, it, vi } from 'vitest'` in `apps/api`; `apps/web` uses vitest `globals: true` (bare `test`/`expect`). `--max-warnings 0` — import only what you use.
- **NestJS DI + `consistent-type-imports`:** services use `import type` for injected types + register via `useFactory` (the module convention); avoids the lint error constructor-injected value imports trigger.
- **React footgun:** any default function prop/arg MUST be module-scope-stable (hoist `const`), or `useEffect`/`useCallback` deps churn into an infinite mount loop.
- **Lint bar:** new code lints clean (`eslint <files> --max-warnings 0`); whole-`apps/api` lint has pre-existing debt and is not the bar.

---

### Task 1: `NextWeekFrame` types + response schema in `@eta/shared-types`

**Files:**
- Create: `packages/shared-types/src/next-week.ts`
- Create: `packages/shared-types/src/next-week.schema.ts`
- Modify: `packages/shared-types/src/index.ts` (add two re-exports)
- Test: `packages/shared-types/src/next-week.schema.test.ts`

**Interfaces:**
- Consumes: `Phase`, `DayOfWeek`, `Discipline` from `./athlete-profile.js`; `WeeklyDetail` + `weeklyDetailSchema` from `./plan.js`/`./plan.schema.js`.
- Produces: `NextWeekDay`, `NextWeekFrame`, `NextWeekResponse` types; `nextWeekFrameSchema`, `nextWeekResponseSchema` Zod schemas.

- [ ] **Step 1: Write the types file**

Create `packages/shared-types/src/next-week.ts`:

```typescript
import type { DayOfWeek, Discipline, Phase } from './athlete-profile.js';
import type { WeeklyDetail } from './plan.js';

export type DayRole = 'rest' | 'long' | 'quality' | 'aerobic' | 'recovery';

export interface NextWeekDay {
  dayOfWeek: DayOfWeek;
  role: DayRole;
  /** 0 disciplines for a rest day; 1–2 otherwise. Guidance for the LLM. */
  disciplines: Discipline[];
  /** Per-day duration budget in minutes; 0 for rest. Guidance for the LLM. */
  targetDurationMinutes: number;
}

/** The deterministic, safety-bounded frame the LLM fills in. */
export interface NextWeekFrame {
  /** ISO Monday the generated week starts on. */
  weekStartDate: string;
  phase: Phase;
  isRecoveryWeek: boolean;
  /** Safety-capped weekly volume target (hours). */
  targetVolumeHours: number;
  /** Exactly 7 entries, mon..sun. */
  days: NextWeekDay[];
  /** Concrete numbers behind the frame, for the prompt and the UI "why". */
  rationale: {
    weeksUntilRace: number;
    volumeAnchorHours: number;
    rampPct: number;
    easeTriggered: boolean;
  };
}

export type NextWeekResponse =
  | { status: 'ok'; frame: NextWeekFrame; weeklyDetail: WeeklyDetail }
  | { status: 'needs_profile' }
  | { status: 'needs_history' }
  | { status: 'error'; message: string };
```

- [ ] **Step 2: Write the schema file**

Create `packages/shared-types/src/next-week.schema.ts`:

```typescript
import { z } from 'zod';
import { weeklyDetailSchema } from './plan.schema.js';

const dayOfWeekSchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
const disciplineSchema = z.enum(['swim', 'bike', 'run']);
const phaseSchema = z.enum([
  'prep', 'base_1', 'base_2', 'base_3', 'build_1', 'build_2', 'peak', 'race_week', 'transition',
]);
const dayRoleSchema = z.enum(['rest', 'long', 'quality', 'aerobic', 'recovery']);

export const nextWeekDaySchema = z.object({
  dayOfWeek: dayOfWeekSchema,
  role: dayRoleSchema,
  disciplines: z.array(disciplineSchema),
  targetDurationMinutes: z.number().nonnegative(),
});

export const nextWeekFrameSchema = z.object({
  weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  phase: phaseSchema,
  isRecoveryWeek: z.boolean(),
  targetVolumeHours: z.number().nonnegative(),
  days: z.array(nextWeekDaySchema).length(7),
  rationale: z.object({
    weeksUntilRace: z.number().int(),
    volumeAnchorHours: z.number().nonnegative(),
    rampPct: z.number(),
    easeTriggered: z.boolean(),
  }),
});

export const nextWeekResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), frame: nextWeekFrameSchema, weeklyDetail: weeklyDetailSchema }),
  z.object({ status: z.literal('needs_profile') }),
  z.object({ status: z.literal('needs_history') }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
```

- [ ] **Step 3: Add re-exports**

In `packages/shared-types/src/index.ts`, add after the `plan.schema.js` export line:

```typescript
export * from './next-week.js';
export * from './next-week.schema.js';
```

- [ ] **Step 4: Write the failing test**

Create `packages/shared-types/src/next-week.schema.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { nextWeekResponseSchema } from './next-week.schema.js';

describe('nextWeekResponseSchema', () => {
  it('parses a needs_profile response', () => {
    expect(nextWeekResponseSchema.parse({ status: 'needs_profile' })).toEqual({ status: 'needs_profile' });
  });

  it('rejects an ok response missing the frame', () => {
    const r = nextWeekResponseSchema.safeParse({ status: 'ok', weeklyDetail: {} });
    expect(r.success).toBe(false);
  });

  it('requires exactly 7 days in a frame', () => {
    const frame = {
      weekStartDate: '2026-07-06', phase: 'build_1', isRecoveryWeek: false, targetVolumeHours: 12,
      days: [], rationale: { weeksUntilRace: 8, volumeAnchorHours: 11, rampPct: 0.08, easeTriggered: false },
    };
    expect(nextWeekFrameOnly(frame)).toBe(false);
  });
});

function nextWeekFrameOnly(frame: unknown): boolean {
  return nextWeekResponseSchema.safeParse({
    status: 'ok', frame, weeklyDetail: { weekNumber: 1, weekStartDate: '2026-07-06', phase: 'build_1', workouts: [] },
  }).success;
}
```

- [ ] **Step 5: Run tests, verify pass, commit**

Run: `pnpm --filter @eta/shared-types exec vitest run src/next-week.schema.test.ts`
Expected: 3 passed.

```bash
git add packages/shared-types/src/next-week.ts packages/shared-types/src/next-week.schema.ts packages/shared-types/src/next-week.schema.test.ts packages/shared-types/src/index.ts
git commit -m "feat(shared-types): NextWeekFrame + next-week response schema"
```

---

### Task 2: `buildNextWeekFrame()` — the deterministic safety brain

**Files:**
- Create: `apps/api/src/modules/training/next-week-frame.builder.ts`
- Test: `apps/api/src/modules/training/next-week-frame.builder.test.ts`

**Interfaces:**
- Consumes: `AthleteProfile`, `TrainingAnalysis`, `Phase`, `DayOfWeek`, `Discipline`, `MacroPlanWeek`, `NextWeekFrame`, `NextWeekDay` from `@eta/shared-types`.
- Produces:
  - `buildNextWeekFrame(profile: AthleteProfile, analysis: TrainingAnalysis, asOf: Date): NextWeekFrame`
  - `frameToMacroPlanWeek(frame: NextWeekFrame): MacroPlanWeek`
  - `phaseForWeeksUntilRace(weeks: number): Phase` (exported for tests)

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/modules/training/next-week-frame.builder.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import type { AthleteProfile, TrainingAnalysis } from '@eta/shared-types';
import { buildNextWeekFrame, phaseForWeeksUntilRace } from './next-week-frame.builder.js';

// Minimal profile factory — only the fields the builder reads.
function profile(over: Partial<AthleteProfile> = {}): AthleteProfile {
  return {
    raceDate: new Date('2026-09-21T00:00:00Z'),
    trainingDaysPerWeek: 6,
    longSessionDays: ['fri', 'sun'],
    mandatoryRestDays: [],
    maxWeekdaySessionMinutes: 90,
    plannedWeeklyHours: 11,
    disciplineDistribution: { swimPercent: 16, bikePercent: 59, runPercent: 25 },
    ...(over as object),
  } as AthleteProfile;
}

function analysis(perWeekHours: number[], over: Partial<TrainingAnalysis> = {}): TrainingAnalysis {
  return {
    hasData: true,
    window: { from: '2026-06-03', asOf: '2026-06-30' },
    overall: {
      totalSessions: 40, totalHours: perWeekHours.reduce((a, b) => a + b, 0), trainingDays: 24,
      avgSessionsPerWeek: 10, avgTrainingDaysPerWeek: 6,
      sportSplit: [
        { discipline: 'swim', sessions: 10, hours: 8, pctHours: 16 },
        { discipline: 'bike', sessions: 18, hours: 30, pctHours: 59 },
        { discipline: 'run', sessions: 12, hours: 13, pctHours: 25 },
      ],
    },
    perWeek: perWeekHours.map((h, i) => ({
      weekStart: `2026-06-0${i + 1}`, sessions: 8, hours: h, byDiscipline: {}, bikeTss: null,
    })),
    trend: 'steady', longestSessions: [], dataNote: { tssCoverage: 'bike_only', staleDays: 0 },
    ...(over as object),
  } as TrainingAnalysis;
}

describe('phaseForWeeksUntilRace', () => {
  it('maps weeks-out to phases per the table', () => {
    expect(phaseForWeeksUntilRace(0)).toBe('transition');
    expect(phaseForWeeksUntilRace(1)).toBe('race_week');
    expect(phaseForWeeksUntilRace(3)).toBe('peak');
    expect(phaseForWeeksUntilRace(5)).toBe('build_2');
    expect(phaseForWeeksUntilRace(8)).toBe('build_1');
    expect(phaseForWeeksUntilRace(12)).toBe('base_3');
    expect(phaseForWeeksUntilRace(30)).toBe('prep');
  });
});

describe('buildNextWeekFrame', () => {
  const asOf = new Date('2026-06-30T00:00:00Z'); // Tue → next Monday 2026-07-06

  it('starts the week on the next Monday', () => {
    const f = buildNextWeekFrame(profile(), analysis([10, 10, 10, 10]), asOf);
    expect(f.weekStartDate).toBe('2026-07-06');
    expect(f.days).toHaveLength(7);
  });

  it('anchors volume on the last 3 weeks and applies the build ramp, capped at +10%', () => {
    // race 2026-09-21 from week start 2026-07-06 ≈ 11 weeks → base_3 (+5%)
    const f = buildNextWeekFrame(profile(), analysis([8, 10, 12, 14]), asOf);
    expect(f.rationale.volumeAnchorHours).toBeCloseTo(12, 1); // mean of [10,12,14]
    expect(f.phase).toBe('base_3');
    expect(f.rationale.rampPct).toBeCloseTo(0.05, 5);
    expect(f.targetVolumeHours).toBeCloseTo(12.6, 1);
  });

  it('forces a recovery week (−40%) when the last 3 weeks strictly rise', () => {
    const f = buildNextWeekFrame(profile(), analysis([9, 11, 13, 15]), asOf);
    expect(f.rationale.easeTriggered).toBe(true);
    expect(f.isRecoveryWeek).toBe(true);
    expect(f.rationale.rampPct).toBeCloseTo(-0.4, 5);
  });

  it('puts the rest day where there are no workouts and pins long days', () => {
    const f = buildNextWeekFrame(profile({ mandatoryRestDays: ['mon'] }), analysis([10, 10, 10, 10]), asOf);
    const byDay = Object.fromEntries(f.days.map((d) => [d.dayOfWeek, d]));
    expect(byDay.mon.role).toBe('rest');
    expect(byDay.mon.disciplines).toEqual([]);
    expect(byDay.fri.role).toBe('long');
    expect(byDay.sun.role).toBe('long');
  });

  it('defaults the rest day to Monday when no mandatory rest day is set', () => {
    const f = buildNextWeekFrame(profile(), analysis([10, 10, 10, 10]), asOf);
    expect(f.days.find((d) => d.dayOfWeek === 'mon')?.role).toBe('rest');
  });

  it('caps weekday (mon–fri non-long) durations at maxWeekdaySessionMinutes', () => {
    const f = buildNextWeekFrame(profile({ maxWeekdaySessionMinutes: 60 }), analysis([20, 20, 20, 20]), asOf);
    for (const d of f.days) {
      const isWeekday = d.dayOfWeek !== 'sat' && d.dayOfWeek !== 'sun';
      const isLong = d.role === 'long';
      if (isWeekday && !isLong && d.role !== 'rest') expect(d.targetDurationMinutes).toBeLessThanOrEqual(60);
    }
  });

  it('gives the underweight discipline (swim) at least two day slots of guidance', () => {
    const f = buildNextWeekFrame(profile(), analysis([10, 10, 10, 10]), asOf);
    const swimDays = f.days.filter((d) => d.disciplines.includes('swim')).length;
    expect(swimDays).toBeGreaterThanOrEqual(2);
  });

  it('sets the number of quality days from the phase (build → 2)', () => {
    // race 8 weeks out → build_1 → 2 quality days
    const f = buildNextWeekFrame(profile({ raceDate: new Date('2026-08-31T00:00:00Z') }), analysis([10, 10, 10, 10]), asOf);
    expect(f.phase).toBe('build_1');
    expect(f.days.filter((d) => d.role === 'quality')).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `pnpm --filter @eta/api exec vitest run src/modules/training/next-week-frame.builder.test.ts`
Expected: FAIL — `buildNextWeekFrame is not a function`.

- [ ] **Step 3: Write the implementation**

Create `apps/api/src/modules/training/next-week-frame.builder.ts`:

```typescript
import type {
  AthleteProfile, DayOfWeek, Discipline, MacroPlanWeek, NextWeekDay, NextWeekFrame, Phase,
  TrainingAnalysis,
} from '@eta/shared-types';

const ALL_DAYS: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_INDEX: Record<DayOfWeek, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };

const PHASE_RAMP: Record<Phase, number> = {
  prep: 0, base_1: 0.05, base_2: 0.05, base_3: 0.05,
  build_1: 0.08, build_2: 0.08, peak: 0, race_week: -0.5, transition: 0,
};
const QUALITY_DAYS: Record<Phase, number> = {
  prep: 0, base_1: 1, base_2: 1, base_3: 1, build_1: 2, build_2: 2, peak: 1, race_week: 1, transition: 0,
};
const MAX_WOW_RAMP = 0.1;
const RECOVERY_CUT = -0.4;
// Order to fill discretionary rest days; never a long day. Weekdays first.
const REST_PREFERENCE: DayOfWeek[] = ['mon', 'wed', 'fri', 'tue', 'thu', 'sat', 'sun'];
// Spread quality across the week; first-listed are picked first.
const QUALITY_PREFERENCE: DayOfWeek[] = ['tue', 'thu', 'wed', 'sat', 'mon', 'fri', 'sun'];

const round1 = (n: number): number => Math.round(n * 10) / 10;

export function phaseForWeeksUntilRace(weeks: number): Phase {
  if (weeks <= 0) return 'transition';
  if (weeks === 1) return 'race_week';
  if (weeks <= 3) return 'peak';
  if (weeks <= 6) return 'build_2';
  if (weeks <= 10) return 'build_1';
  if (weeks <= 14) return 'base_3';
  if (weeks <= 19) return 'base_2';
  if (weeks <= 25) return 'base_1';
  return 'prep';
}

function nextMondayIso(asOf: Date): string {
  const d = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
  const isoDay = (d.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  d.setUTCDate(d.getUTCDate() + (7 - isoDay)); // strictly the following Monday
  return d.toISOString().slice(0, 10);
}

function weeksUntilRace(raceDate: Date, weekStartIso: string): number {
  const start = Date.parse(`${weekStartIso}T00:00:00Z`);
  const race = Date.UTC(raceDate.getUTCFullYear(), raceDate.getUTCMonth(), raceDate.getUTCDate());
  return Math.ceil((race - start) / (7 * 86_400_000));
}

function isSustainedBuild(perWeekHours: number[]): boolean {
  if (perWeekHours.length < 3) return false;
  const [a, b, c] = perWeekHours.slice(-3);
  return (b as number) > (a as number) && (c as number) > (b as number);
}

function pickRestDays(profile: AthleteProfile): Set<DayOfWeek> {
  const rest = new Set<DayOfWeek>(profile.mandatoryRestDays);
  const needed = Math.max(0, 7 - profile.trainingDaysPerWeek);
  for (const d of REST_PREFERENCE) {
    if (rest.size >= needed) break;
    if (rest.has(d) || profile.longSessionDays.includes(d)) continue;
    rest.add(d);
  }
  return rest;
}

export function buildNextWeekFrame(
  profile: AthleteProfile,
  analysis: TrainingAnalysis,
  asOf: Date,
): NextWeekFrame {
  const weekStartDate = nextMondayIso(asOf);
  const weeks = weeksUntilRace(profile.raceDate, weekStartDate);
  const phase = phaseForWeeksUntilRace(weeks);

  // ── Volume ──────────────────────────────────────────────────────────
  const perWeekHours = analysis.perWeek.map((w) => w.hours);
  const recent = perWeekHours.slice(-3);
  const anchor = recent.length > 0 ? recent.reduce((s, h) => s + h, 0) / recent.length : 0;
  const easeTriggered = isSustainedBuild(perWeekHours);
  let rampPct = easeTriggered ? RECOVERY_CUT : PHASE_RAMP[phase];
  if (rampPct > MAX_WOW_RAMP) rampPct = MAX_WOW_RAMP;
  const isRecoveryWeek = easeTriggered;
  const targetVolumeHours = round1(anchor * (1 + rampPct));

  // ── Day skeleton ────────────────────────────────────────────────────
  const rest = pickRestDays(profile);
  const trainingDays = ALL_DAYS.filter((d) => !rest.has(d));
  const longDays = trainingDays.filter((d) => profile.longSessionDays.includes(d));
  const weekdayDays = trainingDays.filter((d) => !profile.longSessionDays.includes(d));

  // Durations: weekday days take an even share capped by the weekday limit;
  // long days absorb the remainder.
  const totalMin = targetVolumeHours * 60;
  const evenShare = trainingDays.length > 0 ? totalMin / trainingDays.length : 0;
  const weekdayEach = Math.min(profile.maxWeekdaySessionMinutes, Math.round(evenShare));
  const longRemainder = Math.max(0, totalMin - weekdayEach * weekdayDays.length);
  const longEach = longDays.length > 0 ? Math.round(longRemainder / longDays.length) : 0;

  // Quality days: pick from weekday (non-long) days, spread out.
  const qualityCount = isRecoveryWeek ? 0 : QUALITY_DAYS[phase];
  const qualityDays = new Set<DayOfWeek>(
    QUALITY_PREFERENCE.filter((d) => weekdayDays.includes(d)).slice(0, qualityCount),
  );

  // Discipline guidance: long days → the two highest-volume disciplines;
  // weekday days → cycle by ascending share so the underweight one recurs.
  const byVolumeDesc = [...analysis.overall.sportSplit].sort((a, b) => b.hours - a.hours).map((s) => s.discipline);
  const byNeedAsc = [...analysis.overall.sportSplit].sort((a, b) => a.pctHours - b.pctHours).map((s) => s.discipline);
  const needRotation = byNeedAsc.length > 0 ? byNeedAsc : (['swim', 'bike', 'run'] as Discipline[]);

  let weekdayCursor = 0;
  const days: NextWeekDay[] = ALL_DAYS.map((dayOfWeek) => {
    if (rest.has(dayOfWeek)) {
      return { dayOfWeek, role: 'rest', disciplines: [], targetDurationMinutes: 0 };
    }
    if (longDays.includes(dayOfWeek)) {
      const idx = longDays.indexOf(dayOfWeek);
      const discipline = byVolumeDesc[idx] ?? byVolumeDesc[0] ?? 'bike';
      return { dayOfWeek, role: 'long', disciplines: [discipline], targetDurationMinutes: longEach };
    }
    const role: NextWeekDay['role'] = isRecoveryWeek
      ? 'recovery'
      : qualityDays.has(dayOfWeek)
        ? 'quality'
        : 'aerobic';
    const discipline = needRotation[weekdayCursor % needRotation.length] as Discipline;
    weekdayCursor += 1;
    return { dayOfWeek, role, disciplines: [discipline], targetDurationMinutes: weekdayEach };
  });

  return {
    weekStartDate,
    phase,
    isRecoveryWeek,
    targetVolumeHours,
    days,
    rationale: { weeksUntilRace: weeks, volumeAnchorHours: round1(anchor), rampPct, easeTriggered },
  };
}

/** Synthesize a MacroPlanWeek so the Pass-2 postprocess helpers can be reused. */
export function frameToMacroPlanWeek(frame: NextWeekFrame): MacroPlanWeek {
  return {
    weekNumber: 1,
    weekStartDate: frame.weekStartDate,
    phase: frame.phase,
    isRecoveryWeek: frame.isRecoveryWeek,
    weeklyVolumeHours: frame.targetVolumeHours,
    keySessions: [],
  };
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `pnpm --filter @eta/api exec vitest run src/modules/training/next-week-frame.builder.test.ts`
Expected: all passed. If the "underweight swim ≥ 2 slots" test fails, confirm `needRotation` starts at the lowest-share discipline (swim) so it lands on the first weekday cursor positions.

- [ ] **Step 5: Lint + commit**

Run: `pnpm --filter @eta/api exec eslint src/modules/training/next-week-frame.builder.ts --max-warnings 0`
Expected: clean.

```bash
git add apps/api/src/modules/training/next-week-frame.builder.ts apps/api/src/modules/training/next-week-frame.builder.test.ts
git commit -m "feat(api): deterministic next-week frame builder"
```

---

### Task 3: Volume/hard-session guards (`next-week-postprocess.ts`)

**Files:**
- Create: `apps/api/src/modules/training/next-week-postprocess.ts`
- Test: `apps/api/src/modules/training/next-week-postprocess.test.ts`

**Interfaces:**
- Consumes: `WeeklyDetail`, `NextWeekFrame` from `@eta/shared-types`.
- Produces: `NextWeekGuardError extends Error` (with `violations: string[]`); `validateNextWeekVolume(weeklyDetail: WeeklyDetail, frame: NextWeekFrame): void`.

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/modules/training/next-week-postprocess.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import type { NextWeekFrame, WeeklyDetail } from '@eta/shared-types';
import { NextWeekGuardError, validateNextWeekVolume } from './next-week-postprocess.js';

function frame(over: Partial<NextWeekFrame> = {}): NextWeekFrame {
  return {
    weekStartDate: '2026-07-06', phase: 'build_1', isRecoveryWeek: false, targetVolumeHours: 12,
    days: [
      { dayOfWeek: 'tue', role: 'quality', disciplines: ['bike'], targetDurationMinutes: 60 },
      { dayOfWeek: 'thu', role: 'quality', disciplines: ['run'], targetDurationMinutes: 60 },
    ] as NextWeekFrame['days'],
    rationale: { weeksUntilRace: 8, volumeAnchorHours: 11.5, rampPct: 0.08, easeTriggered: false },
    ...over,
  };
}

function detail(totalHours: number, hardCount = 0): WeeklyDetail {
  const workouts = [];
  // one workout carrying `totalHours`, plus `hardCount` short z4 workouts.
  workouts.push({
    workoutCode: 'B/AE1', discipline: 'bike', date: '2026-07-11',
    totalDurationSeconds: Math.round(totalHours * 3600),
    segments: [{ label: 'M', durationSeconds: Math.round(totalHours * 3600), zone: 'z2', description: '' }],
    rationale: 'x', citation: 'knowledge-base/03-workouts.md#x',
  });
  for (let i = 0; i < hardCount; i++) {
    workouts.push({
      workoutCode: 'B/SS2', discipline: 'bike', date: '2026-07-07',
      totalDurationSeconds: 600,
      segments: [{ label: 'M', durationSeconds: 600, zone: 'z4', description: '' }],
      rationale: 'x', citation: 'knowledge-base/03-workouts.md#x',
    });
  }
  return { weekNumber: 1, weekStartDate: '2026-07-06', phase: 'build_1', workouts } as WeeklyDetail;
}

describe('validateNextWeekVolume', () => {
  it('passes when total hours are within ±10% of target', () => {
    expect(() => validateNextWeekVolume(detail(12.5), frame())).not.toThrow();
  });

  it('throws when total hours are >10% off target', () => {
    expect(() => validateNextWeekVolume(detail(20), frame())).toThrow(NextWeekGuardError);
  });

  it('throws when hard sessions exceed the phase allowance + 1', () => {
    // frame has 2 quality days → allowance 2, +1 tolerance = 3; 4 hard → throws.
    expect(() => validateNextWeekVolume(detail(12, 4), frame())).toThrow(NextWeekGuardError);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `pnpm --filter @eta/api exec vitest run src/modules/training/next-week-postprocess.test.ts`
Expected: FAIL — `validateNextWeekVolume is not a function`.

- [ ] **Step 3: Write the implementation**

Create `apps/api/src/modules/training/next-week-postprocess.ts`:

```typescript
import type { NextWeekFrame, WeeklyDetail } from '@eta/shared-types';

const HARD_ZONES = new Set(['z4', 'z5a', 'z5b', 'z5c']);
const VOLUME_TOLERANCE = 0.1;

export class NextWeekGuardError extends Error {
  readonly violations: string[];
  constructor(violations: string[]) {
    super(`Next-week guard violations (${violations.length}): ${violations.join('; ')}`);
    this.name = 'NextWeekGuardError';
    this.violations = violations;
  }
}

/** Frame-specific guards beyond validateWeeklyDetailConstraints: total volume
 *  within ±10% of target, and hard-session count within the phase allowance. */
export function validateNextWeekVolume(weeklyDetail: WeeklyDetail, frame: NextWeekFrame): void {
  const violations: string[] = [];

  const totalHours = weeklyDetail.workouts.reduce((s, w) => s + w.totalDurationSeconds / 3600, 0);
  if (frame.targetVolumeHours > 0) {
    const delta = Math.abs(totalHours - frame.targetVolumeHours) / frame.targetVolumeHours;
    if (delta > VOLUME_TOLERANCE) {
      violations.push(
        `weekly hours ${totalHours.toFixed(1)} vs target ${frame.targetVolumeHours} — ` +
          `${(delta * 100).toFixed(0)}% exceeds ±${VOLUME_TOLERANCE * 100}%`,
      );
    }
  }

  const hardCount = weeklyDetail.workouts.filter((w) => w.segments.some((s) => HARD_ZONES.has(s.zone))).length;
  const allowed = frame.days.filter((d) => d.role === 'quality').length;
  if (hardCount > allowed + 1) {
    violations.push(`hard sessions ${hardCount} exceed phase allowance ${allowed} (+1 tolerance)`);
  }

  if (violations.length > 0) throw new NextWeekGuardError(violations);
}
```

- [ ] **Step 4: Run tests, verify pass; lint; commit**

Run: `pnpm --filter @eta/api exec vitest run src/modules/training/next-week-postprocess.test.ts`
Expected: 3 passed.
Run: `pnpm --filter @eta/api exec eslint src/modules/training/next-week-postprocess.ts --max-warnings 0`

```bash
git add apps/api/src/modules/training/next-week-postprocess.ts apps/api/src/modules/training/next-week-postprocess.test.ts
git commit -m "feat(api): next-week volume + hard-session guards"
```

---

### Task 4: Prompt builder (`next-week-prompt.ts`)

**Files:**
- Create: `apps/api/src/modules/training/next-week-prompt.ts`
- Test: `apps/api/src/modules/training/next-week-prompt.test.ts`

**Interfaces:**
- Consumes: `AthleteProfile`, `TrainingAnalysis`, `NextWeekFrame` from `@eta/shared-types`; `KbSlice` from `../plan-generation/pass2/types.js`.
- Produces: `buildNextWeekPrompt(input: { frame: NextWeekFrame; analysis: TrainingAnalysis; profile: AthleteProfile; kb: KbSlice }): { system: string; user: string }`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/training/next-week-prompt.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import type { AthleteProfile, NextWeekFrame, TrainingAnalysis } from '@eta/shared-types';
import type { KbSlice } from '../plan-generation/pass2/types.js';
import { buildNextWeekPrompt } from './next-week-prompt.js';

const frame: NextWeekFrame = {
  weekStartDate: '2026-07-06', phase: 'build_1', isRecoveryWeek: false, targetVolumeHours: 12.5,
  days: [
    { dayOfWeek: 'mon', role: 'rest', disciplines: [], targetDurationMinutes: 0 },
    { dayOfWeek: 'tue', role: 'quality', disciplines: ['bike'], targetDurationMinutes: 75 },
    { dayOfWeek: 'wed', role: 'aerobic', disciplines: ['swim'], targetDurationMinutes: 60 },
    { dayOfWeek: 'thu', role: 'quality', disciplines: ['run'], targetDurationMinutes: 60 },
    { dayOfWeek: 'fri', role: 'long', disciplines: ['run'], targetDurationMinutes: 90 },
    { dayOfWeek: 'sat', role: 'aerobic', disciplines: ['swim'], targetDurationMinutes: 60 },
    { dayOfWeek: 'sun', role: 'long', disciplines: ['bike'], targetDurationMinutes: 180 },
  ],
  rationale: { weeksUntilRace: 8, volumeAnchorHours: 11.6, rampPct: 0.08, easeTriggered: false },
};
const kb: KbSlice = { zones: 'ZONES', atpStructurePhase: 'BUILD1', workoutsRelevant: 'WORKOUTS', weeklyTemplatesRules: 'RULES', totalChars: 30 };

it('includes the frame days, target, phase and KB slice; instructs JSON-only WeeklyDetail', () => {
  const { system, user } = buildNextWeekPrompt({
    frame, kb,
    profile: { maxWeekdaySessionMinutes: 90 } as AthleteProfile,
    analysis: { overall: { totalHours: 47 }, trend: 'building' } as TrainingAnalysis,
  });
  expect(system).toMatch(/JSON/i);
  expect(user).toContain('2026-07-06');
  expect(user).toContain('build_1');
  expect(user).toContain('12.5');
  expect(user).toContain('WORKOUTS');
  expect(user).toMatch(/rest/); // the Monday rest day appears in the skeleton table
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm --filter @eta/api exec vitest run src/modules/training/next-week-prompt.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `apps/api/src/modules/training/next-week-prompt.ts`:

```typescript
import type { AthleteProfile, NextWeekFrame, TrainingAnalysis } from '@eta/shared-types';
import type { KbSlice } from '../plan-generation/pass2/types.js';

const SYSTEM = `You are an expert triathlon coach. You are given a fixed, safety-checked
skeleton for ONE upcoming training week and must fill in detailed workouts.

Hard rules — output is rejected if any is broken:
- Output ONLY a JSON object matching the WeeklyDetail schema. No prose, no markdown fences.
- weekNumber MUST be 1. weekStartDate and phase MUST equal the values given below.
- One workout per non-rest day, on that day's ISO date. The rest day has NO workout.
- Each workout has EXACTLY 3 segments: a warmup, a main set, and a cooldown. Express
  intervals inside the main-set segment's description (e.g. "3 x 10min Z4 / 5min Z2").
- Use ONLY workout codes that appear in the provided workouts reference.
- Total weekly hours must be within ±10% of the target volume.
- Honour the long-session days, the weekday duration cap, and the day roles.
- Every workout needs a one-sentence coach rationale and a "knowledge-base/..." citation.`;

const DISCIPLINE_BY_NEED = (analysis: TrainingAnalysis): string =>
  analysis.overall.sportSplit
    .map((s) => `${s.discipline} ${s.pctHours}%`)
    .join(', ');

export function buildNextWeekPrompt(input: {
  frame: NextWeekFrame;
  analysis: TrainingAnalysis;
  profile: AthleteProfile;
  kb: KbSlice;
}): { system: string; user: string } {
  const { frame, analysis, profile, kb } = input;

  const dayLines = frame.days
    .map((d) => {
      const date = isoForDayInWeek(frame.weekStartDate, d.dayOfWeek);
      if (d.role === 'rest') return `- ${d.dayOfWeek} (${date}): REST — no workout`;
      const disc = d.disciplines.join('/');
      return `- ${d.dayOfWeek} (${date}): ${d.role} · ${disc} · ~${d.targetDurationMinutes} min`;
    })
    .join('\n');

  const user = `## Week to build
weekStartDate: ${frame.weekStartDate}
phase: ${frame.phase}
isRecoveryWeek: ${frame.isRecoveryWeek}
target weekly volume: ${frame.targetVolumeHours} h
why: ${frame.rationale.weeksUntilRace} weeks to race; anchored on ${frame.rationale.volumeAnchorHours} h recent average; ramp ${(frame.rationale.rampPct * 100).toFixed(0)}%${frame.rationale.easeTriggered ? ' (recovery/ease week)' : ''}

## Day skeleton (fill each non-rest day with one workout on its date)
${dayLines}

## Constraints
weekday session cap: ${profile.maxWeekdaySessionMinutes} min (mon–fri, non-long days)

## Recent training (last 4 weeks)
total: ${analysis.overall.totalHours} h · trend: ${analysis.trend} · sport balance: ${DISCIPLINE_BY_NEED(analysis)}

## Knowledge base
### Zones
${kb.zones}
### Phase (${frame.phase})
${kb.atpStructurePhase}
### Workouts you may use
${kb.workoutsRelevant}
### Placement rules
${kb.weeklyTemplatesRules}${kb.recovery ? `\n### Recovery guidance\n${kb.recovery}` : ''}

Return the WeeklyDetail JSON now.`;

  return { system: SYSTEM, user };
}

function isoForDayInWeek(weekStartDate: string, day: string): string {
  const offset: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
  const d = new Date(`${weekStartDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (offset[day] ?? 0));
  return d.toISOString().slice(0, 10);
}
```

- [ ] **Step 4: Run test, verify pass; lint; commit**

Run: `pnpm --filter @eta/api exec vitest run src/modules/training/next-week-prompt.test.ts`
Expected: passed.
Run: `pnpm --filter @eta/api exec eslint src/modules/training/next-week-prompt.ts --max-warnings 0`

```bash
git add apps/api/src/modules/training/next-week-prompt.ts apps/api/src/modules/training/next-week-prompt.test.ts
git commit -m "feat(api): next-week LLM prompt builder"
```

---

### Task 5: `NextWeekGenerationService`

**Files:**
- Create: `apps/api/src/modules/training/next-week-generation.service.ts`
- Test: `apps/api/src/modules/training/next-week-generation.service.test.ts`

**Interfaces:**
- Consumes: `buildNextWeekFrame`, `frameToMacroPlanWeek` (Task 2); `buildNextWeekPrompt` (Task 4); `validateNextWeekVolume`, `NextWeekGuardError` (Task 3); reused `buildKbSlice`, `validateWeeklyDetailConstraints`, `WeeklyDetailConstraintError`, `computeWeeklySummary`, `annotateWithComputedFields`, `extractAppliedSources`; `KnowledgeBaseLoader`; `weeklyDetailSchema`.
- Produces: `NextWeekGenerationService` with `generate(input: { profile: AthleteProfile; analysis: TrainingAnalysis; asOf?: Date }): Promise<{ frame: NextWeekFrame; weeklyDetail: WeeklyDetail; appliedSources: string[] }>`; `NextWeekGenerationError extends Error`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/training/next-week-generation.service.test.ts`. The mock Anthropic returns a fixture `WeeklyDetail` that satisfies the frame produced from the test inputs (asOf Tue 2026-06-30 → week start 2026-07-06; trainingDaysPerWeek 2, longSessionDays ['sat']):

```typescript
import { describe, expect, it, vi } from 'vitest';
import type { AthleteProfile, TrainingAnalysis, WeeklyDetail } from '@eta/shared-types';
import type { ConfigService } from '@nestjs/config';
import type { KnowledgeBaseLoader } from '../plan-generation/knowledge-base.loader.js';
import { NextWeekGenerationError, NextWeekGenerationService } from './next-week-generation.service.js';

const ASOF = new Date('2026-06-30T00:00:00Z'); // week start 2026-07-06; sat=07-11, sun=07-12

function profile(): AthleteProfile {
  return {
    raceDate: new Date('2026-09-21T00:00:00Z'),
    trainingDaysPerWeek: 2, longSessionDays: ['sat'], mandatoryRestDays: [],
    maxWeekdaySessionMinutes: 360, plannedWeeklyHours: 10,
    disciplineDistribution: { swimPercent: 16, bikePercent: 59, runPercent: 25 },
  } as AthleteProfile;
}
function analysis(): TrainingAnalysis {
  return {
    hasData: true, window: { from: '2026-06-03', asOf: '2026-06-30' },
    overall: {
      totalSessions: 8, totalHours: 40, trainingDays: 8, avgSessionsPerWeek: 2, avgTrainingDaysPerWeek: 2,
      sportSplit: [
        { discipline: 'swim', sessions: 2, hours: 2, pctHours: 16 },
        { discipline: 'bike', sessions: 4, hours: 6, pctHours: 59 },
        { discipline: 'run', sessions: 2, hours: 2, pctHours: 25 },
      ],
    },
    perWeek: [10, 10, 10, 10].map((h, i) => ({ weekStart: `2026-06-0${i + 1}`, sessions: 2, hours: h, byDiscipline: {}, bikeTss: null })),
    trend: 'steady', longestSessions: [], dataNote: { tssCoverage: 'bike_only', staleDays: 0 },
  } as TrainingAnalysis;
}

// anchor = 10h, base_3 ramp +5% → target 10.5h. Two training days: sun (aerobic) + sat (long).
function okDetail(totalHours = 10.5): WeeklyDetail {
  const sat = Math.round((totalHours * 3600) * 0.55);
  const sun = Math.round(totalHours * 3600) - sat;
  const seg = (secs: number, zone: string) => [
    { label: 'Warmup', durationSeconds: Math.round(secs * 0.1), zone: 'z1', description: 'easy' },
    { label: 'Main', durationSeconds: secs - Math.round(secs * 0.1) - Math.round(secs * 0.1), zone, description: 'steady' },
    { label: 'Cooldown', durationSeconds: Math.round(secs * 0.1), zone: 'z1', description: 'easy' },
  ];
  return {
    weekNumber: 1, weekStartDate: '2026-07-06', phase: 'base_3',
    workouts: [
      { workoutCode: 'B/AE1', discipline: 'bike', date: '2026-07-11', totalDurationSeconds: sat, segments: seg(sat, 'z2'), rationale: 'Long aerobic ride.', citation: 'knowledge-base/03-workouts.md#b-ae1' },
      { workoutCode: 'C/AE1', discipline: 'run', date: '2026-07-12', totalDurationSeconds: sun, segments: seg(sun, 'z2'), rationale: 'Aerobic run.', citation: 'knowledge-base/03-workouts.md#c-ae1' },
    ],
  } as WeeklyDetail;
}

function makeService(detail: WeeklyDetail | string): NextWeekGenerationService {
  const config = { get: (k: string) => (k === 'ANTHROPIC_MODEL' ? 'claude' : k === 'ANTHROPIC_MAX_TOKENS' ? 8000 : 'key') } as unknown as ConfigService<never, true>;
  const kbLoader = { get: () => ({ zones: 'z', atpStructure: '#### Base 3\nb3', workouts: '### B/AE1: x\n### C/AE1: y', weeklyTemplates: '## Workout placement rules\nr', recovery: 'rec', totalChars: 1, loadedFrom: 't' }) } as unknown as KnowledgeBaseLoader;
  const text = typeof detail === 'string' ? detail : JSON.stringify(detail);
  const factory = () => ({ messages: { create: vi.fn(async () => ({ content: [{ type: 'text', text }], usage: { input_tokens: 1, output_tokens: 1 } })) } });
  return new NextWeekGenerationService(config, kbLoader, factory as never);
}

describe('NextWeekGenerationService', () => {
  it('generates a WeeklyDetail and annotates computed TSS/hours', async () => {
    const svc = makeService(okDetail());
    const { frame, weeklyDetail } = await svc.generate({ profile: profile(), analysis: analysis(), asOf: ASOF });
    expect(frame.weekStartDate).toBe('2026-07-06');
    expect(weeklyDetail.workouts).toHaveLength(2);
    expect(weeklyDetail.weeklyTotalHours).toBeGreaterThan(0); // annotated in code
    expect(weeklyDetail.workouts[0]!.expectedTss).toBeGreaterThan(0);
  });

  it('rejects a week whose volume is >10% off target', async () => {
    const svc = makeService(okDetail(20));
    await expect(svc.generate({ profile: profile(), analysis: analysis(), asOf: ASOF })).rejects.toThrow(NextWeekGenerationError);
  });

  it('rejects non-JSON model output', async () => {
    const svc = makeService('sorry, here is your plan:');
    await expect(svc.generate({ profile: profile(), analysis: analysis(), asOf: ASOF })).rejects.toThrow(NextWeekGenerationError);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `pnpm --filter @eta/api exec vitest run src/modules/training/next-week-generation.service.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

Create `apps/api/src/modules/training/next-week-generation.service.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import {
  weeklyDetailSchema, type AthleteProfile, type NextWeekFrame, type TrainingAnalysis, type WeeklyDetail,
} from '@eta/shared-types';
import type { ZodIssue } from 'zod';
import type { Env } from '../../config/env.schema.js';
import type { KnowledgeBaseLoader } from '../plan-generation/knowledge-base.loader.js';
import { buildKbSlice } from '../plan-generation/pass2/pass2-context-builder.js';
import {
  WeeklyDetailConstraintError, annotateWithComputedFields, computeWeeklySummary,
  extractAppliedSources, validateWeeklyDetailConstraints,
} from '../plan-generation/pass2/pass2-postprocess.js';
import { buildNextWeekFrame, frameToMacroPlanWeek } from './next-week-frame.builder.js';
import { NextWeekGuardError, validateNextWeekVolume } from './next-week-postprocess.js';
import { buildNextWeekPrompt } from './next-week-prompt.js';

const REQUEST_TIMEOUT_MS = 5 * 60 * 1000;

export class NextWeekGenerationError extends Error {
  readonly violations?: string[];
  readonly validationIssues?: ZodIssue[];
  constructor(message: string, options: { cause?: unknown; violations?: string[]; validationIssues?: ZodIssue[] } = {}) {
    super(message, { cause: options.cause });
    this.name = 'NextWeekGenerationError';
    this.violations = options.violations;
    this.validationIssues = options.validationIssues;
  }
}

type AnthropicLike = Pick<Anthropic, 'messages'>;
type AnthropicFactory = (apiKey: string) => AnthropicLike;
const defaultAnthropicFactory: AnthropicFactory = (apiKey) => new Anthropic({ apiKey, timeout: REQUEST_TIMEOUT_MS });

export class NextWeekGenerationService {
  private readonly logger = new Logger(NextWeekGenerationService.name);
  private readonly client: AnthropicLike;
  private readonly model: string;
  private readonly maxTokens: number;

  constructor(
    config: ConfigService<Env, true>,
    private readonly kbLoader: KnowledgeBaseLoader,
    anthropicFactory: AnthropicFactory = defaultAnthropicFactory,
  ) {
    this.client = anthropicFactory(config.get('ANTHROPIC_API_KEY', { infer: true }));
    this.model = config.get('ANTHROPIC_MODEL', { infer: true });
    this.maxTokens = config.get('ANTHROPIC_MAX_TOKENS', { infer: true });
  }

  async generate(input: { profile: AthleteProfile; analysis: TrainingAnalysis; asOf?: Date }): Promise<{
    frame: NextWeekFrame; weeklyDetail: WeeklyDetail; appliedSources: string[];
  }> {
    const frame = buildNextWeekFrame(input.profile, input.analysis, input.asOf ?? new Date());
    const macroWeek = frameToMacroPlanWeek(frame);
    const kb = buildKbSlice({ week: macroWeek, kb: this.kbLoader.get() });
    const { system, user } = buildNextWeekPrompt({ frame, analysis: input.analysis, profile: input.profile, kb });

    let response: Anthropic.Messages.Message;
    try {
      response = await this.client.messages.create({
        model: this.model, max_tokens: this.maxTokens, system, messages: [{ role: 'user', content: user }],
      });
    } catch (err) {
      throw new NextWeekGenerationError(`Anthropic API call failed: ${describe(err)}`, { cause: err });
    }

    const raw = response.content
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new NextWeekGenerationError(`LLM response is not valid JSON: ${describe(err)}`, { cause: err });
    }

    const schema = weeklyDetailSchema.safeParse(parsed);
    if (!schema.success) {
      throw new NextWeekGenerationError(
        `WeeklyDetail schema validation failed (${schema.error.issues.length} issue(s))`,
        { validationIssues: schema.error.issues },
      );
    }
    const weeklyDetail: WeeklyDetail = schema.data;

    try {
      validateWeeklyDetailConstraints({ weeklyDetail, macroWeek, athleteProfile: input.profile });
      validateNextWeekVolume(weeklyDetail, frame);
    } catch (err) {
      if (err instanceof WeeklyDetailConstraintError || err instanceof NextWeekGuardError) {
        throw new NextWeekGenerationError(err.message, { violations: err.violations });
      }
      throw err;
    }

    const summary = computeWeeklySummary({ weeklyDetail, macroWeek });
    const annotated = annotateWithComputedFields({ weeklyDetail, summary });
    this.logger.log(`Next-week generated: ${frame.phase}, ${summary.totalWeeklyHours}h, ${weeklyDetail.workouts.length} workouts.`);
    return { frame, weeklyDetail: annotated, appliedSources: extractAppliedSources(annotated) };
  }
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
```

- [ ] **Step 4: Run test, verify pass; lint; commit**

Run: `pnpm --filter @eta/api exec vitest run src/modules/training/next-week-generation.service.test.ts`
Expected: 3 passed. If the happy-path volume guard trips, recompute `okDetail`'s sat/sun split so total = 10.5h exactly (target for anchor 10h × 1.05).
Run: `pnpm --filter @eta/api exec eslint src/modules/training/next-week-generation.service.ts --max-warnings 0`

```bash
git add apps/api/src/modules/training/next-week-generation.service.ts apps/api/src/modules/training/next-week-generation.service.test.ts
git commit -m "feat(api): next-week generation service (LLM expansion + guards)"
```

---

### Task 6: Controller route + module wiring

**Files:**
- Modify: `apps/api/src/modules/training/training.controller.ts`
- Modify: `apps/api/src/modules/training/training.module.ts`
- Test: `apps/api/src/modules/training/training.controller.test.ts` (extend existing)

**Interfaces:**
- Consumes: `NextWeekGenerationService.generate` (Task 5); `AthleteProfileRepository.findByUserId`; `TrainingAnalysisService.analyze`; `KnowledgeBaseLoader`.
- Produces: `GET /training/next-week` → `NextWeekResponse`.

- [ ] **Step 1: Add the route to the controller**

In `apps/api/src/modules/training/training.controller.ts`, add the import and constructor params, and the method. The controller currently injects `analysis`, `narrative`, `config`; add `nextWeek: NextWeekGenerationService` and `profileRepo: AthleteProfileRepository`:

```typescript
// add imports
import type { NextWeekResponse } from '@eta/shared-types';
import { AthleteProfileRepository } from '../../db/repositories/athlete-profile.repository.js';
import { NextWeekGenerationService } from './next-week-generation.service.js';

// add to constructor parameter list:
//   private readonly nextWeek: NextWeekGenerationService,
//   private readonly profileRepo: AthleteProfileRepository,

@Get('next-week')
async getNextWeek(): Promise<NextWeekResponse> {
  const userId = this.config.get('DEV_USER_ID', { infer: true });
  const profile = await this.profileRepo.findByUserId(userId);
  if (!profile) return { status: 'needs_profile' };
  const analysis = await this.analysis.analyze(userId);
  if (!analysis.hasData || !analysis.window) return { status: 'needs_history' };
  try {
    const { frame, weeklyDetail } = await this.nextWeek.generate({ profile, analysis });
    return { status: 'ok', frame, weeklyDetail };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}
```

- [ ] **Step 2: Wire the module**

In `apps/api/src/modules/training/training.module.ts`, add to `providers` (after the existing entries). `AthleteProfileRepository` and `KnowledgeBaseLoader` are plain-class providers; `NextWeekGenerationService` uses a factory (DI + `consistent-type-imports`):

```typescript
import { AthleteProfileRepository } from '../../db/repositories/athlete-profile.repository.js';
import { KnowledgeBaseLoader } from '../plan-generation/knowledge-base.loader.js';
import { NextWeekGenerationService } from './next-week-generation.service.js';

// inside providers: [...existing,
  AthleteProfileRepository,
  KnowledgeBaseLoader,
  {
    provide: NextWeekGenerationService,
    inject: [ConfigService, KnowledgeBaseLoader],
    useFactory: (config: ConfigService<Env, true>, kb: KnowledgeBaseLoader): NextWeekGenerationService =>
      new NextWeekGenerationService(config, kb),
  },
// ]
```

(`KnowledgeBaseLoader` has an `onModuleInit` that loads the KB from disk — Nest invokes it because it is a provider in this module.)

- [ ] **Step 3: Write the controller test**

Extend `apps/api/src/modules/training/training.controller.test.ts` with a describe block. Construct the controller directly with stubs:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { TrainingController } from './training.controller.js';

function controllerWith(opts: { profile: unknown; analysisHasData?: boolean; generate?: () => Promise<unknown> }): TrainingController {
  const config = { get: () => 'user-1' } as never;
  const analysis = { analyze: vi.fn(async () => ({ hasData: opts.analysisHasData ?? true, window: opts.analysisHasData === false ? null : {} })) } as never;
  const narrative = {} as never;
  const profileRepo = { findByUserId: vi.fn(async () => opts.profile) } as never;
  const nextWeek = { generate: vi.fn(opts.generate ?? (async () => ({ frame: { weekStartDate: 'x' }, weeklyDetail: { workouts: [] } }))) } as never;
  return new TrainingController(analysis, narrative, config, nextWeek, profileRepo);
}

describe('GET /training/next-week', () => {
  it('returns needs_profile when no profile exists', async () => {
    const res = await controllerWith({ profile: null }).getNextWeek();
    expect(res).toEqual({ status: 'needs_profile' });
  });
  it('returns needs_history when analysis has no data', async () => {
    const res = await controllerWith({ profile: {}, analysisHasData: false }).getNextWeek();
    expect(res).toEqual({ status: 'needs_history' });
  });
  it('returns ok with frame + weeklyDetail on success', async () => {
    const res = await controllerWith({ profile: {} }).getNextWeek();
    expect(res.status).toBe('ok');
  });
  it('maps a generation error to status:error', async () => {
    const res = await controllerWith({ profile: {}, generate: async () => { throw new Error('boom'); } }).getNextWeek();
    expect(res).toEqual({ status: 'error', message: 'boom' });
  });
});
```

(Match the real `TrainingController` constructor parameter order — adjust the `new TrainingController(...)` argument order if the existing constructor differs.)

- [ ] **Step 4: Run tests, typecheck, lint, commit**

Run: `pnpm --filter @eta/api exec vitest run src/modules/training/training.controller.test.ts`
Expected: existing + 4 new passed.
Run: `pnpm --filter @eta/api exec tsc -p tsconfig.json --noEmit` → clean.
Run: `pnpm --filter @eta/api exec eslint src/modules/training/training.controller.ts src/modules/training/training.module.ts --max-warnings 0`

```bash
git add apps/api/src/modules/training/training.controller.ts apps/api/src/modules/training/training.module.ts apps/api/src/modules/training/training.controller.test.ts
git commit -m "feat(api): GET /training/next-week route + module wiring"
```

---

### Task 7: CLI `pnpm generate:next-week`

**Files:**
- Create: `apps/api/scripts/next-week.ts`
- Modify: `apps/api/package.json` (scripts block)

**Interfaces:**
- Consumes: `AppModule`, `ConfigService`, `NextWeekGenerationService`, `AthleteProfileRepository`, `TrainingAnalysisService`.

- [ ] **Step 1: Write the script** (mirrors `scripts/generate-test-week.ts` boilerplate)

Create `apps/api/scripts/next-week.ts`:

```typescript
/* eslint-disable no-console */
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../src/app.module.js';
import type { Env } from '../src/config/env.schema.js';
import { AthleteProfileRepository } from '../src/db/repositories/athlete-profile.repository.js';
import { TrainingAnalysisService } from '../src/modules/training/training-analysis.service.js';
import { NextWeekGenerationService } from '../src/modules/training/next-week-generation.service.js';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: false });
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const userId = config.get('DEV_USER_ID', { infer: true });

  const profile = await app.get(AthleteProfileRepository).findByUserId(userId);
  if (!profile) throw new Error(`No athlete profile for ${userId} — run pnpm seed:profile first.`);
  const analysis = await app.get(TrainingAnalysisService).analyze(userId);
  if (!analysis.hasData) throw new Error('No training history — run pnpm strava:backfill first.');

  const result = await app.get(NextWeekGenerationService).generate({ profile, analysis });
  console.log(JSON.stringify(result, null, 2));
  await app.close();
}

void main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
```

- [ ] **Step 2: Register the script**

In `apps/api/package.json`, add to `scripts`:

```json
"generate:next-week": "node --import @swc-node/register/esm-register scripts/next-week.ts",
```

- [ ] **Step 3: Run live (requires Docker/Postgres + seeded profile + backfilled data), commit**

Run: `cd apps/api && pnpm generate:next-week`
Expected: a JSON object with `frame`, `weeklyDetail` (7-day plan), `appliedSources`. (If it errors on missing profile/data, that confirms the guards — seed/backfill first.)

```bash
git add apps/api/scripts/next-week.ts apps/api/package.json
git commit -m "feat(api): pnpm generate:next-week CLI"
```

---

### Task 8: Web — fetch wrapper, fixture, "Next week" section

**Files:**
- Create: `apps/web/src/api/next-week.ts`
- Create: `apps/web/src/test/fixtures/next-week.fixture.ts`
- Create: `apps/web/src/components/NextWeekPlan.tsx`
- Create: `apps/web/src/components/NextWeekPlan.test.tsx`
- Modify: `apps/web/src/App.tsx` (render `<NextWeekPlan />` under the summary)
- Modify: `apps/web/src/styles.css` (append a small "next-week head" block)

**Interfaces:**
- Consumes: `nextWeekResponseSchema`, `NextWeekResponse`, `NextWeekFrame`, `WeeklyDetail`, `MacroPlanWeek` from `@eta/shared-types`; existing `WeekCard` (`apps/web/src/components/WeekCard.tsx`) which consumes `PlanTreeWeek { weekNumber, macroWeek, weeklyDetail }`.
- Produces: `fetchNextWeek(): Promise<NextWeekResult>`; `<NextWeekPlan>`.

- [ ] **Step 1: Write the fetch wrapper** (mirrors `apps/web/src/api/analysis.ts`)

Create `apps/web/src/api/next-week.ts`:

```typescript
import { nextWeekResponseSchema, type NextWeekResponse } from '@eta/shared-types';

export type NextWeekResult =
  | { status: 'loaded'; response: NextWeekResponse }
  | { status: 'error'; message: string };

export async function fetchNextWeek(fetchImpl: typeof fetch = fetch): Promise<NextWeekResult> {
  try {
    const res = await fetchImpl('/api/training/next-week', { headers: { accept: 'application/json' } });
    if (!res.ok) return { status: 'error', message: `HTTP ${res.status}` };
    const parsed = nextWeekResponseSchema.safeParse(await res.json());
    if (!parsed.success) return { status: 'error', message: `Invalid next-week: ${parsed.error.message}` };
    return { status: 'loaded', response: parsed.data as NextWeekResponse };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}
```

- [ ] **Step 2: Write the fixture**

Create `apps/web/src/test/fixtures/next-week.fixture.ts`:

```typescript
import type { NextWeekResponse } from '@eta/shared-types';

export function makeNextWeekFixture(): Extract<NextWeekResponse, { status: 'ok' }> {
  return {
    status: 'ok',
    frame: {
      weekStartDate: '2026-07-06', phase: 'build_1', isRecoveryWeek: false, targetVolumeHours: 12.5,
      days: [
        { dayOfWeek: 'mon', role: 'rest', disciplines: [], targetDurationMinutes: 0 },
        { dayOfWeek: 'tue', role: 'quality', disciplines: ['bike'], targetDurationMinutes: 75 },
        { dayOfWeek: 'wed', role: 'aerobic', disciplines: ['swim'], targetDurationMinutes: 60 },
        { dayOfWeek: 'thu', role: 'quality', disciplines: ['run'], targetDurationMinutes: 60 },
        { dayOfWeek: 'fri', role: 'long', disciplines: ['run'], targetDurationMinutes: 90 },
        { dayOfWeek: 'sat', role: 'aerobic', disciplines: ['swim'], targetDurationMinutes: 60 },
        { dayOfWeek: 'sun', role: 'long', disciplines: ['bike'], targetDurationMinutes: 180 },
      ],
      rationale: { weeksUntilRace: 8, volumeAnchorHours: 11.6, rampPct: 0.08, easeTriggered: false },
    },
    weeklyDetail: {
      weekNumber: 1, weekStartDate: '2026-07-06', phase: 'build_1', weeklyTotalHours: 12.5,
      workouts: [
        {
          workoutCode: 'B/AE1', discipline: 'bike', date: '2026-07-12', totalDurationSeconds: 10800,
          segments: [
            { label: 'Warmup', durationSeconds: 600, zone: 'z1', description: 'Easy spin' },
            { label: 'Main', durationSeconds: 9600, zone: 'z2', description: 'Steady aerobic' },
            { label: 'Cooldown', durationSeconds: 600, zone: 'z1', description: 'Easy spin' },
          ],
          rationale: 'Long aerobic ride to build the bike base.', citation: 'knowledge-base/03-workouts.md#b-ae1',
        },
      ],
    },
  };
}
```

- [ ] **Step 3: Write the failing component test**

Create `apps/web/src/components/NextWeekPlan.test.tsx`:

```typescript
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { makeNextWeekFixture } from '../test/fixtures/next-week.fixture.js';
import type { NextWeekResult } from '../api/next-week.js';
import { NextWeekPlan } from './NextWeekPlan.js';

const ok = (): Promise<NextWeekResult> => Promise.resolve({ status: 'loaded', response: makeNextWeekFixture() });

test('shows a Generate button and renders the week after clicking', async () => {
  render(<NextWeekPlan fetchNextWeekImpl={ok} />);
  const btn = screen.getByRole('button', { name: /generate next week/i });
  fireEvent.click(btn);
  await waitFor(() => expect(screen.getByText(/build_1/i)).toBeInTheDocument());
  expect(screen.getByText(/12\.5/)).toBeInTheDocument(); // target volume in the "why" strip
});

test('renders the needs_profile prompt', async () => {
  const needsProfile = (): Promise<NextWeekResult> => Promise.resolve({ status: 'loaded', response: { status: 'needs_profile' } });
  render(<NextWeekPlan fetchNextWeekImpl={needsProfile} />);
  fireEvent.click(screen.getByRole('button', { name: /generate next week/i }));
  await waitFor(() => expect(screen.getByText(/profile/i)).toBeInTheDocument());
});

test('calls the fetcher exactly once per click (no render loop)', async () => {
  const spy = vi.fn(ok);
  render(<NextWeekPlan fetchNextWeekImpl={spy} />);
  fireEvent.click(screen.getByRole('button', { name: /generate next week/i }));
  await waitFor(() => expect(screen.getByText(/build_1/i)).toBeInTheDocument());
  expect(spy).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 4: Run test, verify it fails**

Run: `pnpm --filter @eta/web exec vitest run src/components/NextWeekPlan.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 5: Write the component**

Create `apps/web/src/components/NextWeekPlan.tsx`. It is button-triggered (no mount fetch → no render-loop risk), and adapts the response into the `PlanTreeWeek` shape `WeekCard` expects:

```typescript
import { useCallback, useState } from 'react';
import type { MacroPlanWeek, NextWeekFrame, WeeklyDetail } from '@eta/shared-types';
import { fetchNextWeek, type NextWeekResult } from '../api/next-week.js';
import { WeekCard } from './WeekCard.js';

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; result: NextWeekResult };

const RAMP = (pct: number): string => `${pct >= 0 ? '+' : ''}${Math.round(pct * 100)}%`;

function toPlanTreeWeek(frame: NextWeekFrame, weeklyDetail: WeeklyDetail): {
  weekNumber: number; macroWeek: MacroPlanWeek; weeklyDetail: WeeklyDetail;
} {
  const macroWeek: MacroPlanWeek = {
    weekNumber: 1, weekStartDate: frame.weekStartDate, phase: frame.phase,
    isRecoveryWeek: frame.isRecoveryWeek, weeklyVolumeHours: frame.targetVolumeHours, keySessions: [],
  };
  return { weekNumber: 1, macroWeek, weeklyDetail };
}

export function NextWeekPlan({
  fetchNextWeekImpl = fetchNextWeek,
}: {
  fetchNextWeekImpl?: () => Promise<NextWeekResult>;
} = {}): JSX.Element {
  const [state, setState] = useState<State>({ kind: 'idle' });

  const generate = useCallback(() => {
    setState({ kind: 'loading' });
    void fetchNextWeekImpl().then((result) => setState({ kind: 'loaded', result }));
  }, [fetchNextWeekImpl]);

  return (
    <section className="next-week">
      <div className="next-week-bar">
        <h2>Next week</h2>
        <button type="button" onClick={generate} disabled={state.kind === 'loading'}>
          {state.kind === 'loaded' ? 'Regenerate' : 'Generate next week'}
        </button>
      </div>

      {state.kind === 'loading' ? <p className="status loading">Building your week…</p> : null}

      {state.kind === 'loaded' ? renderResult(state.result) : null}
    </section>
  );

  function renderResult(result: NextWeekResult): JSX.Element {
    if (result.status === 'error') return <p className="status error">Couldn’t build next week: {result.message}</p>;
    const r = result.response;
    if (r.status === 'needs_profile') return <p className="status empty">Seed an athlete profile first (it sets your race date and capacity).</p>;
    if (r.status === 'needs_history') return <p className="status empty">No recent training found — sync Strava, then try again.</p>;
    if (r.status === 'error') return <p className="status error">Couldn’t build next week: {r.message}</p>;
    return (
      <>
        <p className="next-week-why">
          <span className={`phase-tag phase-${r.frame.phase}`}>{r.frame.phase.replace('_', ' ')}</span>
          {r.frame.isRecoveryWeek ? <span className="recovery-tag">recovery</span> : null}
          <span className="why-vol">~{r.frame.targetVolumeHours}h</span>
          <span className="why-detail">
            {RAMP(r.frame.rationale.rampPct)} on your {r.frame.rationale.volumeAnchorHours}h recent average ·
            {' '}{r.frame.rationale.weeksUntilRace} weeks to race
          </span>
        </p>
        <WeekCard week={toPlanTreeWeek(r.frame, r.weeklyDetail)} isCurrent />
      </>
    );
  }
}
```

- [ ] **Step 6: Render it in `App`**

In `apps/web/src/App.tsx`, import and render `<NextWeekPlan />` directly after `<TrainingSummary ... />` (inside the same `<main className="app">`):

```typescript
import { NextWeekPlan } from './components/NextWeekPlan.js';
// ...
<TrainingSummary analysis={result.analysis} />
<NextWeekPlan />
```

- [ ] **Step 7: Append styles**

Append to `apps/web/src/styles.css`:

```css
/* ── Next week ─────────────────────────────────────────────────────────── */
.next-week { margin-top: 28px; display: flex; flex-direction: column; gap: 16px; }
.next-week-bar { display: flex; align-items: center; justify-content: space-between; }
.next-week-bar h2 { font-family: var(--font-display); font-weight: 400; font-size: 28px; text-transform: uppercase; margin: 0; }
.next-week-why { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; margin: 0; font-family: var(--font-mono); font-size: 12px; color: var(--text-2); }
.next-week-why .phase-tag { text-transform: uppercase; letter-spacing: 0.08em; color: var(--volt); border: 1px solid var(--line-2); border-radius: 999px; padding: 2px 10px; }
.next-week-why .recovery-tag { color: var(--cyan); }
.next-week-why .why-vol { color: var(--text); font-size: 14px; }
.next-week-why .why-detail { color: var(--text-3); }
```

- [ ] **Step 8: Run web tests, typecheck, lint, commit**

Run: `pnpm --filter @eta/web exec vitest run`
Expected: all passed (existing + 3 new).
Run: `pnpm --filter @eta/web exec tsc -p tsconfig.json --noEmit` → clean.
Run: `pnpm --filter @eta/web lint` → clean.

```bash
git add apps/web/src/api/next-week.ts apps/web/src/test/fixtures/next-week.fixture.ts apps/web/src/components/NextWeekPlan.tsx apps/web/src/components/NextWeekPlan.test.tsx apps/web/src/App.tsx apps/web/src/styles.css
git commit -m "feat(web): Next week section — generate + render the upcoming plan"
```

---

### Task 9: Live verification

**Files:** none (manual).

- [ ] **Step 1: Start servers** (Docker/Postgres up; profile seeded; data backfilled)

Run: `pnpm dev:api` and `pnpm dev:web`. Confirm `GET /api/training/next-week` returns `status: ok`.

- [ ] **Step 2: Browser check**

Open the web app, click **Generate next week**. Confirm: the "why" strip shows phase + target volume + ramp; the week renders 6 training days with detailed segmented workouts and the rest day empty; long sessions are on Fri/Sun; Regenerate produces a fresh-but-still-safe week. Loading and error states behave.

- [ ] **Step 3: Update project memory**

Note in `project_web_viewer.md` that Slice B (next-week generator) shipped: stateless `GET /training/next-week`, deterministic frame + LLM expansion, reuses WeekCard. Record any new gotchas.

---

## Self-Review

**Spec coverage:**
- Inputs (analysis + profile race date/capacity) → Tasks 2, 6. ✓
- Phase from event date → Task 2 (`phaseForWeeksUntilRace`). ✓
- Volume anchor + ramp + 10% cap + auto-ease → Task 2. ✓
- Day skeleton (rest/long/quality/aerobic, caps, sport nudge) → Task 2. ✓
- Detailed `WeeklyDetail` output → Tasks 1, 5 (reuses existing contract). ✓
- LLM expansion mirroring Pass 2 + KB slice + guards → Tasks 4, 5. ✓
- Postprocess: reuse `validateWeeklyDetailConstraints`/`computeWeeklySummary`/`annotate` + new ±10% & hard-session guards → Tasks 3, 5. ✓
- API `GET /training/next-week` with `ok`/`needs_profile`/`needs_history`/`error` → Tasks 1, 6. ✓
- Web "Next week" section with WeekCard reuse + generate/regenerate + states → Task 8. ✓
- CLI `pnpm generate:next-week` → Task 7. ✓
- Testing (frame unit tests, mocked-LLM service tests, guards, web states, render-loop) → Tasks 2,3,5,6,8. ✓
- Stateless v1 (no persistence) → honored; no DB task. ✓

**Placeholder scan:** none — every step carries real code/commands.

**Type consistency:** `buildNextWeekFrame(profile, analysis, asOf)` and `frameToMacroPlanWeek(frame)` (Task 2) are consumed verbatim in Task 5. `validateNextWeekVolume(weeklyDetail, frame)` / `NextWeekGuardError` (Task 3) match Task 5 imports. `buildNextWeekPrompt({frame, analysis, profile, kb})` (Task 4) matches the Task 5 call. `NextWeekResponse` union (Task 1) matches the controller (Task 6) and web wrapper (Task 8). `WeekCard` `PlanTreeWeek` shape matched by `toPlanTreeWeek` (Task 8). Reused pass2 helpers use the exact signatures verified in the codebase.
