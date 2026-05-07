/* eslint-disable no-console */
// Renders the most recent macro plan JSON in scripts/output/ to a single
// self-contained HTML file. Throwaway tooling — not a product feature.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
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

// ─── Load workout-code → readable name from KB ───────────────────────────────

function loadCodeNames(): Map<string, string> {
  const md = readFileSync(KB_WORKOUTS, 'utf8');
  const map = new Map<string, string>();
  const re = /^###\s+([BCDE]\/[A-Za-z0-9]+):\s*(.+?)\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(md)) !== null) {
    const code = m[1] as string;
    const name = (m[2] as string).replace(/\s*†\s*$/, '');
    map.set(code, name);
  }
  return map;
}

// ─── Audit parsing (best-effort) ─────────────────────────────────────────────

interface AuditFindings {
  byWeek: Map<number, string[]>;
  verdict?: string;
}

function tryLoadAudit(timestamp: string): AuditFindings {
  const path = join(OUTPUT_DIR, `test-plan-${timestamp}-audit.md`);
  const empty: AuditFindings = { byWeek: new Map() };
  if (!existsSync(path)) return empty;

  try {
    const md = readFileSync(path, 'utf8');
    const byWeek = new Map<number, string[]>();
    const verdictMatch = md.match(/##\s*Verdict\s*\n+\*\*?(PASS[^*\n]*|FAIL[^*\n]*)\*?\*?/i);
    const verdict = verdictMatch ? (verdictMatch[1] as string).trim() : undefined;

    // Parse the Significant + Minor sections; collect lines that mention "wk N" or "Week N".
    const sectionRe = /##\s*(Significant|Minor)\s+issues\s*\n([\s\S]*?)(?=\n##\s|$)/gi;
    let s: RegExpExecArray | null;
    while ((s = sectionRe.exec(md)) !== null) {
      const body = s[2] as string;
      const itemRe = /^\d+\.\s+(.+?)(?=^\d+\.\s|\n## |$)/gms;
      let it: RegExpExecArray | null;
      while ((it = itemRe.exec(body)) !== null) {
        const text = (it[1] as string).replace(/\n+\s*/g, ' ').trim();
        const weekRe = /(?:[Ww]eek|wk|Wk)\s*(\d+)/g;
        const matched = new Set<number>();
        let w: RegExpExecArray | null;
        while ((w = weekRe.exec(text)) !== null) {
          const n = Number(w[1]);
          if (!Number.isFinite(n)) continue;
          matched.add(n);
        }
        for (const n of matched) {
          const list = byWeek.get(n) ?? [];
          list.push(text.length > 280 ? `${text.slice(0, 280)}…` : text);
          byWeek.set(n, list);
        }
      }
    }

    return { byWeek, verdict };
  } catch {
    return empty;
  }
}

// ─── Palette and labels (Direction A — instrument panel) ─────────────────────

const PHASE_COLORS: Record<string, string> = {
  prep: '#4D7CC7',
  base_1: '#5188CC',
  base_2: '#6B9BD1',
  base_3: '#8FBBE3',
  build_1: '#C68B3C',
  build_2: '#E5A341',
  peak: '#E5524C',
  race_week: '#B91C1C',
  transition: '#6E7681',
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

const DAY_LABEL: Record<Day, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

function phaseColor(p: string): string {
  return PHASE_COLORS[p] ?? '#6E7681';
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

function disciplineIcon(d: string, brick: boolean): string {
  // Plain SVGs — currentColor inherits from CSS pill text color.
  if (brick) {
    return `<svg class="icon" viewBox="0 0 24 16" width="22" height="14" aria-hidden="true">
  <circle cx="3.5" cy="11" r="2.3" stroke="currentColor" fill="none" stroke-width="1.3"/>
  <circle cx="10.5" cy="11" r="2.3" stroke="currentColor" fill="none" stroke-width="1.3"/>
  <path d="M3.5 11 L7 6 L 10.5 11 M7 6 L 8 4" stroke="currentColor" fill="none" stroke-width="1.3" stroke-linecap="round"/>
  <circle cx="17" cy="3.6" r="1.3" fill="currentColor"/>
  <path d="M17 5.5 L 15.4 9 L 14 12 M 17 5.5 L 19 8 L 20 11 M 17 5.5 L 15.4 9 L 17 13" stroke="currentColor" fill="none" stroke-width="1.3" stroke-linecap="round"/>
</svg>`;
  }
  if (d === 'swim') {
    return `<svg class="icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
  <path d="M2 5 Q4 3.4, 6 5 T 10 5 T 14 5" stroke="currentColor" fill="none" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M2 9 Q4 7.4, 6 9 T 10 9 T 14 9" stroke="currentColor" fill="none" stroke-width="1.4" stroke-linecap="round"/>
  <path d="M2 13 Q4 11.4, 6 13 T 10 13 T 14 13" stroke="currentColor" fill="none" stroke-width="1.4" stroke-linecap="round"/>
</svg>`;
  }
  if (d === 'bike') {
    return `<svg class="icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
  <circle cx="3.5" cy="11" r="2.5" stroke="currentColor" fill="none" stroke-width="1.4"/>
  <circle cx="12.5" cy="11" r="2.5" stroke="currentColor" fill="none" stroke-width="1.4"/>
  <path d="M3.5 11 L8 6 L 12.5 11 M8 6 L 9 4 M 6 11 L 8 6" stroke="currentColor" fill="none" stroke-width="1.4" stroke-linecap="round"/>
</svg>`;
  }
  // run
  return `<svg class="icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
  <circle cx="9" cy="3" r="1.5" fill="currentColor"/>
  <path d="M9 5 L 7 9 L 5 12 M 9 5 L 12 8 L 13 11 M 9 5 L 7 9 L 9 13" stroke="currentColor" fill="none" stroke-width="1.4" stroke-linecap="round"/>
</svg>`;
}

function disciplineClass(d: string, brick: boolean): string {
  if (brick) return 'pill-brick';
  if (d === 'swim') return 'pill-swim';
  if (d === 'bike') return 'pill-bike';
  return 'pill-run';
}

function disciplineLabel(d: string, brick: boolean): string {
  if (brick) return 'Brick';
  return d.charAt(0).toUpperCase() + d.slice(1);
}

// ─── Layout calcs ────────────────────────────────────────────────────────────

function isoToDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function addDaysIso(iso: string, days: number): string {
  const t = isoToDate(iso).getTime() + days * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

function formatDate(iso: string): string {
  // "Mon 11 May" — UTC to avoid TZ drift on date-only values.
  const d = isoToDate(iso);
  const month = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  const day = d.toLocaleDateString('en-US', { day: '2-digit', timeZone: 'UTC' });
  const wk = d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  return `${wk} ${day} ${month}`;
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
  // For each week, "n of m" within its contiguous phase run.
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
  codeNames: Map<string, string>;
  audit: AuditFindings;
}

function renderHtml(input: RenderInput): string {
  const { plan, profile, codeNames, audit } = input;
  const weeks = [...plan.weeks].sort((a, b) => a.weekNumber - b.weekNumber); // 1 ... N
  const orderedAsc = [...plan.weeks].sort((a, b) => a.weekStartDate.localeCompare(b.weekStartDate));
  const maxHours = Math.max(...weeks.map((w) => w.weeklyVolumeHours), 1);
  const positions = phasePositions(orderedAsc);

  const totalHours = weeks.reduce((acc, w) => acc + w.weeklyVolumeHours, 0);
  const peakHours = Math.max(...weeks.map((w) => w.weeklyVolumeHours));
  const recoveryWeeks = weeks.filter((w) => w.isRecoveryWeek).length;
  const sessionsByDiscipline = { swim: 0, bike: 0, run: 0, brick: 0 };
  for (const w of weeks) {
    for (const s of w.keySessions) {
      if (isBrick(s.workoutCode)) sessionsByDiscipline.brick++;
      else if (s.discipline === 'swim') sessionsByDiscipline.swim++;
      else if (s.discipline === 'bike') sessionsByDiscipline.bike++;
      else sessionsByDiscipline.run++;
    }
  }

  const ribbon = phaseRibbon(orderedAsc);
  const auditWeeks = audit.byWeek;
  const auditVerdict = audit.verdict ?? null;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(`Full Ironman Plan — ${formatDate(plan.raceDate)}`)}</title>
<style>${CSS}</style>
</head>
<body>
<header class="page-header">
  <div class="header-row">
    <div class="title-block">
      <h1>Full Ironman Plan</h1>
      <p class="subtitle">A-race · ${escapeHtml(formatDate(plan.raceDate))} · <span id="days-to-race" data-race="${escapeHtml(plan.raceDate)}">…</span></p>
    </div>
    <div class="header-meta">
      <div class="meta-item"><span class="k">Total weeks</span><span class="v">${weeks.length}</span></div>
      <div class="meta-item"><span class="k">Generated</span><span class="v">${escapeHtml(plan.generatedAt.slice(0, 10))}</span></div>
      <button class="print-btn" onclick="window.print()" aria-label="Print this plan">Print</button>
    </div>
  </div>
  <div class="athlete-line">
    <span><span class="k">Target</span> ${escapeHtml(String(profile.plannedWeeklyHours))} h/wk</span>
    <span class="dot">·</span>
    <span><span class="k">Days</span> ${escapeHtml(String(profile.trainingDaysPerWeek))}/wk</span>
    <span class="dot">·</span>
    <span><span class="k">Long-session days</span> ${profile.longSessionDays.map((d) => `<span class="day-chip">${escapeHtml(DAY_LABEL[d as Day] ?? d)}</span>`).join('')}</span>
    ${profile.mandatoryRestDays.length > 0 ? `<span class="dot">·</span><span><span class="k">Rest</span> ${profile.mandatoryRestDays.map((d) => `<span class="day-chip rest">${escapeHtml(DAY_LABEL[d as Day] ?? d)}</span>`).join('')}</span>` : ''}
    ${auditVerdict ? `<span class="dot">·</span><span class="audit-verdict" title="From the audit file">${escapeHtml(auditVerdict)}</span>` : ''}
  </div>
</header>

<main class="page-main">
  <section class="overview" aria-label="Plan overview">
    <div class="overview-grid">
      <div class="bands-wrap">
        <div class="bands" role="group" aria-label="Weekly volume bands">
          ${orderedAsc
            .map((w) => {
              const pct = (w.weeklyVolumeHours / maxHours) * 100;
              const fill = phaseColor(w.phase);
              const recoveryClass = w.isRecoveryWeek ? ' is-recovery' : '';
              const raceClass = w.phase === 'race_week' ? ' is-race' : '';
              return `<button class="band${recoveryClass}${raceClass}" data-week="${w.weekNumber}" type="button" aria-label="Jump to week ${w.weekNumber}, ${escapeHtml(phaseLabel(w.phase))}, ${w.weeklyVolumeHours} hours" style="--h:${pct.toFixed(2)}%; --c:${fill};">
            <span class="band-bar"><span class="band-fill"></span></span>
            <span class="band-num">${w.weekNumber}</span>
            <span class="band-hours">${w.weeklyVolumeHours}h</span>
          </button>`;
            })
            .join('')}
        </div>
        <div class="ribbon">
          ${ribbon
            .map(
              (g) =>
                `<span class="ribbon-seg" style="--c:${phaseColor(g.phase)}; flex:${g.count};">
                  <span class="ribbon-dot"></span>
                  <span class="ribbon-text">${escapeHtml(phaseLabel(g.phase))} <span class="ribbon-w">(${g.count}w)</span></span>
                </span>`,
            )
            .join('')}
        </div>
      </div>

      <div class="metrics" role="group" aria-label="Plan metrics">
        <div class="metric"><span class="k">Peak weekly</span><span class="v"><strong>${peakHours}</strong>h</span></div>
        <div class="metric"><span class="k">Total plan</span><span class="v"><strong>${totalHours.toFixed(1)}</strong>h</span></div>
        <div class="metric"><span class="k">R&R weeks</span><span class="v"><strong>${recoveryWeeks}</strong></span></div>
        <div class="metric metric-disciplines">
          <span class="k">Breakthrough sessions</span>
          <span class="v">
            <span class="dchip dchip-swim" title="Swim breakthroughs">${disciplineIcon('swim', false)} ${sessionsByDiscipline.swim}</span>
            <span class="dchip dchip-bike" title="Bike breakthroughs">${disciplineIcon('bike', false)} ${sessionsByDiscipline.bike}</span>
            <span class="dchip dchip-run" title="Run breakthroughs">${disciplineIcon('run', false)} ${sessionsByDiscipline.run}</span>
            <span class="dchip dchip-brick" title="Brick breakthroughs">${disciplineIcon('bike', true)} ${sessionsByDiscipline.brick}</span>
          </span>
        </div>
      </div>
    </div>
    ${plan.globalNotes ? `<details class="global-notes"><summary>Plan-level notes</summary><p>${escapeHtml(plan.globalNotes)}</p></details>` : ''}
  </section>

  <section class="weeks-section" aria-label="Week-by-week detail">
    ${orderedAsc.map((w) => renderWeekCard(w, profile, codeNames, positions, auditWeeks)).join('\n')}
  </section>
</main>

<footer class="page-footer">
  <p>Plan id: <code>${escapeHtml(plan.athleteProfileId)}</code> · Generated ${escapeHtml(plan.generatedAt)} · Render ${escapeHtml(new Date().toISOString())}</p>
</footer>

<script>${JS_RUNTIME}</script>
</body>
</html>
`;
}

function renderWeekCard(
  w: MacroPlanWeek,
  profile: AthleteProfile,
  codeNames: Map<string, string>,
  positions: Map<number, PhasePosition>,
  auditByWeek: Map<number, string[]>,
): string {
  const endIso = addDaysIso(w.weekStartDate, 6);
  const phasePos = positions.get(w.weekNumber);
  const phasePosLabel = phasePos ? `, week ${phasePos.index} of ${phasePos.total}` : '';
  const fill = phaseColor(w.phase);
  const findings = auditByWeek.get(w.weekNumber) ?? [];

  const days = DAY_ORDER.map((day) => {
    const sessions = w.keySessions.filter((s) => s.dayOfWeek === day);
    const isLong = profile.longSessionDays.includes(day);
    const isRest = profile.mandatoryRestDays.includes(day);
    const tag = isLong && isRest ? 'rest' : isLong ? 'long' : isRest ? 'rest' : '';
    return `<div class="day day-${tag}">
      <div class="day-head">
        <span class="day-name">${DAY_LABEL[day]}</span>
        ${isLong ? '<span class="day-mark long" title="Long-session day">●</span>' : ''}
        ${isRest ? '<span class="day-mark rest" title="Mandatory rest day">○</span>' : ''}
      </div>
      <div class="day-body">
        ${
          sessions.length === 0
            ? `<span class="no-session" aria-label="no key session">—</span>`
            : sessions.map((s) => renderSessionPill(s, codeNames)).join('')
        }
      </div>
    </div>`;
  }).join('');

  const citations = uniqueCitations(w);
  const deviations = w.deviations ?? [];

  return `<article class="week ${w.isRecoveryWeek ? 'is-recovery' : ''} ${w.phase === 'race_week' ? 'is-race' : ''}" id="week-${w.weekNumber}" style="--c:${fill};">
  <header class="week-head">
    <div class="week-id">
      <div class="week-no">Week <strong>${w.weekNumber}</strong></div>
      <div class="week-dates">${escapeHtml(formatDate(w.weekStartDate))} → ${escapeHtml(formatDate(endIso))}</div>
    </div>
    <div class="week-phase">
      <span class="phase-badge" style="background:${fill};">${escapeHtml(phaseLabel(w.phase))}</span>
      ${w.isRecoveryWeek ? '<span class="badge recovery">R&amp;R</span>' : ''}
      ${w.phase === 'race_week' ? '<span class="badge race">Race</span>' : ''}
      <span class="phase-pos">${escapeHtml(phaseLabel(w.phase))}${escapeHtml(phasePosLabel)}</span>
    </div>
    <div class="week-vol">
      <span class="vol-num"><strong>${w.weeklyVolumeHours}</strong></span>
      <span class="vol-unit">h</span>
    </div>
  </header>

  <div class="days-grid" role="grid" aria-label="Key sessions by day">
    ${days}
  </div>

  ${
    findings.length > 0
      ? `<details class="audit-flags" open>
      <summary>Audit findings (${findings.length})</summary>
      <ul>${findings.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul>
    </details>`
      : ''
  }

  <div class="week-supplemental">
    ${
      w.notes
        ? `<details class="week-notes"><summary>Notes</summary><p>${escapeHtml(w.notes)}</p></details>`
        : ''
    }
    ${
      deviations.length > 0
        ? `<details class="week-deviations"><summary>Deviations (${deviations.length})</summary><ul>${deviations.map((d) => `<li>${escapeHtml(d)}</li>`).join('')}</ul></details>`
        : ''
    }
    ${
      citations.length > 0
        ? `<details class="week-citations"><summary>Sources (${citations.length})</summary><ul>${citations.map((c) => `<li><code>${escapeHtml(c)}</code></li>`).join('')}</ul></details>`
        : ''
    }
  </div>
</article>`;
}

function uniqueCitations(w: MacroPlanWeek): string[] {
  const set = new Set<string>();
  for (const s of w.keySessions) set.add(s.citation);
  return [...set].sort();
}

function renderSessionPill(
  s: MacroPlanWeek['keySessions'][number],
  codeNames: Map<string, string>,
): string {
  const brick = isBrick(s.workoutCode);
  const cls = disciplineClass(s.discipline, brick);
  const name = codeNames.get(s.workoutCode);
  const fullLabel = name ? `${s.workoutCode} — ${name}` : `${s.workoutCode} (name not found)`;
  const dlabel = disciplineLabel(s.discipline, brick);
  return `<div class="pill ${cls}" tabindex="0" aria-label="${escapeHtml(fullLabel)}, ${escapeHtml(dlabel)}. ${escapeHtml(s.rationale)}">
    <div class="pill-head">
      <span class="pill-icon" aria-hidden="true">${disciplineIcon(s.discipline, brick)}</span>
      <span class="pill-code">${escapeHtml(s.workoutCode)}</span>
      <span class="pill-d">${escapeHtml(dlabel)}</span>
    </div>
    <div class="pill-name" title="${escapeHtml(fullLabel)}">${escapeHtml(name ?? '(name not found)')}</div>
    <div class="pill-rationale">${escapeHtml(s.rationale)}</div>
  </div>`;
}

// ─── Inline CSS ──────────────────────────────────────────────────────────────

const CSS = `
/* Direction A — instrument panel (Garmin / Linear feel).
   Dark surface, restrained palette, inline SVG icons.
   Print rules invert to white.                          */

:root {
  --bg: #0E1116;
  --surface: #161B22;
  --surface-2: #1C232C;
  --line: #2A3340;
  --text: #E6EDF3;
  --text-2: #8B949E;
  --text-3: #6E7681;
  --accent-swim: #4FC3D5;
  --accent-bike: #E5A341;
  --accent-run: #6BBC5E;
  --accent-brick: #C68B3C;
  --warn: #E5524C;
  --pill-radius: 8px;
  --card-radius: 10px;
}

* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); }
body {
  font: 14px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}

code, .mono { font: 600 13px/1.4 ui-monospace, SFMono-Regular, "SF Mono", Monaco, "Cascadia Mono", monospace; }

a { color: var(--accent-swim); }

/* Header */
.page-header {
  position: sticky;
  top: 0;
  z-index: 5;
  background: linear-gradient(180deg, rgba(14,17,22,0.98) 0%, rgba(14,17,22,0.9) 100%);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--line);
  padding: 18px 28px 14px;
}
.header-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; flex-wrap: wrap; }
.title-block h1 { font-size: 32px; font-weight: 700; margin: 0 0 4px; letter-spacing: -0.02em; }
.subtitle { margin: 0; color: var(--text-2); font-size: 14px; }
#days-to-race { color: var(--accent-bike); font-weight: 600; }

.header-meta { display: flex; gap: 18px; align-items: center; }
.meta-item { display: flex; flex-direction: column; align-items: flex-end; }
.meta-item .k { font-size: 11px; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.06em; }
.meta-item .v { font-size: 16px; font-weight: 600; color: var(--text); }

.print-btn {
  background: var(--surface-2); color: var(--text); border: 1px solid var(--line);
  border-radius: 6px; padding: 8px 14px; font: inherit; font-weight: 600; cursor: pointer;
}
.print-btn:hover { background: var(--surface); border-color: var(--text-3); }
.print-btn:focus-visible { outline: 2px solid var(--accent-swim); outline-offset: 2px; }

.athlete-line {
  display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center;
  margin-top: 10px; color: var(--text-2); font-size: 13px;
}
.athlete-line .k { color: var(--text-3); text-transform: uppercase; font-size: 10px; letter-spacing: 0.06em; margin-right: 4px; }
.athlete-line .dot { color: var(--text-3); }
.day-chip {
  display: inline-block; padding: 2px 7px; border-radius: 999px;
  background: var(--surface-2); border: 1px solid var(--line); color: var(--text);
  font: 600 11px/1 ui-monospace, SFMono-Regular, monospace; margin-right: 4px;
}
.day-chip.rest { color: var(--text-3); }
.audit-verdict {
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em;
  background: var(--surface-2); border: 1px solid var(--line); padding: 2px 8px;
  border-radius: 4px; color: var(--text-2);
}

/* Main layout */
.page-main { padding: 24px 28px 60px; max-width: 1280px; margin: 0 auto; }

/* Overview */
.overview {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--card-radius);
  padding: 22px 24px;
  margin-bottom: 28px;
}
.overview-grid { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 28px; align-items: stretch; }
.bands-wrap { display: flex; flex-direction: column; gap: 10px; min-width: 0; }

