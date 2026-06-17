import { Injectable } from '@nestjs/common';
import type { MacroPlan, MacroPlanWeek, WeeklyDetail } from '@eta/shared-types';
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
}

@Injectable()
export class PlansService {
  constructor(
    private readonly macroRepo: MacroPlansRepository,
    private readonly weeklyRepo: WeeklyDetailsRepository,
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
    };
  }
}
