// Pure HTML renderer for the PlanTree + completed-workout overlay + current
// adaptation. POC-C throwaway tooling — no Nest, no fs, no DI. Returns a
// single self-contained HTML document with inline CSS only.

import type {
  AthleteProfile,
  PlannedWorkout,
  WorkoutAdjustment,
  WorkoutCompleted,
  WorkoutSegment,
} from '@eta/shared-types';
import type { PlanTree, PlanTreeWeek } from '../../src/modules/plans/plans.service.js';

export interface RenderTreeHtmlArgs {
  tree: PlanTree;
  profile: AthleteProfile;
  completedWorkouts: WorkoutCompleted[];
  today?: Date;
}

export function renderTreeHtml(args: RenderTreeHtmlArgs): string {
  const { tree, profile, completedWorkouts, today = new Date() } = args;
  const todayIso = today.toISOString().slice(0, 10);
  const currentIdx = indexOfCurrentWeek(tree.weeks, todayIso);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(`PlanTree — ${tree.macroPlan.raceDate}`)}</title>
<style>${renderInlineCss(tree.currentAdaptation !== null)}</style>
</head>
<body>
<div class="container">
${renderHeader(profile, tree)}
${renderAdaptationCard(tree)}
${renderOverview(tree, currentIdx)}
<section class="weeks">
${tree.weeks.map((w, i) => renderWeek(w, completedWorkouts, i === currentIdx)).join('\n')}
</section>
<footer class="footer">macroPlanId: <code>${escapeHtml(tree.macroPlanId)}</code> · generated ${escapeHtml(tree.generatedAt.toISOString().slice(0, 10))}</footer>
</div>
</body>
</html>
`;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function fmtDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0m';
  const totalMin = Math.round(seconds / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin - h * 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function addDaysIso(iso: string, days: number): string {
  const ms = Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

function indexOfCurrentWeek(weeks: PlanTreeWeek[], todayIso: string): number {
  if (weeks.length === 0) return -1;
  const todayMs = Date.parse(`${todayIso}T00:00:00Z`);
  for (let i = 0; i < weeks.length; i++) {
    const w = weeks[i]!;
    const startMs = Date.parse(`${w.macroWeek.weekStartDate}T00:00:00Z`);
    const endMs = startMs + 7 * 86_400_000;
    if (todayMs >= startMs && todayMs < endMs) return i;
  }
  return weeks.length - 1;
}

function renderHeader(profile: AthleteProfile, tree: PlanTree): string {
  const raceDateIso =
    profile.raceDate instanceof Date
      ? profile.raceDate.toISOString().slice(0, 10)
      : String(profile.raceDate).slice(0, 10);
  return `<header class="header">
<h1>Plan tree</h1>
<dl class="meta">
<div><dt>Race date</dt><dd>${escapeHtml(raceDateIso)}</dd></div>
<div><dt>Race type</dt><dd>${escapeHtml(profile.raceType)}</dd></div>
<div><dt>Weeks until race</dt><dd>${profile.weeksUntilRace}</dd></div>
<div><dt>Planned weekly hours</dt><dd>${profile.plannedWeeklyHours}</dd></div>
<div><dt>macroPlanId</dt><dd><code>${escapeHtml(tree.macroPlanId)}</code></dd></div>
</dl>
</header>`;
}

function renderAdaptationCard(tree: PlanTree): string {
  const a = tree.currentAdaptation;
  if (!a) return '';
  const items = a.adjustments.map((adj) => renderAdjustment(adj)).join('\n');
  const weekNote = a.weekLevelNote
    ? `<p class="week-note"><strong>Note:</strong> ${escapeHtml(a.weekLevelNote)}</p>`
    : '';
  return `<section class="adaptation-card">
