/* eslint-disable no-console */
// Renders the most recent macro plan JSON in scripts/output/ to a single
// self-contained HTML file. Throwaway tooling — not a product feature.
//
// Layout: calendar grid per week (7 days). Each session is a compact card.
// Click a card → native <dialog> modal opens with the full workout details.
// Visuals via emoji (no SVG illustrations).
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AthleteProfile, MacroPlan, MacroPlanWeek } from '@eta/shared-types';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = resolve(HERE, 'output');
const PROFILE_PATH = resolve(HERE, 'test-profile.json');
const REPO_ROOT = resolve(HERE, '..', '..', '..');
const KB_WORKOUTS = resolve(REPO_ROOT, 'knowledge-base', '03-workouts.md');

// ─── Locate latest plan ──────────────────────────────────────────────────────

interface FileEntry {
  name: string;
  path: string;
  mtime: number;
}

function locateLatestPlan(): { path: string; timestamp: string } {
  const entries = readdirSync(OUTPUT_DIR)
    .filter((f) => f.startsWith('test-plan-') && f.endsWith('.json'))
    .map<FileEntry>((f) => {
      const path = join(OUTPUT_DIR, f);
      return { name: f, path, mtime: statSync(path).mtimeMs };
    })
    .sort((a, b) => b.mtime - a.mtime);

  if (entries.length === 0) {
    throw new Error(`No test-plan-*.json files found in ${OUTPUT_DIR}`);
  }
  const latest = entries[0] as FileEntry;
  const timestamp = latest.name.replace(/^test-plan-/, '').replace(/\.json$/, '');
  return { path: latest.path, timestamp };
}

// ─── Workout-content parser ──────────────────────────────────────────────────

interface WorkoutInfo {
  code: string;
  name: string;
  zones?: string;
  duration?: string;
  mainSet?: string;
  example?: string;
}

function loadWorkouts(): Map<string, WorkoutInfo> {
  const md = readFileSync(KB_WORKOUTS, 'utf8');
  const headingRe = /^###\s+([BCDE]\/[A-Za-z0-9]+):\s*(.+?)\s*$/gm;
  const map = new Map<string, WorkoutInfo>();
  const matches: Array<{ code: string; name: string; start: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = headingRe.exec(md)) !== null) {
    matches.push({
      code: m[1] as string,
      name: (m[2] as string).replace(/\s*†\s*$/, ''),
      start: m.index,
    });
  }

  for (let i = 0; i < matches.length; i++) {
    const here = matches[i] as { code: string; name: string; start: number };
    const next = matches[i + 1];
    const block = md.slice(here.start, next ? next.start : md.length);

    map.set(here.code, {
      code: here.code,
      name: here.name,
      zones: extractField(block, 'Target zones'),
      duration: extractField(block, 'Typical duration'),
      mainSet: extractMainSet(block),
      example: extractField(block, 'Example \\(verbatim\\)'),
    });
  }
  return map;
}

function extractField(block: string, label: string): string | undefined {
  const re = new RegExp(
    `-\\s+\\*\\*${label}:\\*\\*\\s+([^\\n]+(?:\\n(?!\\s*-\\s+\\*\\*)[^\\n]*)*)`,
  );
  const m = block.match(re);
  if (!m || !m[1]) return undefined;
  return cleanText(m[1]);
}

