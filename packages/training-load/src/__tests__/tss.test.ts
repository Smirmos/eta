import { describe, expect, it } from 'vitest';
import {
  bikeTss,
  bikeTssFromHrZones,
  normalizedGradedPace,
  normalizedPower,
  runTss,
  swimTss,
} from '../index.js';

describe('normalizedPower', () => {
  it('returns 100 for 1800 samples of 100W', () => {
    const stream = new Array(1800).fill(100) as number[];
    expect(normalizedPower(stream)).toBeCloseTo(100, 6);
  });

  it('matches a hand-computed value for a short variable input', () => {
    // stream = [100, 100, 100, 200], window=30 (so partial windows apply)
    // rolling[0..2] = 100, rolling[3] = 125
    // mean_pow4 = (100^4 + 100^4 + 100^4 + 125^4) / 4 = 136_035_156.25
    // NP = 136_035_156.25^(1/4) ≈ 108.0
    expect(normalizedPower([100, 100, 100, 200])).toBeCloseTo(108.0, 1);
  });

  it('throws on empty stream', () => {
    expect(() => normalizedPower([])).toThrow(/empty/);
  });

  it('throws on negative power', () => {
    expect(() => normalizedPower([100, -50, 100])).toThrow(/negative/);
  });

  it('throws on NaN', () => {
    expect(() => normalizedPower([100, NaN, 100])).toThrow(/finite/);
  });
});

describe('bikeTss', () => {
  it('1-hour ride at FTP via NP gives exactly 100', () => {
    expect(
      bikeTss({
        durationSeconds: 3600,
        ftpWatts: 250,
        normalizedPowerWatts: 250,
      }),
    ).toBeCloseTo(100, 6);
  });

  it('1-hour ride at 0.7×FTP via NP gives 49 (= 0.7² × 100)', () => {
    expect(
      bikeTss({
        durationSeconds: 3600,
        ftpWatts: 250,
        normalizedPowerWatts: 175,
      }),
    ).toBeCloseTo(49, 6);
  });

  it('produces the same result whether NP is computed from stream or supplied directly', () => {
    const stream = new Array(3600).fill(180) as number[];
    const fromStream = bikeTss({
      durationSeconds: 3600,
      ftpWatts: 240,
      powerStreamWatts: stream,
    });
    const fromNp = bikeTss({
      durationSeconds: 3600,
      ftpWatts: 240,
      normalizedPowerWatts: 180,
    });
    expect(fromStream).toBeCloseTo(fromNp, 6);
  });

  it('falls back to HR-based TSS when no power data is provided', () => {
    const result = bikeTss({
      durationSeconds: 3600,
      ftpWatts: 250,
      hrTimeInZones: { z1: 0, z2: 3600, z3: 0, z4: 0, z5: 0 },
    });
    expect(result).toBeCloseTo(56.25, 6);
  });

  it('throws when no power and no HR data is provided', () => {
    expect(() => bikeTss({ durationSeconds: 3600, ftpWatts: 250 })).toThrow(/must provide one of/);
  });

  it('rejects non-positive duration', () => {
    expect(() => bikeTss({ durationSeconds: 0, ftpWatts: 250, normalizedPowerWatts: 250 })).toThrow(
      /durationSeconds/,
    );
    expect(() =>
      bikeTss({ durationSeconds: -1, ftpWatts: 250, normalizedPowerWatts: 250 }),
    ).toThrow(/durationSeconds/);
  });

  it('rejects non-positive FTP', () => {
    expect(() =>
      bikeTss({ durationSeconds: 3600, ftpWatts: 0, normalizedPowerWatts: 250 }),
    ).toThrow(/ftpWatts/);
  });

  it('rejects NaN inputs', () => {
    expect(() =>
      bikeTss({ durationSeconds: NaN, ftpWatts: 250, normalizedPowerWatts: 250 }),
    ).toThrow(/durationSeconds/);
  });
});

