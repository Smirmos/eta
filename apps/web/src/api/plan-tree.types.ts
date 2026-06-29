import type {
  AdaptationSuggestion,
  MacroPlan,
  MacroPlanWeek,
  WeeklyDetail,
} from '@eta/shared-types';

export interface PlanTreeWeek {
  weekNumber: number;
  macroWeek: MacroPlanWeek;
  weeklyDetail: WeeklyDetail | null;
}

export interface PlanTree {
  macroPlanId: string;
  athleteProfileId: string;
  macroPlan: MacroPlan;
  /** ISO date-time string as received over HTTP. */
  generatedAt: string;
  weeks: PlanTreeWeek[];
  currentAdaptation: AdaptationSuggestion | null;
}
