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
    // race 2026-09-21 from week start 2026-07-06 ≈ 11 weeks → base_3 (+5%).
    // perWeek is non-monotonic so the auto-ease (strictly-rising) path does NOT fire.
    const f = buildNextWeekFrame(profile(), analysis([10, 12, 11, 13]), asOf);
    expect(f.rationale.easeTriggered).toBe(false);
    expect(f.rationale.volumeAnchorHours).toBeCloseTo(12, 1); // mean of [12,11,13]
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
