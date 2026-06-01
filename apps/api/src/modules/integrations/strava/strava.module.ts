import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.schema.js';
import { DbModule } from '../../../db/db.module.js';
import { AthleteProfileRepository } from '../../../db/repositories/athlete-profile.repository.js';
import { OauthCredentialsRepository } from '../../../db/repositories/oauth-credentials.repository.js';
import { WorkoutsCompletedRepository } from '../../../db/repositories/workouts-completed.repository.js';
import { StravaBackfillService } from './strava-backfill.service.js';
import { StravaClientService } from './strava-client.service.js';
import { StravaController } from './strava.controller.js';
import { StravaEventService } from './strava-event.service.js';
import { StravaOAuthService } from './strava-oauth.service.js';

@Module({
  imports: [DbModule],
  controllers: [StravaController],
  providers: [
    AthleteProfileRepository,
    OauthCredentialsRepository,
    WorkoutsCompletedRepository,
    {
      provide: StravaOAuthService,
      inject: [ConfigService, OauthCredentialsRepository],
      useFactory: (config: ConfigService<Env, true>, repo: OauthCredentialsRepository) =>
        new StravaOAuthService(config, repo),
    },
    {
      provide: StravaClientService,
      inject: [ConfigService, StravaOAuthService],
      useFactory: (config: ConfigService<Env, true>, oauth: StravaOAuthService) =>
        new StravaClientService(config, oauth),
    },
    StravaEventService,
    StravaBackfillService,
  ],
  exports: [StravaBackfillService, StravaClientService, StravaOAuthService],
})
export class StravaModule {}
