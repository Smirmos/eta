import { describe, expect, it } from 'vitest';
import type { AthleteProfile, DayOfWeek } from './athlete-profile.js';
import { athleteProfileInputSchema, athleteProfileSchema } from './athlete-profile.schema.js';

const RACE_2YR_FROM_NOW = new Date(Date.now() + 365 * 2 * 24 * 60 * 60 * 1000);
const WEEKS_UNTIL_2YR = Math.floor(
  (RACE_2YR_FROM_NOW.getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000),
);

const validProfile = (overrides: Partial<AthleteProfile> = {}): AthleteProfile => ({
  experienceLevel: 'tri_experienced',
  raceDate: RACE_2YR_FROM_NOW,
  raceType: 'full_ironman',
  weeksUntilRace: WEEKS_UNTIL_2YR,
  recentWeeklyHours: { value: 8, confidence: 'high', source: 'measured' },
  plannedWeeklyHours: 12,
  longestRecentSessions: {
    swimMeters: { value: 2500, confidence: 'high', source: 'measured' },
    bikeMinutes: { value: 180, confidence: 'high', source: 'measured' },
    runMinutes: { value: 90, confidence: 'high', source: 'measured' },
  },
  thresholds: {
    swimTPacePer100m: { value: '1:45', confidence: 'medium', source: 'self_reported' },
    bikeFtpWatts: { value: 240, confidence: 'high', source: 'measured' },
    bikeThresholdHr: { value: 165, confidence: 'high', source: 'measured' },
    runThresholdPacePerKm: { value: '5:10', confidence: 'high', source: 'measured' },
    runThresholdHr: { value: 172, confidence: 'high', source: 'measured' },
  },
  disciplineDistribution: {
    swimPercent: 15,
    bikePercent: 50,
    runPercent: 35,
  },
  fitnessTrend: 'rising',
  trainingDaysPerWeek: 6,
  longSessionDays: ['sat', 'sun'],
  mandatoryRestDays: ['mon'],
  maxWeekdaySessionMinutes: 90,
  currentInjuries: [],
  recentIllnessOrTimeOff: false,
  raceHistory: [
    {
      date: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      distance: 'half_ironman',
      time: '5:30:12',
    },
  ],
  source: 'mixed',
  overallConfidence: 'high',
  generatedAt: new Date(),
  warnings: [],
  ...overrides,
});

