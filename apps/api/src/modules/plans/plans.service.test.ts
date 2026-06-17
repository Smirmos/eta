import { type AdaptationSuggestion, type MacroPlan, type WeeklyDetail } from '@eta/shared-types';
import { describe, expect, it, vi } from 'vitest';
import type {
  AdaptationRecord,
  AdaptationsRepository,
} from '../../db/repositories/adaptations.repository.js';
import type {
  MacroPlanRecord,
  MacroPlansRepository,
} from '../../db/repositories/macro-plans.repository.js';
import type { WeeklyDetailsRepository } from '../../db/repositories/weekly-details.repository.js';
import { PlansService, currentWeekStartDate } from './plans.service.js';

const USER_ID = '00000000-0000-0000-0000-000000000001';

const macroPlan = (): MacroPlan => ({
  athleteProfileId: 'profile-id-1',
  raceDate: '2026-09-21',
  generatedAt: '2026-06-17T12:00:00Z',
  totalWeeks: 3,
  weeks: [
    { weekNumber: 14, weekStartDate: '2026-06-15', phase: 'base_2', isRecoveryWeek: false, weeklyVolumeHours: 9, keySessions: [] },
    { weekNumber: 13, weekStartDate: '2026-06-22', phase: 'base_2', isRecoveryWeek: false, weeklyVolumeHours: 9.5, keySessions: [] },
    { weekNumber: 12, weekStartDate: '2026-06-29', phase: 'base_3', isRecoveryWeek: false, weeklyVolumeHours: 10, keySessions: [] },
  ],
});

const weeklyDetail = (weekNumber: number): WeeklyDetail => ({
  weekNumber,
  weekStartDate: '2026-06-15',
  phase: 'base_2',
  workouts: [],
});

function macroRecord(): MacroPlanRecord {
  return {
    id: 'macro-plan-id-1',
    userId: USER_ID,
    athleteProfileId: 'profile-id-1',
    plan: macroPlan(),
    generatedAt: new Date('2026-06-17T12:00:00Z'),
    updatedAt: new Date('2026-06-17T12:00:00Z'),
  };
}

function makeMacroRepo(opts: { latest?: MacroPlanRecord | null; byId?: MacroPlanRecord | null }): MacroPlansRepository {
  return {
    findLatestForUser: vi.fn(async () => opts.latest ?? null),
    findById: vi.fn(async () => opts.byId ?? null),
  } as unknown as MacroPlansRepository;
}

function makeWeeklyRepo(map: Map<number, WeeklyDetail>): WeeklyDetailsRepository {
  return {
    findLatestForMacroPlan: vi.fn(async () => map),
  } as unknown as WeeklyDetailsRepository;
}

function makeAdaptationsRepo(opts: { latest?: AdaptationRecord | null } = {}): AdaptationsRepository {
  return {
    findLatestForWeek: vi.fn(async () => opts.latest ?? null),
  } as unknown as AdaptationsRepository;
}

