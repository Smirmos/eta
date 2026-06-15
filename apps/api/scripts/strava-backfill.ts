/* eslint-disable no-console */
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../src/app.module.js';
import type { Env } from '../src/config/env.schema.js';
import { StravaBackfillService } from '../src/modules/integrations/strava/strava-backfill.service.js';

// Manual 90-day backfill trigger. Useful for re-running after schema
// changes or for verifying idempotency (upsert on source+external_id
// means re-running does not duplicate rows).

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: false });
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const backfill = app.get(StravaBackfillService);

  const arg = process.argv.find((a) => a.startsWith('--user='));
  const userId = arg ? (arg.split('=')[1] as string) : config.get('DEV_USER_ID', { infer: true });

  console.log(`Running Strava backfill for user ${userId}...`);
  const result = await backfill.run(userId);
  console.log(`Done. ${JSON.stringify(result, null, 2)}`);
  await app.close();
}

void main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
