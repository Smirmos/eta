import { type AthleteProfile } from '@eta/shared-types';
import { sql } from 'drizzle-orm';
import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import * as schema from '../schema/athlete-profile.js';
import { AthleteProfileRepository } from './athlete-profile.repository.js';

type Db = PostgresJsDatabase<typeof schema>;

let container: StartedPostgreSqlContainer;
let client: ReturnType<typeof postgres>;
let db: Db;
let repo: AthleteProfileRepository;

const sampleProfile = (): AthleteProfile => ({
  experienceLevel: 'tri_experienced',
  raceDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year out
  raceType: 'full_ironman',
  weeksUntilRace: 52,
  recentWeeklyHours: {
    value: 8.5,
    confidence: 'high',
    source: 'measured',
    measuredAt: new Date('2026-04-01T12:00:00Z'),
  },
  plannedWeeklyHours: 12,
  longestRecentSessions: {
    swimMeters: { value: 2500, confidence: 'high', source: 'measured' },
    bikeMinutes: { value: 180, confidence: 'high', source: 'measured' },
    runMinutes: { value: 90, confidence: 'high', source: 'measured', notes: 'easy long run' },
  },
  thresholds: {
    swimTPacePer100m: { value: '1:45', confidence: 'medium', source: 'self_reported' },
    bikeFtpWatts: { value: 240, confidence: 'high', source: 'measured' },
    bikeThresholdHr: { value: 165, confidence: 'high', source: 'measured' },
    runThresholdPacePerKm: { value: '5:10', confidence: 'high', source: 'measured' },
    runThresholdHr: { value: 172, confidence: 'high', source: 'measured' },
  },
  disciplineDistribution: { swimPercent: 15, bikePercent: 50, runPercent: 35 },
  fitnessTrend: 'rising',
  trainingDaysPerWeek: 6,
  longSessionDays: ['sat', 'sun'],
  mandatoryRestDays: ['mon'],
  maxWeekdaySessionMinutes: 90,
  currentInjuries: [],
  recentIllnessOrTimeOff: false,
  raceHistory: [
    {
      date: new Date('2025-08-15T00:00:00Z'),
      distance: 'half_ironman',
      time: '5:30:12',
      notes: 'Personal best',
    },
  ],
  source: 'mixed',
  overallConfidence: 'high',
  generatedAt: new Date('2026-04-30T12:00:00Z'),
  warnings: ['low swim sample size'],
});

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  client = postgres(container.getConnectionUri(), { max: 5 });
  db = drizzle(client, { schema });

  // Run the committed Drizzle migrations against the fresh container.
  await migrate(db, { migrationsFolder: './drizzle' });

  repo = new AthleteProfileRepository(db);
}, 120_000);

afterAll(async () => {
  if (client) await client.end();
  if (container) await container.stop();
}, 30_000);

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE athlete_profiles RESTART IDENTITY CASCADE`);
});

describe('AthleteProfileRepository', () => {
  it('creates a row and round-trips it through findById with all nested data preserved', async () => {
    const userId = '11111111-1111-1111-1111-111111111111';
    const profile = sampleProfile();

    const created = await repo.create({ userId, profile });

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.userId).toBe(userId);
    expect(created.source).toBe('mixed');
    expect(created.overallConfidence).toBe('high');
    expect(created.generatedAt).toBeInstanceOf(Date);
    expect(created.updatedAt).toBeInstanceOf(Date);

    const fetched = await repo.findById(created.id);
    expect(fetched).not.toBeNull();
    if (!fetched) return;

    // Top-level scalars
    expect(fetched.experienceLevel).toBe('tri_experienced');
    expect(fetched.raceType).toBe('full_ironman');
    expect(fetched.plannedWeeklyHours).toBe(12);
    expect(fetched.fitnessTrend).toBe('rising');
    expect(fetched.recentIllnessOrTimeOff).toBe(false);

    // Date instances after JSONB roundtrip
    expect(fetched.raceDate).toBeInstanceOf(Date);
    expect(fetched.generatedAt).toBeInstanceOf(Date);
    expect(fetched.recentWeeklyHours.measuredAt).toBeInstanceOf(Date);
    expect(fetched.raceHistory[0]?.date).toBeInstanceOf(Date);

    // Nested objects preserved
    expect(fetched.longestRecentSessions.swimMeters.value).toBe(2500);
    expect(fetched.longestRecentSessions.runMinutes.notes).toBe('easy long run');
    expect(fetched.thresholds.bikeFtpWatts).toEqual({
      value: 240,
      confidence: 'high',
      source: 'measured',
    });
    expect(fetched.thresholds.runThresholdPacePerKm.value).toBe('5:10');

    // Arrays preserved
    expect(fetched.longSessionDays).toEqual(['sat', 'sun']);
    expect(fetched.mandatoryRestDays).toEqual(['mon']);
    expect(fetched.warnings).toEqual(['low swim sample size']);
    expect(fetched.raceHistory).toHaveLength(1);
    expect(fetched.raceHistory[0]?.distance).toBe('half_ironman');
  });

  it('returns null from findById when row does not exist', async () => {
    const result = await repo.findById('00000000-0000-0000-0000-000000000000');
    expect(result).toBeNull();
  });

  it('findByUserId returns the most recent profile when multiple exist', async () => {
    const userId = '22222222-2222-2222-2222-222222222222';

    const older = sampleProfile();
    older.generatedAt = new Date('2026-01-01T00:00:00Z');
    older.warnings = ['older'];
    await repo.create({ userId, profile: older });

    // Force a small delay so updated_at differs (the row's generated_at uses
    // the DB clock; here we set the JSONB-internal generatedAt)
    const newer = sampleProfile();
    newer.generatedAt = new Date('2026-04-30T12:00:00Z');
    newer.warnings = ['newer'];
    await repo.create({ userId, profile: newer });

    const result = await repo.findByUserId(userId);
    expect(result).not.toBeNull();
    expect(result?.warnings).toEqual(['newer']);
  });

  it('findByUserId returns null when the user has no profile', async () => {
    const result = await repo.findByUserId('33333333-3333-3333-3333-333333333333');
    expect(result).toBeNull();
  });

  it('throws a descriptive error when the persisted JSONB does not match the schema', async () => {
    // Insert a row with malformed JSONB by going around the type-checked builder.
    // The DB cares about JSONB validity (any JSON), not AthleteProfile shape — that's
    // exactly the contract we want to verify the repo enforces on read.
    await db.execute(sql`
      INSERT INTO athlete_profiles (id, user_id, data, source, overall_confidence)
      VALUES (
        '44444444-4444-4444-4444-444444444444',
        '55555555-5555-5555-5555-555555555555',
        '{"foo": "bar"}'::jsonb,
        'mixed',
        'high'
      )
    `);

    await expect(repo.findById('44444444-4444-4444-4444-444444444444')).rejects.toThrow(
      /Failed to parse AthleteProfile from JSONB.*44444444/,
    );
  });
});
