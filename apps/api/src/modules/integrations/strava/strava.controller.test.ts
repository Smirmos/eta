import type { ConfigService } from '@nestjs/config';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../../../config/env.schema.js';
import type { StravaBackfillService } from './strava-backfill.service.js';
import type { StravaEventService } from './strava-event.service.js';
import type { StravaOAuthService } from './strava-oauth.service.js';
import { StravaController } from './strava.controller.js';

const ENV: Record<string, unknown> = {
  DEV_USER_ID: '00000000-0000-0000-0000-000000000001',
  STRAVA_WEBHOOK_VERIFY_TOKEN: 'verify-me',
};

function makeConfig(overrides: Record<string, unknown> = {}): ConfigService<Env, true> {
  const env = { ...ENV, ...overrides };
  return { get: (k: string) => env[k] } as unknown as ConfigService<Env, true>;
}

function makeOauth(overrides: Partial<StravaOAuthService> = {}): StravaOAuthService {
  return {
    buildAuthorizeUrl: vi.fn(() => 'https://www.strava.com/oauth/authorize?stub'),
    exchangeCode: vi.fn(async () => ({
      token_type: 'Bearer',
      access_token: 'a',
      refresh_token: 'r',
      expires_at: 0,
      expires_in: 0,
    })),
    storeCredentials: vi.fn(async () => '99999'),
    ...overrides,
  } as unknown as StravaOAuthService;
}

function makeEvents(): StravaEventService {
  return { handle: vi.fn(async () => {}) } as unknown as StravaEventService;
}

function makeBackfill(): StravaBackfillService {
  return { trigger: vi.fn() } as unknown as StravaBackfillService;
}

describe('StravaController — webhook handshake', () => {
  it('echoes hub.challenge when verify_token matches', () => {
    const ctrl = new StravaController(makeConfig(), makeOauth(), makeEvents(), makeBackfill());
    const out = ctrl.webhookHandshake('subscribe', 'CHALL-123', 'verify-me');
    expect(out).toEqual({ 'hub.challenge': 'CHALL-123' });
  });

  it('rejects on verify_token mismatch with UnauthorizedException', () => {
    const ctrl = new StravaController(makeConfig(), makeOauth(), makeEvents(), makeBackfill());
    expect(() => ctrl.webhookHandshake('subscribe', 'X', 'WRONG')).toThrow(UnauthorizedException);
  });

  it('rejects malformed handshake (missing challenge) with BadRequestException', () => {
    const ctrl = new StravaController(makeConfig(), makeOauth(), makeEvents(), makeBackfill());
    expect(() => ctrl.webhookHandshake('subscribe', undefined, 'verify-me')).toThrow(
      BadRequestException,
    );
  });
});

describe('StravaController — webhook event POST', () => {
  it('returns { received: true } immediately and dispatches the event asynchronously', async () => {
    const events = makeEvents();
    const ctrl = new StravaController(makeConfig(), makeOauth(), events, makeBackfill());
    const out = ctrl.webhookEvent({
      object_type: 'activity',
      object_id: 12345,
      aspect_type: 'create',
      owner_id: 99999,
      subscription_id: 1,
      event_time: 1700000000,
    });
    expect(out).toEqual({ received: true });
    // setImmediate has scheduled the handle() call.
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(events.handle).toHaveBeenCalledTimes(1);
  });

  it('acks malformed events too (Strava retries on non-200)', () => {
    const events = makeEvents();
    const ctrl = new StravaController(makeConfig(), makeOauth(), events, makeBackfill());
    const out = ctrl.webhookEvent({ bogus: true });
    expect(out).toEqual({ received: true });
    // Malformed payload — handler is NOT scheduled.
  });
});

describe('StravaController — OAuth callback', () => {
  it('exchanges code, persists credentials, and triggers backfill on success', async () => {
    const oauth = makeOauth();
    const backfill = makeBackfill();
    const ctrl = new StravaController(makeConfig(), oauth, makeEvents(), backfill);
    const out = await ctrl.callback(
      'AUTH-CODE',
      undefined,
      undefined,
      'read,activity:read_all,profile:read_all',
    );
    expect(out).toEqual({ status: 'connected', athleteId: '99999' });
    expect(oauth.exchangeCode).toHaveBeenCalledWith('AUTH-CODE');
    expect(backfill.trigger).toHaveBeenCalledTimes(1);
  });

  it('rejects when Strava returned an error', async () => {
    const ctrl = new StravaController(makeConfig(), makeOauth(), makeEvents(), makeBackfill());
    await expect(
      ctrl.callback(undefined, 'access_denied', undefined, undefined),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when activity:read_all scope was NOT granted', async () => {
    const ctrl = new StravaController(makeConfig(), makeOauth(), makeEvents(), makeBackfill());
    await expect(
      ctrl.callback('CODE', undefined, undefined, 'read'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
