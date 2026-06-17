import type Anthropic from '@anthropic-ai/sdk';
import type { ConfigService } from '@nestjs/config';
import type {
  AthleteProfile,
  MacroPlan,
  WeeklyDetail,
} from '@eta/shared-types';
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../../../config/env.schema.js';
import type {
  WeeklyDetailRecord,
  WeeklyDetailsRepository,
} from '../../../db/repositories/weekly-details.repository.js';
import type { KnowledgeBase, KnowledgeBaseLoader } from '../knowledge-base.loader.js';
import { Pass2GenerationError, Pass2GenerationService } from './pass2.service.js';

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
    atpStructure: '#### Base 2\nbase 2 content',
    workouts: '## Appendix C: Bike Workouts\nintro\n### C/AE2: Long aerobic ride\nbody',
    weeklyTemplates: '## Workout placement rules\nrules content',
    recovery: '# recovery',
    totalChars: 200,
    loadedFrom: '/tmp/kb',
  };
  return { get: () => kb } as unknown as KnowledgeBaseLoader;
}

const MACRO_PLAN_ID = 'macro-plan-id-1';
const WEEKLY_DETAIL_ID = 'weekly-detail-id-1';

function makeWeeklyRepo(): {
  repo: WeeklyDetailsRepository;
  createSpy: ReturnType<typeof vi.fn>;
} {
  const createSpy = vi.fn(
    async (input: { macroPlanId: string; detail: unknown }): Promise<WeeklyDetailRecord> => ({
      id: WEEKLY_DETAIL_ID,
      macroPlanId: input.macroPlanId,
      weekNumber: (input.detail as { weekNumber: number }).weekNumber,
      detail: input.detail as never,
      generatedAt: new Date('2026-06-17T12:00:00Z'),
    }),
  );
  const repo = { create: createSpy } as unknown as WeeklyDetailsRepository;
  return { repo, createSpy };
}

const FUTURE_RACE_DATE = new Date(Date.now() + 105 * 24 * 60 * 60 * 1000);

function validProfile(): AthleteProfile {
  return {
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
    trainingDaysPerWeek: 2,
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
  };
}

// Week starts Mon 2026-05-11. Sun = 2026-05-17.
const WEEK_START = '2026-05-11';

function buildMacroPlan(): MacroPlan {
  return {
    athleteProfileId: 'test-profile-1',
    raceDate: FUTURE_RACE_DATE.toISOString().slice(0, 10),
    generatedAt: '2026-05-07T00:00:00Z',
    totalWeeks: 1,
    weeks: [
      {
        weekNumber: 15,
        weekStartDate: WEEK_START,
        phase: 'base_2',
        isRecoveryWeek: false,
        weeklyVolumeHours: 3,
        keySessions: [
          {
            workoutCode: 'C/AE2',
            discipline: 'bike',
            dayOfWeek: 'sun',
            rationale: 'Long aerobic ride',
            citation: 'knowledge-base/03-workouts.md#c-ae2',
          },
        ],
      },
    ],
  };
}

function buildWeeklyDetail(): WeeklyDetail {
  return {
    weekNumber: 15,
    weekStartDate: WEEK_START,
    phase: 'base_2',
    workouts: [
      {
        workoutCode: 'C/AE2',
        discipline: 'bike',
        date: '2026-05-17', // Sunday
        totalDurationSeconds: 10800,
        segments: [
          {
            label: 'Warmup',
            durationSeconds: 900,
            zone: 'z1',
            description: 'Easy spin warmup',
          },
          {
            label: 'Main set',
            durationSeconds: 9000,
            zone: 'z2',
            description: 'Steady aerobic effort',
          },
          {
            label: 'Cooldown',
            durationSeconds: 900,
            zone: 'z1',
            description: 'Easy spin cooldown',
          },
        ],
        rationale: 'Long aerobic ride',
        citation: 'knowledge-base/03-workouts.md#c-ae2',
      },
    ],
  };
}

function fakeAnthropic(
  text: string,
  opts: { input?: number; output?: number } = {},
): Pick<Anthropic, 'messages'> {
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
  } as unknown as Pick<Anthropic, 'messages'>;
}

