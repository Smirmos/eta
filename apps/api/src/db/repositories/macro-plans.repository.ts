import { Inject, Injectable } from '@nestjs/common';
import { type MacroPlan, macroPlanSchema } from '@eta/shared-types';
import { desc, eq } from 'drizzle-orm';
import { DB, type Db } from '../db.module.js';
import { macroPlans } from '../schema/macro-plans.js';

export interface MacroPlanRecord {
  id: string;
  userId: string;
  athleteProfileId: string;
  plan: MacroPlan;
  generatedAt: Date;
  updatedAt: Date;
}

export interface CreateMacroPlanInput {
  userId: string;
  athleteProfileId: string;
  plan: MacroPlan;
}

@Injectable()
export class MacroPlansRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  async create(input: CreateMacroPlanInput): Promise<MacroPlanRecord> {
    const [row] = await this.db
      .insert(macroPlans)
      .values({
        userId: input.userId,
        athleteProfileId: input.athleteProfileId,
        raceDate: input.plan.raceDate,
        data: input.plan,
      })
      .returning();

    if (!row) throw new Error('Insert into macro_plans returned no row');
    return rowToRecord(row);
  }

  async findById(id: string): Promise<MacroPlanRecord | null> {
    const rows = await this.db
      .select()
      .from(macroPlans)
      .where(eq(macroPlans.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return rowToRecord(row);
  }

  async findLatestForUser(userId: string): Promise<MacroPlanRecord | null> {
    const rows = await this.db
      .select()
      .from(macroPlans)
      .where(eq(macroPlans.userId, userId))
      .orderBy(desc(macroPlans.generatedAt))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return rowToRecord(row);
  }
}

function rowToRecord(row: typeof macroPlans.$inferSelect): MacroPlanRecord {
  const parsed = macroPlanSchema.safeParse(row.data);
  if (!parsed.success) {
    throw new Error(
      `Failed to parse MacroPlan from JSONB at macro_plans.id=${row.id}: ${parsed.error.message}`,
    );
  }
  return {
    id: row.id,
    userId: row.userId,
    athleteProfileId: row.athleteProfileId,
    plan: parsed.data,
    generatedAt: row.generatedAt,
    updatedAt: row.updatedAt,
  };
}
