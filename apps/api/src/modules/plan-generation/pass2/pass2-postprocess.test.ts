import type {
  AthleteProfile,
  MacroPlanWeek,
  PlannedWorkout,
  WeeklyDetail,
  WorkoutSegment,
} from '@eta/shared-types';
import { describe, expect, it } from 'vitest';
import {
  WeeklyDetailConstraintError,
  annotateWithComputedFields,
  computeWeeklySummary,
  extractAppliedSources,
  plannedTssForWorkout,
  plannedTssRounded,
  validateWeeklyDetailConstraints,
} from './pass2-postprocess.js';

// ─── Fixture builders ───────────────────────────────────────────────────────

function makeSegment(overrides: Partial<WorkoutSegment> = {}): WorkoutSegment {
  return {
    label: 'Main set',
    durationSeconds: 3600,
    zone: 'z2',
    description: 'main set body',
    ...overrides,
  };
}

function makeWorkout(overrides: Partial<PlannedWorkout> = {}): PlannedWorkout {
  const segments = overrides.segments ?? [
    makeSegment({ label: 'Warmup', durationSeconds: 600, zone: 'z1' }),
    makeSegment({ label: 'Main set', durationSeconds: 1800, zone: 'z2' }),
    makeSegment({ label: 'Cooldown', durationSeconds: 600, zone: 'z1' }),
  ];
  const total = segments.reduce((acc, s) => acc + s.durationSeconds, 0);
  return {
    workoutCode: 'C/AE2',
    discipline: 'bike',
    date: '2026-05-17',
    totalDurationSeconds: total,
    segments,
    rationale: 'Long aerobic ride',
    citation: 'knowledge-base/03-workouts.md#c-ae2',
    ...overrides,
  };
}

function makeWeekly(overrides: Partial<WeeklyDetail> = {}): WeeklyDetail {
  return {
    weekNumber: 15,
    weekStartDate: '2026-05-11',
    phase: 'base_3',
    workouts: [makeWorkout()],
    ...overrides,
  };
}

function makeMacroWeek(overrides: Partial<MacroPlanWeek> = {}): MacroPlanWeek {
  return {
    weekNumber: 15,
    weekStartDate: '2026-05-11',
    phase: 'base_3',
    isRecoveryWeek: false,
    weeklyVolumeHours: 9.5,
    keySessions: [],
    ...overrides,
  };
}

function makeProfile(overrides: Partial<AthleteProfile> = {}): AthleteProfile {
  return {
    experienceLevel: 'tri_experienced',
    raceDate: new Date('2026-08-22T00:00:00Z'),
    raceType: 'full_ironman',
    weeksUntilRace: 15,
    recentWeeklyHours: { value: 9, confidence: 'medium', source: 'self_reported' },
    plannedWeeklyHours: 11,
    longestRecentSessions: {
      swimMeters: { value: 3000, confidence: 'high', source: 'self_reported' },
      bikeMinutes: { value: 300, confidence: 'high', source: 'self_reported' },
      runMinutes: { value: 240, confidence: 'high', source: 'self_reported' },
    },
    thresholds: {
      swimTPacePer100m: { value: '2:30', confidence: 'medium', source: 'estimated' },
      bikeFtpWatts: { value: 170, confidence: 'medium', source: 'estimated' },
      bikeThresholdHr: { value: 165, confidence: 'medium', source: 'estimated' },
      runThresholdPacePerKm: { value: '4:00', confidence: 'high', source: 'self_reported' },
      runThresholdHr: { value: 180, confidence: 'high', source: 'self_reported' },
    },
    disciplineDistribution: { swimPercent: 15, bikePercent: 50, runPercent: 35 },
    fitnessTrend: 'stable',
    trainingDaysPerWeek: 6,
    longSessionDays: ['fri', 'sun'],
    mandatoryRestDays: [],
    maxWeekdaySessionMinutes: 90,
    currentInjuries: [],
    recentIllnessOrTimeOff: false,
    raceHistory: [],
    source: 'mixed',
    overallConfidence: 'medium',
    generatedAt: new Date('2026-05-07T00:00:00Z'),
    warnings: [],
    ...overrides,
  };
}

// ─── plannedTssForWorkout ───────────────────────────────────────────────────

