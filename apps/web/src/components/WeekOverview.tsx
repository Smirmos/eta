import type { PlanTreeWeek } from '../api/plan-tree.types.js';

export function WeekOverview({
  weeks,
  currentIndex,
}: {
  weeks: PlanTreeWeek[];
  currentIndex: number;
}): JSX.Element {
  return (
    <nav className="week-overview" aria-label="Weeks">
      <h2>Overview</h2>
      <ul>
        {weeks.map((w, i) => (
          <li key={w.weekNumber} className={i === currentIndex ? 'current' : undefined}>
            <a
              href={`#week-${w.weekNumber}`}
              aria-current={i === currentIndex ? 'true' : undefined}
            >
              <span className="wnum">week {w.weekNumber}</span>
              <span className="phase">{w.macroWeek.phase}</span>
              <span className="vol">{w.macroWeek.weeklyVolumeHours}h</span>
              {w.macroWeek.isRecoveryWeek ? <span className="badge recovery">recovery</span> : null}
              {w.weeklyDetail ? <span className="badge detail">P2</span> : null}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
