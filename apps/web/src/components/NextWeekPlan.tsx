import { useCallback, useState } from 'react';
import type { MacroPlanWeek, NextWeekFrame, WeeklyDetail } from '@eta/shared-types';
import { fetchNextWeek, type NextWeekResult } from '../api/next-week.js';
import { WeekCard } from './WeekCard.js';

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded'; result: NextWeekResult };

const RAMP = (pct: number): string => `${pct >= 0 ? '+' : ''}${Math.round(pct * 100)}%`;

function toPlanTreeWeek(frame: NextWeekFrame, weeklyDetail: WeeklyDetail): {
  weekNumber: number; macroWeek: MacroPlanWeek; weeklyDetail: WeeklyDetail;
} {
  const macroWeek: MacroPlanWeek = {
    weekNumber: 1, weekStartDate: frame.weekStartDate, phase: frame.phase,
    isRecoveryWeek: frame.isRecoveryWeek, weeklyVolumeHours: frame.targetVolumeHours, keySessions: [],
  };
  return { weekNumber: 1, macroWeek, weeklyDetail };
}

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
    return (
      <>
        <p className="next-week-why">
          <span className={`phase-tag phase-${r.frame.phase}`}>{r.frame.phase.replace('_', ' ')}</span>
          {r.frame.isRecoveryWeek ? <span className="recovery-tag">recovery</span> : null}
          <span className="why-vol">~{r.frame.targetVolumeHours}h</span>
          <span className="why-detail">
            {RAMP(r.frame.rationale.rampPct)} on your {r.frame.rationale.volumeAnchorHours}h recent average ·
            {' '}{r.frame.rationale.weeksUntilRace} weeks to race
          </span>
        </p>
        <WeekCard week={toPlanTreeWeek(r.frame, r.weeklyDetail)} isCurrent />
      </>
    );
  }
}
