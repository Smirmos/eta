import type { AthleteProfile } from '@eta/shared-types';
import { describe, expect, it, vi } from 'vitest';
import type {
  AthleteProfileRecord,
  AthleteProfileRepository,
} from '../../db/repositories/athlete-profile.repository.js';
import type { StravaRenormalizeService } from '../integrations/strava/strava-renormalize.service.js';
import { AthleteProfileService } from './athlete-profile.service.js';

const USER_ID = '00000000-0000-0000-0000-000000000001';

function profile(): AthleteProfile {
  return {
    experienceLevel: 'tri_experienced',
    raceDate: new Date('2026-08-22T00:00:00Z'),
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
    generatedAt: new Date(),
    warnings: [],
  };
}

function record(): AthleteProfileRecord {
  return {
    id: 'profile-id-1',
    userId: USER_ID,
    profile: profile(),
    source: 'mixed',
    overallConfidence: 'medium',
    generatedAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeRepo(opts: { latest?: AthleteProfile | null } = {}): AthleteProfileRepository {
  return {
    create: vi.fn(async () => record()),
    findByUserId: vi.fn(async () => opts.latest ?? null),
  } as unknown as AthleteProfileRepository;
}

function makeRenormalize(opts: { throwInside?: boolean } = {}): {
  svc: StravaRenormalizeService;
  runSpy: ReturnType<typeof vi.fn>;
} {
  const runSpy = vi.fn(async () => {
    if (opts.throwInside) throw new Error('renorm boom');
    return { userId: USER_ID, considered: 0, recomputed: 0, stillPending: 0, failed: 0 };
  });
  const svc = { run: runSpy } as unknown as StravaRenormalizeService;
  return { svc, runSpy };
}

// Helper: flush all pending microtasks + setImmediate callbacks.
function flushImmediates(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('AthleteProfileService', () => {
  it('creates a profile and schedules a background renormalise', async () => {
    const repo = makeRepo();
    const { svc: renorm, runSpy } = makeRenormalize();
    const service = new AthleteProfileService(repo, renorm);

    const out = await service.create({ userId: USER_ID, profile: profile() });
    expect(out.id).toBe('profile-id-1');

    expect(runSpy).not.toHaveBeenCalled(); // not yet — runs on next tick
    await flushImmediates();
    expect(runSpy).toHaveBeenCalledTimes(1);
    expect(runSpy).toHaveBeenCalledWith(USER_ID);
  });

  it('returning of latest is a thin pass-through', async () => {
    const stored = profile();
    const repo = makeRepo({ latest: stored });
    const { svc: renorm } = makeRenormalize();
    const service = new AthleteProfileService(repo, renorm);
    const out = await service.getLatestFor(USER_ID);
    expect(out).toBe(stored);
  });

  it('background renormalise failure does not propagate to the caller', async () => {
    const repo = makeRepo();
    const { svc: renorm } = makeRenormalize({ throwInside: true });
    const service = new AthleteProfileService(repo, renorm);

    await expect(service.create({ userId: USER_ID, profile: profile() })).resolves.toBeDefined();
    await flushImmediates();
    // Test passes if no unhandled rejection. The service's internal logger
    // swallows the error.
  });
});
