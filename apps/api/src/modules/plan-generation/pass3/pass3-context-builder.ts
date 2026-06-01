import type { DailyReadinessReading, Phase, WorkoutCompleted } from '@eta/shared-types';
import { computeLoadHistory, seedFromHistory, type DailyTss } from '@eta/training-load';
import type { KnowledgeBase } from '../knowledge-base.loader.js';
import type { Pass3ComputedInputs, Pass3KbSlice } from './types.js';

const MS_PER_DAY = 86_400_000;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ─── KB slicing (mirrors pass2-context-builder helpers) ─────────────────────

const PHASE_HEADING: Record<Phase, string> = {
  prep: '#### Prep',
  base_1: '#### Base 1',
  base_2: '#### Base 2',
  base_3: '#### Base 3',
  build_1: '#### Build 1',
  build_2: '#### Build 2',
  peak: '#### Peak',
  race_week: '#### Race (Race Week)',
  transition: '#### Transition',
};

function sliceSection(md: string, startHeading: string): string {
  const startIdx = md.indexOf(startHeading);
  if (startIdx === -1) return '';
  const level = startHeading.match(/^#+/)?.[0].length ?? 0;
  if (level === 0) return '';
  const tailRe = new RegExp(`\\n#{1,${level}} `, 'g');
  tailRe.lastIndex = startIdx + startHeading.length;
  const match = tailRe.exec(md);
  return match ? md.slice(startIdx, match.index) : md.slice(startIdx);
}

export interface BuildPass3KbSliceInput {
  phase: Phase;
  kb: KnowledgeBase;
}

export function buildPass3KbSlice(input: BuildPass3KbSliceInput): Pass3KbSlice {
  const { phase, kb } = input;
  const atpStructurePhase = sliceSection(kb.atpStructure, PHASE_HEADING[phase]);
  const weeklyTemplatesRules = sliceSection(kb.weeklyTemplates, '## Workout placement rules');
  const recovery = kb.recovery;

  return {
    atpStructurePhase,
    recovery,
    weeklyTemplatesRules,
    totalChars: atpStructurePhase.length + recovery.length + weeklyTemplatesRules.length,
  };
}

// ─── Computed-input derivation ──────────────────────────────────────────────

function shiftIsoDate(iso: string, days: number): string {
  if (!ISO_DATE_RE.test(iso)) {
    throw new RangeError(`shiftIsoDate: expected ISO date "YYYY-MM-DD", got ${JSON.stringify(iso)}`);
  }
  const t = new Date(`${iso}T00:00:00Z`).getTime() + days * MS_PER_DAY;
  return new Date(t).toISOString().slice(0, 10);
}

function dailyTssFromCompleted(completed: WorkoutCompleted[]): DailyTss[] {
  const sumByDate = new Map<string, number>();
  for (const w of completed) {
    const tss = w.actualTss ?? 0;
    sumByDate.set(w.date, (sumByDate.get(w.date) ?? 0) + tss);
  }
  return [...sumByDate.entries()]
    .map(([date, tss]) => ({ date, tss }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export interface ComputePass3InputsInput {
  /** ISO date "YYYY-MM-DD" — first day (Monday) of the upcoming week. */
  upcomingWeekStartDate: string;
  completedLastWeek: WorkoutCompleted[];
  readinessHistory: DailyReadinessReading[];
  /** Daily TSS history before the 7-day window, used to seed CTL/ATL. */
  seedDailyTss?: DailyTss[];
}

/**
 * Average the `readinessScore` of readings whose date falls inside
 * `[upcomingWeekStartDate − 7d, upcomingWeekStartDate − 1d]`. Readings
 * without a `readinessScore` are skipped. Returns 50 (neutral) when the
 * window has no scored readings — matches the legacy stub-50 baseline.
 */
function avgReadinessInWindow(
  history: DailyReadinessReading[],
  windowStart: string,
  windowEnd: string,
): number {
  const scored = history.filter(
    (r) =>
      r.readinessScore !== undefined && r.date >= windowStart && r.date <= windowEnd,
  );
  if (scored.length === 0) return 50;
  const sum = scored.reduce((acc, r) => acc + (r.readinessScore as number), 0);
  return sum / scored.length;
}

/**
 * Compute CTL/ATL/TSB and lastWeekTss as of the morning the upcoming week
 * starts. The 7-day window is the inclusive range
 *   [upcomingWeekStartDate − 7d, upcomingWeekStartDate − 1d].
 * Workouts outside that window in `completedLastWeek` are silently ignored
 * (matches the field name; callers shouldn't pass them anyway).
 *
 * `readinessHistory` may contain readings outside the window too (the
 * hard-rules engine needs a longer baseline) — only in-window scored
 * readings contribute to `avgReadinessLast7d`.
 */
export function computePass3Inputs(input: ComputePass3InputsInput): Pass3ComputedInputs {
  const { upcomingWeekStartDate, completedLastWeek, readinessHistory, seedDailyTss } = input;
  const windowEnd = shiftIsoDate(upcomingWeekStartDate, -1);
  const windowStart = shiftIsoDate(upcomingWeekStartDate, -7);

  const completedInWindow = completedLastWeek.filter(
    (w) => w.date >= windowStart && w.date <= windowEnd,
  );
  const dailyTss = dailyTssFromCompleted(completedInWindow);
  const lastWeekTss = dailyTss.reduce((acc, d) => acc + d.tss, 0);

  const seed = seedDailyTss && seedDailyTss.length > 0 ? seedFromHistory(seedDailyTss) : { ctl: 0, atl: 0 };

  const history = computeLoadHistory(dailyTss, windowStart, windowEnd, {
    initialCtl: seed.ctl,
    initialAtl: seed.atl,
  });
  const last = history[history.length - 1];
  if (!last) {
    // Window has 7 days, computeLoadHistory always produces ≥1 row — defensive.
    throw new Error('computePass3Inputs: empty load history for non-empty window');
  }

  return {
    lastWeekTss,
    currentCtl: last.ctl,
    currentAtl: last.atl,
    currentTsb: last.tsb,
    avgReadinessLast7d: avgReadinessInWindow(readinessHistory, windowStart, windowEnd),
  };
}
