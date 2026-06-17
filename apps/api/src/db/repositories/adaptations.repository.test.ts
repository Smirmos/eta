import { type AdaptationSuggestion, type AthleteProfile, type MacroPlan } from '@eta/shared-types';
import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../schema/index.js';
import { AdaptationsRepository } from './adaptations.repository.js';
import { AthleteProfileRepository } from './athlete-profile.repository.js';
import { MacroPlansRepository } from './macro-plans.repository.js';

type Db = PostgresJsDatabase<typeof schema>;

const USER_ID = '44444444-4444-4444-4444-444444444444';

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

const sampleMacroPlan = (athleteProfileId: string): MacroPlan => ({
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

const sampleSuggestion = (note: string): AdaptationSuggestion => ({
  forWeekStart: '2026-06-15',
  generatedAt: '2026-06-17T12:00:00Z',
  inputs: {
    lastWeekTss: 450,
    currentCtl: 60,
    currentAtl: 55,
    currentTsb: 5,
    avgReadinessLast7d: 75,
  },
  adjustments: [
    {
      originalDate: '2026-06-20',
      originalWorkoutCode: 'B/AE1',
      action: 'keep',
      reasoning: note,
      citation: 'knowledge-base/05-recovery.md',
    },
  ],
});

let container: StartedPostgreSqlContainer;
let client: ReturnType<typeof postgres>;
let db: Db;
let repo: AdaptationsRepository;
let macroRepo: MacroPlansRepository;
let profileRepo: AthleteProfileRepository;
let macroPlanId: string;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  client = postgres(container.getConnectionUri(), { max: 5 });
  db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: './drizzle' });
  repo = new AdaptationsRepository(db);
  macroRepo = new MacroPlansRepository(db);
  profileRepo = new AthleteProfileRepository(db);
}, 120_000);

afterAll(async () => {
  if (client) await client.end();
  if (container) await container.stop();
}, 30_000);

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE athlete_profiles, macro_plans, weekly_details, adaptation_suggestions RESTART IDENTITY CASCADE`);
  const profile = await profileRepo.create({ userId: USER_ID, profile: sampleProfile() });
  const macro = await macroRepo.create({ userId: USER_ID, athleteProfileId: profile.id, plan: sampleMacroPlan(profile.id) });
  macroPlanId = macro.id;
});

describe('AdaptationsRepository', () => {
  it('create round-trips through findLatestForWeek', async () => {
    const created = await repo.create({
      macroPlanId,
      forWeekStart: '2026-06-15',
      suggestion: sampleSuggestion('first'),
    });
    expect(created.id).toBeDefined();
    expect(created.macroPlanId).toBe(macroPlanId);
    expect(created.forWeekStart).toBe('2026-06-15');

    const found = await repo.findLatestForWeek(macroPlanId, '2026-06-15');
    expect(found).not.toBeNull();
    expect(found!.suggestion.adjustments[0]!.reasoning).toBe('first');
  });

  it('findLatestForWeek returns the most recent version', async () => {
    await repo.create({ macroPlanId, forWeekStart: '2026-06-15', suggestion: sampleSuggestion('older') });
    await new Promise((r) => setTimeout(r, 50));
    await repo.create({ macroPlanId, forWeekStart: '2026-06-15', suggestion: sampleSuggestion('newer') });

    const latest = await repo.findLatestForWeek(macroPlanId, '2026-06-15');
    expect(latest!.suggestion.adjustments[0]!.reasoning).toBe('newer');
  });

  it('findLatestForWeek returns null when no row matches', async () => {
    const result = await repo.findLatestForWeek(macroPlanId, '2099-01-01');
    expect(result).toBeNull();
  });

  it('cascades on parent macro plan delete', async () => {
    await repo.create({ macroPlanId, forWeekStart: '2026-06-15', suggestion: sampleSuggestion('x') });
    await db.execute(sql`DELETE FROM macro_plans WHERE id = ${macroPlanId}`);
    const count = await db.execute(sql`SELECT COUNT(*)::int AS c FROM adaptation_suggestions`);
    expect((count as unknown as Array<{ c: number }>)[0]!.c).toBe(0);
  });

  it('rejects insert when macro_plan_id does not exist', async () => {
    const bogus = '99999999-9999-9999-9999-999999999999';
    await expect(
      repo.create({ macroPlanId: bogus, forWeekStart: '2026-06-15', suggestion: sampleSuggestion('x') }),
    ).rejects.toThrow();
  });
});
