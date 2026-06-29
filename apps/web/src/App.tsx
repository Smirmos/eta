import { useCallback, useEffect, useState } from 'react';
import { fetchPlanTree, type FetchResult } from './api/fetch-plan-tree.js';
import { PlanHeader } from './components/PlanHeader.js';
import { AdaptationCard } from './components/AdaptationCard.js';
import { WeekOverview } from './components/WeekOverview.js';
import { WeekCard } from './components/WeekCard.js';
import { indexOfCurrentWeek } from './lib/current-week.js';

type State = { kind: 'loading' } | { kind: 'done'; result: FetchResult };

// Module-scope so the default has a STABLE identity across renders. An inline
// default (`fetchTree = () => fetchPlanTree()`) creates a new function every
// render, which would change the `load` useCallback every render and make the
// mount effect re-fire endlessly (Maximum update depth exceeded).
const defaultFetchTree = (): Promise<FetchResult> => fetchPlanTree();

export function App({
  fetchTree = defaultFetchTree,
}: {
  fetchTree?: () => Promise<FetchResult>;
} = {}): JSX.Element {
  const [state, setState] = useState<State>({ kind: 'loading' });

  const load = useCallback(() => {
    setState({ kind: 'loading' });
    void fetchTree().then((result) => setState({ kind: 'done', result }));
  }, [fetchTree]);

  useEffect(() => load(), [load]);

  if (state.kind === 'loading') {
    return <main className="app">
      <p className="status loading">Loading plan…</p>
    </main>;
  }

  const { result } = state;
  if (result.status === 'empty') {
    return (
      <main className="app">
        <p className="status empty">
          No plan yet — run the pipeline (<code>pnpm seed:profile</code> →{' '}
          <code>generate:test-plan</code> → <code>generate:test-week</code> →{' '}
          <code>adapt:current-week</code>), then refresh.
        </p>
        <button type="button" onClick={load}>
          Refresh
        </button>
      </main>
    );
  }
  if (result.status === 'error') {
    return (
      <main className="app">
        <p className="status error">Couldn't load the plan: {result.message}</p>
        <button type="button" onClick={load}>
          Retry
        </button>
      </main>
    );
  }

  const { tree } = result;
  const currentIndex = indexOfCurrentWeek(tree.weeks, new Date());
  return (
    <main className="app">
      <div className="toolbar">
        <button type="button" onClick={load}>
          Refresh
        </button>
      </div>
      <PlanHeader tree={tree} />
      <AdaptationCard adaptation={tree.currentAdaptation} />
      <WeekOverview weeks={tree.weeks} currentIndex={currentIndex} />
      <section className="weeks">
        {tree.weeks.map((w, i) => (
          <WeekCard key={w.weekNumber} week={w} isCurrent={i === currentIndex} />
        ))}
      </section>
    </main>
  );
}
