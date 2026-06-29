import type { PlannedWorkout } from '@eta/shared-types';
import { formatDuration } from '../lib/format.js';
import { SegmentRow } from './SegmentRow.js';

export function WorkoutCard({ workout }: { workout: PlannedWorkout }): JSX.Element {
  return (
    <div className="workout">
      <div className="wkt-head">
        <code className="code">{workout.workoutCode}</code>
        <span className="disc">{workout.discipline}</span>
        <span className="date">{workout.date}</span>
        <span className="dur">{formatDuration(workout.totalDurationSeconds)}</span>
      </div>
      {workout.segments.length > 0 ? (
        <ul className="segments">
          {workout.segments.map((s, i) => (
            <SegmentRow key={`${s.label}-${i}`} segment={s} />
          ))}
        </ul>
      ) : null}
      <p className="rationale">{workout.rationale}</p>
      <p className="citation">{workout.citation}</p>
    </div>
  );
}
