import { describe, expect, it, vi } from 'vitest';
import type { AthleteProfile, TrainingAnalysis, WeeklyDetail } from '@eta/shared-types';
import type { ConfigService } from '@nestjs/config';
import type { KnowledgeBaseLoader } from '../plan-generation/knowledge-base.loader.js';
import { NextWeekGenerationError, NextWeekGenerationService } from './next-week-generation.service.js';

const ASOF = new Date('2026-06-30T00:00:00Z'); // week start 2026-07-06; sat=07-11, sun=07-12

function profile(): AthleteProfile {
  return {
    raceDate: new Date('2026-09-21T00:00:00Z'),
    trainingDaysPerWeek: 2, longSessionDays: ['sat'], mandatoryRestDays: [],
    maxWeekdaySessionMinutes: 360, plannedWeeklyHours: 10,
    disciplineDistribution: { swimPercent: 16, bikePercent: 59, runPercent: 25 },
  } as unknown as AthleteProfile;
}
function analysis(): TrainingAnalysis {
  return {
    hasData: true, window: { from: '2026-06-03', asOf: '2026-06-30' },
    overall: {
      totalSessions: 8, totalHours: 40, trainingDays: 8, avgSessionsPerWeek: 2, avgTrainingDaysPerWeek: 2,
      sportSplit: [
        { discipline: 'swim', sessions: 2, hours: 2, pctHours: 16 },
        { discipline: 'bike', sessions: 4, hours: 6, pctHours: 59 },
        { discipline: 'run', sessions: 2, hours: 2, pctHours: 25 },
      ],
    },
    perWeek: [
      { weekStart: '2026-06-03', hours: 10 },
      { weekStart: '2026-06-10', hours: 10 },
      { weekStart: '2026-06-17', hours: 10 },
      { weekStart: '2026-06-24', hours: 10 },
    ].map((w) => ({ weekStart: w.weekStart, sessions: 2, hours: w.hours, byDiscipline: {}, bikeTss: null })),
    trend: 'steady', longestSessions: [], dataNote: { tssCoverage: 'bike_only', staleDays: 0 },
  } as TrainingAnalysis;
}

// anchor = 10h, base_3 ramp +5% → target 10.5h. Two training days: sun (aerobic) + sat (long).
function okDetail(totalHours = 10.5): WeeklyDetail {
  const sat = Math.round((totalHours * 3600) * 0.55);
  const sun = Math.round(totalHours * 3600) - sat;
  const seg = (secs: number, zone: string) => [
    { label: 'Warmup', durationSeconds: Math.round(secs * 0.1), zone: 'z1', description: 'easy' },
    { label: 'Main', durationSeconds: secs - Math.round(secs * 0.1) - Math.round(secs * 0.1), zone, description: 'steady' },
    { label: 'Cooldown', durationSeconds: Math.round(secs * 0.1), zone: 'z1', description: 'easy' },
  ];
  return {
    weekNumber: 1, weekStartDate: '2026-07-06', phase: 'base_3',
    workouts: [
      { workoutCode: 'B/AE1', discipline: 'bike', date: '2026-07-11', totalDurationSeconds: sat, segments: seg(sat, 'z2'), rationale: 'Long aerobic ride.', citation: 'knowledge-base/03-workouts.md#b-ae1' },
      { workoutCode: 'C/AE1', discipline: 'run', date: '2026-07-12', totalDurationSeconds: sun, segments: seg(sun, 'z2'), rationale: 'Aerobic run.', citation: 'knowledge-base/03-workouts.md#c-ae1' },
    ],
  } as WeeklyDetail;
}

function makeService(detail: WeeklyDetail | string): NextWeekGenerationService {
  const config = { get: (k: string) => (k === 'ANTHROPIC_MODEL' ? 'claude' : k === 'ANTHROPIC_MAX_TOKENS' ? 8000 : 'key') } as unknown as ConfigService<never, true>;
  const kbLoader = { get: () => ({ zones: 'z', atpStructure: '#### Base 3\nb3', workouts: '### B/AE1: x\n### C/AE1: y', weeklyTemplates: '## Workout placement rules\nr', recovery: 'rec', totalChars: 1, loadedFrom: 't' }) } as unknown as KnowledgeBaseLoader;
  const text = typeof detail === 'string' ? detail : JSON.stringify(detail);
  const factory = () => ({ messages: { create: vi.fn(async () => ({ content: [{ type: 'text', text }], usage: { input_tokens: 1, output_tokens: 1 } })) } });
  return new NextWeekGenerationService(config, kbLoader, factory as never);
}

describe('NextWeekGenerationService', () => {
  it('generates a WeeklyDetail and annotates computed TSS/hours', async () => {
    const svc = makeService(okDetail());
    const { frame, weeklyDetail } = await svc.generate({ profile: profile(), analysis: analysis(), asOf: ASOF });
    expect(frame.weekStartDate).toBe('2026-07-06');
    expect(weeklyDetail.workouts).toHaveLength(2);
    expect(weeklyDetail.weeklyTotalHours).toBeGreaterThan(0); // annotated in code
    expect(weeklyDetail.workouts[0]!.expectedTss).toBeGreaterThan(0);
  });

  it('rejects a week whose volume is >10% off target', async () => {
    const svc = makeService(okDetail(20));
    await expect(svc.generate({ profile: profile(), analysis: analysis(), asOf: ASOF })).rejects.toThrow(NextWeekGenerationError);
  });

  it('rejects non-JSON model output', async () => {
    const svc = makeService('sorry, here is your plan:');
    await expect(svc.generate({ profile: profile(), analysis: analysis(), asOf: ASOF })).rejects.toThrow(NextWeekGenerationError);
  });
});