<h2>Pass 3 adjustments for the current week</h2>
<p class="for-week">For week starting <strong>${escapeHtml(a.forWeekStart)}</strong> · generated ${escapeHtml(a.generatedAt.slice(0, 10))}</p>
${weekNote}
<ul class="adjustments">
${items}
</ul>
</section>`;
}

function renderAdjustment(adj: WorkoutAdjustment): string {
  const changes: string[] = [];
  if (adj.newWorkoutCode) changes.push(`new code: <code>${escapeHtml(adj.newWorkoutCode)}</code>`);
  if (typeof adj.newDurationSeconds === 'number')
    changes.push(`new duration: ${escapeHtml(fmtDuration(adj.newDurationSeconds))}`);
  if (adj.newZone) changes.push(`new zone: ${escapeHtml(adj.newZone)}`);
  if (adj.newDate) changes.push(`new date: ${escapeHtml(adj.newDate)}`);
  const changesHtml = changes.length > 0 ? `<div class="changes">${changes.join(' · ')}</div>` : '';
  return `<li class="adjustment a-${escapeHtml(adj.action)}">
<div class="adj-head">
<span class="action">${escapeHtml(adj.action)}</span>
<code class="code">${escapeHtml(adj.originalWorkoutCode)}</code>
<span class="date">${escapeHtml(adj.originalDate)}</span>
</div>
${changesHtml}
<p class="reasoning">${escapeHtml(adj.reasoning)}</p>
<p class="citation">citation: <code>${escapeHtml(adj.citation)}</code></p>
</li>`;
}

function renderOverview(tree: PlanTree, currentIdx: number): string {
  const rows = tree.weeks
    .map((w, i) => {
      const cur = i === currentIdx ? ' class="current"' : '';
      const recovery = w.macroWeek.isRecoveryWeek
        ? '<span class="badge recovery">recovery</span>'
        : '';
      const hasDetail = w.weeklyDetail ? '<span class="badge detail">P2</span>' : '';
      return `<li${cur}>
<span class="wnum">week ${w.weekNumber}</span>
<span class="phase">${escapeHtml(w.macroWeek.phase)}</span>
<span class="vol">${w.macroWeek.weeklyVolumeHours}h</span>
${recovery}
${hasDetail}
</li>`;
    })
    .join('\n');
  return `<section class="overview">
<h2>Overview</h2>
<ul class="overview-list">
${rows}
</ul>
</section>`;
}

function renderWeek(
  w: PlanTreeWeek,
  completed: WorkoutCompleted[],
  isCurrent: boolean,
): string {
  const cls = `week${isCurrent ? ' current' : ''}`;
  const mw = w.macroWeek;
  const recovery = mw.isRecoveryWeek ? ' <span class="badge recovery">recovery</span>' : '';
  const head = `<header class="week-head">
<span class="wn">week ${w.weekNumber}</span>
<span class="wstart">${escapeHtml(mw.weekStartDate)}</span>
<span class="phase">${escapeHtml(mw.phase)}</span>
<span class="vol">${mw.weeklyVolumeHours}h</span>${recovery}
</header>`;

  let body: string;
  if (w.weeklyDetail) {
    const plannedDates = new Set(w.weeklyDetail.workouts.map((p) => p.date));
    const workouts = w.weeklyDetail.workouts
      .map((p) => renderWorkout(p, completed))
      .join('\n');

    const weekEnd = addDaysIso(mw.weekStartDate, 7);
    const extras = completed.filter(
      (c) =>
        c.date >= mw.weekStartDate &&
        c.date < weekEnd &&
        !plannedDates.has(c.date),
    );
    const extrasHtml =
      extras.length === 0
        ? ''
        : `<div class="extras">
<h4>Extras (completed, no planned match)</h4>
${extras.map((c) => renderExtra(c)).join('\n')}
</div>`;

    body = `<div class="workouts">
${workouts}
</div>
${extrasHtml}`;
  } else {
    const weekEnd = addDaysIso(mw.weekStartDate, 7);
    const extras = completed.filter(
      (c) => c.date >= mw.weekStartDate && c.date < weekEnd,
    );
    const extrasHtml =
      extras.length === 0
        ? ''
        : `<div class="extras">
<h4>Completed this week (no Pass 2 to match against)</h4>
${extras.map((c) => renderExtra(c)).join('\n')}
</div>`;

    body = `<p class="placeholder">no Pass 2 generated yet</p>
${extrasHtml}`;
  }

  return `<article class="${cls}">
${head}
${body}
</article>`;
}

function renderWorkout(p: PlannedWorkout, completed: WorkoutCompleted[]): string {
  const match = completed.find(
    (c) => c.date === p.date && c.discipline === p.discipline,
  );
  const doneCls = match ? ' done' : '';
  const checkmark = match ? '<span class="check">✓</span> ' : '';

  const segments =
    p.segments.length === 0
      ? ''
      : `<ul class="segments">
