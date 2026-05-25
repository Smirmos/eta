import type { AthleteProfile, WeeklyDetail, WorkoutCompleted } from '@eta/shared-types';
import { describe, expect, it } from 'vitest';
import { PASS3_SYSTEM_PROMPT, buildPass3Prompt } from './pass3-prompt.js';
import type { HardRuleOutput, Pass3ComputedInputs, Pass3KbSlice } from './types.js';

function sampleProfile(): AthleteProfile {
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
    fitnessTrend: 'rising',
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
  };
}

function sampleWeeklyDraft(): WeeklyDetail {
  return {
    weekNumber: 15,
    weekStartDate: '2026-05-11',
    phase: 'base_3',
    workouts: [
      {
        workoutCode: 'C/AE1',
        discipline: 'bike',
        date: '2026-05-12',
        totalDurationSeconds: 60 * 60,
        segments: [
          { label: 'Warmup', durationSeconds: 600, zone: 'z1', description: 'wu' },
          { label: 'Main set', durationSeconds: 2400, zone: 'z2', description: 'main' },
          { label: 'Cooldown', durationSeconds: 600, zone: 'z1', description: 'cd' },
        ],
        rationale: 'Tuesday recovery ride.',
        citation: 'knowledge-base/03-workouts.md#c-ae1',
      },
      {
        workoutCode: 'C/ME1',
        discipline: 'bike',
        date: '2026-05-14',
        totalDurationSeconds: 75 * 60,
        segments: [
          { label: 'Warmup', durationSeconds: 900, zone: 'z2', description: 'wu' },
          { label: 'Main set', durationSeconds: 2700, zone: 'z4', description: '2x15 Z4' },
          { label: 'Cooldown', durationSeconds: 900, zone: 'z1', description: 'cd' },
        ],
        rationale: 'Thursday bike ME.',
        citation: 'knowledge-base/03-workouts.md#c-me1',
      },
      {
        workoutCode: 'D/AE2',
        discipline: 'run',
        date: '2026-05-15',
        totalDurationSeconds: 105 * 60,
        segments: [
          { label: 'Warmup', durationSeconds: 600, zone: 'z1', description: 'wu' },
          { label: 'Main set', durationSeconds: 5400, zone: 'z2', description: 'long run' },
          { label: 'Cooldown', durationSeconds: 300, zone: 'z1', description: 'cd' },
        ],
        rationale: 'Friday long run.',
        citation: 'knowledge-base/03-workouts.md#d-ae2',
      },
    ],
  };
}

function sampleComputed(overrides: Partial<Pass3ComputedInputs> = {}): Pass3ComputedInputs {
  return {
    lastWeekTss: 420,
    currentCtl: 65.2,
    currentAtl: 78.4,
    currentTsb: -13.2,
    avgReadinessLast7d: 50,
    ...overrides,
  };
}

function sampleKb(): Pass3KbSlice {
  const atpStructurePhase = '#### Base 3\nbase 3 body.\n';
  const recovery = '# Recovery\nbody.\n';
  const weeklyTemplatesRules = '## Workout placement rules\nrule body.\n';
  return {
    atpStructurePhase,
    recovery,
    weeklyTemplatesRules,
    totalChars: atpStructurePhase.length + recovery.length + weeklyTemplatesRules.length,
  };
}

function emptyHardRules(): HardRuleOutput {
  return { forcedAdjustments: [] };
}

