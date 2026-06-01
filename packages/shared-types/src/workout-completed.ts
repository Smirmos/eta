// WorkoutCompleted — canonical record of a scheduled workout's outcome.
// Consumed by Pass 3 to reason about adherence, RPE drift, and TSS deviation.

import type { Discipline } from './athlete-profile.js';
import type { WorkoutCode } from './workout-codes.js';

export type CompletionStatus = 'completed' | 'partial' | 'skipped';

/**
 * 'computed' — actualTss came from training-load math against HR or power.
 * 'pending_inference' — TSS not yet computable (e.g., Strava activity ingested
 *   before AthleteProfile thresholds existed). Pass 3 treats these rows as
 *   present-but-untrusted; backfill recomputes once the profile lands.
 */
export type TssStatus = 'computed' | 'pending_inference';

export interface WorkoutCompleted {
  // ─── Identity ──────────────────────────────────────────────────────────
  /** ISO date "YYYY-MM-DD" the workout was scheduled for. */
  date: string;
  workoutCode: WorkoutCode;

  // ─── Subjective + outcome (stub fields, preserved) ─────────────────────
  actualTss?: number;
  /** Provenance of `actualTss`. Undefined ↔ actualTss undefined. */
  tssStatus?: TssStatus;
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