describe('plannedTssForWorkout', () => {
  it('computes bike TSS as durationHours × IF² × 100 with zone-band-midpoint IF', () => {
    // Single 1h segment at z2 → bike IF=0.655. Expected TSS = 1 × 0.655² × 100 = 42.9025.
    const wo = makeWorkout({
      discipline: 'bike',
      segments: [makeSegment({ durationSeconds: 3600, zone: 'z2' })],
      totalDurationSeconds: 3600,
    });
    expect(plannedTssForWorkout(wo)).toBeCloseTo(42.9, 1);
  });

  it('computes run TSS with the pace-IF table (z2 = 0.823)', () => {
    const wo = makeWorkout({
      discipline: 'run',
      segments: [makeSegment({ durationSeconds: 3600, zone: 'z2' })],
      totalDurationSeconds: 3600,
    });
    // 1 × 0.823² × 100 = 67.7329
    expect(plannedTssForWorkout(wo)).toBeCloseTo(67.7, 1);
  });

  it('computes swim TSS with IF³ (not IF²)', () => {
    // Swim z2 (pace IF=0.823). 1h × 0.823³ × 100 = 55.7 (vs run/bike's IF² which would give 67.7).
    const wo = makeWorkout({
      discipline: 'swim',
      segments: [makeSegment({ durationSeconds: 3600, zone: 'z2' })],
      totalDurationSeconds: 3600,
    });
    expect(plannedTssForWorkout(wo)).toBeCloseTo(55.7, 1);
  });

  it("weights IF by segment duration when a workout has multiple zones", () => {
    // Bike workout: 600s z1 (IF=0.45) + 1800s z4 (IF=0.98) + 600s z1 (IF=0.45). Total 3000s.
    // Weighted IF = (600×0.45 + 1800×0.98 + 600×0.45) / 3000 = (270 + 1764 + 270) / 3000 = 0.768
    // hours = 3000/3600 = 0.8333. TSS = 0.8333 × 0.768² × 100 = 49.15.
    const wo = makeWorkout({
      discipline: 'bike',
      segments: [
        makeSegment({ label: 'Warmup', durationSeconds: 600, zone: 'z1' }),
        makeSegment({ label: 'Main set', durationSeconds: 1800, zone: 'z4' }),
        makeSegment({ label: 'Cooldown', durationSeconds: 600, zone: 'z1' }),
      ],
      totalDurationSeconds: 3000,
    });
    expect(plannedTssForWorkout(wo)).toBeCloseTo(49.2, 0);
  });

  it("uses the 'mixed' fallback IF (0.85) for main sets that alternate work/recovery", () => {
    // 1h bike, all 'mixed'. TSS = 1 × 0.85² × 100 = 72.25.
    const wo = makeWorkout({
      discipline: 'bike',
      segments: [makeSegment({ durationSeconds: 3600, zone: 'mixed' })],
      totalDurationSeconds: 3600,
    });
    expect(plannedTssForWorkout(wo)).toBeCloseTo(72.25, 1);
  });

  it("uses the 'easy' fallback IF (0.65) for sub-z1 active recovery", () => {
    const wo = makeWorkout({
      discipline: 'bike',
      segments: [makeSegment({ durationSeconds: 3600, zone: 'easy' })],
      totalDurationSeconds: 3600,
    });
    // 1 × 0.65² × 100 = 42.25
    expect(plannedTssForWorkout(wo)).toBeCloseTo(42.25, 1);
  });

  it('is non-negative for any valid input', () => {
    const wo = makeWorkout();
    expect(plannedTssForWorkout(wo)).toBeGreaterThanOrEqual(0);
  });
});

// ─── validateWeeklyDetailConstraints ────────────────────────────────────────

function expectViolation(
  fn: () => void,
  regex: RegExp,
): void {
  try {
    fn();
    expect.fail(`expected validateWeeklyDetailConstraints to throw a violation matching ${regex}`);
  } catch (err) {
    if (!(err instanceof WeeklyDetailConstraintError)) throw err;
    expect(err.violations.some((v) => regex.test(v))).toBe(true);
  }
}

