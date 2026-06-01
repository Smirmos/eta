import type {
  AthleteProfile,
  DailyReadinessReading,
  WeeklyDetail,
  WorkoutCompleted,
} from '@eta/shared-types';
import type { DailyTss } from '@eta/training-load';
import type { Pass3Input } from '../types.js';

// ─── Shared base ─────────────────────────────────────────────────────────────
// Six-day Base 3 week starting Mon 2026-06-01. Mon is the mandatory rest day;
// long sessions live on Fri (long run) and Sun (long ride). Used as the
// upcoming week's draft across all four scenarios so the only thing that
// differs is what came back from last week.

const WEEK_START = '2026-06-01';
const LAST_WEEK_START = '2026-05-25';

function profile(): AthleteProfile {
  return {
    experienceLevel: 'tri_experienced',
    raceDate: new Date('2027-06-19T00:00:00Z'),
    raceType: 'full_ironman',
    weeksUntilRace: 54,
    recentWeeklyHours: { value: 9, confidence: 'medium', source: 'self_reported' },
    plannedWeeklyHours: 10,
    longestRecentSessions: {
      swimMeters: { value: 3000, confidence: 'high', source: 'self_reported' },
      bikeMinutes: { value: 240, confidence: 'high', source: 'self_reported' },
      runMinutes: { value: 105, confidence: 'high', source: 'self_reported' },
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
    generatedAt: new Date('2026-05-25T00:00:00Z'),
    warnings: [],
  };
}

function weeklyDraft(): WeeklyDetail {
  return {
    weekNumber: 54,
    weekStartDate: WEEK_START,
    phase: 'base_3',
    workouts: [
      // Tue: swim T-test
      {
        workoutCode: 'B/T2',
        discipline: 'swim',
        date: '2026-06-02',
        totalDurationSeconds: 40 * 60,
        segments: [
          { label: 'Warmup', durationSeconds: 600, zone: 'z1', description: '400m easy + drills' },
          { label: 'Main set', durationSeconds: 1500, zone: 'z4', description: '1000m T-test' },
          { label: 'Cooldown', durationSeconds: 300, zone: 'z1', description: '200m easy' },
        ],
        rationale: 'Tuesday swim T-test for re-anchoring pace zones.',
        citation: 'knowledge-base/03-workouts.md#b-t2',
      },
      // Wed: recovery bike
      {
        workoutCode: 'C/AE1',
        discipline: 'bike',
        date: '2026-06-03',
        totalDurationSeconds: 45 * 60,
        segments: [
          { label: 'Warmup', durationSeconds: 300, zone: 'z1', description: 'spin up' },
          { label: 'Main set', durationSeconds: 2100, zone: 'z2', description: 'aerobic spin' },
          { label: 'Cooldown', durationSeconds: 300, zone: 'z1', description: 'easy' },
        ],
        rationale: 'Recovery ride after Tuesday swim and before Thursday bike ME.',
        citation: 'knowledge-base/03-workouts.md#c-ae1',
      },
      // Thu: bike ME (threshold)
      {
        workoutCode: 'C/ME1',
        discipline: 'bike',
        date: '2026-06-04',
        totalDurationSeconds: 75 * 60,
        segments: [
          { label: 'Warmup', durationSeconds: 1200, zone: 'z2', description: '20min zone 2' },
          {
            label: 'Main set',
            durationSeconds: 2700,
            zone: 'z4',
            description: '2×15min Z4 with 5min Z2 between',
          },
          { label: 'Cooldown', durationSeconds: 600, zone: 'z1', description: '10min easy' },
        ],
        rationale: 'Bike ME — first sustained threshold session of the week.',
        citation: 'knowledge-base/03-workouts.md#c-me1',
      },
      // Fri: long run (long session day)
      {
        workoutCode: 'D/AE2',
        discipline: 'run',
        date: '2026-06-05',
        totalDurationSeconds: 90 * 60,
        segments: [
          { label: 'Warmup', durationSeconds: 600, zone: 'z1', description: '10min easy' },
          { label: 'Main set', durationSeconds: 4500, zone: 'z2', description: '75min aerobic' },
          { label: 'Cooldown', durationSeconds: 300, zone: 'z1', description: '5min easy' },
        ],
        rationale: 'Long aerobic run on profile-designated long-session day.',
        citation: 'knowledge-base/03-workouts.md#d-ae2',
      },
      // Sat: swim endurance
      {
        workoutCode: 'B/AE2',
        discipline: 'swim',
        date: '2026-06-06',
        totalDurationSeconds: 60 * 60,
        segments: [
          { label: 'Warmup', durationSeconds: 600, zone: 'z1', description: '400m easy + drills' },
          { label: 'Main set', durationSeconds: 2700, zone: 'z2', description: '5×500m zone 2' },
          { label: 'Cooldown', durationSeconds: 300, zone: 'z1', description: '200m easy' },
        ],
        rationale: 'Swim endurance volume — limiter discipline.',
        citation: 'knowledge-base/03-workouts.md#b-ae2',
      },
      // Sun: long ride (long session day)
      {
        workoutCode: 'C/AE2',
        discipline: 'bike',
        date: '2026-06-07',
        totalDurationSeconds: 210 * 60,
        segments: [
          { label: 'Warmup', durationSeconds: 900, zone: 'z2', description: '15min spin' },
          {
            label: 'Main set',
            durationSeconds: 11_400,
            zone: 'z2',
            description: '3h10m steady zone 2',
          },
          { label: 'Cooldown', durationSeconds: 300, zone: 'z1', description: '5min easy' },
        ],
        rationale: 'Long aerobic ride — primary endurance session of the week.',
        citation: 'knowledge-base/03-workouts.md#c-ae2',
      },
    ],
  };
}

// Convenience: day-N-of-last-week ISO date (n=0 is Mon 2026-05-25).
function lwDate(n: number): string {
  const d = new Date(`${LAST_WEEK_START}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// 7-day stub readiness history covering the window the scenarios use
// (2026-05-25 through 2026-05-31 inclusive, i.e. WEEK_START − 7d ... − 1d).
function flatReadinessHistory(score: number): DailyReadinessReading[] {
  return [0, 1, 2, 3, 4, 5, 6].map((n) => ({
    date: lwDate(n),
    readinessScore: score,
    source: 'stub' as const,
  }));
}

// ─── Scenario A: perfect week ────────────────────────────────────────────────
// Every workout completed at planned TSS, RPE 5-6, readiness high.
// Expected coach response: mostly 'keep', optionally one progression nudge.

function perfectWeek(): Pass3Input {
  const completedLastWeek: WorkoutCompleted[] = [
    {
      date: lwDate(1),
      workoutCode: 'B/T2',
      discipline: 'swim',
      completionStatus: 'completed',
      plannedDurationSeconds: 40 * 60,
      actualDurationSeconds: 40 * 60,
      plannedTss: 50,
      actualTss: 50,
      perceivedExertion: 6,
    },
    {
      date: lwDate(2),
      workoutCode: 'C/AE1',
      discipline: 'bike',
      completionStatus: 'completed',
      plannedDurationSeconds: 45 * 60,
      actualDurationSeconds: 45 * 60,
      plannedTss: 40,
      actualTss: 38,
      perceivedExertion: 4,
    },
    {
      date: lwDate(3),
      workoutCode: 'C/ME1',
      discipline: 'bike',
      completionStatus: 'completed',
      plannedDurationSeconds: 75 * 60,
      actualDurationSeconds: 75 * 60,
      plannedTss: 90,
      actualTss: 88,
      perceivedExertion: 6,
    },
    {
      date: lwDate(4),
      workoutCode: 'D/AE2',
      discipline: 'run',
      completionStatus: 'completed',
      plannedDurationSeconds: 90 * 60,
      actualDurationSeconds: 92 * 60,
      plannedTss: 100,
      actualTss: 103,
      perceivedExertion: 5,
    },
    {
      date: lwDate(5),
      workoutCode: 'B/AE2',
      discipline: 'swim',
      completionStatus: 'completed',
      plannedDurationSeconds: 60 * 60,
      actualDurationSeconds: 60 * 60,
      plannedTss: 60,
      actualTss: 58,
      perceivedExertion: 5,
    },
    {
      date: lwDate(6),
      workoutCode: 'C/AE2',
      discipline: 'bike',
      completionStatus: 'completed',
      plannedDurationSeconds: 210 * 60,
      actualDurationSeconds: 215 * 60,
      plannedTss: 180,
      actualTss: 183,
      perceivedExertion: 6,
    },
  ];
  return {
    weeklyDraft: weeklyDraft(),
    completedLastWeek,
    readinessHistory: flatReadinessHistory(72),
    athleteProfile: profile(),
  };
}

// ─── Scenario B: missed long ride ────────────────────────────────────────────
// Saturday swim + Sunday long ride are both absent (illness Saturday morning,
// no makeup Sunday). Other 4 workouts at plan. Expected: replace one of next
// week's workouts with a makeup long ride OR insert a recovery flavour day.

function missedLongRide(): Pass3Input {
  const completedLastWeek: WorkoutCompleted[] = [
    {
      date: lwDate(1),
      workoutCode: 'B/T2',
      discipline: 'swim',
      completionStatus: 'completed',
      plannedDurationSeconds: 40 * 60,
      actualDurationSeconds: 40 * 60,
      plannedTss: 50,
      actualTss: 49,
      perceivedExertion: 6,
    },
    {
      date: lwDate(2),
      workoutCode: 'C/AE1',
      discipline: 'bike',
      completionStatus: 'completed',
      plannedDurationSeconds: 45 * 60,
      actualDurationSeconds: 45 * 60,
      plannedTss: 40,
      actualTss: 40,
      perceivedExertion: 4,
    },
    {
      date: lwDate(3),
      workoutCode: 'C/ME1',
      discipline: 'bike',
      completionStatus: 'completed',
      plannedDurationSeconds: 75 * 60,
      actualDurationSeconds: 75 * 60,
      plannedTss: 90,
      actualTss: 92,
      perceivedExertion: 7,
    },
    {
      date: lwDate(4),
      workoutCode: 'D/AE2',
      discipline: 'run',
      completionStatus: 'completed',
      plannedDurationSeconds: 90 * 60,
      actualDurationSeconds: 90 * 60,
      plannedTss: 100,
      actualTss: 100,
      perceivedExertion: 6,
    },
    {
      date: lwDate(5),
      workoutCode: 'B/AE2',
      discipline: 'swim',
      completionStatus: 'skipped',
      plannedDurationSeconds: 60 * 60,
      plannedTss: 60,
      notes: 'sick — chest cold',
    },
    {
      date: lwDate(6),
      workoutCode: 'C/AE2',
      discipline: 'bike',
      completionStatus: 'skipped',
      plannedDurationSeconds: 210 * 60,
      plannedTss: 180,
      notes: 'still sick — fully rested',
    },
  ];
  return {
    weeklyDraft: weeklyDraft(),
    completedLastWeek,
    readinessHistory: flatReadinessHistory(48),
    athleteProfile: profile(),
  };
}

// ─── Scenario C: low recovery ────────────────────────────────────────────────
// Every workout was completed but at noticeably higher RPE than planned, and
// the readiness rollup is yellow. TSS is normal — the body just isn't
// absorbing the load. Expected: dial back one hard session, swap intensity
// for aerobic, maybe shorten the long ride.

function lowRecovery(): Pass3Input {
  const completedLastWeek: WorkoutCompleted[] = [
    {
      date: lwDate(1),
      workoutCode: 'B/T2',
      discipline: 'swim',
      completionStatus: 'completed',
      plannedDurationSeconds: 40 * 60,
      actualDurationSeconds: 40 * 60,
      plannedTss: 50,
      actualTss: 54,
      perceivedExertion: 8,
      notes: 'felt heavy in the water',
    },
    {
      date: lwDate(2),
      workoutCode: 'C/AE1',
      discipline: 'bike',
      completionStatus: 'completed',
      plannedDurationSeconds: 45 * 60,
      actualDurationSeconds: 45 * 60,
      plannedTss: 40,
      actualTss: 45,
      perceivedExertion: 7,
    },
    {
      date: lwDate(3),
      workoutCode: 'C/ME1',
      discipline: 'bike',
      completionStatus: 'completed',
      plannedDurationSeconds: 75 * 60,
      actualDurationSeconds: 75 * 60,
      plannedTss: 90,
      actualTss: 95,
      perceivedExertion: 9,
      notes: 'cracked on the second 15min interval',
    },
    {
      date: lwDate(4),
      workoutCode: 'D/AE2',
      discipline: 'run',
      completionStatus: 'completed',
      plannedDurationSeconds: 90 * 60,
      actualDurationSeconds: 92 * 60,
      plannedTss: 100,
      actualTss: 115,
      perceivedExertion: 8,
    },
    {
      date: lwDate(5),
      workoutCode: 'B/AE2',
      discipline: 'swim',
      completionStatus: 'partial',
      plannedDurationSeconds: 60 * 60,
      actualDurationSeconds: 40 * 60,
      plannedTss: 60,
      actualTss: 45,
      perceivedExertion: 8,
      notes: 'cut it short — shoulders fatigued',
    },
    {
      date: lwDate(6),
      workoutCode: 'C/AE2',
      discipline: 'bike',
      completionStatus: 'completed',
      plannedDurationSeconds: 210 * 60,
      actualDurationSeconds: 215 * 60,
      plannedTss: 180,
      actualTss: 195,
      perceivedExertion: 9,
      notes: 'survival mode for the last hour',
    },
  ];
  return {
    weeklyDraft: weeklyDraft(),
    completedLastWeek,
    readinessHistory: flatReadinessHistory(30),
    athleteProfile: profile(),
  };
}

// ─── Scenario D: fitness leap ────────────────────────────────────────────────
// 90 days of consistent ~75 TSS/day before last week, then last week absolutely
// dialled — everything completed at plan, RPE comfortably low. Readiness high.
// Expected: optional progression on one or two sessions; otherwise 'keep' with
// a positive week-level note.

function fitnessLeap(): Pass3Input {
  const completedLastWeek: WorkoutCompleted[] = [
    {
      date: lwDate(1),
      workoutCode: 'B/T2',
      discipline: 'swim',
      completionStatus: 'completed',
      plannedDurationSeconds: 40 * 60,
      actualDurationSeconds: 40 * 60,
      plannedTss: 50,
      actualTss: 51,
      perceivedExertion: 4,
      notes: 'paces dropped 3s/100m vs last test',
    },
    {
      date: lwDate(2),
      workoutCode: 'C/AE1',
      discipline: 'bike',
      completionStatus: 'completed',
      plannedDurationSeconds: 45 * 60,
      actualDurationSeconds: 45 * 60,
      plannedTss: 40,
      actualTss: 38,
      perceivedExertion: 3,
    },
    {
      date: lwDate(3),
      workoutCode: 'C/ME1',
      discipline: 'bike',
      completionStatus: 'completed',
      plannedDurationSeconds: 75 * 60,
      actualDurationSeconds: 75 * 60,
      plannedTss: 90,
      actualTss: 88,
      perceivedExertion: 5,
      notes: 'thresholds felt smooth',
    },
    {
      date: lwDate(4),
      workoutCode: 'D/AE2',
      discipline: 'run',
      completionStatus: 'completed',
      plannedDurationSeconds: 90 * 60,
      actualDurationSeconds: 90 * 60,
      plannedTss: 100,
      actualTss: 96,
      perceivedExertion: 4,
    },
    {
      date: lwDate(5),
      workoutCode: 'B/AE2',
      discipline: 'swim',
      completionStatus: 'completed',
      plannedDurationSeconds: 60 * 60,
      actualDurationSeconds: 60 * 60,
      plannedTss: 60,
      actualTss: 60,
      perceivedExertion: 4,
    },
    {
      date: lwDate(6),
      workoutCode: 'C/AE2',
      discipline: 'bike',
      completionStatus: 'completed',
      plannedDurationSeconds: 210 * 60,
      actualDurationSeconds: 215 * 60,
      plannedTss: 180,
      actualTss: 178,
      perceivedExertion: 5,
    },
  ];

  // 90 days of 75 TSS/day saturates CTL near 75 (≈3τ for the 42-day EWMA).
  const seedDailyTss: DailyTss[] = [];
  const seedStart = new Date('2026-02-24T00:00:00Z'); // 90 days before 2026-05-25
  for (let i = 0; i < 90; i++) {
    const d = new Date(seedStart.getTime() + i * 86_400_000);
    seedDailyTss.push({ date: d.toISOString().slice(0, 10), tss: 75 });
  }

  return {
    weeklyDraft: weeklyDraft(),
    completedLastWeek,
    readinessHistory: flatReadinessHistory(82),
    athleteProfile: profile(),
    seedDailyTss,
  };
}

// ─── Registry ────────────────────────────────────────────────────────────────

export const PASS3_SCENARIO_NAMES = [
  'perfect-week',
  'missed-long-ride',
  'low-recovery',
  'fitness-leap',
] as const;

export type Pass3ScenarioName = (typeof PASS3_SCENARIO_NAMES)[number];

export const pass3Scenarios: Record<Pass3ScenarioName, () => Pass3Input> = {
  'perfect-week': perfectWeek,
  'missed-long-ride': missedLongRide,
  'low-recovery': lowRecovery,
  'fitness-leap': fitnessLeap,
};
