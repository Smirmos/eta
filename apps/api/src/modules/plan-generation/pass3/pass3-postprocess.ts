import type {
  AdaptationSuggestion,
  AthleteProfile,
  DayOfWeek,
  WeeklyDetail,
  WorkoutAdjustment,
} from '@eta/shared-types';
import { isLongSessionWorkout } from '../plan-generation.service.js';
import type { Pass3ComputedInputs } from './types.js';

const MS_PER_DAY = 86_400_000;

const DAY_BY_INDEX: ReadonlyArray<DayOfWeek> = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
];

function dayOfWeekFromIso(iso: string): DayOfWeek {
  const jsDay = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return DAY_BY_INDEX[(jsDay + 6) % 7] as DayOfWeek;
}

function isoDateInWeek(weekStartDate: string, iso: string): boolean {
  const startMs = new Date(`${weekStartDate}T00:00:00Z`).getTime();
  const isoMs = new Date(`${iso}T00:00:00Z`).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(isoMs)) return false;
  const delta = isoMs - startMs;
  return delta >= 0 && delta < 7 * MS_PER_DAY;
}

// ─── Constraint validation ──────────────────────────────────────────────────

export class Pass3ConstraintError extends Error {
  readonly violations: string[];
  constructor(violations: string[]) {
    super(`Pass 3 constraint violations (${violations.length})`);
    this.name = 'Pass3ConstraintError';
    this.violations = violations;
  }
}

export interface ValidatePass3SuggestionInput {
  suggestion: AdaptationSuggestion;
  weeklyDraft: WeeklyDetail;
  athleteProfile: AthleteProfile;
}

/**
 * Semantic validation that runs after Zod schema parse. Catches anything the
 * structural schema can't express: coverage, ordering, intra-week date
 * placement, post-adjustment Friel constraints.
 *
 * Throws Pass3ConstraintError with a flat list of human-readable violations.
 */
export function validatePass3Suggestion(input: ValidatePass3SuggestionInput): void {
  const { suggestion, weeklyDraft, athleteProfile } = input;
  const violations: string[] = [];

  // 1. forWeekStart matches the draft.
  if (suggestion.forWeekStart !== weeklyDraft.weekStartDate) {
    violations.push(
      `forWeekStart mismatch: suggestion=${suggestion.forWeekStart}, draft=${weeklyDraft.weekStartDate}`,
    );
  }

  // 2. Coverage: every draft workout has exactly one adjustment, matched by
  //    (originalDate, originalWorkoutCode). No extras.
  const draftKeys = new Map<string, { date: string; code: string }>();
  for (const wo of weeklyDraft.workouts) {
    draftKeys.set(`${wo.date}|${wo.workoutCode}`, { date: wo.date, code: wo.workoutCode });
  }
  const adjKeyCounts = new Map<string, number>();
  for (const adj of suggestion.adjustments) {
    const k = `${adj.originalDate}|${adj.originalWorkoutCode}`;
    adjKeyCounts.set(k, (adjKeyCounts.get(k) ?? 0) + 1);
  }
  for (const [k, v] of draftKeys) {
    const n = adjKeyCounts.get(k) ?? 0;
    if (n === 0) {
      violations.push(`Missing adjustment for ${v.code} on ${v.date}`);
    } else if (n > 1) {
      violations.push(`Duplicate adjustments for ${v.code} on ${v.date} (count=${n})`);
    }
  }
  for (const adj of suggestion.adjustments) {
    const k = `${adj.originalDate}|${adj.originalWorkoutCode}`;
    if (!draftKeys.has(k)) {
      violations.push(
        `Extra adjustment for ${adj.originalWorkoutCode} on ${adj.originalDate} — no matching draft workout`,
      );
    }
  }

  // 3. Ordering: adjustments ascending by originalDate. Ties allowed (multiple
  //    workouts same day) — break ties on originalWorkoutCode.
  for (let i = 1; i < suggestion.adjustments.length; i++) {
    const prev = suggestion.adjustments[i - 1] as WorkoutAdjustment;
    const curr = suggestion.adjustments[i] as WorkoutAdjustment;
    const prevKey = `${prev.originalDate}|${prev.originalWorkoutCode}`;
    const currKey = `${curr.originalDate}|${curr.originalWorkoutCode}`;
    if (currKey < prevKey) {
      violations.push(
        `adjustments[${i}] out of order: ${curr.originalDate}/${curr.originalWorkoutCode} after ${prev.originalDate}/${prev.originalWorkoutCode}`,
      );
    }
  }

  // 4. Per-adjustment placement (post-adjustment day, code, profile constraints).
  for (let i = 0; i < suggestion.adjustments.length; i++) {
    const adj = suggestion.adjustments[i] as WorkoutAdjustment;
    const effectiveDate = adj.newDate ?? adj.originalDate;
    const effectiveCode = adj.action === 'replace' ? adj.newWorkoutCode ?? adj.originalWorkoutCode : adj.originalWorkoutCode;

    // newDate must fall inside the upcoming week.
    if (adj.newDate !== undefined && !isoDateInWeek(weeklyDraft.weekStartDate, adj.newDate)) {
      violations.push(
        `adjustments[${i}] (${adj.originalWorkoutCode} on ${adj.originalDate}): newDate ${adj.newDate} falls outside the week starting ${weeklyDraft.weekStartDate}`,
      );
    }

    const effectiveDay = dayOfWeekFromIso(effectiveDate);

    if (athleteProfile.mandatoryRestDays.includes(effectiveDay)) {
      violations.push(
        `adjustments[${i}] (${effectiveCode} on ${effectiveDate}): ${effectiveDay} is a mandatoryRestDay`,
      );
    }

    if (isLongSessionWorkout(effectiveCode) && !athleteProfile.longSessionDays.includes(effectiveDay)) {
      violations.push(
        `adjustments[${i}] (${effectiveCode} on ${effectiveDate}): long-session code on ${effectiveDay}, not in longSessionDays=[${athleteProfile.longSessionDays.join(', ')}]`,
      );
    }
  }

  if (violations.length > 0) {
    throw new Pass3ConstraintError(violations);
  }
}

