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

function disciplineClass(d: string, brick: boolean): string {
  if (brick) return 's-brick';
  if (d === 'swim') return 's-swim';
  if (d === 'bike') return 's-bike';
  return 's-run';
}

// ─── SVG illustrations ───────────────────────────────────────────────────────

const SVG_HERO = `<svg class="hero-svg" viewBox="0 0 800 220" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#F4D9A8"/>
      <stop offset="55%" stop-color="#F0BC7E"/>
      <stop offset="100%" stop-color="#C97C4A"/>
    </linearGradient>
    <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stop-color="#FFE9B0"/>
      <stop offset="100%" stop-color="#E5A341" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect x="0" y="0" width="800" height="220" fill="url(#sky)"/>
  <circle cx="640" cy="78" r="72" fill="url(#sun)"/>
  <circle cx="640" cy="78" r="26" fill="#FFE9B0"/>
  <!-- water plane -->
  <rect x="0" y="160" width="800" height="60" fill="#7A4F2C" opacity="0.55"/>
  <path d="M0 160 Q 60 154, 120 160 T 240 160 T 360 160 T 480 160 T 600 160 T 720 160 T 800 160" stroke="#3D2818" stroke-width="1" fill="none" opacity="0.45"/>
  <path d="M0 174 Q 60 168, 120 174 T 240 174 T 360 174 T 480 174 T 600 174 T 720 174 T 800 174" stroke="#3D2818" stroke-width="1" fill="none" opacity="0.32"/>
  <path d="M0 188 Q 60 182, 120 188 T 240 188 T 360 188 T 480 188 T 600 188 T 720 188 T 800 188" stroke="#3D2818" stroke-width="1" fill="none" opacity="0.22"/>
  <!-- silhouette: swimmer -->
  <g transform="translate(110,142)" fill="#1A1B1F">
    <ellipse cx="0" cy="6" rx="22" ry="6" opacity="0.4"/>
    <path d="M-18 0 Q -10 -4, -2 -2 L 14 -3 Q 22 -4, 26 -1 L 22 3 L 6 4 Q -4 6, -14 4 Z"/>
    <circle cx="-14" cy="-2" r="3"/>
    <path d="M 16 -4 Q 24 -10, 30 -8 Q 28 -4, 24 -3" stroke="#1A1B1F" stroke-width="2" fill="none"/>
  </g>
  <!-- silhouette: cyclist -->
  <g transform="translate(360,118)" fill="#1A1B1F">
    <circle cx="-22" cy="20" r="14" stroke="#1A1B1F" stroke-width="2.5" fill="none"/>
    <circle cx="22" cy="20" r="14" stroke="#1A1B1F" stroke-width="2.5" fill="none"/>
    <path d="M -22 20 L -2 -2 L 22 20 M -2 -2 L 6 -8 L 12 -10 M -10 20 L -2 -2" stroke="#1A1B1F" stroke-width="2.5" fill="none" stroke-linecap="round"/>
    <path d="M 4 -10 Q 14 -22, 24 -16 L 22 -8 Q 14 -6, 8 -8 Z"/>
    <circle cx="22" cy="-19" r="4"/>
  </g>
  <!-- silhouette: runner -->
  <g transform="translate(580,128)" fill="#1A1B1F">
    <circle cx="0" cy="-22" r="6"/>
    <path d="M -2 -16 L -8 -2 L -14 12 L -10 18 M -2 -16 L 4 -8 L 14 6 L 18 14 M -2 -16 L -8 -2 L -2 8 L -8 22" stroke="#1A1B1F" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M 4 -8 Q 16 -10, 22 -2" stroke="#1A1B1F" stroke-width="3" fill="none" stroke-linecap="round"/>
  </g>
</svg>`;

