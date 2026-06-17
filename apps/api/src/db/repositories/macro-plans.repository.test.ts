import { type AthleteProfile, type MacroPlan } from '@eta/shared-types';
import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../schema/index.js';
import { AthleteProfileRepository } from './athlete-profile.repository.js';
import { MacroPlansRepository } from './macro-plans.repository.js';

type Db = PostgresJsDatabase<typeof schema>;

const USER_ID = '11111111-1111-1111-1111-111111111111';

const sampleMacroPlan = (athleteProfileId: string): MacroPlan => ({
  athleteProfileId,
  raceDate: '2026-09-21',
  generatedAt: '2026-06-17T12:00:00Z',
  totalWeeks: 2,
  weeks: [
    {
      weekNumber: 14,
      weekStartDate: '2026-06-15',
      phase: 'base_2',
      isRecoveryWeek: false,
      weeklyVolumeHours: 9,
      keySessions: [
        {
          workoutCode: 'B/AE1',
          discipline: 'bike',
          dayOfWeek: 'sat',
          rationale: 'Anchor aerobic volume.',
          citation: 'knowledge-base/02-atp-structure.md#base-2',
        },
      ],
    },
    {
      weekNumber: 13,
      weekStartDate: '2026-06-22',
      phase: 'base_2',
      isRecoveryWeek: false,
      weeklyVolumeHours: 9.5,
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
let macroRepo: MacroPlansRepository;
let profileRepo: AthleteProfileRepository;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  client = postgres(container.getConnectionUri(), { max: 5 });
  db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  macroRepo = new MacroPlansRepository(db);
  profileRepo = new AthleteProfileRepository(db);
}, 120_000);

afterAll(async () => {
  if (client) await client.end();
  if (container) await container.stop();
}, 30_000);

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE athlete_profiles, macro_plans RESTART IDENTITY CASCADE`);
});

describe('MacroPlansRepository', () => {
  it('creates a row and round-trips through findById', async () => {
    const profile = await profileRepo.create({ userId: USER_ID, profile: sampleProfile() });
    const plan = sampleMacroPlan(profile.id);
    const created = await macroRepo.create({ userId: USER_ID, athleteProfileId: profile.id, plan });

    expect(created.id).toBeDefined();
    expect(created.userId).toBe(USER_ID);
    expect(created.athleteProfileId).toBe(profile.id);
    expect(created.plan.raceDate).toBe('2026-09-21');
    expect(created.plan.weeks).toHaveLength(2);

    const found = await macroRepo.findById(created.id);
    expect(found).not.toBeNull();
    expect(found!.plan.weeks[0]!.weekNumber).toBe(14);
  });

  it('findLatestForUser returns the most-recent row', async () => {
    const profile = await profileRepo.create({ userId: USER_ID, profile: sampleProfile() });
    const first = await macroRepo.create({ userId: USER_ID, athleteProfileId: profile.id, plan: sampleMacroPlan(profile.id) });
    await new Promise((r) => setTimeout(r, 50));
    const second = await macroRepo.create({ userId: USER_ID, athleteProfileId: profile.id, plan: sampleMacroPlan(profile.id) });

    const latest = await macroRepo.findLatestForUser(USER_ID);
    expect(latest).not.toBeNull();
    expect(latest!.id).toBe(second.id);
    expect(latest!.id).not.toBe(first.id);
  });

  it('findLatestForUser returns null when no rows exist', async () => {
    const result = await macroRepo.findLatestForUser(USER_ID);
    expect(result).toBeNull();
  });
});
