// Auto-extracted from knowledge-base/03-workouts.md.
// Format: "<Appendix>/<Code>" — namespacing matters because identical codes
// across appendices refer to different workouts (e.g. B/AE1 = Recovery swim,
// E/AE1 = Aerobic Endurance Brick).
//
// DO NOT edit by hand. Regenerate via:
//   grep -E '^### [BCDE]/[A-Za-z0-9]+:' knowledge-base/03-workouts.md \
//     | sed -E 's/^### ([BCDE]\/[A-Za-z0-9]+):.*/\1/' | sort -u
// (script wrapper TBD; until then this is hand-extracted from the KB at
//  the SHA of the most recent extraction commit).
//
// Notable case sensitivities and gaps confirmed by the ETA-9 audit:
//   - B/Te1 (lowercase 'e') vs C/TE1, D/TE1 (uppercase 'E') — preserved verbatim
//   - E/TB1 (different letter — "Tempo Brick", not Tempo Endurance)
//   - D has T1 and T3 but no T2 (gap in source taxonomy, intentional)
//   - C/AC1 has a known typo in source ("AE1: VO₂max Intervals") but the
//     entry IS present in the KB under C/AC1 — keep it.
//   - E/MF section is explicitly empty in source; no E/MF codes exist.

export const WORKOUT_CODES = [
  'B/AC1',
  'B/AC2',
  'B/AE1',
  'B/AE2',
  'B/ME1',
  'B/ME2',
  'B/ME3',
  'B/MF1',
  'B/MF2',
  'B/MF3',
  'B/SS1',
  'B/SS2',
  'B/T1',
  'B/T2',
  'B/Te1',
  'C/AC1',
  'C/AC2',
  'C/AC3',
  'C/AE1',
  'C/AE2',
  'C/ME1',
  'C/ME2',
  'C/ME3',
  'C/ME4',
  'C/MF1',
  'C/MF2',
  'C/MF3',
  'C/SS1',
  'C/SS2',
  'C/T1',
  'C/T2',
  'C/T3',
  'C/TE1',
  'D/AC1',
  'D/AC2',
  'D/AC3',
  'D/AE1',
  'D/AE2',
  'D/ME1',
  'D/ME2',
  'D/ME3',
  'D/ME4',
  'D/MF1',
  'D/MF2',
  'D/MF3',
  'D/SS1',
  'D/SS2',
  'D/T1',
  'D/T3',
  'D/TE1',
  'E/AC1',
  'E/AC2',
  'E/AE1',
  'E/ME1',
  'E/ME2',
  'E/SS1',
  'E/SS2',
  'E/TB1',
] as const;

export type WorkoutCode = (typeof WORKOUT_CODES)[number];

const WORKOUT_CODE_SET: ReadonlySet<string> = new Set(WORKOUT_CODES);

export function isValidWorkoutCode(code: string): code is WorkoutCode {
  return WORKOUT_CODE_SET.has(code);
}
