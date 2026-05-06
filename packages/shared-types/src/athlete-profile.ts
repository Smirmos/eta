// AthleteProfile contract — verbatim from Confluence (ETA → Architecture → AthleteProfile Schema).
// The Zod schemas in athlete-profile.schema.ts are validated at compile time to match these types
// (see the AssertEqual helper at the bottom of that file). If you edit one, edit both.

export type Discipline = 'swim' | 'bike' | 'run';
export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type ConfidenceLevel = 'high' | 'medium' | 'low';
export type ProfileSource = 'strava_inferred' | 'questionnaire' | 'mixed';

export type ExperienceLevel = 'beginner' | 'single_sport' | 'tri_experienced' | 'im_veteran';

export type ThresholdSource = 'measured' | 'estimated' | 'self_reported' | 'unknown';

export type FitnessTrend = 'rising' | 'stable' | 'declining' | 'unknown';

export type RaceDistance =
  | 'sprint'
  | 'olympic'
  | 'half_ironman'
  | 'full_ironman'
  | 'standalone_run'
  | 'standalone_bike';

export interface ThresholdValue<T> {
  value: T;
  confidence: ConfidenceLevel;
  source: ThresholdSource;
  measuredAt?: Date;
  notes?: string;
}

export interface AthleteProfile {
  // Identity
  experienceLevel: ExperienceLevel;

  // Goal
  raceDate: Date;
  raceType: 'full_ironman'; // v1 scope
  weeksUntilRace: number; // computed

  // Volume capacity
  recentWeeklyHours: ThresholdValue<number>;
  plannedWeeklyHours: number; // user commitment, no confidence

  longestRecentSessions: {
    swimMeters: ThresholdValue<number>;
    bikeMinutes: ThresholdValue<number>;
    runMinutes: ThresholdValue<number>;
  };

  // Threshold values (zones derive from these)
  thresholds: {
    swimTPacePer100m: ThresholdValue<string> | null; // "1:45"
    bikeFtpWatts: ThresholdValue<number> | null;
    bikeThresholdHr: ThresholdValue<number>;
    runThresholdPacePerKm: ThresholdValue<string>; // "5:10"
    runThresholdHr: ThresholdValue<number>;
  };

  // Discipline balance (derived from Strava or questionnaire)
  disciplineDistribution: {
    swimPercent: number;
    bikePercent: number;
    runPercent: number;
  };

  // Trajectory
  fitnessTrend: FitnessTrend;

  // Constraints
  trainingDaysPerWeek: number;
  longSessionDays: DayOfWeek[];
  mandatoryRestDays: DayOfWeek[];
  maxWeekdaySessionMinutes: number;

  // Health
  currentInjuries: string[];
  recentIllnessOrTimeOff: boolean;

  // Race history
  raceHistory: Array<{
    date: Date;
    distance: RaceDistance;
    time?: string;
    notes?: string;
  }>;

  // Meta
  source: ProfileSource;
  overallConfidence: ConfidenceLevel;
  generatedAt: Date;
  warnings: string[];
}
