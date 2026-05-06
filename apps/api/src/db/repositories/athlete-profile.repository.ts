import { Inject, Injectable } from '@nestjs/common';
import {
  type AthleteProfile,
  type ConfidenceLevel,
  type ProfileSource,
  athleteProfileSchema,
} from '@eta/shared-types';
import { desc, eq } from 'drizzle-orm';
import { DB, type Db } from '../db.module.js';
import { athleteProfiles } from '../schema/athlete-profile.js';

export interface AthleteProfileRecord {
  id: string;
  userId: string;
  profile: AthleteProfile;
  source: ProfileSource;
  overallConfidence: ConfidenceLevel;
  generatedAt: Date;
  updatedAt: Date;
}

export interface CreateAthleteProfileInput {
  // SPEC NOTE: The Confluence schema does NOT include userId on AthleteProfile itself.
  // The original ETA-13 prompt named the create signature as `create(profile)`, but
  // userId has to come from somewhere — we accept it explicitly here. Flagged for
  // confluence sync.
  userId: string;
  profile: AthleteProfile;
}

@Injectable()
export class AthleteProfileRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  async create(input: CreateAthleteProfileInput): Promise<AthleteProfileRecord> {
    const [row] = await this.db
      .insert(athleteProfiles)
      .values({
        userId: input.userId,
        data: input.profile,
        source: input.profile.source,
        overallConfidence: input.profile.overallConfidence,
      })
      .returning();

    if (!row) {
      throw new Error('Insert into athlete_profiles returned no row');
    }

    return rowToRecord(row);
  }

  async findById(id: string): Promise<AthleteProfile | null> {
    const rows = await this.db
      .select()
      .from(athleteProfiles)
      .where(eq(athleteProfiles.id, id))
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    return parseProfile(row.data, `athlete_profiles.id=${id}`);
  }

  async findByUserId(userId: string): Promise<AthleteProfile | null> {
    const rows = await this.db
      .select()
      .from(athleteProfiles)
      .where(eq(athleteProfiles.userId, userId))
      .orderBy(desc(athleteProfiles.generatedAt))
      .limit(1);

    const row = rows[0];
    if (!row) return null;
    return parseProfile(row.data, `athlete_profiles.userId=${userId}`);
  }
}

/**
 * Validate a JSONB-deserialized AthleteProfile.
 *
 * JSONB roundtrip stringifies Date instances; this helper coerces them back via
 * `athleteProfileSchema` (which uses z.coerce.date() throughout). On failure,
 * throws an Error that includes the locator so the bad row is identifiable.
 */
export function parseProfile(data: unknown, locator: string): AthleteProfile {
  const parsed = athleteProfileSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      `Failed to parse AthleteProfile from JSONB at ${locator}: ${parsed.error.message}`,
    );
  }
  return parsed.data;
}

function rowToRecord(row: typeof athleteProfiles.$inferSelect): AthleteProfileRecord {
  return {
    id: row.id,
    userId: row.userId,
    profile: parseProfile(row.data, `athlete_profiles.id=${row.id}`),
    source: row.source,
    overallConfidence: row.overallConfidence,
    generatedAt: row.generatedAt,
    updatedAt: row.updatedAt,
  };
}
