import { z } from 'zod';
import { weeklyDetailSchema } from './plan.schema.js';

const dayOfWeekSchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
const disciplineSchema = z.enum(['swim', 'bike', 'run']);
const phaseSchema = z.enum([
  'prep', 'base_1', 'base_2', 'base_3', 'build_1', 'build_2', 'peak', 'race_week', 'transition',
]);
const dayRoleSchema = z.enum(['rest', 'long', 'quality', 'aerobic', 'recovery']);

export const nextWeekDaySchema = z.object({
  dayOfWeek: dayOfWeekSchema,
  role: dayRoleSchema,
  disciplines: z.array(disciplineSchema),
  targetDurationMinutes: z.number().nonnegative(),
});

export const nextWeekFrameSchema = z.object({
  weekStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  phase: phaseSchema,
  isRecoveryWeek: z.boolean(),
  targetVolumeHours: z.number().nonnegative(),
  days: z.array(nextWeekDaySchema).length(7),
  rationale: z.object({
    weeksUntilRace: z.number().int(),
    volumeAnchorHours: z.number().nonnegative(),
    rampPct: z.number(),
    easeTriggered: z.boolean(),
  }),
});

export const nextWeekResponseSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('ok'), frame: nextWeekFrameSchema, weeklyDetail: weeklyDetailSchema }),
  z.object({ status: z.literal('needs_profile') }),
  z.object({ status: z.literal('needs_history') }),
  z.object({ status: z.literal('error'), message: z.string() }),
]);