describe('validateWeeklyDetailConstraints', () => {
  function makeValidInput(): {
    weeklyDetail: WeeklyDetail;
    macroWeek: MacroPlanWeek;
    athleteProfile: AthleteProfile;
  } {
    return {
      weeklyDetail: makeWeekly({
        workouts: [
          // Tue (2026-05-12) bike threshold test, 75 min
          makeWorkout({
            workoutCode: 'C/T1',
            discipline: 'bike',
            date: '2026-05-12',
            totalDurationSeconds: 4500,
            segments: [
              makeSegment({ label: 'Warmup', durationSeconds: 1500, zone: 'z1' }),
              makeSegment({ label: 'Main set', durationSeconds: 1800, zone: 'z4' }),
              makeSegment({ label: 'Cooldown', durationSeconds: 1200, zone: 'z1' }),
            ],
          }),
          // Sun (2026-05-17) long ride, 3h
          makeWorkout({
            workoutCode: 'C/AE2',
            discipline: 'bike',
            date: '2026-05-17',
            totalDurationSeconds: 10800,
            segments: [
              makeSegment({ label: 'Warmup', durationSeconds: 900, zone: 'z1' }),
              makeSegment({ label: 'Main set', durationSeconds: 9000, zone: 'z2' }),
              makeSegment({ label: 'Cooldown', durationSeconds: 900, zone: 'z1' }),
            ],
          }),
        ],
      }),
      macroWeek: makeMacroWeek({
        keySessions: [
          {
            workoutCode: 'C/T1',
            discipline: 'bike',
            dayOfWeek: 'tue',
            rationale: 'Bike FTP test',
            citation: 'knowledge-base/03-workouts.md#c-t1',
          },
          {
            workoutCode: 'C/AE2',
            discipline: 'bike',
            dayOfWeek: 'sun',
            rationale: 'Long aerobic ride',
            citation: 'knowledge-base/03-workouts.md#c-ae2',
          },
        ],
      }),
      athleteProfile: makeProfile({ trainingDaysPerWeek: 2 }),
    };
  }

  it('passes for a valid input', () => {
    expect(() => validateWeeklyDetailConstraints(makeValidInput())).not.toThrow();
  });

  it('throws if weekNumber mismatches the macro week', () => {
    const input = makeValidInput();
    input.weeklyDetail.weekNumber = 14;
    expect(() => validateWeeklyDetailConstraints(input)).toThrowError(WeeklyDetailConstraintError);
  });

  it('throws if weekStartDate mismatches the macro week', () => {
    const input = makeValidInput();
    input.weeklyDetail.weekStartDate = '2026-05-18';
    expectViolation(() => validateWeeklyDetailConstraints(input), /weekStartDate mismatch/);
  });

  it('throws if phase mismatches the macro week', () => {
    const input = makeValidInput();
    input.weeklyDetail.phase = 'base_2';
    expectViolation(() => validateWeeklyDetailConstraints(input), /phase mismatch/);
  });

  it('throws if a macro keySession is missing from the WeeklyDetail', () => {
    const input = makeValidInput();
    input.weeklyDetail.workouts = input.weeklyDetail.workouts.slice(0, 1); // drop Sun ride
    expectViolation(
      () => validateWeeklyDetailConstraints(input),
      /Macro keySession not preserved: C\/AE2/,
    );
  });

  it('throws if a macro keySession has been moved to a different dayOfWeek', () => {
    const input = makeValidInput();
    // Move Sunday's long ride to Saturday — the date no longer matches the macro's "sun" expectation.
    input.weeklyDetail.workouts[1]!.date = '2026-05-16';
    expectViolation(
      () => validateWeeklyDetailConstraints(input),
      /Macro keySession not preserved/,
    );
  });

  it('throws if a long-session workout lands on a day not in longSessionDays', () => {
    const input = makeValidInput();
    // Add a C/AE2 (long-session code) on Saturday (not in ['fri','sun']).
    input.weeklyDetail.workouts.push(
      makeWorkout({
        workoutCode: 'C/AE2',
        date: '2026-05-16',
        totalDurationSeconds: 10800,
        segments: [
          makeSegment({ label: 'Warmup', durationSeconds: 900, zone: 'z1' }),
          makeSegment({ label: 'Main set', durationSeconds: 9000, zone: 'z2' }),
          makeSegment({ label: 'Cooldown', durationSeconds: 900, zone: 'z1' }),
        ],
      }),
    );
    input.athleteProfile.trainingDaysPerWeek = 3;
    expectViolation(() => validateWeeklyDetailConstraints(input), /long session on sat/);
  });

  it('throws if a workout lands on a mandatoryRestDay', () => {
    const input = makeValidInput();
    input.athleteProfile.mandatoryRestDays = ['tue'];
    expectViolation(
      () => validateWeeklyDetailConstraints(input),
      /tue is a mandatoryRestDay/,
    );
  });

  it('throws if a weekday workout (non-long-session-day) exceeds maxWeekdaySessionMinutes', () => {
    const input = makeValidInput();
    // Tuesday workout pushed to 100 min (> 90 cap).
    const seg = input.weeklyDetail.workouts[0]!.segments[1]!;
    seg.durationSeconds = 3600; // main set now 60min
    input.weeklyDetail.workouts[0]!.totalDurationSeconds = 1500 + 3600 + 1200; // 6300s = 105min
    expectViolation(
      () => validateWeeklyDetailConstraints(input),
      /exceeds maxWeekdaySessionMinutes cap/,
    );
  });

  it('does NOT enforce the weekday cap on workouts placed on a longSessionDay', () => {
    const input = makeValidInput();
    // Sunday is in longSessionDays — 180min is fine even though the cap is 90.
    expect(input.weeklyDetail.workouts[1]!.totalDurationSeconds).toBe(10800);
    expect(() => validateWeeklyDetailConstraints(input)).not.toThrow();
  });

  it('throws if workout days exceed trainingDaysPerWeek', () => {
    const input = makeValidInput();
    input.athleteProfile.trainingDaysPerWeek = 1;
    expectViolation(
      () => validateWeeklyDetailConstraints(input),
      /workout days \(2\) exceeds trainingDaysPerWeek \(1\)/,
    );
  });

  it('throws if a workout does not have exactly 3 segments', () => {
    const input = makeValidInput();
    input.weeklyDetail.workouts[0]!.segments = [
      makeSegment({ label: 'Warmup', durationSeconds: 2250, zone: 'z1' }),
      makeSegment({ label: 'Main set', durationSeconds: 2250, zone: 'z4' }),
    ];
    expectViolation(() => validateWeeklyDetailConstraints(input), /expected exactly 3 segments/);
  });

  it('throws if two consecutive days have same-discipline Z4+ workouts', () => {
    const input = makeValidInput();
    input.weeklyDetail.workouts.push(
      // Wed bike with z4 main, consecutive to Tue's z4 bike
      makeWorkout({
        workoutCode: 'C/AE2',
        discipline: 'bike',
        date: '2026-05-13',
        totalDurationSeconds: 4500,
        segments: [
          makeSegment({ label: 'Warmup', durationSeconds: 600, zone: 'z1' }),
          makeSegment({ label: 'Main set', durationSeconds: 3300, zone: 'z4' }),
          makeSegment({ label: 'Cooldown', durationSeconds: 600, zone: 'z1' }),
        ],
      }),
    );
    // Add to macro keySessions too so the "missing keySession" check doesn't trip first.
    input.macroWeek.keySessions.push({
      workoutCode: 'C/AE2',
      discipline: 'bike',
      dayOfWeek: 'wed',
      rationale: 'consecutive hard test',
      citation: 'knowledge-base/03-workouts.md#c-ae2',
    });
    input.athleteProfile.trainingDaysPerWeek = 3;
    expectViolation(
      () => validateWeeklyDetailConstraints(input),
      /Consecutive Z4\+ bike on 2026-05-12 and 2026-05-13/,
    );
  });

  it('allows consecutive hard days across different disciplines', () => {
    const input = makeValidInput();
    // Add a Wed run with z4 — bike Tue then run Wed is OK.
    input.weeklyDetail.workouts.push(
      makeWorkout({
        workoutCode: 'D/ME1',
        discipline: 'run',
        date: '2026-05-13',
        totalDurationSeconds: 3600,
        segments: [
          makeSegment({ label: 'Warmup', durationSeconds: 600, zone: 'z1' }),
          makeSegment({ label: 'Main set', durationSeconds: 2400, zone: 'z4' }),
          makeSegment({ label: 'Cooldown', durationSeconds: 600, zone: 'z1' }),
        ],
      }),
    );
    input.macroWeek.keySessions.push({
      workoutCode: 'D/ME1',
      discipline: 'run',
      dayOfWeek: 'wed',
      rationale: 'run ME',
      citation: 'knowledge-base/03-workouts.md#d-me1',
    });
    input.athleteProfile.trainingDaysPerWeek = 3;
    expect(() => validateWeeklyDetailConstraints(input)).not.toThrow();
  });

  it('throws WeeklyDetailConstraintError with all violations collected', () => {
    const input = makeValidInput();
    input.weeklyDetail.weekNumber = 14; // mismatch 1
    input.weeklyDetail.phase = 'base_2'; // mismatch 2
    try {
      validateWeeklyDetailConstraints(input);
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(WeeklyDetailConstraintError);
      const e = err as WeeklyDetailConstraintError;
      expect(e.violations.length).toBeGreaterThanOrEqual(2);
    }
  });
});

