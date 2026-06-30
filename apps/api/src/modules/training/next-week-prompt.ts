import type { AthleteProfile, NextWeekFrame, TrainingAnalysis } from '@eta/shared-types';
import type { KbSlice } from '../plan-generation/pass2/types.js';

const SYSTEM = `You are an expert triathlon coach. You are given a fixed, safety-checked
skeleton for ONE upcoming training week and must fill in detailed workouts.

Hard rules — output is rejected if any is broken:
- Output ONLY a JSON object matching the WeeklyDetail schema. No prose, no markdown fences.
- weekNumber MUST be 1. weekStartDate and phase MUST equal the values given below.
- One workout per non-rest day, on that day's ISO date. The rest day has NO workout.
- Each workout has EXACTLY 3 segments: a warmup, a main set, and a cooldown. Express
  intervals inside the main-set segment's description (e.g. "3 x 10min Z4 / 5min Z2").
- Use ONLY workout codes that appear in the provided workouts reference.
- Total weekly hours must be within ±10% of the target volume.
- Honour the long-session days, the weekday duration cap, and the day roles.
- Every workout needs a one-sentence coach rationale and a "knowledge-base/..." citation.`;

const DISCIPLINE_BY_NEED = (analysis: TrainingAnalysis): string => {
  const sportSplit = (analysis.overall.sportSplit as Array<{ discipline: string; pctHours: number }>) || [];
  return sportSplit
    .map((s) => `${s.discipline} ${s.pctHours}%`)
    .join(', ');
};

export function buildNextWeekPrompt(input: {
  frame: NextWeekFrame;
  analysis: TrainingAnalysis;
  profile: AthleteProfile;
  kb: KbSlice;
}): { system: string; user: string } {
  const { frame, analysis, profile, kb } = input;

  const dayLines = frame.days
    .map((d) => {
      const date = isoForDayInWeek(frame.weekStartDate, d.dayOfWeek);
      if (d.role === 'rest') return `- ${d.dayOfWeek} (${date}): REST — no workout`;
      const disc = d.disciplines.join('/');
      return `- ${d.dayOfWeek} (${date}): ${d.role} · ${disc} · ~${d.targetDurationMinutes} min`;
    })
    .join('\n');

  const user = `## Week to build
weekStartDate: ${frame.weekStartDate}
phase: ${frame.phase}
isRecoveryWeek: ${frame.isRecoveryWeek}
target weekly volume: ${frame.targetVolumeHours} h
why: ${frame.rationale.weeksUntilRace} weeks to race; anchored on ${frame.rationale.volumeAnchorHours} h recent average; ramp ${(frame.rationale.rampPct * 100).toFixed(0)}%${frame.rationale.easeTriggered ? ' (recovery/ease week)' : ''}

## Day skeleton (fill each non-rest day with one workout on its date)
${dayLines}

## Constraints
weekday session cap: ${profile.maxWeekdaySessionMinutes} min (mon–fri, non-long days)

## Recent training (last 4 weeks)
total: ${analysis.overall.totalHours} h · trend: ${analysis.trend} · sport balance: ${DISCIPLINE_BY_NEED(analysis)}

## Knowledge base
### Zones
${kb.zones}
### Phase (${frame.phase})
${kb.atpStructurePhase}
### Workouts you may use
${kb.workoutsRelevant}
### Placement rules
${kb.weeklyTemplatesRules}${kb.recovery ? `\n### Recovery guidance\n${kb.recovery}` : ''}

Return the WeeklyDetail JSON now.`;

  return { system: SYSTEM, user };
}

function isoForDayInWeek(weekStartDate: string, day: string): string {
  const offset: Record<string, number> = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };
  const d = new Date(`${weekStartDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (offset[day] ?? 0));
  return d.toISOString().slice(0, 10);
}
