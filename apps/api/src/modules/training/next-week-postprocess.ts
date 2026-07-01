import type { NextWeekFrame, WeeklyDetail } from '@eta/shared-types';

const HARD_ZONES = new Set(['z4', 'z5a', 'z5b', 'z5c']);
const VOLUME_TOLERANCE = 0.1;

export class NextWeekGuardError extends Error {
  readonly violations: string[];
  constructor(violations: string[]) {
    super(`Next-week guard violations (${violations.length}): ${violations.join('; ')}`);
    this.name = 'NextWeekGuardError';
    this.violations = violations;
  }
}

/** Frame-specific guards beyond validateWeeklyDetailConstraints: total volume
 *  within ±10% of target, and hard-session count within the phase allowance. */
export function validateNextWeekVolume(weeklyDetail: WeeklyDetail, frame: NextWeekFrame): void {
  const violations: string[] = [];

  const totalHours = weeklyDetail.workouts.reduce((s, w) => s + w.totalDurationSeconds / 3600, 0);
  if (frame.targetVolumeHours > 0) {
    const delta = Math.abs(totalHours - frame.targetVolumeHours) / frame.targetVolumeHours;
    if (delta > VOLUME_TOLERANCE) {
      violations.push(
        `weekly hours ${totalHours.toFixed(1)} vs target ${frame.targetVolumeHours} — ` +
          `${(delta * 100).toFixed(0)}% exceeds ±${VOLUME_TOLERANCE * 100}%`,
      );
    }
  }

  const hardCount = weeklyDetail.workouts.filter((w) => w.segments.some((s) => HARD_ZONES.has(s.zone))).length;
  const allowed = frame.days.filter((d) => d.role === 'quality').length;
  if (hardCount > allowed + 1) {
    violations.push(`hard sessions ${hardCount} exceed phase allowance ${allowed} (+1 tolerance)`);
  }

  if (violations.length > 0) throw new NextWeekGuardError(violations);
}