function disciplineSvg(d: string, brick: boolean): string {
  // 36×36 silhouettes — bigger and more distinctive than the prior letter chips.
  if (brick) {
    return `<svg viewBox="0 0 36 24" width="42" height="28" aria-hidden="true">
      <g fill="currentColor">
        <circle cx="6" cy="18" r="3.6" stroke="currentColor" stroke-width="1.4" fill="none"/>
        <circle cx="14" cy="18" r="3.6" stroke="currentColor" stroke-width="1.4" fill="none"/>
        <path d="M6 18 L10 11 L14 18 M10 11 L11 8" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round"/>
        <circle cx="22" cy="6" r="2" fill="currentColor"/>
        <path d="M22 9 L 19 14 L 17 19 M 22 9 L 25 13 L 27 18 M 22 9 L 19 14 L 22 22" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
      </g>
    </svg>`;
  }
  if (d === 'swim') {
    return `<svg viewBox="0 0 36 24" width="36" height="24" aria-hidden="true">
      <g fill="currentColor">
        <circle cx="9" cy="10" r="3.2"/>
        <path d="M12 12 Q 18 9, 26 12 L 30 11 Q 32 11, 32 13 L 26 15 Q 18 17, 12 14 Z"/>
        <path d="M2 18 Q 6 16, 10 18 T 18 18 T 26 18 T 34 18" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" opacity="0.7"/>
        <path d="M2 22 Q 6 20, 10 22 T 18 22 T 26 22 T 34 22" stroke="currentColor" stroke-width="1.4" fill="none" stroke-linecap="round" opacity="0.5"/>
      </g>
    </svg>`;
  }
  if (d === 'bike') {
    return `<svg viewBox="0 0 36 24" width="36" height="24" aria-hidden="true">
      <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
        <circle cx="8" cy="17" r="5"/>
        <circle cx="28" cy="17" r="5"/>
        <path d="M8 17 L18 6 L28 17 M18 6 L20 3 L24 2 M14 17 L18 6 M22 17 L18 6"/>
      </g>
      <circle cx="22" cy="2.5" r="2" fill="currentColor"/>
    </svg>`;
  }
  return `<svg viewBox="0 0 36 24" width="36" height="24" aria-hidden="true">
    <g fill="currentColor">
      <circle cx="20" cy="4" r="2.6"/>
      <path d="M20 7 L 16 13 L 11 18 L 13 22 M 20 7 L 24 11 L 30 14 L 32 18 M 20 7 L 16 13 L 19 18 L 14 23" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M 24 11 Q 30 9, 33 13" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/>
    </g>
  </svg>`;
}

