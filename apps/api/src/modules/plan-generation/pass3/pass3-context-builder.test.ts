import type { DailyReadinessReading, WorkoutCompleted } from '@eta/shared-types';
import type { DailyTss } from '@eta/training-load';
import { describe, expect, it } from 'vitest';
import type { KnowledgeBase } from '../knowledge-base.loader.js';
import { buildPass3KbSlice, computePass3Inputs } from './pass3-context-builder.js';

function readinessHistory(score: number, dates: readonly string[]): DailyReadinessReading[] {
  return dates.map((date) => ({ date, readinessScore: score, source: 'stub' as const }));
}

const WINDOW_DATES = [
  '2026-05-04',
  '2026-05-05',
  '2026-05-06',
  '2026-05-07',
  '2026-05-08',
  '2026-05-09',
  '2026-05-10',
] as const;

function makeKb(overrides: Partial<KnowledgeBase> = {}): KnowledgeBase {
  const zones = `# Zones\n\nzones body.\n`;
  const atpStructure = `# ATP\n\n#### Prep\n\nprep body.\n\n#### Base 3\n\nbase 3 body.\n\n#### Build 1\n\nbuild 1 body.\n`;
  const workouts = `# Workouts\n\nworkouts body.\n`;
  const weeklyTemplates = `# Weekly Templates\n\n## Summary\n\nsummary body.\n\n## Workout placement rules\n\nrules 1 through 40.\n\n## Workout codes referenced in this chapter\n\nback-refs.\n`;
  const recovery = `# Recovery\n\n## Recovery indicators\n\nindicator body.\n\n## Planned recovery\n\nplanned recovery body.\n`;
  return {
    zones,
    atpStructure,
    workouts,
    weeklyTemplates,
    recovery,
    totalChars:
      zones.length +
      atpStructure.length +
      workouts.length +
      weeklyTemplates.length +
      recovery.length,
    loadedFrom: '/tmp/fixtures',
    ...overrides,
  };
}

describe('buildPass3KbSlice', () => {
  it('slices atp-structure to the matching phase section only', () => {
    const slice = buildPass3KbSlice({ phase: 'base_3', kb: makeKb() });
    expect(slice.atpStructurePhase).toContain('base 3 body');
    expect(slice.atpStructurePhase).not.toContain('prep body');
    expect(slice.atpStructurePhase).not.toContain('build 1 body');
  });

  it('returns empty atpStructurePhase if the phase heading is missing', () => {
    const kb = makeKb({ atpStructure: '# ATP\n\nno headings\n' });
    const slice = buildPass3KbSlice({ phase: 'base_3', kb });
    expect(slice.atpStructurePhase).toBe('');
  });

  it('slices weeklyTemplates to the placement-rules section only', () => {
    const slice = buildPass3KbSlice({ phase: 'base_3', kb: makeKb() });
    expect(slice.weeklyTemplatesRules).toContain('rules 1 through 40');
    expect(slice.weeklyTemplatesRules).not.toContain('summary body');
    expect(slice.weeklyTemplatesRules).not.toContain('back-refs');
  });

  it('includes the full recovery chapter verbatim', () => {
    const kb = makeKb();
    const slice = buildPass3KbSlice({ phase: 'base_3', kb });
    expect(slice.recovery).toBe(kb.recovery);
  });

  it('totalChars equals the sum of included section character counts', () => {
    const slice = buildPass3KbSlice({ phase: 'base_3', kb: makeKb() });
    expect(slice.totalChars).toBe(
      slice.atpStructurePhase.length + slice.recovery.length + slice.weeklyTemplatesRules.length,
    );
  });
});

