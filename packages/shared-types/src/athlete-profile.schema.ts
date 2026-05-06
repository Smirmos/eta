import { z } from 'zod';
import type {
  AthleteProfile,
  ConfidenceLevel,
  DayOfWeek,
  Discipline,
  ExperienceLevel,
  FitnessTrend,
  ProfileSource,
  RaceDistance,
  ThresholdSource,
  ThresholdValue,
} from './athlete-profile.js';

const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

// ─── Enum schemas ────────────────────────────────────────────────────────────

export const disciplineSchema = z.enum(['swim', 'bike', 'run']) satisfies z.ZodType<Discipline>;

export const dayOfWeekSchema = z.enum([
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
]) satisfies z.ZodType<DayOfWeek>;

export const confidenceLevelSchema = z.enum([
  'high',
  'medium',
  'low',
]) satisfies z.ZodType<ConfidenceLevel>;

export const profileSourceSchema = z.enum([
  'strava_inferred',
  'questionnaire',
  'mixed',
]) satisfies z.ZodType<ProfileSource>;

export const experienceLevelSchema = z.enum([
  'beginner',
  'single_sport',
  'tri_experienced',
  'im_veteran',
]) satisfies z.ZodType<ExperienceLevel>;

export const thresholdSourceSchema = z.enum([
  'measured',
  'estimated',
  'self_reported',
  'unknown',
]) satisfies z.ZodType<ThresholdSource>;

export const fitnessTrendSchema = z.enum([
  'rising',
  'stable',
  'declining',
  'unknown',
]) satisfies z.ZodType<FitnessTrend>;

export const raceDistanceSchema = z.enum([
  'sprint',
  'olympic',
  'half_ironman',
  'full_ironman',
  'standalone_run',
  'standalone_bike',
]) satisfies z.ZodType<RaceDistance>;

// ─── ThresholdValue<T> generic factory ───────────────────────────────────────

export const thresholdValueSchema = <T extends z.ZodTypeAny>(
  valueSchema: T,
): z.ZodObject<{
  value: T;
  confidence: typeof confidenceLevelSchema;
  source: typeof thresholdSourceSchema;
  measuredAt: z.ZodOptional<z.ZodDate>;
  notes: z.ZodOptional<z.ZodString>;
}> =>
  z.object({
    value: valueSchema,
    confidence: confidenceLevelSchema,
    source: thresholdSourceSchema,
    // z.coerce.date() accepts Date | string | number — needed because JSONB roundtrip
    // converts Date → ISO string. We apply `z.coerce.date()` so input form (live Date)
    // and persisted form (deserialized string) both validate.
    measuredAt: z.coerce.date().optional(),
    notes: z.string().optional(),
  });

// ─── Field-level helpers ─────────────────────────────────────────────────────

const paceMmSsRegex = /^[0-9]{1,2}:[0-9]{2}$/;
const paceMmSsSchema = z.string().regex(paceMmSsRegex, 'Must be mm:ss like "5:10"');

const hrSchema = z.number().int().min(100).max(220);

// ─── AthleteProfile structural schema ────────────────────────────────────────
// "Structural" = no time-relative checks (raceDate-future, weeksUntilRace ±1,
// raceHistory dates in past). Used for persistence reads — a stored profile
// remains structurally valid even after the race has happened. Input validation
// uses athleteProfileInputSchema below, which adds the temporal refinements.

const athleteProfileBase = z.object({
  experienceLevel: experienceLevelSchema,

  raceDate: z.coerce.date(),
  raceType: z.literal('full_ironman'),
  weeksUntilRace: z.number().int(),

  recentWeeklyHours: thresholdValueSchema(z.number().nonnegative()),
  plannedWeeklyHours: z.number().min(1).max(30),

  longestRecentSessions: z.object({
    swimMeters: thresholdValueSchema(z.number().nonnegative()),
    bikeMinutes: thresholdValueSchema(z.number().nonnegative()),
    runMinutes: thresholdValueSchema(z.number().nonnegative()),
  }),

  thresholds: z.object({
    swimTPacePer100m: thresholdValueSchema(paceMmSsSchema).nullable(),
    bikeFtpWatts: thresholdValueSchema(z.number().int().positive()).nullable(),
    bikeThresholdHr: thresholdValueSchema(hrSchema),
    runThresholdPacePerKm: thresholdValueSchema(paceMmSsSchema),
    runThresholdHr: thresholdValueSchema(hrSchema),
  }),

  disciplineDistribution: z.object({
    swimPercent: z.number().min(0).max(100),
    bikePercent: z.number().min(0).max(100),
    runPercent: z.number().min(0).max(100),
  }),

  fitnessTrend: fitnessTrendSchema,

  trainingDaysPerWeek: z.number().int().min(3).max(7),
  longSessionDays: z.array(dayOfWeekSchema),
  mandatoryRestDays: z.array(dayOfWeekSchema),
  maxWeekdaySessionMinutes: z.number().int().min(30).max(240),

  currentInjuries: z.array(z.string()),
  recentIllnessOrTimeOff: z.boolean(),

  raceHistory: z.array(
    z.object({
      date: z.coerce.date(),
      distance: raceDistanceSchema,
      time: z.string().optional(),
      notes: z.string().optional(),
    }),
  ),

  source: profileSourceSchema,
  overallConfidence: confidenceLevelSchema,
  generatedAt: z.coerce.date(),
  warnings: z.array(z.string()),
});

