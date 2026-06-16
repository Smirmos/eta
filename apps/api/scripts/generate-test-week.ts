/* eslint-disable no-console */
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import {
  macroPlanSchema,
  type MacroPlan,
  type WorkoutCompleted,
} from '@eta/shared-types';
import { AppModule } from '../src/app.module.js';
import type { Env } from '../src/config/env.schema.js';
import { AthleteProfileRepository } from '../src/db/repositories/athlete-profile.repository.js';
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

function locateLatestMacroPlan(): string {
  const entries = readdirSync(OUTPUT_DIR)
    .filter((f) => f.startsWith('test-plan-') && f.endsWith('.json'))
    .map((f) => ({ path: join(OUTPUT_DIR, f), mtime: statSync(join(OUTPUT_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  if (entries.length === 0) throw new Error(`No test-plan-*.json found in ${OUTPUT_DIR}`);
  return (entries[0] as { path: string }).path;
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
  const macroPath = locateLatestMacroPlan();
  const targetWeekIndex = parseTargetWeekIndex();

  const macroJson = JSON.parse(readFileSync(macroPath, 'utf8')) as unknown;
  const macroParsed = macroPlanSchema.safeParse(macroJson);
  if (!macroParsed.success) {
    console.error(`Macro plan at ${macroPath} failed schema validation.`);
    process.exit(1);
  }
  const macroPlan: MacroPlan = macroParsed.data;

  // --profile=<path> overrides; default is DB lookup for DEV_USER_ID.
  const profileArg = process.argv.find((a) => a.startsWith('--profile='));
  const profilePath = profileArg?.split('=')[1];

  // v1 single-user pre-Strava-sync: no real recent workouts.
  const recentWorkouts: WorkoutCompleted[] = [];

  console.log(`Macro plan: ${macroPath}`);
  console.log(
    `Target week: index ${targetWeekIndex} → week ${macroPlan.weeks[targetWeekIndex]?.weekNumber} ` +
      `(${macroPlan.weeks[targetWeekIndex]?.weekStartDate}, ${macroPlan.weeks[targetWeekIndex]?.phase})`,
  );
  console.log('Bootstrapping NestJS context...');
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: false });
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const repo = app.get(AthleteProfileRepository);
  const userId = config.get('DEV_USER_ID', { infer: true });

  const athleteProfile = await loadProfile({
    fromPath: profilePath,
    fromDb: profilePath ? undefined : { userId, repo },
  });
  const service = app.get(Pass2GenerationService);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const ts = timestampForFilename();
  const detailPath = join(OUTPUT_DIR, `test-week-${ts}.json`);
  const rawPath = join(OUTPUT_DIR, `test-week-${ts}-raw.txt`);

  console.log('Calling Anthropic API...');

  let exitCode = 0;
  try {
    const result = await service.generateWeeklyDetail({
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
            macroPlanPath: macroPath,
            targetWeekIndex,
          },
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