// ─── computeWeeklySummary ───────────────────────────────────────────────────

describe('computeWeeklySummary', () => {
  it('sums totalWeeklyHours and totalWeeklyTss across workouts', () => {
    const weekly = makeWeekly({
      workouts: [
        makeWorkout({ totalDurationSeconds: 3600, discipline: 'bike' }), // 1h
        makeWorkout({
          discipline: 'run',
          totalDurationSeconds: 1800,
          segments: [makeSegment({ durationSeconds: 1800 })],
        }), // 0.5h
      ],
    });
    const summary = computeWeeklySummary({ weeklyDetail: weekly, macroWeek: makeMacroWeek() });
    expect(summary.totalWeeklyHours).toBe(1.5);
    expect(summary.totalWeeklyTss).toBeGreaterThan(0);
  });

  it('attributes each workout to the correct day in dailyTssDistribution', () => {
    const weekly = makeWeekly({
      workouts: [
        makeWorkout({ date: '2026-05-12' }), // Tue
        makeWorkout({ date: '2026-05-15' }), // Fri
      ],
    });
    const summary = computeWeeklySummary({ weeklyDetail: weekly, macroWeek: makeMacroWeek() });
    expect(summary.dailyTssDistribution.tue).toBeGreaterThan(0);
    expect(summary.dailyTssDistribution.fri).toBeGreaterThan(0);
    expect(summary.dailyTssDistribution.mon).toBe(0);
    expect(summary.dailyTssDistribution.wed).toBe(0);
  });

  it('splits disciplineHours per discipline', () => {
    const weekly = makeWeekly({
      workouts: [
        makeWorkout({ discipline: 'swim', totalDurationSeconds: 2700, segments: [makeSegment({ durationSeconds: 2700 })] }),
        makeWorkout({ discipline: 'bike', totalDurationSeconds: 7200, segments: [makeSegment({ durationSeconds: 7200 })] }),
        makeWorkout({ discipline: 'run', totalDurationSeconds: 3600, segments: [makeSegment({ durationSeconds: 3600 })] }),
      ],
    });
    const summary = computeWeeklySummary({ weeklyDetail: weekly, macroWeek: makeMacroWeek() });
    expect(summary.disciplineHours.swim).toBe(0.75);
    expect(summary.disciplineHours.bike).toBe(2);
    expect(summary.disciplineHours.run).toBe(1);
  });

  it('flags an hours-based deviation when the week is >15% off the macro budget', () => {
    const weekly = makeWeekly({
      workouts: [
        makeWorkout({ totalDurationSeconds: 3600, segments: [makeSegment({ durationSeconds: 3600 })] }),
      ],
    });
    const summary = computeWeeklySummary({
      weeklyDetail: weekly,
      macroWeek: makeMacroWeek({ weeklyVolumeHours: 10 }), // 1h vs 10h = 90% under
    });
    expect(
      summary.deviationsFromPhaseExpected.some((d) => /weekly hours/.test(d)),
    ).toBe(true);
  });

  it('does NOT flag an hours-based deviation when within ±15%', () => {
    // 1h vs 1h target = 0% delta
    const weekly = makeWeekly({
      workouts: [
        makeWorkout({ totalDurationSeconds: 3600, segments: [makeSegment({ durationSeconds: 3600 })] }),
      ],
    });
    const summary = computeWeeklySummary({
      weeklyDetail: weekly,
      macroWeek: makeMacroWeek({ weeklyVolumeHours: 1 }),
    });
    expect(summary.deviationsFromPhaseExpected.filter((d) => /weekly hours/.test(d))).toEqual([]);
  });

  it('propagates macro [DEVIATION:] tags with [FROM MACRO] prefix', () => {
    const weekly = makeWeekly();
    const summary = computeWeeklySummary({
      weeklyDetail: weekly,
      macroWeek: makeMacroWeek({
        deviations: [
          '[DEVIATION: skipped Prep, Base 1, Base 2 per Friel p. 187]',
          '[DEVIATION: capped weekly hours]',
        ],
      }),
    });
    expect(summary.deviationsFromPhaseExpected).toContain(
      '[FROM MACRO] [DEVIATION: skipped Prep, Base 1, Base 2 per Friel p. 187]',
    );
    expect(summary.deviationsFromPhaseExpected).toContain(
      '[FROM MACRO] [DEVIATION: capped weekly hours]',
    );
  });

  it('handles a macro week with no deviations array without crashing', () => {
    const weekly = makeWeekly();
    expect(() =>
      computeWeeklySummary({ weeklyDetail: weekly, macroWeek: makeMacroWeek() }),
    ).not.toThrow();
  });
});

