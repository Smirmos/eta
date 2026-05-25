import type {
  AthleteProfile,
  DayOfWeek,
  Discipline,
  MacroPlan,
  WeeklyDetail,
  WorkoutCode,
} from '@eta/shared-types';

// Minimum shape Pass 2 needs to ground rationale text in actual recent work.
// TODO(ETA-32): replace with the canonical WorkoutCompleted schema from
// @eta/shared-types once ETA-32 lands. Whatever ETA-32 produces will be a
// superset; the rename will be a one-line import change.
export interface RecentWorkoutSnapshot {
  date: string;
  workoutCode: WorkoutCode;
  actualTss?: number;
  perceivedExertion?: number;
  notes?: string;
}

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
  recentWorkouts: RecentWorkoutSnapshot[];
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
