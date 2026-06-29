/* eslint-disable no-console */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { WorkoutCompleted } from '@eta/shared-types';
import { AppModule } from '../src/app.module.js';
import type { Env } from '../src/config/env.schema.js';
import { AthleteProfileRepository } from '../src/db/repositories/athlete-profile.repository.js';
import { MacroPlansRepository } from '../src/db/repositories/macro-plans.repository.js';
import {
  Pass2GenerationError,
  Pass2GenerationService,
} from '../src/modules/plan-generation/pass2/pass2.service.js';
import { loadProfile } from './lib/load-profile.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(HERE, 'output');

function timestampForFilename(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function parseTargetWeekIndex(): number {
  // CLI: pnpm generate:test-week -- --week-index=0  (or default to 0 = first week)
  const arg = process.argv.find((a) => a.startsWith('--week-index='));
  if (!arg) return 0;
  const value = Number.parseInt(arg.split('=')[1] ?? '0', 10);
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid --week-index value: ${arg}`);
  }
  return value;
}

async function main(): Promise<void> {
  const targetWeekIndex = parseTargetWeekIndex();

  // --profile=<path> overrides; default is DB lookup for DEV_USER_ID.
  const profileArg = process.argv.find((a) => a.startsWith('--profile='));
  const profilePath = profileArg?.split('=')[1];

  // --plan-id=<uuid> overrides the latest-for-user lookup.
  const planIdArg = process.argv.find((a) => a.startsWith('--plan-id='));
  const explicitPlanId = planIdArg?.split('=')[1];

  // --user=<id> overrides DEV_USER_ID.
  const userArg = process.argv.find((a) => a.startsWith('--user='));
  const userOverride = userArg?.split('=')[1];

  // v1 single-user pre-Strava-sync: no real recent workouts.
  const recentWorkouts: WorkoutCompleted[] = [];

  console.log('Bootstrapping NestJS context...');
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: false });
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const userId: string = userOverride ?? config.get('DEV_USER_ID', { infer: true });

  // Resolve the macro plan from DB (explicit id or latest for user).
  const macroRepo = app.get(MacroPlansRepository);
  const macroRecord = explicitPlanId
    ? await macroRepo.findById(explicitPlanId)
    : await macroRepo.findLatestForUser(userId);

  if (!macroRecord) {
    await app.close();
    if (explicitPlanId) {
      throw new Error(`No macro plan with id ${explicitPlanId}.`);
    }
    throw new Error(
      `No macro plan in DB for ${userId}. Run \`pnpm generate:test-plan\` first.`,
    );
  }
  console.log(
    explicitPlanId
      ? `Loaded macro plan ${macroRecord.id} (explicit --plan-id).`
      : `Loaded latest macro plan ${macroRecord.id} for user ${userId}.`,
  );

  const macroPlan = macroRecord.plan;

  if (targetWeekIndex >= macroPlan.weeks.length) {
    await app.close();
    throw new Error(
      `--week-index=${targetWeekIndex} out of range (macro plan has ${macroPlan.weeks.length} weeks).`,
    );
  }

  const targetWeek = macroPlan.weeks[targetWeekIndex];
  console.log(
    `Target week: index ${targetWeekIndex} → week ${targetWeek?.weekNumber} ` +
      `(${targetWeek?.weekStartDate}, ${targetWeek?.phase})`,
  );

  const profileRepo = app.get(AthleteProfileRepository);
  const athleteProfile = await loadProfile({
    fromPath: profilePath,
    fromDb: profilePath ? undefined : { userId, repo: profileRepo },
  });
  if (profilePath) {
    console.log(`Loaded athlete profile from ${profilePath}.`);
  } else {
    console.log(`Loaded athlete profile from DB for user ${userId}.`);
  }

  const service = app.get(Pass2GenerationService);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const ts = timestampForFilename();
  const detailPath = join(OUTPUT_DIR, `test-week-${ts}.json`);
  const rawPath = join(OUTPUT_DIR, `test-week-${ts}-raw.txt`);

  console.log(`Calling Pass 2 for week ${targetWeekIndex} (macroPlanId=${macroRecord.id})...`);

  let exitCode = 0;
  try {
    const result = await service.generateWeeklyDetail({
      macroPlanId: macroRecord.id,
      macroPlan,
      targetWeekIndex,
      athleteProfile,
      recentWorkouts,
    });
    writeFileSync(rawPath, result.rawResponse);
    writeFileSync(
      detailPath,
      JSON.stringify(
        {
          input: {
            macroPlanId: macroRecord.id,
            targetWeekIndex,
          },
          weeklyDetailId: result.weeklyDetailId,
          ...result.output,
        },
        null,
        2,
      ),
    );
    console.log(`Duration: ${result.durationMs}ms`);
    console.log(
      `Tokens — input: ${result.usage.inputTokens}, output: ${result.usage.outputTokens}`,
    );
    console.log(
      `Computed: hours=${result.output.computed.totalWeeklyHours}, ` +
        `TSS=${result.output.computed.totalWeeklyTss}`,
    );
    if (result.output.computed.deviationsFromPhaseExpected.length > 0) {
      console.log('Deviations flagged:');
      for (const d of result.output.computed.deviationsFromPhaseExpected) console.log(`  - ${d}`);
    }
    console.log(
      `Persisted weekly detail ${result.weeklyDetailId} for week ${targetWeek?.weekNumber}.`,
    );
    console.log(`Detail written to: ${detailPath}`);
    console.log(`Raw response written to: ${rawPath}`);
  } catch (err) {
    if (err instanceof Pass2GenerationError) {
      if (err.rawResponse) {
        writeFileSync(rawPath, err.rawResponse);
        console.error(`Raw response written to: ${rawPath}`);
      }
      console.error(`Pass 2 generation failed: ${err.message}`);
      if (err.validationIssues) {
        const summary = err.validationIssues
          .slice(0, 10)
          .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
          .join('\n');
        console.error(`Schema issues (first 10):\n${summary}`);
      }
      if (err.constraintViolations) {
        const summary = err.constraintViolations
          .slice(0, 10)
          .map((v) => `  - ${v}`)
          .join('\n');
        console.error(`Constraint violations (first 10):\n${summary}`);
      }
      exitCode = 1;
    } else {
      console.error(`Unexpected error: ${err instanceof Error ? err.stack : String(err)}`);
      exitCode = 2;
    }
  } finally {
    await app.close();
  }

  process.exit(exitCode);
}

void main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
