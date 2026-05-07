import type { AthleteProfile, DayOfWeek } from '@eta/shared-types';
import type { KnowledgeBase } from '../knowledge-base.loader.js';

// Keep the embedded TS interface block below in sync with
// packages/shared-types/src/plan.ts. Schema validation is the runtime gate; the
// embedded interface is what the LLM reads to know the output shape.
const MACRO_PLAN_INTERFACE_BLOCK = `\
type Discipline = 'swim' | 'bike' | 'run';

type Phase =
  | 'prep'
  | 'base_1'
  | 'base_2'
  | 'base_3'
  | 'build_1'
  | 'build_2'
  | 'peak'
  | 'race_week'
  | 'transition';

// WorkoutCode is the namespaced workout identifier from
// knowledge-base/03-workouts.md (e.g., "B/E1", "C/M3", "E/TB1").
// Use ONLY codes that appear there. Codes are case-sensitive.
type WorkoutCode = string;

interface KeySession {
  workoutCode: WorkoutCode;
  discipline: Discipline;
  /** 1–2 sentences, plain language. */
  rationale: string;
  /** KB reference, e.g. "knowledge-base/02-atp-structure.md#base-3". */
  citation: string;
}

interface MacroPlanWeek {
  /** 1 = race week; counts back from the race. */
  weekNumber: number;
  /** ISO date "YYYY-MM-DD" for Monday of this week. */
  weekStartDate: string;
  phase: Phase;
  isRecoveryWeek: boolean;
  weeklyVolumeHours: number;
  keySessions: KeySession[];
  notes?: string;
  /** "[DEVIATION: reason]" entries for divergence from KB guidance. */
  deviations?: string[];
}

interface MacroPlan {
  athleteProfileId: string;
  /** ISO date. */
  raceDate: string;
  /** ISO timestamp. */
  generatedAt: string;
  totalWeeks: number;
  /** Sorted ascending by weekStartDate. */
  weeks: MacroPlanWeek[];
  globalNotes?: string;
}`;

export const MACRO_PLAN_SYSTEM_PROMPT = `You are a precise endurance training plan generator. You produce
periodized full Ironman training plans grounded strictly in Joe
Friel's methodology as documented in the provided knowledge base.

You are not a free-thinking coach. You are an extraction-and-
synthesis agent that:
1. READS the athlete profile (their fitness, constraints, race date)
2. READS the knowledge base (Friel's published methodology)
3. APPLIES the methodology to the athlete to produce a structured
   plan that another system can validate

Your output is consumed by a validator. Output that doesn't conform
to the schema will be rejected. Output that fabricates content not
in the knowledge base will be flagged as a critical error.

CORE RULES (non-negotiable):

1. Output ONLY valid JSON matching the MacroPlan schema. No
   preamble, no postamble, no markdown wrapping, no commentary.
   The first character of your output is \`{\` and the last is \`}\`.

2. Use ONLY workout codes that exist in the knowledge base
   (knowledge-base/03-workouts.md). Codes are namespaced by
   appendix: B/E1, C/E2, D/M3, E/TB1, etc. The full namespaced
   form is required. Codes you cannot find in the KB do not exist
   — do not invent them.

3. Every keySession entry MUST include a citation field pointing
   to the knowledge-base/ file and section that justifies the
   workout. Format: "knowledge-base/02-atp-structure.md#base-3"
   or "knowledge-base/03-workouts.md#b-e2".

4. Every phase decision (duration, volume %, key sessions) must
   trace back to specific KB content. If the KB doesn't cover
   something the athlete needs, FLAG it in the deviations[] array
   with format "[DEVIATION: reason]".

5. Workout codes are CASE-SENSITIVE. B/Te1 (lowercase 'e') is a
   different code from C/TE1 (uppercase). Match the KB exactly.

6. weeks[] must be contiguous, sorted ascending by weekStartDate,
   each exactly 7 days after the previous. weekNumber counts BACK
   from race week (week 1 = race week, week 15 = first week of
   plan).

7. Phase transitions must follow Friel order:
   prep → base_1 → base_2 → base_3 → build_1 → build_2 → peak →
   race_week → transition. You can skip phases (and you should,
   given this athlete's compressed timeline) but never go backwards.

8. weeklyVolumeHours must respect the athlete's plannedWeeklyHours
   ceiling. Volume should ramp from min(recentWeeklyHours,
   plannedWeeklyHours) toward plannedWeeklyHours.`;

