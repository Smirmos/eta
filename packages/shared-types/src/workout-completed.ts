// WorkoutCompleted — canonical record of a scheduled workout's outcome.
// Consumed by Pass 3 to reason about adherence, RPE drift, and TSS deviation.

import type { Discipline } from './athlete-profile.js';
import type { WorkoutCode } from './workout-codes.js';

export type CompletionStatus = 'completed' | 'partial' | 'skipped';

export interface WorkoutCompleted {
  // ─── Identity ──────────────────────────────────────────────────────────
  /** ISO date "YYYY-MM-DD" the workout was scheduled for. */
  date: string;
  workoutCode: WorkoutCode;

  // ─── Subjective + outcome (stub fields, preserved) ─────────────────────
  actualTss?: number;
  /** Borg-style RPE, 1–10. */
  perceivedExertion?: number;
  notes?: string;

  // ─── Planned-vs-actual signal (new, for Pass 3) ────────────────────────
  /** Redundant with the prefix of `workoutCode` but mirrors KeySession / PlannedWorkout. */
  discipline?: Discipline;
  completionStatus?: CompletionStatus;
  plannedDurationSeconds?: number;
  /** Expected to be undefined or 0 when completionStatus is 'skipped'. */
  actualDurationSeconds?: number;
  plannedTss?: number;
}
