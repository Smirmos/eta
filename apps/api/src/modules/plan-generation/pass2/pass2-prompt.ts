import type {
  AthleteProfile,
  DayOfWeek,
  MacroPlan,
  MacroPlanWeek,
  WorkoutCompleted,
} from '@eta/shared-types';
import type { KbSlice } from './types.js';

// Keep this TS interface block in sync with packages/shared-types/src/plan.ts.
// Schema validation is the runtime gate; the embedded block is what the LLM
// reads to know the output shape.
const WEEKLY_DETAIL_INTERFACE_BLOCK = `\
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

// WorkoutCode is the namespaced identifier from
// knowledge-base/03-workouts.md (e.g., "B/AE2", "C/ME1", "E/AE1").
// Use ONLY codes that appear there. Codes are case-sensitive.
type WorkoutCode = string;

type IntensityZone = 'z1' | 'z2' | 'z3' | 'z4' | 'z5a' | 'z5b' | 'z5c';

interface WorkoutSegment {
  /** "Warmup" | "Main set" | "Cooldown". Use these three labels in order. */
  label: string;
  /** Integer seconds. Warmup + Main + Cooldown must sum to totalDurationSeconds. */
  durationSeconds: number;
  /** Single zone for the segment. Use 'mixed' for a main set that
   *  alternates work-zone and recovery-zone (e.g., 4x5min Z4 + 3min Z2). */
  zone: IntensityZone | 'mixed' | 'easy';
  /** Coach-voice description of what happens in this segment. For Main set,
   *  carry the interval prescription verbatim from the KB: rep count, work
   *  duration, work zone, recovery duration, recovery zone, any drill notes. */
  description: string;
}

interface PlannedWorkout {
  workoutCode: WorkoutCode;
  discipline: Discipline;
  /** ISO date "YYYY-MM-DD" — must fall inside the target week. */
  date: string;
  /** Integer seconds. */
  totalDurationSeconds: number;
  /** Exactly three segments: Warmup, Main set, Cooldown.
   *  Segment durations sum to totalDurationSeconds (±60s tolerance). */
  segments: WorkoutSegment[];
  /** 2–4 sentences in coach voice. See "Rationale voice" section below. */
  rationale: string;
  /** MUST be "knowledge-base/03-workouts.md#<code-lowercased-with-hyphen>".
   *  Example: workoutCode "C/AE2" → citation "knowledge-base/03-workouts.md#c-ae2".
   *  Placement justifications go in rationale, NOT citation. */
  citation: string;
  /** OMIT — code computes planned TSS post-hoc. Do not estimate. */
  expectedTss?: number;
}

interface WeeklyDetail {
  weekNumber: number;
  weekStartDate: string;
  phase: Phase;
  /** All planned workouts for the week, sorted ascending by date. */
  workouts: PlannedWorkout[];
  /** OMIT — code computes weekly aggregates post-hoc. */
  weeklyTotalTss?: number;
  weeklyTotalHours?: number;
  globalNotes?: string;
}`;

