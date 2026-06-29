import { Injectable } from '@nestjs/common';
import type { AdaptationSuggestion, MacroPlan, MacroPlanWeek, WeeklyDetail } from '@eta/shared-types';
import { AdaptationsRepository } from '../../db/repositories/adaptations.repository.js';
import {
  MacroPlansRepository,
  type MacroPlanRecord,
} from '../../db/repositories/macro-plans.repository.js';
import { WeeklyDetailsRepository } from '../../db/repositories/weekly-details.repository.js';

export interface PlanTreeWeek {
  weekNumber: number;
  macroWeek: MacroPlanWeek;
  weeklyDetail: WeeklyDetail | null;
}

export interface PlanTree {
  macroPlanId: string;
  athleteProfileId: string;
  macroPlan: MacroPlan;
  generatedAt: Date;
  weeks: PlanTreeWeek[];
  currentAdaptation: AdaptationSuggestion | null;
}

@Injectable()
export class PlansService {
  constructor(
    private readonly macroRepo: MacroPlansRepository,
    private readonly weeklyRepo: WeeklyDetailsRepository,
    private readonly adaptationsRepo: AdaptationsRepository,
  ) {}

  async getLatestTreeForUser(userId: string): Promise<PlanTree | null> {
    const record = await this.macroRepo.findLatestForUser(userId);
    if (!record) return null;
    return this.buildTree(record);
  }

  async getTreeById(id: string): Promise<PlanTree | null> {
    const record = await this.macroRepo.findById(id);
    if (!record) return null;
    return this.buildTree(record);
  }

  private async buildTree(record: MacroPlanRecord): Promise<PlanTree> {
    const weeklyMap = await this.weeklyRepo.findLatestForMacroPlan(record.id);

    const currentWeekStart = currentWeekStartDate(record.plan, new Date());
    const adaptationRecord =
      currentWeekStart !== null
        ? await this.adaptationsRepo.findLatestForWeek(record.id, currentWeekStart)
        : null;

    return {
      macroPlanId: record.id,
      athleteProfileId: record.athleteProfileId,
      macroPlan: record.plan,
      generatedAt: record.generatedAt,
      weeks: record.plan.weeks.map((w) => ({
        weekNumber: w.weekNumber,
        macroWeek: w,
        weeklyDetail: weeklyMap.get(w.weekNumber) ?? null,
      })),
      currentAdaptation: adaptationRecord?.suggestion ?? null,
    };
  }
}

/**
 * Find the macro plan week that contains today's date (or the last week if
 * today is past the race). Returns the weekStartDate as an ISO string, or
 * null if the plan has no weeks.
 *
 * Treats dates in UTC for simplicity — race-day timezone awareness is out of
 * scope for v1.
 */
export function currentWeekStartDate(plan: MacroPlan, today: Date): string | null {
  if (plan.weeks.length === 0) return null;
  const todayIso = today.toISOString().slice(0, 10);
  const todayMs = Date.parse(todayIso + 'T00:00:00Z');
  for (const week of plan.weeks) {
    const startMs = Date.parse(week.weekStartDate + 'T00:00:00Z');
    const endMs = startMs + 7 * 86_400_000;
    if (todayMs >= startMs && todayMs < endMs) {
      return week.weekStartDate;
    }
  }
  // Past race or before plan start — return the last week's start
  return plan.weeks[plan.weeks.length - 1]!.weekStartDate;
}
