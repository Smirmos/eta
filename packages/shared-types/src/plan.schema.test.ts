import { describe, expect, it } from 'vitest';
import type {
  AdaptationSuggestion,
  MacroPlan,
  MacroPlanWeek,
  PlannedWorkout,
  WeeklyDetail,
  WorkoutAdjustment,
} from './plan.js';
import { adaptationSuggestionSchema, macroPlanSchema, weeklyDetailSchema } from './plan.schema.js';

// ─── Fixture builders ────────────────────────────────────────────────────────

function isoFromOffset(base: string, daysOffset: number): string {
  const t = new Date(`${base}T00:00:00Z`).getTime() + daysOffset * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

function validMacroPlan(overrides: Partial<MacroPlan> = {}): MacroPlan {
  const start = '2026-01-05';
  const weeks: MacroPlanWeek[] = [
    {
      weekNumber: 4,
      weekStartDate: isoFromOffset(start, 0),
      phase: 'base_2',
      isRecoveryWeek: false,
      weeklyVolumeHours: 10,
      keySessions: [
        {
          workoutCode: 'C/AE2',
          discipline: 'bike',
          dayOfWeek: 'sun',
          rationale: 'Long aerobic bike',
          citation: 'knowledge-base/03-workouts.md#C-AE2',
        },
      ],
    },
    {
      weekNumber: 3,
      weekStartDate: isoFromOffset(start, 7),
      phase: 'base_2',
      isRecoveryWeek: false,
      weeklyVolumeHours: 11,
      keySessions: [
        {
          workoutCode: 'D/AE2',
          discipline: 'run',
          dayOfWeek: 'fri',
          rationale: 'Long run',
          citation: 'knowledge-base/03-workouts.md#D-AE2',
        },
      ],
    },
    {
      weekNumber: 2,
      weekStartDate: isoFromOffset(start, 14),
      phase: 'base_3',
      isRecoveryWeek: false,
      weeklyVolumeHours: 12,
      keySessions: [],
    },
    {
      weekNumber: 1,
      weekStartDate: isoFromOffset(start, 21),
      phase: 'base_3',
      isRecoveryWeek: true,
      weeklyVolumeHours: 7,
      keySessions: [],
    },
  ];
  return {
    athleteProfileId: 'profile-123',
    raceDate: '2026-08-01',
    generatedAt: '2026-01-04T12:00:00Z',
    totalWeeks: weeks.length,
    weeks,
    ...overrides,
  };
}

function validWeeklyDetail(overrides: Partial<WeeklyDetail> = {}): WeeklyDetail {
  const start = '2026-01-05';
  const workouts: PlannedWorkout[] = [
    {
      workoutCode: 'B/AE1',
      discipline: 'swim',
      date: isoFromOffset(start, 1),
      totalDurationSeconds: 1800,
      segments: [
        {
          label: 'Warmup',
          durationSeconds: 300,
          zone: 'z1',
          description: '300m easy',
        },
        {
          label: 'Main',
          durationSeconds: 1200,
          zone: 'z2',
          description: 'Aerobic continuous',
        },
        {
          label: 'Cooldown',
          durationSeconds: 300,
          zone: 'z1',
          description: '300m easy',
        },
      ],
      rationale: 'Aerobic base swim',
      citation: 'knowledge-base/03-workouts.md#B-AE1',
    },
  ];
  return {
    weekNumber: 4,
    weekStartDate: start,
    phase: 'base_2',
    workouts,
    ...overrides,
  };
}

function validAdaptation(overrides: Partial<AdaptationSuggestion> = {}): AdaptationSuggestion {
  const adjustments: WorkoutAdjustment[] = [
    {
      originalDate: '2026-01-06',
      originalWorkoutCode: 'C/AE2',
      action: 'keep',
      reasoning: 'TSB is positive, athlete is rested',
      citation: 'knowledge-base/05-recovery.md#tsb',
    },
  ];
  return {
    forWeekStart: '2026-01-05',
    generatedAt: '2026-01-04T08:00:00Z',
    inputs: {
      lastWeekTss: 580,
      currentCtl: 70,
      currentAtl: 65,
      currentTsb: 5,
      avgReadinessLast7d: 78,
    },
    adjustments,
    ...overrides,
  };
}

// ─── MacroPlan tests ─────────────────────────────────────────────────────────

describe('macroPlanSchema', () => {
  it('parses a valid full macro plan', () => {
    const result = macroPlanSchema.safeParse(validMacroPlan());
    expect(result.success).toBe(true);
  });

  it('rejects a hallucinated workout code', () => {
    const plan = validMacroPlan();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (plan.weeks[0] as MacroPlanWeek).keySessions[0]!.workoutCode = 'X99' as any;
    const result = macroPlanSchema.safeParse(plan);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('workoutCode'))).toBe(true);
    }
  });

  it('rejects non-contiguous weeks (week 2 not exactly 7 days after week 1)', () => {
    const plan = validMacroPlan();
    plan.weeks[1]!.weekStartDate = isoFromOffset('2026-01-05', 10); // 10 days, not 7
    const result = macroPlanSchema.safeParse(plan);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => /contiguous/.test(i.message))).toBe(true);
    }
  });

  it('rejects out-of-order phase transitions (build_1 → base_2)', () => {
    const plan = validMacroPlan();
    plan.weeks[0]!.phase = 'build_1';
    plan.weeks[1]!.phase = 'base_2';
    const result = macroPlanSchema.safeParse(plan);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => /regressed/.test(i.message))).toBe(true);
    }
  });

  it('allows phase to repeat across consecutive weeks', () => {
    const plan = validMacroPlan(); // already has base_2 → base_2 in fixture
    expect(macroPlanSchema.safeParse(plan).success).toBe(true);
  });

  it('rejects citations missing the knowledge-base/ prefix', () => {
    const plan = validMacroPlan();
    plan.weeks[0]!.keySessions[0]!.citation = 'wikipedia.org/Friel';
    const result = macroPlanSchema.safeParse(plan);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('citation'))).toBe(true);
    }
  });

  it('rejects empty citations', () => {
    const plan = validMacroPlan();
    plan.weeks[0]!.keySessions[0]!.citation = '';
    const result = macroPlanSchema.safeParse(plan);
    expect(result.success).toBe(false);
  });

  it('rejects keySession missing dayOfWeek', () => {
    const plan = validMacroPlan();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (plan.weeks[0]!.keySessions[0] as any).dayOfWeek;
    const result = macroPlanSchema.safeParse(plan);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('dayOfWeek'))).toBe(true);
    }
  });

  it('rejects keySession with an invalid dayOfWeek value', () => {
    const plan = validMacroPlan();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plan.weeks[0]!.keySessions[0]!.dayOfWeek = 'monday' as any;
    const result = macroPlanSchema.safeParse(plan);
    expect(result.success).toBe(false);
  });

  it('rejects totalWeeks that disagrees with weeks.length', () => {
    const plan = validMacroPlan({ totalWeeks: 99 });
    const result = macroPlanSchema.safeParse(plan);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.includes('totalWeeks'))).toBe(true);
    }
  });

  it('rejects weeklyVolumeHours outside the 0-35 sanity range', () => {
    const plan = validMacroPlan();
    plan.weeks[0]!.weeklyVolumeHours = 50;
    expect(macroPlanSchema.safeParse(plan).success).toBe(false);
  });

  it('accepts an empty weeks array (totalWeeks=0)', () => {
    expect(macroPlanSchema.safeParse(validMacroPlan({ weeks: [], totalWeeks: 0 })).success).toBe(
      true,
    );
  });
});