.bands {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(36px, 1fr));
  gap: 6px;
  align-items: end;
  height: 140px;
  padding-bottom: 4px;
}
.band {
  background: transparent; border: 0; padding: 0; cursor: pointer;
  display: flex; flex-direction: column; align-items: stretch; justify-content: flex-end;
  height: 100%; color: var(--text-3); position: relative;
}
.band-bar { display: block; height: 100%; position: relative; }
.band-fill {
  position: absolute; bottom: 0; left: 0; right: 0;
  height: var(--h);
  background: var(--c);
  border-radius: 3px 3px 0 0;
  transition: filter 120ms ease, transform 120ms ease;
}
.band-num { font-size: 10px; color: var(--text-3); margin-top: 4px; text-align: center; font-weight: 600; }
.band-hours { font-size: 10px; color: var(--text-3); text-align: center; font-variant-numeric: tabular-nums; }
.band:hover .band-fill { filter: brightness(1.18); transform: translateY(-1px); }
.band:focus-visible { outline: none; }
.band:focus-visible .band-fill { outline: 2px solid var(--accent-swim); outline-offset: 2px; }

.band.is-recovery .band-fill {
  background-image: repeating-linear-gradient(45deg, rgba(0,0,0,0.0) 0 4px, rgba(0,0,0,0.28) 4px 8px);
  background-color: var(--c);
}
.band.is-race .band-fill {
  outline: 2px solid #fff; outline-offset: -2px;
}

