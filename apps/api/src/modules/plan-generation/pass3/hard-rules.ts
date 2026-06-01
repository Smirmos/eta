// ETA-21 hard-rules pre-pass. Deterministic, pure, <100 ms.
//
// Evaluates every workout in the upcoming weekly draft against:
//   - daily readiness bands (Oura/Whoop composite score)
//   - HRV thresholds (ETA-31 decision: % drop from rolling baseline)
//   - load thresholds (TSB)
//
// Outputs (a) HardRuleOutput consumed by Pass 3's prompt, and (b) the full
// appliedRules[] audit trail — including rules that fired but were
// suppressed by the severity ladder.

import type {
  DailyReadinessReading,
  Discipline,
  IntensityZone,
  PlannedWorkout,
  WeeklyDetail,
  WorkoutCode,
} from '@eta/shared-types';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env.schema.js';
import type { HardRuleAdjustment, HardRuleOutput, Pass3ComputedInputs } from './types.js';

const MS_PER_DAY = 86_400_000;

// ─── Config ──────────────────────────────────────────────────────────────────

export interface HardRulesConfig {
  hrvDropNotePct: number;
  hrvDropDowngradePct: number;
  hrvDropForcedRestPct: number;
  hrvStreakDropPct: number;
  hrvStreakDays: number;
  hrvRollingWindowDays: number;
  hrvDowngradeDurationRatio: number;
}

export function loadHardRulesConfig(config: ConfigService<Env, true>): HardRulesConfig {
  return {
    hrvDropNotePct: config.get('HRV_DROP_NOTE_PCT', { infer: true }),
    hrvDropDowngradePct: config.get('HRV_DROP_DOWNGRADE_PCT', { infer: true }),
    hrvDropForcedRestPct: config.get('HRV_DROP_FORCED_REST_PCT', { infer: true }),
    hrvStreakDropPct: config.get('HRV_STREAK_DROP_PCT', { infer: true }),
    hrvStreakDays: config.get('HRV_STREAK_DAYS', { infer: true }),
    hrvRollingWindowDays: config.get('HRV_ROLLING_WINDOW_DAYS', { infer: true }),
    hrvDowngradeDurationRatio: config.get('HRV_DOWNGRADE_DURATION_RATIO', { infer: true }),
  };
}

// ─── Audit-trail type ────────────────────────────────────────────────────────

export type RuleSeverity = 'note_only' | 'force_replace' | 'force_rest';

