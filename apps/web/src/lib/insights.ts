import type { Discipline, TrainingAnalysisResponse } from '@eta/shared-types';

export type InsightTone = 'strength' | 'watch';

export interface Insight {
  /** Stable identifier — also used as the React key. */
  id: string;
  tone: InsightTone;
  /** Short headline (≈2–4 words). */
  label: string;
  /** One-line plain-language explanation. */
  detail: string;
}

/** Heuristic thresholds — tuned for an amateur triathlete's 4-week block. */
const CONSISTENCY_DAYS = 4; // training days/week that reads as "consistent"
const UNDERTRAINED_PCT = 20; // below the ~33% even split = notably light
const AEROBIC_BASE_HOURS = 30; // ~7.5h/week over 4 weeks = a solid base
const SPIKE_RATIO = 1.4; // last week this many× the prior average = a jump
const STALE_DAYS = 7;

const ALL_DISCIPLINES: Discipline[] = ['swim', 'bike', 'run'];
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Turns a deterministic TrainingAnalysis into a short, ranked list of
 * strengths and watch-outs. Pure: same input → same output, no I/O.
 * Watch-outs are surfaced before strengths so problems lead.
 */
export function deriveInsights(analysis: TrainingAnalysisResponse): Insight[] {
  if (!analysis.hasData || !analysis.window) return [];

  const { overall, perWeek, trend, dataNote } = analysis;
  const strengths: Insight[] = [];
  const watch: Insight[] = [];

  // ── Discipline balance ──────────────────────────────────────────────
  const present = new Set(overall.sportSplit.map((s) => s.discipline));
  for (const d of ALL_DISCIPLINES) {
    if (!present.has(d)) {
      watch.push({
        id: `missing:${d}`,
        tone: 'watch',
        label: `No ${d}`,
        detail: `No ${d} sessions logged in this block.`,
      });
    }
  }
  const lightest = overall.sportSplit.reduce<{ discipline: string; pctHours: number } | null>(
    (lo, s) => (lo == null || s.pctHours < lo.pctHours ? s : lo),
    null,
  );
  for (const s of overall.sportSplit) {
    if (s.pctHours < UNDERTRAINED_PCT) {
      const isLightest = s.discipline === lightest?.discipline;
      watch.push({
        id: `undertrained:${s.discipline}`,
        tone: 'watch',
        label: `${cap(s.discipline)} is light`,
        detail: `${cap(s.discipline)} is just ${s.pctHours}% of volume (${s.hours}h)${isLightest ? ' — your lightest discipline this block.' : '.'}`,
      });
    }
  }
  const balanced =
    present.size === ALL_DISCIPLINES.length && overall.sportSplit.every((s) => s.pctHours >= 20);
  if (balanced) {
    strengths.push({
      id: 'balanced',
      tone: 'strength',
      label: 'Well balanced',
      detail: 'Swim, bike and run are all getting meaningful time.',
    });
  }

  // ── Aerobic base ────────────────────────────────────────────────────
  if (overall.totalHours >= AEROBIC_BASE_HOURS) {
    strengths.push({
      id: 'aerobic-base',
      tone: 'strength',
      label: 'Solid base',
      detail: `${overall.totalHours}h of aerobic work banked over the four weeks.`,
    });
  }

  // ── Consistency ─────────────────────────────────────────────────────
  if (overall.avgTrainingDaysPerWeek >= CONSISTENCY_DAYS) {
    strengths.push({
      id: 'consistency',
      tone: 'strength',
      label: 'Consistent',
      detail: `Averaging ${overall.avgTrainingDaysPerWeek} training days/week across the block.`,
    });
  }

  // ── Trend ───────────────────────────────────────────────────────────
  if (trend === 'building') {
    strengths.push({
      id: 'trend',
      tone: 'strength',
      label: 'Volume building',
      detail: 'Your most recent week is up on the prior three-week average.',
    });
  } else if (trend === 'tapering') {
    watch.push({
      id: 'trend',
      tone: 'watch',
      label: 'Volume easing',
      detail: 'Your most recent week is down on the prior weeks — taper or a dip?',
    });
  }

  // ── Volume spike (recovery risk) ────────────────────────────────────
  const last = perWeek[perWeek.length - 1];
  const prior = perWeek.slice(0, -1).filter((w) => w.hours > 0);
  if (last && prior.length > 0) {
    const priorMean = prior.reduce((sum, w) => sum + w.hours, 0) / prior.length;
    if (priorMean > 0 && last.hours / priorMean >= SPIKE_RATIO) {
      watch.push({
        id: 'spike',
        tone: 'watch',
        label: 'Big week jump',
        detail: `Last week (${last.hours}h) was ${(last.hours / priorMean).toFixed(1)}× your prior average — watch recovery.`,
      });
    }
  }

  // ── Measurement gaps ────────────────────────────────────────────────
  if (dataNote.tssCoverage === 'bike_only') {
    watch.push({
      id: 'tss-coverage',
      tone: 'watch',
      label: 'Intensity untracked',
      detail: 'Load (TSS) is measured for the bike only — run & swim intensity isn’t captured yet.',
    });
  }
  if (dataNote.staleDays > STALE_DAYS) {
    watch.push({
      id: 'stale',
      tone: 'watch',
      label: 'Data is stale',
      detail: `No activity synced in ${dataNote.staleDays} days — sync Strava for current numbers.`,
    });
  }

  return [...watch, ...strengths];
}
