import type { MacroPlanWeek } from '@eta/shared-types';
import { describe, expect, it } from 'vitest';
import type { KnowledgeBase } from '../knowledge-base.loader.js';
import { buildKbSlice } from './pass2-context-builder.js';

// Synthetic KB that mimics the heading structure of the real corpus, so the
// slicer's regexes have something concrete to chew on. Real KB content is
// loaded by the loader in production.
function makeKb(overrides: Partial<KnowledgeBase> = {}): KnowledgeBase {
  const zones = `# Zones\n\nbody for zones.\n`;
  const atpStructure = `# ATP\n\n#### Prep\n\nprep body.\n\n#### Base 1\n\nbase 1 body.\n\n#### Base 3\n\nBASE3 BODY.\nmore base 3.\n\n#### Build 1\n\nbuild 1 body.\n\n#### Race (Race Week)\n\nrace week body.\n`;
  const workouts = `# Workouts\n\n## Appendix B: Swim Workouts (pp. 446-452)\n\nappendix B intro paragraph.\n\n### B/AE1: Recovery\nB/AE1 body.\n\n### B/AE2: Aerobic Endurance Intervals\nB/AE2 body.\n\n### B/SS1: Fast-Form 25s\nB/SS1 body.\n\n## Appendix C: Bike Workouts (pp. 453-464)\n\nappendix C intro paragraph.\n\n### C/AE1: Recovery\nC/AE1 body.\n\n### C/AE2: Aerobic Endurance\nC/AE2 body, IMPORTANT FLOOR.\n\n### C/T1: Functional Threshold Test\nC/T1 body.\n\n## Appendix D: Run Workouts\n\nappendix D intro paragraph.\n\n### D/AE1: Recovery\nD/AE1 body.\n\n### D/AE2: Aerobic Endurance (AE)\nD/AE2 body.\n`;
  const weeklyTemplates = `# Weekly Templates\n\n## Summary\n\nsummary body.\n\n## Workout placement rules\n\nrules 1 through 40.\n\n## Workout codes referenced in this chapter\n\nappendix back-refs.\n`;
  const recovery = `# Recovery\n\nrecovery body.\n`;
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

function makeWeek(overrides: Partial<MacroPlanWeek> = {}): MacroPlanWeek {
  return {
    weekNumber: 15,
    weekStartDate: '2026-05-11',
    phase: 'base_3',
    isRecoveryWeek: false,
    weeklyVolumeHours: 9.5,
    keySessions: [
      {
        workoutCode: 'B/T2' as never, // narrowing relaxed for fixture
        discipline: 'swim',
        dayOfWeek: 'tue',
        rationale: 'Swim T-test',
        citation: 'knowledge-base/03-workouts.md#b-t2',
      },
      {
        workoutCode: 'C/AE2',
        discipline: 'bike',
        dayOfWeek: 'sun',
        rationale: 'Long ride',
        citation: 'knowledge-base/03-workouts.md#c-ae2',
      },
      {
        workoutCode: 'D/AE2',
        discipline: 'run',
        dayOfWeek: 'fri',
        rationale: 'Long run',
        citation: 'knowledge-base/03-workouts.md#d-ae2',
      },
    ],
    ...overrides,
  };
}

describe('buildKbSlice', () => {
  it('includes full zones content unchanged', () => {
    const kb = makeKb();
    const slice = buildKbSlice({ week: makeWeek(), kb });
    expect(slice.zones).toBe(kb.zones);
  });

  it('slices atp-structure to the matching phase section only', () => {
    const slice = buildKbSlice({ week: makeWeek({ phase: 'base_3' }), kb: makeKb() });
    expect(slice.atpStructurePhase).toContain('BASE3 BODY');
    // Adjacent phase bodies must NOT bleed in.
    expect(slice.atpStructurePhase).not.toContain('prep body');
    expect(slice.atpStructurePhase).not.toContain('base 1 body');
    expect(slice.atpStructurePhase).not.toContain('build 1 body');
  });

  it('returns empty atpStructurePhase if the phase heading is missing from KB', () => {
    const kb = makeKb({ atpStructure: '# ATP\n\nno phase headings here\n' });
    const slice = buildKbSlice({ week: makeWeek(), kb });
    expect(slice.atpStructurePhase).toBe('');
  });

  it('includes all four appendix intros in the workouts slice', () => {
    const slice = buildKbSlice({ week: makeWeek(), kb: makeKb() });
    expect(slice.workoutsRelevant).toContain('appendix B intro paragraph');
    expect(slice.workoutsRelevant).toContain('appendix C intro paragraph');
    expect(slice.workoutsRelevant).toContain('appendix D intro paragraph');
  });

  it('includes workout entries referenced by the week keySessions', () => {
    const slice = buildKbSlice({ week: makeWeek(), kb: makeKb() });
    // Week has B/T2 (not present in fixture), C/AE2, D/AE2 — fixture has C/AE2 and D/AE2.
    expect(slice.workoutsRelevant).toContain('C/AE2 body, IMPORTANT FLOOR');
    expect(slice.workoutsRelevant).toContain('D/AE2 body');
  });

  it('always includes fill-in-candidate workout entries (B/AE1, C/AE1, D/AE1, B/SS1) even when the week does not reference them', () => {
    const slice = buildKbSlice({ week: makeWeek(), kb: makeKb() });
    expect(slice.workoutsRelevant).toContain('B/AE1 body');
    expect(slice.workoutsRelevant).toContain('B/SS1 body');
    expect(slice.workoutsRelevant).toContain('C/AE1 body');
    expect(slice.workoutsRelevant).toContain('D/AE1 body');
  });

  it('excludes workout entries not in keySessions and not in the fill-in candidate set', () => {
    const slice = buildKbSlice({ week: makeWeek(), kb: makeKb() });
    // C/T1 is in the fixture KB but not in this week's keySessions and not a fill-in candidate.
    expect(slice.workoutsRelevant).not.toContain('C/T1 body');
    // B/AE2 is also a non-keySession non-fill-in in this fixture (week uses B/T2 instead).
    expect(slice.workoutsRelevant).not.toContain('B/AE2 body');
  });

  it('slices weeklyTemplates to the placement-rules section only', () => {
    const slice = buildKbSlice({ week: makeWeek(), kb: makeKb() });
    expect(slice.weeklyTemplatesRules).toContain('rules 1 through 40');
    expect(slice.weeklyTemplatesRules).not.toContain('summary body');
    expect(slice.weeklyTemplatesRules).not.toContain('appendix back-refs');
  });

  it('includes recovery content only when isRecoveryWeek=true', () => {
    const sliceNormal = buildKbSlice({ week: makeWeek({ isRecoveryWeek: false }), kb: makeKb() });
    expect(sliceNormal.recovery).toBeUndefined();

    const sliceRecovery = buildKbSlice({
      week: makeWeek({ isRecoveryWeek: true }),
      kb: makeKb(),
    });
    expect(sliceRecovery.recovery).toContain('recovery body');
  });

  it('totalChars equals the sum of included section character counts', () => {
    const kb = makeKb();
    const slice = buildKbSlice({ week: makeWeek(), kb });
    const expected =
      slice.zones.length +
      slice.atpStructurePhase.length +
      slice.workoutsRelevant.length +
      slice.weeklyTemplatesRules.length +
      (slice.recovery?.length ?? 0);
    expect(slice.totalChars).toBe(expected);
  });

  it('a sliced KB is materially smaller than the full KB for a typical week', () => {
    // Sanity check: for our fixture, the slice should drop the prep/base_1/build_1/race_week
    // sections of atp-structure and the C/T1 / B/AE2 workout entries.
    const kb = makeKb();
    const slice = buildKbSlice({ week: makeWeek(), kb });
    expect(slice.totalChars).toBeLessThan(kb.totalChars);
  });
});
