import type { AthleteProfile } from '@eta/shared-types';
import { describe, expect, it } from 'vitest';
import type { KnowledgeBase } from '../knowledge-base.loader.js';
import { MACRO_PLAN_SYSTEM_PROMPT, buildMacroPlanPrompt } from './macro-plan.prompt.js';

const sampleProfile = (raceDate: Date): AthleteProfile => ({
  experienceLevel: 'tri_experienced',
  raceDate,
  raceType: 'full_ironman',
  weeksUntilRace: 15,
  recentWeeklyHours: { value: 9, confidence: 'medium', source: 'self_reported' },
  plannedWeeklyHours: 11,
  longestRecentSessions: {
    swimMeters: { value: 3000, confidence: 'high', source: 'self_reported' },
    bikeMinutes: { value: 300, confidence: 'high', source: 'self_reported' },
    runMinutes: { value: 240, confidence: 'high', source: 'self_reported' },
  },
  thresholds: {
    swimTPacePer100m: { value: '2:30', confidence: 'medium', source: 'estimated' },
    bikeFtpWatts: { value: 170, confidence: 'medium', source: 'estimated' },
    bikeThresholdHr: { value: 165, confidence: 'medium', source: 'estimated' },
    runThresholdPacePerKm: { value: '4:00', confidence: 'high', source: 'self_reported' },
    runThresholdHr: { value: 180, confidence: 'high', source: 'self_reported' },
  },
  disciplineDistribution: { swimPercent: 15, bikePercent: 50, runPercent: 35 },
  fitnessTrend: 'stable',
  trainingDaysPerWeek: 6,
  longSessionDays: ['fri', 'sun'],
  mandatoryRestDays: [],
  maxWeekdaySessionMinutes: 90,
  currentInjuries: [],
  recentIllnessOrTimeOff: false,
  raceHistory: [],
  source: 'mixed',
  overallConfidence: 'medium',
  generatedAt: new Date('2026-05-07T00:00:00Z'),
  warnings: ['Compressed timeline: 15 weeks until race'],
});

const sampleKb = (): KnowledgeBase => ({
  zones: '# zones',
  atpStructure: '# atp',
  workouts: '# workouts',
  weeklyTemplates: '# weekly',
  recovery: '# recovery',
  totalChars: 100,
  loadedFrom: '/tmp/kb',
});

