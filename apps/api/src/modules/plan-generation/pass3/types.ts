import type {
  AdaptationSuggestion,
  AthleteProfile,
  DailyReadinessReading,
  WeeklyDetail,
  WorkoutCode,
  WorkoutCompleted,
} from '@eta/shared-types';
import type { DailyTss } from '@eta/training-load';
import type { AppliedRule } from './hard-rules.js';

// ─── Hard-rules pre-pass ─────────────────────────────────────────────────────
// Deterministic pre-pass implemented in hard-rules.ts (ETA-21). Pass 3 runs
// AFTER hard rules and only produces soft adjustments on top.

export type HardRuleAction = 'force_rest' | 'force_replace';

export interface HardRuleAdjustment {
  /** ISO date the rule fired against. */
  date: string;
  action: HardRuleAction;
  /** Required when action='force_replace'. */
  newWorkoutCode?: WorkoutCode;
  /** Optional with action='force_replace' — caps duration (e.g., HRV downgrade to 70 %). */
  newDurationSeconds?: number;
  /** Short human-readable explanation. Surfaced to the LLM and the renderer. */
  reason: string;
}

export interface HardRuleOutput {
  forcedAdjustments: HardRuleAdjustment[];
}

// ─── KB slice ────────────────────────────────────────────────────────────────

export interface Pass3KbSlice {
  /** 02-atp-structure.md, sliced to the current phase. */
  atpStructurePhase: string;
  /** 05-recovery.md, full content (~48K chars). */
  recovery: string;
  /** 04-weekly-templates.md, placement rules section only. */
  weeklyTemplatesRules: string;
  totalChars: number;
}

// ─── Inputs / outputs ────────────────────────────────────────────────────────

export interface Pass3Input {
  /** FK to the macro plan this adaptation belongs to. */
  macroPlanId: string;
  /** ISO date of the Monday of the upcoming week (matches weeklyDraft.weekStartDate). */
  forWeekStart: string;
  /**
   * If true, skip persistence. Used by `pnpm generate:test-adaptation` which
   * runs synthetic scenarios with no real macro plan in DB.
   */
  dryRun?: boolean;

  /**
   * Upcoming week's draft. In v1 this is a copy of the macro plan template
   * synthesised into a `WeeklyDetail`-shaped object; eventually it will be
   * the actual Pass 2 output for that week.
   */
  weeklyDraft: WeeklyDetail;

  /** Completed workouts from the 7 days immediately preceding weeklyDraft. */
  completedLastWeek: WorkoutCompleted[];

  /**
   * Per-day readiness/HRV readings covering each upcoming-week date that
   * needs rule evaluation, plus enough prior days to back the HRV baseline
   * window (hrvRollingWindowDays from config). The hard-rules pre-pass also
   * uses this for the readiness-band lookup per workout date.
   */
  readinessHistory: DailyReadinessReading[];

  athleteProfile: AthleteProfile;

  /**
   * Optional backfilled daily TSS history used to seed CTL/ATL before the
   * 7-day window. When omitted, the EWMA starts at zero — fine for fresh
   * users but understates CTL/ATL for athletes with training history.
   */
  seedDailyTss?: DailyTss[];
}

export interface Pass3ComputedInputs {
  /** Sum of actualTss across completedLastWeek (workouts with no actualTss contribute 0). */
  lastWeekTss: number;
  /** EWMA chronic training load at end of the last-week window. */
  currentCtl: number;
  /** EWMA acute training load at end of the last-week window. */
  currentAtl: number;
  /** Training stress balance = CTL_yesterday − ATL_yesterday going into upcoming week. */
  currentTsb: number;
  /** Mean of in-window `readinessHistory[].readinessScore`; 50 if none available. */
  avgReadinessLast7d: number;
}

export interface Pass3Output {
  suggestion: AdaptationSuggestion;
  computed: Pass3ComputedInputs;
  /** Forced changes the hard-rules pre-pass produced; also embedded in the prompt. */
  hardRuleOutput: HardRuleOutput;
  /** Full hard-rule audit trail (firings, suppressions, noops). */
  hardRulesApplied: AppliedRule[];
  /** Unique KB citations referenced by non-keep adjustments. */
  appliedSources: string[];
}
