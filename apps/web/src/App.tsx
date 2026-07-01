import { useCallback, useEffect, useState } from 'react';
import { fetchAnalysis, type AnalysisResult } from './api/analysis.js';
import { TrainingSummary } from './components/TrainingSummary.js';
import { NextWeekPlan } from './components/NextWeekPlan.js';

type State = { kind: 'loading' } | { kind: 'done'; result: AnalysisResult };

const defaultFetchAnalysis = (): Promise<AnalysisResult> => fetchAnalysis();

export function App({
  fetchAnalysisImpl = defaultFetchAnalysis,
}: {
  fetchAnalysisImpl?: () => Promise<AnalysisResult>;
} = {}): JSX.Element {
  const [state, setState] = useState<State>({ kind: 'loading' });

  const load = useCallback(() => {
    setState({ kind: 'loading' });
    void fetchAnalysisImpl().then((result) => setState({ kind: 'done', result }));
  }, [fetchAnalysisImpl]);

  useEffect(() => load(), [load]);

  if (state.kind === 'loading') {
    return (
      <main className="app">
        <p className="status loading">Analyzing training…</p>
      </main>
    );
  }

  const { result } = state;
  if (result.status === 'error') {
    return (
      <main className="app">
        <p className="status error">Couldn't load your training: {result.message}</p>
        <button type="button" onClick={load}>
          Retry
        </button>
      </main>
    );
  }

  return (
    <main className="app">
      <div className="toolbar">
        <button type="button" onClick={load}>
          Refresh
        </button>
      </div>
      <TrainingSummary analysis={result.analysis} />
      <NextWeekPlan />
    </main>
  );
}
