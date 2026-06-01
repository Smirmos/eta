import { describe, expect, it, vi } from 'vitest';
import type { AthleteProfileRepository } from '../../../db/repositories/athlete-profile.repository.js';
import type { WorkoutsCompletedRepository } from '../../../db/repositories/workouts-completed.repository.js';
import { StravaBackfillService } from './strava-backfill.service.js';
import type { StravaClientService } from './strava-client.service.js';

const USER_ID = '00000000-0000-0000-0000-000000000001';
const NOW = new Date('2026-06-01T00:00:00Z');

function summary(id: number) {
  return { id };
}

function detailedActivity(id: number, type: string) {
  return {
    id,
    type,
    start_date_local: '2026-05-30T08:00:00Z',
    moving_time: 3600,
    elapsed_time: 3700,
    name: `Activity ${id}`,
  };
}

function makeClient(opts: {
  listPages: unknown[][];
  detailByActivityId: (id: number) => unknown;
}): {
  client: StravaClientService;
  listSpy: ReturnType<typeof vi.fn>;
  getSpy: ReturnType<typeof vi.fn>;
} {
  const listSpy = vi.fn(async (_userId: string, args: { page?: number }) => {
    const idx = (args.page ?? 1) - 1;
    return opts.listPages[idx] ?? [];
  });
  const getSpy = vi.fn(async (_userId: string, id: number) => opts.detailByActivityId(id));
  const client = {
    listAthleteActivities: listSpy,
    getActivity: getSpy,
  } as unknown as StravaClientService;
  return { client, listSpy, getSpy };
}

function makeProfilesRepo(profileNull = true): AthleteProfileRepository {
  return { findByUserId: async () => (profileNull ? null : null) } as unknown as AthleteProfileRepository;
}

function makeWorkoutsRepo(): {
  repo: WorkoutsCompletedRepository;
  upsertSpy: ReturnType<typeof vi.fn>;
} {
  const upsertSpy = vi.fn(async (row: unknown) => row);
  const repo = { upsert: upsertSpy } as unknown as WorkoutsCompletedRepository;
  return { repo, upsertSpy };
}

describe('StravaBackfillService', () => {
  it('lists since now-90d, fetches each detail, normalizes, upserts', async () => {
    const { client, listSpy, getSpy } = makeClient({
      listPages: [[summary(1), summary(2), summary(3)], []],
      detailByActivityId: (id) =>
        id === 2 ? detailedActivity(id, 'WeightTraining') : detailedActivity(id, 'Ride'),
    });
    const profilesRepo = makeProfilesRepo();
    const { repo: workoutsRepo, upsertSpy } = makeWorkoutsRepo();

    const svc = new StravaBackfillService(client, profilesRepo, workoutsRepo);
    const result = await svc.run(USER_ID, NOW);

    expect(result).toEqual({
      userId: USER_ID,
      considered: 3,
      ingested: 2, // activities 1 and 3 (Ride)
      skipped: 1, // activity 2 (WeightTraining)
      failed: 0,
    });

    // Listed once with after=90 days before NOW.
    expect(listSpy).toHaveBeenCalledTimes(1);
    const listArgs = listSpy.mock.calls[0]![1] as { after: number; page: number };
    const expectedAfter = Math.floor((NOW.getTime() - 90 * 86_400_000) / 1000);
    expect(listArgs.after).toBe(expectedAfter);
    expect(listArgs.page).toBe(1);

    expect(getSpy).toHaveBeenCalledTimes(3);
    expect(upsertSpy).toHaveBeenCalledTimes(2);
  });

  it('paginates through results until a short page signals the end', async () => {
    const fullPage = Array.from({ length: 30 }, (_, i) => summary(i + 1));
    const { client, listSpy } = makeClient({
      listPages: [fullPage, [summary(31)]],
      detailByActivityId: (id) => detailedActivity(id, 'Ride'),
    });
    const { repo: workoutsRepo } = makeWorkoutsRepo();
    const svc = new StravaBackfillService(client, makeProfilesRepo(), workoutsRepo);
    const result = await svc.run(USER_ID, NOW);
    expect(result.considered).toBe(31);
    expect(listSpy).toHaveBeenCalledTimes(2);
    const pageNumbers = listSpy.mock.calls.map((c) => (c[1] as { page: number }).page);
    expect(pageNumbers).toEqual([1, 2]);
  });

  it('tracks per-activity failures without aborting the whole run', async () => {
    const { client } = makeClient({
      listPages: [[summary(1), summary(2)], []],
      detailByActivityId: (id) => {
        if (id === 1) throw new Error('boom');
        return detailedActivity(id, 'Ride');
      },
    });
    const { repo: workoutsRepo, upsertSpy } = makeWorkoutsRepo();
    const svc = new StravaBackfillService(client, makeProfilesRepo(), workoutsRepo);
    const result = await svc.run(USER_ID, NOW);
    expect(result).toMatchObject({ considered: 2, ingested: 1, failed: 1 });
    expect(upsertSpy).toHaveBeenCalledTimes(1);
  });

  it('returns zero-counts on an empty Strava account', async () => {
    const { client } = makeClient({ listPages: [[]], detailByActivityId: () => ({}) });
    const { repo: workoutsRepo } = makeWorkoutsRepo();
    const svc = new StravaBackfillService(client, makeProfilesRepo(), workoutsRepo);
    const result = await svc.run(USER_ID, NOW);
    expect(result).toEqual({ userId: USER_ID, considered: 0, ingested: 0, skipped: 0, failed: 0 });
  });

  it('trigger() returns immediately and runs the backfill async', async () => {
    const { client } = makeClient({
      listPages: [[summary(1)], []],
      detailByActivityId: (id) => detailedActivity(id, 'Ride'),
    });
    const { repo: workoutsRepo, upsertSpy } = makeWorkoutsRepo();
    const svc = new StravaBackfillService(client, makeProfilesRepo(), workoutsRepo);
    svc.trigger(USER_ID);
    // setImmediate has scheduled the async work but it hasn't run yet.
    expect(upsertSpy).not.toHaveBeenCalled();
    await new Promise<void>((resolve) => setImmediate(resolve));
    // After the setImmediate tick fires, the async chain runs to completion.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(upsertSpy).toHaveBeenCalledTimes(1);
  });
});
