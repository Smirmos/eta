import { useCallback, useState } from 'react';
import { fetchNextWeek, type NextWeekResult } from '../api/next-week.js';
import { NextWeekBoard } from './NextWeekBoard.js';

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; result: NextWeekResult };

export function NextWeekPlan({
  fetchNextWeekImpl = fetchNextWeek,
}: {
  fetchNextWeekImpl?: () => Promise<NextWeekResult>;
} = {}): JSX.Element {
  const [state, setState] = useState<State>({ kind: 'idle' });

  const generate = useCallback(() => {
    setState({ kind: 'loading' });
    void fetchNextWeekImpl().then((result) => setState({ kind: 'loaded', result }));
  }, [fetchNextWeekImpl]);

  return (
    <section className="next-week">
      <div className="next-week-bar">
        <h2>Next week</h2>
        <button type="button" onClick={generate} disabled={state.kind === 'loading'}>
          {state.kind === 'loaded' ? 'Regenerate' : 'Generate next week'}
        </button>
      </div>

      {state.kind === 'loading' ? <p className="status loading">Building your week…</p> : null}

      {state.kind === 'loaded' ? renderResult(state.result) : null}
    </section>
  );

  function renderResult(result: NextWeekResult): JSX.Element {
    if (result.status === 'error') return <p className="status error">Couldn't build next week: {result.message}</p>;
    const r = result.response;
    if (r.status === 'needs_profile') return <p className="status empty">Seed an athlete profile first (it sets your race date and capacity).</p>;
    if (r.status === 'needs_history') return <p className="status empty">No recent training found — sync Strava, then try again.</p>;
    if (r.status === 'error') return <p className="status error">Couldn't build next week: {r.message}</p>;
    return <NextWeekBoard frame={r.frame} weeklyDetail={r.weeklyDetail} />;
  }
}
