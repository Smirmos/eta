import type {
  DailyReadinessReading,
  PlannedWorkout,
  WeeklyDetail,
  WorkoutCode,
} from '@eta/shared-types';
import { describe, expect, it } from 'vitest';
import { applyHardRules, type HardRulesConfig } from './hard-rules.js';
import type { Pass3ComputedInputs } from './types.js';

// ─── Builders ────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: HardRulesConfig = {
  hrvDropNotePct: 5,
  hrvDropDowngradePct: 10,
  hrvDropForcedRestPct: 20,
  hrvStreakDropPct: 5,
  hrvStreakDays: 3,
  hrvRollingWindowDays: 7,
  hrvDowngradeDurationRatio: 0.7,
};

const NEUTRAL_COMPUTED: Pass3ComputedInputs = {
  lastWeekTss: 0,
  currentCtl: 50,
  currentAtl: 50,
  currentTsb: 0,
  avgReadinessLast7d: 70,
};

function workout(
  date: string,
  opts: Partial<PlannedWorkout> & { mainZone?: PlannedWorkout['segments'][number]['zone'] } = {},
): PlannedWorkout {
  const mainZone = opts.mainZone ?? 'z4';
  return {
    workoutCode: opts.workoutCode ?? ('C/ME1' as WorkoutCode),
    discipline: opts.discipline ?? 'bike',
    date,
    totalDurationSeconds: opts.totalDurationSeconds ?? 60 * 60,
    segments: opts.segments ?? [
      { label: 'Warmup', durationSeconds: 600, zone: 'z2', description: 'wu' },
      { label: 'Main set', durationSeconds: 2400, zone: mainZone, description: 'main' },
      { label: 'Cooldown', durationSeconds: 600, zone: 'z1', description: 'cd' },
    ],
    rationale: 'r',
    citation: 'knowledge-base/03-workouts.md#c-me1',
  };
}

function singleWorkoutDraft(date: string, opts?: Parameters<typeof workout>[1]): WeeklyDetail {
  return {
    weekNumber: 1,
    weekStartDate: date,
    phase: 'base_3',
    workouts: [workout(date, opts)],
  };
}

function readingsBefore(
  upTo: string,
  hrv: number,
  days: number,
  source: DailyReadinessReading['source'] = 'stub',
): DailyReadinessReading[] {
  const out: DailyReadinessReading[] = [];
  const base = new Date(`${upTo}T00:00:00Z`).getTime();
  for (let i = days; i >= 1; i--) {
    const d = new Date(base - i * 86_400_000).toISOString().slice(0, 10);
    out.push({ date: d, hrvRmssdMs: hrv, source });
  }
  return out;
}

// ─── Readiness band boundary tests ───────────────────────────────────────────

describe('readiness band rules', () => {
  function evalAt(score: number) {
    return applyHardRules({
      weeklyDraft: singleWorkoutDraft('2026-06-02'),
      readinessHistory: [{ date: '2026-06-02', readinessScore: score, source: 'oura' }],
      computed: NEUTRAL_COMPUTED,
      config: DEFAULT_CONFIG,
    });
  }

  it('score < 50 emits force_rest (rule: readiness.red)', () => {
    const r = evalAt(49);
    expect(r.output.forcedAdjustments).toHaveLength(1);
    expect(r.output.forcedAdjustments[0]!.action).toBe('force_rest');
    expect(r.appliedRules.find((a) => a.ruleId === 'readiness.red')?.action).toBe('force_rest');
  });

  it('score = 50 (boundary) is YELLOW, not RED — note_only', () => {
    const r = evalAt(50);
    expect(r.output.forcedAdjustments).toHaveLength(0);
    expect(r.appliedRules[0]!.ruleId).toBe('readiness.yellow');
    expect(r.appliedRules[0]!.severity).toBe('note_only');
  });

  it('score = 64 (upper YELLOW boundary) still note_only', () => {
    const r = evalAt(64);
    expect(r.appliedRules[0]!.ruleId).toBe('readiness.yellow');
  });

  it('score = 65 (lower GREEN boundary) is GREEN', () => {
    const r = evalAt(65);
    expect(r.appliedRules[0]!.ruleId).toBe('readiness.green');
  });

  it('score = 79 (upper GREEN boundary) is GREEN', () => {
    const r = evalAt(79);
    expect(r.appliedRules[0]!.ruleId).toBe('readiness.green');
  });

  it('score = 80 (FRESH boundary) is FRESH', () => {
    const r = evalAt(80);
    expect(r.appliedRules[0]!.ruleId).toBe('readiness.fresh');
  });
});

// ─── HRV percentage-drop boundary tests ──────────────────────────────────────

