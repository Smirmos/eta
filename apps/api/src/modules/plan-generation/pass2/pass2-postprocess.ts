import type {
  AthleteProfile,
  DayOfWeek,
  Discipline,
  IntensityZone,
  MacroPlanWeek,
  PlannedWorkout,
  WeeklyDetail,
  WorkoutSegment,
} from '@eta/shared-types';
import { isLongSessionWorkout } from '../plan-generation.service.js';
import type { Pass2ComputedSummary } from './types.js';

const DAY_OFFSET: Record<DayOfWeek, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};

const DAY_BY_INDEX: ReadonlyArray<DayOfWeek> = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
];

function dayOfWeekFromIso(iso: string): DayOfWeek {
  // JS getUTCDay: 0=Sun..6=Sat. Shift so Mon=0..Sun=6.
  const jsDay = new Date(`${iso}T00:00:00Z`).getUTCDay();
  const idx = (jsDay + 6) % 7;
  return DAY_BY_INDEX[idx] as DayOfWeek;
}

// ─── Planned-IF tables (zone-band-midpoint derivation) ──────────────────────
//
// IF values are the midpoint of the % band in Table 4.1 (01-zones.md), inverted
// for the pace disciplines because Friel's FTPa column expresses actual pace
// as a % of threshold pace where higher % means slower.
//
// Bike (FTPo midpoint of band):
//   z1 <56% → 0.45 (assume midpoint 45%)
//   z2 56–75% → 0.655
//   z3 76–90% → 0.83
//   z4 91–105% → 0.98
//   z5a/b 105–120% → 1.125
//   z5c >120% → 1.30 (assume midpoint 130%)
//
// Run (1 / FTPa-midpoint, since pace IF = thresholdPace / actualPace):
//   z1 >129% pace → 1.0/1.30 = 0.77
//   z2 114–129% → 1.0/1.215 = 0.823
//   z3 106–113% → 1.0/1.095 = 0.913
//   z4 101–105% → 1.0/1.03 = 0.971
//   z5a/b 90–100% → 1.0/0.95 = 1.053
//   z5c <90% → 1.0/0.85 = 1.176
//
// Swim uses the same pace-band derivation as run.
//
// 'mixed' (main-set alternating work/recovery): 0.85.
// 'easy' (sub-z1 active recovery): 0.65.
const BIKE_IF_BY_ZONE: Record<IntensityZone | 'mixed' | 'easy', number> = {
  z1: 0.45,
  z2: 0.655,
  z3: 0.83,
  z4: 0.98,
  z5a: 1.125,
  z5b: 1.125,
  z5c: 1.3,
  mixed: 0.85,
  easy: 0.65,
};
const PACE_IF_BY_ZONE: Record<IntensityZone | 'mixed' | 'easy', number> = {
  z1: 0.77,
  z2: 0.823,
  z3: 0.913,
  z4: 0.971,
  z5a: 1.053,
  z5b: 1.053,
  z5c: 1.176,
  mixed: 0.85,
  easy: 0.65,
};

function ifForSegment(segment: WorkoutSegment, discipline: Discipline): number {
  return discipline === 'bike' ? BIKE_IF_BY_ZONE[segment.zone] : PACE_IF_BY_ZONE[segment.zone];
}

// Weighted-by-duration mean IF across a workout's segments.
function workoutIntensityFactor(workout: PlannedWorkout): number {
  let totalDuration = 0;
  let weightedIf = 0;
  for (const seg of workout.segments) {
    weightedIf += ifForSegment(seg, workout.discipline) * seg.durationSeconds;
    totalDuration += seg.durationSeconds;
  }
  if (totalDuration === 0) return 0;
  return weightedIf / totalDuration;
}

