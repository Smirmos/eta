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

  // ETA-25 Strava integration. STRAVA_ENABLED gates the module: when false the
  // controller routes are not registered and the *_API/*_SECRET vars become
  // optional, so local dev without credentials still boots.
  STRAVA_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === 'true' || v === '1'),
  STRAVA_CLIENT_ID: z.string().optional(),
  STRAVA_CLIENT_SECRET: z.string().optional(),
  STRAVA_REDIRECT_URI: z.string().url().optional(),
  STRAVA_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  STRAVA_WEBHOOK_CALLBACK_URL: z.string().url().optional(),
  STRAVA_API_BASE: z.string().url().default('https://www.strava.com/api/v3'),
  STRAVA_OAUTH_BASE: z.string().url().default('https://www.strava.com'),

  // Background incremental sync (keeps the DB fresh without a live webhook).
  // When STRAVA_ENABLED, the scheduler runs once on boot and then every N
  // minutes, pulling only activities newer than the latest stored one. Set to
  // 0 to disable the scheduler entirely (manual `pnpm strava:backfill` only).
  STRAVA_SYNC_INTERVAL_MINUTES: z.coerce.number().int().min(0).default(60),

  // v1 has no users table — the Strava-connecting athlete is keyed by this
  // hardcoded uuid. Replace with a real users table once auth lands.
  DEV_USER_ID: z.string().uuid().default('00000000-0000-0000-0000-000000000001'),
})
.superRefine((env, ctx) => {
  if (!env.STRAVA_ENABLED) return;
  const required = [
    'STRAVA_CLIENT_ID',
    'STRAVA_CLIENT_SECRET',
    'STRAVA_REDIRECT_URI',
    'STRAVA_WEBHOOK_VERIFY_TOKEN',
    'STRAVA_WEBHOOK_CALLBACK_URL',
  ] as const;
  for (const key of required) {
    if (!env[key]) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} is required when STRAVA_ENABLED=true`,
      });
    }
  }
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
