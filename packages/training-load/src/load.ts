import type { DailyTss, LoadHistory } from './types.js';

const CTL_TIME_CONSTANT_DAYS = 42;
const ATL_TIME_CONSTANT_DAYS = 7;
const MS_PER_DAY = 86_400_000;

export interface ComputeLoadOptions {
  /** Initial CTL on the first day. Defaults to 0. */
  initialCtl?: number;
  /** Initial ATL on the first day. Defaults to 0. */
  initialAtl?: number;
}

// ─── Date helpers (ISO YYYY-MM-DD, UTC midnight, no DST) ─────────────────────

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoDate(s: string, label: string): Date {
  if (typeof s !== 'string' || !ISO_DATE_RE.test(s)) {
    throw new RangeError(`${label}: expected ISO date "YYYY-MM-DD", got ${JSON.stringify(s)}`);
  }
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    throw new RangeError(`${label}: invalid calendar date ${s}`);
  }
  return d;
}

function formatIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Build a day-by-day CTL/ATL/TSB history.
 *
 * EWMA recurrences (TrainingPeaks / Banister):
 *   CTL_today = CTL_yesterday + (TSS_today - CTL_yesterday) / 42
 *   ATL_today = ATL_yesterday + (TSS_today - ATL_yesterday) / 7
 *   TSB_today = CTL_yesterday - ATL_yesterday   ← uses YESTERDAY's values
 *                                                  (freshness coming INTO today)
 *
 * Days with no TSS entry produce a row with TSS=0 (EWMA decays toward 0
 * without input).
 *
 * Errors:
 *   - dailyTss not sorted ascending by date
 *   - dailyTss entries with dates outside [startDate, endDate]
 *   - duplicate dates in dailyTss
 *   - negative or non-finite TSS
 *   - startDate > endDate
 */
export function computeLoadHistory(
  dailyTss: DailyTss[],
  startDate: string,
  endDate: string,
  options: ComputeLoadOptions = {},
): LoadHistory[] {
  const start = parseIsoDate(startDate, 'startDate');
  const end = parseIsoDate(endDate, 'endDate');
  if (start.getTime() > end.getTime()) {
    throw new RangeError(`startDate (${startDate}) must be <= endDate (${endDate})`);
  }

  const initialCtl = options.initialCtl ?? 0;
  const initialAtl = options.initialAtl ?? 0;
  if (!Number.isFinite(initialCtl) || initialCtl < 0) {
    throw new RangeError(`initialCtl must be a finite non-negative number, got ${initialCtl}`);
  }
  if (!Number.isFinite(initialAtl) || initialAtl < 0) {
    throw new RangeError(`initialAtl must be a finite non-negative number, got ${initialAtl}`);
  }

  // Build a date -> TSS map and validate ordering / range / duplicates / values.
  const tssByDate = new Map<string, number>();
  let prevTime = -Infinity;
  for (let i = 0; i < dailyTss.length; i++) {
    const entry = dailyTss[i] as DailyTss;
    const t = parseIsoDate(entry.date, `dailyTss[${i}].date`).getTime();
    if (t < prevTime) {
      throw new RangeError(`dailyTss[${i}] (${entry.date}) is out of ascending order`);
    }
    if (t === prevTime) {
      throw new RangeError(`dailyTss[${i}] (${entry.date}) duplicates the previous date`);
    }
    if (t < start.getTime() || t > end.getTime()) {
      throw new RangeError(`dailyTss[${i}] (${entry.date}) is outside [${startDate}, ${endDate}]`);
    }
    if (!Number.isFinite(entry.tss) || entry.tss < 0) {
      throw new RangeError(
        `dailyTss[${i}].tss must be a finite non-negative number, got ${entry.tss}`,
      );
    }
    tssByDate.set(entry.date, entry.tss);
    prevTime = t;
  }

  const out: LoadHistory[] = [];
  let ctlYesterday = initialCtl;
  let atlYesterday = initialAtl;
  for (
    let cursor = new Date(start.getTime());
    cursor.getTime() <= end.getTime();
    cursor = new Date(cursor.getTime() + MS_PER_DAY)
  ) {
    const iso = formatIsoDate(cursor);
    const tssToday = tssByDate.get(iso) ?? 0;

    const tsb = ctlYesterday - atlYesterday;
    const ctlToday = ctlYesterday + (tssToday - ctlYesterday) / CTL_TIME_CONSTANT_DAYS;
    const atlToday = atlYesterday + (tssToday - atlYesterday) / ATL_TIME_CONSTANT_DAYS;

    out.push({ ctl: ctlToday, atl: atlToday, tsb, asOf: iso });

    ctlYesterday = ctlToday;
    atlYesterday = atlToday;
  }

  return out;
}

/**
 * Seed the EWMA from a backfilled history.
 *
 * Runs `computeLoadHistory` from initialCtl=initialAtl=0 over the full input
 * span (first dailyTss date through last dailyTss date), and returns the final
 * day's CTL/ATL. Used when a user first connects Strava with several months of
 * historical activity — the returned values approximate "what your CTL/ATL
 * would be today if the EWMA had been running all along."
 *
 * Notes:
 *   - For τ=42 (CTL), full convergence needs roughly 3τ ≈ 126 days. After 90
 *     days at constant input, CTL is at ~70% of asymptote; after 180 days, ~98%.
 *   - For τ=7 (ATL), 21 days is enough for >95% convergence.
 *   - On empty input, returns { ctl: 0, atl: 0 }.
 */
export function seedFromHistory(dailyTss: DailyTss[]): { ctl: number; atl: number } {
  if (dailyTss.length === 0) {
    return { ctl: 0, atl: 0 };
  }
  const startDate = (dailyTss[0] as DailyTss).date;
  const endDate = (dailyTss[dailyTss.length - 1] as DailyTss).date;
  const history = computeLoadHistory(dailyTss, startDate, endDate);
  const last = history[history.length - 1] as LoadHistory;
  return { ctl: last.ctl, atl: last.atl };
}
