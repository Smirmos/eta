/* eslint-disable no-console */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module.js';
import {
  PlanGenerationError,
  PlanGenerationService,
} from '../src/modules/plan-generation/plan-generation.service.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const PROFILE_PATH = resolve(HERE, 'test-profile.json');
const OUTPUT_DIR = resolve(HERE, 'output');
const PROFILE_ID = 'test-arkadiy-2026-08-22-tallinn';

function timestampForFilename(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function main(): Promise<void> {
  const profileText = readFileSync(PROFILE_PATH, 'utf8');
  const rawProfile = JSON.parse(profileText) as unknown;

  console.log(`Bootstrapping NestJS context...`);
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: false });
  const service = app.get(PlanGenerationService);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const ts = timestampForFilename();
  const planPath = join(OUTPUT_DIR, `test-plan-${ts}.json`);
  const rawPath = join(OUTPUT_DIR, `test-plan-${ts}-raw.txt`);

  const inputCharCount = profileText.length;
  console.log(`Profile loaded (${inputCharCount} chars from JSON file). Calling Anthropic API...`);

  let exitCode = 0;
  try {
    const result = await service.generateMacroPlan(rawProfile, PROFILE_ID);
    writeFileSync(rawPath, result.rawResponse);
    writeFileSync(planPath, JSON.stringify(result.plan, null, 2));
    console.log(`Validation: PASS, weeks: ${result.plan.totalWeeks}`);
    console.log(`Duration: ${result.durationMs}ms`);
    console.log(
      `Tokens — input: ${result.usage.inputTokens}, output: ${result.usage.outputTokens}`,
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

void main();
