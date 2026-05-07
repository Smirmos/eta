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
    expect(MACRO_PLAN_SYSTEM_PROMPT).toContain('B/ME1, B/ME2, B/ME3');
  });
});