describe('HRV drop rules', () => {
  function evalAtDrop(dropPct: number) {
    const baseline = 50; // ms
    const today = baseline * (1 - dropPct / 100);
    return applyHardRules({
      weeklyDraft: singleWorkoutDraft('2026-06-08'),
      readinessHistory: [
        ...readingsBefore('2026-06-08', baseline, 7),
        { date: '2026-06-08', hrvRmssdMs: today, source: 'oura' },
      ],
      computed: NEUTRAL_COMPUTED,
      config: DEFAULT_CONFIG,
    });
  }

  it('4.9 % drop — no HRV rule fires', () => {
    const r = evalAtDrop(4.9);
    expect(r.appliedRules.filter((a) => a.ruleId.startsWith('hrv.'))).toHaveLength(0);
  });

  it('exactly 5 % drop — hrv.note fires (note_only)', () => {
    const r = evalAtDrop(5);
    const note = r.appliedRules.find((a) => a.ruleId === 'hrv.note');
    expect(note?.severity).toBe('note_only');
    expect(r.output.forcedAdjustments).toHaveLength(0);
  });

  it('9.9 % drop — still hrv.note, no downgrade yet', () => {
    const r = evalAtDrop(9.9);
    expect(r.appliedRules.some((a) => a.ruleId === 'hrv.note')).toBe(true);
    expect(r.appliedRules.some((a) => a.ruleId === 'hrv.downgrade')).toBe(false);
  });

  it('exactly 10 % drop — hrv.downgrade fires (force_replace)', () => {
    const r = evalAtDrop(10);
    const fa = r.output.forcedAdjustments[0]!;
    expect(fa.action).toBe('force_replace');
    expect(fa.newWorkoutCode).toBe('C/AE2');
    expect(fa.newDurationSeconds).toBe(Math.round(60 * 60 * 0.7));
  });

  it('19.9 % drop — still downgrade, no forced rest', () => {
    const r = evalAtDrop(19.9);
    expect(r.appliedRules.some((a) => a.ruleId === 'hrv.downgrade')).toBe(true);
    expect(r.appliedRules.some((a) => a.ruleId === 'hrv.forced_rest_acute')).toBe(false);
  });

  it('exactly 20 % drop — still downgrade (>20 % is the rest threshold)', () => {
    const r = evalAtDrop(20);
    expect(r.appliedRules.some((a) => a.ruleId === 'hrv.downgrade')).toBe(true);
    expect(r.appliedRules.some((a) => a.ruleId === 'hrv.forced_rest_acute')).toBe(false);
  });

  it('20.1 % drop — forced rest fires (force_rest)', () => {
    const r = evalAtDrop(20.1);
    const fa = r.output.forcedAdjustments[0]!;
    expect(fa.action).toBe('force_rest');
    expect(r.appliedRules.find((a) => a.ruleId === 'hrv.forced_rest_acute')?.severity).toBe(
      'force_rest',
    );
  });

  it('rule is disabled when prior readings lack hrvRmssdMs', () => {
    const r = applyHardRules({
      weeklyDraft: singleWorkoutDraft('2026-06-08'),
      readinessHistory: [
        // Only today, no baseline.
        { date: '2026-06-08', hrvRmssdMs: 25, source: 'oura' },
      ],
      computed: NEUTRAL_COMPUTED,
      config: DEFAULT_CONFIG,
    });
    expect(r.appliedRules.filter((a) => a.ruleId.startsWith('hrv.'))).toHaveLength(0);
  });
});