// ─── Echo-input reconciliation ───────────────────────────────────────────────

const ECHO_REL_TOLERANCE = 0.01; // 1% drift before we consider it suspicious

/**
 * Replace the LLM-emitted `inputs` with the authoritative computed values.
 * Returns a list of fields where the LLM's echo drifted by more than 1% from
 * the computed value (caller logs as warnings — not fatal, since we overwrite).
 */
export function reconcileComputedInputs(input: {
  suggestion: AdaptationSuggestion;
  computed: Pass3ComputedInputs;
}): { suggestion: AdaptationSuggestion; driftedFields: string[] } {
  const { suggestion, computed } = input;
  const driftedFields: string[] = [];

  const check = (field: keyof Pass3ComputedInputs): void => {
    const llm = suggestion.inputs[field];
    const ours = computed[field];
    if (ours === 0) {
      if (Math.abs(llm) > 0.001) driftedFields.push(`${field}: llm=${llm}, ours=0`);
      return;
    }
    const rel = Math.abs(llm - ours) / Math.abs(ours);
    if (rel > ECHO_REL_TOLERANCE) {
      driftedFields.push(`${field}: llm=${llm}, ours=${ours} (${(rel * 100).toFixed(1)}% drift)`);
    }
  };
  check('lastWeekTss');
  check('currentCtl');
  check('currentAtl');
  check('currentTsb');
  check('avgReadinessLast7d');

  const reconciled: AdaptationSuggestion = {
    ...suggestion,
    inputs: {
      lastWeekTss: computed.lastWeekTss,
      currentCtl: computed.currentCtl,
      currentAtl: computed.currentAtl,
      currentTsb: computed.currentTsb,
      avgReadinessLast7d: computed.avgReadinessLast7d,
    },
  };

  return { suggestion: reconciled, driftedFields };
}

// ─── Source extraction ──────────────────────────────────────────────────────

export function extractAppliedSources(suggestion: AdaptationSuggestion): string[] {
  const set = new Set<string>();
  for (const adj of suggestion.adjustments) set.add(adj.citation);
  return [...set].sort();
}
