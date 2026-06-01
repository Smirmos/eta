import type {
  AdaptationSuggestion,
  AthleteProfile,
  DailyReadinessReading,
  WeeklyDetail,
  WorkoutCode,
  WorkoutCompleted,
} from '@eta/shared-types';
import type { DailyTss } from '@eta/training-load';

// ─── Hard-rules pre-pass stub ────────────────────────────────────────────────
// Future ticket will deliver a deterministic pre-pass that emits forced
// changes (e.g., auto-rest after a missed long workout). Pass 3 runs AFTER
// hard rules and only produces soft adjustments on top. For v1 the stub is
// always empty; Pass 3 still receives it so the prompt + postprocess can
// reference "no hard rules ran today".

export type HardRuleAction = 'force_rest' | 'force_replace';

export interface HardRuleAdjustment {
  /** ISO date inside the upcoming week. */
  date: string;
  action: HardRuleAction;
  /** Required when action='force_replace'. */
  newWorkoutCode?: WorkoutCode;
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
  /**
   * Upcoming week's draft. In v1 this is a copy of the macro plan template
   * synthesised into a `WeeklyDetail`-shaped object; eventually it will be
   * the actual Pass 2 output for that week.
   */
  weeklyDraft: WeeklyDetail;

  /** Completed workouts from the 7 days immediately preceding weeklyDraft. */
  completedLastWeek: WorkoutCompleted[];

  /**
   * Per-day readiness/HRV readings covering today + the prior days needed for
   * Pass 3's 7-day average and the hard-rules HRV rolling-baseline window.
   * Must contain at least one reading dated `< weeklyDraft.weekStartDate`.
   */
  readinessHistory: DailyReadinessReading[];

  /** Output of the deterministic hard-rules pre-pass. Stubbed (empty) in v1. */
  hardRuleOutput: HardRuleOutput;

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
  /** Unique KB citations referenced by non-keep adjustments. */
  appliedSources: string[];
}
