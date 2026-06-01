/* eslint-disable no-console */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module.js';
import {
  PASS3_SCENARIO_NAMES,
  pass3Scenarios,
  type Pass3ScenarioName,
} from '../src/modules/plan-generation/pass3/fixtures/scenarios.js';
import {
  Pass3GenerationError,
  Pass3GenerationService,
} from '../src/modules/plan-generation/pass3/pass3.service.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(HERE, 'output');

function timestampForFilename(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function parseScenario(): Pass3ScenarioName {
  // CLI: pnpm generate:test-adaptation -- --scenario=missed-long-ride
  const arg = process.argv.find((a) => a.startsWith('--scenario='));
  const value = arg ? (arg.split('=')[1] as string) : 'perfect-week';
  if (!PASS3_SCENARIO_NAMES.includes(value as Pass3ScenarioName)) {
    throw new Error(
      `Invalid --scenario value: ${value}. Choose one of: ${PASS3_SCENARIO_NAMES.join(', ')}`,
    );
  }
  return value as Pass3ScenarioName;
}

async function main(): Promise<void> {
  const scenario = parseScenario();
  const input = pass3Scenarios[scenario]();

  console.log(`Scenario: ${scenario}`);
  console.log(
    `Upcoming week: ${input.weeklyDraft.weekStartDate} (${input.weeklyDraft.phase}, ` +
      `${input.weeklyDraft.workouts.length} workouts)`,
  );
  console.log(
    `Inputs: completedLastWeek=${input.completedLastWeek.length} entries, ` +
      `readinessHistory=${input.readinessHistory.length} day(s), ` +
      `seed=${input.seedDailyTss?.length ?? 0} days`,
  );

  console.log('Bootstrapping NestJS context...');
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: false });
  const service = app.get(Pass3GenerationService);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const ts = timestampForFilename();
  const outPath = join(OUTPUT_DIR, `test-adaptation-${scenario}-${ts}.json`);
  const rawPath = join(OUTPUT_DIR, `test-adaptation-${scenario}-${ts}-raw.txt`);

  console.log('Calling Anthropic API...');

  let exitCode = 0;
  try {
    const result = await service.generateAdaptation(input);
    writeFileSync(rawPath, result.rawResponse);
    writeFileSync(
      outPath,
      JSON.stringify(
        {
          scenario,
          ...result.output,
        },
        null,
        2,
      ),
    );
    console.log(`Duration: ${result.durationMs}ms`);
    console.log(
      `Tokens — input: ${result.usage.inputTokens}, output: ${result.usage.outputTokens}, ` +
        `cache create: ${result.usage.cacheCreationInputTokens}, ` +
        `cache read: ${result.usage.cacheReadInputTokens}`,
    );
    console.log(
      `Computed: lastWeekTss=${result.output.computed.lastWeekTss.toFixed(0)}, ` +
        `CTL=${result.output.computed.currentCtl.toFixed(1)}, ` +
        `ATL=${result.output.computed.currentAtl.toFixed(1)}, ` +
        `TSB=${result.output.computed.currentTsb.toFixed(1)}, ` +
        `readiness=${result.output.computed.avgReadinessLast7d}`,
    );
    const actions = result.output.suggestion.adjustments.reduce<Record<string, number>>(
      (acc, a) => {
        acc[a.action] = (acc[a.action] ?? 0) + 1;
        return acc;
      },
      {},
    );
    console.log(`Adjustments: ${JSON.stringify(actions)}`);
    console.log(
      `Hard rules: ${result.output.hardRulesApplied.length} firing(s), ` +
        `${result.output.hardRuleOutput.forcedAdjustments.length} forced adjustment(s)`,
    );
    if (result.output.suggestion.weekLevelNote !== undefined) {
      console.log(`Week-level note: ${result.output.suggestion.weekLevelNote}`);
    }
    console.log(`Output written to: ${outPath}`);
    console.log(`Raw response written to: ${rawPath}`);
  } catch (err) {
    if (err instanceof Pass3GenerationError) {
      if (err.rawResponse) {
        writeFileSync(rawPath, err.rawResponse);
        console.error(`Raw response written to: ${rawPath}`);
      }
      console.error(`Pass 3 generation failed: ${err.message}`);
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

void main();