describe('bikeTssFromHrZones', () => {
  it('1 hour entirely in z2 gives 0.75² × 100 = 56.25', () => {
    expect(bikeTssFromHrZones(3600, { z1: 0, z2: 3600, z3: 0, z4: 0, z5: 0 })).toBeCloseTo(
      56.25,
      6,
    );
  });

  it('1 hour entirely in z4 gives 0.95² × 100 = 90.25', () => {
    expect(bikeTssFromHrZones(3600, { z1: 0, z2: 0, z3: 0, z4: 3600, z5: 0 })).toBeCloseTo(
      90.25,
      6,
    );
  });

  it('time-weighted average IF for mixed zones', () => {
    // 30 min z2 (0.75) + 30 min z4 (0.95) → avgIF = (1800×0.75 + 1800×0.95)/3600 = 0.85
    // hrTSS = 1 × 0.85² × 100 = 72.25
    const result = bikeTssFromHrZones(3600, {
      z1: 0,
      z2: 1800,
      z3: 0,
      z4: 1800,
      z5: 0,
    });
    expect(result).toBeCloseTo(72.25, 6);
  });

  it('throws when all zones are zero', () => {
    expect(() => bikeTssFromHrZones(3600, { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 })).toThrow(
      /at least one zone/,
    );
  });

  it('rejects negative zone time', () => {
    expect(() => bikeTssFromHrZones(3600, { z1: -10, z2: 3600, z3: 0, z4: 0, z5: 0 })).toThrow(
      /z1/,
    );
  });

  it('rejects non-positive duration', () => {
    expect(() => bikeTssFromHrZones(0, { z1: 0, z2: 3600, z3: 0, z4: 0, z5: 0 })).toThrow(
      /durationSeconds/,
    );
  });
});

describe('runTss', () => {
  it('1h at threshold pace gives exactly 100', () => {
    expect(
      runTss({
        durationSeconds: 3600,
        thresholdPaceSecondsPerKm: 240,
        normalizedGradedPaceSecondsPerKm: 240,
      }),
    ).toBeCloseTo(100, 6);
  });

  it('1h at 0.9× threshold pace (faster) gives ~123.5 (IF=1.111)', () => {
    // NGP = 0.9 × 240 = 216 (faster). IF = 240/216 = 1.1111
    // rTSS = 1 × 1.1111² × 100 = 123.456...
    expect(
      runTss({
        durationSeconds: 3600,
        thresholdPaceSecondsPerKm: 240,
        normalizedGradedPaceSecondsPerKm: 216,
      }),
    ).toBeCloseTo(123.46, 1);
  });

  it('1h at 1.1× threshold pace (slower) gives ~82.6 (IF=0.909)', () => {
    // NGP = 1.1 × 240 = 264 (slower). IF = 240/264 = 0.909
    // rTSS = 1 × 0.909² × 100 = 82.64
    expect(
      runTss({
        durationSeconds: 3600,
        thresholdPaceSecondsPerKm: 240,
        normalizedGradedPaceSecondsPerKm: 264,
      }),
    ).toBeCloseTo(82.64, 1);
  });

  it('regression: rTSS depends on pace, not just duration', () => {
    // The original spec algebraically collapsed NGP — this test exists to
    // catch a regression to that buggy form (where rTSS would equal duration*100
    // for ALL paces).
    const slowRun = runTss({
      durationSeconds: 3600,
      thresholdPaceSecondsPerKm: 240,
      normalizedGradedPaceSecondsPerKm: 480, // half threshold pace = very slow
    });
    const fastRun = runTss({
      durationSeconds: 3600,
      thresholdPaceSecondsPerKm: 240,
      normalizedGradedPaceSecondsPerKm: 180, // 1.33× threshold = very fast
    });
    expect(slowRun).toBeLessThan(50);
    expect(fastRun).toBeGreaterThan(150);
    expect(slowRun).not.toBeCloseTo(fastRun, 0);
  });

  it('computes NGP from pace+grade streams when provided', () => {
    const pace = new Array(3600).fill(240) as number[];
    const grade = new Array(3600).fill(0) as number[];
    expect(
      runTss({
        durationSeconds: 3600,
        thresholdPaceSecondsPerKm: 240,
        paceStreamSecondsPerKm: pace,
        gradeStreamPercent: grade,
      }),
    ).toBeCloseTo(100, 1);
  });

  it('throws when only pace stream provided without grade stream', () => {
    expect(() =>
      runTss({
        durationSeconds: 3600,
        thresholdPaceSecondsPerKm: 240,
        paceStreamSecondsPerKm: [240, 240],
      }),
    ).toThrow(/together/);
  });

  it('throws when no NGP source is supplied', () => {
    expect(() => runTss({ durationSeconds: 3600, thresholdPaceSecondsPerKm: 240 })).toThrow(
      /must provide one of/,
    );
  });

  it('rejects non-positive duration', () => {
    expect(() =>
      runTss({
        durationSeconds: 0,
        thresholdPaceSecondsPerKm: 240,
        normalizedGradedPaceSecondsPerKm: 240,
      }),
    ).toThrow(/durationSeconds/);
  });

  it('rejects non-positive threshold pace', () => {
    expect(() =>
      runTss({
        durationSeconds: 3600,
        thresholdPaceSecondsPerKm: 0,
        normalizedGradedPaceSecondsPerKm: 240,
      }),
    ).toThrow(/thresholdPaceSecondsPerKm/);
  });

  it('rejects NaN NGP', () => {
    expect(() =>
      runTss({
        durationSeconds: 3600,
        thresholdPaceSecondsPerKm: 240,
        normalizedGradedPaceSecondsPerKm: NaN,
      }),
    ).toThrow(/normalizedGradedPaceSecondsPerKm/);
  });
});

