import { athleteProfileSchema, weeklyDetailSchema } from '@eta/shared-types';
import { describe, expect, it } from 'vitest';
import { computePass3Inputs } from '../pass3-context-builder.js';
import { PASS3_SCENARIO_NAMES, pass3Scenarios } from './scenarios.js';

describe('pass3 scenarios — structural validity', () => {
  it.each(PASS3_SCENARIO_NAMES)('%s has a schema-valid weeklyDraft', (name) => {
    const input = pass3Scenarios[name]();
    const result = weeklyDetailSchema.safeParse(input.weeklyDraft);
    if (!result.success) {
      throw new Error(
        `weeklyDetailSchema rejected ${name}: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      );
    }
  });

  it.each(PASS3_SCENARIO_NAMES)('%s has a structurally-valid athleteProfile', (name) => {
    const input = pass3Scenarios[name]();
    const result = athleteProfileSchema.safeParse(input.athleteProfile);
    if (!result.success) {
      throw new Error(
        `athleteProfileSchema rejected ${name}: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      );
    }
  });

  it.each(PASS3_SCENARIO_NAMES)('%s draft uses the same week start date', (name) => {
    const input = pass3Scenarios[name]();
    expect(input.weeklyDraft.weekStartDate).toBe('2026-06-01');
  });

  it.each(PASS3_SCENARIO_NAMES)(
    '%s completed workouts fall in the 7 days before the draft',
    (name) => {
      const input = pass3Scenarios[name]();
      for (const w of input.completedLastWeek) {
        expect(w.date >= '2026-05-25' && w.date <= '2026-05-31').toBe(true);
      }
    },
  );
});

describe('pass3 scenarios — computed inputs reflect the scenario story', () => {
  function compute(name: (typeof PASS3_SCENARIO_NAMES)[number]) {
    const input = pass3Scenarios[name]();
    return computePass3Inputs({
      upcomingWeekStartDate: input.weeklyDraft.weekStartDate,
      completedLastWeek: input.completedLastWeek,
      readinessHistory: input.readinessHistory,
      seedDailyTss: input.seedDailyTss,
    });
  }

  it('perfect-week: high readiness, lastWeekTss near planned ~520', () => {
    const c = compute('perfect-week');
    expect(c.avgReadinessLast7d).toBe(72);
    expect(c.lastWeekTss).toBeGreaterThanOrEqual(500);
    expect(c.lastWeekTss).toBeLessThanOrEqual(540);
  });

  it('missed-long-ride: neutral readiness, lastWeekTss noticeably below perfect (~280)', () => {
    const perfect = compute('perfect-week');
    const missed = compute('missed-long-ride');
    expect(missed.avgReadinessLast7d).toBe(48);
    // Sunday's ~180 + Saturday's ~60 TSS both gone — at least 200 TSS lower.
    expect(missed.lastWeekTss).toBeLessThan(perfect.lastWeekTss - 200);
  });

  it('low-recovery: readiness 30, lastWeekTss elevated vs perfect (~550)', () => {
    const perfect = compute('perfect-week');
    const low = compute('low-recovery');
    expect(low.avgReadinessLast7d).toBe(30);
    // Every workout slightly over plan → total > perfect's total.
    expect(low.lastWeekTss).toBeGreaterThan(perfect.lastWeekTss);
  });

  it('fitness-leap: high readiness, seeded CTL materially above un-seeded baseline', () => {
    const perfect = compute('perfect-week');
    const leap = compute('fitness-leap');
    expect(leap.avgReadinessLast7d).toBe(82);
    // Seeded with 90 days of ~75 TSS/day → CTL > 50 going into the week.
    expect(leap.currentCtl).toBeGreaterThan(50);
    expect(leap.currentCtl).toBeGreaterThan(perfect.currentCtl + 40);
  });

  it('perfect-week and missed-long-ride share an un-seeded CTL baseline', () => {
    // Both omit seedDailyTss → CTL starts at zero, accumulates only across the
    // 7-day window. Sanity check that the seed plumbing is what diverges them
    // from fitness-leap, not anything else in the context builder.
    const a = compute('perfect-week');
    const b = compute('missed-long-ride');
    expect(a.currentCtl).toBeLessThan(20);
    expect(b.currentCtl).toBeLessThan(20);
  });
});
