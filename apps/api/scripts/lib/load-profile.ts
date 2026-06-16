import { readFileSync } from 'node:fs';
import { type AthleteProfile, athleteProfileSchema } from '@eta/shared-types';
import type { AthleteProfileRepository } from '../../src/db/repositories/athlete-profile.repository.js';

export interface LoadProfileArgs {
  /** If provided, load + validate from a JSON file. Overrides DB lookup. */
  fromPath?: string;
  /** Used when fromPath is absent. Looks up the latest profile in the DB. */
  fromDb?: { userId: string; repo: AthleteProfileRepository };
}

/**
 * Resolve an AthleteProfile for a CLI script. JSON path wins when present.
 * Throws with a user-actionable message when no DB profile exists and no
 * --profile path was provided.
 */
export async function loadProfile(args: LoadProfileArgs): Promise<AthleteProfile> {
  if (args.fromPath) {
    const raw = readFileSync(args.fromPath, 'utf-8');
    const json = JSON.parse(raw) as unknown;
    const parsed = athleteProfileSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error(
        `Profile at ${args.fromPath} failed schema validation: ${parsed.error.message}`,
      );
    }
    return parsed.data;
  }
  if (!args.fromDb) {
    throw new Error('loadProfile: no fromPath and no fromDb provided');
  }
  const profile = await args.fromDb.repo.findByUserId(args.fromDb.userId);
  if (!profile) {
    throw new Error(
      `No profile in DB for ${args.fromDb.userId}. ` +
        `Run \`pnpm seed:profile\` first, or pass --profile=<path>.`,
    );
  }
  return profile;
}
