import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.schema.js';

const baseEnv = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/eta',
  ANTHROPIC_API_KEY: 'sk-test',
};

describe('envSchema — Strava integration gating (ETA-25)', () => {
  it('boots without Strava env vars when STRAVA_ENABLED is unset', () => {
    expect(() => validateEnv(baseEnv)).not.toThrow();
  });

  it('boots without Strava env vars when STRAVA_ENABLED=false', () => {
    expect(() => validateEnv({ ...baseEnv, STRAVA_ENABLED: 'false' })).not.toThrow();
  });

  it('rejects boot when STRAVA_ENABLED=true but credentials are missing', () => {
    expect(() => validateEnv({ ...baseEnv, STRAVA_ENABLED: 'true' })).toThrow(
      /STRAVA_CLIENT_ID is required when STRAVA_ENABLED=true/,
    );
  });

  it('boots when STRAVA_ENABLED=true and all Strava env vars are present', () => {
    const env = {
      ...baseEnv,
      STRAVA_ENABLED: 'true',
      STRAVA_CLIENT_ID: '123456',
      STRAVA_CLIENT_SECRET: 'secret',
      STRAVA_REDIRECT_URI: 'https://example.ngrok.app/integrations/strava/callback',
      STRAVA_WEBHOOK_VERIFY_TOKEN: 'verify',
      STRAVA_WEBHOOK_CALLBACK_URL: 'https://example.ngrok.app/integrations/strava/webhook',
    };
    expect(() => validateEnv(env)).not.toThrow();
  });

  it('DEV_USER_ID defaults to a stable dev uuid when omitted', () => {
    const parsed = validateEnv(baseEnv);
    expect(parsed.DEV_USER_ID).toBe('00000000-0000-0000-0000-000000000001');
  });
});
