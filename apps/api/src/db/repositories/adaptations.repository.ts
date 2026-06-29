import { Inject, Injectable } from '@nestjs/common';
import { type AdaptationSuggestion, adaptationSuggestionSchema } from '@eta/shared-types';
import { sql } from 'drizzle-orm';
import { DB, type Db } from '../db.module.js';
import { adaptationSuggestions } from '../schema/adaptation-suggestions.js';

export interface AdaptationRecord {
  id: string;
  macroPlanId: string;
  forWeekStart: string;
  suggestion: AdaptationSuggestion;
  generatedAt: Date;
}

export interface CreateAdaptationInput {
  macroPlanId: string;
  forWeekStart: string;
  suggestion: AdaptationSuggestion;
}

@Injectable()
export class AdaptationsRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  async create(input: CreateAdaptationInput): Promise<AdaptationRecord> {
    const [row] = await this.db
      .insert(adaptationSuggestions)
      .values({
        macroPlanId: input.macroPlanId,
        forWeekStart: input.forWeekStart,
        data: input.suggestion,
      })
      .returning();
    if (!row) throw new Error('Insert into adaptation_suggestions returned no row');
    return rowToRecord(row);
  }

  async findLatestForWeek(macroPlanId: string, forWeekStart: string): Promise<AdaptationRecord | null> {
    const rows = await this.db.execute<{
      id: string;
      macro_plan_id: string;
      for_week_start: string;
      data: unknown;
      generated_at: Date;
    }>(sql`
      SELECT id, macro_plan_id, for_week_start, data, generated_at
      FROM adaptation_suggestions
      WHERE macro_plan_id = ${macroPlanId} AND for_week_start = ${forWeekStart}
      ORDER BY generated_at DESC
      LIMIT 1
    `);
    const row = rows[0];
    if (!row) return null;
    const parsed = adaptationSuggestionSchema.safeParse(row.data);
    if (!parsed.success) {
      throw new Error(
        `Failed to parse AdaptationSuggestion from JSONB at adaptation_suggestions.id=${row.id}: ${parsed.error.message}`,
      );
    }
    return {
      id: row.id,
      macroPlanId: row.macro_plan_id,
      forWeekStart: row.for_week_start,
      suggestion: parsed.data,
      generatedAt: row.generated_at,
    };
  }
}

function rowToRecord(row: typeof adaptationSuggestions.$inferSelect): AdaptationRecord {
  const parsed = adaptationSuggestionSchema.safeParse(row.data);
  if (!parsed.success) {
    throw new Error(
      `Failed to parse AdaptationSuggestion from JSONB at adaptation_suggestions.id=${row.id}: ${parsed.error.message}`,
    );
  }
  return {
    id: row.id,
    macroPlanId: row.macroPlanId,
    forWeekStart: row.forWeekStart,
    suggestion: parsed.data,
    generatedAt: row.generatedAt,
  };
}
