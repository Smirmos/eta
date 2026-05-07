import { describe, expect, it } from 'vitest';
import { computeLoadHistory, seedFromHistory } from '../index.js';
import type { DailyTss } from '../index.js';

function constantTss(startDate: string, days: number, tss: number): DailyTss[] {
  const out: DailyTss[] = [];
  const base = new Date(`${startDate}T00:00:00Z`).getTime();
  for (let i = 0; i < days; i++) {
    const iso = new Date(base + i * 86_400_000).toISOString().slice(0, 10);
    out.push({ date: iso, tss });
  }
  return out;
}

describe('computeLoadHistory — EWMA behavior', () => {
  it('42 days of TSS=100 brings CTL to ~63.2 (one CTL time constant)', () => {
    // After τ days at constant input, EWMA reaches input × (1 - 1/e) ≈ 63.2%.
    const days = constantTss('2026-01-01', 42, 100);
    const history = computeLoadHistory(days, '2026-01-01', '2026-02-11');
    expect(history).toHaveLength(42);
    const last = history[41];
    expect(last?.ctl).toBeGreaterThan(60);
    expect(last?.ctl).toBeLessThan(66);
  });

  it('200 days of TSS=100 brings CTL within ~1 of 100', () => {
    // CTL_200 = 100 × (1 - (41/42)^200) ≈ 99.19 (about 4.8τ).
    const days = constantTss('2026-01-01', 200, 100);
    const history = computeLoadHistory(
      days,
      '2026-01-01',
      days[days.length - 1]?.date ?? '2026-01-01',
    );
    const last = history[history.length - 1];
    expect(last?.ctl).toBeGreaterThan(99);
    expect(last?.ctl).toBeLessThan(100);
  });

  it('7 days of TSS=100 brings ATL to ~66 (one ATL time constant, discrete EWMA)', () => {
    // Discrete EWMA at n=τ overshoots the continuous (1-1/e)≈63.2% slightly.
    // ATL_7 = 100 × (1 - (6/7)^7) ≈ 66.01.
    const days = constantTss('2026-01-01', 7, 100);
    const history = computeLoadHistory(days, '2026-01-01', '2026-01-07');
    const last = history[6];
    expect(last?.atl).toBeGreaterThan(63);
    expect(last?.atl).toBeLessThan(68);
  });

  it('TSB on day N uses CTL/ATL as of day N-1 (yesterday-based freshness)', () => {
    // Feed three known days; the regression target is TSB on day 4.
    const days: DailyTss[] = [
      { date: '2026-01-01', tss: 100 },
      { date: '2026-01-02', tss: 80 },
      { date: '2026-01-03', tss: 0 },
      { date: '2026-01-04', tss: 50 },
    ];
    const history = computeLoadHistory(days, '2026-01-01', '2026-01-04');
    expect(history).toHaveLength(4);
    const day3 = history[2];
    const day4 = history[3];
    expect(day4?.tsb).toBeCloseTo((day3?.ctl ?? 0) - (day3?.atl ?? 0), 10);
  });

  it('days with no TSS entry decay both CTL and ATL toward 0', () => {
    const days: DailyTss[] = [{ date: '2026-01-01', tss: 100 }];
    const history = computeLoadHistory(days, '2026-01-01', '2026-04-01');
    const day1 = history[0];
    const day90 = history[history.length - 1];
    expect(day1?.ctl).toBeGreaterThan(0);
    expect(day1?.atl).toBeGreaterThan(0);
    // Both decay; ATL much faster than CTL.
    expect(day90?.atl).toBeLessThan(0.001);
    expect(day90?.ctl).toBeLessThan(day1?.ctl ?? Infinity);
  });

  it('respects initialCtl and initialAtl options', () => {
    const days: DailyTss[] = [{ date: '2026-01-01', tss: 0 }];
    const history = computeLoadHistory(days, '2026-01-01', '2026-01-01', {
      initialCtl: 70,
      initialAtl: 50,
    });
    const day1 = history[0];
    // TSB is yesterday-based: ctl₀=70, atl₀=50 → TSB₁ = 20
    expect(day1?.tsb).toBeCloseTo(20, 6);
    // Day 1 with TSS=0 decays both: ctl₁ = 70 + (0-70)/42, atl₁ = 50 + (0-50)/7
    expect(day1?.ctl).toBeCloseTo(70 - 70 / 42, 6);
    expect(day1?.atl).toBeCloseTo(50 - 50 / 7, 6);
  });

  it('output covers every day in [startDate, endDate] inclusive', () => {
    const history = computeLoadHistory([], '2026-01-01', '2026-01-10');
    expect(history).toHaveLength(10);
    expect(history[0]?.asOf).toBe('2026-01-01');
    expect(history[9]?.asOf).toBe('2026-01-10');
  });
});

