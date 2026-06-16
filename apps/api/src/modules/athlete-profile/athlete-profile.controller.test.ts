import type { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { AthleteProfile } from '@eta/shared-types';
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../../config/env.schema.js';
import type {
  AthleteProfileRecord,
  AthleteProfileRepository,
} from '../../db/repositories/athlete-profile.repository.js';
import { AthleteProfileService } from './athlete-profile.service.js';
import { AthleteProfileController } from './athlete-profile.controller.js';

const USER_ID = '00000000-0000-0000-0000-000000000001';

function makeConfig(): ConfigService<Env, true> {
  return { get: (_k: string) => USER_ID } as unknown as ConfigService<Env, true>;
}

function validProfileBody(): unknown {
  return {
    experienceLevel: 'tri_experienced',
    raceDate: '2026-08-22T00:00:00Z',
    raceType: 'full_ironman',
    weeksUntilRace: 10,
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
    generatedAt: '2026-06-16T12:00:00Z',
    warnings: [],
  };
}

function makeService(opts: {
  createReturns?: AthleteProfileRecord;
  latest?: AthleteProfile | null;
}): {
  service: AthleteProfileService;
  createSpy: ReturnType<typeof vi.fn>;
} {
  const createSpy = vi.fn(async () => opts.createReturns ?? ({} as AthleteProfileRecord));
  const getLatestSpy = vi.fn(async () => opts.latest ?? null);
  const service = {
    create: createSpy,
    getLatestFor: getLatestSpy,
  } as unknown as AthleteProfileService;
  return { service, createSpy };
}

describe('AthleteProfileController', () => {
  it('POST validates the body and creates a profile', async () => {
    const createReturns: AthleteProfileRecord = {
      id: 'p-1',
      userId: USER_ID,
      profile: {} as AthleteProfile,
      source: 'mixed',
      overallConfidence: 'medium',
      generatedAt: new Date('2026-06-16T12:00:00Z'),
      updatedAt: new Date('2026-06-16T12:00:00Z'),
    };
    const { service, createSpy } = makeService({ createReturns });
    const controller = new AthleteProfileController(service, makeConfig());

    const out = await controller.create(validProfileBody());

    expect(out).toEqual({
      id: 'p-1',
      userId: USER_ID,
      generatedAt: createReturns.generatedAt.toISOString(),
      updatedAt: createReturns.updatedAt.toISOString(),
    });
    expect(createSpy).toHaveBeenCalledTimes(1);
    const callArg = createSpy.mock.calls[0]![0] as { userId: string };
    expect(callArg.userId).toBe(USER_ID);
  });

  it('POST rejects invalid bodies with BadRequestException', async () => {
    const { service } = makeService({});
    const controller = new AthleteProfileController(service, makeConfig());
    await expect(controller.create({ not: 'a profile' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('GET /me returns the latest profile', async () => {
    const stored = {
      experienceLevel: 'tri_experienced',
    } as unknown as AthleteProfile;
    const { service } = makeService({ latest: stored });
    const controller = new AthleteProfileController(service, makeConfig());
    const out = await controller.getMe();
    expect(out).toBe(stored);
  });

  it('GET /me throws NotFoundException when no profile exists', async () => {
    const { service } = makeService({ latest: null });
    const controller = new AthleteProfileController(service, makeConfig());
    await expect(controller.getMe()).rejects.toBeInstanceOf(NotFoundException);
  });
});
