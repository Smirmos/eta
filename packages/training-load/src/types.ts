export type Discipline = 'swim' | 'bike' | 'run';

export interface BikeTssInput {
  durationSeconds: number;
  ftpWatts: number;
  /** Either provide normalized power directly. */
  normalizedPowerWatts?: number;
  /** Or provide a 1-second power stream and we'll compute NP. */
  powerStreamWatts?: number[];
  /** HR-only fallback if neither power nor power stream are available. */
  hrTimeInZones?: HrTimeInZones;
}

export interface RunTssInput {
  durationSeconds: number;
  thresholdPaceSecondsPerKm: number;
  /** Either provide NGP directly. */
  normalizedGradedPaceSecondsPerKm?: number;
  /** Or provide a pace+grade stream and we'll compute NGP. */
  paceStreamSecondsPerKm?: number[];
  gradeStreamPercent?: number[];
}

export interface SwimTssInput {
  durationSeconds: number;
  tPaceSecondsPer100m: number;
  actualPaceSecondsPer100m: number;
}

export interface HrTimeInZones {
  z1: number;
  z2: number;
  z3: number;
  z4: number;
  z5: number;
}

export interface DailyTss {
  /** ISO date "YYYY-MM-DD" */
  date: string;
  tss: number;
}

export interface LoadHistory {
  ctl: number;
  atl: number;
  tsb: number;
  /** ISO date */
  asOf: string;
}
