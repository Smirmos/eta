import type { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../../../config/env.schema.js';
import type {
  OauthCredentialsRecord,
  OauthCredentialsRepository,
} from '../../../db/repositories/oauth-credentials.repository.js';
import {
  STRAVA_PROVIDER,
  StravaNotConnectedError,
  StravaOAuthError,
  StravaOAuthService,
  type FetchLike,
} from './strava-oauth.service.js';

const ENV: Record<string, unknown> = {
  STRAVA_CLIENT_ID: '12345',
  STRAVA_CLIENT_SECRET: 'shhh',
  STRAVA_REDIRECT_URI: 'https://ngrok.test/integrations/strava/callback',
  STRAVA_OAUTH_BASE: 'https://www.strava.com',
};

function makeConfig(): ConfigService<Env, true> {
  return { get: (key: string) => ENV[key] } as unknown as ConfigService<Env, true>;
}

function fakeRepo(seed?: OauthCredentialsRecord): {
  repo: OauthCredentialsRepository;
  upsertSpy: ReturnType<typeof vi.fn>;
  state: { value: OauthCredentialsRecord | null };
} {
  const state = { value: seed ?? null };
  const upsertSpy = vi.fn(async (input: Parameters<OauthCredentialsRepository['upsert']>[0]) => {
    state.value = {
      id: 'row-1',
      userId: input.userId,
      provider: input.provider,
      externalId: input.externalId,
      accessToken: input.accessToken,
      refreshToken: input.refreshToken,
      expiresAt: input.expiresAt,
      scopes: input.scopes,
      raw: input.raw,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return state.value;
  });
  const repo = {
    upsert: upsertSpy,
    findByUserAndProvider: async () => state.value,
    findByProviderAndExternalId: async () => state.value,
  } as unknown as OauthCredentialsRepository;
  return { repo, upsertSpy, state };
}

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  });
}

function tokenPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    token_type: 'Bearer',
    access_token: 'access-new',
    refresh_token: 'refresh-new',
    expires_at: Math.floor(Date.now() / 1000) + 6 * 60 * 60,
    expires_in: 6 * 60 * 60,
    athlete: { id: 99999, firstname: 'A', lastname: 'S' },
    ...overrides,
  };
}

