/* eslint-disable no-console */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { AthleteProfile } from '@eta/shared-types';
import { AppModule } from '../src/app.module.js';
import type { Env } from '../src/config/env.schema.js';
import { AthleteProfileRepository } from '../src/db/repositories/athlete-profile.repository.js';
import { AthleteProfileService } from '../src/modules/athlete-profile/athlete-profile.service.js';
import {
  PlanGenerationError,
  PlanGenerationService,
} from '../src/modules/plan-generation/plan-generation.service.js';
import { loadProfile } from './lib/load-profile.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(HERE, 'output');

function timestampForFilename(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

// Optional CLI arg: --profile=<path>. Defaults to DB-loaded profile for
// DEV_USER_ID. Synthetic 5-day fixture lives at scripts/test-profile-5day.json
// — see its README for context.
function resolveProfilePath(): string | undefined {
  const arg = process.argv.find((a) => a.startsWith('--profile='));
  if (!arg) return undefined;
  const value = arg.split('=')[1] ?? '';
  return resolve(process.cwd(), value);
}

// Optional CLI arg: --user=<uuid>. Defaults to DEV_USER_ID from config.
function resolveUserIdArg(): string | undefined {
  const arg = process.argv.find((a) => a.startsWith('--user='));
  if (!arg) return undefined;
  return arg.split('=')[1] ?? undefined;
}

async function main(): Promise<void> {
  const PROFILE_PATH = resolveProfilePath();
  const USER_ID_ARG = resolveUserIdArg();
  console.log(`Profile: ${PROFILE_PATH ?? '(DB lookup for DEV_USER_ID)'}`);

  console.log(`Bootstrapping NestJS context...`);
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: false });
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const userId: string = USER_ID_ARG ?? config.get('DEV_USER_ID', { infer: true });

  // Resolve both `profile` and the DB-record id that will be the FK target on
  // the persisted macro plan. Two paths:
  //   --profile=<path>  → load + auto-seed via AthleteProfileService.create
  //   (no flag)         → fetch the latest record from the DB
  let athleteProfileId: string;
  let profile: AthleteProfile;

  if (PROFILE_PATH) {
    profile = await loadProfile({ fromPath: PROFILE_PATH });
    const profileService = app.get(AthleteProfileService);
    const record = await profileService.create({ userId, profile });
    athleteProfileId = record.id;
    console.log(`Auto-seeded profile ${record.id} from ${PROFILE_PATH}.`);
  } else {
    const profileRepo = app.get(AthleteProfileRepository);
    const record = await profileRepo.findLatestRecordForUser(userId);
    if (!record) {
      throw new Error(
        `No profile in DB for ${userId}. Run \`pnpm seed:profile\` first, or pass --profile=<path>.`,
      );
    }
    athleteProfileId = record.id;
    profile = record.profile;
    console.log(`Loaded profile ${record.id} from DB for user ${userId}.`);
  }

  const service = app.get(PlanGenerationService);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const ts = timestampForFilename();
  const planPath = join(OUTPUT_DIR, `test-plan-${ts}.json`);
  const rawPath = join(OUTPUT_DIR, `test-plan-${ts}-raw.txt`);

  const profileText = JSON.stringify(profile);
  const inputCharCount = profileText.length;
  console.log(`Profile loaded (${inputCharCount} chars serialized). Calling Anthropic API...`);

  let exitCode = 0;
  try {
    const result = await service.generateMacroPlan(profile, athleteProfileId, userId);
    writeFileSync(rawPath, result.rawResponse);
    writeFileSync(planPath, JSON.stringify(result.plan, null, 2));
    console.log(`Persisted macro plan ${result.macroPlanId}.`);
    console.log(`Validation: PASS, weeks: ${result.plan.totalWeeks}`);
    console.log(`Duration: ${result.durationMs}ms`);
    console.log(
      `Tokens — input: ${result.usage.inputTokens}, output: ${result.usage.outputTokens}, ` +
        `cache_creation: ${result.usage.cacheCreationInputTokens}, ` +
        `cache_read: ${result.usage.cacheReadInputTokens}`,
    );
    console.log(`Approx. input chars (script-side estimate, /4 ≈ tokens): ${inputCharCount} chars`);
    console.log(`Plan written to: ${planPath}`);
    console.log(`Raw response written to: ${rawPath}`);
  } catch (err) {
    if (err instanceof PlanGenerationError) {
      if (err.rawResponse) {
        writeFileSync(rawPath, err.rawResponse);
        console.error(`Raw response written to: ${rawPath}`);
      }
      console.error(`Validation: FAIL — ${err.message}`);
      if (err.validationIssues) {
        const summary = err.validationIssues
          .slice(0, 10)
          .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
          .join('\n');
        console.error(`Issues (first 10):\n${summary}`);
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
