import type {
  AdaptationSuggestion,
  AthleteProfile,
  WeeklyDetail,
  WorkoutAdjustment,
  WorkoutCode,
} from '@eta/shared-types';
import { describe, expect, it } from 'vitest';
import {
  Pass3ConstraintError,
  extractAppliedSources,
  reconcileComputedInputs,
  validatePass3Suggestion,
} from './pass3-postprocess.js';
import type { Pass3ComputedInputs } from './types.js';

function sampleProfile(overrides: Partial<AthleteProfile> = {}): AthleteProfile {
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
      runMinutes: { value: 120, confidence: 'high', source: 'self_reported' },
    },
    thresholds: {
      swimTPacePer100m: { value: '1:45', confidence: 'medium', source: 'measured' },
      bikeFtpWatts: { value: 280, confidence: 'high', source: 'measured' },
      bikeThresholdHr: { value: 165, confidence: 'high', source: 'measured' },
      runThresholdPacePerKm: { value: '4:30', confidence: 'high', source: 'measured' },
      runThresholdHr: { value: 170, confidence: 'high', source: 'measured' },
    },
    disciplineDistribution: { swimPercent: 20, bikePercent: 50, runPercent: 30 },
    fitnessTrend: 'stable',
    trainingDaysPerWeek: 6,
    longSessionDays: ['fri', 'sun'],
    mandatoryRestDays: ['mon'],
    maxWeekdaySessionMinutes: 90,
    currentInjuries: [],
    recentIllnessOrTimeOff: false,
    raceHistory: [],
    source: 'questionnaire',
    overallConfidence: 'medium',
    generatedAt: new Date('2026-05-01T00:00:00Z'),
    warnings: [],
    ...overrides,
  };
}

function sampleDraft(): WeeklyDetail {
  // Week 2026-05-11 (Mon) → 2026-05-17 (Sun). Workouts on Tue, Thu, Fri.
  return {
    weekNumber: 15,
    weekStartDate: '2026-05-11',
    phase: 'base_3',
    workouts: [
      {
        workoutCode: 'C/AE1',
        discipline: 'bike',
        date: '2026-05-12',
        totalDurationSeconds: 3600,
        segments: [
          { label: 'Warmup', durationSeconds: 600, zone: 'z1', description: 'wu' },
          { label: 'Main set', durationSeconds: 2400, zone: 'z2', description: 'main' },
          { label: 'Cooldown', durationSeconds: 600, zone: 'z1', description: 'cd' },
        ],
        rationale: 'r',
        citation: 'knowledge-base/03-workouts.md#c-ae1',
      },
      {
        workoutCode: 'C/ME1',
        discipline: 'bike',
        date: '2026-05-14',
        totalDurationSeconds: 4500,
        segments: [
          { label: 'Warmup', durationSeconds: 900, zone: 'z2', description: 'wu' },
          { label: 'Main set', durationSeconds: 2700, zone: 'z4', description: 'main' },
          { label: 'Cooldown', durationSeconds: 900, zone: 'z1', description: 'cd' },
        ],
        rationale: 'r',
        citation: 'knowledge-base/03-workouts.md#c-me1',
      },
      {
        workoutCode: 'D/AE2',
        discipline: 'run',
        date: '2026-05-15',
        totalDurationSeconds: 6300,
        segments: [
          { label: 'Warmup', durationSeconds: 600, zone: 'z1', description: 'wu' },
          { label: 'Main set', durationSeconds: 5400, zone: 'z2', description: 'main' },
          { label: 'Cooldown', durationSeconds: 300, zone: 'z1', description: 'cd' },
        ],
        rationale: 'r',
        citation: 'knowledge-base/03-workouts.md#d-ae2',
      },
    ],
  };
}

function keepAdjustment(date: string, code: WorkoutCode): WorkoutAdjustment {
  return {
    originalDate: date,
    originalWorkoutCode: code,
    action: 'keep',
    reasoning: 'within readiness band, no signal to change.',
    citation: 'knowledge-base/02-atp-structure.md#base-3',
  };
}

function validSuggestion(overrides: Partial<AdaptationSuggestion> = {}): AdaptationSuggestion {
  return {
    forWeekStart: '2026-05-11',
    generatedAt: '2026-05-10T22:00:00Z',
    inputs: {
      lastWeekTss: 420,
      currentCtl: 65,
      currentAtl: 78,
      currentTsb: -13,
      avgReadinessLast7d: 50,
    },
    adjustments: [
      keepAdjustment('2026-05-12', 'C/AE1'),
      keepAdjustment('2026-05-14', 'C/ME1'),
      keepAdjustment('2026-05-15', 'D/AE2'),
    ],
    ...overrides,
  };
}

