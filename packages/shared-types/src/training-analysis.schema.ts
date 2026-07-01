import { z } from 'zod';
import { disciplineSchema } from './athlete-profile.schema.js';

const sportSplitEntrySchema = z.object({
  discipline: disciplineSchema,
  sessions: z.number(),
  hours: z.number(),
  pctHours: z.number(),
});

const weekBucketSchema = z.object({
  weekStart: z.string(),
  sessions: z.number(),
  hours: z.number(),
  byDiscipline: z
    .object({
      swim: z.object({ sessions: z.number(), hours: z.number() }),
      bike: z.object({ sessions: z.number(), hours: z.number() }),
      run: z.object({ sessions: z.number(), hours: z.number() }),
    })
    .partial(),
  bikeTss: z.number().nullable(),
});

const longestSessionSchema = z.object({
  discipline: disciplineSchema,
  date: z.string(),
  minutes: z.number(),
});

export const trainingAnalysisResponseSchema = z.object({
  hasData: z.boolean(),
  window: z.object({ from: z.string(), asOf: z.string() }).nullable(),
  overall: z.object({
    totalSessions: z.number(),
    totalHours: z.number(),
    trainingDays: z.number(),
    avgSessionsPerWeek: z.number(),
    avgTrainingDaysPerWeek: z.number(),
    sportSplit: z.array(sportSplitEntrySchema),
  }),
  perWeek: z.array(weekBucketSchema),
  trend: z.enum(['building', 'steady', 'tapering']),
  longestSessions: z.array(longestSessionSchema),
  dataNote: z.object({ tssCoverage: z.literal('bike_only'), staleDays: z.number() }),
  narrative: z.string().nullable(),
});