// Planned TSS per ETA-17 production formulas:
//   swim: durationHours × IF³ × 100
//   bike + run: durationHours × IF² × 100
export function plannedTssForWorkout(workout: PlannedWorkout): number {
  const if_ = workoutIntensityFactor(workout);
  const hours = workout.totalDurationSeconds / 3600;
  const exponent = workout.discipline === 'swim' ? 3 : 2;
  return hours * if_ ** exponent * 100;
}

// ─── Constraint validation ──────────────────────────────────────────────────

export class WeeklyDetailConstraintError extends Error {
  readonly violations: string[];
  constructor(violations: string[]) {
    super(`WeeklyDetail constraint violations (${violations.length})`);
    this.name = 'WeeklyDetailConstraintError';
    this.violations = violations;
  }
}

export interface ValidateWeeklyDetailInput {
  weeklyDetail: WeeklyDetail;
  macroWeek: MacroPlanWeek;
  athleteProfile: AthleteProfile;
}

export function validateWeeklyDetailConstraints(input: ValidateWeeklyDetailInput): void {
  const { weeklyDetail, macroWeek, athleteProfile } = input;
  const violations: string[] = [];

  // 1. weekNumber and weekStartDate match the macro week.
  if (weeklyDetail.weekNumber !== macroWeek.weekNumber) {
    violations.push(
      `weekNumber mismatch: detail=${weeklyDetail.weekNumber}, macro=${macroWeek.weekNumber}`,
    );
  }
  if (weeklyDetail.weekStartDate !== macroWeek.weekStartDate) {
    violations.push(
      `weekStartDate mismatch: detail=${weeklyDetail.weekStartDate}, macro=${macroWeek.weekStartDate}`,
    );
  }
  if (weeklyDetail.phase !== macroWeek.phase) {
    violations.push(`phase mismatch: detail=${weeklyDetail.phase}, macro=${macroWeek.phase}`);
  }

  // 2. Every keySession appears as a workout on the same dayOfWeek.
  for (const session of macroWeek.keySessions) {
    const expectedDate = isoForDayInWeek(macroWeek.weekStartDate, session.dayOfWeek);
    const match = weeklyDetail.workouts.find(
      (w) =>
        w.date === expectedDate &&
        w.workoutCode === session.workoutCode &&
        w.discipline === session.discipline,
    );
    if (!match) {
      violations.push(
        `Macro keySession not preserved: ${session.workoutCode} (${session.discipline}) on ${session.dayOfWeek} (${expectedDate})`,
      );
    }
  }

  // 3. Long-session-day enforcement.
  for (const wo of weeklyDetail.workouts) {
    if (!isLongSessionWorkout(wo.workoutCode)) continue;
    const day = dayOfWeekFromIso(wo.date);
    if (!athleteProfile.longSessionDays.includes(day)) {
      violations.push(
        `${wo.workoutCode} is a long session on ${day} (${wo.date}), but longSessionDays = [${athleteProfile.longSessionDays.join(', ')}]`,
      );
    }
  }

  // 4. mandatoryRestDays must be empty.
  for (const wo of weeklyDetail.workouts) {
    const day = dayOfWeekFromIso(wo.date);
    if (athleteProfile.mandatoryRestDays.includes(day)) {
      violations.push(
        `${wo.workoutCode} on ${day} (${wo.date}), but ${day} is a mandatoryRestDay`,
      );
    }
  }

  // 5. Weekday duration cap (Mon–Fri, non-long-session-days).
  const capSeconds = athleteProfile.maxWeekdaySessionMinutes * 60;
  for (const wo of weeklyDetail.workouts) {
    const day = dayOfWeekFromIso(wo.date);
    const isWeekday = day !== 'sat' && day !== 'sun';
    const isLongDay = athleteProfile.longSessionDays.includes(day);
    if (isWeekday && !isLongDay && wo.totalDurationSeconds > capSeconds) {
      violations.push(
        `${wo.workoutCode} on ${day}: ${wo.totalDurationSeconds}s exceeds maxWeekdaySessionMinutes cap (${capSeconds}s)`,
      );
    }
  }

  // 6. trainingDaysPerWeek headcount.
  const uniqueDays = new Set(weeklyDetail.workouts.map((w) => w.date));
  if (uniqueDays.size > athleteProfile.trainingDaysPerWeek) {
    violations.push(
      `workout days (${uniqueDays.size}) exceeds trainingDaysPerWeek (${athleteProfile.trainingDaysPerWeek})`,
    );
  }

  // 7. Three-segment structure.
  for (const wo of weeklyDetail.workouts) {
    if (wo.segments.length !== 3) {
      violations.push(
        `${wo.workoutCode} on ${wo.date}: expected exactly 3 segments (Warmup/Main/Cooldown), got ${wo.segments.length}`,
      );
    }
  }

  // 8. No consecutive same-discipline Z4+ days.
  const hardZones = new Set<string>(['z4', 'z5a', 'z5b', 'z5c']);
  const byDate = new Map<string, PlannedWorkout[]>();
  for (const wo of weeklyDetail.workouts) {
    const arr = byDate.get(wo.date) ?? [];
    arr.push(wo);
    byDate.set(wo.date, arr);
  }
  const sortedDates = [...byDate.keys()].sort();
  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = sortedDates[i - 1] as string;
    const currDate = sortedDates[i] as string;
    const dayGap =
      (new Date(`${currDate}T00:00:00Z`).getTime() -
        new Date(`${prevDate}T00:00:00Z`).getTime()) /
      86_400_000;
    if (dayGap !== 1) continue;
    const prevHardByDiscipline = new Set<Discipline>();
    for (const w of byDate.get(prevDate) ?? []) {
      if (w.segments.some((s) => hardZones.has(s.zone))) prevHardByDiscipline.add(w.discipline);
    }
    for (const w of byDate.get(currDate) ?? []) {
      if (
        w.segments.some((s) => hardZones.has(s.zone)) &&
        prevHardByDiscipline.has(w.discipline)
      ) {
        violations.push(
          `Consecutive Z4+ ${w.discipline} on ${prevDate} and ${currDate} (${w.workoutCode}) — same-discipline back-to-back hard not allowed`,
        );
      }
    }
  }

  if (violations.length > 0) {
    throw new WeeklyDetailConstraintError(violations);
  }
}

