import type {
  AthleteProfile,
  DayOfWeek,
  Discipline,
  MacroPlan,
  WeeklyDetail,
  WorkoutCompleted,
} from '@eta/shared-types';

export interface KbSlice {
  zones: string;
  atpStructurePhase: string;
  workoutsRelevant: string;
  weeklyTemplatesRules: string;
  recovery?: string;
  totalChars: number;
}

export interface Pass2Input {
  macroPlan: MacroPlan;
  targetWeekIndex: number;
  athleteProfile: AthleteProfile;
  recentWorkouts: WorkoutCompleted[];
}

export interface Pass2ComputedSummary {
  totalWeeklyHours: number;
  totalWeeklyTss: number;
  dailyTssDistribution: Record<DayOfWeek, number>;
  disciplineHours: Record<Discipline, number>;
  deviationsFromPhaseExpected: string[];
}

export interface Pass2Output {
  weeklyDetail: WeeklyDetail;
  computed: Pass2ComputedSummary;
  appliedSources: string[];
}
