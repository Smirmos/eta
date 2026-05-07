/* eslint-disable no-console */
// Renders the most recent macro plan JSON in scripts/output/ to a single
// self-contained HTML file. Throwaway tooling — not a product feature.
//
// Direction B (editorial / atmospheric): warm cream surface, ink text,
// muted earth-toned phase palette. Each session is a row showing the
// workout's actual content extracted from knowledge-base/03-workouts.md
// (target zones, typical duration, main set, example) — not just the
// LLM's commentary.
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
  // Within "**Structure:**" subtree, find "  - Main set:" and capture until next sibling bullet.
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
  // Cut at any KB editorial note or flag — these are auditor-facing, not athlete-facing.
  out = out.replace(/\s*`?\[NOTE\][\s\S]*$/i, '').trim();
  out = out.replace(/\s*`?\[FLAG\][\s\S]*$/i, '').trim();
  // Strip "(p. NNN)" or "(pp. NNN-NNN)" wherever they appear (KB inline page refs).
  out = out.replace(/\s*\(pp?\.\s*\d+(?:[–-]\d+)?\)/g, '').trim();
  // Now that citations are gone, strip stray surrounding quotes (KB wraps prose in quotes).
  out = out.replace(/^"\s*/, '').replace(/\s*"$/, '').trim();
  return out;
}

// ─── Palette and labels (Direction B — editorial / atmospheric) ─────────────

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

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type Day = (typeof DAY_ORDER)[number];

const DAY_FULL: Record<Day, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
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

// ─── HTML helpers ────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function isBrick(code: string): boolean {
  return code.startsWith('E/');
}

function disciplineGlyph(d: string, brick: boolean): string {
  if (brick) return '🚴‍♂️·🏃‍♂️'; // composite (we won't render emoji — see disciplineLabel below)
  if (d === 'swim') return 'swim';
  if (d === 'bike') return 'bike';
  return 'run';
}

// Single-letter discipline mark in the day badge (no emojis — keep tone editorial).
function disciplineMark(d: string, brick: boolean): string {
  if (brick) return 'B'; // brick
  if (d === 'swim') return 'S';
  if (d === 'bike') return 'C'; // cycling — avoid clash with B for brick
  return 'R';
}

function disciplineClass(d: string, brick: boolean): string {
  if (brick) return 's-brick';
  if (d === 'swim') return 's-swim';
  if (d === 'bike') return 's-bike';
  return 's-run';
}

// ─── Layout calcs ────────────────────────────────────────────────────────────

function isoToDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function addDaysIso(iso: string, days: number): string {
  const t = isoToDate(iso).getTime() + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

function formatRange(startIso: string): string {
  const a = isoToDate(startIso);
  const b = isoToDate(addDaysIso(startIso, 6));
  const fmt = (d: Date): string =>
    d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `${fmt(a)} – ${fmt(b)}`;
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
  const maxHours = Math.max(...weeksAsc.map((w) => w.weeklyVolumeHours), 1);
  const totalHours = weeksAsc.reduce((acc, w) => acc + w.weeklyVolumeHours, 0);
  const peakHours = Math.max(...weeksAsc.map((w) => w.weeklyVolumeHours));
  const ribbon = phaseRibbon(weeksAsc);

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
  <div class="title-row">
    <div>
      <h1>Full Ironman Plan</h1>
      <p class="meta">
        Race ${escapeHtml(plan.raceDate)}
        · <span id="days-to-race" data-race="${escapeHtml(plan.raceDate)}">…</span>
        · ${weeksAsc.length} weeks · ${peakHours}h peak · ${totalHours.toFixed(1)}h total
      </p>
    </div>
    <button class="print-btn" onclick="window.print()" aria-label="Print this plan">Print</button>
  </div>
  <div class="phase-overview" aria-label="Plan overview">
    <div class="bands">
      ${weeksAsc
        .map((w) => {
          const pct = (w.weeklyVolumeHours / maxHours) * 100;
          return `<button class="band${w.isRecoveryWeek ? ' is-recovery' : ''}${w.phase === 'race_week' ? ' is-race' : ''}" type="button" data-week="${w.weekNumber}"
            aria-label="Week ${w.weekNumber}, ${escapeHtml(phaseLabel(w.phase))}, ${w.weeklyVolumeHours} hours"
            style="--c:${phaseColor(w.phase)}; --h:${pct.toFixed(2)}%;">
            <span class="bar"></span>
            <span class="bw">${w.weekNumber}</span>
          </button>`;
        })
        .join('')}
    </div>
    <div class="ribbon">
      ${ribbon
        .map(
          (g) =>
            `<span class="rib" style="--c:${phaseColor(g.phase)}; flex:${g.count};">
              <span class="rib-dot"></span>${escapeHtml(phaseLabel(g.phase))} <span class="rib-w">${g.count}w</span>
            </span>`,
        )
        .join('')}
    </div>
  </div>
</header>

<main class="page-main">
  ${weeksAsc.map((w) => renderWeek(w, profile, workouts, positions)).join('\n')}
</main>

<footer class="page-footer">Generated ${escapeHtml(plan.generatedAt.slice(0, 10))}</footer>

<script>${JS_RUNTIME}</script>
</body>
</html>
`;
}

function renderWeek(
  w: MacroPlanWeek,
  profile: AthleteProfile,
  workouts: Map<string, WorkoutInfo>,
  positions: Map<number, PhasePosition>,
): string {
  const fill = phaseColor(w.phase);
  const pos = positions.get(w.weekNumber);
  const phasePosLabel = pos && pos.total > 1 ? ` · wk ${pos.index} of ${pos.total}` : '';
  const sortedSessions = [...w.keySessions].sort(
    (a, b) =>
      DAY_INDEX[a.dayOfWeek as Day] - DAY_INDEX[b.dayOfWeek as Day] ||
      a.workoutCode.localeCompare(b.workoutCode),
  );

  const sessions = sortedSessions.map((s) => renderSession(s, workouts, profile)).join('');

  const hasNotes = Boolean(w.notes);
  const hasDeviations = (w.deviations ?? []).length > 0;

  return `<article class="week" id="week-${w.weekNumber}" style="--c:${fill};">
    <header class="week-head">
      <div class="week-id">
        <span class="wn">Week ${w.weekNumber}</span>
        <span class="wd">${escapeHtml(formatRange(w.weekStartDate))}</span>
      </div>
      <div class="week-tags">
        <span class="phase-tag">${escapeHtml(phaseLabel(w.phase))}${escapeHtml(phasePosLabel)}</span>
        ${w.isRecoveryWeek ? '<span class="rr">R&amp;R</span>' : ''}
      </div>
      <div class="vol"><b>${w.weeklyVolumeHours}</b><span>h</span></div>
    </header>

    <ol class="sessions">${sessions || '<li class="empty">No key sessions.</li>'}</ol>

    ${
      hasNotes || hasDeviations
        ? `<details class="week-extras"><summary>Coach's notes${hasDeviations ? ` · ${(w.deviations ?? []).length} deviation${(w.deviations ?? []).length === 1 ? '' : 's'}` : ''}</summary>
          ${w.notes ? `<p class="note">${escapeHtml(w.notes)}</p>` : ''}
          ${
            hasDeviations
              ? `<ul class="dev">${(w.deviations ?? []).map((d) => `<li>${escapeHtml(d)}</li>`).join('')}</ul>`
              : ''
          }
        </details>`
        : ''
    }
  </article>`;
}

function renderSession(
  s: MacroPlanWeek['keySessions'][number],
  workouts: Map<string, WorkoutInfo>,
  profile: AthleteProfile,
): string {
  const brick = isBrick(s.workoutCode);
  const cls = disciplineClass(s.discipline, brick);
  const info = workouts.get(s.workoutCode);
  const isLong = profile.longSessionDays.includes(s.dayOfWeek);
  const day = s.dayOfWeek as Day;

  const name = info?.name ?? '(name not found)';
  const zones = info?.zones;
  const duration = info?.duration;
  const main = info?.mainSet;
  const example = info?.example;
  const dlabel = brick ? 'Brick' : s.discipline.charAt(0).toUpperCase() + s.discipline.slice(1);

  return `<li class="sess ${cls}${isLong ? ' is-long' : ''}">
    <div class="sess-day">
      <div class="day-name">${escapeHtml(DAY_FULL[day] ?? day)}</div>
      <div class="day-tag">${escapeHtml(disciplineMark(s.discipline, brick))}</div>
      ${isLong ? '<div class="day-long" title="Long-session day">Long</div>' : ''}
    </div>

    <div class="sess-body">
      <div class="sess-head">
        <span class="code">${escapeHtml(s.workoutCode)}</span>
        <span class="name">${escapeHtml(name)}</span>
        <span class="kind">${escapeHtml(dlabel)}</span>
      </div>

      ${
        zones || duration
          ? `<div class="facts">
            ${duration ? `<span><b>Duration</b> ${escapeHtml(duration)}</span>` : ''}
            ${zones ? `<span><b>Zone</b> ${escapeHtml(zones)}</span>` : ''}
          </div>`
          : ''
      }

      ${main ? `<p class="main"><b>Workout.</b> ${escapeHtml(main)}</p>` : ''}
      ${example ? `<p class="ex"><b>Example.</b> ${escapeHtml(example)}</p>` : ''}
      ${s.rationale ? `<p class="why">${escapeHtml(s.rationale)}</p>` : ''}
    </div>
  </li>`;
}

// ─── Inline CSS (Direction B — editorial / atmospheric) ──────────────────────

const CSS = `
/* Direction B — editorial / atmospheric.
   Warm cream surface, ink text, muted earth-tone phase palette.
   Designed for reading dense content carefully. Print → clean B&W. */

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
  --r-radius: 8px;
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--bg); color: var(--ink); }
body {
  font: 15px/1.55 ui-serif, Georgia, "Iowan Old Style", "Apple Garamond", "Palatino Linotype", "Times New Roman", serif;
  -webkit-font-smoothing: antialiased;
}
.mono, code { font: 600 13px/1.4 ui-monospace, SFMono-Regular, "SF Mono", Monaco, "Cascadia Mono", monospace; color: var(--ink); }

