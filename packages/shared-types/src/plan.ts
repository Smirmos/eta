// Plan output schemas — the contract that LLM-generated plans must satisfy.
// Validators in plan.schema.ts are the runtime gate; these interfaces are the
// single source of truth for downstream consumers.

import type { Discipline } from './athlete-profile.js';
import type { WorkoutCode } from './workout-codes.js';

// ─── Phase ordering ──────────────────────────────────────────────────────────

export type Phase =
  | 'prep'
  | 'base_1'
  | 'base_2'
  | 'base_3'
  | 'build_1'
  | 'build_2'
  | 'peak'
  | 'race_week'
  | 'transition';

// ─── MacroPlan (Pass 1) ──────────────────────────────────────────────────────

export interface KeySession {
  workoutCode: WorkoutCode;
  discipline: Discipline;
  /** 1–2 sentences, plain language. */
  rationale: string;
  /** KB reference, e.g. "knowledge-base/02-atp-structure.md#base-3". */
  citation: string;
}

export interface MacroPlanWeek {
  /** 1 = race week; counts back from the race. */
  weekNumber: number;
  /** ISO date "YYYY-MM-DD" for Monday of this week. */
  weekStartDate: string;
  phase: Phase;
  isRecoveryWeek: boolean;
  weeklyVolumeHours: number;
  keySessions: KeySession[];
  notes?: string;
  /** "[DEVIATION: reason]" entries the LLM emits when it diverges from KB guidance. */
  deviations?: string[];
}

export interface MacroPlan {
  athleteProfileId: string;
  /** ISO date. */
  raceDate: string;
  /** ISO timestamp. */
  generatedAt: string;
  totalWeeks: number;
  /** Sorted ascending by weekStartDate. */
  weeks: MacroPlanWeek[];
  globalNotes?: string;
}

// ─── WeeklyDetail (Pass 2) ───────────────────────────────────────────────────

export type IntensityZone = 'z1' | 'z2' | 'z3' | 'z4' | 'z5a' | 'z5b' | 'z5c';

export interface WorkoutSegment {
  /** "Warmup" | "Main set 1" | "Cooldown" | etc. */
  label: string;
  durationSeconds: number;
  zone: IntensityZone | 'mixed' | 'easy';
  description: string;
}

export interface PlannedWorkout {
  workoutCode: WorkoutCode;
  discipline: Discipline;
  /** ISO date this workout is scheduled for. */
  date: string;
  totalDurationSeconds: number;
  segments: WorkoutSegment[];
  /** Coach-voice "why this workout" explanation. */
  rationale: string;
  citation: string;
  /** Optional — the LLM may estimate, or code computes post-hoc. */
  expectedTss?: number;
}

export interface WeeklyDetail {
  weekNumber: number;
  weekStartDate: string;
  phase: Phase;
  workouts: PlannedWorkout[];
  /** Computed in code, not LLM. */
  weeklyTotalTss?: number;
  /** Computed in code, not LLM. */
  weeklyTotalHours?: number;
  globalNotes?: string;
}

// ─── AdaptationSuggestion (Pass 3) ───────────────────────────────────────────

export type AdaptationAction = 'keep' | 'modify' | 'replace';

export interface WorkoutAdjustment {
  originalDate: string;
  originalWorkoutCode: WorkoutCode;
  action: AdaptationAction;
  /** Required iff action='replace'. */
  newWorkoutCode?: WorkoutCode;
  /** Required iff action='modify'. */
  newDurationSeconds?: number;
  /** Optional for action='modify'. */
  newZone?: IntensityZone | 'mixed';
  /** Optional, for moving the workout to a different day. */
  newDate?: string;
  reasoning: string;
  citation: string;
}

export interface AdaptationSuggestion {
  forWeekStart: string;
  generatedAt: string;
  inputs: {
    lastWeekTss: number;
    currentCtl: number;
    currentAtl: number;
    currentTsb: number;
    avgReadinessLast7d: number;
  };
  adjustments: WorkoutAdjustment[];
  weekLevelNote?: string;
}
