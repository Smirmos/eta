import type { AthleteProfile, MacroPlan, MacroPlanWeek } from '@eta/shared-types';
import { describe, expect, it } from 'vitest';
import { PASS2_SYSTEM_PROMPT, buildPass2Prompt } from './pass2-prompt.js';
import type { KbSlice, RecentWorkoutSnapshot } from './types.js';

const sampleProfile = (): AthleteProfile => ({
  experienceLevel: 'tri_experienced',
  raceDate: new Date('2026-08-22T00:00:00Z'),
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
  warnings: [],
});

const sampleTargetWeek = (): MacroPlanWeek => ({
  weekNumber: 15,
  weekStartDate: '2026-05-11',
  phase: 'base_3',
  isRecoveryWeek: false,
  weeklyVolumeHours: 9.5,
  keySessions: [
    {
      workoutCode: 'B/T2',
      discipline: 'swim',
      dayOfWeek: 'tue',
      rationale: 'Swim T-pace test',
      citation: 'knowledge-base/03-workouts.md#b-t2',
    },
    {
      workoutCode: 'C/AE2',
      discipline: 'bike',
      dayOfWeek: 'sun',
      rationale: 'Long aerobic ride',
      citation: 'knowledge-base/03-workouts.md#c-ae2',
    },
  ],
  deviations: ['[DEVIATION: capped weekly hours to 9.5]'],
});

const sampleMacroPlan = (): MacroPlan => ({
  athleteProfileId: 'test-arkadiy-2026-08-22-tallinn',
  raceDate: '2026-08-22',
  generatedAt: '2026-05-07T00:00:00Z',
  totalWeeks: 1,
  weeks: [sampleTargetWeek()],
});

const sampleKb = (): KbSlice => ({
  zones: '# zones content',
  atpStructurePhase: '#### Base 3 content',
  workoutsRelevant: '## Appendix B intro\n### B/T2 body\n### C/AE2 body',
  weeklyTemplatesRules: '## placement rules content',
  totalChars: 100,
});