describe('Pass2GenerationService', () => {
  it('returns a parsed WeeklyDetail when the LLM emits valid JSON', async () => {
    const detail = buildWeeklyDetail();
    const client = fakeAnthropic(JSON.stringify(detail));
    const { repo } = makeWeeklyRepo();
    const service = new Pass2GenerationService(makeConfig(), makeKbLoader(), repo, () => client);

    const result = await service.generateWeeklyDetail({
      macroPlanId: MACRO_PLAN_ID,
      macroPlan: buildMacroPlan(),
      targetWeekIndex: 0,
      athleteProfile: validProfile(),
      recentWorkouts: [],
    });

    expect(result.output.weeklyDetail.weekNumber).toBe(15);
    expect(result.output.weeklyDetail.weekStartDate).toBe(WEEK_START);
    expect(result.usage.inputTokens).toBe(1234);
    expect(result.usage.outputTokens).toBe(567);
  });

  it('throws Pass2GenerationError with raw response when LLM emits invalid JSON', async () => {
    const client = fakeAnthropic('not json at all');
    const { repo } = makeWeeklyRepo();
    const service = new Pass2GenerationService(makeConfig(), makeKbLoader(), repo, () => client);

    await expect(
      service.generateWeeklyDetail({
        macroPlanId: MACRO_PLAN_ID,
        macroPlan: buildMacroPlan(),
        targetWeekIndex: 0,
        athleteProfile: validProfile(),
        recentWorkouts: [],
      }),
    ).rejects.toMatchObject({
      name: 'Pass2GenerationError',
      message: expect.stringContaining('not valid JSON'),
      rawResponse: 'not json at all',
    });
  });

  it('throws Pass2GenerationError with validation issues when schema rejects the detail', async () => {
    const badDetail = { weekNumber: 'nope', weekStartDate: 'not-a-date', phase: 'x', workouts: [] };
    const client = fakeAnthropic(JSON.stringify(badDetail));
    const { repo } = makeWeeklyRepo();
    const service = new Pass2GenerationService(makeConfig(), makeKbLoader(), repo, () => client);

    try {
      await service.generateWeeklyDetail({
        macroPlanId: MACRO_PLAN_ID,
        macroPlan: buildMacroPlan(),
        targetWeekIndex: 0,
        athleteProfile: validProfile(),
        recentWorkouts: [],
      });
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(Pass2GenerationError);
      const e = err as Pass2GenerationError;
      expect(e.validationIssues).toBeDefined();
      expect(e.validationIssues!.length).toBeGreaterThan(0);
    }
  });

  it('propagates Anthropic API errors as Pass2GenerationError', async () => {
    const failingClient: Pick<Anthropic, 'messages'> = {
      messages: {
        create: vi.fn(async () => {
          throw new Error('upstream timeout');
        }),
      },
    } as unknown as Pick<Anthropic, 'messages'>;
    const { repo } = makeWeeklyRepo();
    const service = new Pass2GenerationService(
      makeConfig(),
      makeKbLoader(),
      repo,
      () => failingClient,
    );

    await expect(
      service.generateWeeklyDetail({
        macroPlanId: MACRO_PLAN_ID,
        macroPlan: buildMacroPlan(),
        targetWeekIndex: 0,
        athleteProfile: validProfile(),
        recentWorkouts: [],
      }),
    ).rejects.toMatchObject({
      name: 'Pass2GenerationError',
      message: expect.stringContaining('upstream timeout'),
    });
  });

  it('throws when targetWeekIndex is out of range', async () => {
    const client = fakeAnthropic('{}');
    const { repo } = makeWeeklyRepo();
    const service = new Pass2GenerationService(makeConfig(), makeKbLoader(), repo, () => client);

    await expect(
      service.generateWeeklyDetail({
        macroPlanId: MACRO_PLAN_ID,
        macroPlan: buildMacroPlan(),
        targetWeekIndex: 5,
        athleteProfile: validProfile(),
        recentWorkouts: [],
      }),
    ).rejects.toThrow(/targetWeekIndex 5 out of range/);
  });

  it('persists the weekly detail after successful generation', async () => {
    const detail = buildWeeklyDetail();
    const client = fakeAnthropic(JSON.stringify(detail));
    const { repo, createSpy } = makeWeeklyRepo();
    const service = new Pass2GenerationService(makeConfig(), makeKbLoader(), repo, () => client);

    const result = await service.generateWeeklyDetail({
      macroPlanId: MACRO_PLAN_ID,
      macroPlan: buildMacroPlan(),
      targetWeekIndex: 0,
      athleteProfile: validProfile(),
      recentWorkouts: [],
    });

    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(createSpy).toHaveBeenCalledWith({
      macroPlanId: MACRO_PLAN_ID,
      detail: result.output.weeklyDetail,
    });
    expect(result.weeklyDetailId).toBe(WEEKLY_DETAIL_ID);
  });
});