function isoForDayInWeek(weekStartDate: string, day: DayOfWeek): string {
  const d = new Date(`${weekStartDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + DAY_OFFSET[day]);
  return d.toISOString().slice(0, 10);
}

// ─── Summary computation ────────────────────────────────────────────────────

const DEVIATION_THRESHOLD = 0.15; // ±15% per acceptance criterion

export function computeWeeklySummary(input: {
  weeklyDetail: WeeklyDetail;
  macroWeek: MacroPlanWeek;
}): Pass2ComputedSummary {
  const { weeklyDetail, macroWeek } = input;

  const dailyTss: Record<DayOfWeek, number> = {
    mon: 0,
    tue: 0,
    wed: 0,
    thu: 0,
    fri: 0,
    sat: 0,
    sun: 0,
  };
  const disciplineHours: Record<Discipline, number> = { swim: 0, bike: 0, run: 0 };
  let totalSeconds = 0;
  let totalTss = 0;

  for (const wo of weeklyDetail.workouts) {
    const tss = plannedTssForWorkout(wo);
    const day = dayOfWeekFromIso(wo.date);
    dailyTss[day] += tss;
    disciplineHours[wo.discipline] += wo.totalDurationSeconds / 3600;
    totalSeconds += wo.totalDurationSeconds;
    totalTss += tss;
  }

  const totalHours = totalSeconds / 3600;
  const deviations: string[] = [];

  // Propagate macro-level [DEVIATION:] tags so downstream consumers see the
  // intent context (e.g., compressed timeline, volume cap, phase entry choice)
  // alongside any Pass 2 deviations. Prefix with "[FROM MACRO]" to distinguish
  // inherited reasons from week-level findings.
  if (macroWeek.deviations) {
    for (const d of macroWeek.deviations) {
      deviations.push(`[FROM MACRO] ${d}`);
    }
  }

  // Primary check (Flag E): hours-based.
  const hoursDelta = Math.abs(totalHours - macroWeek.weeklyVolumeHours);
  const hoursPctDelta =
    macroWeek.weeklyVolumeHours === 0 ? 0 : hoursDelta / macroWeek.weeklyVolumeHours;
  if (hoursPctDelta > DEVIATION_THRESHOLD) {
    deviations.push(
      `[DEVIATION: weekly hours ${totalHours.toFixed(2)} vs macro plan ${macroWeek.weeklyVolumeHours} — ${(hoursPctDelta * 100).toFixed(1)}% delta exceeds ±15%]`,
    );
  }

  // Secondary check (Flag E): TSS-based vs phase-typical expectation.
  // Expected weekly TSS = weeklyVolumeHours × phaseTypicalIF² × 100.
  const phaseIf = phaseTypicalIntensityFactor(macroWeek.phase);
  const expectedTss = macroWeek.weeklyVolumeHours * phaseIf ** 2 * 100;
  if (expectedTss > 0) {
    const tssPctDelta = Math.abs(totalTss - expectedTss) / expectedTss;
    if (tssPctDelta > DEVIATION_THRESHOLD) {
      deviations.push(
        `[DEVIATION: weekly TSS ${totalTss.toFixed(0)} vs phase-typical ${expectedTss.toFixed(0)} (phase=${macroWeek.phase}, IF=${phaseIf}) — ${(tssPctDelta * 100).toFixed(1)}% delta]`,
      );
    }
  }

  return {
    totalWeeklyHours: round(totalHours, 2),
    totalWeeklyTss: round(totalTss, 1),
    dailyTssDistribution: dailyTss,
    disciplineHours: {
      swim: round(disciplineHours.swim, 2),
      bike: round(disciplineHours.bike, 2),
      run: round(disciplineHours.run, 2),
    },
    deviationsFromPhaseExpected: deviations,
  };
}

// Phase-typical IF for weekly TSS expectations. Anchors: base phases run
// mostly Z1–Z2 (IF≈0.65); build phases mix Z2 + Z4 (IF≈0.75); peak/race week
// reduce volume but stay race-intensity-flavoured (IF≈0.78). These are
// heuristic anchors for the ±15% deviation flag, not load-bearing for
// individual workout TSS.
function phaseTypicalIntensityFactor(
  phase: MacroPlanWeek['phase'],
): number {
  switch (phase) {
    case 'prep':
    case 'transition':
      return 0.6;
    case 'base_1':
    case 'base_2':
      return 0.65;
    case 'base_3':
      return 0.7;
    case 'build_1':
    case 'build_2':
      return 0.75;
    case 'peak':
    case 'race_week':
      return 0.78;
  }
}

function round(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

// ─── Source extraction ──────────────────────────────────────────────────────

export function extractAppliedSources(weeklyDetail: WeeklyDetail): string[] {
  const set = new Set<string>();
  for (const wo of weeklyDetail.workouts) set.add(wo.citation);
  return [...set].sort();
}

// Post-validation: populate expectedTss on every workout and weekly aggregates
// on the WeeklyDetail (these are code-computed, not LLM-emitted).
export function annotateWithComputedFields(input: {
  weeklyDetail: WeeklyDetail;
  summary: Pass2ComputedSummary;
}): WeeklyDetail {
  const { weeklyDetail, summary } = input;
  return {
    ...weeklyDetail,
    workouts: weeklyDetail.workouts.map((wo) => ({
      ...wo,
      expectedTss: round(plannedTssForWorkout(wo), 1),
    })),
    weeklyTotalTss: summary.totalWeeklyTss,
    weeklyTotalHours: summary.totalWeeklyHours,
  };
}
