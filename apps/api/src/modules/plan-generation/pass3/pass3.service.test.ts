import type Anthropic from '@anthropic-ai/sdk';
import type { ConfigService } from '@nestjs/config';
import type {
  AdaptationSuggestion,
  AthleteProfile,
  DailyReadinessReading,
  WeeklyDetail,
} from '@eta/shared-types';
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../../../config/env.schema.js';
import type { KnowledgeBase, KnowledgeBaseLoader } from '../knowledge-base.loader.js';
import {
  type AnthropicLike,
  Pass3GenerationError,
  Pass3GenerationService,
} from './pass3.service.js';

// sampleDraft starts on 2026-05-11 → 7-day readiness window is 05-04..05-10.
function stubReadinessHistory(score: number): DailyReadinessReading[] {
  return [
    '2026-05-04',
    '2026-05-05',
    '2026-05-06',
    '2026-05-07',
    '2026-05-08',
    '2026-05-09',
    '2026-05-10',
  ].map((date) => ({ date, readinessScore: score, source: 'stub' as const }));
}

const ENV: Record<string, unknown> = {
  ANTHROPIC_API_KEY: 'test-key',
  ANTHROPIC_MODEL: 'claude-opus-4-7',
  ANTHROPIC_MAX_TOKENS: 16000,
  HRV_DROP_NOTE_PCT: 5,
  HRV_DROP_DOWNGRADE_PCT: 10,
  HRV_DROP_FORCED_REST_PCT: 20,
  HRV_STREAK_DROP_PCT: 5,
  HRV_STREAK_DAYS: 3,
  HRV_ROLLING_WINDOW_DAYS: 7,
  HRV_DOWNGRADE_DURATION_RATIO: 0.7,
};

function makeConfig(): ConfigService<Env, true> {
  return { get: (key: string) => ENV[key] } as unknown as ConfigService<Env, true>;
}

function makeKbLoader(): KnowledgeBaseLoader {
  const kb: KnowledgeBase = {
    zones: '# zones',
    atpStructure: '# atp\n#### Base 3\nbase 3 body.\n',
    workouts: '# workouts',
    weeklyTemplates: '# weekly\n\n## Workout placement rules\nrules.\n',
    recovery: '# recovery\nbody.\n',
    totalChars: 200,
    loadedFrom: '/tmp/kb',
  };
  return { get: () => kb } as unknown as KnowledgeBaseLoader;
}

function fakeAnthropic(
  text: string,
  opts: { input?: number; output?: number; cacheCreate?: number; cacheRead?: number } = {},
): AnthropicLike {
  return {
    beta: {
      messages: {
        create: vi.fn(
          async () =>
            ({
              id: 'msg_test',
              type: 'message',
              role: 'assistant',
              model: 'claude-opus-4-7',
              content: [{ type: 'text', text } as Anthropic.Beta.Messages.BetaTextBlock],
              stop_reason: 'end_turn',
              stop_sequence: null,
              usage: {
                input_tokens: opts.input ?? 1234,
                output_tokens: opts.output ?? 567,
                cache_creation_input_tokens: opts.cacheCreate ?? 0,
                cache_read_input_tokens: opts.cacheRead ?? 0,
              },
            }) as unknown as Anthropic.Beta.Messages.BetaMessage,
        ),
      },
    },
  } as unknown as AnthropicLike;
}

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
  };
}

function sampleDraft(): WeeklyDetail {
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
    ],
  };
}

function validSuggestion(): AdaptationSuggestion {
  return {
    forWeekStart: '2026-05-11',
    generatedAt: '2026-05-10T22:00:00Z',
    inputs: {
      lastWeekTss: 0,
      currentCtl: 0,
      currentAtl: 0,
      currentTsb: 0,
      avgReadinessLast7d: 50,
    },
    adjustments: [
      {
        originalDate: '2026-05-12',
        originalWorkoutCode: 'C/AE1',
        action: 'keep',
        reasoning: 'within readiness band, no signal to change.',
        citation: 'knowledge-base/02-atp-structure.md#base-3',
      },
    ],
  };
}

