import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Logger,
  Post,
  Query,
  Body,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FastifyReply } from 'fastify';
import type { Env } from '../../../config/env.schema.js';
import { StravaBackfillService } from './strava-backfill.service.js';
import { StravaEventService } from './strava-event.service.js';
import { StravaOAuthService } from './strava-oauth.service.js';
import {
  stravaWebhookEventSchema,
  stravaWebhookHandshakeSchema,
} from './strava.types.js';

@Controller('integrations/strava')
export class StravaController {
  private readonly logger = new Logger(StravaController.name);

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly oauth: StravaOAuthService,
    private readonly events: StravaEventService,
    private readonly backfill: StravaBackfillService,
  ) {}

  /** OAuth authorize redirect — `GET /integrations/strava/authorize`. */
  @Get('authorize')
  authorize(@Res() reply: FastifyReply): void {
    const userId = this.config.get('DEV_USER_ID', { infer: true });
    const url = this.oauth.buildAuthorizeUrl(userId);
    void reply.redirect(url, 302);
  }

  /** OAuth callback — Strava redirects here with ?code=...&state=... */
  @Get('callback')
  async callback(
    @Query('code') code?: string,
    @Query('error') error?: string,
    @Query('state') state?: string,
    @Query('scope') scope?: string,
  ): Promise<{ status: string; athleteId: string }> {
    if (error) throw new BadRequestException(`Strava OAuth error: ${error}`);
    if (!code) throw new BadRequestException('Missing authorization code');
    if (!scope?.includes('activity:read_all')) {
      throw new BadRequestException(
        `Insufficient Strava scope granted: ${scope ?? 'none'}. activity:read_all is required.`,
      );
    }

    const userId = state && /^[0-9a-fA-F-]{36}$/.test(state)
      ? state
      : this.config.get('DEV_USER_ID', { infer: true });

    const token = await this.oauth.exchangeCode(code);
    const athleteId = await this.oauth.storeCredentials(userId, token);
    this.logger.log(`Strava connected for user ${userId}, athlete ${athleteId}.`);
    this.backfill.trigger(userId);
    return { status: 'connected', athleteId };
  }

  /**
   * Webhook subscription handshake.
   * Strava: GET /integrations/strava/webhook?hub.mode=subscribe&hub.challenge=…&hub.verify_token=…
   * Required response within 2s: 200 + `{"hub.challenge":"…"}`.
   */
  @Get('webhook')
  webhookHandshake(
    @Query('hub.mode') mode?: string,
    @Query('hub.challenge') challenge?: string,
    @Query('hub.verify_token') verifyToken?: string,
  ): { 'hub.challenge': string } {
    const parsed = stravaWebhookHandshakeSchema.safeParse({
      'hub.mode': mode,
      'hub.challenge': challenge,
      'hub.verify_token': verifyToken,
    });
    if (!parsed.success) {
      throw new BadRequestException('Invalid Strava webhook handshake query');
    }
    const expected = this.config.get('STRAVA_WEBHOOK_VERIFY_TOKEN', { infer: true });
    if (!expected || parsed.data['hub.verify_token'] !== expected) {
      throw new UnauthorizedException('Strava webhook verify_token mismatch');
    }
    return { 'hub.challenge': parsed.data['hub.challenge'] };
  }

  /**
   * Webhook event POST. Must respond 200 within 2 s — actual ingest runs
   * async so the response races out before Strava times out.
   */
  @Post('webhook')
  @HttpCode(200)
  webhookEvent(@Body() body: unknown): { received: true } {
    const parsed = stravaWebhookEventSchema.safeParse(body);
    if (!parsed.success) {
      this.logger.warn(`Strava webhook event failed schema parse: ${parsed.error.message}`);
      return { received: true }; // ack anyway — Strava retries on non-200
    }
    setImmediate(() => {
      this.events.handle(parsed.data).catch((err: unknown) => {
        this.logger.error(
          `Strava event handler failed for ${parsed.data.aspect_type} ${parsed.data.object_id}: ${err instanceof Error ? err.stack ?? err.message : String(err)}`,
        );
      });
    });
    return { received: true };
  }
}
