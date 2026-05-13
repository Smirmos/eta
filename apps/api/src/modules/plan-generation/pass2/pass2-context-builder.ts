import type { MacroPlanWeek, Phase, WorkoutCode } from '@eta/shared-types';
import type { KnowledgeBase } from '../knowledge-base.loader.js';
import type { KbSlice } from './types.js';

// Codes the LLM may pick for fill-in (non-key) sessions when the macro plan
// leaves training-day slots unspecified. Always included in the slice so the
// LLM doesn't fabricate a recovery code from pattern-matching.
const FILL_IN_CANDIDATES: readonly WorkoutCode[] = [
  'B/AE1',
  'B/SS1',
  'B/SS2',
  'C/AE1',
  'C/SS1',
  'C/SS2',
  'D/AE1',
  'D/SS1',
  'D/SS2',
];

const PHASE_HEADING: Record<Phase, string> = {
  prep: '#### Prep',
  base_1: '#### Base 1',
  base_2: '#### Base 2',
  base_3: '#### Base 3',
  build_1: '#### Build 1',
  build_2: '#### Build 2',
  peak: '#### Peak',
  race_week: '#### Race (Race Week)',
  transition: '#### Transition',
};

// Returns the substring of `md` from `startHeading` up to (but not including)
// the next heading at the same level. Returns empty string if not found.
function sliceSection(md: string, startHeading: string): string {
  const startIdx = md.indexOf(startHeading);
  if (startIdx === -1) return '';
  const level = startHeading.match(/^#+/)?.[0].length ?? 0;
  if (level === 0) return '';
  const tailRe = new RegExp(`\\n#{1,${level}} `, 'g');
  tailRe.lastIndex = startIdx + startHeading.length;
  const match = tailRe.exec(md);
  return match ? md.slice(startIdx, match.index) : md.slice(startIdx);
}

// Extracts the appendix intro plus the named workout entries from
// 03-workouts.md. Appendix intros are everything between "## Appendix X"
// and the first "### " heading.
function sliceWorkouts(md: string, codes: ReadonlySet<string>): string {
  const out: string[] = [];

  // Appendix intros: A workout entry header looks like "### B/AE1: Recovery".
  // The appendix header looks like "## Appendix B: Swim Workouts".
  const appendixRe = /^## Appendix [BCDE]:[^\n]*$/gm;
  let appendixMatch: RegExpExecArray | null;
  while ((appendixMatch = appendixRe.exec(md)) !== null) {
    const startIdx = appendixMatch.index;
    const firstWorkoutRe = /\n### [BCDE]\/[A-Za-z0-9]+:/g;
    firstWorkoutRe.lastIndex = startIdx;
    const firstWorkoutMatch = firstWorkoutRe.exec(md);
    const endIdx = firstWorkoutMatch ? firstWorkoutMatch.index : md.length;
    out.push(md.slice(startIdx, endIdx).trimEnd());
  }

  // Workout entries.
  const entryRe = /^### ([BCDE]\/[A-Za-z0-9]+):[^\n]*$/gm;
  const entryHits: Array<{ code: string; start: number }> = [];
  let entryMatch: RegExpExecArray | null;
  while ((entryMatch = entryRe.exec(md)) !== null) {
    entryHits.push({ code: entryMatch[1] as string, start: entryMatch.index });
  }
  for (let i = 0; i < entryHits.length; i++) {
    const hit = entryHits[i] as { code: string; start: number };
    if (!codes.has(hit.code)) continue;
    const nextStart = entryHits[i + 1]?.start ?? md.length;
    out.push(md.slice(hit.start, nextStart).trimEnd());
  }

  return out.join('\n\n');
}

// Slices 04-weekly-templates.md to the "Workout placement rules" section
// only, because that's the load-bearing content for Pass 2 (rules 1–40 plus
// long-ride/long-run ordering).
function sliceWeeklyTemplatesRules(md: string): string {
  return sliceSection(md, '## Workout placement rules');
}

export interface BuildKbSliceInput {
  week: MacroPlanWeek;
  kb: KnowledgeBase;
}

export function buildKbSlice(input: BuildKbSliceInput): KbSlice {
  const { week, kb } = input;

  const codes = new Set<string>();
  for (const session of week.keySessions) codes.add(session.workoutCode);
  for (const candidate of FILL_IN_CANDIDATES) codes.add(candidate);

  const atpStructurePhase = sliceSection(kb.atpStructure, PHASE_HEADING[week.phase]);
  const workoutsRelevant = sliceWorkouts(kb.workouts, codes);
  const weeklyTemplatesRules = sliceWeeklyTemplatesRules(kb.weeklyTemplates);
  const recovery = week.isRecoveryWeek ? kb.recovery : undefined;

  const slice: KbSlice = {
    zones: kb.zones,
    atpStructurePhase,
    workoutsRelevant,
    weeklyTemplatesRules,
    totalChars: 0,
  };
  if (recovery !== undefined) slice.recovery = recovery;

  slice.totalChars =
    slice.zones.length +
    slice.atpStructurePhase.length +
    slice.workoutsRelevant.length +
    slice.weeklyTemplatesRules.length +
    (slice.recovery?.length ?? 0);

  return slice;
}
