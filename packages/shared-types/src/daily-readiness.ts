// DailyReadinessReading — one-night-per-row recovery signal.
// Forward-compatible superset of ETA-28's planned persistence shape;
// also consumed by ETA-26 (Oura) and ETA-27 (Luna) ingestion.

export type DailyReadinessSource = 'oura' | 'luna' | 'manual' | 'stub';

export interface DailyReadinessReading {
  /** ISO date "YYYY-MM-DD" the reading represents. */
  date: string;
  /** 0–100 wearable composite score. Undefined when the source doesn't provide one. */
  readinessScore?: number;
  /** Nightly heart-rate variability (RMSSD, milliseconds). */
  hrvRmssdMs?: number;
  /** 0–100 sleep score. Reserved — not consumed by ETA-21. */
  sleepScore?: number;
  /** Nightly resting HR (bpm). Reserved for future rules. */
  restingHr?: number;
  /** Skin / body temperature deviation from baseline, °C. Reserved for future rules. */
  bodyTempDeviation?: number;
  source: DailyReadinessSource;
}