// ─── WeeklyDetail tests ──────────────────────────────────────────────────────

describe('weeklyDetailSchema', () => {
  it('parses a valid weekly detail', () => {
    expect(weeklyDetailSchema.safeParse(validWeeklyDetail()).success).toBe(true);
  });

  it('allows multiple workouts on the same day (two-a-days)', () => {
    const week = validWeeklyDetail();
    const wo = week.workouts[0]!;
    week.workouts.push({
      ...wo,
      workoutCode: 'C/AE2',
      discipline: 'bike',
    });
    expect(weeklyDetailSchema.safeParse(week).success).toBe(true);
  });

  it('rejects a workout dated outside the 7-day window', () => {
    const week = validWeeklyDetail();
    week.workouts[0]!.date = isoFromOffset(week.weekStartDate, 8); // outside [start, start+7)
    const result = weeklyDetailSchema.safeParse(week);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => /outside the 7-day window/.test(i.message))).toBe(
        true,
      );
    }
  });

  it('accepts a workout on the last day of the window (start + 6 days)', () => {
    const week = validWeeklyDetail();
    week.workouts[0]!.date = isoFromOffset(week.weekStartDate, 6);
    expect(weeklyDetailSchema.safeParse(week).success).toBe(true);
  });

  it('rejects segment durations that do not sum to total (>60s tolerance)', () => {
    const week = validWeeklyDetail();
    week.workouts[0]!.totalDurationSeconds = 5000; // segments sum to 1800
    const result = weeklyDetailSchema.safeParse(week);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => /segment durations sum/.test(i.message))).toBe(true);
    }
  });

  it('accepts segment durations within ±60s tolerance of total', () => {
    const week = validWeeklyDetail();
    week.workouts[0]!.totalDurationSeconds = 1830; // 30s off, within tolerance
    expect(weeklyDetailSchema.safeParse(week).success).toBe(true);
  });

  it('rejects a workout citation with a hallucinated source', () => {
    const week = validWeeklyDetail();
    week.workouts[0]!.citation = 'training-bible.com/article-23';
    expect(weeklyDetailSchema.safeParse(week).success).toBe(false);
  });

  it('rejects a hallucinated workout code', () => {
    const week = validWeeklyDetail();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    week.workouts[0]!.workoutCode = 'Z/Z9' as any;
    expect(weeklyDetailSchema.safeParse(week).success).toBe(false);
  });

  it('rejects a workout with zero segments', () => {
    const week = validWeeklyDetail();
    week.workouts[0]!.segments = [];
    expect(weeklyDetailSchema.safeParse(week).success).toBe(false);
  });
});

