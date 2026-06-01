import type { AthleteProfile, DayOfWeek, WeeklyDetail, WorkoutCompleted } from '@eta/shared-types';
import type { HardRuleOutput, Pass3ComputedInputs, Pass3KbSlice } from './types.js';

const DAY_BY_INDEX: ReadonlyArray<DayOfWeek> = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
];

// Keep this TS interface block in sync with packages/shared-types/src/plan.ts
// (AdaptationSuggestion, WorkoutAdjustment, AdaptationAction). Schema validation
// is the runtime gate; the embedded block is what the LLM reads to know the
// output shape.
const ADAPTATION_SUGGESTION_INTERFACE_BLOCK = `\
type AdaptationAction = 'keep' | 'modify' | 'replace';

// IntensityZone — same set as the WeeklyDetail schema.
type IntensityZone = 'z1' | 'z2' | 'z3' | 'z4' | 'z5a' | 'z5b' | 'z5c';

// WorkoutCode is the namespaced identifier from
// knowledge-base/03-workouts.md (e.g., "B/AE2", "C/ME1", "E/AE1").
// Use ONLY codes that appear there. Codes are case-sensitive.
type WorkoutCode = string;

interface WorkoutAdjustment {
  /** ISO date of the workout in the upcoming week being acted on. */
  originalDate: string;
  originalWorkoutCode: WorkoutCode;
  action: AdaptationAction;

  /** REQUIRED iff action='replace'. KB-valid code. */
  newWorkoutCode?: WorkoutCode;
  /** OPTIONAL for action='modify'. Positive integer. */
  newDurationSeconds?: number;
  /** OPTIONAL for action='modify'. */
  newZone?: IntensityZone | 'mixed';
  /** OPTIONAL — to move the workout to a different ISO date inside the upcoming week. */
  newDate?: string;

  /** 2-3 sentences, coach voice. Tie to concrete evidence (RPE, TSB, missed workout, low readiness). */
  reasoning: string;
  /** "knowledge-base/<file>.md#<anchor>". Empty string not allowed. */
  citation: string;
}

interface AdaptationSuggestion {
  /** ISO date of the Monday of the upcoming week. */
  forWeekStart: string;
  /** ISO datetime — generation timestamp. */
  generatedAt: string;
  /** Code provides these; copy verbatim into your output. */
  inputs: {
    lastWeekTss: number;
    currentCtl: number;
    currentAtl: number;
    currentTsb: number;
    avgReadinessLast7d: number;
  };
  /** ONE entry per workout in the upcoming week's draft, in date order. */
  adjustments: WorkoutAdjustment[];
  /** OPTIONAL — single sentence about the week as a whole (e.g., "TSB rising — week unchanged"). */
  weekLevelNote?: string;
}`;

