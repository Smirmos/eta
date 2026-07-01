import type { PlanTree } from '../api/plan-tree.types.js';

export function PlanHeader({ tree }: { tree: PlanTree }): JSX.Element {
  const { macroPlan, macroPlanId } = tree;
  return (
    <header className="plan-header">
      <h1>Training plan</h1>
      <dl className="plan-meta">
        <div>
          <dt>Race date</dt>
          <dd>{macroPlan.raceDate}</dd>
        </div>
        <div>
          <dt>Weeks</dt>
          <dd>{tree.weeks.length}</dd>
        </div>
        <div>
          <dt>Plan ID</dt>
          <dd>
            <code>{macroPlanId}</code>
          </dd>
        </div>
      </dl>
    </header>
  );
}