describe('validatePass3Suggestion', () => {
  it('passes for an all-keep suggestion that covers every draft workout', () => {
    expect(() =>
      validatePass3Suggestion({
        suggestion: validSuggestion(),
        weeklyDraft: sampleDraft(),
        athleteProfile: sampleProfile(),
      }),
    ).not.toThrow();
  });

  it('throws when forWeekStart does not match draft.weekStartDate', () => {
    const sug = validSuggestion({ forWeekStart: '2026-05-18' });
    try {
      validatePass3Suggestion({
        suggestion: sug,
        weeklyDraft: sampleDraft(),
        athleteProfile: sampleProfile(),
      });
      expect.fail('should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(Pass3ConstraintError);
      expect((err as Pass3ConstraintError).violations[0]).toMatch(/forWeekStart mismatch/);
    }
  });

  it('throws when a draft workout has no matching adjustment', () => {
    const sug = validSuggestion({
      adjustments: [keepAdjustment('2026-05-12', 'C/AE1'), keepAdjustment('2026-05-14', 'C/ME1')],
    });
    try {
      validatePass3Suggestion({
        suggestion: sug,
        weeklyDraft: sampleDraft(),
        athleteProfile: sampleProfile(),
      });
      expect.fail('should throw');
    } catch (err) {
      expect((err as Pass3ConstraintError).violations.some((v) => /Missing adjustment for D\/AE2/.test(v))).toBe(true);
    }
  });

  it('throws when an adjustment targets a workout not in the draft', () => {
    const sug = validSuggestion({
      adjustments: [
        keepAdjustment('2026-05-12', 'C/AE1'),
        keepAdjustment('2026-05-14', 'C/ME1'),
        keepAdjustment('2026-05-15', 'D/AE2'),
        keepAdjustment('2026-05-16', 'B/AE1'),
      ],
    });
    try {
      validatePass3Suggestion({
        suggestion: sug,
        weeklyDraft: sampleDraft(),
        athleteProfile: sampleProfile(),
      });
      expect.fail('should throw');
    } catch (err) {
      expect((err as Pass3ConstraintError).violations.some((v) => /Extra adjustment for B\/AE1/.test(v))).toBe(true);
    }
  });

  it('throws when adjustments are out of date order', () => {
    const sug = validSuggestion({
      adjustments: [
        keepAdjustment('2026-05-15', 'D/AE2'),
        keepAdjustment('2026-05-12', 'C/AE1'),
        keepAdjustment('2026-05-14', 'C/ME1'),
      ],
    });
    try {
      validatePass3Suggestion({
        suggestion: sug,
        weeklyDraft: sampleDraft(),
        athleteProfile: sampleProfile(),
      });
      expect.fail('should throw');
    } catch (err) {
      expect((err as Pass3ConstraintError).violations.some((v) => /out of order/.test(v))).toBe(true);
    }
  });

  it('throws when newDate is outside the upcoming week', () => {
    const sug = validSuggestion();
    sug.adjustments[1] = {
      originalDate: '2026-05-14',
      originalWorkoutCode: 'C/ME1',
      action: 'modify',
      newDate: '2026-05-22', // outside the 2026-05-11..2026-05-17 window
      reasoning: 'shift',
      citation: 'knowledge-base/04-weekly-templates.md#workout-placement-rules',
    };
    try {
      validatePass3Suggestion({
        suggestion: sug,
        weeklyDraft: sampleDraft(),
        athleteProfile: sampleProfile(),
      });
      expect.fail('should throw');
    } catch (err) {
      expect((err as Pass3ConstraintError).violations.some((v) => /falls outside the week/.test(v))).toBe(true);
    }
  });

  it('throws when an adjustment effective day lands on a mandatoryRestDay', () => {
    const sug = validSuggestion();
    sug.adjustments[0] = {
      originalDate: '2026-05-12',
      originalWorkoutCode: 'C/AE1',
      action: 'modify',
      newDate: '2026-05-11', // Mon = mandatoryRestDay in sampleProfile
      reasoning: 'shift',
      citation: 'knowledge-base/04-weekly-templates.md#workout-placement-rules',
    };
    try {
      validatePass3Suggestion({
        suggestion: sug,
        weeklyDraft: sampleDraft(),
        athleteProfile: sampleProfile(),
      });
      expect.fail('should throw');
    } catch (err) {
      expect((err as Pass3ConstraintError).violations.some((v) => /mandatoryRestDay/.test(v))).toBe(true);
    }
  });

  it('throws when a replace puts a long-session code on a non-longSessionDay', () => {
    const sug = validSuggestion();
    sug.adjustments[0] = {
      originalDate: '2026-05-12',
      originalWorkoutCode: 'C/AE1',
      action: 'replace',
      newWorkoutCode: 'D/AE2', // long-session run on Tue (not in longSessionDays=[fri,sun])
      reasoning: 'swap',
      citation: 'knowledge-base/03-workouts.md#d-ae2',
    };
    try {
      validatePass3Suggestion({
        suggestion: sug,
        weeklyDraft: sampleDraft(),
        athleteProfile: sampleProfile(),
      });
      expect.fail('should throw');
    } catch (err) {
      expect((err as Pass3ConstraintError).violations.some((v) => /long-session code on tue/.test(v))).toBe(true);
    }
  });

  it('accepts a replace that keeps a long-session workout on its longSessionDay', () => {
    const sug = validSuggestion();
    sug.adjustments[2] = {
      originalDate: '2026-05-15',
      originalWorkoutCode: 'D/AE2',
      action: 'replace',
      newWorkoutCode: 'D/AE1', // recovery run, not long-session — OK on fri
      reasoning: 'low readiness — swap long run for recovery run',
      citation: 'knowledge-base/05-recovery.md#recovery-indicators',
    };
    expect(() =>
      validatePass3Suggestion({
        suggestion: sug,
        weeklyDraft: sampleDraft(),
        athleteProfile: sampleProfile(),
      }),
    ).not.toThrow();
  });

  it('throws when a draft workout is duplicated in adjustments', () => {
    const sug = validSuggestion({
      adjustments: [
        keepAdjustment('2026-05-12', 'C/AE1'),
        keepAdjustment('2026-05-12', 'C/AE1'),
        keepAdjustment('2026-05-14', 'C/ME1'),
        keepAdjustment('2026-05-15', 'D/AE2'),
      ],
    });
    try {
      validatePass3Suggestion({
        suggestion: sug,
        weeklyDraft: sampleDraft(),
        athleteProfile: sampleProfile(),
      });
      expect.fail('should throw');
    } catch (err) {
      expect((err as Pass3ConstraintError).violations.some((v) => /Duplicate adjustments/.test(v))).toBe(true);
    }
  });
});

describe('reconcileComputedInputs', () => {
  const baseComputed: Pass3ComputedInputs = {
    lastWeekTss: 420,
    currentCtl: 65.123,
    currentAtl: 78.4,
    currentTsb: -13.2,
    avgReadinessLast7d: 50,
  };

  it('overwrites suggestion.inputs with computed values', () => {
    const sug = validSuggestion({
      inputs: { lastWeekTss: 999, currentCtl: 999, currentAtl: 999, currentTsb: 999, avgReadinessLast7d: 999 },
    });
    const { suggestion } = reconcileComputedInputs({ suggestion: sug, computed: baseComputed });
    expect(suggestion.inputs).toEqual(baseComputed);
  });

  it('reports no drift when echoed values are exact', () => {
    const sug = validSuggestion({ inputs: { ...baseComputed } });
    const { driftedFields } = reconcileComputedInputs({ suggestion: sug, computed: baseComputed });
    expect(driftedFields).toEqual([]);
  });

  it('reports no drift when echoed values are within 1% relative tolerance', () => {
    const sug = validSuggestion({
      inputs: { ...baseComputed, currentCtl: 65.5 }, // ~0.58% drift from 65.123
    });
    const { driftedFields } = reconcileComputedInputs({ suggestion: sug, computed: baseComputed });
    expect(driftedFields).toEqual([]);
  });

  it('reports drift when echoed value drifts more than 1%', () => {
    const sug = validSuggestion({
      inputs: { ...baseComputed, currentCtl: 70 }, // ~7.5% drift
    });
    const { driftedFields } = reconcileComputedInputs({ suggestion: sug, computed: baseComputed });
    expect(driftedFields.some((f) => /currentCtl/.test(f))).toBe(true);
  });

  it('reports drift when computed is zero and echoed value is non-zero', () => {
    const sug = validSuggestion({ inputs: { ...baseComputed, lastWeekTss: 30 } });
    const computed: Pass3ComputedInputs = { ...baseComputed, lastWeekTss: 0 };
    const { driftedFields } = reconcileComputedInputs({ suggestion: sug, computed });
    expect(driftedFields.some((f) => /lastWeekTss/.test(f))).toBe(true);
  });
});

describe('extractAppliedSources', () => {
  it('returns sorted unique citations across adjustments', () => {
    const sug = validSuggestion({
      adjustments: [
        keepAdjustment('2026-05-12', 'C/AE1'),
        {
          originalDate: '2026-05-14',
          originalWorkoutCode: 'C/ME1',
          action: 'modify',
          newZone: 'z3',
          reasoning: 'r',
          citation: 'knowledge-base/05-recovery.md#recovery-indicators',
        },
        keepAdjustment('2026-05-15', 'D/AE2'),
      ],
    });
    expect(extractAppliedSources(sug)).toEqual([
      'knowledge-base/02-atp-structure.md#base-3',
      'knowledge-base/05-recovery.md#recovery-indicators',
    ]);
  });
});
