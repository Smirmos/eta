import { type AthleteProfile, type MacroPlan, type WeeklyDetail } from '@eta/shared-types';
import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../schema/index.js';
import { AthleteProfileRepository } from './athlete-profile.repository.js';
import { MacroPlansRepository } from './macro-plans.repository.js';
import { WeeklyDetailsRepository } from './weekly-details.repository.js';

type Db = PostgresJsDatabase<typeof schema>;

const USER_ID = '22222222-2222-2222-2222-222222222222';

const detail = (weekNumber: number, hours: number): WeeklyDetail => ({
  weekNumber,
  weekStartDate: '2026-06-15',
  phase: 'base_2',
  workouts: [
    {
      workoutCode: 'B/AE1',          // valid WorkoutCode enum value (bike aerobic 1)
      discipline: 'bike',
      date: '2026-06-20',
      totalDurationSeconds: 7200,
      segments: [
        { label: 'Warmup', durationSeconds: 600, zone: 'z1', description: 'Easy spin' },
        { label: 'Main set', durationSeconds: 6000, zone: 'z2', description: 'Steady Z2' },
        { label: 'Cooldown', durationSeconds: 600, zone: 'z1', description: 'Easy spin' },
      ],
      rationale: 'Anchor aerobic volume.',
      citation: 'knowledge-base/03-workouts.md#bike-z2-long',
    },
  ],
  weeklyTotalHours: hours,
});

const macroPlan = (athleteProfileId: string): MacroPlan => ({
  athleteProfileId,
  raceDate: '2026-09-21',
  generatedAt: '2026-06-17T12:00:00Z',
  totalWeeks: 1,
  weeks: [
    {
      weekNumber: 14,
      weekStartDate: '2026-06-15',
      phase: 'base_2',
      isRecoveryWeek: false,
      weeklyVolumeHours: 9,
      keySessions: [],
    },
  ],
});

const sampleProfile = (): AthleteProfile => ({
  experienceLevel: 'tri_experienced',
  raceDate: new Date('2026-09-21T00:00:00Z'),
  raceType: 'full_ironman',
  weeksUntilRace: 14,
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
  generatedAt: new Date('2026-06-17T00:00:00Z'),
  warnings: [],
});

let container: StartedPostgreSqlContainer;
let client: ReturnType<typeof postgres>;
let db: Db;
let weeklyRepo: WeeklyDetailsRepository;
let macroRepo: MacroPlansRepository;
let profileRepo: AthleteProfileRepository;
let macroPlanId: string;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  client = postgres(container.getConnectionUri(), { max: 5 });
  db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  weeklyRepo = new WeeklyDetailsRepository(db);
  macroRepo = new MacroPlansRepository(db);
  profileRepo = new AthleteProfileRepository(db);
}, 120_000);

afterAll(async () => {
  if (client) await client.end();
  if (container) await container.stop();
}, 30_000);

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE athlete_profiles, macro_plans, weekly_details RESTART IDENTITY CASCADE`);
  const profile = await profileRepo.create({ userId: USER_ID, profile: sampleProfile() });
  const created = await macroRepo.create({ userId: USER_ID, athleteProfileId: profile.id, plan: macroPlan(profile.id) });
  macroPlanId = created.id;
});

describe('WeeklyDetailsRepository', () => {
  it('creates a row and round-trips through findLatestForMacroPlan', async () => {
    const created = await weeklyRepo.create({ macroPlanId, detail: detail(14, 9) });
    expect(created.id).toBeDefined();
    expect(created.macroPlanId).toBe(macroPlanId);
    expect(created.weekNumber).toBe(14);

    const map = await weeklyRepo.findLatestForMacroPlan(macroPlanId);
    expect(map.size).toBe(1);
    const week = map.get(14);
    expect(week).toBeDefined();
    expect(week!.weeklyTotalHours).toBe(9);
  });

  it('findLatestForMacroPlan returns latest version per week (DISTINCT ON)', async () => {
    await weeklyRepo.create({ macroPlanId, detail: detail(14, 9) });
    await new Promise((r) => setTimeout(r, 50));
    await weeklyRepo.create({ macroPlanId, detail: detail(14, 9.5) });
    await weeklyRepo.create({ macroPlanId, detail: detail(13, 8) });

    const map = await weeklyRepo.findLatestForMacroPlan(macroPlanId);
    expect(map.size).toBe(2);
    expect(map.get(14)!.weeklyTotalHours).toBe(9.5);
    expect(map.get(13)!.weeklyTotalHours).toBe(8);
  });

  it('findLatestForMacroPlan returns empty Map when no rows', async () => {
    const map = await weeklyRepo.findLatestForMacroPlan(macroPlanId);
    expect(map.size).toBe(0);
  });

  it('cascades on parent macro plan delete', async () => {
    await weeklyRepo.create({ macroPlanId, detail: detail(14, 9) });
    await db.execute(sql`DELETE FROM macro_plans WHERE id = ${macroPlanId}`);
    const remaining = await db.execute(sql`SELECT COUNT(*)::int AS c FROM weekly_details`);
    expect((remaining as unknown as Array<{ c: number }>)[0]!.c).toBe(0);
  });

  it('rejects insert when macro_plan_id does not exist', async () => {
    const bogus = '99999999-9999-9999-9999-999999999999';
    await expect(weeklyRepo.create({ macroPlanId: bogus, detail: detail(1, 5) })).rejects.toThrow();
  });
});