describe('PASS3_SYSTEM_PROMPT', () => {
  it('encodes the JSON-only output rule', () => {
    expect(PASS3_SYSTEM_PROMPT).toMatch(/Output ONLY valid JSON/);
    expect(PASS3_SYSTEM_PROMPT).toMatch(/first character of your output is `\{`/);
  });

  it('requires one adjustment per draft workout (no cap, no skips)', () => {
    expect(PASS3_SYSTEM_PROMPT).toMatch(/exactly one entry per workout in the\s+upcoming week's draft/);
    expect(PASS3_SYSTEM_PROMPT).toMatch(/Do NOT skip any draft workout/);
  });

  it('enforces verbatim echo of computed inputs', () => {
    expect(PASS3_SYSTEM_PROMPT).toMatch(/ECHO INPUTS VERBATIM/);
    expect(PASS3_SYSTEM_PROMPT).toMatch(/Do not round, re-compute, or transform/);
  });

  it('requires KB citations for every adjustment, including keep', () => {
    expect(PASS3_SYSTEM_PROMPT).toMatch(/Every adjustment MUST include a citation/);
    expect(PASS3_SYSTEM_PROMPT).toMatch(/For 'keep' adjustments, cite/);
  });

  it('encodes Friel placement rules as never-violate constraints', () => {
    expect(PASS3_SYSTEM_PROMPT).toMatch(/Two consecutive same-discipline Z4\+ days/);
    expect(PASS3_SYSTEM_PROMPT).toMatch(/long ride followed by a long run/);
    expect(PASS3_SYSTEM_PROMPT).toMatch(/mandatoryRestDays/);
    expect(PASS3_SYSTEM_PROMPT).toMatch(/longSessionDays/);
  });

  it('encodes readiness and TSB bands with concrete thresholds', () => {
    expect(PASS3_SYSTEM_PROMPT).toMatch(/avgReadinessLast7d/);
    expect(PASS3_SYSTEM_PROMPT).toMatch(/TSB <= −20/);
  });

  it('declares soft-adjustments-only and the hard-rules relationship', () => {
    expect(PASS3_SYSTEM_PROMPT).toMatch(/SOFT ADJUSTMENTS ONLY/);
    expect(PASS3_SYSTEM_PROMPT).toMatch(/hard-rules pre-pass has already applied/);
  });
});

describe('buildPass3Prompt', () => {
  it('returns split static/dynamic blocks plus a combined user prompt', () => {
    const { system, userStatic, userDynamic, user } = buildPass3Prompt({
      weeklyDraft: sampleWeeklyDraft(),
      completedLastWeek: [],
      computed: sampleComputed(),
      hardRuleOutput: emptyHardRules(),
      athleteProfile: sampleProfile(),
      kb: sampleKb(),
    });
    expect(system).toBe(PASS3_SYSTEM_PROMPT);
    expect(user).toBe(`${userStatic}\n\n${userDynamic}`);
    expect(userStatic.length).toBeGreaterThan(0);
    expect(userDynamic.length).toBeGreaterThan(0);
  });

  it('places the interface block and KB in userStatic (cacheable)', () => {
    const { userStatic } = buildPass3Prompt({
      weeklyDraft: sampleWeeklyDraft(),
      completedLastWeek: [],
      computed: sampleComputed(),
      hardRuleOutput: emptyHardRules(),
      athleteProfile: sampleProfile(),
      kb: sampleKb(),
    });
    expect(userStatic).toContain('interface AdaptationSuggestion');
    expect(userStatic).toContain('base 3 body');
    expect(userStatic).toContain('rule body');
    expect(userStatic).toContain('# Recovery');
  });

  it('places per-week inputs in userDynamic', () => {
    const { userDynamic } = buildPass3Prompt({
      weeklyDraft: sampleWeeklyDraft(),
      completedLastWeek: [],
      computed: sampleComputed(),
      hardRuleOutput: emptyHardRules(),
      athleteProfile: sampleProfile(),
      kb: sampleKb(),
    });
    expect(userDynamic).toContain('2026-05-11');
    expect(userDynamic).toContain('Computed inputs');
    expect(userDynamic).toContain('"avgReadinessLast7d": 50');
  });

  it('keeps userStatic free of per-week values that would break caching', () => {
    const { userStatic } = buildPass3Prompt({
      weeklyDraft: sampleWeeklyDraft(),
      completedLastWeek: [],
      computed: sampleComputed(),
      hardRuleOutput: emptyHardRules(),
      athleteProfile: sampleProfile(),
      kb: sampleKb(),
    });
    // Dates, computed numeric values, and serialised JSON values must live
    // in userDynamic only — userStatic legitimately contains field NAMES
    // (e.g., "lastWeekTss") via the interface block.
    expect(userStatic).not.toContain('2026-05-11');
    expect(userStatic).not.toContain('420');
    expect(userStatic).not.toContain('-13.2');
    expect(userStatic).not.toContain('"trainingDaysPerWeek": 6');
  });

  it('enumerates every draft workout in date order with day-of-week', () => {
    const { userDynamic } = buildPass3Prompt({
      weeklyDraft: sampleWeeklyDraft(),
      completedLastWeek: [],
      computed: sampleComputed(),
      hardRuleOutput: emptyHardRules(),
      athleteProfile: sampleProfile(),
      kb: sampleKb(),
    });
    const tueIdx = userDynamic.indexOf('2026-05-12 (tue): C/AE1');
    const thuIdx = userDynamic.indexOf('2026-05-14 (thu): C/ME1');
    const friIdx = userDynamic.indexOf('2026-05-15 (fri): D/AE2');
    expect(tueIdx).toBeGreaterThan(-1);
    expect(thuIdx).toBeGreaterThan(tueIdx);
    expect(friIdx).toBeGreaterThan(thuIdx);
  });

  it('renders an empty completedLastWeek with an explicit placeholder', () => {
    const { userDynamic } = buildPass3Prompt({
      weeklyDraft: sampleWeeklyDraft(),
      completedLastWeek: [],
      computed: sampleComputed(),
      hardRuleOutput: emptyHardRules(),
      athleteProfile: sampleProfile(),
      kb: sampleKb(),
    });
    expect(userDynamic).toContain('no completed workouts logged');
  });

  it('renders completed workouts with planned-vs-actual TSS, RPE, and notes', () => {
    const completed: WorkoutCompleted[] = [
      {
        date: '2026-05-09',
        workoutCode: 'D/AE2',
        actualTss: 95,
        plannedTss: 120,
        perceivedExertion: 8,
        completionStatus: 'partial',
        notes: 'cramped on last 20min',
      },
    ];
    const { userDynamic } = buildPass3Prompt({
      weeklyDraft: sampleWeeklyDraft(),
      completedLastWeek: completed,
      computed: sampleComputed(),
      hardRuleOutput: emptyHardRules(),
      athleteProfile: sampleProfile(),
      kb: sampleKb(),
    });
    expect(userDynamic).toContain('partial');
    expect(userDynamic).toContain('TSS 95/120');
    expect(userDynamic).toContain('RPE 8');
    expect(userDynamic).toContain('cramped on last 20min');
  });

  it('renders an empty hardRuleOutput with an explicit placeholder', () => {
    const { userDynamic } = buildPass3Prompt({
      weeklyDraft: sampleWeeklyDraft(),
      completedLastWeek: [],
      computed: sampleComputed(),
      hardRuleOutput: emptyHardRules(),
      athleteProfile: sampleProfile(),
      kb: sampleKb(),
    });
    expect(userDynamic).toContain('no hard rules fired this week');
  });

  it('renders a non-empty hardRuleOutput with action and reason', () => {
    const hardRules: HardRuleOutput = {
      forcedAdjustments: [
        { date: '2026-05-15', action: 'force_rest', reason: 'illness flagged in profile' },
        {
          date: '2026-05-14',
          action: 'force_replace',
          newWorkoutCode: 'C/AE1',
          reason: 'mandatory taper',
        },
      ],
    };
    const { userDynamic } = buildPass3Prompt({
      weeklyDraft: sampleWeeklyDraft(),
      completedLastWeek: [],
      computed: sampleComputed(),
      hardRuleOutput: hardRules,
      athleteProfile: sampleProfile(),
      kb: sampleKb(),
    });
    expect(userDynamic).toContain('force_rest');
    expect(userDynamic).toContain('illness flagged');
    expect(userDynamic).toContain('force_replace → C/AE1');
    expect(userDynamic).toContain('mandatory taper');
  });

  it('embeds the athlete profile as pretty-printed JSON in userDynamic', () => {
    const { userDynamic } = buildPass3Prompt({
      weeklyDraft: sampleWeeklyDraft(),
      completedLastWeek: [],
      computed: sampleComputed(),
      hardRuleOutput: emptyHardRules(),
      athleteProfile: sampleProfile(),
      kb: sampleKb(),
    });
    expect(userDynamic).toContain('"trainingDaysPerWeek": 6');
    expect(userDynamic).toContain('"longSessionDays"');
  });

  it('preserves numeric precision of computed inputs in the prompt (no rounding)', () => {
    const { userDynamic } = buildPass3Prompt({
      weeklyDraft: sampleWeeklyDraft(),
      completedLastWeek: [],
      computed: sampleComputed({ currentCtl: 65.1234567, currentTsb: -13.7654321 }),
      hardRuleOutput: emptyHardRules(),
      athleteProfile: sampleProfile(),
      kb: sampleKb(),
    });
    expect(userDynamic).toContain('65.1234567');
    expect(userDynamic).toContain('-13.7654321');
  });
});
