import { type AdaptationSuggestion, type AthleteProfile, type MacroPlan, type WeeklyDetail, type WorkoutCompleted } from '@eta/shared-types';
import { describe, expect, it } from 'vitest';
import type { PlanTree } from '../../src/modules/plans/plans.service.js';
import { renderTreeHtml } from './tree-html-renderer.js';

function sampleProfile(): AthleteProfile {
  return {
    experienceLevel: 'tri_experienced',
    raceDate: new Date('2026-09-21T00:00:00Z'),
    raceType: 'full_ironman',
    weeksUntilRace: 14,
    recentWeeklyHours: { value: 9, confidence: 'medium', source: 'self_reported' },
    plannedWeeklyHours: 11,
    longestRecentSessions: {
      swimMeters: { value: 3000, confidence: 'high', source: 'self_reported' },
      bikeMinutes: { value: 300, confidence: 'high', source: 'self_reported' },
      runMinutes: { value: 240, confidence: 'high', source: 'self_reported' },
    },
    thresholds: {
      swimTPacePer100m: { value: '2:30', confidence: 'medium', source: 'estimated' },
      bikeFtpWatts: { value: 200, confidence: 'high', source: 'measured' },
      bikeThresholdHr: { value: 165, confidence: 'medium', source: 'estimated' },
      runThresholdPacePerKm: { value: '4:00', confidence: 'high', source: 'self_reported' },
      runThresholdHr: { value: 180, confidence: 'high', source: 'self_reported' },
    },
    disciplineDistribution: { swimPercent: 15, bikePercent: 50, runPercent: 35 },
    fitnessTrend: 'stable',
    trainingDaysPerWeek: 6,
    longSessionDays: ['sat', 'sun'],
    mandatoryRestDays: [],
    maxWeekdaySessionMinutes: 90,
    currentInjuries: [],
    recentIllnessOrTimeOff: false,
    raceHistory: [],
    source: 'mixed',
    overallConfidence: 'medium',
    generatedAt: new Date('2026-06-17T00:00:00Z'),
    warnings: [],
  };
}

function sampleMacroPlan(): MacroPlan {
  return {
    athleteProfileId: 'profile-id-1',
    raceDate: '2026-09-21',
    generatedAt: '2026-06-17T12:00:00Z',
    totalWeeks: 2,
    weeks: [
      { weekNumber: 14, weekStartDate: '2026-06-15', phase: 'base_2', isRecoveryWeek: false, weeklyVolumeHours: 9, keySessions: [] },
      { weekNumber: 13, weekStartDate: '2026-06-22', phase: 'base_2', isRecoveryWeek: false, weeklyVolumeHours: 9.5, keySessions: [] },
    ],
  };
}

function sampleWeeklyDetail(): WeeklyDetail {
  return {
    weekNumber: 14,
    weekStartDate: '2026-06-15',
    phase: 'base_2',
    workouts: [
      {
        workoutCode: 'B/AE1',
        discipline: 'bike',
        date: '2026-06-20',
        totalDurationSeconds: 7200,
        segments: [],
        rationale: 'Anchor.',
        citation: 'kb#x',
      },
    ],
    weeklyTotalHours: 9,
  };
}

function sampleTree(opts: { withDetail?: boolean; withAdaptation?: boolean } = {}): PlanTree {
  const detail = opts.withDetail ? sampleWeeklyDetail() : null;
  const adaptation: AdaptationSuggestion | null = opts.withAdaptation
    ? ({
        forWeekStart: '2026-06-15',
        adjustments: [
          {
            originalDate: '2026-06-20',
            originalWorkoutCode: 'B/AE1',
            action: 'keep',
            reasoning: 'looks good',
            citation: 'kb#y',
          },
        ],
        inputs: {
          lastWeekTss: 0,
          currentCtl: 0,
          currentAtl: 0,
          currentTsb: 0,
          avgReadinessLast7d: 50,
        },
        generatedAt: '2026-06-23T12:00:00Z',
      } as unknown as AdaptationSuggestion)
    : null;

  return {
    macroPlanId: 'macro-plan-id-1',
    athleteProfileId: 'profile-id-1',
    macroPlan: sampleMacroPlan(),
    generatedAt: new Date('2026-06-17T12:00:00Z'),
    weeks: [
      { weekNumber: 14, macroWeek: sampleMacroPlan().weeks[0]!, weeklyDetail: detail },
      { weekNumber: 13, macroWeek: sampleMacroPlan().weeks[1]!, weeklyDetail: null },
    ],
    currentAdaptation: adaptation,
  };
}

describe('renderTreeHtml', () => {
  it('includes the macroPlanId, race date, and all week numbers', () => {
    const html = renderTreeHtml({
      tree: sampleTree(),
      profile: sampleProfile(),
      completedWorkouts: [],
    });
    expect(html).toContain('macro-plan-id-1');
    expect(html).toContain('2026-09-21');
    expect(html).toContain('week 14');
    expect(html).toContain('week 13');
  });

  it('includes the phase label', () => {
    const html = renderTreeHtml({
      tree: sampleTree(),
      profile: sampleProfile(),
      completedWorkouts: [],
    });
    expect(html.toLowerCase()).toContain('base_2');
  });

  it('renders adaptation card when currentAdaptation is present', () => {
    const html = renderTreeHtml({
      tree: sampleTree({ withAdaptation: true }),
      profile: sampleProfile(),
      completedWorkouts: [],
    });
    expect(html).toContain('adaptation-card');
    expect(html).toContain('looks good');
  });

  it('omits adaptation card when currentAdaptation is null', () => {
    const html = renderTreeHtml({
      tree: sampleTree({ withAdaptation: false }),
      profile: sampleProfile(),
      completedWorkouts: [],
    });
    expect(html).not.toContain('adaptation-card');
  });

  it('shows weekly detail workouts when present', () => {
    const html = renderTreeHtml({
      tree: sampleTree({ withDetail: true }),
      profile: sampleProfile(),
      completedWorkouts: [],
    });
    expect(html).toContain('B/AE1');
    expect(html).toContain('2026-06-20');
  });

  it('marks completed workouts with a ✓ indicator', () => {
    const completed: WorkoutCompleted[] = [
      {
        date: '2026-06-20',
        workoutCode: 'B/AE1',
        discipline: 'bike',
        actualTss: 60,
        tssStatus: 'computed',
        actualDurationSeconds: 3600,
      },
    ];
    const html = renderTreeHtml({
      tree: sampleTree({ withDetail: true }),
      profile: sampleProfile(),
      completedWorkouts: completed,
    });
    expect(html).toContain('✓');
    expect(html).toContain('60');
  });

  it('outputs self-contained HTML with inline styles', () => {
    const html = renderTreeHtml({
      tree: sampleTree(),
      profile: sampleProfile(),
      completedWorkouts: [],
    });
    expect(html).toMatch(/^\s*<!DOCTYPE html>/i);
    expect(html).toContain('<style>');
    expect(html).not.toContain('<link rel="stylesheet"');
    expect(html).not.toContain('<script src=');
  });
});
