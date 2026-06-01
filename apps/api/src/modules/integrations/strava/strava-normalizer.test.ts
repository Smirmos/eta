import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AthleteProfile } from '@eta/shared-types';
import { describe, expect, it } from 'vitest';
import { normalizeStravaActivity } from './strava-normalizer.js';
import { stravaActivitySchema } from './strava.types.js';

const HERE = dirname(fileURLToPath(import.meta.url));

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(HERE, 'fixtures', name), 'utf-8'));
}

function profileWithFtp(ftp: number | undefined): AthleteProfile {
  return {
    experienceLevel: 'tri_experienced',
    raceDate: new Date('2027-06-19T00:00:00Z'),
    raceType: 'full_ironman',
    weeksUntilRace: 50,
    recentWeeklyHours: { value: 8, confidence: 'medium', source: 'self_reported' },
    plannedWeeklyHours: 10,
    longestRecentSessions: {
      swimMeters: { value: 2500, confidence: 'medium', source: 'self_reported' },
      bikeMinutes: { value: 200, confidence: 'medium', source: 'self_reported' },
      runMinutes: { value: 100, confidence: 'medium', source: 'self_reported' },
    },
    thresholds: {
      swimTPacePer100m: { value: '1:45', confidence: 'medium', source: 'self_reported' },
      bikeFtpWatts:
        ftp !== undefined
          ? { value: ftp, confidence: 'high', source: 'measured' }
          : null,
      bikeThresholdHr: { value: 165, confidence: 'high', source: 'measured' },
      runThresholdPacePerKm: { value: '4:30', confidence: 'high', source: 'measured' },
      runThresholdHr: { value: 170, confidence: 'high', source: 'measured' },
    },
    disciplineDistribution: { swimPercent: 20, bikePercent: 50, runPercent: 30 },
    fitnessTrend: 'stable',
    trainingDaysPerWeek: 6,
    longSessionDays: ['sat', 'sun'],
    mandatoryRestDays: ['mon'],
    maxWeekdaySessionMinutes: 90,
    currentInjuries: [],
    recentIllnessOrTimeOff: false,
    raceHistory: [],
    source: 'questionnaire',
    overallConfidence: 'medium',
    generatedAt: new Date('2026-05-01T00:00:00Z'),
    warnings: [],
  };
}

describe('normalizeStravaActivity', () => {
  it('bike with weighted_average_watts + FTP → computes TSS, status=computed', () => {
    const activity = stravaActivitySchema.parse(loadFixture('activity-bike-power.json'));
    const row = normalizeStravaActivity({
      userId: '00000000-0000-0000-0000-000000000001',
      activity,
      athleteProfile: profileWithFtp(250),
    });
    expect(row).not.toBeNull();
    expect(row!.discipline).toBe('bike');
    expect(row!.tssStatus).toBe('computed');
    expect(row!.actualTss).toBeDefined();
    // 1h at NP=245W vs FTP=250 → IF ≈ 0.98, TSS ≈ 0.98² × 100 ≈ 96.
    const tssValue = Number(row!.actualTss);
    expect(tssValue).toBeGreaterThan(90);
    expect(tssValue).toBeLessThan(102);
    expect(row!.date).toBe('2026-05-30');
    expect(row!.actualDurationSeconds).toBe(3600);
    expect(row!.notes).toContain('Threshold intervals');
  });

  it('bike without FTP in profile → tssStatus=pending_inference', () => {
    const activity = stravaActivitySchema.parse(loadFixture('activity-bike-power.json'));
    const row = normalizeStravaActivity({
      userId: '00000000-0000-0000-0000-000000000001',
      activity,
      athleteProfile: profileWithFtp(undefined),
    });
    expect(row!.tssStatus).toBe('pending_inference');
    expect(row!.actualTss).toBeNull();
  });

  it('bike with no profile at all → pending_inference', () => {
    const activity = stravaActivitySchema.parse(loadFixture('activity-bike-power.json'));
    const row = normalizeStravaActivity({
      userId: '00000000-0000-0000-0000-000000000001',
      activity,
      athleteProfile: null,
    });
    expect(row!.tssStatus).toBe('pending_inference');
    expect(row!.actualTss).toBeNull();
  });

  it('run without streams → pending_inference (NGP path not implemented in v1)', () => {
    const activity = stravaActivitySchema.parse(loadFixture('activity-run-no-streams.json'));
    const row = normalizeStravaActivity({
      userId: '00000000-0000-0000-0000-000000000001',
      activity,
      athleteProfile: profileWithFtp(250),
    });
    expect(row!.discipline).toBe('run');
    expect(row!.tssStatus).toBe('pending_inference');
    expect(row!.perceivedExertion).toBe(5);
  });

  it('strength activity → returns null (non-tri discipline dropped)', () => {
    const activity = stravaActivitySchema.parse(loadFixture('activity-strength.json'));
    const row = normalizeStravaActivity({
      userId: '00000000-0000-0000-0000-000000000001',
      activity,
      athleteProfile: profileWithFtp(250),
    });
    expect(row).toBeNull();
  });

  it('row carries the full raw payload for re-normalization', () => {
    const activity = stravaActivitySchema.parse(loadFixture('activity-bike-power.json'));
    const row = normalizeStravaActivity({
      userId: '00000000-0000-0000-0000-000000000001',
      activity,
      athleteProfile: profileWithFtp(250),
    });
    expect((row!.raw as { id: number }).id).toBe(1234567890);
  });

  it('workoutCode is null on Strava ingest — plan-match step resolves it', () => {
    const activity = stravaActivitySchema.parse(loadFixture('activity-bike-power.json'));
    const row = normalizeStravaActivity({
      userId: '00000000-0000-0000-0000-000000000001',
      activity,
      athleteProfile: profileWithFtp(250),
    });
    expect(row!.workoutCode).toBeNull();
  });
});