function extractMainSet(block: string): string | undefined {
  const structIdx = block.indexOf('**Structure:**');
  if (structIdx < 0) return undefined;
  const sub = block.slice(structIdx);
  const re = /\s+-\s+Main set:\s+([\s\S]+?)(?:\n\s+-\s+\w|\n###|$)/;
  const m = sub.match(re);
  if (!m || !m[1]) return undefined;
  return cleanText(m[1]);
}

function cleanText(s: string): string {
  let out = s.replace(/\s+/g, ' ').trim();
  out = out.replace(/\s*`?\[NOTE\][\s\S]*$/i, '').trim();
  out = out.replace(/\s*`?\[FLAG\][\s\S]*$/i, '').trim();
  out = out.replace(/\s*\(pp?\.\s*\d+(?:[–-]\d+)?\)/g, '').trim();
  out = out.replace(/^"\s*/, '').replace(/\s*"$/, '').trim();
  return out;
}

// ─── Palette / labels / emoji ────────────────────────────────────────────────

const PHASE_COLORS: Record<string, string> = {
  prep: '#7B8B7E',
  base_1: '#7C946E',
  base_2: '#8FA67A',
  base_3: '#A4B58A',
  build_1: '#C68B5C',
  build_2: '#B26C3A',
  peak: '#A0432A',
  race_week: '#7E2418',
  transition: '#8A8580',
};

const PHASE_LABELS: Record<string, string> = {
  prep: 'Prep',
  base_1: 'Base 1',
  base_2: 'Base 2',
  base_3: 'Base 3',
  build_1: 'Build 1',
  build_2: 'Build 2',
  peak: 'Peak',
  race_week: 'Race week',
  transition: 'Transition',
};

const PHASE_EMOJI: Record<string, string> = {
  prep: '🌱',
  base_1: '🌿',
  base_2: '🌳',
  base_3: '🌲',
  build_1: '🏗️',
  build_2: '🚧',
  peak: '🔥',
  race_week: '🏆',
  transition: '🛌',
};

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type Day = (typeof DAY_ORDER)[number];

const DAY_SHORT: Record<Day, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

const DAY_INDEX: Record<Day, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
  sun: 6,
};

function phaseColor(p: string): string {
  return PHASE_COLORS[p] ?? '#8A8580';
}

function phaseLabel(p: string): string {
  return PHASE_LABELS[p] ?? p;
}

function phaseEmoji(p: string): string {
  return PHASE_EMOJI[p] ?? '•';
}

function isBrick(code: string): boolean {
  return code.startsWith('E/');
}

function disciplineEmoji(d: string, brick: boolean): string {
  if (brick) return '🔥';
  if (d === 'swim') return '🏊';
  if (d === 'bike') return '🚴';
  return '🏃';
}

function disciplineLabel(d: string, brick: boolean): string {
  if (brick) return 'Brick';
  return d.charAt(0).toUpperCase() + d.slice(1);
}

function disciplineClass(d: string, brick: boolean): string {
  if (brick) return 's-brick';
  if (d === 'swim') return 's-swim';
  if (d === 'bike') return 's-bike';
  return 's-run';
}

// ─── HTML helpers ────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

// Concise duration for the small calendar card. Capped hard so verbose KB
// "Typical duration" entries (which sometimes wander into prose) don't blow
// out the layout. Modal still shows the full text.
function durationShort(info?: WorkoutInfo): string {
  if (!info?.duration) return '';
  const head = info.duration.split('(')[0]?.split(';')[0]?.trim() ?? '';
  if (!head) return '';
  return head.length > 38 ? `${head.slice(0, 36).trim()}…` : head;
}

// Strict zone pill ("Z2", "Z4–5a"). Returns empty if the zone text doesn't
// reduce cleanly — caller hides the chip on the card; modal still shows the
// full zones description.
function zonesShort(info?: WorkoutInfo): string {
  if (!info?.zones) return '';
  const m = info.zones.match(
    /(?:pace|power|HR|heart\s*rate)?\s*zone[s]?\s+([0-9]+[a-z]?)(?:\s+to\s+([0-9]+[a-z]?))?/i,
  );
  if (m && m[1]) return m[2] ? `Z${m[1]}–${m[2]}` : `Z${m[1]}`;
  return '';
}

// Trim a long KB phrase to fit a modal fact tile (~2 lines). Cuts at the
// first ";" boundary if it appears within the budget; otherwise hard-caps.
function trimFact(s: string): string {
  const max = 90;
  const head = s.split(';')[0]?.trim() ?? '';
  if (head && head.length <= max) return head;
  return s.length > max ? `${s.slice(0, max - 1).trim()}…` : s;
}

// ─── Layout calcs ────────────────────────────────────────────────────────────

function isoToDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function addDaysIso(iso: string, days: number): string {
  const t = isoToDate(iso).getTime() + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

function formatDayDate(iso: string): string {
  const d = isoToDate(iso);
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function formatLong(iso: string): string {
  const d = isoToDate(iso);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

function phaseRibbon(weeks: MacroPlanWeek[]): Array<{ phase: string; count: number }> {
  const groups: Array<{ phase: string; count: number }> = [];
  for (const w of weeks) {
    const last = groups[groups.length - 1];
    if (last && last.phase === w.phase) last.count++;
    else groups.push({ phase: w.phase, count: 1 });
  }
  return groups;
}

interface PhasePosition {
  index: number;
  total: number;
}

function phasePositions(weeks: MacroPlanWeek[]): Map<number, PhasePosition> {
  const map = new Map<number, PhasePosition>();
  let i = 0;
  while (i < weeks.length) {
    const phase = (weeks[i] as MacroPlanWeek).phase;
    let j = i;
    while (j < weeks.length && (weeks[j] as MacroPlanWeek).phase === phase) j++;
    const total = j - i;
    for (let k = i; k < j; k++) {
      const w = weeks[k] as MacroPlanWeek;
      map.set(w.weekNumber, { index: k - i + 1, total });
    }
    i = j;
  }
  return map;
}

// ─── Rendering ───────────────────────────────────────────────────────────────

interface RenderInput {
  plan: MacroPlan;
  profile: AthleteProfile;
  workouts: Map<string, WorkoutInfo>;
}

function renderHtml(input: RenderInput): string {
  const { plan, profile, workouts } = input;
  const weeksAsc = [...plan.weeks].sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate));
  const positions = phasePositions(weeksAsc);
  const peakHours = Math.max(...weeksAsc.map((w) => w.weeklyVolumeHours));
  const ribbon = phaseRibbon(weeksAsc);

  // Build a flat list of (week, session, sessionId) so we can render all modals
  // at the bottom of the document and link cards to them via id.
  const modals: string[] = [];
  let sessionCounter = 0;
  const sessionIdMap = new Map<MacroPlan['weeks'][number]['keySessions'][number], string>();
  for (const w of weeksAsc) {
    for (const s of w.keySessions) {
      const id = `s${++sessionCounter}`;
      sessionIdMap.set(s, id);
      modals.push(renderModal(id, s, w, workouts));
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(`Full Ironman Plan — ${plan.raceDate}`)}</title>
<style>${CSS}</style>
</head>
<body>
<header class="page-header">
  <div class="head-row">
    <div class="title-block">
      <p class="kicker">🏊 🚴 🏃 &nbsp;Full Ironman Plan</p>
      <h1><span id="days-to-race" data-race="${escapeHtml(plan.raceDate)}">…</span></h1>
      <p class="subtitle">Race day · ${escapeHtml(formatLong(plan.raceDate))}</p>
    </div>
    <button class="print-btn" onclick="window.print()" aria-label="Print this plan">🖨️ Print</button>
  </div>
  <div class="quick-stats">
    <span class="stat">📅 ${weeksAsc.length} weeks</span>
    <span class="stat">⏱️ Peak ${peakHours} h/wk</span>
    <span class="stat">📍 Long days: ${profile.longSessionDays.map((d) => DAY_SHORT[d as Day] ?? d).join(' · ')}</span>
  </div>
  <div class="ribbon" aria-label="Phase progression">
    ${ribbon
      .map(
        (g) =>
          `<span class="rib" style="--c:${phaseColor(g.phase)}; flex:${g.count};">
            <span class="rib-emoji">${phaseEmoji(g.phase)}</span>
            <span class="rib-text">${escapeHtml(phaseLabel(g.phase))}</span>
            <span class="rib-w">${g.count}w</span>
          </span>`,
      )
      .join('')}
  </div>
</header>

<main class="page-main">
  ${weeksAsc.map((w) => renderWeekCalendar(w, profile, workouts, positions, sessionIdMap)).join('\n')}
</main>

<footer class="page-footer">Generated ${escapeHtml(plan.generatedAt.slice(0, 10))}</footer>

${modals.join('\n')}

<script>${JS_RUNTIME}</script>
</body>
</html>
`;
}

function renderWeekCalendar(
  w: MacroPlanWeek,
  profile: AthleteProfile,
  workouts: Map<string, WorkoutInfo>,
  positions: Map<number, PhasePosition>,
  sessionIdMap: Map<MacroPlanWeek['keySessions'][number], string>,
): string {
  const fill = phaseColor(w.phase);
  const emoji = phaseEmoji(w.phase);
  const pos = positions.get(w.weekNumber);
  const phasePosLabel = pos && pos.total > 1 ? ` · ${pos.index}/${pos.total}` : '';

  const cells = DAY_ORDER.map((day) => {
    const sessions = w.keySessions.filter((s) => s.dayOfWeek === day);
    const isLong = profile.longSessionDays.includes(day);
    const isRest = profile.mandatoryRestDays.includes(day);
    const dateIso = addDaysIso(w.weekStartDate, DAY_INDEX[day]);

    const cards =
      sessions.length === 0
        ? `<div class="rest-mark" aria-hidden="true">${isRest ? '🛌' : '·'}</div>`
        : sessions.map((s) => renderCard(s, workouts, sessionIdMap.get(s) ?? '')).join('');

    return `<div class="day-cell${isLong ? ' day-long' : ''}${isRest ? ' day-rest' : ''}${sessions.length === 0 ? ' is-empty' : ''}">
      <div class="day-header">
        <span class="day-short">${DAY_SHORT[day]}</span>
        <span class="day-num">${escapeHtml(formatDayDate(dateIso))}</span>
        ${isLong ? '<span class="day-tag" title="Long-session day">⭐</span>' : ''}
      </div>
      <div class="day-body">${cards}</div>
    </div>`;
  }).join('');

  return `<section class="week" id="week-${w.weekNumber}" style="--c:${fill};">
    <header class="week-head">
      <div class="week-id">
        <span class="week-emoji" aria-hidden="true">${emoji}</span>
        <span class="week-label"><span class="wn">Week ${w.weekNumber}</span><span class="wp">${escapeHtml(phaseLabel(w.phase))}${escapeHtml(phasePosLabel)}</span></span>
      </div>
      <div class="week-mid">
        <span class="week-dates">${escapeHtml(formatDayDate(w.weekStartDate))} – ${escapeHtml(formatDayDate(addDaysIso(w.weekStartDate, 6)))}</span>
        ${w.isRecoveryWeek ? '<span class="rr">😴 R&amp;R</span>' : ''}
      </div>
      <div class="week-vol"><b>${w.weeklyVolumeHours}</b><span>h</span></div>
    </header>
    <div class="cal-grid">${cells}</div>
  </section>`;
}

function renderCard(
  s: MacroPlanWeek['keySessions'][number],
  workouts: Map<string, WorkoutInfo>,
  modalId: string,
): string {
  const brick = isBrick(s.workoutCode);
  const cls = disciplineClass(s.discipline, brick);
  const info = workouts.get(s.workoutCode);
  const emoji = disciplineEmoji(s.discipline, brick);
  const name = info?.name ?? '(name not found)';
  const dShort = durationShort(info);
  const zShort = zonesShort(info);

  return `<button class="card ${cls}" type="button" data-modal="${escapeHtml(modalId)}" aria-label="Open details for ${escapeHtml(s.workoutCode)} ${escapeHtml(name)}">
    <div class="card-row1">
      <span class="card-emoji" aria-hidden="true">${emoji}</span>
      <span class="card-code">${escapeHtml(s.workoutCode)}</span>
      ${zShort ? `<span class="card-zone">${escapeHtml(zShort)}</span>` : ''}
    </div>
    <div class="card-name">${escapeHtml(name)}</div>
    ${dShort ? `<div class="card-dur">⏱️ ${escapeHtml(dShort)}</div>` : ''}
  </button>`;
}

function renderModal(
  id: string,
  s: MacroPlanWeek['keySessions'][number],
  w: MacroPlanWeek,
  workouts: Map<string, WorkoutInfo>,
): string {
  const brick = isBrick(s.workoutCode);
  const cls = disciplineClass(s.discipline, brick);
  const info = workouts.get(s.workoutCode);
  const emoji = disciplineEmoji(s.discipline, brick);
  const name = info?.name ?? '(name not found)';
  const dlabel = disciplineLabel(s.discipline, brick);
  const dateIso = addDaysIso(w.weekStartDate, DAY_INDEX[s.dayOfWeek as Day]);

  // Modal uses the full zone / duration text from the KB (not the shorter
  // card-chip version), trimmed lightly so the fact tile stays readable.
  const dFull = info?.duration ? trimFact(info.duration) : '';
  const zFull = info?.zones ? trimFact(info.zones) : '';

  return `<dialog id="${escapeHtml(id)}" class="modal ${cls}">
  <div class="modal-inner">
    <button class="modal-close" type="button" aria-label="Close">✕</button>
    <p class="modal-day">📅 ${escapeHtml(formatLong(dateIso))} · Week ${w.weekNumber}</p>
    <h2 class="modal-title">
      <span class="modal-emoji" aria-hidden="true">${emoji}</span>
      ${escapeHtml(s.workoutCode)} <span class="modal-sep">·</span> ${escapeHtml(name)}
    </h2>
    <p class="modal-kind">${escapeHtml(dlabel)}</p>

    <div class="modal-facts">
      ${dFull ? `<div class="mf"><span class="mf-emoji">⏱️</span><div><span class="mf-k">Duration</span><span class="mf-v">${escapeHtml(dFull)}</span></div></div>` : ''}
      ${zFull ? `<div class="mf"><span class="mf-emoji">⚡</span><div><span class="mf-k">Zone</span><span class="mf-v">${escapeHtml(zFull)}</span></div></div>` : ''}
      <div class="mf"><span class="mf-emoji">${phaseEmoji(w.phase)}</span><div><span class="mf-k">Phase</span><span class="mf-v">${escapeHtml(phaseLabel(w.phase))}</span></div></div>
    </div>

    ${
      info?.mainSet
        ? `<section class="modal-sec"><h3>📝 What to do</h3><p>${escapeHtml(info.mainSet)}</p></section>`
        : ''
    }
    ${
      info?.example
        ? `<section class="modal-sec"><h3>💡 Example</h3><p class="mono">${escapeHtml(info.example)}</p></section>`
        : ''
    }
    ${
      s.rationale
        ? `<section class="modal-sec"><h3>🤔 Why this workout</h3><p>${escapeHtml(s.rationale)}</p></section>`
        : ''
    }
  </div>
</dialog>`;
}

// ─── Inline CSS ──────────────────────────────────────────────────────────────

const CSS = `
/* Calendar + cards + modal. Direction B (warm cream) for surface tone, but
   the headline experience is the calendar grid and the click-to-expand modal. */

:root {
  --bg: #F4F1EA;
  --surface: #FFFFFF;
  --surface-2: #FBF8F0;
  --line: #E2DDD0;
  --line-2: #CFC8B6;
  --ink: #1A1B1F;
  --ink-2: #4A4C53;
  --ink-3: #767883;
  --accent: #6F4F1F;
  --warn: #A0432A;
  --r-radius: 10px;

  --c-swim: #4F7F8E;
  --c-bike: #B26C3A;
  --c-run: #6F8C5C;
  --c-brick: #7E5E2A;
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--bg); color: var(--ink); }
body {
  font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.mono { font-family: ui-monospace, SFMono-Regular, "SF Mono", Monaco, monospace; }

/* Header */
.page-header {
  background: linear-gradient(180deg, #FBF6EA 0%, var(--surface) 100%);
  border-bottom: 1px solid var(--line);
  padding: 26px 32px 20px;
}
.head-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
.kicker {
  margin: 0 0 6px; font-size: 12px; font-weight: 600;
  color: var(--ink-2); letter-spacing: 0.06em;
}
.title-block h1 {
  margin: 0 0 4px; font-size: clamp(34px, 4.5vw, 48px); font-weight: 700;
  letter-spacing: -0.02em;
  font-family: ui-serif, Georgia, "Iowan Old Style", "Times New Roman", serif;
  line-height: 1;
}
#days-to-race { color: var(--accent); }
.subtitle { margin: 6px 0 0; color: var(--ink-2); font-size: 14px; }

.print-btn {
  background: var(--surface); color: var(--ink-2);
  border: 1px solid var(--line-2); border-radius: 8px;
  padding: 8px 14px; font: 600 13px/1 inherit;
  cursor: pointer;
}
.print-btn:hover { background: var(--surface-2); color: var(--ink); }
.print-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.quick-stats { display: flex; gap: 14px; flex-wrap: wrap; margin-top: 14px; color: var(--ink-2); font-size: 13px; }
.stat { display: inline-flex; align-items: center; gap: 4px; }

.ribbon { display: flex; gap: 4px; margin-top: 14px; }
.rib {
  flex: 1; min-width: 0; padding: 8px 10px; border-radius: 6px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-top: 3px solid var(--c);
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; color: var(--ink); white-space: nowrap; overflow: hidden;
}
.rib-emoji { font-size: 16px; line-height: 1; }
.rib-text { font-weight: 600; }
.rib-w { color: var(--ink-3); margin-left: auto; font-variant-numeric: tabular-nums; }

/* Main */
.page-main { max-width: 1280px; margin: 0 auto; padding: 22px 24px 60px; display: flex; flex-direction: column; gap: 18px; }

/* Week */
.week {
  background: var(--surface);
  border: 1px solid var(--line);
  border-left: 4px solid var(--c);
  border-radius: var(--r-radius);
  padding: 14px 16px 16px;
  scroll-margin-top: 24px;
}
.week-head {
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  padding-bottom: 10px; margin-bottom: 12px; border-bottom: 1px solid var(--line);
}
.week-id { display: inline-flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.week-emoji { font-size: 24px; line-height: 1; }
.week-label { display: flex; flex-direction: column; }
.wn { font: 700 18px/1.1 ui-serif, Georgia, "Times New Roman", serif; color: var(--ink); }
.wp { font: 600 11px/1.2 inherit; color: var(--c); text-transform: uppercase; letter-spacing: 0.06em; }

.week-mid { display: flex; align-items: center; gap: 8px; color: var(--ink-2); font-size: 12px; }
.week-dates { font-variant-numeric: tabular-nums; }
.rr { background: var(--surface-2); border: 1px solid var(--line-2); padding: 3px 8px; border-radius: 999px; font: 600 11px/1 inherit; color: var(--ink); }

.week-vol { text-align: right; }
.week-vol b { font: 700 22px/1 ui-serif, Georgia, "Times New Roman", serif; color: var(--ink); font-variant-numeric: tabular-nums; }
.week-vol span { color: var(--ink-3); margin-left: 1px; font-size: 13px; }

/* Calendar grid */
.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 8px;
}
.day-cell {
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 8px;
  min-height: 130px;
  display: flex; flex-direction: column; gap: 6px;
}
.day-cell.day-long { background: linear-gradient(180deg, #F8F2E6 0%, var(--surface-2) 100%); border-color: rgba(229,163,65,0.32); }
.day-cell.day-rest { background: repeating-linear-gradient(135deg, var(--surface-2) 0 8px, var(--bg) 8px 12px); }
.day-cell.is-empty { background: transparent; border-style: dashed; border-color: var(--line); }
.day-cell.is-empty.day-long { background: rgba(229,163,65,0.06); border-style: dashed; }

.day-header { display: flex; align-items: baseline; gap: 4px; padding: 0 2px; }
.day-short { font: 700 11px/1 inherit; color: var(--ink); text-transform: uppercase; letter-spacing: 0.06em; }
.day-num { font-size: 11px; color: var(--ink-3); margin-left: auto; font-variant-numeric: tabular-nums; }
.day-tag { font-size: 11px; line-height: 1; }

.day-body { display: flex; flex-direction: column; gap: 5px; flex: 1; }
.rest-mark { color: var(--ink-3); font-size: 22px; text-align: center; align-self: center; margin-top: 18px; }

/* Card */
.card {
  background: var(--surface); border: 1px solid var(--line); border-left: 3px solid var(--line);
  border-radius: 6px; padding: 7px 8px 8px; cursor: pointer;
  display: flex; flex-direction: column; gap: 3px;
  text-align: left; font: inherit; color: inherit;
  transition: transform 100ms ease, box-shadow 120ms ease, border-color 120ms ease;
}
.card:hover { transform: translateY(-1px); box-shadow: 0 4px 14px rgba(0,0,0,0.06); border-color: currentColor; }
.card:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.card.s-swim  { border-left-color: var(--c-swim); color: var(--c-swim); }
.card.s-bike  { border-left-color: var(--c-bike); color: var(--c-bike); }
.card.s-run   { border-left-color: var(--c-run);  color: var(--c-run); }
.card.s-brick { border-left-color: var(--c-brick); color: var(--c-brick); }

.card-row1 { display: flex; align-items: center; gap: 6px; }
.card-emoji { font-size: 16px; line-height: 1; }
.card-code { font: 700 12px/1 ui-monospace, SFMono-Regular, monospace; color: var(--ink); }
.card-zone {
  margin-left: auto; font: 600 10px/1 ui-monospace, SFMono-Regular, monospace;
  background: rgba(111,79,31,0.08); color: var(--accent);
  padding: 2px 6px; border-radius: 999px;
}
.card-name {
  font: 500 12px/1.25 inherit; color: var(--ink);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.card-dur { font: 500 10.5px/1.2 inherit; color: var(--ink-3); }

/* Modal */
.modal {
  border: 0; padding: 0;
  border-radius: 14px;
  width: min(620px, calc(100vw - 32px));
  max-height: calc(100vh - 60px);
  background: var(--surface);
  color: var(--ink);
  box-shadow: 0 20px 60px rgba(0,0,0,0.32);
  overflow: visible;
}
.modal::backdrop { background: rgba(20,18,14,0.55); backdrop-filter: blur(2px); }
.modal-inner { max-height: calc(100vh - 100px); overflow-y: auto; padding: 28px 32px 28px; }

.modal-close {
  position: absolute; top: 14px; right: 14px;
  width: 36px; height: 36px; border-radius: 999px;
  background: var(--surface-2); border: 1px solid var(--line);
  font-size: 16px; line-height: 1; cursor: pointer; color: var(--ink-2);
}
.modal-close:hover { background: var(--bg); color: var(--ink); }

.modal-day { margin: 0 0 4px; font-size: 13px; color: var(--ink-2); font-weight: 600; }
.modal-title {
  margin: 0; font: 700 28px/1.15 ui-serif, Georgia, "Times New Roman", serif;
  letter-spacing: -0.01em;
}
.modal-emoji { font-size: 32px; margin-right: 6px; }
.modal-sep { color: var(--ink-3); margin: 0 4px; }
.modal-kind {
  margin: 6px 0 0; font: 600 11px/1 inherit; color: var(--ink-3);
  text-transform: uppercase; letter-spacing: 0.08em;
}

.modal-facts {
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px;
  margin: 18px 0 6px;
}
.mf {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px; background: var(--surface-2); border: 1px solid var(--line);
  border-radius: 8px;
}
.mf-emoji { font-size: 22px; line-height: 1; }
.mf > div { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.mf-k { font: 600 10px/1 inherit; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.06em; }
.mf-v { font: 600 13px/1.2 inherit; color: var(--ink); }

.modal .s-swim ~ * { /* placeholder */ }
.modal.s-swim  .modal-emoji { filter: none; }

.modal-sec { margin-top: 16px; }
.modal-sec h3 {
  margin: 0 0 6px; font: 600 13px/1.2 inherit; color: var(--ink-2);
  letter-spacing: 0.02em;
}
.modal-sec p {
  margin: 0; padding: 12px 14px;
  background: var(--surface-2); border-left: 3px solid var(--line-2);
  border-radius: 4px;
  font-size: 14px; line-height: 1.55; color: var(--ink);
}
.modal-sec p.mono {
  font: 500 13px/1.5 ui-monospace, SFMono-Regular, monospace;
  color: var(--ink);
}

.page-footer { padding: 18px 32px 32px; color: var(--ink-3); font-size: 11px; text-align: center; }

/* Responsive */
@media (max-width: 1100px) {
  .cal-grid { grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 6px; }
  .day-cell { padding: 6px; min-height: 110px; }
  .card-name { -webkit-line-clamp: 3; }
}
@media (max-width: 780px) {
  .page-header { padding: 18px 16px; }
  .page-main { padding: 14px 12px 28px; gap: 14px; }
  .week { padding: 10px 10px 12px; }
  .week-head { gap: 8px; }
  .week-mid { display: none; }
  .cal-grid { grid-template-columns: 1fr; gap: 6px; }
  .day-cell { min-height: 0; }
  .day-cell.is-empty { display: none; }
  .modal-facts { grid-template-columns: 1fr; }
  .modal-inner { padding: 22px 18px 22px; }
}

/* Print */
@media print {
  body { background: #fff; }
  .page-header { padding: 12px 18px; }
  .print-btn { display: none; }
  .modal { display: none !important; }
  .page-main { padding: 10px 14px; max-width: none; gap: 8px; }
  .week { break-inside: avoid; page-break-inside: avoid; box-shadow: none; }
  .card { break-inside: avoid; page-break-inside: avoid; }
  .day-cell, .card, .ribbon, .rib { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
`;

// ─── Inline JS ───────────────────────────────────────────────────────────────

const JS_RUNTIME = `
(function () {
  // Days-to-race
  var el = document.getElementById('days-to-race');
  if (el) {
    var raceIso = el.getAttribute('data-race');
    if (raceIso) {
      var race = new Date(raceIso + 'T00:00:00Z');
      var now = new Date();
      var nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      var days = Math.round((race.getTime() - nowUtc) / 86400000);
      if (days > 0) el.textContent = days + ' days to race';
      else if (days === 0) el.textContent = 'Race day!';
      else el.textContent = (-days) + ' days since race';
    }
  }

  // Card → open modal
  document.querySelectorAll('.card[data-modal]').forEach(function (c) {
    c.addEventListener('click', function () {
      var id = c.getAttribute('data-modal');
      if (!id) return;
      var dlg = document.getElementById(id);
      if (dlg && typeof dlg.showModal === 'function') dlg.showModal();
    });
  });

  // Close button + click-on-backdrop close
  document.querySelectorAll('dialog.modal').forEach(function (dlg) {
    var btn = dlg.querySelector('.modal-close');
    if (btn) btn.addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('click', function (e) {
      // Click on the backdrop (the dialog itself, outside the inner content) closes it.
      var rect = dlg.getBoundingClientRect();
      var inX = e.clientX >= rect.left && e.clientX <= rect.right;
      var inY = e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!inX || !inY) dlg.close();
    });
  });
})();
`;

// ─── Main ────────────────────────────────────────────────────────────────────

function main(): void {
  const { path: planPath, timestamp } = locateLatestPlan();
  console.log(`Reading plan: ${planPath}`);
  const plan = JSON.parse(readFileSync(planPath, 'utf8')) as MacroPlan;
  const profile = JSON.parse(readFileSync(PROFILE_PATH, 'utf8')) as AthleteProfile;
  const workouts = loadWorkouts();
  console.log(`Loaded ${workouts.size} workouts (with details parsed)`);

  const html = renderHtml({ plan, profile, workouts });
  const outPath = join(OUTPUT_DIR, `plan-${timestamp}.html`);
  writeFileSync(outPath, html);
  console.log(`Wrote: ${outPath}`);
  console.log(`Size: ${(html.length / 1024).toFixed(1)} KB`);
}

main();