describe('buildMacroPlanPrompt', () => {
  it('returns the verbatim system prompt', () => {
    const { system } = buildMacroPlanPrompt({
      profile: sampleProfile(new Date('2026-08-22T00:00:00Z')),
      athleteProfileId: 'pid-1',
      kb: sampleKb(),
      now: new Date('2026-05-07T00:00:00Z'),
    });
    expect(system).toBe(MACRO_PLAN_SYSTEM_PROMPT);
    expect(system).toContain('Output ONLY valid JSON');
    expect(system).toContain('CASE-SENSITIVE');
  });

  it('interpolates ISO dates and computed day-of-week for a Saturday race', () => {
    const { user } = buildMacroPlanPrompt({
      profile: sampleProfile(new Date('2026-08-22T00:00:00Z')), // Saturday
      athleteProfileId: 'test-arkadiy-2026-08-22-tallinn',
      kb: sampleKb(),
      now: new Date('2026-05-07T00:00:00Z'),
    });
    expect(user).toContain("Today's date: 2026-05-07");
    expect(user).toContain('Race date: 2026-08-22');
    expect(user).toContain('Race day-of-week: Saturday');
    expect(user).toContain('Saturday race handling');
    expect(user).toContain('Race day → Saturday');
    expect(user).toContain('test-arkadiy-2026-08-22-tallinn');
  });

  it('skips the mirror-shift instructions for a Sunday race', () => {
    const { user } = buildMacroPlanPrompt({
      profile: sampleProfile(new Date('2026-08-23T00:00:00Z')), // Sunday
      athleteProfileId: 'pid-2',
      kb: sampleKb(),
      now: new Date('2026-05-07T00:00:00Z'),
    });
    expect(user).toContain('Race day-of-week: Sunday');
    expect(user).toContain('No mirror-shift needed');
    expect(user).not.toContain('Re-map every other day');
  });

  it('embeds warnings as bulleted WARNING lines', () => {
    const { user } = buildMacroPlanPrompt({
      profile: sampleProfile(new Date('2026-08-22T00:00:00Z')),
      athleteProfileId: 'pid-1',
      kb: sampleKb(),
      now: new Date('2026-05-07T00:00:00Z'),
    });
    expect(user).toContain('- WARNING: Compressed timeline: 15 weeks until race');
  });

  it('embeds the athleteProfileId inside the JSON profile block', () => {
    const { user } = buildMacroPlanPrompt({
      profile: sampleProfile(new Date('2026-08-22T00:00:00Z')),
      athleteProfileId: 'pid-xyz',
      kb: sampleKb(),
      now: new Date('2026-05-07T00:00:00Z'),
    });
    expect(user).toContain('"athleteProfileId": "pid-xyz"');
  });

  it('includes the MacroPlan TS interface and references all 5 KB files', () => {
    const { user } = buildMacroPlanPrompt({
      profile: sampleProfile(new Date('2026-08-22T00:00:00Z')),
      athleteProfileId: 'pid-1',
      kb: sampleKb(),
      now: new Date('2026-05-07T00:00:00Z'),
    });
    expect(user).toContain('interface MacroPlan {');
    expect(user).toContain('interface MacroPlanWeek {');
    expect(user).toContain('interface KeySession {');
    expect(user).toContain('dayOfWeek: DayOfWeek');
    expect(user).toContain('## File: knowledge-base/01-zones.md');
    expect(user).toContain('## File: knowledge-base/02-atp-structure.md');
    expect(user).toContain('## File: knowledge-base/03-workouts.md');
    expect(user).toContain('## File: knowledge-base/04-weekly-templates.md');
    expect(user).toContain('## File: knowledge-base/05-recovery.md');
  });

  it('uses the corrected Figure 7.3 / 7.4 distinction (Build 1 kept in 12-16w)', () => {
    const { user } = buildMacroPlanPrompt({
      profile: sampleProfile(new Date('2026-08-22T00:00:00Z')),
      athleteProfileId: 'pid-1',
      kb: sampleKb(),
      now: new Date('2026-05-07T00:00:00Z'),
    });
    expect(user).toContain('Figure 7.3 (12-16 week scenario)');
    expect(user).toContain('KEEPS Build 1');
    expect(user).toContain('Figure 7.4 (7-11 week scenario)');
    expect(user).toContain('OMITS Build 1');
    // The old, incorrect claim must no longer appear.
    expect(user).not.toContain('Figure 7.3 ("subsequent A\nrace, 12-16 weeks")');
    expect(user).not.toContain('This template specifically OMITS Build 1');
  });

  it('system prompt includes split deviation rules (4a, 4b) and limiter-discipline rule 9', () => {
    expect(MACRO_PLAN_SYSTEM_PROMPT).toContain('4a. EVERY non-trivial deviation');
    expect(MACRO_PLAN_SYSTEM_PROMPT).toContain('4b. NO FABRICATED JUSTIFICATIONS');
    expect(MACRO_PLAN_SYSTEM_PROMPT).toContain('9. LIMITER DISCIPLINE EMPHASIS');
    // Verified breakthrough codes (per Appendix B taxonomy) appear individually:
    expect(MACRO_PLAN_SYSTEM_PROMPT).toContain('B/AE2 (Aerobic Endurance Intervals)');
    expect(MACRO_PLAN_SYSTEM_PROMPT).toContain('B/MF1 (Muscular Force Reps)');
    expect(MACRO_PLAN_SYSTEM_PROMPT).toContain('B/AC1 (VO2max Intervals)');
    expect(MACRO_PLAN_SYSTEM_PROMPT).toContain('B/AE1 (Recovery');
  });

  it('system prompt includes rule 10 LONG SESSION DAY ENFORCEMENT', () => {
    expect(MACRO_PLAN_SYSTEM_PROMPT).toContain('10. LONG SESSION DAY ENFORCEMENT');
    expect(MACRO_PLAN_SYSTEM_PROMPT).toContain('C/AE2 (Aerobic Endurance — long bike)');
    expect(MACRO_PLAN_SYSTEM_PROMPT).toContain('D/AE2 (Aerobic Endurance — long run)');
    expect(MACRO_PLAN_SYSTEM_PROMPT).toContain('Do NOT add a third long session');
  });

  it('system prompt includes rule 11 (trainingDaysPerWeek handling) with KB flag and drop ladder', () => {
    expect(MACRO_PLAN_SYSTEM_PROMPT).toContain('11. TRAININGDAYSPERWEEK HANDLING');
    // KB-flag passthrough so the LLM knows non-7-day is interpolation.
    expect(MACRO_PLAN_SYSTEM_PROMPT).toContain(
      'KB DOES NOT provide 5/6/7-day-per-week variants',
    );
    expect(MACRO_PLAN_SYSTEM_PROMPT).toContain('plan-side interpolation');
    // Per-phase canonical session counts must be embedded so the LLM doesn't
    // re-derive them from a hallucinated source.
    expect(MACRO_PLAN_SYSTEM_PROMPT).toContain('Base 3   (Table 8.6C): 13 sessions');
    expect(MACRO_PLAN_SYSTEM_PROMPT).toContain('Race wk  (Table 8.6F):  7 sessions');
    // Drop ladder, all four tiers + always-keep block.
    expect(MACRO_PLAN_SYSTEM_PROMPT).toContain('DROP-PRIORITY LADDER');
    expect(MACRO_PLAN_SYSTEM_PROMPT).toContain('Tier 1 (drop first):');
    expect(MACRO_PLAN_SYSTEM_PROMPT).toContain('Tier 4 (drop last):');
    expect(MACRO_PLAN_SYSTEM_PROMPT).toContain('ALWAYS KEEP');
    // Citation format the LLM must produce. The literal in the prompt
    // wraps across a newline so we assert each significant token separately.
    expect(MACRO_PLAN_SYSTEM_PROMPT).toContain('derives from KB Table 8.6X');
    expect(MACRO_PLAN_SYSTEM_PROMPT).toMatch(
      /dropped Y for\s+trainingDaysPerWeek=6/,
    );
    // Rule-22 reckoning for 5-day case.
    expect(MACRO_PLAN_SYSTEM_PROMPT).toContain(
      'trainingDaysPerWeek=5 violates rule 22',
    );
  });

  it('system prompt rule 8 clarifies day count does not reduce total volume', () => {
    expect(MACRO_PLAN_SYSTEM_PROMPT).toContain(
      'trainingDaysPerWeek does NOT reduce weeklyVolumeHours',
    );
    expect(MACRO_PLAN_SYSTEM_PROMPT).toContain('affects DAY DISTRIBUTION');
  });

  it('user prompt surfaces trainingDaysPerWeek + the expected keySession count for the athlete', () => {
    const profile6 = sampleProfile(new Date('2026-08-22T00:00:00Z'));
    // The sample profile is already trainingDaysPerWeek=6.
    const { user: user6 } = buildMacroPlanPrompt({
      profile: profile6,
      athleteProfileId: 'pid-6',
      kb: sampleKb(),
      now: new Date('2026-05-07T00:00:00Z'),
    });
    expect(user6).toContain('Training days per week: 6');
    expect(user6).toContain('KeySessions count per working week: 5');
    expect(user6).toContain('At 6 days/week, drop 1 session(s) per the ladder');
    expect(user6).toContain('trainingDaysPerWeek=6');
  });

  it('user prompt skips the deviation framing when trainingDaysPerWeek=7', () => {
    const p = sampleProfile(new Date('2026-08-22T00:00:00Z'));
    p.trainingDaysPerWeek = 7;
    const { user } = buildMacroPlanPrompt({
      profile: p,
      athleteProfileId: 'pid-7',
      kb: sampleKb(),
      now: new Date('2026-05-07T00:00:00Z'),
    });
    expect(user).toContain('Training days per week: 7');
    expect(user).toContain('KeySessions count per working week: 6');
    expect(user).toContain('use Tables 8.6A–F as-is');
    expect(user).not.toContain('drop 0 session');
  });

  it('user prompt surfaces the 5-day case correctly (drop 2 sessions, keySessions=4)', () => {
    const p = sampleProfile(new Date('2026-08-22T00:00:00Z'));
    p.trainingDaysPerWeek = 5;
    const { user } = buildMacroPlanPrompt({
      profile: p,
      athleteProfileId: 'pid-5',
      kb: sampleKb(),
      now: new Date('2026-05-07T00:00:00Z'),
    });
    expect(user).toContain('Training days per week: 5');
    expect(user).toContain('KeySessions count per working week: 4');
    expect(user).toContain('drop 2 session(s) per the ladder');
    expect(user).toContain('trainingDaysPerWeek=5');
  });

  it('system prompt does not reference workout codes that do not exist in the KB allowlist', () => {
    // Regression guard: prior versions referenced B/E1, B/M1, B/M2 which are
    // not in WORKOUT_CODES — the LLM hallucinated them as a result.
    const bogus = [
      ' B/E1 ',
      ' B/E1,',
      ' B/E1)',
      ' B/M1 ',
      ' B/M1,',
      ' B/M1)',
      ' B/M2 ',
      ' B/M2,',
      ' B/M2)',
    ];
    for (const fragment of bogus) {
      expect(MACRO_PLAN_SYSTEM_PROMPT).not.toContain(fragment);
    }
  });
});