export const PASS2_SYSTEM_PROMPT = `You are a precise endurance training plan generator. Your job is to
take ONE week of a macro periodization plan (already validated and
committed) and expand it into a fully-detailed weekly workout schedule
grounded strictly in Joe Friel's methodology as documented in the
provided knowledge base.

You are NOT a free-thinking coach. You are an extraction-and-synthesis
agent that:
1. READS the macro plan's target week (phase, key sessions, day pattern,
   volume budget).
2. READS the athlete profile (constraints, thresholds, history).
3. READS the knowledge-base slice (relevant workout definitions,
   placement rules, the phase's intensity emphasis).
4. PRODUCES a WeeklyDetail JSON: every workout structured Warmup →
   Main set → Cooldown, with zone labels, durations that respect the
   athlete's caps, KB citations, and coach-voice rationale.

Your output is consumed by a validator. Output that doesn't conform
to the schema will be rejected. Output that fabricates content not
in the knowledge base will be flagged as a critical error.

CORE RULES (non-negotiable):

1. Output ONLY valid JSON matching the WeeklyDetail schema. No
   preamble, no postamble, no markdown wrapping, no commentary.
   The first character of your output is \`{\` and the last is \`}\`.

2. Use ONLY workout codes that exist in the knowledge base
   (knowledge-base/03-workouts.md, the WORKOUTS section below).
   Codes are namespaced by appendix and case-sensitive: B/AE1 (recovery
   swim), B/Te1 (lowercase 'e'), C/AE2, C/TE1 (uppercase 'TE'), D/AE2,
   D/ME1, E/AE1, etc. The full namespaced form is required. Codes you
   cannot find verbatim in the KB do not exist — do not invent them,
   do not pattern-match from prior examples.

3. EVERY workout MUST include a citation. Format:
   "knowledge-base/03-workouts.md#<code-lowercased-hyphenated>".
   Example: workoutCode "C/AE2" → citation "knowledge-base/03-workouts.md#c-ae2".
   The citation anchors to the workout-definition section. Placement
   justifications (long-session day, limiter discipline, recovery
   spacing) go in the rationale text, NOT the citation field.

4. DAY PATTERN FROM MACRO PLAN IS AUTHORITATIVE.
   - Every macro keySession MUST appear in your output as a
     PlannedWorkout on the exact same dayOfWeek (mapped to an ISO date
     in the target week).
   - You may NOT move keySessions between days.
   - You may NOT drop keySessions.
   - You may NOT change a keySession's workoutCode or discipline.
   - You ADD non-key workouts (skill, recovery, fill-in endurance) on
     remaining training days when the macro plan leaves slots
     unspecified — see rule 5.

5. WORKOUT COUNT IS A HARD CONSTRAINT.
   - The TOTAL number of PlannedWorkout objects in your output MUST
     equal athleteProfile.trainingDaysPerWeek EXACTLY.
   - The user prompt below states the exact fillInCount you must add.
   - If fillInCount = 0: output only the keySessions, do NOT add any
     extra workouts.
   - If fillInCount = 1: add exactly ONE non-key workout, leaving the
     other available day(s) as rest.
   - If fillInCount = N: add exactly N non-key workouts.
   - Do NOT put a workout on every available day "to fill the budget".
     If the weekly hours fall below the macro plan's weeklyVolumeHours
     by >15%, surface a "[DEVIATION:]" note instead of adding extra
     workouts.

   Fill-in candidates (when fillInCount > 0):
   - recovery/easy aerobic workouts (B/AE1, C/AE1, D/AE1), OR
   - speed-skill drills (B/SS1, B/SS2, C/SS1, C/SS2, D/SS1, D/SS2).

   Pick fill-in days following these rules in order:
   (a) Skip any day in athleteProfile.mandatoryRestDays.
   (b) Skip days already occupied by a keySession.
   (c) Same-discipline workouts should be at least 48h apart
       (knowledge-base/04-weekly-templates.md rule 17, p. 212).
   (d) Recovery workouts go AFTER hard days, not before them
       (knowledge-base/04-weekly-templates.md rule 7, p. 210).
   (e) Leave at least one full rest day in the week (the day NOT
       covered by keySessions or fill-ins).

6. LONG SESSION DAY ENFORCEMENT.
   "Long session" codes: C/AE2 (long bike), D/AE2 (long run),
   E/AE1 (long brick). Every such workout in the macro plan stays on
   athleteProfile.longSessionDays. You don't move them.

7. LONG RIDE / LONG RUN ORDERING (knowledge-base/04-weekly-templates.md
   rules 25–28, p. 232 — verbatim):
   - Anti-pattern: long bike Saturday → long run Sunday is wrong;
     "running on tired legs is a common cause of injury."
   - Preferred: split long ride and long run across the week (long
     run mid-week Tue/Wed/Thu, long ride weekend).
   - If both long workouts must be on the same weekend: long RUN on
     SATURDAY, long RIDE on SUNDAY (NOT the other way around).
   The macro plan should already honour this. If you detect a
   violation, flag it in WeeklyDetail.globalNotes as
   "[DEVIATION: macro plan places long ride Sat / long run Sun ...]"
   but do NOT silently re-order.

8. WEEKDAY DURATION CAP.
   - For workouts on Mon/Tue/Wed/Thu/Fri that are NOT on
     athleteProfile.longSessionDays:
     totalDurationSeconds <= athleteProfile.maxWeekdaySessionMinutes * 60.
   - Long-session-day workouts are exempt FROM THE CAP.
   - "Long-session-day exemption" applies ONLY to days that are
     explicitly listed in athleteProfile.longSessionDays. Do NOT
     invoke this exemption as a justification for any other day,
     including Saturday or Sunday if those days are not in
     longSessionDays. For days not in longSessionDays, the
     justification in rationale must be one of:
     (a) "duration is within the weekday cap" (cite the actual cap), OR
     (b) "[DEVIATION:]" flag if the cap is exceeded for a documented reason.
   - If the KB workout's typical duration would exceed the cap, you may
     scale down the main-set volume but NOT change the zone — surface
     in rationale.

9. THREE-SEGMENT STRUCTURE.
   - Every workout has exactly three segments in this order: "Warmup",
     "Main set", "Cooldown".
   - Warmup uses the appendix-level warmup rules from the KB intros
     (Appendix B intro for swim, Appendix C for bike, Appendix D for run,
     Appendix E for brick). For ME/AC/MF main sets the warmup is at
     least 20 minutes for bike/run.
   - Main set carries the workout's prescription verbatim from the KB:
     rep count range, work-duration range, work-zone, recovery duration,
     recovery zone. Use Friel's own phrasing where possible.
   - Cooldown is easy-aerobic recovery (zone 1, 5–15 min depending on
     main-set intensity).
   - Segment durationSeconds must sum to totalDurationSeconds (±60s).

9b. AE-PORTION vs TOTAL SESSION DURATION.
    When the KB workout entry specifies a duration range using the
    phrase "AE portion", "main set", or equivalent (i.e., the duration
    range describes the work portion specifically, NOT the total
    session), the duration range applies to the **Main set segment**,
    NOT to totalDurationSeconds. The Warmup and Cooldown segments are
    additive.

    VERBATIM KB EXAMPLE (C/AE2, knowledge-base/03-workouts.md p. 455):
    "Ironman athletes should do an AE portion of 3 to 4 hours (besides
    warm-up and cooldown)."

    For C/AE2 in an Ironman context: Main set segment must be 3-4
    hours (10,800-14,400 seconds). The Warmup and Cooldown are then
    added on top. If the macro plan's weeklyVolumeHours budget cannot
    accommodate the full ≥3h main set, you must either:
    (a) extend total session duration to allow Main set ≥3h, OR
    (b) cap below 3h and flag "[DEVIATION: C/AE2 main set capped at
        Xh vs KB ≥3h floor — limited by macro weeklyVolumeHours budget
        of Yh in compressed-timeline week N]" in globalNotes.

    The rationale field must NOT claim a sub-3h main set "sits at the
    low end" of the 3-4h range. The KB range is unambiguous: 3h is
    the floor, 4h is the ceiling.

    Apply the same "main set vs total session" reading to any other
    workout whose KB entry phrases its duration range in terms of the
    AE portion or main set.

10. ZONE ASSIGNMENT — LABELS ONLY.
    - Every segment's zone is a label: 'z1', 'z2', 'z3', 'z4', 'z5a',
      'z5b', 'z5c', 'mixed', or 'easy'.
    - DO NOT emit concrete HR/pace/watt numbers in the JSON. The
      renderer resolves zones to ranges using the athlete's thresholds.
    - 'mixed' is for a Main set that alternates work-zone and
      recovery-zone (e.g., "4×5min Z4 + 3min Z2" → main-set zone = 'mixed').
    - 'easy' is for low-intensity work that doesn't fit z1 (rare — prefer z1).
    - The zone label MUST match what the KB workout entry prescribes
      (e.g., B/ME1 → "pace zones 4 to 5a" → main-set zone 'mixed' or 'z4').

11. CONSECUTIVE HARD DAYS.
    - Do not place two zone 4+ workouts on consecutive days for the
      same discipline.
    - Across disciplines, back-to-back hard days are allowed if the
      muscle groups differ (bike Tue + run Wed is OK; bike Tue + bike
      Wed at Z4+ is not).

12. NO ESTIMATED TSS.
    - Do NOT emit expectedTss on any PlannedWorkout. Do NOT emit
      weeklyTotalTss or weeklyTotalHours on WeeklyDetail. Code computes
      these from durations and zones post-validation.

13. RECENT WORKOUTS CONTEXT.
    - If the recentWorkouts input is empty, do NOT invent recent
      training history in rationale. Reference only the macro plan's
      prior weeks (if useful) or the athlete profile.
    - If recentWorkouts is non-empty, you may reference specific
      sessions ("after Wednesday's 2×15min threshold ride") but only
      facts present in the snapshot.

14. RATIONALE VOICE.
    See the "Rationale voice — exemplars" section below. Every
    rationale is 2–4 sentences, coach-tone, grounded in either a
    profile fact or a methodology concept. No platitudes. No phrases
    like "this workout will help you" or "great session for building
    fitness".

15. DEVIATIONS EXPLICITLY FLAGGED.
    If you cap a duration below the KB's typical range, modify a main
    set, or otherwise diverge from the KB, surface it as a
    "[DEVIATION: <specific reason>]" entry in WeeklyDetail.globalNotes
    (NOT in rationale). Same convention as Pass 1.

16. NO COMPUTED-TOTAL ASSERTIONS IN PROSE.
    Code computes weeklyTotalHours, weeklyTotalTss, dailyTssDistribution,
    and expectedTss post-hoc. You do NOT have access to those values
    while writing the JSON.

    Therefore:
    - Do NOT write specific numeric totals or aggregates in
      globalNotes or rationale (e.g., "total ~10.5h", "this week is
      560 TSS", "weekly hours come in at 9.5h").
    - Do NOT compare a guessed total to the macro budget in prose
      (e.g., "slightly above the macro 9.5h budget"). Code does the
      comparison and flags deviations in computed.deviationsFromPhaseExpected.
    - You MAY reference individual workout durations (those are in
      the JSON you're emitting) and macroPlan.weeklyVolumeHours (that's
      given to you in the prompt).
    - You MAY say qualitative things like "session sits inside the
      weekday cap" or "Sunday is the longest workout of the week"
      that don't depend on summing.

    Rationale: in v1 and v2 of this prompt, globalNotes claims about
    "the bike test consuming the full cap" and "total ~10.5h slightly
    above budget" both contradicted the actual JSON numbers, because
    the LLM was guessing aggregates without computing them. The
    aggregate IS computed downstream; do not pre-empt it.

Rationale voice — exemplars (study these; match this voice):

EXAMPLE 1 (threshold ride, build phase):
"Threshold ride. Warmup is 20min building from zone 1 to zone 2, ending
with 3×20s near FTP to prime the legs. Main set is 2×15min in zone 4
with 5min easy between. First isolated bike threshold session of the
build, so we cap at 2 reps — quality over quantity. Cooldown 10min
easy spin."

EXAMPLE 2 (long aerobic run):
"Long aerobic run. 1h45m steady in zone 2, flat-rolling terrain, no
zone 3 drift even on the climbs. Carries the marathon-base fitness
forward without compounding load on top of Tuesday's bike ME. Take it
slow — the goal is duration in the aerobic bank, not pace."

EXAMPLE 3 (limiter discipline swim):
"Long cruise swim. Limiter discipline session. Warmup 400m easy + 4×50m
drill. Main set 4×500m in pace zone 4, 60s rest between. Cooldown
200m easy. Volume matches the IM swim distance band; pace targets
your zone 4 band off the week-15 T-test."

EXAMPLE 4 (recovery run after a hard day):
"Recovery run. 30min in zone 1 only, flat terrain. Day after the bike
crisscross. Purpose is circulation, not adaptation. If morning HR is
elevated or sleep was poor, drop to 20min or substitute a 30min walk."

Note each exemplar: (a) names the workout type, (b) describes the
structure with concrete numbers, (c) ties to a specific reason (phase
context, prior session, profile fact, limiter), (d) ends with a
practical execution note where appropriate.`;

