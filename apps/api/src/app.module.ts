import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.schema.js';
import { HealthController } from './common/health.controller.js';
import { PlanGenerationModule } from './modules/plan-generation/plan-generation.module.js';

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
  ],
  controllers: [HealthController],
})
export class AppModule {}
