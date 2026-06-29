import type { PlanTree } from '../api/plan-tree.types.js';

export function AdaptationCard({
  adaptation,
}: {
  adaptation: PlanTree['currentAdaptation'];
}): JSX.Element | null {
  if (!adaptation) return null;
  return (
    <section className="adaptation-card">
      <h2>This week's adjustments</h2>
      <p className="for-week">For week starting {adaptation.forWeekStart}</p>
      {adaptation.weekLevelNote ? <p className="week-note">{adaptation.weekLevelNote}</p> : null}
      <ul className="adjustments">
        {adaptation.adjustments.map((adj, i) => (
          <li key={`${adj.originalWorkoutCode}-${adj.originalDate}-${i}`} className={`adj a-${adj.action}`}>
            <div className="adj-head">
              <span className="action">{adj.action}</span>
              <code>{adj.originalWorkoutCode}</code>
              <span className="date">{adj.originalDate}</span>
            </div>
            <p className="reasoning">{adj.reasoning}</p>
            <p className="citation">{adj.citation}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