describe('HRV chronic suppression', () => {
  function buildStreakHistory(
    baselineDays: number,
    suppressedDays: number,
    baseline: number,
    suppressedHrv: number,
  ): DailyReadinessReading[] {
    const startDate = new Date('2026-06-01T00:00:00Z');
    const history: DailyReadinessReading[] = [];
    for (let i = 0; i < baselineDays; i++) {
      const d = new Date(startDate.getTime() + i * 86_400_000).toISOString().slice(0, 10);
      history.push({ date: d, hrvRmssdMs: baseline, source: 'oura' });
    }
    for (let i = baselineDays; i < baselineDays + suppressedDays; i++) {
      const d = new Date(startDate.getTime() + i * 86_400_000).toISOString().slice(0, 10);
      history.push({ date: d, hrvRmssdMs: suppressedHrv, source: 'oura' });
    }
    return history;
  }

  it('3 consecutive days at 10 % drop — forced_rest_chronic fires', () => {
    // 10 % is well above the 5 % threshold even after the rolling baseline
    // starts to drop, so the streak holds on every day.
    const history = buildStreakHistory(7, 3, 60, 60 * 0.9);
    const r = applyHardRules({
      weeklyDraft: singleWorkoutDraft('2026-06-10'),
      readinessHistory: history,
      computed: NEUTRAL_COMPUTED,
      config: DEFAULT_CONFIG,
    });
    expect(r.appliedRules.some((a) => a.ruleId === 'hrv.forced_rest_chronic')).toBe(true);
    expect(r.output.forcedAdjustments[0]!.action).toBe('force_rest');
  });

  it('2 consecutive days at 10 % drop — chronic does NOT fire', () => {
    const history = buildStreakHistory(7, 2, 60, 60 * 0.9);
    const r = applyHardRules({
      weeklyDraft: singleWorkoutDraft('2026-06-09'),
      readinessHistory: history,
      computed: NEUTRAL_COMPUTED,
      config: DEFAULT_CONFIG,
    });
    expect(r.appliedRules.some((a) => a.ruleId === 'hrv.forced_rest_chronic')).toBe(false);
  });

  it('streak does not fire when sustained drop is below the 5 % per-day threshold', () => {
    // Sustained 3 % drop — chronic must not fire on any day.
    const history = buildStreakHistory(7, 3, 60, 60 * 0.97);
    const r = applyHardRules({
      weeklyDraft: singleWorkoutDraft('2026-06-10'),
      readinessHistory: history,
      computed: NEUTRAL_COMPUTED,
      config: DEFAULT_CONFIG,
    });
    expect(r.appliedRules.some((a) => a.ruleId === 'hrv.forced_rest_chronic')).toBe(false);
  });
});

// ─── TSB triggers ────────────────────────────────────────────────────────────

describe('TSB rules', () => {
  it('TSB < -30 — tsb.overreached fires force_rest', () => {
    const r = applyHardRules({
      weeklyDraft: singleWorkoutDraft('2026-06-02'),
      readinessHistory: [{ date: '2026-06-02', readinessScore: 70, source: 'oura' }],
      computed: { ...NEUTRAL_COMPUTED, currentTsb: -30.1 },
      config: DEFAULT_CONFIG,
    });
    expect(r.appliedRules.find((a) => a.ruleId === 'tsb.overreached')?.action).toBe('force_rest');
  });

  it('TSB = -30 (boundary) does not fire overreached', () => {
    const r = applyHardRules({
      weeklyDraft: singleWorkoutDraft('2026-06-02'),
      readinessHistory: [{ date: '2026-06-02', readinessScore: 70, source: 'oura' }],
      computed: { ...NEUTRAL_COMPUTED, currentTsb: -30 },
      config: DEFAULT_CONFIG,
    });
    expect(r.appliedRules.some((a) => a.ruleId === 'tsb.overreached')).toBe(false);
  });

  it('TSB > +10 — tsb.fresh_sustained fires note_only', () => {
    const r = applyHardRules({
      weeklyDraft: singleWorkoutDraft('2026-06-02'),
      readinessHistory: [{ date: '2026-06-02', readinessScore: 70, source: 'oura' }],
      computed: { ...NEUTRAL_COMPUTED, currentTsb: 10.5 },
      config: DEFAULT_CONFIG,
    });
    expect(r.appliedRules.find((a) => a.ruleId === 'tsb.fresh_sustained')?.severity).toBe(
      'note_only',
    );
    expect(r.output.forcedAdjustments).toHaveLength(0);
  });
});

// ─── Conflict resolution: severity ladder ────────────────────────────────────