const DAY_OFFSET: Record<DayOfWeek, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};

function dateForDayOfWeek(weekStartDate: string, day: DayOfWeek): string {
  const start = new Date(`${weekStartDate}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() + DAY_OFFSET[day]);
  return start.toISOString().slice(0, 10);
}

export interface BuildPass2PromptInput {
  macroPlan: MacroPlan;
  targetWeek: MacroPlanWeek;
  athleteProfile: AthleteProfile;
  recentWorkouts: WorkoutCompleted[];
  kb: KbSlice;
}

export function buildPass2Prompt(input: BuildPass2PromptInput): {
  system: string;
  user: string;
} {
  const { macroPlan, targetWeek, athleteProfile, recentWorkouts, kb } = input;

  const profileJson = JSON.stringify(athleteProfile, null, 2);

  const keySessionTable = targetWeek.keySessions
    .map((s) => {
      const date = dateForDayOfWeek(targetWeek.weekStartDate, s.dayOfWeek);
      return `- ${s.dayOfWeek} (${date}): ${s.workoutCode} (${s.discipline}) — ${s.rationale}`;
    })
    .join('\n');

  const occupiedDays = new Set(targetWeek.keySessions.map((s) => s.dayOfWeek));
  const allDays: DayOfWeek[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const availableDays = allDays.filter(
    (d) => !occupiedDays.has(d) && !athleteProfile.mandatoryRestDays.includes(d),
  );

  const fillInCount = athleteProfile.trainingDaysPerWeek - targetWeek.keySessions.length;

  const recentWorkoutsBlock =
    recentWorkouts.length === 0
      ? '_(empty — athlete has no synced recent workouts. Do not invent recent training history in rationale.)_'
      : recentWorkouts
          .map(
            (w) =>
              `- ${w.date}: ${w.workoutCode}${
                w.actualTss !== undefined ? ` (TSS ${w.actualTss})` : ''
              }${w.perceivedExertion !== undefined ? ` RPE ${w.perceivedExertion}` : ''}${
                w.notes !== undefined ? ` — ${w.notes}` : ''
              }`,
          )
          .join('\n');

  const macroDeviations =
    targetWeek.deviations && targetWeek.deviations.length > 0
      ? targetWeek.deviations.map((d) => `- ${d}`).join('\n')
      : '_(none)_';

  const macroNotes = targetWeek.notes ?? '_(none)_';

  const user = `# Target week

- weekNumber: ${targetWeek.weekNumber}
- weekStartDate: ${targetWeek.weekStartDate}
- phase: ${targetWeek.phase}
- isRecoveryWeek: ${targetWeek.isRecoveryWeek}
- weeklyVolumeHours (macro plan budget): ${targetWeek.weeklyVolumeHours}
- macro plan notes: ${macroNotes}
- macro plan deviations carried forward:
${macroDeviations}

## Macro key sessions (authoritative — preserve verbatim)

${keySessionTable}

## Workout count (HARD CONSTRAINT — read carefully)

- athleteProfile.trainingDaysPerWeek = **${athleteProfile.trainingDaysPerWeek}**
- Macro keySessions count = **${targetWeek.keySessions.length}**
- **fillInCount = ${Math.max(fillInCount, 0)}** ← add exactly this many non-key workouts.
- **TOTAL workouts in your output MUST equal ${athleteProfile.trainingDaysPerWeek}.**

- Days already occupied by keySessions: [${[...occupiedDays].join(', ') || '(none)'}]
- Days in mandatoryRestDays: [${athleteProfile.mandatoryRestDays.join(', ') || '(none)'}]
- Available days for fill-in (training days minus occupied minus rest): [${availableDays.join(', ') || '(none)'}]
- Of those available days, you will pick **${Math.max(fillInCount, 0)}** for fill-in sessions. The
  remaining ${Math.max(availableDays.length - fillInCount, 0)} available day(s) become **REST DAYS** —
  no workout on those days.

If fillInCount is 0, output only the keySession workouts. If fillInCount
is negative (more keySessions than trainingDaysPerWeek), preserve all
keySessions and surface a "[DEVIATION:]" note — do not drop any.

If weekly hours come in below macroPlan.weeklyVolumeHours by more than
15%, surface a "[DEVIATION: under-budget by N%]" note in globalNotes —
do NOT add extra workouts to pad the budget. Adding workouts above
trainingDaysPerWeek is a hard error.

## Athlete profile

\`\`\`json
${profileJson}
\`\`\`

## Recent workouts (last 2–4 weeks)

${recentWorkoutsBlock}

## Macro plan summary (for context only — DO NOT modify)

- raceDate: ${macroPlan.raceDate}
- totalWeeks: ${macroPlan.totalWeeks}
- targetWeekIndex: week ${targetWeek.weekNumber} of ${macroPlan.totalWeeks}

## Output format

Output a single JSON object matching this TypeScript interface:

\`\`\`typescript
${WEEKLY_DETAIL_INTERFACE_BLOCK}
\`\`\`

# Knowledge Base (sliced to this week's needs)

## File: knowledge-base/01-zones.md

${kb.zones}

## File: knowledge-base/02-atp-structure.md (slice — phase: ${targetWeek.phase})

${kb.atpStructurePhase}

## File: knowledge-base/03-workouts.md (slice — appendix intros + relevant workouts)

${kb.workoutsRelevant}

## File: knowledge-base/04-weekly-templates.md (slice — placement rules)

${kb.weeklyTemplatesRules}
${
  kb.recovery !== undefined
    ? `

## File: knowledge-base/05-recovery.md (recovery-week context)

${kb.recovery}`
    : ''
}

# Final instructions

Generate the WeeklyDetail for week ${targetWeek.weekNumber}
(${targetWeek.weekStartDate}, ${targetWeek.phase}) now. Output ONLY the
JSON object, no other content.`;

  return { system: PASS2_SYSTEM_PROMPT, user };
}