const PHASE_EMBLEM: Record<string, string> = {
  prep: '<svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="2.5" fill="currentColor"/><circle cx="7" cy="7" r="5.5" fill="none" stroke="currentColor" stroke-width="1" opacity="0.5"/></svg>',
  base_1:
    '<svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><rect x="2" y="9" width="10" height="2" fill="currentColor"/></svg>',
  base_2:
    '<svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><rect x="2" y="9" width="10" height="2" fill="currentColor"/><rect x="2" y="6" width="10" height="2" fill="currentColor" opacity="0.7"/></svg>',
  base_3:
    '<svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><rect x="2" y="9" width="10" height="2" fill="currentColor"/><rect x="2" y="6" width="10" height="2" fill="currentColor" opacity="0.7"/><rect x="2" y="3" width="10" height="2" fill="currentColor" opacity="0.45"/></svg>',
  build_1:
    '<svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><path d="M2 11 L5 11 L5 8 L9 8 L9 5 L12 5 L12 11" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  build_2:
    '<svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><path d="M2 11 L5 11 L5 8 L9 8 L9 5 L12 5 L12 2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
  peak: '<svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><path d="M2 12 L7 3 L12 12 Z" fill="currentColor"/></svg>',
  race_week:
    '<svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><path d="M3 2 L3 12 M3 2 L11 5 L3 8" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
  transition:
    '<svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true"><path d="M3 7 L11 7 M8 4 L11 7 L8 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

function phaseEmblem(p: string): string {
  return PHASE_EMBLEM[p] ?? PHASE_EMBLEM['transition'] ?? '';
}

// Workout-shape mini chart (~120×24): warm-up + N main intervals + cooldown,
// derived from the workout-code suffix. Pure shape — purely visual signal.
function workoutShape(code: string, color: string): string {
  const suffix = code.split('/')[1] ?? '';
  const W = 120;
  const H = 26;

  // Decide a parametric shape per family.
  let bars: Array<{ x: number; w: number; h: number; opacity?: number }> = [];

  if (/^T(?!E|B)/.test(suffix) || /^Te/.test(suffix)) {
    // Threshold / TE / Test: a ramp up to a flat plateau, then drop.
    bars = [
      { x: 4, w: 16, h: 6, opacity: 0.55 },
      { x: 22, w: 12, h: 12, opacity: 0.7 },
      { x: 36, w: 60, h: 22 },
      { x: 98, w: 18, h: 6, opacity: 0.55 },
    ];
  } else if (/^AE2|^AE1$/.test(suffix)) {
    // Long aerobic endurance — sustained medium block.
    bars = [
      { x: 4, w: 14, h: 6, opacity: 0.55 },
      { x: 20, w: 78, h: 16 },
      { x: 100, w: 16, h: 6, opacity: 0.55 },
    ];
  } else if (/^AC|^ME|^MF|^TB|^TE|^Te/.test(suffix)) {
    // Intervals — N spikes.
    const n = /^AC1|^ME3|^MF1/.test(suffix) ? 5 : 4;
    const start = 8;
    const end = W - 8;
    const span = end - start;
    const gap = 4;
    const barW = (span - (n - 1) * gap) / n;
    const ints: Array<{ x: number; w: number; h: number; opacity?: number }> = [];
    for (let i = 0; i < n; i++) {
      ints.push({ x: start + i * (barW + gap), w: barW, h: 22 });
    }
    bars = [{ x: 0, w: 6, h: 6, opacity: 0.55 }, ...ints, { x: W - 6, w: 6, h: 6, opacity: 0.55 }];
  } else if (/^SS/.test(suffix)) {
    // Skill — short, varied.
    bars = [
      { x: 6, w: 10, h: 6, opacity: 0.55 },
      { x: 20, w: 8, h: 14 },
      { x: 32, w: 8, h: 10 },
      { x: 44, w: 8, h: 16 },
      { x: 56, w: 8, h: 10 },
      { x: 68, w: 8, h: 14 },
      { x: 80, w: 8, h: 10 },
      { x: 92, w: 22, h: 6, opacity: 0.55 },
    ];
  } else {
    // Default: plain endurance block.
    bars = [{ x: 8, w: 104, h: 14 }];
  }

  const rects = bars
    .map((b) => {
      const y = H - b.h - 1;
      const op = b.opacity != null ? ` opacity="${b.opacity}"` : '';
      return `<rect x="${b.x.toFixed(1)}" y="${y.toFixed(1)}" width="${b.w.toFixed(1)}" height="${b.h.toFixed(1)}" rx="1.2" fill="${color}"${op}/>`;
    })
    .join('');

  return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true" class="shape">
    <line x1="0" y1="${H - 0.5}" x2="${W}" y2="${H - 0.5}" stroke="currentColor" stroke-width="0.5" opacity="0.2"/>
    ${rects}
  </svg>`;
}

// One-line shorthand for the session summary, derived from KB info.
function durationShort(info?: WorkoutInfo): string {
  if (!info?.duration) return '';
  return info.duration.split(/[;:]/)[0]?.trim() ?? '';
}

function zonesShort(info?: WorkoutInfo): string {
  if (!info?.zones) return '';
  const z = info.zones;
  const m = z.match(
    /(?:pace|power|HR|heart rate)?\s*zone[s]?\s+([0-9a-z]+(?:\s+to\s+[0-9a-z]+)?)/i,
  );
  if (m && m[1]) return `Z${m[1].replace(/\s+to\s+/i, '–').replace(/\s+/g, '')}`;
  return z.split(/[;,]/)[0]?.trim().slice(0, 40) ?? '';
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
  <div class="hero">
    ${SVG_HERO}
    <div class="hero-overlay">
      <p class="kicker">Full Ironman Plan</p>
      <h1 class="hero-h1"><span class="hero-count" id="days-to-race" data-race="${escapeHtml(plan.raceDate)}">…</span></h1>
      <p class="hero-meta">Race ${escapeHtml(plan.raceDate)} · ${weeksAsc.length} weeks · ${peakHours}h peak</p>
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
              <span class="rib-emblem" style="color:${phaseColor(g.phase)}">${phaseEmblem(g.phase)}</span>
              ${escapeHtml(phaseLabel(g.phase))} <span class="rib-w">${g.count}w</span>
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
        <span class="phase-tag">${phaseEmblem(w.phase)} <span>${escapeHtml(phaseLabel(w.phase))}${escapeHtml(phasePosLabel)}</span></span>
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
  const main = info?.mainSet;
  const example = info?.example;

  // Discipline color for the shape SVG (must match the per-class border-left
  // accent so signal stays consistent).
  const shapeColor = brick
    ? '#7E5E2A'
    : s.discipline === 'swim'
      ? '#4F7F8E'
      : s.discipline === 'bike'
        ? '#B26C3A'
        : '#6F8C5C';

  const zShort = zonesShort(info);
  const dShort = durationShort(info);

  const hasDetails = Boolean(main) || Boolean(example);

  return `<li class="sess ${cls}${isLong ? ' is-long' : ''}">
    <div class="sess-day">
      <div class="day-glyph" aria-hidden="true">${disciplineSvg(s.discipline, brick)}</div>
      <div class="day-name">${escapeHtml(DAY_FULL[day] ?? day).toUpperCase()}</div>
      ${isLong ? '<div class="day-long" title="Long-session day">Long day</div>' : ''}
    </div>

    <div class="sess-body">
      <div class="sess-head">
        <span class="code">${escapeHtml(s.workoutCode)}</span>
        <span class="name">${escapeHtml(name)}</span>
      </div>

      <div class="sess-meta">
        ${dShort ? `<span class="chip chip-dur">${escapeHtml(dShort)}</span>` : ''}
        ${zShort ? `<span class="chip chip-zone">${escapeHtml(zShort)}</span>` : ''}
        <span class="shape-wrap">${workoutShape(s.workoutCode, shapeColor)}</span>
      </div>

      ${s.rationale ? `<p class="why">${escapeHtml(s.rationale)}</p>` : ''}

      ${
        hasDetails
          ? `<details class="full"><summary>Show full workout</summary>
              ${main ? `<p class="main">${escapeHtml(main)}</p>` : ''}
              ${example ? `<p class="ex">${escapeHtml(example)}</p>` : ''}
            </details>`
          : ''
      }
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

/* Header — hero illustration with prominent countdown */
.page-header { border-bottom: 1px solid var(--line); background: var(--surface); }
.hero { position: relative; overflow: hidden; }
.hero-svg { display: block; width: 100%; height: clamp(180px, 30vw, 260px); }
.hero-overlay {
  position: absolute; left: 0; right: 0; bottom: 0;
  padding: 22px 40px 22px;
  background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.32) 70%, rgba(0,0,0,0.45) 100%);
  color: #FFF8EC;
}
.kicker {
  margin: 0 0 4px; font: 600 11px/1 ui-sans-serif, system-ui, sans-serif;
  letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,248,236,0.78);
}
.hero-h1 {
  margin: 0; font: 700 clamp(36px, 6vw, 56px)/1 ui-serif, Georgia, "Iowan Old Style", "Times New Roman", serif;
  letter-spacing: -0.02em; color: #FFF8EC;
  font-feature-settings: "lnum";
  text-shadow: 0 1px 2px rgba(0,0,0,0.18);
}
.hero-count { color: #FFE9B0; }
.hero-meta {
  margin: 6px 0 0; font: 500 13px/1.3 ui-sans-serif, system-ui, sans-serif;
  color: rgba(255,248,236,0.85); letter-spacing: 0.02em;
}
.print-btn {
  position: absolute; top: 18px; right: 22px;
  background: rgba(0,0,0,0.32); color: #FFF8EC;
  border: 1px solid rgba(255,255,255,0.32); border-radius: 6px;
  padding: 6px 14px; font: 600 12px/1 ui-sans-serif, system-ui, sans-serif;
  cursor: pointer; backdrop-filter: blur(4px);
}
.print-btn:hover { background: rgba(0,0,0,0.5); }
.print-btn:focus-visible { outline: 2px solid #FFE9B0; outline-offset: 2px; }

/* Phase overview */
.phase-overview { padding: 18px 40px 16px; display: flex; flex-direction: column; gap: 8px; }
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
  flex: 1; min-width: 0; padding: 6px 10px; border-radius: 4px;
  background: var(--surface-2);
  border-top: 2px solid var(--c);
  font: 500 11px/1.3 ui-sans-serif, system-ui, sans-serif;
  color: var(--ink-2);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  display: inline-flex; align-items: center; gap: 6px;
}
.rib-emblem { display: inline-flex; align-items: center; }
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
  display: inline-flex; align-items: center; gap: 6px;
  font: 500 11px/1.4 ui-sans-serif, system-ui, sans-serif; color: var(--c);
  border: 1px solid var(--c); padding: 3px 10px 3px 8px; border-radius: 999px;
  text-transform: uppercase; letter-spacing: 0.04em;
  background: color-mix(in srgb, var(--c) 7%, transparent);
}
.phase-tag svg { color: var(--c); }
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

