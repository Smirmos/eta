import { describe, expect, it } from 'vitest';
import type { AthleteProfile, NextWeekFrame, TrainingAnalysis } from '@eta/shared-types';
import type { KbSlice } from '../plan-generation/pass2/types.js';
import { buildNextWeekPrompt } from './next-week-prompt.js';

const frame: NextWeekFrame = {
  weekStartDate: '2026-07-06', phase: 'build_1', isRecoveryWeek: false, targetVolumeHours: 12.5,
  days: [
    { dayOfWeek: 'mon', role: 'rest', disciplines: [], targetDurationMinutes: 0 },
    { dayOfWeek: 'tue', role: 'quality', disciplines: ['bike'], targetDurationMinutes: 75 },
    { dayOfWeek: 'wed', role: 'aerobic', disciplines: ['swim'], targetDurationMinutes: 60 },
    { dayOfWeek: 'thu', role: 'quality', disciplines: ['run'], targetDurationMinutes: 60 },
    { dayOfWeek: 'fri', role: 'long', disciplines: ['run'], targetDurationMinutes: 90 },
    { dayOfWeek: 'sat', role: 'aerobic', disciplines: ['swim'], targetDurationMinutes: 60 },
    { dayOfWeek: 'sun', role: 'long', disciplines: ['bike'], targetDurationMinutes: 180 },
  ],
  rationale: { weeksUntilRace: 8, volumeAnchorHours: 11.6, rampPct: 0.08, easeTriggered: false },
};
const kb: KbSlice = { zones: 'ZONES', atpStructurePhase: 'BUILD1', workoutsRelevant: 'WORKOUTS', weeklyTemplatesRules: 'RULES', totalChars: 30 };

it('includes the frame days, target, phase and KB slice; instructs JSON-only WeeklyDetail', () => {
  const { system, user } = buildNextWeekPrompt({
    frame, kb,
    profile: { maxWeekdaySessionMinutes: 90 } as AthleteProfile,
    analysis: { overall: { totalHours: 47 }, trend: 'building' } as TrainingAnalysis,
  });
  expect(system).toMatch(/JSON/i);
  expect(user).toContain('2026-07-06');
  expect(user).toContain('build_1');
  expect(user).toContain('12.5');
  expect(user).toContain('WORKOUTS');
  expect(user).toMatch(/rest/); // the Monday rest day appears in the skeleton table
});
