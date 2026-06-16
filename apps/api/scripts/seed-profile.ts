/* eslint-disable no-console */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../src/app.module.js';
import type { Env } from '../src/config/env.schema.js';
import { AthleteProfileService } from '../src/modules/athlete-profile/athlete-profile.service.js';
import { StravaRenormalizeService } from '../src/modules/integrations/strava/strava-renormalize.service.js';
import { loadProfile } from './lib/load-profile.js';

const HERE = fileURLToPath(new URL('.', import.meta.url));
const DEFAULT_PROFILE_PATH = resolve(HERE, 'test-profile.json');

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: false });
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const service = app.get(AthleteProfileService);
  const renormalize = app.get(StravaRenormalizeService);

  const userArg = process.argv.find((a) => a.startsWith('--user='));
  const userId = userArg ? (userArg.split('=')[1] as string) : config.get('DEV_USER_ID', { infer: true });

  const profileArg = process.argv.find((a) => a.startsWith('--profile='));
  const profilePath = profileArg ? (profileArg.split('=')[1] as string) : DEFAULT_PROFILE_PATH;

  console.log(`Seeding profile for user ${userId} from ${profilePath}...`);
  const profile = await loadProfile({ fromPath: profilePath });

  const record = await service.create({ userId, profile });
  console.log(`Created profile ${record.id} (generatedAt=${record.generatedAt.toISOString()}).`);

  // Synchronous renormalise — we want the summary in the CLI output, not
  // fire-and-forget like the HTTP path. Also blocks until done so the script
  // exits with a complete picture.
  const result = await renormalize.run(userId);
  console.log(`Renormalize result: ${JSON.stringify(result, null, 2)}`);

  await app.close();
}

void main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
