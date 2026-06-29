import type { Discipline } from './athlete-profile.js';

export type TrendDirection = 'building' | 'steady' | 'tapering';

export interface SportSplitEntry {
  discipline: Discipline;
  sessions: number;
  hours: number;
  pctHours: number;
}

export interface WeekBucket {
  /** Earliest ISO date of the 7-day bucket. */
  weekStart: string;
  sessions: number;
  hours: number;
  byDiscipline: Partial<Record<Discipline, { sessions: number; hours: number }>>;
  /** Sum of actualTss over bike sessions that have it; null if none. */
  bikeTss: number | null;
}

export interface LongestSession {
  discipline: Discipline;
  date: string;
  minutes: number;
}

export interface TrainingAnalysis {
  hasData: boolean;
  /** null when there is no training data. */
  window: { from: string; asOf: string } | null;
  overall: {
    totalSessions: number;
    totalHours: number;
    trainingDays: number;
    avgSessionsPerWeek: number;
    avgTrainingDaysPerWeek: number;
    sportSplit: SportSplitEntry[];
  };
  /** Oldest -> newest, up to 4 buckets. */
  perWeek: WeekBucket[];
  trend: TrendDirection;
  longestSessions: LongestSession[];
  dataNote: { tssCoverage: 'bike_only'; staleDays: number };
}

export interface TrainingAnalysisResponse extends TrainingAnalysis {
  narrative: string | null;
}