/* Header */
.page-header {
  background: var(--surface);
  border-bottom: 1px solid var(--line);
  padding: 26px 40px 18px;
}
.title-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; }
.title-row h1 {
  margin: 0 0 4px; font-size: 30px; font-weight: 600;
  letter-spacing: -0.01em; color: var(--ink);
  font-family: ui-serif, Georgia, "Iowan Old Style", "Times New Roman", serif;
}
.meta { margin: 0; color: var(--ink-2); font-size: 14px; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
#days-to-race { color: var(--accent); font-weight: 600; }

.print-btn {
  background: transparent; color: var(--ink-2);
  border: 1px solid var(--line-2); border-radius: 6px;
  padding: 7px 14px; font: 600 13px/1 ui-sans-serif, system-ui, sans-serif;
  cursor: pointer;
}
.print-btn:hover { background: var(--surface-2); color: var(--ink); }
.print-btn:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

/* Phase overview */
.phase-overview { margin-top: 14px; display: flex; flex-direction: column; gap: 6px; }
.bands {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(28px, 1fr));
  gap: 4px;
  align-items: end;
  height: 78px;
}
.band {
  background: transparent; border: 0; padding: 0; cursor: pointer;
  display: flex; flex-direction: column; align-items: stretch; justify-content: flex-end;
  height: 100%;
}
.band .bar {
  display: block; height: var(--h); background: var(--c); border-radius: 2px;
  transition: filter 100ms ease;
}
.band .bw {
  font: 500 10px/1 ui-sans-serif, system-ui, sans-serif;
  color: var(--ink-3); text-align: center; margin-top: 4px;
  font-variant-numeric: tabular-nums;
}
.band:hover .bar { filter: brightness(1.08); }
.band.is-recovery .bar {
  background-image: repeating-linear-gradient(45deg, rgba(255,255,255,0.0) 0 4px, rgba(255,255,255,0.55) 4px 8px);
  background-color: var(--c);
}
.band.is-race .bar { box-shadow: 0 0 0 1.5px var(--ink) inset; }
.band:focus-visible .bar { outline: 2px solid var(--accent); outline-offset: 2px; }