describe('normalizedGradedPace', () => {
  it('flat course (grade=0) → NGP equals raw pace', () => {
    const pace = new Array(60).fill(240) as number[];
    const grade = new Array(60).fill(0) as number[];
    expect(normalizedGradedPace(pace, grade)).toBeCloseTo(240, 6);
  });

  it('uphill makes the GAP slower (higher seconds/km) per the polynomial', () => {
    // GAP = 240 × (1 + 3.3×0.05 + 6.0×0.05²) = 240 × 1.18 = 283.2
    const pace = new Array(60).fill(240) as number[];
    const grade = new Array(60).fill(5) as number[];
    expect(normalizedGradedPace(pace, grade)).toBeCloseTo(283.2, 1);
  });

  it('throws on mismatched stream lengths', () => {
    expect(() => normalizedGradedPace([240, 240], [0])).toThrow(/stream lengths/);
  });

  it('throws on empty pace stream', () => {
    expect(() => normalizedGradedPace([], [])).toThrow(/empty/);
  });
});

describe('swimTss', () => {
  it('1h at T-pace gives exactly 100', () => {
    expect(
      swimTss({
        durationSeconds: 3600,
        tPaceSecondsPer100m: 90,
        actualPaceSecondsPer100m: 90,
      }),
    ).toBeCloseTo(100, 6);
  });

  it('1h at 1.1× T-pace (slower) gives ~75.13 (= 100/1.1³)', () => {
    expect(
      swimTss({
        durationSeconds: 3600,
        tPaceSecondsPer100m: 90,
        actualPaceSecondsPer100m: 99,
      }),
    ).toBeCloseTo(75.13, 1);
  });

  it('1h at 0.9× T-pace (faster) gives ~137.17 (= 100/0.9³)', () => {
    expect(
      swimTss({
        durationSeconds: 3600,
        tPaceSecondsPer100m: 90,
        actualPaceSecondsPer100m: 81,
      }),
    ).toBeCloseTo(137.17, 1);
  });

  it('rejects non-positive duration', () => {
    expect(() =>
      swimTss({
        durationSeconds: 0,
        tPaceSecondsPer100m: 90,
        actualPaceSecondsPer100m: 90,
      }),
    ).toThrow(/durationSeconds/);
  });

  it('rejects non-positive T-pace', () => {
    expect(() =>
      swimTss({
        durationSeconds: 3600,
        tPaceSecondsPer100m: 0,
        actualPaceSecondsPer100m: 90,
      }),
    ).toThrow(/tPaceSecondsPer100m/);
  });

  it('rejects non-positive actual pace', () => {
    expect(() =>
      swimTss({
        durationSeconds: 3600,
        tPaceSecondsPer100m: 90,
        actualPaceSecondsPer100m: -1,
      }),
    ).toThrow(/actualPaceSecondsPer100m/);
  });

  it('rejects NaN inputs', () => {
    expect(() =>
      swimTss({
        durationSeconds: 3600,
        tPaceSecondsPer100m: 90,
        actualPaceSecondsPer100m: NaN,
      }),
    ).toThrow(/actualPaceSecondsPer100m/);
  });
});
