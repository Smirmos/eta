/* eslint-disable no-console */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../src/app.module.js';
import type { Env } from '../src/config/env.schema.js';
import { AthleteProfileRepository } from '../src/db/repositories/athlete-profile.repository.js';
import { WorkoutsCompletedRepository } from '../src/db/repositories/workouts-completed.repository.js';
import { PlansService } from '../src/modules/plans/plans.service.js';
import { renderTreeHtml } from './lib/tree-html-renderer.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const OUTPUT_DIR = resolve(HERE, 'output');

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: false });
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const userId = config.get('DEV_USER_ID', { infer: true });

  const plansService = app.get(PlansService);
  const tree = await plansService.getLatestTreeForUser(userId);
  if (!tree) {
    throw new Error(`No plan in DB for ${userId}. Run \`pnpm generate:test-plan\` first.`);
  }

  const profileRepo = app.get(AthleteProfileRepository);
  const profileRecord = await profileRepo.findLatestRecordForUser(userId);
  if (!profileRecord) {
    throw new Error(`No profile in DB for ${userId}. Run \`pnpm seed:profile\` first.`);
  }

  const workoutsRepo = app.get(WorkoutsCompletedRepository);
  const fromDate = tree.macroPlan.weeks[0]!.weekStartDate;
  const toDate = new Date().toISOString().slice(0, 10);
  const completedWorkouts = await workoutsRepo.findCanonicalForUserAndDateRange(userId, fromDate, toDate);

  console.log(`Tree: macroPlanId=${tree.macroPlanId}`);
  console.log(`Weeks: ${tree.weeks.length} (${tree.weeks.filter((w) => w.weeklyDetail).length} with WeeklyDetail)`);
  console.log(`Current adaptation: ${tree.currentAdaptation ? 'present' : 'none'}`);
  console.log(`Completed workouts in plan range: ${completedWorkouts.length}`);

  const html = renderTreeHtml({
    tree,
    profile: profileRecord.profile,
    completedWorkouts,
  });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5) + 'Z';
  const outPath = resolve(OUTPUT_DIR, `tree-${timestamp}.html`);
  writeFileSync(outPath, html);
  console.log(`Wrote: ${outPath}`);
  console.log(`Size: ${(html.length / 1024).toFixed(1)} KB`);

  await app.close();
}

void main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