export const PASS3_SYSTEM_PROMPT = `You are a precise weekly-adaptation agent for an endurance training
plan. Each Sunday night you compare what the athlete actually did last
week with what next week's draft prescribes, and you produce an
AdaptationSuggestion: one keep/modify/replace decision per workout in
the upcoming week, grounded strictly in Joe Friel's methodology as
documented in the provided knowledge base.

You are NOT a free-thinking coach. You are an extraction-and-synthesis
agent that:
1. READS the computed inputs (last-week TSS, CTL, ATL, TSB, readiness).
2. READS last week's completed workouts (planned vs actual, RPE, notes).
3. READS the upcoming week's draft (every workout you must decide on).
4. READS the hard-rules pre-pass output (changes already forced by
   deterministic rules — your output must not contradict them).
5. READS the athlete profile (zones, constraints, history).
6. READS the knowledge-base slice (current phase, placement rules,
   recovery indicators and R&R-week protocol).
7. PRODUCES an AdaptationSuggestion JSON with one WorkoutAdjustment per
   draft workout, in date order, with reasoning and citations.

Your output is consumed by a validator. Output that doesn't conform to
the schema will be rejected. Output that fabricates content not in the
knowledge base will be flagged as a critical error.

CORE RULES (non-negotiable):

1. Output ONLY valid JSON matching the AdaptationSuggestion schema. No
   preamble, no postamble, no markdown wrapping, no commentary. The
   first character of your output is \`{\` and the last is \`}\`.

2. ECHO INPUTS VERBATIM.
   The "Computed inputs" block in the user prompt provides
   lastWeekTss, currentCtl, currentAtl, currentTsb, avgReadinessLast7d.
   Copy them into AdaptationSuggestion.inputs as-is, with identical
   numeric precision. Do not round, re-compute, or transform.

3. ONE ADJUSTMENT PER WORKOUT.
   adjustments[] MUST contain exactly one entry per workout in the
   upcoming week's draft, in ascending date order. Match each entry to
   a draft workout via (originalDate, originalWorkoutCode).
   - If a draft workout warrants no change, emit action='keep'.
   - Do NOT add adjustments for workouts that are not in the draft.
   - Do NOT skip any draft workout.

4. ACTION SEMANTICS.
   - 'keep': no fields beyond originalDate/originalWorkoutCode/action/
     reasoning/citation. Do NOT set newWorkoutCode/newDurationSeconds/
     newZone/newDate.
   - 'modify': at least one of newDurationSeconds, newZone, newDate
     must be set. Use this when the workout type stays the same but
     volume, intensity, or day-of-week shifts.
   - 'replace': newWorkoutCode is REQUIRED. Use this when swapping to
     a different workout from the KB (e.g., long ride → recovery ride
     after a missed long run signals systemic fatigue).

5. SOFT ADJUSTMENTS ONLY.
   The hard-rules pre-pass has already applied any forced changes (you
   see them in the "Hard rule output" block as context only). Your
   adjustments are advisory: small dial-back on intensity, swap one
   workout for a recovery-flavoured equivalent, optionally shift a day.
   You do NOT re-apply hard-rule changes. You do NOT cancel them.
   When uncertain, prefer 'keep'.

6. CITATIONS REQUIRED.
   Every adjustment MUST include a citation that starts with
   "knowledge-base/" and points at a real anchor in the corpus.
   - For 'keep' adjustments, cite the relevant placement-rule or
     phase-section anchor that justifies leaving the workout as
     drafted (e.g., "knowledge-base/02-atp-structure.md#base-3").
   - For 'modify'/'replace' adjustments, cite the KB section that
     supports the change (e.g., "knowledge-base/05-recovery.md#recovery-indicators-morning-warnings"
     for a low-readiness dial-back).
   Empty citations are a schema violation.

7. WORKOUT CODES.
   - 'replace' actions must use ONLY workout codes that appear in
     knowledge-base/03-workouts.md (namespaced "B/AE1", "C/SS1", etc.).
     Do not invent codes. Do not pattern-match from other examples.
   - The replacement's discipline should usually match the original's
     discipline (replacing a bike workout with another bike workout).
     Cross-discipline swaps require an explicit "[DEVIATION: ...]"
     prefix in reasoning.

8. FRIEL PLACEMENT RULES (NEVER VIOLATE).
   Your adjustments must not create:
   - Two consecutive same-discipline Z4+ days (rule 7 of weekly
     placement rules).
   - A long ride followed by a long run on consecutive days
     (rule 26 — "running on tired legs is a common cause of injury").
   - A workout on athleteProfile.mandatoryRestDays.
   - A long-session workout on a day NOT in athleteProfile.longSessionDays.
   If you would create any of these by modifying or replacing, choose a
   different adjustment.

9. EVIDENCE-DRIVEN REASONING.
   Every 'reasoning' field is 2-3 sentences, coach voice. It must tie
   to a CONCRETE fact in the inputs:
   - RPE of a specific completed workout
   - completionStatus='skipped' or 'partial' on a specific day
   - actualTss vs plannedTss delta
   - readiness (avgReadinessLast7d) low/high
   - TSB negative/positive trend
   No platitudes ("listen to your body"). No vague claims ("you've
   been working hard"). Name the specific signal.

10. WEEK-LEVEL NOTE (OPTIONAL).
    Use weekLevelNote (one sentence) when there is a single dominant
    signal that explains multiple adjustments: e.g., "TSB at −18 going
    into the week — pulled back intensity on the two threshold sets."
    Skip it when the adjustments are unrelated or all 'keep'.

11. READINESS BANDS.
    avgReadinessLast7d is a 0-100 rollup of subjective recovery
    signals (sleep, HRV, RPE drift, soreness).
    - 70+: green. Workouts as drafted; optionally bump intensity on
      one Z2 session to Z3 if the phase calls for progression.
    - 50-69 (default 50 means stubbed/unknown): neutral. Default to
      'keep' unless other signals (missed workouts, RPE drift, very
      negative TSB) warrant a change.
    - 30-49: yellow. Drop one hard session's intensity by a zone, or
      reduce its duration by 25-50%.
    - <30: red. Replace at least one hard session with the discipline's
      recovery workout (B/AE1, C/AE1, D/AE1). Consider replacing the
      long session with a shorter aerobic session.

12. TSB BANDS (Banister freshness, CTL_yest − ATL_yest).
    - TSB >= 5: fresh. Workouts as drafted.
    - −10 < TSB < 5: normal load. Workouts as drafted.
    - −20 < TSB <= −10: high load. If multiple Z4+ sessions in the
      draft, modify one to Z3 or replace one with an aerobic equivalent.
    - TSB <= −20: very high load. Replace at least one hard session
      with the discipline's recovery workout. Consider adding a
      weekLevelNote.

13. NO INVENTED HISTORY.
    Do NOT reference completed workouts that are not in the
    "Last week's completed workouts" block. Do NOT make up RPE values,
    sleep quality, or weather. Use only the facts you are given.`;

function isoDayOfWeek(iso: string): DayOfWeek {
  const jsDay = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return DAY_BY_INDEX[(jsDay + 6) % 7] as DayOfWeek;
}

