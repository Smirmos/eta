import type { TrainingAnalysisResponse } from '@eta/shared-types';

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
  const maxWeekHours = Math.max(...perWeek.map((w) => w.hours), 1);

  return (
    <section className="summary">
      <header className="summary-head">
        <p className="eyebrow">Last 4 weeks · {window.from} → {window.asOf}</p>
        <h1>Training summary</h1>
        {dataNote.staleDays > 7 ? (
          <p className="stale-note">Data is {dataNote.staleDays} days old — sync Strava for current numbers.</p>
        ) : null}
      </header>

      <dl className="stat-strip">
        <div><dt>Hours</dt><dd>{overall.totalHours}</dd></div>
        <div><dt>Sessions</dt><dd>{overall.totalSessions}</dd></div>
        <div><dt>Days/week</dt><dd>{overall.avgTrainingDaysPerWeek}</dd></div>
        <div><dt>Trend</dt><dd><span className={`trend trend-${trend}`}>{trend}</span></dd></div>
      </dl>

      <div className="sport-split">
        {overall.sportSplit.map((s) => (
          <div key={s.discipline} className={`split-row disc-${s.discipline}`}>
            <span className="disc">{s.discipline}</span>
            <span className="bar" style={{ width: `${s.pctHours}%` }} />
            <span className="val">{s.hours}h · {s.pctHours}%</span>
          </div>
        ))}
      </div>

      <div className="weeks-breakdown">
        <h2>Per week</h2>
        {perWeek.map((w) => (
          <div key={w.weekStart} className="wk-row">
            <span className="wk-start">{w.weekStart}</span>
            <span className="wk-bar" style={{ width: `${Math.round((w.hours / maxWeekHours) * 100)}%` }} />
            <span className="wk-val">{w.hours}h · {w.sessions} sessions{w.bikeTss != null ? ` · bike TSS ${w.bikeTss}` : ''}</span>
          </div>
        ))}
      </div>

      <div className="longest">
        <h2>Longest sessions</h2>
        <ul>
          {longestSessions.map((l) => (
            <li key={`${l.discipline}-${l.date}`}>
              <span className="disc">{l.discipline}</span> {l.minutes} min <span className="date">({l.date})</span>
            </li>
          ))}
        </ul>
      </div>

      {narrative ? <p className="narrative">{narrative}</p> : null}
    </section>
  );
}
