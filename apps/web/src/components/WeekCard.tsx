import type { PlanTreeWeek } from '../api/plan-tree.types.js';
import { WorkoutCard } from './WorkoutCard.js';

export function WeekCard({
  week,
  isCurrent,
}: {
  week: PlanTreeWeek;
  isCurrent: boolean;
}): JSX.Element {
  const mw = week.macroWeek;
  return (
    <article id={`week-${week.weekNumber}`} className={`week-card${isCurrent ? ' current' : ''}`}>
      <header className="week-head">
        <span className="wn">week {week.weekNumber}</span>
        <span className="wstart">{mw.weekStartDate}</span>
        <span className="phase">{mw.phase}</span>
        <span className="vol">{mw.weeklyVolumeHours}h</span>
        {mw.isRecoveryWeek ? <span className="badge recovery">recovery</span> : null}
      </header>
      {week.weeklyDetail ? (
        <div className="workouts">
          {week.weeklyDetail.workouts.map((w, i) => (
            <WorkoutCard key={`${w.workoutCode}-${w.date}-${i}`} workout={w} />
          ))}
        </div>
      ) : (
        <p className="placeholder">No detailed workouts generated for this week yet.</p>
      )}
    </article>
  );
}