describe('PlansService', () => {
  it('getLatestTreeForUser returns null when no macro plan exists', async () => {
    const svc = new PlansService(
      makeMacroRepo({ latest: null }),
      makeWeeklyRepo(new Map()),
      makeAdaptationsRepo(),
    );
    const tree = await svc.getLatestTreeForUser(USER_ID);
    expect(tree).toBeNull();
  });

  it('getLatestTreeForUser zips macro weeks with weekly details, null when missing', async () => {
    const record = macroRecord();
    const map = new Map<number, WeeklyDetail>([
      [14, weeklyDetail(14)],
      [12, weeklyDetail(12)],
    ]);
    const svc = new PlansService(
      makeMacroRepo({ latest: record }),
      makeWeeklyRepo(map),
      makeAdaptationsRepo(),
    );
    const tree = await svc.getLatestTreeForUser(USER_ID);
    expect(tree).not.toBeNull();
    expect(tree!.macroPlanId).toBe('macro-plan-id-1');
    expect(tree!.weeks).toHaveLength(3);
    expect(tree!.weeks[0]!.weekNumber).toBe(14);
    expect(tree!.weeks[0]!.weeklyDetail).not.toBeNull();
    expect(tree!.weeks[1]!.weekNumber).toBe(13);
    expect(tree!.weeks[1]!.weeklyDetail).toBeNull();
    expect(tree!.weeks[2]!.weekNumber).toBe(12);
    expect(tree!.weeks[2]!.weeklyDetail).not.toBeNull();
  });

  it('getTreeById returns null when not found', async () => {
    const svc = new PlansService(
      makeMacroRepo({ byId: null }),
      makeWeeklyRepo(new Map()),
      makeAdaptationsRepo(),
    );
    const tree = await svc.getTreeById('does-not-exist');
    expect(tree).toBeNull();
  });

  it('getTreeById returns the tree when found', async () => {
    const svc = new PlansService(
      makeMacroRepo({ byId: macroRecord() }),
      makeWeeklyRepo(new Map()),
      makeAdaptationsRepo(),
    );
    const tree = await svc.getTreeById('macro-plan-id-1');
    expect(tree).not.toBeNull();
    expect(tree!.weeks).toHaveLength(3);
    expect(tree!.weeks.every((w) => w.weeklyDetail === null)).toBe(true);
  });

  describe('currentAdaptation', () => {
    it('returns the latest adaptation when one exists for the current week', async () => {
      const today = new Date('2026-06-17T12:00:00Z');
      vi.setSystemTime(today);

      const record = macroRecord();
      // Make sure week 14 (weekStartDate '2026-06-15') is the current week
      // — the macroPlan() fixture already has weeks 14/13/12 starting 06-15/06-22/06-29.

      const sampleAdaptation = {
        forWeekStart: '2026-06-15',
        adjustments: [
          {
            originalDate: '2026-06-20',
            originalWorkoutCode: 'B/AE1',
            action: 'keep',
            reasoning: 'looks good',
            citation: 'kb#x',
          },
        ],
        inputs: {
          lastWeekTss: 0,
          currentCtl: 0,
          currentAtl: 0,
          currentTsb: 0,
          avgReadinessLast7d: 50,
        },
        generatedAt: '2026-06-17T12:00:00Z',
      } as unknown as AdaptationSuggestion;

      const adaptationRecord: AdaptationRecord = {
        id: 'adapt-id-1',
        macroPlanId: 'macro-plan-id-1',
        forWeekStart: '2026-06-15',
        suggestion: sampleAdaptation,
        generatedAt: new Date('2026-06-17T12:00:00Z'),
      };

      const svc = new PlansService(
        makeMacroRepo({ latest: record }),
        makeWeeklyRepo(new Map()),
        makeAdaptationsRepo({ latest: adaptationRecord }),
      );
      const tree = await svc.getLatestTreeForUser(USER_ID);
      expect(tree!.currentAdaptation).toBe(sampleAdaptation);

      vi.useRealTimers();
    });

    it('returns null when no adaptation exists for the current week', async () => {
      const today = new Date('2026-06-17T12:00:00Z');
      vi.setSystemTime(today);

      const svc = new PlansService(
        makeMacroRepo({ latest: macroRecord() }),
        makeWeeklyRepo(new Map()),
        makeAdaptationsRepo({ latest: null }),
      );
      const tree = await svc.getLatestTreeForUser(USER_ID);
      expect(tree!.currentAdaptation).toBeNull();

      vi.useRealTimers();
    });
  });

  describe('currentWeekStartDate helper', () => {
    it('picks the week containing today', () => {
      const plan = macroPlan();
      // weeks: 14 starting 2026-06-15, 13 starting 2026-06-22, 12 starting 2026-06-29
      expect(currentWeekStartDate(plan, new Date('2026-06-17T12:00:00Z'))).toBe('2026-06-15');
      expect(currentWeekStartDate(plan, new Date('2026-06-23T00:00:00Z'))).toBe('2026-06-22');
    });

    it('returns the last week when today is past the plan', () => {
      const plan = macroPlan();
      expect(currentWeekStartDate(plan, new Date('2099-01-01T00:00:00Z'))).toBe('2026-06-29');
    });

    it('returns null when the plan has no weeks', () => {
      const plan = { ...macroPlan(), weeks: [] };
      expect(currentWeekStartDate(plan, new Date())).toBeNull();
    });
  });
});