// ─── annotateWithComputedFields ─────────────────────────────────────────────

describe('annotateWithComputedFields', () => {
  it('populates expectedTss on every workout', () => {
    const weekly = makeWeekly({
      workouts: [makeWorkout(), makeWorkout({ date: '2026-05-15' })],
    });
    const summary = computeWeeklySummary({ weeklyDetail: weekly, macroWeek: makeMacroWeek() });
    const annotated = annotateWithComputedFields({ weeklyDetail: weekly, summary });
    for (const wo of annotated.workouts) {
      expect(wo.expectedTss).toBeDefined();
      expect(wo.expectedTss!).toBeGreaterThan(0);
    }
  });

  it('populates weeklyTotalTss and weeklyTotalHours from the summary', () => {
    const weekly = makeWeekly();
    const summary = computeWeeklySummary({ weeklyDetail: weekly, macroWeek: makeMacroWeek() });
    const annotated = annotateWithComputedFields({ weeklyDetail: weekly, summary });
    expect(annotated.weeklyTotalHours).toBe(summary.totalWeeklyHours);
    expect(annotated.weeklyTotalTss).toBe(summary.totalWeeklyTss);
  });

  it('does not mutate the input WeeklyDetail', () => {
    const weekly = makeWeekly();
    const summary = computeWeeklySummary({ weeklyDetail: weekly, macroWeek: makeMacroWeek() });
    annotateWithComputedFields({ weeklyDetail: weekly, summary });
    expect(weekly.workouts[0]!.expectedTss).toBeUndefined();
    expect(weekly.weeklyTotalHours).toBeUndefined();
  });
});