/* Ribbon */
.ribbon { display: flex; gap: 4px; padding-top: 4px; border-top: 1px solid var(--line); margin-top: 4px; }
.ribbon-seg {
  flex: 1; min-width: 0; padding: 6px 8px; border-radius: 4px;
  background: var(--surface-2);
  display: flex; align-items: center; gap: 6px;
  font-size: 12px;
  border-left: 3px solid var(--c);
}
.ribbon-dot { display: none; }
.ribbon-text { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text); }
.ribbon-w { color: var(--text-3); }

/* Metrics */
.metrics {
  display: flex; flex-direction: column; gap: 12px; min-width: 220px;
}
.metric {
  display: flex; align-items: baseline; justify-content: space-between; gap: 10px;
  padding: 10px 14px; border: 1px solid var(--line); border-radius: 6px;
  background: var(--surface-2);
}
.metric .k { font-size: 11px; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.06em; }
.metric .v { font-size: 18px; font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums; }
.metric .v strong { font-weight: 700; }
.metric-disciplines { flex-direction: column; align-items: stretch; gap: 6px; }
.metric-disciplines .v { display: flex; gap: 8px; flex-wrap: wrap; }

.dchip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 8px; border-radius: 999px;
  background: var(--bg); border: 1px solid var(--line);
  font: 600 12px/1 ui-monospace, SFMono-Regular, monospace; color: var(--text);
}
.dchip-swim { color: var(--accent-swim); border-color: rgba(79,195,213,0.32); }
.dchip-bike { color: var(--accent-bike); border-color: rgba(229,163,65,0.32); }
.dchip-run  { color: var(--accent-run);  border-color: rgba(107,188,94,0.32); }
.dchip-brick { color: var(--accent-brick); border-color: rgba(198,139,60,0.32); }