${p.segments.map((s) => renderSegment(s)).join('\n')}
</ul>`;

  const matchInfo = match ? renderMatchInfo(match) : '';

  return `<div class="workout${doneCls}">
<div class="wkt-head">
${checkmark}<code class="code">${escapeHtml(p.workoutCode)}</code>
<span class="disc">${escapeHtml(p.discipline)}</span>
<span class="date">${escapeHtml(p.date)}</span>
<span class="dur">${escapeHtml(fmtDuration(p.totalDurationSeconds))}</span>
</div>
${segments}
<p class="rationale">${escapeHtml(p.rationale)}</p>
<p class="citation">citation: <code>${escapeHtml(p.citation)}</code></p>
${matchInfo}
</div>`;
}

function renderSegment(s: WorkoutSegment): string {
  return `<li class="segment">
<span class="seg-label">${escapeHtml(s.label)}</span>
<span class="seg-dur">${escapeHtml(fmtDuration(s.durationSeconds))}</span>
<span class="seg-zone">${escapeHtml(s.zone)}</span>
</li>`;
}

function renderMatchInfo(c: WorkoutCompleted): string {
  const parts: string[] = [];
  if (typeof c.actualTss === 'number') parts.push(`actualTss=${c.actualTss}`);
  if (typeof c.actualDurationSeconds === 'number')
    parts.push(`actualDuration=${fmtDuration(c.actualDurationSeconds)}`);
  if (parts.length === 0) return '';
  return `<p class="match-info">${parts.map((p) => escapeHtml(p)).join(' · ')}</p>`;
}

function renderExtra(c: WorkoutCompleted): string {
  const bits: string[] = [];
  if (typeof c.actualTss === 'number') bits.push(`actualTss=${c.actualTss}`);
  if (typeof c.actualDurationSeconds === 'number')
    bits.push(`actualDuration=${fmtDuration(c.actualDurationSeconds)}`);
  const meta = bits.length > 0 ? ` · ${bits.map((p) => escapeHtml(p)).join(' · ')}` : '';
  return `<div class="extra">
<span class="date">${escapeHtml(c.date)}</span>
<span class="disc">${escapeHtml(c.discipline ?? '—')}</span>${meta}
</div>`;
}

function renderInlineCss(includeAdaptation: boolean): string {
  const base = `
:root {
  --bg: #fafaf7;
  --ink: #1a1a1a;
  --ink-2: #565a60;
  --ink-3: #8a8d93;
  --line: #e3e1da;
  --line-2: #c8c5bb;
  --accent: #6f4f1f;
  --accent-bg: #f6efde;
  --good: #4a7c4a;
  --warn: #b26c3a;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}
code { font-family: ui-monospace, SFMono-Regular, "SF Mono", Monaco, monospace; font-size: 0.9em; }
h1, h2, h3, h4 { margin: 0; }

.container { max-width: 1100px; margin: 0 auto; padding: 28px 24px 60px; }

.header {
  border-bottom: 1px solid var(--line);
  padding-bottom: 16px;
  margin-bottom: 20px;
}
.header h1 { font-size: 26px; letter-spacing: -0.01em; margin-bottom: 10px; }
.meta { display: flex; flex-wrap: wrap; gap: 18px 28px; margin: 0; }
.meta div { display: flex; flex-direction: column; }
.meta dt { font-size: 11px; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.05em; }
.meta dd { margin: 2px 0 0; font-weight: 600; }

.overview { margin-bottom: 24px; }
.overview h2 { font-size: 16px; margin-bottom: 8px; }
.overview-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
.overview-list li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 10px;
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 4px;
  font-size: 13px;
}
.overview-list li.current { border-left: 3px solid var(--accent); background: var(--accent-bg); }
.overview-list .wnum { font-weight: 600; min-width: 70px; }
.overview-list .phase { color: var(--ink-2); min-width: 90px; }
.overview-list .vol { color: var(--ink-3); min-width: 60px; }

