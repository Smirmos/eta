/* eslint-disable no-console */
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../src/app.module.js';
import type { Env } from '../src/config/env.schema.js';
import { AthleteProfileRepository } from '../src/db/repositories/athlete-profile.repository.js';
import { MacroPlansRepository } from '../src/db/repositories/macro-plans.repository.js';
import { WeeklyDetailsRepository } from '../src/db/repositories/weekly-details.repository.js';
import { WorkoutsCompletedRepository } from '../src/db/repositories/workouts-completed.repository.js';
import { Pass3GenerationService } from '../src/modules/plan-generation/pass3/pass3.service.js';
import { currentWeekStartDate } from '../src/modules/plans/plans.service.js';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: false });
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  const userArg = process.argv.find((a) => a.startsWith('--user='));
  const userId: string = userArg
    ? (userArg.split('=')[1] ?? config.get('DEV_USER_ID', { infer: true }))
    : config.get('DEV_USER_ID', { infer: true });

  const weekStartArg = process.argv.find((a) => a.startsWith('--week-start='));
  const explicitWeekStart = weekStartArg?.split('=')[1];

  const macroRepo = app.get(MacroPlansRepository);
  const weeklyRepo = app.get(WeeklyDetailsRepository);
  const workoutsRepo = app.get(WorkoutsCompletedRepository);
  const profileRepo = app.get(AthleteProfileRepository);
  const pass3 = app.get(Pass3GenerationService);

  const macroRecord = await macroRepo.findLatestForUser(userId);
  if (!macroRecord) {
    throw new Error(`No macro plan in DB for ${userId}. Run \`pnpm generate:test-plan\` first.`);
  }
  console.log(`Loaded macro plan ${macroRecord.id} (race ${macroRecord.plan.raceDate}).`);

  const targetWeekStart =
    explicitWeekStart ?? currentWeekStartDate(macroRecord.plan, new Date());
  if (!targetWeekStart) {
    throw new Error('Macro plan has no weeks — cannot adapt.');
  }
  console.log(`Adapting week starting ${targetWeekStart}.`);

  const targetWeek = macroRecord.plan.weeks.find((w) => w.weekStartDate === targetWeekStart);
  if (!targetWeek) {
    throw new Error(`No macro plan week with weekStartDate=${targetWeekStart}.`);
  }

  const weeklyMap = await weeklyRepo.findLatestForMacroPlan(macroRecord.id);
  const weeklyDraft = weeklyMap.get(targetWeek.weekNumber);
  if (!weeklyDraft) {
    throw new Error(
      `No WeeklyDetail for week ${targetWeek.weekNumber} (start ${targetWeekStart}). Run \`pnpm generate:test-week -- --week-index=<N>\` first.`,
    );
  }

  // 7 days immediately preceding the upcoming week
  const fromMs = Date.parse(targetWeekStart + 'T00:00:00Z') - 7 * 86_400_000;
  const fromDate = new Date(fromMs).toISOString().slice(0, 10);
  const completedLastWeek = await workoutsRepo.findCanonicalForUserAndDateRange(
    userId,
    fromDate,
    targetWeekStart,
  );
  console.log(
    `Found ${completedLastWeek.length} completed workouts in [${fromDate}, ${targetWeekStart}).`,
  );

  const profileRecord = await profileRepo.findLatestRecordForUser(userId);
  if (!profileRecord) {
    throw new Error(`No profile in DB for ${userId}. Run \`pnpm seed:profile\` first.`);
  }

  console.log('Calling Pass 3 (this can take 60-120s)...');
  const result = await pass3.generateAdaptation({
    macroPlanId: macroRecord.id,
    forWeekStart: targetWeekStart,
    weeklyDraft,
    completedLastWeek,
    readinessHistory: [],
    athleteProfile: profileRecord.profile,
  });

  console.log(`Persisted adaptation ${result.adaptationId}.`);
  console.log(`Hard-rule firings: ${result.output.hardRuleOutput.forcedAdjustments.length}`);
  console.log(`LLM adjustments: ${result.output.suggestion.adjustments.length}`);

  await app.close();
}

void main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