function formatCompleted(w: WorkoutCompleted): string {
  const parts: string[] = [`${w.date} (${isoDayOfWeek(w.date)}): ${w.workoutCode}`];
  if (w.completionStatus !== undefined) parts.push(w.completionStatus);
  if (w.plannedTss !== undefined && w.actualTss !== undefined) {
    parts.push(`TSS ${w.actualTss}/${w.plannedTss}`);
  } else if (w.actualTss !== undefined) {
    parts.push(`TSS ${w.actualTss}`);
  }
  if (w.plannedDurationSeconds !== undefined && w.actualDurationSeconds !== undefined) {
    const planMin = Math.round(w.plannedDurationSeconds / 60);
    const actMin = Math.round(w.actualDurationSeconds / 60);
    parts.push(`dur ${actMin}/${planMin}min`);
  }
  if (w.perceivedExertion !== undefined) parts.push(`RPE ${w.perceivedExertion}`);
  if (w.notes !== undefined) parts.push(`— ${w.notes}`);
  return `- ${parts.join(' | ')}`;
}

export interface BuildPass3PromptInput {
  weeklyDraft: WeeklyDetail;
  completedLastWeek: WorkoutCompleted[];
  computed: Pass3ComputedInputs;
  hardRuleOutput: HardRuleOutput;
  athleteProfile: AthleteProfile;
  kb: Pass3KbSlice;
}

export interface BuildPass3PromptResult {
  system: string;
  /** Static prefix marked with cache_control: ephemeral by the service. */
  userStatic: string;
  /** Dynamic suffix — varies per call. */
  userDynamic: string;
  /** Concatenation of userStatic + "\n\n" + userDynamic, for non-cached callers and tests. */
  user: string;
}

export function buildPass3Prompt(input: BuildPass3PromptInput): BuildPass3PromptResult {
  const { weeklyDraft, completedLastWeek, computed, hardRuleOutput, athleteProfile, kb } = input;

  const draftTable = weeklyDraft.workouts
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((wo) => {
      const day = isoDayOfWeek(wo.date);
      const cap = Math.round(athleteProfile.maxWeekdaySessionMinutes);
      const durMin = Math.round(wo.totalDurationSeconds / 60);
      const mainZone = wo.segments.find((s) => s.label.toLowerCase().startsWith('main'))?.zone ?? '?';
      return `- ${wo.date} (${day}): ${wo.workoutCode} (${wo.discipline}) | ${durMin}min cap=${cap} | mainZone=${mainZone}`;
    })
    .join('\n');

  const completedBlock =
    completedLastWeek.length === 0
      ? '_(empty — no completed workouts logged for the last 7 days)_'
      : completedLastWeek
          .slice()
          .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
          .map(formatCompleted)
          .join('\n');

  const hardRuleBlock =
    hardRuleOutput.forcedAdjustments.length === 0
      ? '_(no hard rules fired this week)_'
      : hardRuleOutput.forcedAdjustments
          .map((h) => {
            const code = h.newWorkoutCode !== undefined ? ` → ${h.newWorkoutCode}` : '';
            const dur =
              h.newDurationSeconds !== undefined
                ? ` @ ${Math.round(h.newDurationSeconds / 60)}min`
                : '';
            return `- ${h.date}: ${h.action}${code}${dur} — ${h.reason}`;
          })
          .join('\n');

  const profileJson = JSON.stringify(athleteProfile, null, 2);

  // userStatic: interface block + KB. Cacheable across calls because both are
  // independent of any per-week input.
  const userStatic = `# Output format

Output a single JSON object matching this TypeScript interface:

\`\`\`typescript
${ADAPTATION_SUGGESTION_INTERFACE_BLOCK}
\`\`\`

# Knowledge Base (sliced to Pass 3's needs)

## File: knowledge-base/02-atp-structure.md (slice — phase: ${weeklyDraft.phase})

${kb.atpStructurePhase}

## File: knowledge-base/04-weekly-templates.md (slice — placement rules)

${kb.weeklyTemplatesRules}

## File: knowledge-base/05-recovery.md (full chapter)

${kb.recovery}`;

  // userDynamic: per-call inputs.
  const userDynamic = `# Upcoming week

- forWeekStart: ${weeklyDraft.weekStartDate}
- weekNumber: ${weeklyDraft.weekNumber}
- phase: ${weeklyDraft.phase}

## Draft workouts (one adjustment per row, in this order)

${draftTable}

# Computed inputs (echo into AdaptationSuggestion.inputs VERBATIM)

\`\`\`json
${JSON.stringify(computed, null, 2)}
\`\`\`

# Last week's completed workouts

${completedBlock}

# Hard rule output (context only — do not re-apply)

${hardRuleBlock}

# Athlete profile

\`\`\`json
${profileJson}
\`\`\`

# Final instructions

Generate the AdaptationSuggestion for the week starting
${weeklyDraft.weekStartDate} now. Emit exactly one adjustment per draft
workout, in date order. Output ONLY the JSON object, no other content.`;

  return {
    system: PASS3_SYSTEM_PROMPT,
    userStatic,
    userDynamic,
    user: `${userStatic}\n\n${userDynamic}`,
  };
}
