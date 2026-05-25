import { z } from 'zod';
import { disciplineSchema } from './athlete-profile.schema.js';
import { WORKOUT_CODES, type WorkoutCode } from './workout-codes.js';
import type { CompletionStatus, WorkoutCompleted } from './workout-completed.js';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const isoDateSchema = z.string().regex(ISO_DATE_RE, 'Must be ISO date "YYYY-MM-DD"');

const workoutCodeSchema = z.enum(WORKOUT_CODES) satisfies z.ZodType<WorkoutCode>;

export const completionStatusSchema = z.enum([
  'completed',
  'partial',
  'skipped',
]) satisfies z.ZodType<CompletionStatus>;

export const workoutCompletedSchema = z.object({
  date: isoDateSchema,
  workoutCode: workoutCodeSchema,

  actualTss: z.number().nonnegative().optional(),
  perceivedExertion: z.number().min(1).max(10).optional(),
  notes: z.string().optional(),

  discipline: disciplineSchema.optional(),
  completionStatus: completionStatusSchema.optional(),
  plannedDurationSeconds: z.number().int().nonnegative().optional(),
  actualDurationSeconds: z.number().int().nonnegative().optional(),
  plannedTss: z.number().nonnegative().optional(),
}) satisfies z.ZodType<WorkoutCompleted>;

// ─── Compile-time parity check ───────────────────────────────────────────────

type AssertEqual<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2 ? true : false;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _workoutCompletedParity: AssertEqual<
  z.infer<typeof workoutCompletedSchema>,
  WorkoutCompleted
> = true;
