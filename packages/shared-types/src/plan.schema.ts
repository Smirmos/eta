import { z } from 'zod';
import { disciplineSchema } from './athlete-profile.schema.js';
import type {
  AdaptationAction,
  AdaptationSuggestion,
  IntensityZone,
  KeySession,
  MacroPlan,
  MacroPlanWeek,
  Phase,
  PlannedWorkout,
  WeeklyDetail,
  WorkoutAdjustment,
  WorkoutSegment,
} from './plan.js';
import { WORKOUT_CODES, type WorkoutCode } from './workout-codes.js';

const MS_PER_DAY = 86_400_000;
const WEEK_TOLERANCE_MS = 12 * 60 * 60 * 1000; // ±12h slop for DST/timezone

// ─── Atom helpers ────────────────────────────────────────────────────────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_OR_DATETIME_RE =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

const isoDateSchema = z.string().regex(ISO_DATE_RE, 'Must be ISO date "YYYY-MM-DD"');

const isoDateOrDateTimeSchema = z
  .string()
  .regex(ISO_DATE_OR_DATETIME_RE, 'Must be an ISO date or datetime');

/**
 * Citations must be non-empty and reference the knowledge-base/ corpus.
 * Anything else is a hallucinated source — reject at the boundary.
 */
const citationSchema = z
  .string()
  .min(1, 'citation must not be empty')
  .refine((s) => s.startsWith('knowledge-base/'), {
    message: 'citation must reference knowledge-base/ (got something else)',
  });

const workoutCodeSchema = z.enum(WORKOUT_CODES) satisfies z.ZodType<WorkoutCode>;

const phaseSchema = z.enum([
  'prep',
  'base_1',
  'base_2',
  'base_3',
  'build_1',
  'build_2',
  'peak',
  'race_week',
  'transition',
]) satisfies z.ZodType<Phase>;

const intensityZoneSchema = z.enum([
  'z1',
  'z2',
  'z3',
  'z4',
  'z5a',
  'z5b',
  'z5c',
]) satisfies z.ZodType<IntensityZone>;

const segmentZoneSchema = z.union([intensityZoneSchema, z.literal('mixed'), z.literal('easy')]);
const adjustmentZoneSchema = z.union([intensityZoneSchema, z.literal('mixed')]);

const adaptationActionSchema = z.enum([
  'keep',
  'modify',
  'replace',
]) satisfies z.ZodType<AdaptationAction>;

// ─── Phase ordering ──────────────────────────────────────────────────────────

const PHASE_ORDINAL: Record<Phase, number> = {
  prep: 0,
  base_1: 1,
  base_2: 2,
  base_3: 3,
  build_1: 4,
  build_2: 5,
  peak: 6,
  race_week: 7,
  transition: 8,
};

// ─── KeySession & MacroPlanWeek ──────────────────────────────────────────────

const keySessionSchema = z.object({
  workoutCode: workoutCodeSchema,
  discipline: disciplineSchema,
  rationale: z.string().min(1),
  citation: citationSchema,
}) satisfies z.ZodType<KeySession>;

const macroPlanWeekSchema = z.object({
  weekNumber: z.number().int(),
  weekStartDate: isoDateSchema,
  phase: phaseSchema,
  isRecoveryWeek: z.boolean(),
  weeklyVolumeHours: z.number().min(0).max(35),
  keySessions: z.array(keySessionSchema),
  notes: z.string().optional(),
  deviations: z.array(z.string()).optional(),
}) satisfies z.ZodType<MacroPlanWeek>;

// ─── MacroPlan ───────────────────────────────────────────────────────────────

export const macroPlanSchema = z
  .object({
    athleteProfileId: z.string().min(1),
    raceDate: isoDateSchema,
    generatedAt: isoDateOrDateTimeSchema,
    totalWeeks: z.number().int().nonnegative(),
    weeks: z.array(macroPlanWeekSchema),
    globalNotes: z.string().optional(),
  })
  .superRefine((plan, ctx) => {
    if (plan.weeks.length !== plan.totalWeeks) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['totalWeeks'],
        message: `totalWeeks (${plan.totalWeeks}) must equal weeks.length (${plan.weeks.length})`,
      });
    }

    // Week contiguity: each weekStartDate must be exactly 7 days after the previous.
    for (let i = 1; i < plan.weeks.length; i++) {
      const prev = plan.weeks[i - 1] as MacroPlanWeek;
      const curr = plan.weeks[i] as MacroPlanWeek;
      const prevTime = new Date(`${prev.weekStartDate}T00:00:00Z`).getTime();
      const currTime = new Date(`${curr.weekStartDate}T00:00:00Z`).getTime();
      if (Number.isNaN(prevTime) || Number.isNaN(currTime)) {
        // Already caught by isoDateSchema parse — skip here.
        continue;
      }
      const delta = currTime - prevTime;
      if (Math.abs(delta - 7 * MS_PER_DAY) > WEEK_TOLERANCE_MS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['weeks', i, 'weekStartDate'],
          message: `weeks must be contiguous 7-day intervals; week ${i} starts ${(delta / MS_PER_DAY).toFixed(1)} days after week ${i - 1}`,
        });
      }
    }

    // Phase ordering: ordinal must be non-decreasing across consecutive weeks.
    for (let i = 1; i < plan.weeks.length; i++) {
      const prev = plan.weeks[i - 1] as MacroPlanWeek;
      const curr = plan.weeks[i] as MacroPlanWeek;
      if (PHASE_ORDINAL[curr.phase] < PHASE_ORDINAL[prev.phase]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['weeks', i, 'phase'],
          message: `phase regressed: week ${i} is "${curr.phase}" after week ${i - 1} was "${prev.phase}"`,
        });
      }
    }
  });

