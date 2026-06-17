import { type MacroPlan, type WeeklyDetail } from '@eta/shared-types';
import { describe, expect, it, vi } from 'vitest';
import type {
  MacroPlanRecord,
  MacroPlansRepository,
} from '../../db/repositories/macro-plans.repository.js';
import type { WeeklyDetailsRepository } from '../../db/repositories/weekly-details.repository.js';
import { PlansService } from './plans.service.js';

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

describe('PlansService', () => {
  it('getLatestTreeForUser returns null when no macro plan exists', async () => {
    const svc = new PlansService(makeMacroRepo({ latest: null }), makeWeeklyRepo(new Map()));
    const tree = await svc.getLatestTreeForUser(USER_ID);
    expect(tree).toBeNull();
  });

  it('getLatestTreeForUser zips macro weeks with weekly details, null when missing', async () => {
    const record = macroRecord();
    const map = new Map<number, WeeklyDetail>([
      [14, weeklyDetail(14)],
      [12, weeklyDetail(12)],
    ]);
    const svc = new PlansService(makeMacroRepo({ latest: record }), makeWeeklyRepo(map));
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
    const svc = new PlansService(makeMacroRepo({ byId: null }), makeWeeklyRepo(new Map()));
    const tree = await svc.getTreeById('does-not-exist');
    expect(tree).toBeNull();
  });

  it('getTreeById returns the tree when found', async () => {
    const svc = new PlansService(makeMacroRepo({ byId: macroRecord() }), makeWeeklyRepo(new Map()));
    const tree = await svc.getTreeById('macro-plan-id-1');
    expect(tree).not.toBeNull();
    expect(tree!.weeks).toHaveLength(3);
    expect(tree!.weeks.every((w) => w.weeklyDetail === null)).toBe(true);
  });
});
