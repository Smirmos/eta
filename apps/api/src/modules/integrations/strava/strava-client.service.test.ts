import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../../../config/env.schema.js';
import type { StravaOAuthService } from './strava-oauth.service.js';
import {
  StravaClientError,
  StravaClientService,
  type FetchLike,
} from './strava-client.service.js';

const ENV: Record<string, unknown> = {
  STRAVA_API_BASE: 'https://www.strava.com/api/v3',
};

function makeConfig(): ConfigService<Env, true> {
  return { get: (k: string) => ENV[k] } as unknown as ConfigService<Env, true>;
}

function fakeOauth(token = 'access'): StravaOAuthService {
  return { getValidAccessToken: async () => token } as unknown as StravaOAuthService;
}

function jsonResp(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
    headers: { get: () => null },
  });
}

const sampleActivity = {
  id: 100,
  type: 'Ride',
  start_date_local: '2026-05-30T00:00:00Z',
  moving_time: 3600,
  elapsed_time: 3700,
};

describe('StravaClientService', () => {
  it('getActivity sends bearer token and parses the response', async () => {
    const fetchSpy = vi.fn<FetchLike>(() => jsonResp(sampleActivity));
    const svc = new StravaClientService(makeConfig(), fakeOauth('tok-1'), fetchSpy);
    const a = await svc.getActivity('u', 100);
    expect(a.id).toBe(100);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('https://www.strava.com/api/v3/activities/100');
    expect(init?.headers?.Authorization).toBe('Bearer tok-1');
  });

  it('retries once on 429, sleeping until the next quarter-hour boundary', async () => {
    let calls = 0;
    const fetchSpy = vi.fn<FetchLike>(() => {
      calls += 1;
      if (calls === 1) {
        return Promise.resolve({
          ok: false,
          status: 429,
          text: async () => 'rate limit',
          json: async () => ({}),
          headers: { get: () => null },
        });
      }
      return jsonResp(sampleActivity);
    });
    const sleepSpy = vi.fn(async (_ms: number) => {});
    const svc = new StravaClientService(makeConfig(), fakeOauth(), fetchSpy, sleepSpy);
    const out = await svc.getActivity('u', 100);
    expect(out.id).toBe(100);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(sleepSpy).toHaveBeenCalledTimes(1);
    const sleptMs = sleepSpy.mock.calls[0]![0];
    // Should be at most a full quarter-hour + 1s safety margin.
    expect(sleptMs).toBeGreaterThan(0);
    expect(sleptMs).toBeLessThanOrEqual(15 * 60 * 1000 + 2_000);
  });

  it('429 twice → second 429 propagates (no infinite retry)', async () => {
    const fetchSpy = vi.fn<FetchLike>(() =>
      Promise.resolve({
        ok: false,
        status: 429,
        text: async () => 'still rate-limited',
        json: async () => ({}),
        headers: { get: () => null },
      }),
    );
    const sleepSpy = vi.fn(async (_ms: number) => {});
    const svc = new StravaClientService(makeConfig(), fakeOauth(), fetchSpy, sleepSpy);
    await expect(svc.getActivity('u', 100)).rejects.toMatchObject({
      name: 'StravaClientError',
      status: 429,
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('5xx → exponential backoff up to 3 retries, then propagates', async () => {
    const fetchSpy = vi.fn<FetchLike>(() =>
      Promise.resolve({
        ok: false,
        status: 503,
        text: async () => 'down',
        json: async () => ({}),
        headers: { get: () => null },
      }),
    );
    const sleepSpy = vi.fn(async (_ms: number) => {});
    const svc = new StravaClientService(makeConfig(), fakeOauth(), fetchSpy, sleepSpy);
    await expect(svc.getActivity('u', 100)).rejects.toBeInstanceOf(StravaClientError);
    expect(fetchSpy).toHaveBeenCalledTimes(4); // initial + 3 retries
    expect(sleepSpy.mock.calls.map((c) => c[0])).toEqual([1_000, 2_000, 4_000]);
  });

  it('5xx then 200 → resolves with retried response', async () => {
    let calls = 0;
    const fetchSpy = vi.fn<FetchLike>(() => {
      calls += 1;
      if (calls < 3) {
        return Promise.resolve({
          ok: false,
          status: 503,
          text: async () => 'down',
          json: async () => ({}),
          headers: { get: () => null },
        });
      }
      return jsonResp(sampleActivity);
    });
    const sleepSpy = vi.fn(async (_ms: number) => {});
    const svc = new StravaClientService(makeConfig(), fakeOauth(), fetchSpy, sleepSpy);
    const out = await svc.getActivity('u', 100);
    expect(out.id).toBe(100);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('listAthleteActivities passes after/page/perPage and requires an array response', async () => {
    const fetchSpy = vi.fn<FetchLike>(() => jsonResp([sampleActivity]));
    const svc = new StravaClientService(makeConfig(), fakeOauth(), fetchSpy);
    const out = await svc.listAthleteActivities('u', { after: 1700000000, page: 2, perPage: 50 });
    expect(out).toHaveLength(1);
    const url = new URL(fetchSpy.mock.calls[0]![0]);
    expect(url.searchParams.get('after')).toBe('1700000000');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('per_page')).toBe('50');
  });

  it('listAthleteActivities throws if Strava returns non-array', async () => {
    const fetchSpy = vi.fn<FetchLike>(() => jsonResp({ unexpected: true }));
    const svc = new StravaClientService(makeConfig(), fakeOauth(), fetchSpy);
    await expect(svc.listAthleteActivities('u')).rejects.toBeInstanceOf(StravaClientError);
  });
});