describe('computeLoadHistory — input validation', () => {
  it('rejects out-of-order dates', () => {
    const bad: DailyTss[] = [
      { date: '2026-01-02', tss: 50 },
      { date: '2026-01-01', tss: 50 },
    ];
    expect(() => computeLoadHistory(bad, '2026-01-01', '2026-01-02')).toThrow(
      /out of ascending order/,
    );
  });

  it('rejects duplicate dates', () => {
    const bad: DailyTss[] = [
      { date: '2026-01-01', tss: 50 },
      { date: '2026-01-01', tss: 60 },
    ];
    expect(() => computeLoadHistory(bad, '2026-01-01', '2026-01-02')).toThrow(/duplicates/);
  });

  it('rejects entries outside [startDate, endDate]', () => {
    const bad: DailyTss[] = [{ date: '2026-01-15', tss: 50 }];
    expect(() => computeLoadHistory(bad, '2026-01-01', '2026-01-10')).toThrow(
      /outside \[2026-01-01, 2026-01-10\]/,
    );
  });

  it('rejects malformed ISO dates', () => {
    const bad: DailyTss[] = [{ date: '01/01/2026', tss: 50 }];
    expect(() => computeLoadHistory(bad, '2026-01-01', '2026-01-02')).toThrow(/ISO date/);
  });

  it('rejects negative TSS', () => {
    const bad: DailyTss[] = [{ date: '2026-01-01', tss: -10 }];
    expect(() => computeLoadHistory(bad, '2026-01-01', '2026-01-02')).toThrow(/non-negative/);
  });

  it('rejects NaN TSS', () => {
    const bad: DailyTss[] = [{ date: '2026-01-01', tss: NaN }];
    expect(() => computeLoadHistory(bad, '2026-01-01', '2026-01-02')).toThrow(/finite/);
  });

  it('rejects startDate > endDate', () => {
    expect(() => computeLoadHistory([], '2026-01-10', '2026-01-01')).toThrow(/<= endDate/);
  });

  it('rejects negative initialCtl', () => {
    expect(() => computeLoadHistory([], '2026-01-01', '2026-01-01', { initialCtl: -1 })).toThrow(
      /initialCtl/,
    );
  });
});

describe('seedFromHistory', () => {
  it('returns 0/0 on empty input', () => {
    expect(seedFromHistory([])).toEqual({ ctl: 0, atl: 0 });
  });

  it('90 days of TSS=80 returns ATL≈80 and CTL≈70.8 (still within 90/τ_CTL)', () => {
    // ATL (τ=7) reaches >99% by 90 days; CTL (τ=42) reaches ~88%.
    // The user's spec claimed both ≈80 — the math says CTL is still climbing.
    const history = constantTss('2026-01-01', 90, 80);
    const seed = seedFromHistory(history);
    expect(seed.atl).toBeGreaterThan(79);
    expect(seed.atl).toBeLessThan(81);
    expect(seed.ctl).toBeGreaterThan(65);
    expect(seed.ctl).toBeLessThan(75);
  });

  it('365 days of TSS=80 returns both CTL and ATL essentially at 80', () => {
    // CTL needs ~5τ ≈ 210 days to converge within 1%; we use 365 for headroom.
    const history = constantTss('2026-01-01', 365, 80);
    const seed = seedFromHistory(history);
    expect(seed.ctl).toBeCloseTo(80, 0);
    expect(seed.atl).toBeCloseTo(80, 0);
  });
});
