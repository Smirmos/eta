import type { AthleteProfile, Discipline, TssStatus } from '@eta/shared-types';
import { bikeTss } from '@eta/training-load';
import type { NewWorkoutsCompletedRow } from '../../../db/schema/workouts-completed.js';
import type { StravaActivity } from './strava.types.js';

const STRAVA_TYPE_TO_DISCIPLINE: Record<string, Discipline> = {
  Ride: 'bike',
  VirtualRide: 'bike',
  EBikeRide: 'bike',
  MountainBikeRide: 'bike',
  GravelRide: 'bike',
  Run: 'run',
  TrailRun: 'run',
  VirtualRun: 'run',
  Swim: 'swim',
};

export interface NormalizeArgs {
  userId: string;
  activity: StravaActivity;
  /** AthleteProfile is needed for TSS math. Absent → tssStatus = 'pending_inference'. */
  athleteProfile?: AthleteProfile | null;
}

/**
 * Map a Strava activity to a workouts_completed row. Returns null when the
 * activity isn't one of swim/bike/run — those aren't part of the triathlon
 * canonical model and are dropped on ingest.
 */
export function normalizeStravaActivity(args: NormalizeArgs): NewWorkoutsCompletedRow | null {
  const { userId, activity, athleteProfile } = args;
  const discipline = STRAVA_TYPE_TO_DISCIPLINE[activity.type];
  if (!discipline) return null;

  const date = activity.start_date_local.slice(0, 10);
  const tss = computeTssIfPossible(discipline, activity, athleteProfile ?? null);
  const tssStatus: TssStatus = tss !== null ? 'computed' : 'pending_inference';

  const notes = joinNotes(activity.name, activity.description);
  const perceivedExertion = activity.perceived_exertion ?? undefined;

  return {
    userId,
    source: 'strava',
    externalId: String(activity.id),
    date,
    discipline,
    workoutCode: null, // resolved by a downstream plan-match step
    actualTss: tss !== null ? tss.toFixed(2) : null,
    tssStatus,
    plannedTss: null,
    plannedDurationSeconds: null,
    actualDurationSeconds: activity.moving_time,
    perceivedExertion: perceivedExertion ?? null,
    notes: notes ?? null,
    raw: activity,
  };
}

// ─── TSS strategy ────────────────────────────────────────────────────────────
//
// v1 only computes TSS for the bike-with-power path. Run NGP and swim T-pace
// math need data this normalizer doesn't pull (stream-derived NGP, per-100m
// pace). Everything else gets pending_inference; ETA-25's docs note this and
// a future ticket can extend.

function computeTssIfPossible(
  discipline: Discipline,
  activity: StravaActivity,
  profile: AthleteProfile | null,
): number | null {
  if (!profile) return null;

  if (discipline === 'bike') {
    const ftp = profile.thresholds.bikeFtpWatts?.value;
    const np = activity.weighted_average_watts ?? activity.average_watts;
    if (typeof ftp === 'number' && ftp > 0 && typeof np === 'number' && np > 0) {
      return bikeTss({
        durationSeconds: activity.moving_time,
        ftpWatts: ftp,
        normalizedPowerWatts: np,
      });
    }
  }

  // Run and swim TSS deferred to a follow-up.
  return null;
}

function joinNotes(name?: string, description?: string | null): string | undefined {
  const parts = [name?.trim(), description?.trim()].filter((s): s is string => !!s);
  return parts.length > 0 ? parts.join('\n\n') : undefined;
}