.global-notes {
  margin-top: 16px; padding: 12px 14px; background: var(--surface-2); border: 1px solid var(--line); border-radius: 6px;
  color: var(--text-2);
}
.global-notes summary { cursor: pointer; color: var(--text); font-weight: 600; }
.global-notes p { margin: 8px 0 0; line-height: 1.55; }

/* Weeks list */
.weeks-section { display: flex; flex-direction: column; gap: 14px; }

.week {
  background: var(--surface);
  border: 1px solid var(--line);
  border-left: 4px solid var(--c);
  border-radius: var(--card-radius);
  padding: 16px 18px 14px;
  scroll-margin-top: 100px;
}
.week.is-recovery { background: linear-gradient(180deg, var(--surface) 0%, rgba(110,118,129,0.08) 100%); }
.week.is-race { border-left-color: #B91C1C; }

.week-head {
  display: grid; grid-template-columns: 1fr auto auto; gap: 18px; align-items: center;
  padding-bottom: 12px; border-bottom: 1px solid var(--line); margin-bottom: 14px;
}
.week-id .week-no { font-size: 20px; font-weight: 600; }
.week-id .week-no strong { color: var(--c); font-weight: 700; }
.week-id .week-dates { font-size: 12px; color: var(--text-2); margin-top: 2px; }

.week-phase { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.phase-badge {
  font: 600 11px/1 ui-sans-serif, system-ui;
  letter-spacing: 0.04em; text-transform: uppercase;
  color: #0E1116; padding: 4px 10px; border-radius: 4px;
}
.badge {
  font: 600 10px/1 ui-sans-serif, system-ui; padding: 3px 8px;
  border-radius: 4px; letter-spacing: 0.04em; text-transform: uppercase;
  background: var(--surface-2); border: 1px solid var(--line); color: var(--text-2);
}
.badge.recovery { color: var(--text); }
.badge.race { background: #B91C1C; color: #fff; border-color: #B91C1C; }
.phase-pos { font-size: 11px; color: var(--text-3); margin-left: 4px; }

.week-vol { text-align: right; }
.week-vol .vol-num { font-variant-numeric: tabular-nums; font-size: 22px; font-weight: 700; color: var(--text); }
.week-vol .vol-unit { font-size: 13px; color: var(--text-2); margin-left: 2px; }

/* Days grid */
.days-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
}
.day {
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 8px 8px 10px;
  min-height: 88px;
  display: flex; flex-direction: column; gap: 6px;
}
.day-long { background: linear-gradient(180deg, rgba(229,163,65,0.06), rgba(229,163,65,0.02)); border-color: rgba(229,163,65,0.32); }
.day-rest { background: repeating-linear-gradient(135deg, var(--surface-2) 0 8px, var(--bg) 8px 12px); color: var(--text-3); }

.day-head { display: flex; align-items: center; justify-content: space-between; }
.day-name { font: 600 11px/1 ui-monospace, monospace; letter-spacing: 0.04em; color: var(--text-2); text-transform: uppercase; }
.day-mark { font-size: 9px; line-height: 1; }
.day-mark.long { color: var(--accent-bike); }
.day-mark.rest { color: var(--text-3); }

.day-body { display: flex; flex-direction: column; gap: 4px; }
.no-session { color: var(--text-3); text-align: center; padding: 14px 0; font-size: 16px; }

.pill {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--pill-radius);
  padding: 6px 8px;
  display: flex; flex-direction: column; gap: 2px;
  position: relative;
  cursor: default;
  transition: border-color 120ms ease;
}
.pill:hover, .pill:focus-visible { border-color: currentColor; outline: none; }
.pill-head { display: flex; align-items: center; gap: 5px; min-height: 16px; }
.pill-icon { display: inline-flex; flex: 0 0 auto; }
.pill-code { font: 700 12px/1 ui-monospace, SFMono-Regular, monospace; }
.pill-d { font-size: 9px; color: var(--text-3); margin-left: auto; text-transform: uppercase; letter-spacing: 0.06em; }
.pill-name { font-size: 11px; color: var(--text); line-height: 1.25; }
.pill-rationale {
  font-size: 11px; color: var(--text-2); line-height: 1.3;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
}
.pill:hover .pill-rationale, .pill:focus-visible .pill-rationale { -webkit-line-clamp: unset; }

.pill-swim  { color: var(--accent-swim); border-color: rgba(79,195,213,0.32); }
.pill-bike  { color: var(--accent-bike); border-color: rgba(229,163,65,0.32); }
.pill-run   { color: var(--accent-run);  border-color: rgba(107,188,94,0.32); }
.pill-brick { color: var(--accent-brick); border-color: rgba(198,139,60,0.42); background: linear-gradient(135deg, rgba(79,195,213,0.05), rgba(229,163,65,0.05)); }

/* Audit + supplemental */
.audit-flags {
  margin-top: 12px; background: rgba(229,82,76,0.06); border: 1px solid rgba(229,82,76,0.32);
  border-radius: 6px; padding: 8px 12px; color: var(--text);
}
.audit-flags > summary { cursor: pointer; font-weight: 600; color: var(--warn); }
.audit-flags ul { margin: 6px 0 0; padding-left: 18px; }
.audit-flags li { line-height: 1.4; margin: 4px 0; color: var(--text-2); }

.week-supplemental { margin-top: 10px; display: flex; gap: 16px; flex-wrap: wrap; font-size: 12px; }
.week-supplemental details { color: var(--text-2); }
.week-supplemental summary { cursor: pointer; font-weight: 600; color: var(--text); padding: 2px 0; }
.week-supplemental ul { margin: 4px 0 0; padding-left: 18px; }
.week-supplemental li { line-height: 1.4; margin: 2px 0; }
.week-supplemental p { margin: 6px 0 0; line-height: 1.5; max-width: 70ch; }

.page-footer { padding: 16px 28px 32px; color: var(--text-3); font-size: 11px; max-width: 1280px; margin: 0 auto; }
.page-footer code { color: var(--text-2); }

/* Responsive */
@media (max-width: 900px) {
  .page-header { padding: 14px 18px 12px; }
  .header-row { flex-direction: column; gap: 10px; }
  .header-meta { width: 100%; justify-content: space-between; }
  .page-main { padding: 18px 18px 40px; }
  .overview { padding: 16px; }
  .overview-grid { grid-template-columns: minmax(0, 1fr); gap: 18px; }
  .metrics { flex-direction: row; flex-wrap: wrap; }
  .week-head { grid-template-columns: 1fr; }
  .week-vol { text-align: left; }
  .days-grid { grid-template-columns: 1fr; }
  .day { min-height: 0; }
}

/* Print */
@media print {
  :root { --bg: #fff; --surface: #fff; --surface-2: #f5f5f5; --line: #ccc; --text: #111; --text-2: #555; --text-3: #888; }
  body { background: #fff; color: #111; }
  .page-header { position: static; backdrop-filter: none; box-shadow: none; }
  .print-btn, .audit-flags { display: none; }
  .overview { break-inside: avoid; }
  .week { break-inside: avoid; page-break-inside: avoid; border-color: #999; box-shadow: none; }
  .pill { background: #fff; }
  .day-rest { background: repeating-linear-gradient(135deg, #f0f0f0 0 8px, #fff 8px 12px); }
  .band-fill { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  .phase-badge { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
}
`;

// ─── Inline JS ───────────────────────────────────────────────────────────────

const JS_RUNTIME = `
(function () {
  // Days-to-race countdown
  var el = document.getElementById('days-to-race');
  if (el) {
    var raceIso = el.getAttribute('data-race');
    if (raceIso) {
      var race = new Date(raceIso + 'T00:00:00Z');
      var now = new Date();
      var nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      var ms = race.getTime() - nowUtc;
      var days = Math.round(ms / 86400000);
      if (days > 0) el.textContent = days + ' days to race';
      else if (days === 0) el.textContent = 'race day';
      else el.textContent = (-days) + ' days since race';
    }
  }

  // Click-to-scroll on phase bands
  document.querySelectorAll('.band').forEach(function (b) {
    b.addEventListener('click', function () {
      var n = b.getAttribute('data-week');
      if (!n) return;
      var target = document.getElementById('week-' + n);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
  const codeNames = loadCodeNames();
  console.log(`Loaded ${codeNames.size} workout codes`);
  const audit = tryLoadAudit(timestamp);
  if (audit.byWeek.size > 0) {
    console.log(
      `Audit: ${audit.verdict ?? '(no verdict)'} — findings on ${audit.byWeek.size} weeks`,
    );
  }

  const html = renderHtml({ plan, profile, codeNames, audit });
  const outPath = join(OUTPUT_DIR, `plan-${timestamp}.html`);
  writeFileSync(outPath, html);
  console.log(`Wrote: ${outPath}`);
  console.log(`Size: ${(html.length / 1024).toFixed(1)} KB`);
}

main();
