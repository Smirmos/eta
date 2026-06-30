import type { AthleteProfile, NextWeekFrame, TrainingAnalysis } from '@eta/shared-types';
import type { KbSlice } from '../plan-generation/pass2/types.js';

const SYSTEM = `You are an expert triathlon coach. You are given a fixed, safety-checked
skeleton for ONE upcoming training week and must fill in detailed workouts.

Hard rules — output is rejected if any is broken:
- Output ONLY a JSON object matching the WeeklyDetail schema. No prose, no markdown fences.
  The first character of your output MUST be \`{\` and the last MUST be \`}\`.
- weekNumber MUST be 1. weekStartDate and phase MUST equal the values given below.
- One workout per non-rest day, on that day's ISO date. The rest day has NO workout.
- Each workout has EXACTLY 3 segments: a warmup, a main set, and a cooldown. Express
  intervals inside the main-set segment's description (e.g. "3 x 10min Z4 / 5min Z2").
- Use ONLY workout codes that appear in the provided workouts reference.
- Total weekly hours must be within ±10% of the target volume.
- Honour the long-session days, the weekday duration cap, and the day roles.
- Every workout needs a one-sentence coach rationale and a "knowledge-base/..." citation.
- Do NOT emit expectedTss, weeklyTotalTss, or weeklyTotalHours — those are computed in code.
- workoutCode prefix MUST match discipline: B/... = swim, C/... = bike, D/... = run.
  A swim workout MUST use a B/... code; a bike workout MUST use a C/... code; a run workout
  MUST use a D/... code. Any other pairing is INVALID and will be rejected.

## OUTPUT SHAPE (exact field names required — validator rejects any deviation)

Top-level object:
  {
    "weekNumber": 1,                          // number — MUST be 1
    "weekStartDate": "YYYY-MM-DD",            // string — MUST equal the given weekStartDate
    "phase": "<phase>",                       // string — MUST equal the given phase
    "workouts": [ /* one object per non-rest day */ ]
  }

Each workout object inside "workouts":
  {
    "workoutCode": "B/AE1",                   // string — code from the WORKOUTS reference
    "discipline": "swim",                     // "swim" | "bike" | "run"
    "date": "YYYY-MM-DD",                     // ISO date of that day within the week
    "totalDurationSeconds": 3600,             // integer > 0
    "segments": [ /* EXACTLY 3 objects */ ],  // warmup, main set, cooldown in order
    "rationale": "Coach-voice sentence.",     // non-empty string
    "citation": "knowledge-base/03-workouts.md#b-ae1"  // must start with "knowledge-base/"
  }

Each segment object inside "segments" (exactly 3 per workout):
  {
    "label": "Warmup",           // non-empty string — use "Warmup", "Main set", "Cooldown"
    "durationSeconds": 600,      // integer > 0
    "zone": "z2",                // "z1"|"z2"|"z3"|"z4"|"z5a"|"z5b"|"z5c"|"mixed"|"easy"
                                 // use "mixed" for an interval main set (work + recovery zones)
    "description": "Easy aerobic warm-up."  // string — for main set, include rep/duration/zone details
  }

Constraint: the three segments' durationSeconds MUST sum to the workout's totalDurationSeconds (±60s).

## CONCRETE EXAMPLE (study the structure — match exact field names)

{
  "weekNumber": 1,
  "weekStartDate": "2026-07-07",
  "phase": "build_1",
  "workouts": [
    {
      "workoutCode": "C/ME1",
      "discipline": "bike",
      "date": "2026-07-08",
      "totalDurationSeconds": 4500,
      "segments": [
        {
          "label": "Warmup",
          "durationSeconds": 900,
          "zone": "z2",
          "description": "15 min easy spin building from Z1 to Z2."
        },
        {
          "label": "Main set",
          "durationSeconds": 3000,
          "zone": "mixed",
          "description": "3×10min Z4 / 5min Z2 recovery between reps."
        },
        {
          "label": "Cooldown",
          "durationSeconds": 600,
          "zone": "z1",
          "description": "10 min easy spin to flush the legs."
        }
      ],
      "rationale": "First threshold bike of the build phase — 3 reps to establish quality over quantity within the weekday cap.",
      "citation": "knowledge-base/03-workouts.md#c-me1"
    }
  ]
}`;

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
