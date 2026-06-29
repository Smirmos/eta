import { Inject, Injectable } from '@nestjs/common';
import { type WeeklyDetail, weeklyDetailSchema } from '@eta/shared-types';
import { sql } from 'drizzle-orm';
import { DB, type Db } from '../db.module.js';
import { weeklyDetails } from '../schema/weekly-details.js';

export interface WeeklyDetailRecord {
  id: string;
  macroPlanId: string;
  weekNumber: number;
  detail: WeeklyDetail;
  generatedAt: Date;
}

export interface CreateWeeklyDetailInput {
  macroPlanId: string;
  detail: WeeklyDetail;
}

@Injectable()
export class WeeklyDetailsRepository {
  constructor(@Inject(DB) private readonly db: Db) {}

  async create(input: CreateWeeklyDetailInput): Promise<WeeklyDetailRecord> {
    const [row] = await this.db
      .insert(weeklyDetails)
      .values({
        macroPlanId: input.macroPlanId,
        weekNumber: input.detail.weekNumber,
        weekStartDate: input.detail.weekStartDate,
        data: input.detail,
      })
      .returning();
    if (!row) throw new Error('Insert into weekly_details returned no row');
    return {
      id: row.id,
      macroPlanId: row.macroPlanId,
      weekNumber: row.weekNumber,
      detail: parseDetail(row.data, `weekly_details.id=${row.id}`),
      generatedAt: row.generatedAt,
    };
  }

  /**
   * Returns the latest WeeklyDetail per weekNumber for a given macro plan,
   * using DISTINCT ON (week_number) ordered by generated_at DESC.
   */
  async findLatestForMacroPlan(macroPlanId: string): Promise<Map<number, WeeklyDetail>> {
    const rows = await this.db.execute<{ id: string; week_number: number; data: unknown }>(sql`
      SELECT DISTINCT ON (week_number) id, week_number, data
      FROM weekly_details
      WHERE macro_plan_id = ${macroPlanId}
      ORDER BY week_number, generated_at DESC
    `);

    const out = new Map<number, WeeklyDetail>();
    for (const row of rows) {
      const detail = parseDetail(row.data, `weekly_details.id=${row.id}`);
      out.set(row.week_number, detail);
    }
    return out;
  }
}

function parseDetail(data: unknown, locator: string): WeeklyDetail {
  const parsed = weeklyDetailSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(`Failed to parse WeeklyDetail from JSONB at ${locator}: ${parsed.error.message}`);
  }
  return parsed.data;
}
