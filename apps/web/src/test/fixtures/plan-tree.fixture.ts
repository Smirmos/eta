import type { PlanTree } from '../../api/plan-tree.types.js';

const baseTree: PlanTree = {
  macroPlanId: 'plan-1',
  athleteProfileId: 'profile-1',
  generatedAt: '2026-06-29T00:00:00.000Z',
  macroPlan: {
    athleteProfileId: 'profile-1',
    raceDate: '2026-07-13',
    generatedAt: '2026-06-29T00:00:00.000Z',
    totalWeeks: 2,
    weeks: [
      {
        weekNumber: 2,
        weekStartDate: '2026-06-29',
        phase: 'base_3',
        weeklyVolumeHours: 9,
        isRecoveryWeek: false,
        keySessions: [
          {
            workoutCode: 'B/AE2',
            discipline: 'bike',
            dayOfWeek: 'mon',
            rationale: 'Aerobic endurance base building.',
            citation: 'knowledge-base/03-workouts.md#base-3',
          },
        ],
      },
      {
        weekNumber: 1,
        weekStartDate: '2026-07-06',
        phase: 'peak',
        weeklyVolumeHours: 6,
        isRecoveryWeek: true,
        keySessions: [],
      },
    ],
  },
  weeks: [
    {
      weekNumber: 2,
      macroWeek: {
        weekNumber: 2,
        weekStartDate: '2026-06-29',
        phase: 'base_3',
        weeklyVolumeHours: 9,
        isRecoveryWeek: false,
        keySessions: [
          {
            workoutCode: 'B/AE2',
            discipline: 'bike',
            dayOfWeek: 'mon',
            rationale: 'Aerobic endurance base building.',
            citation: 'knowledge-base/03-workouts.md#base-3',
          },
        ],
      },
      weeklyDetail: {
        weekNumber: 2,
        weekStartDate: '2026-06-29',
        phase: 'base_3',
        workouts: [
          {
            workoutCode: 'B/AE2',
            discipline: 'bike',
            date: '2026-06-30',
            totalDurationSeconds: 3600,
            segments: [
              {
                label: 'Main',
                durationSeconds: 3600,
                zone: 'z2',
                description: 'Steady aerobic ride.',
              },
            ],
            rationale: 'Aerobic base.',
            citation: 'knowledge-base/03-workouts.md#B-AE2',
          },
        ],
      },
    },
    {
      weekNumber: 1,
      macroWeek: {
        weekNumber: 1,
        weekStartDate: '2026-07-06',
        phase: 'peak',
        weeklyVolumeHours: 6,
        isRecoveryWeek: true,
        keySessions: [],
      },
      weeklyDetail: null,
    },
  ],
  currentAdaptation: {
    forWeekStart: '2026-06-29',
    generatedAt: '2026-06-29T00:00:00.000Z',
    inputs: {
      lastWeekTss: 280,
      currentCtl: 65,
      currentAtl: 70,
      currentTsb: -5,
      avgReadinessLast7d: 7.2,
    },
    weekLevelNote: 'Ease into the block.',
    adjustments: [
      {
        action: 'modify',
        originalWorkoutCode: 'B/AE2',
        originalDate: '2026-06-30',
        newDurationSeconds: 3000,
        reasoning: 'Reduce load given accumulated fatigue.',
        citation: 'knowledge-base/03-workouts.md#B-AE2',
      },
    ],
  },
};

export function makePlanTreeFixture(overrides: Partial<PlanTree> = {}): PlanTree {
  return { ...structuredClone(baseTree), ...overrides };
}