.badge {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: 0.05em;
}
.badge.recovery { background: #e3efe1; color: #355e36; }
.badge.detail { background: #e0e6f0; color: #2a4666; }

.weeks { display: flex; flex-direction: column; gap: 18px; }
.week {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 14px 16px;
  border-left: 3px solid transparent;
}
.week.current { border-left-color: var(--accent); background: #fffdf6; }
.week-head {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  padding-bottom: 8px; margin-bottom: 10px;
  border-bottom: 1px solid var(--line);
}
.week-head .wn { font-weight: 700; }
.week-head .wstart { color: var(--ink-2); font-variant-numeric: tabular-nums; }
.week-head .phase { color: var(--ink-2); font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
.week-head .vol { color: var(--ink-3); font-variant-numeric: tabular-nums; }

.placeholder { color: var(--ink-3); font-style: italic; margin: 4px 0; }

.workouts { display: flex; flex-direction: column; gap: 10px; }
.workout {
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 10px 12px;
  background: #fbfaf6;
}
.workout.done { color: var(--ink-2); background: #f1f6ef; border-color: #d4dfd0; }
.workout.done .code { color: var(--good); }
.wkt-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 4px; }
.wkt-head .code { font-weight: 700; }
.wkt-head .disc { font-size: 12px; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.04em; }
.wkt-head .date { color: var(--ink-2); font-variant-numeric: tabular-nums; }
.wkt-head .dur { margin-left: auto; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.check { color: var(--good); font-weight: 700; }

.segments { list-style: none; padding: 0; margin: 4px 0; display: flex; flex-direction: column; gap: 2px; }
.segment {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: var(--ink-2);
}
.seg-label { font-weight: 600; min-width: 90px; }
.seg-dur { color: var(--ink-3); min-width: 60px; }
.seg-zone {
  font-family: ui-monospace, SFMono-Regular, monospace;
  font-size: 11px;
  padding: 1px 6px;
  background: #eee;
  border-radius: 999px;
}

.rationale { margin: 4px 0; font-size: 13px; }
.citation { margin: 0; font-size: 11px; color: var(--ink-3); }
.match-info { margin: 4px 0 0; font-size: 12px; color: var(--good); font-weight: 600; }

.extras { margin-top: 10px; padding-top: 8px; border-top: 1px dashed var(--line-2); }
.extras h4 { font-size: 11px; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; font-weight: 600; }
.extra {
  font-size: 11px;
  color: var(--ink-3);
  padding: 2px 0;
  display: flex;
  gap: 10px;
}
.extra .date { font-variant-numeric: tabular-nums; }
.extra .disc { text-transform: uppercase; letter-spacing: 0.04em; }

.footer {
  margin-top: 32px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
  color: var(--ink-3);
  font-size: 11px;
  text-align: center;
}
`;
  const adaptationCss = `
.adaptation-card {
  background: var(--accent-bg);
  border: 1px solid var(--line-2);
  border-left: 4px solid var(--accent);
  border-radius: 8px;
  padding: 16px 18px;
  margin-bottom: 22px;
}
.adaptation-card h2 { font-size: 16px; margin-bottom: 6px; color: var(--accent); }
.adaptation-card .for-week { margin: 0 0 8px; color: var(--ink-2); font-size: 13px; }
.adaptation-card .week-note { margin: 6px 0 10px; font-size: 13px; }
.adjustments { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.adjustment {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 10px 12px;
}
.adjustment .adj-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
.adjustment .action {
  text-transform: uppercase;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  padding: 2px 7px;
  border-radius: 999px;
  background: #eee;
  color: var(--ink-2);
}
.adjustment.a-modify .action { background: #fff3d6; color: #7a5a12; }
.adjustment.a-replace .action { background: #fde0d0; color: #9a3a1e; }
.adjustment.a-keep .action { background: #e3efe1; color: #355e36; }
.adjustment .code { color: var(--ink); }
.adjustment .date { color: var(--ink-3); font-size: 12px; }
.adjustment .changes { font-size: 12px; color: var(--ink-2); margin-top: 2px; }
.adjustment .reasoning { margin: 4px 0; font-size: 13px; }
.adjustment .citation { margin: 0; font-size: 11px; color: var(--ink-3); }
`;
  return includeAdaptation ? base + adaptationCss : base;
}
