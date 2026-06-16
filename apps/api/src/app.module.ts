// Load .env at module-eval time so the optional-import gate below can read
// STRAVA_ENABLED from .env (ConfigModule loads .env too, but later — after the
// @Module decorator has been evaluated).
import { config as loadEnv } from 'dotenv';
loadEnv({ path: '../../.env' });
loadEnv({ path: '.env' });

import { Module, type DynamicModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.schema.js';
import { HealthController } from './common/health.controller.js';
import { PlanGenerationModule } from './modules/plan-generation/plan-generation.module.js';
import { AthleteProfileModule } from './modules/athlete-profile/athlete-profile.module.js';
import { StravaModule } from './modules/integrations/strava/strava.module.js';

function optionalStravaModule(): DynamicModule[] {
  const enabled =
    process.env.STRAVA_ENABLED === 'true' || process.env.STRAVA_ENABLED === '1';
  return enabled ? [{ module: StravaModule, global: false }] : [];
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      // Loaded relative to process.cwd() (apps/api when running `pnpm dev`).
      // The repo .env at the workspace root is preferred; a local override is allowed.
      envFilePath: ['../../.env', '.env'],
    }),
    PlanGenerationModule,
    AthleteProfileModule,
    ...optionalStravaModule(),
  ],
  controllers: [HealthController],
})
export class AppModule {}