describe('conflict resolution', () => {
  it('readiness.red and tsb.overreached on same day — both audit, one force_rest emitted', () => {
    const r = applyHardRules({
      weeklyDraft: singleWorkoutDraft('2026-06-02'),
      readinessHistory: [{ date: '2026-06-02', readinessScore: 30, source: 'oura' }],
      computed: { ...NEUTRAL_COMPUTED, currentTsb: -35 },
      config: DEFAULT_CONFIG,
    });
    expect(r.output.forcedAdjustments).toHaveLength(1);
    expect(r.output.forcedAdjustments[0]!.action).toBe('force_rest');

    // Both rules in the audit, but only ONE got the active action.
    const red = r.appliedRules.find((a) => a.ruleId === 'readiness.red');
    const tsb = r.appliedRules.find((a) => a.ruleId === 'tsb.overreached');
    expect(red).toBeDefined();
    expect(tsb).toBeDefined();
    const activeForceRests = r.appliedRules.filter((a) => a.action === 'force_rest');
    expect(activeForceRests).toHaveLength(1);
    const suppressed = r.appliedRules.filter((a) => a.action === 'suppressed');
    expect(suppressed).toHaveLength(1);
  });

  it('HRV downgrade beats readiness.yellow on same day — force_replace wins', () => {
    const baseline = 50;
    const today = baseline * 0.85; // 15 % drop → downgrade
    const r = applyHardRules({
      weeklyDraft: singleWorkoutDraft('2026-06-08'),
      readinessHistory: [
        ...readingsBefore('2026-06-08', baseline, 7),
        { date: '2026-06-08', hrvRmssdMs: today, readinessScore: 60, source: 'oura' },
      ],
      computed: NEUTRAL_COMPUTED,
      config: DEFAULT_CONFIG,
    });
    expect(r.output.forcedAdjustments[0]!.action).toBe('force_replace');
    const downgrade = r.appliedRules.find((a) => a.ruleId === 'hrv.downgrade');
    expect(downgrade?.action).toBe('force_replace');
    const yellow = r.appliedRules.find((a) => a.ruleId === 'readiness.yellow');
    expect(yellow?.action).toBe('note_only');
  });

  it('multiple note_only rules — both emit, no HardRuleAdjustment', () => {
    const r = applyHardRules({
      weeklyDraft: singleWorkoutDraft('2026-06-02'),
      readinessHistory: [{ date: '2026-06-02', readinessScore: 75, source: 'oura' }],
      computed: { ...NEUTRAL_COMPUTED, currentTsb: 15 },
      config: DEFAULT_CONFIG,
    });
    expect(r.output.forcedAdjustments).toHaveLength(0);
    const ruleIds = r.appliedRules.map((a) => a.ruleId).sort();
    expect(ruleIds).toEqual(['readiness.green', 'tsb.fresh_sustained']);
    expect(r.appliedRules.every((a) => a.action === 'note_only')).toBe(true);
  });
});

// ─── Edge cases ──────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('HRV downgrade is a no-op on an already-Z2 workout — audit shows noop', () => {
    const baseline = 50;
    const today = baseline * 0.85;
    const r = applyHardRules({
      weeklyDraft: singleWorkoutDraft('2026-06-08', { mainZone: 'z2', workoutCode: 'C/AE2' }),
      readinessHistory: [
        ...readingsBefore('2026-06-08', baseline, 7),
        { date: '2026-06-08', hrvRmssdMs: today, source: 'oura' },
      ],
      computed: NEUTRAL_COMPUTED,
      config: DEFAULT_CONFIG,
    });
    expect(r.output.forcedAdjustments).toHaveLength(0);
    expect(r.appliedRules.find((a) => a.ruleId === 'hrv.downgrade')?.action).toBe('noop');
  });

  it('dates without readings produce no firings', () => {
    const r = applyHardRules({
      weeklyDraft: singleWorkoutDraft('2026-06-02'),
      readinessHistory: [], // no data at all
      computed: NEUTRAL_COMPUTED,
      config: DEFAULT_CONFIG,
    });
    expect(r.output.forcedAdjustments).toHaveLength(0);
    expect(r.appliedRules).toHaveLength(0);
  });

  it('empty weeklyDraft — no firings', () => {
    const r = applyHardRules({
      weeklyDraft: {
        weekNumber: 1,
        weekStartDate: '2026-06-01',
        phase: 'base_3',
        workouts: [],
      },
      readinessHistory: [{ date: '2026-06-02', readinessScore: 20, source: 'oura' }],
      computed: { ...NEUTRAL_COMPUTED, currentTsb: -50 },
      config: DEFAULT_CONFIG,
    });
    expect(r.output.forcedAdjustments).toHaveLength(0);
    expect(r.appliedRules).toHaveLength(0);
  });
});

// ─── Performance guard ──────────────────────────────────────────────────────

describe('performance', () => {
  it('runs under 100 ms for a full week of workouts and 30 days of readings', () => {
    const draft: WeeklyDetail = {
      weekNumber: 1,
      weekStartDate: '2026-06-01',
      phase: 'base_3',
      workouts: [
        workout('2026-06-01'),
        workout('2026-06-02'),
        workout('2026-06-03'),
        workout('2026-06-04'),
        workout('2026-06-05'),
        workout('2026-06-06'),
        workout('2026-06-07'),
      ],
    };
    const history: DailyReadinessReading[] = [];
    for (let i = -23; i < 7; i++) {
      const d = new Date(new Date('2026-06-01T00:00:00Z').getTime() + i * 86_400_000)
        .toISOString()
        .slice(0, 10);
      history.push({ date: d, hrvRmssdMs: 50, readinessScore: 70, source: 'oura' });
    }
    const start = performance.now();
    applyHardRules({
      weeklyDraft: draft,
      readinessHistory: history,
      computed: NEUTRAL_COMPUTED,
      config: DEFAULT_CONFIG,
    });
    expect(performance.now() - start).toBeLessThan(100);
  });
});
