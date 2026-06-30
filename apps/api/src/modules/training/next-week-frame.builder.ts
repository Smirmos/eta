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

// Suppress unused-variable lint warning for DAY_INDEX (used for potential future ordering).
void DAY_INDEX;
