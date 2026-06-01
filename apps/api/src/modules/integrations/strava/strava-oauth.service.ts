import { Injectable, Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.schema.js';
import { OauthCredentialsRepository } from '../../../db/repositories/oauth-credentials.repository.js';
import {
  stravaTokenResponseSchema,
  type StravaTokenResponse,
} from './strava.types.js';

export type FetchLike = (
  input: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
}>;

export const STRAVA_PROVIDER = 'strava';
const STRAVA_SCOPES = 'profile:read_all,activity:read_all';
const REFRESH_BUFFER_SECONDS = 300; // refresh if expires within 5 min

export class StravaOAuthError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = 'StravaOAuthError';
  }
}

export class StravaNotConnectedError extends Error {
  constructor(userId: string) {
    super(`No Strava credentials for user ${userId}`);
    this.name = 'StravaNotConnectedError';
  }
}

@Injectable()
export class StravaOAuthService {
  private readonly logger = new Logger(StravaOAuthService.name);
  private readonly fetchImpl: FetchLike;

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly credentialsRepo: OauthCredentialsRepository,
    fetchImpl?: FetchLike,
  ) {
    this.fetchImpl = fetchImpl ?? ((globalThis.fetch as unknown) as FetchLike);
  }

  buildAuthorizeUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.required('STRAVA_CLIENT_ID'),
      redirect_uri: this.required('STRAVA_REDIRECT_URI'),
      response_type: 'code',
      approval_prompt: 'auto',
      scope: STRAVA_SCOPES,
      state,
    });
    return `${this.config.get('STRAVA_OAUTH_BASE', { infer: true })}/oauth/authorize?${params.toString()}`;
  }

  /** Initial code → token exchange (OAuth authorization-code flow). */
  async exchangeCode(code: string): Promise<StravaTokenResponse> {
    return this.tokenRequest({
      client_id: this.required('STRAVA_CLIENT_ID'),
      client_secret: this.required('STRAVA_CLIENT_SECRET'),
      code,
      grant_type: 'authorization_code',
    });
  }

  /** Refresh-token grant. Strava rotates the refresh token on every call. */
  async refreshToken(refreshToken: string): Promise<StravaTokenResponse> {
    return this.tokenRequest({
      client_id: this.required('STRAVA_CLIENT_ID'),
      client_secret: this.required('STRAVA_CLIENT_SECRET'),
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });
  }

  /**
   * Persist a freshly-exchanged or refreshed token set against (user, strava).
   * Returns the externalId (Strava athlete id) for caller convenience.
   */
  async storeCredentials(userId: string, token: StravaTokenResponse): Promise<string> {
    const externalId = token.athlete?.id;
    if (externalId === undefined) {
      // Refresh response has no athlete{} block — look up the existing row to
      // preserve external_id. We can't insert a Strava row without it.
      const existing = await this.credentialsRepo.findByUserAndProvider(userId, STRAVA_PROVIDER);
      if (!existing) {
        throw new StravaOAuthError(
          'Cannot store refresh-only token: no existing Strava credentials for user',
        );
      }
      await this.credentialsRepo.upsert({
        userId,
        provider: STRAVA_PROVIDER,
        externalId: existing.externalId,
        accessToken: token.access_token,
        refreshToken: token.refresh_token,
        expiresAt: new Date(token.expires_at * 1000),
        scopes: STRAVA_SCOPES,
        raw: token,
      });
      return existing.externalId;
    }

    const externalIdStr = String(externalId);
    await this.credentialsRepo.upsert({
      userId,
      provider: STRAVA_PROVIDER,
      externalId: externalIdStr,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: new Date(token.expires_at * 1000),
      scopes: STRAVA_SCOPES,
      raw: token,
    });
    return externalIdStr;
  }

  /**
   * Return a valid access token for the user. Refreshes transparently when
   * within REFRESH_BUFFER_SECONDS of expiry. Persists rotated tokens.
   */
  async getValidAccessToken(userId: string): Promise<string> {
    const creds = await this.credentialsRepo.findByUserAndProvider(userId, STRAVA_PROVIDER);
    if (!creds) throw new StravaNotConnectedError(userId);

    const expiresMs = creds.expiresAt.getTime();
    const stillValidMs = expiresMs - Date.now() - REFRESH_BUFFER_SECONDS * 1000;
    if (stillValidMs > 0) return creds.accessToken;

    this.logger.log(`Strava token for user ${userId} expires soon; refreshing.`);
    const refreshed = await this.refreshToken(creds.refreshToken);
    await this.storeCredentials(userId, refreshed);
    return refreshed.access_token;
  }

  // ─── private ───────────────────────────────────────────────────────────────

  private async tokenRequest(body: Record<string, string>): Promise<StravaTokenResponse> {
    const url = `${this.config.get('STRAVA_OAUTH_BASE', { infer: true })}/oauth/token`;
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body).toString(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new StravaOAuthError(`Strava /oauth/token returned ${res.status}`, res.status, text);
    }
    const parsed = stravaTokenResponseSchema.safeParse(await res.json());
    if (!parsed.success) {
      throw new StravaOAuthError(
        `Strava /oauth/token response failed schema validation: ${parsed.error.message}`,
      );
    }
    return parsed.data;
  }

  private required<K extends keyof Env>(key: K): string {
    const value = this.config.get(key, { infer: true });
    if (typeof value !== 'string' || value.length === 0) {
      throw new StravaOAuthError(
        `${String(key)} is not configured — STRAVA_ENABLED=true required`,
      );
    }
    return value;
  }
}