// ─── TSS rounding invariant (regression guard) ──────────────────────────────
//
// The v3 audit found a 0.1 drift between sum-of-per-workout-expectedTss
// (494.1) and weeklyTotalTss (494.2). Fix: aggregate from rounded per-workout
// values so all three user-visible numbers agree exactly.

describe('TSS rounding invariant', () => {
  it('plannedTssRounded matches plannedTssForWorkout rounded to 1 decimal', () => {
    const wo = makeWorkout();
    expect(plannedTssRounded(wo)).toBeCloseTo(plannedTssForWorkout(wo), 1);
  });

  it('sum of per-workout expectedTss equals weeklyTotalTss exactly', () => {
    // Six workouts roughly mirroring the v3 fixture so the test exercises a
    // realistic spread of disciplines and durations.
    const weekly = makeWeekly({
      workouts: [
        makeWorkout({ workoutCode: 'B/T2', discipline: 'swim', date: '2026-05-12', totalDurationSeconds: 3600, segments: [makeSegment({ durationSeconds: 1200, zone: 'z1' }), makeSegment({ durationSeconds: 1800, zone: 'z4' }), makeSegment({ durationSeconds: 600, zone: 'z1' })] }),
        makeWorkout({ workoutCode: 'C/T1', discipline: 'bike', date: '2026-05-13', totalDurationSeconds: 4500, segments: [makeSegment({ durationSeconds: 1500, zone: 'z1' }), makeSegment({ durationSeconds: 1800, zone: 'z4' }), makeSegment({ durationSeconds: 1200, zone: 'z1' })] }),
        makeWorkout({ workoutCode: 'B/SS1', discipline: 'swim', date: '2026-05-14', totalDurationSeconds: 2400, segments: [makeSegment({ durationSeconds: 600, zone: 'z1' }), makeSegment({ durationSeconds: 1500, zone: 'easy' }), makeSegment({ durationSeconds: 300, zone: 'z1' })] }),
        makeWorkout({ workoutCode: 'D/AE2', discipline: 'run', date: '2026-05-15', totalDurationSeconds: 6300, segments: [makeSegment({ durationSeconds: 600, zone: 'z1' }), makeSegment({ durationSeconds: 5100, zone: 'z2' }), makeSegment({ durationSeconds: 600, zone: 'z1' })] }),
        makeWorkout({ workoutCode: 'B/AE2', discipline: 'swim', date: '2026-05-16', totalDurationSeconds: 4200, segments: [makeSegment({ durationSeconds: 900, zone: 'z1' }), makeSegment({ durationSeconds: 2700, zone: 'z2' }), makeSegment({ durationSeconds: 600, zone: 'z1' })] }),
        makeWorkout({ workoutCode: 'C/AE2', discipline: 'bike', date: '2026-05-17', totalDurationSeconds: 12600, segments: [makeSegment({ durationSeconds: 900, zone: 'z1' }), makeSegment({ durationSeconds: 10800, zone: 'z2' }), makeSegment({ durationSeconds: 900, zone: 'z1' })] }),
      ],
    });
    const summary = computeWeeklySummary({ weeklyDetail: weekly, macroWeek: makeMacroWeek() });
    const annotated = annotateWithComputedFields({ weeklyDetail: weekly, summary });

    const sumOfExpectedTss = annotated.workouts.reduce((acc, w) => acc + (w.expectedTss ?? 0), 0);
    // Float-sum can introduce a microscopic delta even when each term is 1dp;
    // assert equality at the rounded-to-1dp precision.
    expect(Math.round(sumOfExpectedTss * 10) / 10).toBe(annotated.weeklyTotalTss);
  });

  it('sum of dailyTssDistribution equals weeklyTotalTss exactly', () => {
    const weekly = makeWeekly({
      workouts: [
        makeWorkout({ date: '2026-05-12' }),
        makeWorkout({ date: '2026-05-15', discipline: 'run' }),
        makeWorkout({ date: '2026-05-17', discipline: 'bike' }),
      ],
    });
    const summary = computeWeeklySummary({ weeklyDetail: weekly, macroWeek: makeMacroWeek() });
    const dailySum =
      summary.dailyTssDistribution.mon +
      summary.dailyTssDistribution.tue +
      summary.dailyTssDistribution.wed +
      summary.dailyTssDistribution.thu +
      summary.dailyTssDistribution.fri +
      summary.dailyTssDistribution.sat +
      summary.dailyTssDistribution.sun;
    expect(Math.round(dailySum * 10) / 10).toBe(summary.totalWeeklyTss);
  });

  it('all three views agree on the same per-workout TSS value', () => {
    const weekly = makeWeekly();
    const summary = computeWeeklySummary({ weeklyDetail: weekly, macroWeek: makeMacroWeek() });
    const annotated = annotateWithComputedFields({ weeklyDetail: weekly, summary });
    const wo = annotated.workouts[0]!;
    const day = 'sun'; // makeWorkout default date is 2026-05-17 = Sun
    expect(wo.expectedTss).toBe(summary.dailyTssDistribution[day]);
    expect(wo.expectedTss).toBe(summary.totalWeeklyTss);
  });
});

// ─── extractAppliedSources ──────────────────────────────────────────────────

describe('extractAppliedSources', () => {
  it('returns a deduplicated, sorted list of citations', () => {
    const weekly = makeWeekly({
      workouts: [
        makeWorkout({ citation: 'knowledge-base/03-workouts.md#c-ae2' }),
        makeWorkout({ citation: 'knowledge-base/03-workouts.md#b-ae2' }),
        makeWorkout({ citation: 'knowledge-base/03-workouts.md#c-ae2' }), // dup
      ],
    });
    const sources = extractAppliedSources(weekly);
    expect(sources).toEqual([
      'knowledge-base/03-workouts.md#b-ae2',
      'knowledge-base/03-workouts.md#c-ae2',
    ]);
  });

  it('returns an empty array if there are no workouts', () => {
    const weekly = makeWeekly({ workouts: [] });
    expect(extractAppliedSources(weekly)).toEqual([]);
  });
});