describe('StravaOAuthService', () => {
  it('buildAuthorizeUrl includes required scopes and redirect_uri', () => {
    const { repo } = fakeRepo();
    const svc = new StravaOAuthService(makeConfig(), repo);
    const url = new URL(svc.buildAuthorizeUrl('s'));
    expect(url.origin).toBe('https://www.strava.com');
    expect(url.pathname).toBe('/oauth/authorize');
    expect(url.searchParams.get('scope')).toBe('profile:read_all,activity:read_all');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('12345');
    expect(url.searchParams.get('state')).toBe('s');
  });

  it('exchangeCode posts authorization_code grant and parses response', async () => {
    const { repo } = fakeRepo();
    const fetchSpy = vi.fn<FetchLike>(() => jsonResponse(tokenPayload()));
    const svc = new StravaOAuthService(makeConfig(), repo, fetchSpy);
    const out = await svc.exchangeCode('CODE');
    expect(out.athlete?.id).toBe(99999);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, init] = fetchSpy.mock.calls[0]!;
    expect(init?.method).toBe('POST');
    const body = new URLSearchParams(init!.body!);
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('CODE');
    expect(body.get('client_id')).toBe('12345');
    expect(body.get('client_secret')).toBe('shhh');
  });

  it('refreshToken posts refresh_token grant', async () => {
    const { repo } = fakeRepo();
    const fetchSpy = vi.fn<FetchLike>(() => jsonResponse(tokenPayload({ athlete: undefined })));
    const svc = new StravaOAuthService(makeConfig(), repo, fetchSpy);
    await svc.refreshToken('OLD_REFRESH');
    const [, init] = fetchSpy.mock.calls[0]!;
    const body = new URLSearchParams(init!.body!);
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('OLD_REFRESH');
  });

  it('throws StravaOAuthError on non-2xx token response with body preserved', async () => {
    const { repo } = fakeRepo();
    const fetchSpy = vi.fn<FetchLike>(() =>
      Promise.resolve({
        ok: false,
        status: 400,
        text: async () => '{"error":"invalid_grant"}',
        json: async () => ({ error: 'invalid_grant' }),
      }),
    );
    const svc = new StravaOAuthService(makeConfig(), repo, fetchSpy);
    await expect(svc.exchangeCode('BAD')).rejects.toMatchObject({
      name: 'StravaOAuthError',
      status: 400,
      body: '{"error":"invalid_grant"}',
    });
  });

  it('storeCredentials persists rotated tokens with athlete id (initial exchange)', async () => {
    const { repo, upsertSpy } = fakeRepo();
    const svc = new StravaOAuthService(makeConfig(), repo);
    const externalId = await svc.storeCredentials('user-1', tokenPayload() as never);
    expect(externalId).toBe('99999');
    expect(upsertSpy).toHaveBeenCalledOnce();
    const arg = upsertSpy.mock.calls[0]![0]!;
    expect(arg.provider).toBe(STRAVA_PROVIDER);
    expect(arg.externalId).toBe('99999');
    expect(arg.accessToken).toBe('access-new');
    expect(arg.refreshToken).toBe('refresh-new');
    expect(arg.scopes).toBe('profile:read_all,activity:read_all');
  });

  it('storeCredentials reuses externalId from prior row when athlete{} is absent (refresh)', async () => {
    const seed: OauthCredentialsRecord = {
      id: 'row-1',
      userId: 'user-1',
      provider: STRAVA_PROVIDER,
      externalId: '99999',
      accessToken: 'old',
      refreshToken: 'old-r',
      expiresAt: new Date(),
      scopes: 'profile:read_all,activity:read_all',
      raw: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { repo, upsertSpy } = fakeRepo(seed);
    const svc = new StravaOAuthService(makeConfig(), repo);
    const externalId = await svc.storeCredentials(
      'user-1',
      tokenPayload({ athlete: undefined }) as never,
    );
    expect(externalId).toBe('99999');
    expect(upsertSpy.mock.calls[0]![0]!.externalId).toBe('99999');
  });

  it('storeCredentials refuses refresh-only token when no prior row exists', async () => {
    const { repo } = fakeRepo();
    const svc = new StravaOAuthService(makeConfig(), repo);
    await expect(
      svc.storeCredentials('user-1', tokenPayload({ athlete: undefined }) as never),
    ).rejects.toBeInstanceOf(StravaOAuthError);
  });

  it('getValidAccessToken returns existing token when far from expiry', async () => {
    const seed: OauthCredentialsRecord = {
      id: 'row-1',
      userId: 'user-1',
      provider: STRAVA_PROVIDER,
      externalId: '99999',
      accessToken: 'valid',
      refreshToken: 'rfr',
      expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3h ahead
      scopes: 'profile:read_all,activity:read_all',
      raw: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { repo } = fakeRepo(seed);
    const fetchSpy = vi.fn<FetchLike>();
    const svc = new StravaOAuthService(makeConfig(), repo, fetchSpy);
    expect(await svc.getValidAccessToken('user-1')).toBe('valid');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('getValidAccessToken refreshes when within expiry buffer and persists rotated tokens', async () => {
    const seed: OauthCredentialsRecord = {
      id: 'row-1',
      userId: 'user-1',
      provider: STRAVA_PROVIDER,
      externalId: '99999',
      accessToken: 'expiring',
      refreshToken: 'rfr-old',
      expiresAt: new Date(Date.now() + 60 * 1000), // 1 min ahead — within 5-min buffer
      scopes: 'profile:read_all,activity:read_all',
      raw: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const { repo, upsertSpy } = fakeRepo(seed);
    const fetchSpy = vi.fn<FetchLike>(() => jsonResponse(tokenPayload({ athlete: undefined })));
    const svc = new StravaOAuthService(makeConfig(), repo, fetchSpy);
    const token = await svc.getValidAccessToken('user-1');
    expect(token).toBe('access-new');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const refreshArg = upsertSpy.mock.calls[0]![0]!;
    expect(refreshArg.refreshToken).toBe('refresh-new');
    expect(refreshArg.externalId).toBe('99999'); // preserved
  });

  it('getValidAccessToken throws StravaNotConnectedError when user has no row', async () => {
    const { repo } = fakeRepo();
    const svc = new StravaOAuthService(makeConfig(), repo);
    await expect(svc.getValidAccessToken('user-1')).rejects.toBeInstanceOf(
      StravaNotConnectedError,
    );
  });
});
