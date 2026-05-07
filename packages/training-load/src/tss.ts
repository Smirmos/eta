import type { BikeTssInput, HrTimeInZones, RunTssInput, SwimTssInput } from './types.js';

// ─── Internal helpers ────────────────────────────────────────────────────────

const NP_WINDOW_SECONDS = 30;

/**
 * Trailing rolling mean over a fixed window.
 * For samples before the window fills, the partial-window mean is used
 * (matches the de-facto Coggan convention used by Garmin/TrainingPeaks).
 */
function rollingMean(stream: number[], window: number): number[] {
  if (window <= 0 || !Number.isInteger(window)) {
    throw new RangeError(`rollingMean: window must be a positive integer, got ${window}`);
  }
  const result = new Array<number>(stream.length);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < stream.length; i++) {
    const value = stream[i] as number;
    sum += value;
    count++;
    if (count > window) {
      sum -= stream[i - window] as number;
      count--;
    }
    result[i] = sum / count;
  }
  return result;
}

function assertFinitePositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a finite positive number, got ${value}`);
  }
}

function assertFiniteNonNegative(name: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number, got ${value}`);
  }
}

function assertNonEmptyFiniteSeries(name: string, stream: number[]): void {
  if (stream.length === 0) {
    throw new RangeError(`${name} is empty`);
  }
  for (let i = 0; i < stream.length; i++) {
    const v = stream[i] as number;
    if (!Number.isFinite(v)) {
      throw new RangeError(`${name}[${i}] is not finite (got ${v})`);
    }
    if (v < 0) {
      throw new RangeError(`${name}[${i}] is negative (got ${v})`);
    }
  }
}

// ─── Normalized power (Coggan) ───────────────────────────────────────────────

/**
 * Coggan's Normalized Power.
 *
 * Formula: NP = ( mean( rolling30s_avg(power)^4 ) )^(1/4)
 *   1. Take a 30-second trailing rolling mean of the 1-second power stream.
 *   2. Raise each rolling-mean value to the 4th power.
 *   3. Take the arithmetic mean.
 *   4. Take the 4th root.
 *
 * Source: Allen & Coggan, "Training and Racing with a Power Meter" (3rd ed., ch. 7).
 */
export function normalizedPower(powerStreamWatts: number[]): number {
  assertNonEmptyFiniteSeries('powerStreamWatts', powerStreamWatts);
  const rolling = rollingMean(powerStreamWatts, NP_WINDOW_SECONDS);
  let sumPow4 = 0;
  for (let i = 0; i < rolling.length; i++) {
    const v = rolling[i] as number;
    sumPow4 += v ** 4;
  }
  const meanPow4 = sumPow4 / rolling.length;
  return meanPow4 ** 0.25;
}

// ─── Bike TSS ────────────────────────────────────────────────────────────────

/**
 * Bike TSS (Coggan).
 *
 * Formula: TSS = (durationSec × NP × IF) / (FTP × 3600) × 100
 *           IF  = NP / FTP
 *
 * The NP × IF / FTP factor algebraically resolves to IF² (since NP/FTP = IF),
 * so this is equivalent to the canonical `durationHours × IF² × 100` form.
 *
 * Input priority:
 *   1. powerStreamWatts → compute NP from stream
 *   2. normalizedPowerWatts → use directly
 *   3. hrTimeInZones → fall back to {@link bikeTssFromHrZones}
 *
 * Source: Allen & Coggan; TrainingPeaks "Training Stress Score Explained".
 */
export function bikeTss(input: BikeTssInput): number {
  assertFinitePositive('durationSeconds', input.durationSeconds);
  assertFinitePositive('ftpWatts', input.ftpWatts);

  let np: number;
  if (input.powerStreamWatts !== undefined) {
    np = normalizedPower(input.powerStreamWatts);
  } else if (input.normalizedPowerWatts !== undefined) {
    assertFiniteNonNegative('normalizedPowerWatts', input.normalizedPowerWatts);
    np = input.normalizedPowerWatts;
  } else if (input.hrTimeInZones !== undefined) {
    return bikeTssFromHrZones(input.durationSeconds, input.hrTimeInZones);
  } else {
    throw new RangeError(
      'bikeTss: must provide one of powerStreamWatts | normalizedPowerWatts | hrTimeInZones',
    );
  }

  const intensityFactor = np / input.ftpWatts;
  return ((input.durationSeconds * np * intensityFactor) / (input.ftpWatts * 3600)) * 100;
}

/**
 * HR-only bike TSS approximation.
 *
 * Formula: hrTSS = durationHours × IF² × 100
 *           IF   = Σ (zone_seconds × zone_IF) / Σ zone_seconds
 *
 * Per-zone IF approximations (TrainingPeaks heuristic):
 *   z1=0.55, z2=0.75, z3=0.85, z4=0.95, z5=1.05
 *
 * Less accurate than power-based TSS — use only when no power data exists.
 *
 * Note: `durationSeconds` is the authoritative duration multiplier.
 * Zone-time values feed only the intensity-factor weighting, so small
 * mismatches between Σ(zone_seconds) and durationSeconds are tolerated.
 */
export function bikeTssFromHrZones(durationSeconds: number, hrTimeInZones: HrTimeInZones): number {
  assertFinitePositive('durationSeconds', durationSeconds);
  const { z1, z2, z3, z4, z5 } = hrTimeInZones;
  for (const [name, value] of Object.entries({ z1, z2, z3, z4, z5 })) {
    assertFiniteNonNegative(`hrTimeInZones.${name}`, value);
  }
  const totalZoneSeconds = z1 + z2 + z3 + z4 + z5;
  if (totalZoneSeconds <= 0) {
    throw new RangeError('hrTimeInZones: at least one zone must have positive time');
  }
  const weightedIf = (z1 * 0.55 + z2 * 0.75 + z3 * 0.85 + z4 * 0.95 + z5 * 1.05) / totalZoneSeconds;
  return (durationSeconds / 3600) * weightedIf ** 2 * 100;
}

