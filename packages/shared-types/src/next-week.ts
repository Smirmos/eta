import type { DayOfWeek, Discipline, Phase } from './athlete-profile.js';
import type { WeeklyDetail } from './plan.js';

export type DayRole = 'rest' | 'long' | 'quality' | 'aerobic' | 'recovery';

export interface NextWeekDay {
  dayOfWeek: DayOfWeek;
  role: DayRole;
  /** 0 disciplines for a rest day; 1–2 otherwise. Guidance for the LLM. */
  disciplines: Discipline[];
  /** Per-day duration budget in minutes; 0 for rest. Guidance for the LLM. */
  targetDurationMinutes: number;
}

/** The deterministic, safety-bounded frame the LLM fills in. */
export interface NextWeekFrame {
  /** ISO Monday the generated week starts on. */
  weekStartDate: string;
  phase: Phase;
  isRecoveryWeek: boolean;
  /** Safety-capped weekly volume target (hours). */
  targetVolumeHours: number;
  /** Exactly 7 entries, mon..sun. */
  days: NextWeekDay[];
  /** Concrete numbers behind the frame, for the prompt and the UI "why". */
  rationale: {
    weeksUntilRace: number;
    volumeAnchorHours: number;
    rampPct: number;
    easeTriggered: boolean;
  };
}

export type NextWeekResponse =
  | { status: 'ok'; frame: NextWeekFrame; weeklyDetail: WeeklyDetail }
  | { status: 'needs_profile' }
  | { status: 'needs_history' }
  | { status: 'error'; message: string };
