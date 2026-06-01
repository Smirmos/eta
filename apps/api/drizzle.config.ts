import 'dotenv/config';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

// `drizzle-kit migrate` and `drizzle-kit studio` connect — they need DATABASE_URL.
// `drizzle-kit generate` reads schema files only (no connection).
// We load the workspace-root .env so commands work from `apps/api/` without
// requiring the user to source the env manually.
loadEnv({ path: '../../.env' });

const url =
  process.env.DATABASE_URL ?? 'postgres://placeholder:placeholder@localhost:5432/placeholder';

export default defineConfig({
  // Point at concrete schema files (NOT the index.ts re-export — drizzle-kit's
  // CJS loader can't follow the explicit `.js` extensions our ESM TS source uses).
  // When new schema files land, add their paths to this array.
  schema: [
    './src/db/schema/athlete-profile.ts',
    './src/db/schema/oauth-credentials.ts',
    './src/db/schema/workouts-completed.ts',
  ],
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
