import { Injectable, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.schema.js';
import { StravaOAuthService } from './strava-oauth.service.js';
import {
  stravaActivitySchema,
  type StravaActivity,
} from './strava.types.js';

export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string> },
) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
  headers: { get: (k: string) => string | null };
}>;

const RETRY_BACKOFF_MS = [1_000, 2_000, 4_000];

export class StravaClientError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = 'StravaClientError';
  }
}

export interface ListActivitiesArgs {
  /** Unix seconds, exclusive lower bound. */
  after?: number;
  /** Unix seconds, exclusive upper bound. */
  before?: number;
  page?: number;
  perPage?: number;
}

/** Sleep helper, overridable in tests. */
export type SleepFn = (ms: number) => Promise<void>;
const defaultSleep: SleepFn = (ms) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class StravaClientService {
  private readonly logger = new Logger(StravaClientService.name);
  private readonly fetchImpl: FetchLike;
  private readonly sleep: SleepFn;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly oauth: StravaOAuthService,
    fetchImpl?: FetchLike,
    sleep?: SleepFn,
  ) {
    this.fetchImpl = fetchImpl ?? ((globalThis.fetch as unknown) as FetchLike);
    this.sleep = sleep ?? defaultSleep;
  }

  /** GET /activities/{id} → activity detail. */
  async getActivity(userId: string, activityId: number): Promise<StravaActivity> {
    const raw = await this.request<unknown>(userId, `/activities/${activityId}`);
    const parsed = stravaActivitySchema.safeParse(raw);
    if (!parsed.success) {
      throw new StravaClientError(
        `Strava activity ${activityId} failed schema validation: ${parsed.error.message}`,
      );
    }
    return parsed.data;
  }

  /** GET /activities/{id}/streams — raw (validated by caller). */
  async getActivityStreams(
    userId: string,
    activityId: number,
    keys: ReadonlyArray<'heartrate' | 'watts' | 'time'>,
  ): Promise<unknown> {
    const qs = new URLSearchParams({ keys: keys.join(','), key_by_type: 'true' });
    return this.request<unknown>(userId, `/activities/${activityId}/streams?${qs.toString()}`);
  }

  /** GET /athlete/activities — paginated for backfill. */
  async listAthleteActivities(userId: string, args: ListActivitiesArgs = {}): Promise<unknown[]> {
    const qs = new URLSearchParams();
    if (args.after !== undefined) qs.set('after', String(args.after));
    if (args.before !== undefined) qs.set('before', String(args.before));
    qs.set('page', String(args.page ?? 1));
    qs.set('per_page', String(args.perPage ?? 30));
    const body = await this.request<unknown>(userId, `/athlete/activities?${qs.toString()}`);
    if (!Array.isArray(body)) {
      throw new StravaClientError('Strava /athlete/activities did not return an array');
    }
    return body;
  }

  // ─── private ───────────────────────────────────────────────────────────────

  private async request<T>(userId: string, path: string, _attempt = 0): Promise<T> {
    const base = this.config.get('STRAVA_API_BASE', { infer: true });
    const accessToken = await this.oauth.getValidAccessToken(userId);
    const url = `${base}${path}`;
    const res = await this.fetchImpl(url, {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.ok) return (await res.json()) as T;

    // 429 → wait until next 15-min boundary, retry once.
    if (res.status === 429 && _attempt === 0) {
      const waitMs = msUntilNextQuarterHour();
      this.logger.warn(`Strava 429 on ${path} — sleeping ${Math.round(waitMs / 1000)}s before retry.`);
      await this.sleep(waitMs);
      return this.request<T>(userId, path, _attempt + 1);
    }

    // 5xx → exponential backoff up to 3 tries.
    if (res.status >= 500 && _attempt < RETRY_BACKOFF_MS.length) {
      const backoff = RETRY_BACKOFF_MS[_attempt]!;
      this.logger.warn(
        `Strava ${res.status} on ${path} — backing off ${backoff}ms (attempt ${_attempt + 1}/${RETRY_BACKOFF_MS.length}).`,
      );
      await this.sleep(backoff);
      return this.request<T>(userId, path, _attempt + 1);
    }

    const text = await res.text();
    throw new StravaClientError(`Strava ${path} returned ${res.status}`, res.status, text);
  }
}

function msUntilNextQuarterHour(now: Date = new Date()): number {
  const ms = now.getTime();
  const quarter = 15 * 60 * 1000;
  return quarter - (ms % quarter) + 1_000; // +1s safety margin
}