// ─── Run TSS ─────────────────────────────────────────────────────────────────

/**
 * Run TSS (canonical form).
 *
 * Formula: rTSS = durationHours × IF² × 100
 *           IF   = thresholdPace / NGP
 *
 * Pace values are in SECONDS per km — lower is faster, so a faster NGP yields
 * an IF > 1.0. (This is the inverse of the bike formula's IF = NP/FTP.)
 *
 * Source: TrainingPeaks "Running Training Stress Score (rTSS)".
 *
 * Implementation note: ETA-17 spec originally proposed the form
 *   rTSS = (durationSec × NGP × IF) / (thresholdPace × 3600) × 100
 * but algebraic substitution of IF = thresholdPace/NGP collapses NGP out
 * entirely, yielding a pace-independent score. The canonical IF² form is
 * equivalent in shape to bikeTss's resolved form and behaves correctly.
 */
export function runTss(input: RunTssInput): number {
  assertFinitePositive('durationSeconds', input.durationSeconds);
  assertFinitePositive('thresholdPaceSecondsPerKm', input.thresholdPaceSecondsPerKm);

  let ngp: number;
  if (input.paceStreamSecondsPerKm !== undefined || input.gradeStreamPercent !== undefined) {
    if (input.paceStreamSecondsPerKm === undefined || input.gradeStreamPercent === undefined) {
      throw new RangeError(
        'runTss: paceStreamSecondsPerKm and gradeStreamPercent must be provided together',
      );
    }
    ngp = normalizedGradedPace(input.paceStreamSecondsPerKm, input.gradeStreamPercent);
  } else if (input.normalizedGradedPaceSecondsPerKm !== undefined) {
    assertFinitePositive(
      'normalizedGradedPaceSecondsPerKm',
      input.normalizedGradedPaceSecondsPerKm,
    );
    ngp = input.normalizedGradedPaceSecondsPerKm;
  } else {
    throw new RangeError(
      'runTss: must provide one of paceStreamSecondsPerKm+gradeStreamPercent | normalizedGradedPaceSecondsPerKm',
    );
  }

  const intensityFactor = input.thresholdPaceSecondsPerKm / ngp;
  return (input.durationSeconds / 3600) * intensityFactor ** 2 * 100;
}

/**
 * Normalized Graded Pace.
 *
 * Step 1 — Grade-Adjusted Pace (per second sample):
 *   GAP = pace × (1 + 3.3 × grade + 6.0 × grade²)
 *   where `grade` is a decimal (0.05 = 5%).
 *
 * Step 2 — Normalize the GAP series with the same 30s rolling / ^4 / mean / ^0.25
 *   method used for power. Pace is treated as a magnitude; lower (faster) values
 *   produce higher loads via the IF inversion in {@link runTss}.
 *
 * Source: Strava grade-adjusted pace polynomial (approximation); TrainingPeaks NGP.
 */
export function normalizedGradedPace(
  paceStreamSecondsPerKm: number[],
  gradeStreamPercent: number[],
): number {
  assertNonEmptyFiniteSeries('paceStreamSecondsPerKm', paceStreamSecondsPerKm);
  if (gradeStreamPercent.length !== paceStreamSecondsPerKm.length) {
    throw new RangeError(
      `normalizedGradedPace: stream lengths differ (pace=${paceStreamSecondsPerKm.length}, grade=${gradeStreamPercent.length})`,
    );
  }
  for (let i = 0; i < gradeStreamPercent.length; i++) {
    const v = gradeStreamPercent[i] as number;
    if (!Number.isFinite(v)) {
      throw new RangeError(`gradeStreamPercent[${i}] is not finite (got ${v})`);
    }
  }

  const gap = new Array<number>(paceStreamSecondsPerKm.length);
  for (let i = 0; i < paceStreamSecondsPerKm.length; i++) {
    const pace = paceStreamSecondsPerKm[i] as number;
    const gradePct = gradeStreamPercent[i] as number;
    const grade = gradePct / 100;
    const factor = 1 + 3.3 * grade + 6.0 * grade ** 2;
    gap[i] = pace * factor;
  }

  const rolling = rollingMean(gap, NP_WINDOW_SECONDS);
  let sumPow4 = 0;
  for (let i = 0; i < rolling.length; i++) {
    const v = rolling[i] as number;
    sumPow4 += v ** 4;
  }
  const meanPow4 = sumPow4 / rolling.length;
  return meanPow4 ** 0.25;
}

// ─── Swim TSS ────────────────────────────────────────────────────────────────

/**
 * Swim TSS.
 *
 * Formula: sTSS = (durationSec / 3600) × IF³ × 100
 *           IF  = tPace / actualPace
 *
 * Pace in SECONDS per 100m. Like run, lower is faster, so faster swimmers
 * (lower actualPace) produce IF > 1.0. The cubed exponent (vs. bike's IF²)
 * reflects swim's higher metabolic cost-per-pace-improvement curve.
 *
 * Source: TrainingPeaks "Swim Training Stress Score (sTSS)".
 */
export function swimTss(input: SwimTssInput): number {
  assertFinitePositive('durationSeconds', input.durationSeconds);
  assertFinitePositive('tPaceSecondsPer100m', input.tPaceSecondsPer100m);
  assertFinitePositive('actualPaceSecondsPer100m', input.actualPaceSecondsPer100m);

  const intensityFactor = input.tPaceSecondsPer100m / input.actualPaceSecondsPer100m;
  return (input.durationSeconds / 3600) * intensityFactor ** 3 * 100;
}
