import type { TrainingAnalysisResponse } from '@eta/shared-types';
import { deriveInsights } from '../lib/insights.js';

const TREND_LABEL: Record<string, string> = {
  building: '↗ Building',
  steady: '→ Steady',
  tapering: '↘ Easing',
};

export function TrainingSummary({
  analysis,
}: {
  analysis: TrainingAnalysisResponse;
}): JSX.Element {
  if (!analysis.hasData || !analysis.window) {
    return (
      <section className="summary-empty">
        <h2>No recent training</h2>
        <p>No completed workouts found. Sync Strava, then refresh.</p>
      </section>
    );
  }

  const { window, overall, perWeek, trend, longestSessions, dataNote, narrative } = analysis;
  const insights = deriveInsights(analysis);
  const watch = insights.filter((i) => i.tone === 'watch');
  const strengths = insights.filter((i) => i.tone === 'strength');

  const maxWeekHours = Math.max(...perWeek.map((w) => w.hours), 1);
  const maxSessionMin = Math.max(...longestSessions.map((l) => l.minutes), 1);
  // Lowest share of volume = the weakest discipline; flag it for emphasis.
  const weakest = overall.sportSplit.reduce<string | null>(
    (lo, s) => (lo == null || s.pctHours < (overall.sportSplit.find((x) => x.discipline === lo)?.pctHours ?? 100) ? s.discipline : lo),
    null,
  );

  return (
    <section className="summary">
      <header className="summary-head">
        <p className="eyebrow">Training load · 4-week block</p>
        <h1>Training summary</h1>
        <p className="window-line">
          <span className="rng">{window.from}</span>
          <span className="arr">→</span>
          <span className="rng">{window.asOf}</span>
          <span className="window-tag">most recent activity</span>
        </p>
        {dataNote.staleDays > 7 ? (
          <p className="stale-note">
            ⚠ Latest synced activity is <strong>{dataNote.staleDays} days old</strong>. These numbers
            end at {window.asOf} — sync Strava for current data.
          </p>
        ) : null}
      </header>

      <dl className="stat-strip">
        <div>
          <dt>Total volume</dt>
          <dd>{overall.totalHours}<span className="unit">h</span></dd>
        </div>
        <div>
          <dt>Sessions</dt>
          <dd>{overall.totalSessions}<span className="unit">· {overall.avgSessionsPerWeek}/wk</span></dd>
        </div>
        <div>
          <dt>Training days</dt>
          <dd>{overall.avgTrainingDaysPerWeek}<span className="unit">/wk</span></dd>
        </div>
        <div>
          <dt>4-wk trend</dt>
          <dd><span className={`trend trend-${trend}`}>{TREND_LABEL[trend] ?? trend}</span></dd>
        </div>
      </dl>

      {insights.length > 0 ? (
        <div className="insights">
          <div className="insight-col watch-col">
            <h2 className="insight-h">Watch-outs <span className="count">{watch.length}</span></h2>
            {watch.length > 0 ? (
              <ul>
                {watch.map((i) => (
                  <li key={i.id} className="insight watch">
                    <span className="i-label">{i.label}</span>
                    <span className="i-detail">{i.detail}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="insight-none">Nothing flagged — clean block.</p>
            )}
          </div>
          <div className="insight-col strength-col">
            <h2 className="insight-h">Strengths <span className="count">{strengths.length}</span></h2>
            {strengths.length > 0 ? (
              <ul>
                {strengths.map((i) => (
                  <li key={i.id} className="insight strength">
                    <span className="i-label">{i.label}</span>
                    <span className="i-detail">{i.detail}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="insight-none">No standout strengths yet.</p>
            )}
          </div>
        </div>
      ) : null}

      <div className="panel sport-split">
        <div className="panel-head">
          <h2>Sport balance</h2>
          <p className="panel-sub">Share of training time by discipline</p>
        </div>
        {overall.sportSplit.map((s) => (
          <div
            key={s.discipline}
            className={`split-row disc-${s.discipline}${s.discipline === weakest ? ' is-weak' : ''}`}
          >
            <span className="disc">{s.discipline}</span>
            <span className="track"><span className="bar" style={{ width: `${s.pctHours}%` }} /></span>
            <span className="val">{s.hours}h · {s.pctHours}% · {s.sessions} sess</span>
          </div>
        ))}
      </div>

      <div className="panel weeks-breakdown">
        <div className="panel-head">
          <h2>Weekly volume</h2>
          <p className="panel-sub">Hours per 7-day block · newest at the bottom</p>
        </div>
        {perWeek.map((w, idx) => (
          <div key={w.weekStart} className={`wk-row${idx === perWeek.length - 1 ? ' is-latest' : ''}`}>
            <span className="wk-start">{w.weekStart}</span>
            <span className="track"><span className="wk-bar" style={{ width: `${Math.round((w.hours / maxWeekHours) * 100)}%` }} /></span>
            <span className="wk-val">
              {w.hours}h · {w.sessions} sess{w.bikeTss != null ? ` · bike TSS ${w.bikeTss}` : ''}
            </span>
          </div>
        ))}
      </div>

      <div className="panel longest">
        <div className="panel-head">
          <h2>Longest sessions</h2>
          <p className="panel-sub">Your biggest single effort per discipline</p>
        </div>
        <ul>
          {longestSessions.map((l) => (
            <li key={`${l.discipline}-${l.date}`} className={`disc-${l.discipline}`}>
              <span className="disc">{l.discipline}</span>
              <span className="track"><span className="bar" style={{ width: `${Math.round((l.minutes / maxSessionMin) * 100)}%` }} /></span>
              <span className="val">{l.minutes} min <span className="date">{l.date}</span></span>
            </li>
          ))}
        </ul>
      </div>

      {narrative ? (
        <div className="panel narrative-panel">
          <div className="panel-head">
            <h2>Coach’s read</h2>
          </div>
          <p className="narrative">{narrative}</p>
        </div>
      ) : null}
    </section>
  );
}