const DAY_NAME_BY_INDEX: Record<number, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dayOfWeekUtc(d: Date): string {
  return DAY_NAME_BY_INDEX[d.getUTCDay()] ?? 'Unknown';
}

// Used so the embedded JSON has an athleteProfileId placeholder; the orchestrator
// supplies the real id via the prompt parameter so the LLM echoes it back.
export interface BuildMacroPlanPromptInput {
  profile: AthleteProfile;
  athleteProfileId: string;
  kb: KnowledgeBase;
  /** Override "today" — primarily for deterministic tests. */
  now?: Date;
}

export function buildMacroPlanPrompt(input: BuildMacroPlanPromptInput): {
  system: string;
  user: string;
} {
  const { profile, athleteProfileId, kb, now } = input;
  const today = now ?? new Date();

  const raceDateIso = isoDate(profile.raceDate);
  const todayIso = isoDate(today);
  const raceDayOfWeek = dayOfWeekUtc(profile.raceDate);

  const profileForPrompt = { athleteProfileId, ...profile };
  const profileJson = JSON.stringify(profileForPrompt, null, 2);

  const warningsList =
    profile.warnings.length === 0
      ? '_(none)_'
      : profile.warnings.map((w) => `- WARNING: ${w}`).join('\n');

  const longSessionDays: DayOfWeek[] = profile.longSessionDays;
  const longSessionDaysText =
    longSessionDays.length === 0 ? 'none specified' : longSessionDays.join(', ');

  const user = `# Athlete Profile

\`\`\`json
${profileJson}
\`\`\`

# Critical Context

- Today's date: ${todayIso}
- Race date: ${raceDateIso}
- Weeks until race: ${profile.weeksUntilRace}
- Race day-of-week: ${raceDayOfWeek}
- Athlete's preferred long-session days: ${longSessionDaysText}
- athleteProfileId to echo in output: "${athleteProfileId}"

## Compressed-timeline guidance

This athlete has ${profile.weeksUntilRace} weeks. Friel's canonical full
IM build is 24-28 weeks. Use Friel's Figure 7.3 ("subsequent A
race, 12-16 weeks") template from knowledge-base/02-atp-structure.md
as the structural anchor. This template specifically OMITS Build 1.

Phase allocation guidance for compressed timeline:
- Skip Prep entirely (athlete is already trained)
- Skip Base 1 entirely (athlete has aerobic base from marathons +
  half IM)
- Compress Base 2 + Base 3 to 4-6 weeks combined
- Build 2: 4-5 weeks (the meat of IM-specific work)
- Peak: 2 weeks
- Race Week: 1 week
- (No transition phase pre-race — that's post-race recovery)

Adjust per the actual KB tables. If KB content disagrees with
this guidance, follow KB.

## Athlete-specific considerations

${warningsList}

## ${raceDayOfWeek} race handling

This race is on a ${raceDayOfWeek}. Friel's race-week template (Table 8.6F
in knowledge-base/04-weekly-templates.md) shows a Sunday race.
${
  raceDayOfWeek === 'Sunday'
    ? 'No mirror-shift needed — use the template as-is.'
    : `Mirror the taper backward so the longest pre-race rest aligns with race-day:
- Race day → ${raceDayOfWeek}
- Re-map every other day in the template by the same offset (the day
  before the race in the template becomes the day before this athlete's
  race, etc.)
- The day(s) after the race become complete rest / travel-home.`
}

## Output format

Output a single JSON object matching this TypeScript interface:

\`\`\`typescript
${MACRO_PLAN_INTERFACE_BLOCK}
\`\`\`

# Knowledge Base

The following are extracted methodology files from Joe Friel's
*The Triathlete's Training Bible* (5th ed.). Cite specific files
and sections in your plan output.

## File: knowledge-base/01-zones.md

${kb.zones}

## File: knowledge-base/02-atp-structure.md

${kb.atpStructure}

## File: knowledge-base/03-workouts.md

${kb.workouts}

## File: knowledge-base/04-weekly-templates.md

${kb.weeklyTemplates}

## File: knowledge-base/05-recovery.md

${kb.recovery}

# Final Instructions

Generate the MacroPlan now. Output ONLY the JSON object, no
other content.`;

  return { system: MACRO_PLAN_SYSTEM_PROMPT, user };
}
