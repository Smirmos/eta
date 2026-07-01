/* eslint-disable no-console */
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../src/app.module.js';
import type { Env } from '../src/config/env.schema.js';
import { AthleteProfileRepository } from '../src/db/repositories/athlete-profile.repository.js';
import { TrainingAnalysisService } from '../src/modules/training/training-analysis.service.js';
import { NextWeekGenerationService } from '../src/modules/training/next-week-generation.service.js';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: false });
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const userId = config.get('DEV_USER_ID', { infer: true });

  const profile = await app.get(AthleteProfileRepository).findByUserId(userId);
  if (!profile) throw new Error(`No athlete profile for ${userId} — run pnpm seed:profile first.`);
  const analysis = await app.get(TrainingAnalysisService).analyze(userId);
  if (!analysis.hasData) throw new Error('No training history — run pnpm strava:backfill first.');

  const result = await app.get(NextWeekGenerationService).generate({ profile, analysis });
  console.log(JSON.stringify(result, null, 2));
  await app.close();
}

void main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