describe('buildPass2Prompt', () => {
  it('returns the verbatim system prompt', () => {
    const { system } = buildPass2Prompt({
      macroPlan: sampleMacroPlan(),
      targetWeek: sampleTargetWeek(),
      athleteProfile: sampleProfile(),
      recentWorkouts: [],
      kb: sampleKb(),
    });
    expect(system).toBe(PASS2_SYSTEM_PROMPT);
  });

  it('system prompt embeds the non-negotiable core rules', () => {
    expect(PASS2_SYSTEM_PROMPT).toContain('Output ONLY valid JSON');
    expect(PASS2_SYSTEM_PROMPT).toContain('case-sensitive');
    expect(PASS2_SYSTEM_PROMPT).toContain('knowledge-base/03-workouts.md#');
    // Hard-coded Friel rule citations from the source
    expect(PASS2_SYSTEM_PROMPT).toContain('rule 17');
    expect(PASS2_SYSTEM_PROMPT).toContain('rules 25–28');
    // Rule 9b: the AE-portion-vs-total-session quote
    expect(PASS2_SYSTEM_PROMPT).toContain('AE portion of 3 to 4 hours');
    // Rule 16: no aggregate-total assertions
    expect(PASS2_SYSTEM_PROMPT).toContain('NO COMPUTED-TOTAL ASSERTIONS');
  });

  it('system prompt includes the four rationale-voice exemplars', () => {
    expect(PASS2_SYSTEM_PROMPT).toContain('EXAMPLE 1');
    expect(PASS2_SYSTEM_PROMPT).toContain('EXAMPLE 2');
    expect(PASS2_SYSTEM_PROMPT).toContain('EXAMPLE 3');
    expect(PASS2_SYSTEM_PROMPT).toContain('EXAMPLE 4');
    // Spot-check that each is one of the agreed exemplars
    expect(PASS2_SYSTEM_PROMPT).toContain('Threshold ride');
    expect(PASS2_SYSTEM_PROMPT).toContain('Long aerobic run');
    expect(PASS2_SYSTEM_PROMPT).toContain('Long cruise swim');
    expect(PASS2_SYSTEM_PROMPT).toContain('Recovery run');
  });

  it('user prompt names the target week, phase, and macro budget', () => {
    const { user } = buildPass2Prompt({
      macroPlan: sampleMacroPlan(),
      targetWeek: sampleTargetWeek(),
      athleteProfile: sampleProfile(),
      recentWorkouts: [],
      kb: sampleKb(),
    });
    expect(user).toContain('weekNumber: 15');
    expect(user).toContain('weekStartDate: 2026-05-11');
    expect(user).toContain('phase: base_3');
    expect(user).toContain('weeklyVolumeHours (macro plan budget): 9.5');
  });

  it('user prompt maps each macro keySession dayOfWeek to an ISO date in the target week', () => {
    const { user } = buildPass2Prompt({
      macroPlan: sampleMacroPlan(),
      targetWeek: sampleTargetWeek(),
      athleteProfile: sampleProfile(),
      recentWorkouts: [],
      kb: sampleKb(),
    });
    // Tue of week 2026-05-11 is 2026-05-12; Sun is 2026-05-17.
    expect(user).toContain('tue (2026-05-12): B/T2');
    expect(user).toContain('sun (2026-05-17): C/AE2');
  });

  it('user prompt computes fillInCount = trainingDaysPerWeek - keySessions.length', () => {
    const { user } = buildPass2Prompt({
      macroPlan: sampleMacroPlan(),
      targetWeek: sampleTargetWeek(),
      athleteProfile: sampleProfile(), // trainingDaysPerWeek=6, 2 keySessions
      recentWorkouts: [],
      kb: sampleKb(),
    });
    expect(user).toContain('fillInCount = 4');
    expect(user).toContain('TOTAL workouts in your output MUST equal 6');
  });

  it('user prompt lists available fill-in days (training days minus occupied minus rest)', () => {
    const { user } = buildPass2Prompt({
      macroPlan: sampleMacroPlan(),
      targetWeek: sampleTargetWeek(),
      athleteProfile: sampleProfile(),
      recentWorkouts: [],
      kb: sampleKb(),
    });
    // Tue and Sun occupied by keySessions; no mandatoryRestDays — Mon/Wed/Thu/Fri/Sat available.
    expect(user).toMatch(/Available days for fill-in[^\n]*: \[mon, wed, thu, fri, sat\]/);
  });

  it('user prompt surfaces an empty-recentWorkouts notice when none provided', () => {
    const { user } = buildPass2Prompt({
      macroPlan: sampleMacroPlan(),
      targetWeek: sampleTargetWeek(),
      athleteProfile: sampleProfile(),
      recentWorkouts: [],
      kb: sampleKb(),
    });
    expect(user).toContain('Do not invent recent training history');
  });

  it('user prompt enumerates non-empty recentWorkouts', () => {
    const recents: RecentWorkoutSnapshot[] = [
      {
        date: '2026-05-04',
        workoutCode: 'D/AE2',
        actualTss: 100,
        perceivedExertion: 6,
        notes: 'felt strong',
      },
    ];
    const { user } = buildPass2Prompt({
      macroPlan: sampleMacroPlan(),
      targetWeek: sampleTargetWeek(),
      athleteProfile: sampleProfile(),
      recentWorkouts: recents,
      kb: sampleKb(),
    });
    expect(user).toContain('2026-05-04: D/AE2 (TSS 100) RPE 6 — felt strong');
  });

  it('user prompt embeds the macro week deviations carried forward', () => {
    const { user } = buildPass2Prompt({
      macroPlan: sampleMacroPlan(),
      targetWeek: sampleTargetWeek(),
      athleteProfile: sampleProfile(),
      recentWorkouts: [],
      kb: sampleKb(),
    });
    expect(user).toContain('[DEVIATION: capped weekly hours to 9.5]');
  });

  it('user prompt embeds the KB slice content under labelled sections', () => {
    const { user } = buildPass2Prompt({
      macroPlan: sampleMacroPlan(),
      targetWeek: sampleTargetWeek(),
      athleteProfile: sampleProfile(),
      recentWorkouts: [],
      kb: sampleKb(),
    });
    expect(user).toContain('# zones content');
    expect(user).toContain('#### Base 3 content');
    expect(user).toContain('## Appendix B intro');
    expect(user).toContain('## placement rules content');
  });

  it('user prompt omits the recovery KB section for a non-recovery week', () => {
    const { user } = buildPass2Prompt({
      macroPlan: sampleMacroPlan(),
      targetWeek: sampleTargetWeek(), // isRecoveryWeek: false
      athleteProfile: sampleProfile(),
      recentWorkouts: [],
      kb: sampleKb(),
    });
    expect(user).not.toContain('05-recovery.md');
  });

  it('user prompt includes the recovery KB section when isRecoveryWeek=true', () => {
    const recoveryWeek: MacroPlanWeek = { ...sampleTargetWeek(), isRecoveryWeek: true };
    const kbWithRecovery: KbSlice = { ...sampleKb(), recovery: '# recovery content' };
    const { user } = buildPass2Prompt({
      macroPlan: sampleMacroPlan(),
      targetWeek: recoveryWeek,
      athleteProfile: sampleProfile(),
      recentWorkouts: [],
      kb: kbWithRecovery,
    });
    expect(user).toContain('05-recovery.md');
    expect(user).toContain('# recovery content');
  });
});