describe('athleteProfileSchema (structural)', () => {
  it('parses a valid full profile', () => {
    const result = athleteProfileSchema.safeParse(validProfile());
    expect(result.success).toBe(true);
  });

  it('accepts an empty raceHistory array', () => {
    const result = athleteProfileSchema.safeParse(validProfile({ raceHistory: [] }));
    expect(result.success).toBe(true);
  });

  it('accepts nullable swimTPacePer100m and bikeFtpWatts', () => {
    const result = athleteProfileSchema.safeParse(
      validProfile({
        thresholds: {
          swimTPacePer100m: null,
          bikeFtpWatts: null,
          bikeThresholdHr: { value: 165, confidence: 'high', source: 'measured' },
          runThresholdPacePerKm: { value: '5:10', confidence: 'high', source: 'measured' },
          runThresholdHr: { value: 172, confidence: 'high', source: 'measured' },
        },
      }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects discipline distribution that does not sum to ~100', () => {
    const result = athleteProfileSchema.safeParse(
      validProfile({
        disciplineDistribution: { swimPercent: 10, bikePercent: 40, runPercent: 30 }, // sums to 80
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'disciplineDistribution')).toBe(true);
    }
  });

  it('accepts discipline distribution at the +2 tolerance edge (sum=102)', () => {
    const result = athleteProfileSchema.safeParse(
      validProfile({
        disciplineDistribution: { swimPercent: 15, bikePercent: 51, runPercent: 36 }, // 102
      }),
    );
    expect(result.success).toBe(true);
  });

  it('accepts discipline distribution at the -2 tolerance edge (sum=98)', () => {
    const result = athleteProfileSchema.safeParse(
      validProfile({
        disciplineDistribution: { swimPercent: 14, bikePercent: 49, runPercent: 35 }, // 98
      }),
    );
    expect(result.success).toBe(true);
  });

  it('rejects mandatoryRestDay that overlaps a longSessionDay', () => {
    const result = athleteProfileSchema.safeParse(
      validProfile({
        longSessionDays: ['sat', 'sun'],
        mandatoryRestDays: ['sat'],
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'mandatoryRestDays')).toBe(true);
    }
  });

  it('rejects duplicate days in longSessionDays', () => {
    const result = athleteProfileSchema.safeParse(
      validProfile({ longSessionDays: ['sat', 'sat'] as DayOfWeek[] }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects duplicate days in mandatoryRestDays', () => {
    const result = athleteProfileSchema.safeParse(
      validProfile({ mandatoryRestDays: ['mon', 'mon'] as DayOfWeek[] }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects missing required runThresholdPacePerKm threshold', () => {
    // Construct a profile with runThresholdPacePerKm omitted — type coercion via `as` since
    // the TS type forbids this, but the test demonstrates the runtime guard.
    const profile = validProfile();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (profile.thresholds as any).runThresholdPacePerKm;
    const result = athleteProfileSchema.safeParse(profile);
    expect(result.success).toBe(false);
  });

  it('rejects missing required runThresholdHr threshold', () => {
    const profile = validProfile();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (profile.thresholds as any).runThresholdHr;
    const result = athleteProfileSchema.safeParse(profile);
    expect(result.success).toBe(false);
  });

  it('rejects bike threshold HR outside 100-220', () => {
    const result = athleteProfileSchema.safeParse(
      validProfile({
        thresholds: {
          swimTPacePer100m: null,
          bikeFtpWatts: null,
          bikeThresholdHr: { value: 80, confidence: 'high', source: 'measured' },
          runThresholdPacePerKm: { value: '5:10', confidence: 'high', source: 'measured' },
          runThresholdHr: { value: 172, confidence: 'high', source: 'measured' },
        },
      }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects pace not in mm:ss format', () => {
    const result = athleteProfileSchema.safeParse(
      validProfile({
        thresholds: {
          swimTPacePer100m: null,
          bikeFtpWatts: null,
          bikeThresholdHr: { value: 165, confidence: 'high', source: 'measured' },
          runThresholdPacePerKm: { value: '5.10', confidence: 'high', source: 'measured' },
          runThresholdHr: { value: 172, confidence: 'high', source: 'measured' },
        },
      }),
    );
    expect(result.success).toBe(false);
  });

  it('rejects plannedWeeklyHours below 1', () => {
    expect(athleteProfileSchema.safeParse(validProfile({ plannedWeeklyHours: 0 })).success).toBe(
      false,
    );
  });

  it('rejects plannedWeeklyHours above 30', () => {
    expect(athleteProfileSchema.safeParse(validProfile({ plannedWeeklyHours: 31 })).success).toBe(
      false,
    );
  });

  it('rejects trainingDaysPerWeek below 3', () => {
    expect(athleteProfileSchema.safeParse(validProfile({ trainingDaysPerWeek: 2 })).success).toBe(
      false,
    );
  });

  it('rejects trainingDaysPerWeek above 7', () => {
    expect(athleteProfileSchema.safeParse(validProfile({ trainingDaysPerWeek: 8 })).success).toBe(
      false,
    );
  });

  it('rejects maxWeekdaySessionMinutes outside 30-240', () => {
    expect(
      athleteProfileSchema.safeParse(validProfile({ maxWeekdaySessionMinutes: 20 })).success,
    ).toBe(false);
    expect(
      athleteProfileSchema.safeParse(validProfile({ maxWeekdaySessionMinutes: 300 })).success,
    ).toBe(false);
  });

  it('coerces ISO string Date inputs (JSONB roundtrip)', () => {
    const profile = validProfile();
    const serialized = JSON.parse(JSON.stringify(profile));
    const result = athleteProfileSchema.safeParse(serialized);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.raceDate).toBeInstanceOf(Date);
      expect(result.data.generatedAt).toBeInstanceOf(Date);
    }
  });

  it('rejects an invalid ProfileSource enum', () => {
    expect(
      athleteProfileSchema.safeParse(
        validProfile({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          source: 'random_value' as any,
        }),
      ).success,
    ).toBe(false);
  });

  it('rejects a raceType other than full_ironman', () => {
    expect(
      athleteProfileSchema.safeParse(
        validProfile({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          raceType: 'half_ironman' as any,
        }),
      ).success,
    ).toBe(false);
  });
});

describe('athleteProfileInputSchema (structural + temporal)', () => {
  it('rejects raceDate in the past', () => {
    const result = athleteProfileInputSchema.safeParse(
      validProfile({
        raceDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        weeksUntilRace: -1,
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'raceDate')).toBe(true);
    }
  });

  it('rejects weeksUntilRace that disagrees with raceDate by more than 1 week', () => {
    const result = athleteProfileInputSchema.safeParse(
      validProfile({
        weeksUntilRace: WEEKS_UNTIL_2YR + 5, // 5 weeks off
      }),
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'weeksUntilRace')).toBe(true);
    }
  });

  it('accepts weeksUntilRace within ±1 of computed', () => {
    expect(
      athleteProfileInputSchema.safeParse(validProfile({ weeksUntilRace: WEEKS_UNTIL_2YR - 1 }))
        .success,
    ).toBe(true);
    expect(
      athleteProfileInputSchema.safeParse(validProfile({ weeksUntilRace: WEEKS_UNTIL_2YR + 1 }))
        .success,
    ).toBe(true);
  });

  it('rejects raceHistory entries with future dates', () => {
    const result = athleteProfileInputSchema.safeParse(
      validProfile({
        raceHistory: [
          {
            date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            distance: 'olympic',
          },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it('parses a valid full profile under both schemas', () => {
    expect(athleteProfileSchema.safeParse(validProfile()).success).toBe(true);
    expect(athleteProfileInputSchema.safeParse(validProfile()).success).toBe(true);
  });
});
