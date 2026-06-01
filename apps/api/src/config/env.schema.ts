import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),
  ANTHROPIC_MODEL: z.string().min(1).default('claude-opus-4-7'),
  ANTHROPIC_MAX_TOKENS: z.coerce.number().int().positive().default(16000),
  ETA_KB_ROOT: z.string().optional(),

  // Hard adaptation rules — HRV thresholds (ETA-31 decision). Percentages are
  // whole numbers (10 = 10 % drop). HRV_DOWNGRADE_DURATION_RATIO is a fraction
  // (0.7 = 70 % of planned duration).
  HRV_DROP_NOTE_PCT: z.coerce.number().min(0).max(100).default(5),
  HRV_DROP_DOWNGRADE_PCT: z.coerce.number().min(0).max(100).default(10),
  HRV_DROP_FORCED_REST_PCT: z.coerce.number().min(0).max(100).default(20),
  HRV_STREAK_DROP_PCT: z.coerce.number().min(0).max(100).default(5),
  HRV_STREAK_DAYS: z.coerce.number().int().min(1).default(3),
  HRV_ROLLING_WINDOW_DAYS: z.coerce.number().int().min(1).default(7),
  HRV_DOWNGRADE_DURATION_RATIO: z.coerce.number().gt(0).lte(1).default(0.7),
});

export type Env = z.infer<typeof envSchema>;

export const validateEnv = (raw: Record<string, unknown>): Env => {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
};