describe('Pass3GenerationService', () => {
  it('returns a parsed AdaptationSuggestion when the LLM emits valid JSON', async () => {
    const client = fakeAnthropic(JSON.stringify(validSuggestion()), {
      input: 1500,
      output: 400,
      cacheCreate: 8000,
      cacheRead: 0,
    });
    const service = new Pass3GenerationService(makeConfig(), makeKbLoader(), () => client);

    const result = await service.generateAdaptation({
      weeklyDraft: sampleDraft(),
      completedLastWeek: [],
      readinessHistory: stubReadinessHistory(50),
      athleteProfile: sampleProfile(),
    });

    expect(result.output.suggestion.forWeekStart).toBe('2026-05-11');
    expect(result.output.suggestion.adjustments).toHaveLength(1);
    expect(result.output.appliedSources).toEqual(['knowledge-base/02-atp-structure.md#base-3']);
    expect(result.usage.inputTokens).toBe(1500);
    expect(result.usage.cacheCreationInputTokens).toBe(8000);
    expect(result.usage.cacheReadInputTokens).toBe(0);
  });

  it('overwrites suggestion.inputs with computed values', async () => {
    // LLM echoes wrong inputs; service should overwrite with computed (0s here
    // since completedLastWeek is empty).
    const wrong = validSuggestion();
    wrong.inputs = {
      lastWeekTss: 999,
      currentCtl: 999,
      currentAtl: 999,
      currentTsb: 999,
      avgReadinessLast7d: 999,
    };
    const client = fakeAnthropic(JSON.stringify(wrong));
    const service = new Pass3GenerationService(makeConfig(), makeKbLoader(), () => client);

    const result = await service.generateAdaptation({
      weeklyDraft: sampleDraft(),
      completedLastWeek: [],
      readinessHistory: stubReadinessHistory(42),
      athleteProfile: sampleProfile(),
    });

    expect(result.output.suggestion.inputs.lastWeekTss).toBe(0);
    expect(result.output.suggestion.inputs.avgReadinessLast7d).toBe(42);
    expect(result.output.computed.avgReadinessLast7d).toBe(42);
  });

  it('throws Pass3GenerationError with raw response when LLM emits invalid JSON', async () => {
    const client = fakeAnthropic('not json');
    const service = new Pass3GenerationService(makeConfig(), makeKbLoader(), () => client);
    await expect(
      service.generateAdaptation({
        weeklyDraft: sampleDraft(),
        completedLastWeek: [],
        readinessHistory: stubReadinessHistory(50),
        athleteProfile: sampleProfile(),
      }),
    ).rejects.toMatchObject({
      name: 'Pass3GenerationError',
      message: expect.stringContaining('not valid JSON'),
      rawResponse: 'not json',
    });
  });

  it('throws Pass3GenerationError with validation issues when schema rejects the output', async () => {
    const client = fakeAnthropic('{"forWeekStart":"bad","adjustments":[]}');
    const service = new Pass3GenerationService(makeConfig(), makeKbLoader(), () => client);
    try {
      await service.generateAdaptation({
        weeklyDraft: sampleDraft(),
        completedLastWeek: [],
        readinessHistory: stubReadinessHistory(50),
        athleteProfile: sampleProfile(),
      });
      expect.fail('should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(Pass3GenerationError);
      const e = err as Pass3GenerationError;
      expect(e.validationIssues).toBeDefined();
      expect(e.validationIssues!.length).toBeGreaterThan(0);
    }
  });

  it('throws Pass3GenerationError with constraint violations when the LLM skips a draft workout', async () => {
    // Draft has 1 workout (C/AE1 on Tue). LLM emits suggestion with 0 adjustments.
    const sug = validSuggestion();
    sug.adjustments = [];
    const client = fakeAnthropic(JSON.stringify(sug));
    const service = new Pass3GenerationService(makeConfig(), makeKbLoader(), () => client);
    try {
      await service.generateAdaptation({
        weeklyDraft: sampleDraft(),
        completedLastWeek: [],
        readinessHistory: stubReadinessHistory(50),
        athleteProfile: sampleProfile(),
      });
      expect.fail('should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(Pass3GenerationError);
      const e = err as Pass3GenerationError;
      expect(e.constraintViolations).toBeDefined();
      expect(e.constraintViolations!.some((v) => /Missing adjustment for C\/AE1/.test(v))).toBe(true);
    }
  });

  it('propagates Anthropic API errors as Pass3GenerationError', async () => {
    const failingClient: AnthropicLike = {
      beta: {
        messages: {
          create: vi.fn(async () => {
            throw new Error('upstream timeout');
          }),
        },
      },
    } as unknown as AnthropicLike;
    const service = new Pass3GenerationService(makeConfig(), makeKbLoader(), () => failingClient);
    await expect(
      service.generateAdaptation({
        weeklyDraft: sampleDraft(),
        completedLastWeek: [],
        readinessHistory: stubReadinessHistory(50),
        athleteProfile: sampleProfile(),
      }),
    ).rejects.toMatchObject({
      name: 'Pass3GenerationError',
      message: expect.stringContaining('upstream timeout'),
    });
  });

  it('passes split system+userStatic+userDynamic with cache_control to the Anthropic client', async () => {
    const createSpy = vi.fn(
      async () =>
        ({
          id: 'msg',
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-4-7',
          content: [
            { type: 'text', text: JSON.stringify(validSuggestion()) } as Anthropic.Beta.Messages.BetaTextBlock,
          ],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: {
            input_tokens: 1,
            output_tokens: 1,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          },
        }) as unknown as Anthropic.Beta.Messages.BetaMessage,
    );
    const client = { beta: { messages: { create: createSpy } } } as unknown as AnthropicLike;
    const service = new Pass3GenerationService(makeConfig(), makeKbLoader(), () => client);

    await service.generateAdaptation({
      weeklyDraft: sampleDraft(),
      completedLastWeek: [],
      readinessHistory: stubReadinessHistory(50),
      athleteProfile: sampleProfile(),
    });

    expect(createSpy).toHaveBeenCalledTimes(1);
    const calls = createSpy.mock.calls as unknown as Array<
      [
        {
          system: Array<{ cache_control?: unknown; text: string }>;
          messages: Array<{ content: Array<{ cache_control?: unknown; text: string }> }>;
        },
      ]
    >;
    const arg = calls[0]![0];
    expect(arg.system[0]!.cache_control).toEqual({ type: 'ephemeral' });
    // userStatic (cached) precedes userDynamic (uncached).
    expect(arg.messages[0]!.content[0]!.cache_control).toEqual({ type: 'ephemeral' });
    expect(arg.messages[0]!.content[1]!.cache_control).toBeUndefined();
    expect(arg.messages[0]!.content[0]!.text).toContain('interface AdaptationSuggestion');
    expect(arg.messages[0]!.content[1]!.text).toContain('Computed inputs');
  });

  it('runs hard-rules pre-pass and surfaces forced adjustments in the prompt + output', async () => {
    // Readiness score 30 (< 50) on the day of the drafted workout — readiness.red.
    const lowReadinessHistory = stubReadinessHistory(30).concat([
      { date: '2026-05-12', readinessScore: 30, source: 'oura' },
    ]);
    const createSpy = vi.fn(
      async () =>
        ({
          id: 'msg',
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-4-7',
          content: [
            { type: 'text', text: JSON.stringify(validSuggestion()) } as Anthropic.Beta.Messages.BetaTextBlock,
          ],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: {
            input_tokens: 1,
            output_tokens: 1,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          },
        }) as unknown as Anthropic.Beta.Messages.BetaMessage,
    );
    const client = { beta: { messages: { create: createSpy } } } as unknown as AnthropicLike;
    const service = new Pass3GenerationService(makeConfig(), makeKbLoader(), () => client);

    const result = await service.generateAdaptation({
      weeklyDraft: sampleDraft(),
      completedLastWeek: [],
      readinessHistory: lowReadinessHistory,
      athleteProfile: sampleProfile(),
    });

    // Prompt received the force_rest line in the hard-rule block.
    const calls = createSpy.mock.calls as unknown as Array<
      [{ messages: Array<{ content: Array<{ text: string }> }> }]
    >;
    const userDynamic = calls[0]![0]!.messages[0]!.content[1]!.text;
    expect(userDynamic).toContain('2026-05-12: force_rest');
    expect(userDynamic).toContain('Daily readiness 30');

    // Pass3Output includes the hard-rule artefacts.
    expect(result.output.hardRuleOutput.forcedAdjustments).toHaveLength(1);
    expect(result.output.hardRuleOutput.forcedAdjustments[0]!.action).toBe('force_rest');
    expect(result.output.hardRulesApplied.some((r) => r.ruleId === 'readiness.red')).toBe(true);
  });

  it('runs cleanly in Strava-only mode (no readiness data at all)', async () => {
    // ETA-25 Strava-only mode: no Oura/Luna readiness signal. Hard-rules
    // engine must skip readiness/HRV bands (no firings), Pass 3 must still
    // call the LLM with neutral 50 as avgReadinessLast7d (the documented
    // stub fallback), and Pass3Output must report zero forced adjustments.
    const createSpy = vi.fn(
      async () =>
        ({
          id: 'msg',
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-4-7',
          content: [
            { type: 'text', text: JSON.stringify(validSuggestion()) } as Anthropic.Beta.Messages.BetaTextBlock,
          ],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: {
            input_tokens: 1,
            output_tokens: 1,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          },
        }) as unknown as Anthropic.Beta.Messages.BetaMessage,
    );
    const client = { beta: { messages: { create: createSpy } } } as unknown as AnthropicLike;
    const service = new Pass3GenerationService(makeConfig(), makeKbLoader(), () => client);

    const result = await service.generateAdaptation({
      weeklyDraft: sampleDraft(),
      completedLastWeek: [],
      readinessHistory: [], // No wearable connected.
      athleteProfile: sampleProfile(),
    });

    expect(result.output.hardRuleOutput.forcedAdjustments).toHaveLength(0);
    expect(result.output.hardRulesApplied).toHaveLength(0);
    expect(result.output.computed.avgReadinessLast7d).toBe(50);
    expect(createSpy).toHaveBeenCalledTimes(1);
    const calls = createSpy.mock.calls as unknown as Array<
      [{ messages: Array<{ content: Array<{ text: string }> }> }]
    >;
    const userDynamic = calls[0]![0]!.messages[0]!.content[1]!.text;
    expect(userDynamic).toContain('no hard rules fired this week');
    expect(userDynamic).toContain('"avgReadinessLast7d": 50');
  });
});