.ribbon { display: flex; gap: 3px; }
.rib {
  flex: 1; min-width: 0; padding: 5px 8px; border-radius: 3px;
  background: var(--surface-2);
  border-top: 2px solid var(--c);
  font: 500 11px/1.3 ui-sans-serif, system-ui, sans-serif;
  color: var(--ink-2);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.rib-w { color: var(--ink-3); }

/* Main */
.page-main { max-width: 920px; margin: 0 auto; padding: 28px 40px 64px; display: flex; flex-direction: column; gap: 20px; }

/* Week */
.week {
  background: var(--surface);
  border: 1px solid var(--line);
  border-left: 4px solid var(--c);
  border-radius: var(--r-radius);
  padding: 18px 22px 16px;
  scroll-margin-top: 24px;
}

.week-head {
  display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap;
  padding-bottom: 10px; margin-bottom: 14px; border-bottom: 1px solid var(--line);
}
.week-id { display: flex; align-items: baseline; gap: 14px; flex: 1; min-width: 0; }
.wn { font: 600 18px/1.2 ui-serif, Georgia, "Times New Roman", serif; color: var(--ink); letter-spacing: -0.005em; }
.wd { font: 400 13px/1 ui-sans-serif, system-ui, sans-serif; color: var(--ink-3); }

.week-tags { display: flex; gap: 6px; align-items: center; }
.phase-tag {
  font: 500 11px/1.4 ui-sans-serif, system-ui, sans-serif; color: var(--c);
  border: 1px solid var(--c); padding: 2px 8px; border-radius: 999px;
  text-transform: uppercase; letter-spacing: 0.04em;
  background: color-mix(in srgb, var(--c) 7%, transparent);
}
.rr {
  font: 500 11px/1.4 ui-sans-serif, system-ui, sans-serif; color: var(--ink-2);
  border: 1px solid var(--line-2); padding: 2px 8px; border-radius: 999px;
  text-transform: uppercase; letter-spacing: 0.04em;
}

.vol b {
  font: 600 22px/1 ui-serif, Georgia, "Times New Roman", serif;
  color: var(--ink); font-variant-numeric: tabular-nums;
}
.vol span { color: var(--ink-3); margin-left: 2px; font-size: 13px; }

/* Sessions */
.sessions { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
.sess {
  display: grid;
  grid-template-columns: 96px 1fr;
  gap: 14px;
  padding: 12px 14px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-left: 3px solid var(--line);
  border-radius: 6px;
}
.sess.s-swim  { border-left-color: #4F7F8E; }
.sess.s-bike  { border-left-color: #B26C3A; }
.sess.s-run   { border-left-color: #6F8C5C; }
.sess.s-brick { border-left-color: #7E5E2A; }
.sess.is-long { background: #F8F2E6; }

.sess-day { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.day-name { font: 600 12px/1.2 ui-sans-serif, system-ui, sans-serif; color: var(--ink); text-transform: uppercase; letter-spacing: 0.06em; }
.day-tag {
  display: inline-flex; width: 22px; height: 22px; border-radius: 4px;
  align-items: center; justify-content: center;
  font: 700 11px/1 ui-monospace, SFMono-Regular, monospace;
  color: var(--ink); background: var(--surface);
  border: 1px solid var(--line-2);
}
.s-swim  .day-tag { color: #4F7F8E; border-color: rgba(79,127,142,0.45); }
.s-bike  .day-tag { color: #B26C3A; border-color: rgba(178,108,58,0.45); }
.s-run   .day-tag { color: #6F8C5C; border-color: rgba(111,140,92,0.45); }
.s-brick .day-tag { color: #7E5E2A; border-color: rgba(126,94,42,0.45); }
.day-long {
  font: 600 9px/1 ui-sans-serif, system-ui, sans-serif;
  color: var(--accent); text-transform: uppercase; letter-spacing: 0.08em;
  margin-top: 2px;
}

.sess-body { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.sess-head { display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap; }
.sess-head .code {
  font: 700 13px/1 ui-monospace, SFMono-Regular, monospace;
  color: var(--ink);
}
.sess-head .name {
  font: 600 14px/1.25 ui-serif, Georgia, "Times New Roman", serif;
  color: var(--ink);
}
.sess-head .kind {
  font: 500 10px/1.3 ui-sans-serif, system-ui, sans-serif;
  color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.06em;
  margin-left: auto;
}

.facts {
  display: flex; gap: 18px; flex-wrap: wrap;
  font: 400 12px/1.3 ui-sans-serif, system-ui, sans-serif;
  color: var(--ink-2);
}
.facts b {
  font-weight: 600; color: var(--ink-3);
  text-transform: uppercase; letter-spacing: 0.06em; font-size: 10px;
  margin-right: 4px;
}

.sess-body p { margin: 0; line-height: 1.5; }
.sess-body p.main { font-size: 14px; color: var(--ink); }
.sess-body p.main b { color: var(--ink-3); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; margin-right: 6px; }
.sess-body p.ex { font: 400 12.5px/1.5 ui-monospace, SFMono-Regular, monospace; color: var(--ink-2); }
.sess-body p.ex b { font: 600 10px/1 ui-sans-serif, system-ui, sans-serif; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.06em; margin-right: 6px; }
.sess-body p.why {
  font: italic 400 12.5px/1.5 ui-serif, Georgia, "Times New Roman", serif;
  color: var(--ink-2);
  border-top: 1px dashed var(--line);
  padding-top: 6px;
  margin-top: 2px;
}

.empty { padding: 12px; color: var(--ink-3); font-style: italic; text-align: center; }

/* Coach's notes (collapsed by default) */
.week-extras { margin-top: 12px; }
.week-extras summary {
  cursor: pointer; font: 500 12px/1.4 ui-sans-serif, system-ui, sans-serif;
  color: var(--ink-2); padding: 6px 0;
}
.week-extras summary:hover { color: var(--ink); }
.week-extras p.note { margin: 6px 0; font-size: 13.5px; line-height: 1.55; color: var(--ink-2); }
.week-extras ul.dev { margin: 6px 0; padding-left: 18px; font-size: 12.5px; color: var(--ink-2); }
.week-extras ul.dev li { margin: 4px 0; line-height: 1.45; }

.page-footer { padding: 16px 40px 32px; color: var(--ink-3); font-size: 11px; text-align: center; font-family: ui-sans-serif, system-ui, sans-serif; }

/* Responsive */
@media (max-width: 780px) {
  .page-header { padding: 20px 18px 14px; }
  .page-main { padding: 18px 18px 32px; gap: 14px; }
  .sess { grid-template-columns: 70px 1fr; padding: 10px 12px; }
  .day-name { font-size: 11px; }
  .week-head { flex-direction: column; align-items: flex-start; gap: 8px; }
  .vol { align-self: flex-end; }
}

/* Print */
@media print {
  body { background: #fff; }
  .page-header { padding: 12px 20px; border-bottom-color: #ccc; }
  .print-btn { display: none; }
  .phase-overview .bands { height: 50px; }
  .page-main { padding: 14px 20px; max-width: none; gap: 12px; }
  .week { break-inside: avoid; page-break-inside: avoid; box-shadow: none; }
  .sess { break-inside: avoid; page-break-inside: avoid; }
  .week-extras[open] summary, .week-extras p.note, .week-extras ul.dev { color: #444; }
  .band .bar, .phase-tag, .sess { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
`;

// ─── Inline JS ───────────────────────────────────────────────────────────────

const JS_RUNTIME = `
(function () {
  var el = document.getElementById('days-to-race');
  if (el) {
    var raceIso = el.getAttribute('data-race');
    if (raceIso) {
      var race = new Date(raceIso + 'T00:00:00Z');
      var now = new Date();
      var nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      var days = Math.round((race.getTime() - nowUtc) / 86400000);
      if (days > 0) el.textContent = days + ' days to race';
      else if (days === 0) el.textContent = 'race day';
      else el.textContent = (-days) + ' days since race';
    }
  }
  document.querySelectorAll('.band').forEach(function (b) {
    b.addEventListener('click', function () {
      var n = b.getAttribute('data-week');
      if (!n) return;
      var t = document.getElementById('week-' + n);
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  // Sanity: spot-check that one of the codes used in the plan has details parsed.
  const sample = plan.weeks
    .flatMap((w) => w.keySessions)
    .map((s) => s.workoutCode)
    .find((c) => workouts.has(c));
  if (sample) {
    const info = workouts.get(sample);
    console.log(
      `Sample (${sample}): zones="${info?.zones ?? '∅'}" duration="${info?.duration ?? '∅'}" main=${(info?.mainSet ?? '').length}c`,
    );
  }
  // Reference disciplineGlyph so it's not flagged unused while we keep it for future use.
  void disciplineGlyph;

  const html = renderHtml({ plan, profile, workouts });
  const outPath = join(OUTPUT_DIR, `plan-${timestamp}.html`);
  writeFileSync(outPath, html);
  console.log(`Wrote: ${outPath}`);
  console.log(`Size: ${(html.length / 1024).toFixed(1)} KB`);
}

main();
