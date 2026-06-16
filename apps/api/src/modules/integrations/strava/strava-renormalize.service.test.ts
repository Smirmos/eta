import type { AthleteProfile } from '@eta/shared-types';
import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import * as schema from '../../../db/schema/index.js';
import { AthleteProfileRepository } from '../../../db/repositories/athlete-profile.repository.js';
import { WorkoutsCompletedRepository } from '../../../db/repositories/workouts-completed.repository.js';
import type { WorkoutsCompletedRow } from '../../../db/schema/workouts-completed.js';
import { StravaRenormalizeService } from './strava-renormalize.service.js';

const USER_ID = '00000000-0000-0000-0000-000000000001';

function profileWithFtp(ftpWatts: number): AthleteProfile {
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
      bikeFtpWatts: { value: ftpWatts, confidence: 'high', source: 'measured' },
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
    generatedAt: new Date('2026-06-16T12:00:00Z'),
    warnings: [],
  };
}

function bikeWithPowerRow(externalId: string): WorkoutsCompletedRow {
  return {
    id: `id-${externalId}`,
    userId: USER_ID,
    source: 'strava',
    externalId,
    date: '2026-06-01',
    discipline: 'bike',
    workoutCode: null,
    actualTss: null,
    tssStatus: 'pending_inference',
    plannedTss: null,
    plannedDurationSeconds: null,
    actualDurationSeconds: 3600,
    perceivedExertion: null,
    notes: null,
    raw: {
      id: 1,
      type: 'Ride',
      start_date_local: '2026-06-01T08:00:00Z',
      moving_time: 3600,
      elapsed_time: 3700,
      name: 'Bike with power',
      weighted_average_watts: 200,
      average_watts: 195,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as WorkoutsCompletedRow;
}

function runRow(externalId: string): WorkoutsCompletedRow {
  const row = bikeWithPowerRow(externalId);
  return {
    ...row,
    discipline: 'run',
    raw: {
      id: 1,
      type: 'Run',
      start_date_local: '2026-06-01T08:00:00Z',
      moving_time: 3600,
      elapsed_time: 3700,
      name: 'Easy run',
    },
  } as WorkoutsCompletedRow;
}

function makeProfilesRepo(profile: AthleteProfile | null): AthleteProfileRepository {
  return { findByUserId: vi.fn(async () => profile) } as unknown as AthleteProfileRepository;
}

function makeWorkoutsRepo(rows: WorkoutsCompletedRow[]): {
  repo: WorkoutsCompletedRepository;
  findSpy: ReturnType<typeof vi.fn>;
  upsertSpy: ReturnType<typeof vi.fn>;
} {
  const findSpy = vi.fn(async () => rows);
  const upsertSpy = vi.fn(async (row: unknown) => row);
  const repo = {
    findPendingByUserAndSource: findSpy,
    upsert: upsertSpy,
  } as unknown as WorkoutsCompletedRepository;
  return { repo, findSpy, upsertSpy };
}

describe('StravaRenormalizeService', () => {
  it('flips a bike-with-power pending row to computed', async () => {
    const profile = profileWithFtp(200);
    const { repo: workoutsRepo, upsertSpy } = makeWorkoutsRepo([bikeWithPowerRow('1')]);
    const svc = new StravaRenormalizeService(workoutsRepo, makeProfilesRepo(profile));

    const result = await svc.run(USER_ID);

    expect(result).toEqual({
      userId: USER_ID,
      considered: 1,
      recomputed: 1,
      stillPending: 0,
      failed: 0,
    });
    expect(upsertSpy).toHaveBeenCalledTimes(1);
    const upserted = upsertSpy.mock.calls[0]![0] as { tssStatus: string; actualTss: string };
    expect(upserted.tssStatus).toBe('computed');
    expect(Number(upserted.actualTss)).toBeGreaterThan(0);
  });

  it('keeps run rows pending (run TSS path deferred)', async () => {
    const profile = profileWithFtp(200);
    const { repo: workoutsRepo, upsertSpy } = makeWorkoutsRepo([runRow('2')]);
    const svc = new StravaRenormalizeService(workoutsRepo, makeProfilesRepo(profile));

    const result = await svc.run(USER_ID);

    expect(result.stillPending).toBe(1);
    expect(result.recomputed).toBe(0);
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('returns zeros and does not throw when no profile exists', async () => {
    const { repo: workoutsRepo, findSpy, upsertSpy } = makeWorkoutsRepo([bikeWithPowerRow('3')]);
    const svc = new StravaRenormalizeService(workoutsRepo, makeProfilesRepo(null));

    const result = await svc.run(USER_ID);

    expect(result).toEqual({
      userId: USER_ID,
      considered: 0,
      recomputed: 0,
      stillPending: 0,
      failed: 0,
    });
    expect(findSpy).not.toHaveBeenCalled();
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('isolates per-row failures', async () => {
    const profile = profileWithFtp(200);
    const bad = bikeWithPowerRow('bad');
    (bad as { raw: unknown }).raw = { not: 'an activity' };
    const good = bikeWithPowerRow('good');
    const { repo: workoutsRepo, upsertSpy } = makeWorkoutsRepo([bad, good]);
    const svc = new StravaRenormalizeService(workoutsRepo, makeProfilesRepo(profile));

    const result = await svc.run(USER_ID);

    expect(result.considered).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.recomputed).toBe(1);
    expect(upsertSpy).toHaveBeenCalledTimes(1);
  });
});

describe('StravaRenormalizeService (real Postgres)', () => {
  let container: StartedPostgreSqlContainer;
  let client: ReturnType<typeof postgres>;
  let db: PostgresJsDatabase<typeof schema>;
  let svc: StravaRenormalizeService;
  let workoutsRepo: WorkoutsCompletedRepository;
  let profilesRepo: AthleteProfileRepository;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    client = postgres(container.getConnectionUri(), { max: 5 });
    db = drizzle(client, { schema });
    await migrate(db, { migrationsFolder: './drizzle' });
    workoutsRepo = new WorkoutsCompletedRepository(db);
    profilesRepo = new AthleteProfileRepository(db);
    svc = new StravaRenormalizeService(workoutsRepo, profilesRepo);
  }, 120_000);

  afterAll(async () => {
    if (client) await client.end();
    if (container) await container.stop();
  }, 30_000);

  beforeEach(async () => {
    await db.execute(sql`TRUNCATE TABLE athlete_profiles, workouts_completed RESTART IDENTITY CASCADE`);
  });

  it('flips only the bike-with-power row and leaves others pending', async () => {
    const userId = '22222222-2222-2222-2222-222222222222';
    await profilesRepo.create({ userId, profile: profileWithFtp(200) });

    // Seed three rows directly via upsert — strip the WorkoutsCompletedRow-only
    // fields (id, createdAt, updatedAt) so we're passing a NewWorkoutsCompletedRow shape.
    const bikeWithPower = bikeWithPowerRow('100');
    await workoutsRepo.upsert({
      userId,
      source: bikeWithPower.source,
      externalId: bikeWithPower.externalId,
      date: bikeWithPower.date,
      discipline: bikeWithPower.discipline,
      workoutCode: bikeWithPower.workoutCode,
      actualTss: bikeWithPower.actualTss,
      tssStatus: bikeWithPower.tssStatus,
      plannedTss: bikeWithPower.plannedTss,
      plannedDurationSeconds: bikeWithPower.plannedDurationSeconds,
      actualDurationSeconds: bikeWithPower.actualDurationSeconds,
      perceivedExertion: bikeWithPower.perceivedExertion,
      notes: bikeWithPower.notes,
      raw: {
        id: 100,
        type: 'Ride',
        start_date_local: '2026-06-01T08:00:00Z',
        moving_time: 3600,
        elapsed_time: 3700,
        name: 'Bike with power',
        weighted_average_watts: 200,
        average_watts: 195,
      },
    });

    const bikeNoPower = bikeWithPowerRow('101');
    await workoutsRepo.upsert({
      userId,
      source: bikeNoPower.source,
      externalId: bikeNoPower.externalId,
      date: bikeNoPower.date,
      discipline: bikeNoPower.discipline,
      workoutCode: bikeNoPower.workoutCode,
      actualTss: bikeNoPower.actualTss,
      tssStatus: bikeNoPower.tssStatus,
      plannedTss: bikeNoPower.plannedTss,
      plannedDurationSeconds: bikeNoPower.plannedDurationSeconds,
      actualDurationSeconds: bikeNoPower.actualDurationSeconds,
      perceivedExertion: bikeNoPower.perceivedExertion,
      notes: bikeNoPower.notes,
      raw: {
        id: 101,
        type: 'Ride',
        start_date_local: '2026-06-01T08:00:00Z',
        moving_time: 3600,
        elapsed_time: 3700,
        name: 'Bike no power',
      },
    });

    const run = runRow('102');
    await workoutsRepo.upsert({
      userId,
      source: run.source,
      externalId: run.externalId,
      date: run.date,
      discipline: run.discipline,
      workoutCode: run.workoutCode,
      actualTss: run.actualTss,
      tssStatus: run.tssStatus,
      plannedTss: run.plannedTss,
      plannedDurationSeconds: run.plannedDurationSeconds,
      actualDurationSeconds: run.actualDurationSeconds,
      perceivedExertion: run.perceivedExertion,
      notes: run.notes,
      raw: {
        id: 102,
        type: 'Run',
        start_date_local: '2026-06-01T08:00:00Z',
        moving_time: 3600,
        elapsed_time: 3700,
        name: 'Easy run',
      },
    });

    const result = await svc.run(userId);

    expect(result.considered).toBe(3);
    expect(result.recomputed).toBe(1);
    expect(result.stillPending).toBe(2);
    expect(result.failed).toBe(0);

    const bikeRow = await workoutsRepo.findBySourceAndExternalId('strava', '100');
    expect(bikeRow?.tssStatus).toBe('computed');
    expect(bikeRow?.actualTss).not.toBeNull();

    const noPower = await workoutsRepo.findBySourceAndExternalId('strava', '101');
    expect(noPower?.tssStatus).toBe('pending_inference');

    const runResult = await workoutsRepo.findBySourceAndExternalId('strava', '102');
    expect(runResult?.tssStatus).toBe('pending_inference');
  });
});