const structuralRefinements = (
  profile: z.infer<typeof athleteProfileBase>,
  ctx: z.RefinementCtx,
): void => {
  // Discipline distribution must sum to 100 ±2 (rounding tolerance)
  const sum =
    profile.disciplineDistribution.swimPercent +
    profile.disciplineDistribution.bikePercent +
    profile.disciplineDistribution.runPercent;
  if (Math.abs(sum - 100) > 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['disciplineDistribution'],
      message: `disciplineDistribution must sum to 100 (±2 tolerance); got ${sum}`,
    });
  }

  // longSessionDays: no duplicates
  if (new Set(profile.longSessionDays).size !== profile.longSessionDays.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['longSessionDays'],
      message: 'longSessionDays must not contain duplicates',
    });
  }

  // mandatoryRestDays: no duplicates
  if (new Set(profile.mandatoryRestDays).size !== profile.mandatoryRestDays.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['mandatoryRestDays'],
      message: 'mandatoryRestDays must not contain duplicates',
    });
  }

  // No overlap between long-session days and mandatory rest days
  const overlap = profile.longSessionDays.filter((d) => profile.mandatoryRestDays.includes(d));
  if (overlap.length > 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['mandatoryRestDays'],
      message: `mandatoryRestDays cannot overlap longSessionDays (overlap: ${overlap.join(', ')})`,
    });
  }
};

const temporalRefinements = (
  profile: z.infer<typeof athleteProfileBase>,
  ctx: z.RefinementCtx,
  now: Date = new Date(),
): void => {
  // raceDate must be in the future
  if (profile.raceDate.getTime() <= now.getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['raceDate'],
      message: 'raceDate must be in the future',
    });
  }

  // weeksUntilRace must equal floor((raceDate - now) / week) ±1 (DST/timezone tolerance)
  const computed = Math.floor((profile.raceDate.getTime() - now.getTime()) / MS_PER_WEEK);
  if (Math.abs(profile.weeksUntilRace - computed) > 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['weeksUntilRace'],
      message: `weeksUntilRace must equal floor((raceDate - now) / 7 days) ±1; expected ~${computed}, got ${profile.weeksUntilRace}`,
    });
  }

  // raceHistory entries must have past dates
  profile.raceHistory.forEach((race, i) => {
    if (race.date.getTime() > now.getTime()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['raceHistory', i, 'date'],
        message: 'raceHistory entries must have a past date',
      });
    }
  });
};

/**
 * Structural schema for AthleteProfile.
 *
 * Validates shape, enums, ranges, distribution-sum, day-overlap.
 * Does NOT validate time-relative invariants (raceDate-future, weeksUntilRace,
 * raceHistory dates in past). Use this for persistence reads and for type inference.
 */
export const athleteProfileSchema = athleteProfileBase.superRefine(structuralRefinements);

/**
 * Input schema for new/updated AthleteProfile values.
 *
 * Adds temporal refinements on top of the structural schema. Use this at input
 * boundaries (forms, API payloads) where time-relative invariants matter.
 */
export const athleteProfileInputSchema = athleteProfileBase.superRefine((profile, ctx) => {
  structuralRefinements(profile, ctx);
  temporalRefinements(profile, ctx);
});

// ─── Compile-time parity check: Zod must match Confluence contract ───────────
// If this fails to compile, the Zod schema and TypeScript interface have drifted.

type AssertEqual<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _athleteProfileTypeCheck: AssertEqual<
  z.infer<typeof athleteProfileSchema>,
  AthleteProfile
> = true;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _thresholdValueTypeCheck: AssertEqual<
  z.infer<ReturnType<typeof thresholdValueSchema<z.ZodNumber>>>,
  ThresholdValue<number>
> = true;
