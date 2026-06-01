import { z } from 'zod';

// ─── Token exchange / refresh ────────────────────────────────────────────────
//
// Per https://developers.strava.com/docs/authentication/, the POST /oauth/token
// response is identical for code-exchange and refresh-token flows. expires_at
// is a Unix timestamp (seconds, UTC). athlete is present only on the initial
// code-exchange, omitted on refresh.

export const stravaTokenResponseSchema = z.object({
  token_type: z.literal('Bearer'),
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_at: z.number().int().positive(),
  expires_in: z.number().int().positive(),
  athlete: z
    .object({
      id: z.number().int(),
      username: z.string().nullable().optional(),
      firstname: z.string().nullable().optional(),
      lastname: z.string().nullable().optional(),
    })
    .optional(),
});

export type StravaTokenResponse = z.infer<typeof stravaTokenResponseSchema>;

// ─── Activity ────────────────────────────────────────────────────────────────
//
// Sparse subset — only the fields the ETA-25 normalizer consumes. Strava
// returns many more; we ignore them.

export const stravaActivitySchema = z.object({
  id: z.number().int(),
  type: z.string(), // 'Ride' | 'Run' | 'Swim' | 'WeightTraining' | ...
  start_date_local: z.string(),
  moving_time: z.number().int().nonnegative(),
  elapsed_time: z.number().int().nonnegative(),
  distance: z.number().nonnegative().optional(),
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  perceived_exertion: z.number().min(1).max(10).nullable().optional(),
  average_heartrate: z.number().nullable().optional(),
  max_heartrate: z.number().nullable().optional(),
  weighted_average_watts: z.number().nullable().optional(),
  average_watts: z.number().nullable().optional(),
  has_heartrate: z.boolean().optional(),
});

export type StravaActivity = z.infer<typeof stravaActivitySchema>;

// ─── Webhook ─────────────────────────────────────────────────────────────────

export const stravaWebhookHandshakeSchema = z.object({
  'hub.mode': z.literal('subscribe'),
  'hub.challenge': z.string().min(1),
  'hub.verify_token': z.string().min(1),
});

export const stravaWebhookEventSchema = z.object({
  object_type: z.enum(['activity', 'athlete']),
  object_id: z.number().int(),
  aspect_type: z.enum(['create', 'update', 'delete']),
  owner_id: z.number().int(),
  subscription_id: z.number().int(),
  event_time: z.number().int(),
  updates: z.record(z.string(), z.unknown()).optional(),
});

export type StravaWebhookEvent = z.infer<typeof stravaWebhookEventSchema>;