// ─── AdaptationSuggestion tests ──────────────────────────────────────────────

describe('adaptationSuggestionSchema', () => {
  it('parses a valid adaptation suggestion (action=keep)', () => {
    expect(adaptationSuggestionSchema.safeParse(validAdaptation()).success).toBe(true);
  });

  it('rejects action=keep with newWorkoutCode set', () => {
    const sug = validAdaptation();
    sug.adjustments[0]!.newWorkoutCode = 'C/AE2';
    const result = adaptationSuggestionSchema.safeParse(sug);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => /keep allows no new\* fields/.test(i.message))).toBe(
        true,
      );
    }
  });

  it('rejects action=replace without newWorkoutCode', () => {
    const sug = validAdaptation();
    sug.adjustments[0]!.action = 'replace';
    const result = adaptationSuggestionSchema.safeParse(sug);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => /requires newWorkoutCode/.test(i.message))).toBe(true);
    }
  });

  it('accepts action=replace with newWorkoutCode', () => {
    const sug = validAdaptation();
    sug.adjustments[0]!.action = 'replace';
    sug.adjustments[0]!.newWorkoutCode = 'C/AE1';
    expect(adaptationSuggestionSchema.safeParse(sug).success).toBe(true);
  });

  it('rejects action=modify with no new* fields', () => {
    const sug = validAdaptation();
    sug.adjustments[0]!.action = 'modify';
    const result = adaptationSuggestionSchema.safeParse(sug);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => /requires at least one of/.test(i.message))).toBe(
        true,
      );
    }
  });

  it('accepts action=modify with newDurationSeconds only', () => {
    const sug = validAdaptation();
    sug.adjustments[0]!.action = 'modify';
    sug.adjustments[0]!.newDurationSeconds = 2700;
    expect(adaptationSuggestionSchema.safeParse(sug).success).toBe(true);
  });

  it('accepts action=modify with newZone only', () => {
    const sug = validAdaptation();
    sug.adjustments[0]!.action = 'modify';
    sug.adjustments[0]!.newZone = 'z2';
    expect(adaptationSuggestionSchema.safeParse(sug).success).toBe(true);
  });

  it('accepts action=modify with newDate only', () => {
    const sug = validAdaptation();
    sug.adjustments[0]!.action = 'modify';
    sug.adjustments[0]!.newDate = '2026-01-07';
    expect(adaptationSuggestionSchema.safeParse(sug).success).toBe(true);
  });

  it('rejects an adjustment with a hallucinated workout code', () => {
    const sug = validAdaptation();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sug.adjustments[0]!.originalWorkoutCode = 'X99' as any;
    expect(adaptationSuggestionSchema.safeParse(sug).success).toBe(false);
  });

  it('rejects citation missing the knowledge-base/ prefix', () => {
    const sug = validAdaptation();
    sug.adjustments[0]!.citation = 'random-blog.com/post';
    expect(adaptationSuggestionSchema.safeParse(sug).success).toBe(false);
  });
});