export interface AppliedRule {
  /** ISO date the rule was evaluated against. */
  date: string;
  /** Stable rule identifier (e.g. "readiness.red"). */
  ruleId: string;
  severity: RuleSeverity;
  /** Compact human-readable trigger value (e.g. "readiness=42", "hrv -14.2 %"). */
  triggerValue: string;
  /**
   * Final action carried out for this rule. 'suppressed' = rule fired but lost
   * the severity ladder; 'noop' = rule fired but the date had no actionable
   * workout (rest day or already low-intensity for HRV downgrade).
   */
  action: 'force_rest' | 'force_replace' | 'note_only' | 'suppressed' | 'noop';
  /** Coach-voice explanation, surfaced via HardRuleAdjustment.reason. */
  reason: string;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface ApplyHardRulesInput {
  weeklyDraft: WeeklyDetail;
  /** Per-day readings. Must cover (a) each date in weeklyDraft for the
   *  readiness/HRV-today checks, (b) at least hrvRollingWindowDays prior
   *  days before each date for the HRV baseline. */
  readinessHistory: DailyReadinessReading[];
  /** Current CTL/ATL/TSB. The TSB-band rules apply uniformly across the
   *  upcoming week (no per-day projection). */
  computed: Pass3ComputedInputs;
  config: HardRulesConfig;
}

export interface ApplyHardRulesOutput {
  output: HardRuleOutput;
  appliedRules: AppliedRule[];
}

const SEVERITY_RANK: Record<RuleSeverity, number> = {
  note_only: 1,
  force_replace: 2,
  force_rest: 3,
};

const DISCIPLINE_DOWNGRADE_CODE: Record<Discipline, WorkoutCode> = {
  swim: 'B/AE2',
  bike: 'C/AE2',
  run: 'D/AE2',
};

export function applyHardRules(input: ApplyHardRulesInput): ApplyHardRulesOutput {
  const { weeklyDraft, readinessHistory, computed, config } = input;

  const byDate = new Map<string, DailyReadinessReading>();
  for (const r of readinessHistory) byDate.set(r.date, r);

  const tsbFirings = evaluateTsbRules(computed);
  const forcedAdjustments: HardRuleAdjustment[] = [];
  const appliedRules: AppliedRule[] = [];

  for (const wo of weeklyDraft.workouts) {
    const firings: PerDateFiring[] = [];

    // TSB rules apply to every workout date because TSB is a single
    // current value (the day going INTO the upcoming week).
    for (const f of tsbFirings) firings.push({ ...f, date: wo.date });

    // Readiness rules
    const todayReading = byDate.get(wo.date);
    if (todayReading?.readinessScore !== undefined) {
      firings.push(evaluateReadinessBand(wo.date, todayReading.readinessScore));
    }

    // HRV rules
    const hrvFirings = evaluateHrvRules(wo, byDate, config);
    firings.push(...hrvFirings);

    if (firings.length === 0) continue;

    // Materialise the AppliedRule entries first — every firing is in the audit,
    // even ones that the severity ladder suppresses below.
    const auditForDate: AppliedRule[] = firings.map((f) => ({
      date: f.date,
      ruleId: f.ruleId,
      severity: f.severity,
      triggerValue: f.triggerValue,
      action: 'note_only',
      reason: f.reason,
    }));

    const topSeverity = firings.reduce<RuleSeverity>(
      (acc, f) => (SEVERITY_RANK[f.severity] > SEVERITY_RANK[acc] ? f.severity : acc),
      'note_only',
    );

    if (topSeverity === 'note_only') {
      // Audit-only — no HardRuleAdjustment for this date.
      appliedRules.push(...auditForDate);
      continue;
    }

    // Pick the winning firing — first in iteration order at the top severity.
    const winner = firings.find((f) => f.severity === topSeverity) as ActionableFiring;
    const adjustment = buildAdjustmentForRule(winner, wo, config);

    if (adjustment === null) {
      // Rule fired but had nothing to act on (e.g., HRV downgrade on a workout
      // that's already low-intensity). Audit only.
      for (const a of auditForDate) {
        if (a.ruleId === winner.ruleId) a.action = 'noop';
      }
      appliedRules.push(...auditForDate);
      continue;
    }

    forcedAdjustments.push(adjustment);

    for (const a of auditForDate) {
      if (a.ruleId === winner.ruleId) {
        a.action = adjustment.action;
      } else if (SEVERITY_RANK[a.severity] >= SEVERITY_RANK[topSeverity]) {
        // Same-severity-or-higher rule that lost the tie-break.
        a.action = 'suppressed';
      }
    }
    appliedRules.push(...auditForDate);
  }

  return {
    output: { forcedAdjustments },
    appliedRules,
  };
}

// ─── Rule evaluation ─────────────────────────────────────────────────────────

interface BaseFiring {
  date: string;
  ruleId: string;
  severity: RuleSeverity;
  triggerValue: string;
  reason: string;
}

interface NoteOnlyFiring extends BaseFiring {
  severity: 'note_only';
}

interface ActionableFiring extends BaseFiring {
  severity: 'force_replace' | 'force_rest';
}

type PerDateFiring = NoteOnlyFiring | ActionableFiring;

function evaluateReadinessBand(date: string, score: number): PerDateFiring {
  // Bands match the ETA-21 spec: <50, 50-64, 65-79, >=80.
  if (score < 50) {
    return {
      date,
      ruleId: 'readiness.red',
      severity: 'force_rest',
      triggerValue: `readiness=${score}`,
      reason: `Daily readiness ${score} (< 50) — forced recovery day; no workout, no make-up.`,
    };
  }
  if (score <= 64) {
    return {
      date,
      ruleId: 'readiness.yellow',
      severity: 'note_only',
      triggerValue: `readiness=${score}`,
      reason: `Daily readiness ${score} (50–64) — consider intensity dial-back.`,
    };
  }
  if (score <= 79) {
    return {
      date,
      ruleId: 'readiness.green',
      severity: 'note_only',
      triggerValue: `readiness=${score}`,
      reason: `Daily readiness ${score} (65–79) — normal training day.`,
    };
  }
  return {
    date,
    ruleId: 'readiness.fresh',
    severity: 'note_only',
    triggerValue: `readiness=${score}`,
    reason: `Daily readiness ${score} (≥ 80) — green light to push.`,
  };
}

function evaluateTsbRules(computed: Pass3ComputedInputs): BaseFiring[] {
  const out: BaseFiring[] = [];
  if (computed.currentTsb < -30) {
    out.push({
      date: '', // filled in per-workout
      ruleId: 'tsb.overreached',
      severity: 'force_rest',
      triggerValue: `tsb=${computed.currentTsb.toFixed(1)}`,
      reason: `TSB ${computed.currentTsb.toFixed(1)} (< −30) — severely overreached; forced recovery.`,
    });
  } else if (computed.currentTsb > 10) {
    out.push({
      date: '',
      ruleId: 'tsb.fresh_sustained',
      severity: 'note_only',
      triggerValue: `tsb=${computed.currentTsb.toFixed(1)}`,
      reason: `TSB ${computed.currentTsb.toFixed(1)} (> +10) — high freshness; consider added stimulus.`,
    });
  }
  return out;
}

function evaluateHrvRules(
  wo: PlannedWorkout,
  byDate: ReadonlyMap<string, DailyReadinessReading>,
  cfg: HardRulesConfig,
): PerDateFiring[] {
  const todayReading = byDate.get(wo.date);
  const todayHrv = todayReading?.hrvRmssdMs;
  if (todayHrv === undefined) return []; // No HRV today → all HRV rules disabled.

  const baseline = rollingHrvBaseline(wo.date, byDate, cfg.hrvRollingWindowDays);
  if (baseline === undefined) return []; // Insufficient baseline data → rules disabled.

  const dropPct = ((baseline - todayHrv) / baseline) * 100;
  const trigger = `hrv ${dropPct >= 0 ? '-' : '+'}${Math.abs(dropPct).toFixed(1)} % vs ${cfg.hrvRollingWindowDays}d baseline ${baseline.toFixed(1)}ms`;
  const out: PerDateFiring[] = [];

  // Acute-drop rules — exclusive bands so only one fires.
  if (dropPct > cfg.hrvDropForcedRestPct) {
    out.push({
      date: wo.date,
      ruleId: 'hrv.forced_rest_acute',
      severity: 'force_rest',
      triggerValue: trigger,
      reason: `HRV dropped ${dropPct.toFixed(1)} % below ${cfg.hrvRollingWindowDays}-day baseline (threshold > ${cfg.hrvDropForcedRestPct} %) — forced recovery.`,
    });
  } else if (dropPct >= cfg.hrvDropDowngradePct) {
    out.push({
      date: wo.date,
      ruleId: 'hrv.downgrade',
      severity: 'force_replace',
      triggerValue: trigger,
      reason: `HRV dropped ${dropPct.toFixed(1)} % below baseline (≥ ${cfg.hrvDropDowngradePct} %) — downgrade to Z2 endurance at ${Math.round(cfg.hrvDowngradeDurationRatio * 100)} % duration.`,
    });
  } else if (dropPct >= cfg.hrvDropNotePct) {
    out.push({
      date: wo.date,
      ruleId: 'hrv.note',
      severity: 'note_only',
      triggerValue: trigger,
      reason: `HRV dropped ${dropPct.toFixed(1)} % below baseline (${cfg.hrvDropNotePct}–${cfg.hrvDropDowngradePct} %) — logged, no plan change.`,
    });
  }

  // Streak rule — independent of acute, both can fire on the same day.
  if (isHrvStreakSuppression(wo.date, byDate, cfg)) {
    out.push({
      date: wo.date,
      ruleId: 'hrv.forced_rest_chronic',
      severity: 'force_rest',
      triggerValue: `hrv ≥ ${cfg.hrvStreakDropPct} % below baseline ${cfg.hrvStreakDays}d in a row`,
      reason: `HRV ≥ ${cfg.hrvStreakDropPct} % below baseline for ${cfg.hrvStreakDays} consecutive days — forced recovery.`,
    });
  }

  return out;
}

// ─── HRV math ────────────────────────────────────────────────────────────────

function shiftIsoDate(iso: string, days: number): string {
  const t = new Date(`${iso}T00:00:00Z`).getTime() + days * MS_PER_DAY;
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Mean of `hrvRmssdMs` for the `windowDays` days strictly before `date`.
 * Returns undefined if fewer than `windowDays` of those days have a reading
 * — matches ETA-31's "disabled if < N prior days" rule.
 */
function rollingHrvBaseline(
  date: string,
  byDate: ReadonlyMap<string, DailyReadinessReading>,
  windowDays: number,
): number | undefined {
  const values: number[] = [];
  for (let i = 1; i <= windowDays; i++) {
    const prior = byDate.get(shiftIsoDate(date, -i));
    if (prior?.hrvRmssdMs === undefined) return undefined;
    values.push(prior.hrvRmssdMs);
  }
  const sum = values.reduce((a, b) => a + b, 0);
  return sum / values.length;
}

function isHrvStreakSuppression(
  date: string,
  byDate: ReadonlyMap<string, DailyReadinessReading>,
  cfg: HardRulesConfig,
): boolean {
  // Check the most recent `streakDays` days inclusive of today. Every day
  // must have hrvRmssdMs AND a computable baseline AND drop ≥ streakDropPct.
  for (let i = 0; i < cfg.hrvStreakDays; i++) {
    const d = shiftIsoDate(date, -i);
    const reading = byDate.get(d);
    if (reading?.hrvRmssdMs === undefined) return false;
    const baseline = rollingHrvBaseline(d, byDate, cfg.hrvRollingWindowDays);
    if (baseline === undefined) return false;
    const dropPct = ((baseline - reading.hrvRmssdMs) / baseline) * 100;
    if (dropPct < cfg.hrvStreakDropPct) return false;
  }
  return true;
}

// ─── Adjustment construction ─────────────────────────────────────────────────

function buildAdjustmentForRule(
  firing: ActionableFiring,
  wo: PlannedWorkout,
  cfg: HardRulesConfig,
): HardRuleAdjustment | null {
  if (firing.severity === 'force_rest') {
    return {
      date: firing.date,
      action: 'force_rest',
      reason: firing.reason,
    };
  }
  // force_replace — only HRV downgrade in v1.
  if (!hasZ3PlusSegment(wo)) {
    // Workout is already low-intensity; downgrade would be a no-op.
    return null;
  }
  const newCode = DISCIPLINE_DOWNGRADE_CODE[wo.discipline];
  const newDurationSeconds = Math.round(wo.totalDurationSeconds * cfg.hrvDowngradeDurationRatio);
  return {
    date: firing.date,
    action: 'force_replace',
    newWorkoutCode: newCode,
    newDurationSeconds,
    reason: firing.reason,
  };
}

const HIGH_INTENSITY_ZONES: ReadonlySet<IntensityZone | 'mixed' | 'easy'> = new Set([
  'z3',
  'z4',
  'z5a',
  'z5b',
  'z5c',
  'mixed',
]);

function hasZ3PlusSegment(wo: PlannedWorkout): boolean {
  return wo.segments.some((s) => HIGH_INTENSITY_ZONES.has(s.zone));
}