.sess-day { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; min-width: 0; }
.day-glyph {
  display: inline-flex; align-items: center; justify-content: center;
  width: 56px; height: 38px; border-radius: 6px;
  background: var(--surface); border: 1px solid var(--line-2);
}
.s-swim  .day-glyph { color: #4F7F8E; border-color: rgba(79,127,142,0.45); background: #EAF1F4; }
.s-bike  .day-glyph { color: #B26C3A; border-color: rgba(178,108,58,0.45); background: #F8EBDC; }
.s-run   .day-glyph { color: #6F8C5C; border-color: rgba(111,140,92,0.45); background: #ECF1E6; }
.s-brick .day-glyph { color: #7E5E2A; border-color: rgba(126,94,42,0.5); background: linear-gradient(135deg, #EAF1F4 0%, #F8EBDC 100%); }
.day-name {
  font: 700 11px/1 ui-sans-serif, system-ui, sans-serif;
  color: var(--ink); letter-spacing: 0.08em;
}
.day-long {
  font: 700 9px/1 ui-sans-serif, system-ui, sans-serif;
  color: var(--accent); text-transform: uppercase; letter-spacing: 0.1em;
  margin-top: 0;
}

.sess-body { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.sess-head { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
.sess-head .code {
  font: 700 13px/1 ui-monospace, SFMono-Regular, monospace;
  color: var(--ink);
}
.sess-head .name {
  font: 600 17px/1.25 ui-serif, Georgia, "Times New Roman", serif;
  color: var(--ink);
}

/* Compact metadata row: shape chart + chips */
.sess-meta {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
}
.shape-wrap {
  display: inline-flex; align-items: center;
  margin-left: auto; opacity: 0.85;
}
.shape { display: block; }
.chip {
  display: inline-flex; align-items: center;
  padding: 3px 9px; border-radius: 999px;
  background: #FFF; border: 1px solid var(--line-2);
  font: 600 11px/1 ui-monospace, SFMono-Regular, monospace;
  color: var(--ink-2); white-space: nowrap;
}
.chip-dur { color: var(--ink); }
.chip-zone { color: var(--accent); border-color: rgba(111,79,31,0.32); background: #FBF4E5; }

.sess-body p { margin: 0; line-height: 1.5; }
.sess-body p.why {
  font: italic 400 13px/1.5 ui-serif, Georgia, "Times New Roman", serif;
  color: var(--ink-2);
}

.full { margin-top: 2px; }
.full > summary {
  cursor: pointer; font: 600 11px/1 ui-sans-serif, system-ui, sans-serif;
  color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.08em;
  padding: 4px 0; user-select: none;
}
.full > summary:hover { color: var(--accent); }
.full[open] > summary { color: var(--ink-2); }
.full p.main {
  margin-top: 8px; padding: 10px 12px; background: #FFF;
  border: 1px solid var(--line); border-radius: 6px;
  font-size: 13.5px; color: var(--ink);
}
.full p.ex {
  margin-top: 6px; font: 400 12px/1.5 ui-monospace, SFMono-Regular, monospace;
  color: var(--ink-2);
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
  .hero-overlay { padding: 16px 18px; }
  .phase-overview { padding: 14px 18px; }
  .page-main { padding: 18px 18px 32px; gap: 14px; }
  .sess { grid-template-columns: 64px 1fr; padding: 10px 12px; }
  .day-glyph { width: 48px; height: 32px; }
  .week-head { flex-direction: column; align-items: flex-start; gap: 8px; }
  .vol { align-self: flex-end; }
  .shape-wrap { margin-left: 0; }
}

/* Print */
@media print {
  body { background: #fff; }
  .hero { display: none; }
  .phase-overview { padding: 8px 20px; }
  .print-btn { display: none; }
  .phase-overview .bands { height: 40px; }
  .page-main { padding: 14px 20px; max-width: none; gap: 10px; }
  .week { break-inside: avoid; page-break-inside: avoid; box-shadow: none; }
  .sess { break-inside: avoid; page-break-inside: avoid; }
  .full { display: none; }
  .week-extras[open] summary, .week-extras p.note, .week-extras ul.dev { color: #444; }
  .band .bar, .phase-tag, .sess, .day-glyph, .chip-zone { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
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
  const html = renderHtml({ plan, profile, workouts });
  const outPath = join(OUTPUT_DIR, `plan-${timestamp}.html`);
  writeFileSync(outPath, html);
  console.log(`Wrote: ${outPath}`);
  console.log(`Size: ${(html.length / 1024).toFixed(1)} KB`);
}

main();