describe('computePass3Inputs', () => {
  function workout(date: string, actualTss: number): WorkoutCompleted {
    return {
      date,
      workoutCode: 'D/AE2',
      actualTss,
    };
  }

  it('sums actualTss across all completedLastWeek entries inside the window', () => {
    const completed: WorkoutCompleted[] = [
      workout('2026-05-04', 80),
      workout('2026-05-06', 120),
      workout('2026-05-09', 50),
    ];
    const out = computePass3Inputs({
      upcomingWeekStartDate: '2026-05-11',
      completedLastWeek: completed,
      readinessHistory: readinessHistory(70, WINDOW_DATES),
    });
    expect(out.lastWeekTss).toBe(250);
  });

  it('ignores workouts outside the 7-day window', () => {
    const completed: WorkoutCompleted[] = [
      // Outside (8 days before week start): should be ignored.
      workout('2026-05-03', 999),
      workout('2026-05-04', 80),
      // Outside (week-start day itself): should be ignored — window is [start-7, start-1].
      workout('2026-05-11', 999),
    ];
    const out = computePass3Inputs({
      upcomingWeekStartDate: '2026-05-11',
      completedLastWeek: completed,
      readinessHistory: readinessHistory(50, WINDOW_DATES),
    });
    expect(out.lastWeekTss).toBe(80);
  });

  it('treats missing actualTss as zero', () => {
    const completed: WorkoutCompleted[] = [
      { date: '2026-05-05', workoutCode: 'B/AE1' }, // no actualTss
      workout('2026-05-07', 60),
    ];
    const out = computePass3Inputs({
      upcomingWeekStartDate: '2026-05-11',
      completedLastWeek: completed,
      readinessHistory: readinessHistory(50, WINDOW_DATES),
    });
    expect(out.lastWeekTss).toBe(60);
  });

  it('averages readinessScore across in-window readings into avgReadinessLast7d', () => {
    const history: DailyReadinessReading[] = [
      { date: '2026-05-04', readinessScore: 40, source: 'stub' },
      { date: '2026-05-05', readinessScore: 50, source: 'stub' },
      { date: '2026-05-06', readinessScore: 60, source: 'stub' },
    ];
    const out = computePass3Inputs({
      upcomingWeekStartDate: '2026-05-11',
      completedLastWeek: [],
      readinessHistory: history,
    });
    expect(out.avgReadinessLast7d).toBe(50);
  });

  it('falls back to neutral 50 when no in-window scored readings exist', () => {
    const out = computePass3Inputs({
      upcomingWeekStartDate: '2026-05-11',
      completedLastWeek: [],
      readinessHistory: [],
    });
    expect(out.avgReadinessLast7d).toBe(50);
  });

  it('excludes readings outside the 7-day window from the average', () => {
    const history: DailyReadinessReading[] = [
      // Before the window: ignored.
      { date: '2026-05-02', readinessScore: 10, source: 'stub' },
      // In-window readings: averaged.
      { date: '2026-05-05', readinessScore: 70, source: 'stub' },
      { date: '2026-05-07', readinessScore: 80, source: 'stub' },
      // On the upcoming-week-start day: ignored (window is [start-7, start-1]).
      { date: '2026-05-11', readinessScore: 99, source: 'stub' },
    ];
    const out = computePass3Inputs({
      upcomingWeekStartDate: '2026-05-11',
      completedLastWeek: [],
      readinessHistory: history,
    });
    expect(out.avgReadinessLast7d).toBe(75);
  });

  it('skips readings without a readinessScore when averaging', () => {
    const history: DailyReadinessReading[] = [
      // Only HRV recorded — does not contribute to avgReadinessLast7d.
      { date: '2026-05-05', hrvRmssdMs: 50, source: 'oura' },
      { date: '2026-05-07', readinessScore: 60, source: 'oura' },
    ];
    const out = computePass3Inputs({
      upcomingWeekStartDate: '2026-05-11',
      completedLastWeek: [],
      readinessHistory: history,
    });
    expect(out.avgReadinessLast7d).toBe(60);
  });

  it('produces positive CTL and ATL from a typical training week', () => {
    const completed: WorkoutCompleted[] = [
      workout('2026-05-04', 80),
      workout('2026-05-05', 60),
      workout('2026-05-06', 120),
      workout('2026-05-08', 50),
      workout('2026-05-09', 200),
    ];
    const out = computePass3Inputs({
      upcomingWeekStartDate: '2026-05-11',
      completedLastWeek: completed,
      readinessHistory: readinessHistory(70, WINDOW_DATES),
    });
    expect(out.currentCtl).toBeGreaterThan(0);
    expect(out.currentAtl).toBeGreaterThan(0);
    // ATL (7-day τ) responds faster than CTL (42-day τ) — ATL > CTL during a load week.
    expect(out.currentAtl).toBeGreaterThan(out.currentCtl);
    // TSB = CTL_yesterday − ATL_yesterday — negative during a load week.
    expect(out.currentTsb).toBeLessThan(0);
  });

  it('seeds CTL/ATL from prior history when seedDailyTss is provided', () => {
    const seedHistory: DailyTss[] = [];
    // 60 days of 70 TSS/day to saturate the EWMAs around 70.
    for (let i = 0; i < 60; i++) {
      const d = new Date(`2026-03-01T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + i);
      seedHistory.push({ date: d.toISOString().slice(0, 10), tss: 70 });
    }
    const withSeed = computePass3Inputs({
      upcomingWeekStartDate: '2026-05-11',
      completedLastWeek: [workout('2026-05-04', 70)],
      readinessHistory: readinessHistory(50, WINDOW_DATES),
      seedDailyTss: seedHistory,
    });
    const withoutSeed = computePass3Inputs({
      upcomingWeekStartDate: '2026-05-11',
      completedLastWeek: [workout('2026-05-04', 70)],
      readinessHistory: readinessHistory(50, WINDOW_DATES),
    });
    // Seeded run should have materially higher CTL than un-seeded (starts near 0).
    expect(withSeed.currentCtl).toBeGreaterThan(withoutSeed.currentCtl + 10);
  });

  it('returns zero load with an empty completedLastWeek', () => {
    const out = computePass3Inputs({
      upcomingWeekStartDate: '2026-05-11',
      completedLastWeek: [],
      readinessHistory: readinessHistory(50, WINDOW_DATES),
    });
    expect(out.lastWeekTss).toBe(0);
    expect(out.currentCtl).toBe(0);
    expect(out.currentAtl).toBe(0);
    expect(out.currentTsb).toBe(0);
  });

  it('rejects an invalid upcomingWeekStartDate', () => {
    expect(() =>
      computePass3Inputs({
        upcomingWeekStartDate: 'not-a-date',
        completedLastWeek: [],
        readinessHistory: [],
      }),
    ).toThrow();
  });
});
