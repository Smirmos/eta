import type { NextWeekFrame, PlannedWorkout, WeeklyDetail } from '@eta/shared-types';
import { formatDuration } from '../lib/format.js';
import { formatHours, groupByDiscipline, sessionType, type DisciplineGroup } from '../lib/nextWeekView.js';

const RAMP = (pct: number): string => `${pct >= 0 ? '+' : ''}${Math.round(pct * 100)}%`;

export function NextWeekBoard({
  frame,
  weeklyDetail,
}: {
  frame: NextWeekFrame;
  weeklyDetail: WeeklyDetail;
}): JSX.Element {
  const groups = groupByDiscipline(weeklyDetail.workouts);
  const totalSeconds = groups.reduce((sum, g) => sum + g.totalSeconds, 0) || 1;

  return (
    <div className="next-week-board">
      <header className="nwb-head panel">
        <div className="nwb-top">
          <span className="nwb-vol">~{frame.targetVolumeHours}h</span>
          <span className={`phase-tag phase-${frame.phase}`}>{frame.phase.replace(/_/g, ' ')}</span>
          {frame.isRecoveryWeek ? <span className="recovery-tag">recovery</span> : null}
        </div>
        <div className="nwb-bar" role="presentation">
          {groups.map((g) => (
            <span
              key={g.discipline}
              className={`nwb-seg disc-${g.discipline}`}
              style={{ width: `${(g.totalSeconds / totalSeconds) * 100}%` }}
            />
          ))}
        </div>
        <p className="nwb-why">
          {RAMP(frame.rationale.rampPct)} on your {frame.rationale.volumeAnchorHours}h recent average ·{' '}
          {frame.rationale.weeksUntilRace} weeks to race
          {frame.rationale.easeTriggered ? ' · auto-eased' : ''}
        </p>
      </header>

      {weeklyDetail.globalNotes ? <p className="nwb-notes">{weeklyDetail.globalNotes}</p> : null}

      {groups.map((g) => (
        <DisciplineSection key={g.discipline} group={g} frame={frame} />
      ))}
    </div>
  );
}

function DisciplineSection({ group, frame }: { group: DisciplineGroup; frame: NextWeekFrame }): JSX.Element {
  return (
    <section className={`nwb-disc panel disc-${group.discipline}`}>
      <header className="nwb-disc-head">
        <span className="nwb-disc-name">{group.discipline}</span>
        <span className="nwb-disc-total">
          {formatHours(group.totalSeconds)} · {group.sessionCount} session{group.sessionCount === 1 ? '' : 's'}
        </span>
      </header>
      {group.sessions.map((w, i) => (
        <SessionRow key={`${w.workoutCode}-${w.date}-${i}`} workout={w} frame={frame} />
      ))}
    </section>
  );
}

function SessionRow({ workout, frame }: { workout: PlannedWorkout; frame: NextWeekFrame }): JSX.Element {
  return (
    <article className="nwb-session">
      <div className="nwb-session-head">
        <span className="nwb-type">{sessionType(workout, frame)}</span>
        <span className="nwb-dur">{formatDuration(workout.totalDurationSeconds)}</span>
        <code className="nwb-code">{workout.workoutCode}</code>
      </div>
      {workout.segments.length > 0 ? (
        <ul className="nwb-segments">
          {workout.segments.map((s, i) => (
            <li key={`${s.label}-${i}`} className="nwb-segment">
              <span className="nwb-seg-label">{s.label}</span>
              <span className="nwb-seg-dur">{formatDuration(s.durationSeconds)}</span>
              <span className={`nwb-seg-zone zone-${s.zone}`}>{s.zone}</span>
              <span className="nwb-seg-desc">{s.description}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="nwb-rationale">↳ {workout.rationale}</p>
    </article>
  );
}
