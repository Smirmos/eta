import type Anthropic from '@anthropic-ai/sdk';
import type { ConfigService } from '@nestjs/config';
import type { AthleteProfile, MacroPlan } from '@eta/shared-types';
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../../config/env.schema.js';
import type { KnowledgeBase, KnowledgeBaseLoader } from './knowledge-base.loader.js';
import {
  type AnthropicLike,
  PlanGenerationError,
  PlanGenerationService,
} from './plan-generation.service.js';

const ENV: Record<string, unknown> = {
  ANTHROPIC_API_KEY: 'test-key',
  ANTHROPIC_MODEL: 'claude-opus-4-7',
  ANTHROPIC_MAX_TOKENS: 16000,
};

function makeConfig(): ConfigService<Env, true> {
  return {
    get: (key: string) => ENV[key],
  } as unknown as ConfigService<Env, true>;
}

function makeKbLoader(): KnowledgeBaseLoader {
  const kb: KnowledgeBase = {
    zones: '# zones',
    atpStructure: '# atp',
    workouts: '# workouts',
    weeklyTemplates: '# weekly',
    recovery: '# recovery',
    totalChars: 60,
    loadedFrom: '/tmp/kb',
  };
  return { get: () => kb } as unknown as KnowledgeBaseLoader;
}

const FUTURE_RACE_DATE = new Date(Date.now() + 105 * 24 * 60 * 60 * 1000); // ~15 weeks
const FUTURE_RACE_ISO = FUTURE_RACE_DATE.toISOString().slice(0, 10);

const validProfile = (): AthleteProfile => ({
  experienceLevel: 'tri_experienced',
  raceDate: FUTURE_RACE_DATE,
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
});

function buildValidPlan(profileId: string, raceIso: string): MacroPlan {
  // Race-week Monday: race is Saturday Aug 22 → race-week Monday is 4 days before.
  const raceMs = new Date(`${raceIso}T00:00:00Z`).getTime();
  const raceDay = new Date(`${raceIso}T00:00:00Z`).getUTCDay(); // 0=Sun..6=Sat
  // Monday of race week = race date minus (raceDay - 1) days. JS getUTCDay: Mon=1.
  // For Sat (6): Mon is 5 days earlier.
  const offsetToMon = raceDay === 0 ? 6 : raceDay - 1;
  const raceWeekMonMs = raceMs - offsetToMon * 86_400_000;

  const weeks: MacroPlan['weeks'] = [];
  // 3 weeks: build_2 → peak → race_week.
  for (let i = 2; i >= 0; i--) {
    const weekStart = new Date(raceWeekMonMs - i * 7 * 86_400_000);
    const weekStartIso = weekStart.toISOString().slice(0, 10);
    const phase: MacroPlan['weeks'][number]['phase'] =
      i === 0 ? 'race_week' : i === 1 ? 'peak' : 'build_2';
    const weekNumber = i + 1; // race_week=1, peak=2, build_2=3
    weeks.push({
      weekNumber,
      weekStartDate: weekStartIso,
      phase,
      isRecoveryWeek: phase === 'race_week',
      weeklyVolumeHours: phase === 'race_week' ? 4 : phase === 'peak' ? 8 : 11,
      keySessions: [
        {
          workoutCode: 'B/AE2',
          discipline: 'bike',
          rationale: 'Aerobic endurance ride at sub-threshold to build aerobic capacity.',
          citation: 'knowledge-base/03-workouts.md#b-ae2',
        },
      ],
    });
  }

  return {
    athleteProfileId: profileId,
    raceDate: raceIso,
    generatedAt: new Date().toISOString(),
    totalWeeks: weeks.length,
    weeks,
  };
}

function fakeAnthropic(
  text: string,
  opts: { input?: number; output?: number } = {},
): AnthropicLike {
  return {
    messages: {
      create: vi.fn(
        async () =>
          ({
            id: 'msg_test',
            type: 'message',
            role: 'assistant',
            model: 'claude-opus-4-7',
            content: [{ type: 'text', text } as Anthropic.Messages.TextBlock],
            stop_reason: 'end_turn',
            stop_sequence: null,
            usage: {
              input_tokens: opts.input ?? 1234,
              output_tokens: opts.output ?? 567,
            },
          }) as unknown as Anthropic.Messages.Message,
      ),
    },
  } as unknown as AnthropicLike;
}

describe('PlanGenerationService', () => {
  it('returns a parsed MacroPlan when the LLM emits valid JSON', async () => {
    const plan = buildValidPlan('test-profile-1', FUTURE_RACE_ISO);
    const client = fakeAnthropic(JSON.stringify(plan));
    const service = new PlanGenerationService(makeConfig(), makeKbLoader(), () => client);

    const result = await service.generateMacroPlan(validProfile(), 'test-profile-1');

    expect(result.plan.athleteProfileId).toBe('test-profile-1');
    expect(result.plan.totalWeeks).toBe(3);
    expect(result.usage.inputTokens).toBe(1234);
    expect(result.usage.outputTokens).toBe(567);
    expect(result.rawResponse).toContain('test-profile-1');
  });

  it('throws PlanGenerationError with raw response when LLM emits invalid JSON', async () => {
    const client = fakeAnthropic('not json at all');
    const service = new PlanGenerationService(makeConfig(), makeKbLoader(), () => client);

    await expect(service.generateMacroPlan(validProfile(), 'pid')).rejects.toMatchObject({
      name: 'PlanGenerationError',
      message: expect.stringContaining('not valid JSON'),
      rawResponse: 'not json at all',
    });
  });

  it('throws PlanGenerationError with validation issues when schema rejects the plan', async () => {
    const badPlan = { athleteProfileId: '', raceDate: 'not-a-date', weeks: [], totalWeeks: 0 };
    const client = fakeAnthropic(JSON.stringify(badPlan));
    const service = new PlanGenerationService(makeConfig(), makeKbLoader(), () => client);

    try {
      await service.generateMacroPlan(validProfile(), 'pid');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(PlanGenerationError);
      const e = err as PlanGenerationError;
      expect(e.validationIssues).toBeDefined();
      expect(e.validationIssues!.length).toBeGreaterThan(0);
      expect(e.rawResponse).toContain('not-a-date');
    }
  });

  it('rejects an AthleteProfile that fails input schema (raceDate in the past)', async () => {
    const client = fakeAnthropic('{}');
    const service = new PlanGenerationService(makeConfig(), makeKbLoader(), () => client);

    const profile = validProfile();
    profile.raceDate = new Date('2020-01-01');
    profile.weeksUntilRace = -1000;

    await expect(service.generateMacroPlan(profile, 'pid')).rejects.toThrow(
      /AthleteProfile failed input validation/,
    );
  });

  it('propagates Anthropic API errors as PlanGenerationError', async () => {
    const failingClient: AnthropicLike = {
      messages: {
        create: vi.fn(async () => {
          throw new Error('upstream timeout');
        }),
      },
    } as unknown as AnthropicLike;
    const service = new PlanGenerationService(makeConfig(), makeKbLoader(), () => failingClient);

    await expect(service.generateMacroPlan(validProfile(), 'pid')).rejects.toMatchObject({
      name: 'PlanGenerationError',
      message: expect.stringContaining('upstream timeout'),
    });
  });
});