// ─── WorkoutSegment & PlannedWorkout ─────────────────────────────────────────

const workoutSegmentSchema = z.object({
  label: z.string().min(1),
  durationSeconds: z.number().int().positive(),
  zone: segmentZoneSchema,
  description: z.string(),
}) satisfies z.ZodType<WorkoutSegment>;

const plannedWorkoutSchema = z
  .object({
    workoutCode: workoutCodeSchema,
    discipline: disciplineSchema,
    date: isoDateSchema,
    totalDurationSeconds: z.number().int().positive(),
    segments: z.array(workoutSegmentSchema).min(1),
    rationale: z.string().min(1),
    citation: citationSchema,
    expectedTss: z.number().nonnegative().optional(),
  })
  .superRefine((wo, ctx) => {
    const segmentSum = wo.segments.reduce((acc, s) => acc + s.durationSeconds, 0);
    if (Math.abs(segmentSum - wo.totalDurationSeconds) > 60) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['totalDurationSeconds'],
        message: `segment durations sum to ${segmentSum}s but totalDurationSeconds is ${wo.totalDurationSeconds}s (>60s difference)`,
      });
    }
  }) satisfies z.ZodType<PlannedWorkout>;

// ─── WeeklyDetail ────────────────────────────────────────────────────────────

export const weeklyDetailSchema = z
  .object({
    weekNumber: z.number().int(),
    weekStartDate: isoDateSchema,
    phase: phaseSchema,
    workouts: z.array(plannedWorkoutSchema),
    weeklyTotalTss: z.number().nonnegative().optional(),
    weeklyTotalHours: z.number().nonnegative().optional(),
    globalNotes: z.string().optional(),
  })
  .superRefine((week, ctx) => {
    const startMs = new Date(`${week.weekStartDate}T00:00:00Z`).getTime();
    if (Number.isNaN(startMs)) return;
    const endMs = startMs + 7 * MS_PER_DAY;
    week.workouts.forEach((wo, i) => {
      const woMs = new Date(`${wo.date}T00:00:00Z`).getTime();
      if (Number.isNaN(woMs)) return;
      if (woMs < startMs || woMs >= endMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['workouts', i, 'date'],
          message: `workout date ${wo.date} is outside the 7-day window starting ${week.weekStartDate}`,
        });
      }
    });
  }) satisfies z.ZodType<WeeklyDetail>;

// ─── AdaptationSuggestion ────────────────────────────────────────────────────

const workoutAdjustmentSchema = z
  .object({
    originalDate: isoDateSchema,
    originalWorkoutCode: workoutCodeSchema,
    action: adaptationActionSchema,
    newWorkoutCode: workoutCodeSchema.optional(),
    newDurationSeconds: z.number().int().positive().optional(),
    newZone: adjustmentZoneSchema.optional(),
    newDate: isoDateSchema.optional(),
    reasoning: z.string().min(1),
    citation: citationSchema,
  })
  .superRefine((adj, ctx) => {
    if (adj.action === 'keep') {
      const offenders = (
        ['newWorkoutCode', 'newDurationSeconds', 'newZone', 'newDate'] as const
      ).filter((k) => adj[k] !== undefined);
      if (offenders.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [offenders[0] as string],
          message: `action='keep' but ${offenders.join(', ')} provided — keep allows no new* fields`,
        });
      }
    }
    if (adj.action === 'replace' && adj.newWorkoutCode === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['newWorkoutCode'],
        message: "action='replace' requires newWorkoutCode",
      });
    }
    if (adj.action === 'modify') {
      const hasAny =
        adj.newDurationSeconds !== undefined ||
        adj.newZone !== undefined ||
        adj.newDate !== undefined;
      if (!hasAny) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['action'],
          message: "action='modify' requires at least one of newDurationSeconds, newZone, newDate",
        });
      }
    }
  }) satisfies z.ZodType<WorkoutAdjustment>;

export const adaptationSuggestionSchema = z.object({
  forWeekStart: isoDateSchema,
  generatedAt: isoDateOrDateTimeSchema,
  inputs: z.object({
    lastWeekTss: z.number().nonnegative(),
    currentCtl: z.number().nonnegative(),
    currentAtl: z.number().nonnegative(),
    currentTsb: z.number(),
    avgReadinessLast7d: z.number(),
  }),
  adjustments: z.array(workoutAdjustmentSchema),
  weekLevelNote: z.string().optional(),
}) satisfies z.ZodType<AdaptationSuggestion>;

// ─── Compile-time parity checks (Zod ↔ TS contracts) ─────────────────────────

type AssertEqual<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _macroPlanParity: AssertEqual<z.infer<typeof macroPlanSchema>, MacroPlan> = true;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _weeklyDetailParity: AssertEqual<z.infer<typeof weeklyDetailSchema>, WeeklyDetail> = true;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _adaptationSuggestionParity: AssertEqual<
  z.infer<typeof adaptationSuggestionSchema>,
  AdaptationSuggestion
> = true;
