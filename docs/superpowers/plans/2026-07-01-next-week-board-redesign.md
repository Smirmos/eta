# Next-week Board Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat, chronological next-week rendering with a discipline-grouped, full-detail, visually-consistent board in `apps/web`.

**Architecture:** Web-only. A new pure helper (`lib/nextWeekView.ts`) groups the generated workouts by discipline and derives a plain-language session-type label; a new component (`NextWeekBoard.tsx`) renders a week-summary header + Swim/Bike/Run sections with full per-session detail. `NextWeekPlan` swaps its `ok`-branch from `WeekCard` to `NextWeekBoard`. No backend, prompt, or shared-type change — all data is already in the `NextWeekResponse` payload.

**Tech Stack:** Vite 5 + React 18 + TypeScript, vitest + @testing-library/react (web has `globals: true` — bare `test`/`expect`/`vi`), `@eta/shared-types`.

## Global Constraints

- Discipline colors (reuse existing CSS vars): swim = `--cyan`, bike = `--volt`, run = `--amber`.
- Dark instrument-panel aesthetic; match the summary's `.panel` sections.
- Day-of-week scheduling is NOT displayed. Organize by discipline only.
- Full per-session detail always visible (no expanders).
- No backend / prompt / shared-type change.
- Web checks must end green: `pnpm --filter @eta/web test`, `pnpm --filter @eta/web lint` (`--max-warnings 0`), and `pnpm --filter @eta/web exec tsc -p tsconfig.json --noEmit` (vitest runs via swc and does NOT type-check).
- Discipline order everywhere: `swim, bike, run`.

---

### Task 1: `nextWeekView` pure helpers

**Files:**
- Create: `apps/web/src/lib/nextWeekView.ts`
- Test: `apps/web/src/lib/nextWeekView.test.ts`

**Interfaces:**
- Consumes: `PlannedWorkout`, `NextWeekFrame`, `Discipline` from `@eta/shared-types`.
- Produces:
  - `interface DisciplineGroup { discipline: Discipline; totalSeconds: number; sessionCount: number; sessions: PlannedWorkout[] }`
  - `groupByDiscipline(workouts: PlannedWorkout[]): DisciplineGroup[]` — order `swim, bike, run`; empty disciplines omitted.
  - `sessionType(workout: PlannedWorkout, frame: NextWeekFrame): string` — joins `workout.date` → `frame.days[]` by day index off `frame.weekStartDate`; falls back to `workout.workoutCode`.
  - `formatHours(totalSeconds: number): string` — e.g. `10800 → "3h"`, `9000 → "2.5h"`.

- [ ] **Step 1: Write the failing test**

```typescript
import { groupByDiscipline, sessionType, formatHours } from './nextWeekView.js';
import type { NextWeekFrame, PlannedWorkout } from '@eta/shared-types';

const wk = (over: Partial<PlannedWorkout>): PlannedWorkout => ({
  workoutCode: 'B/AE1', discipline: 'bike', date: '2026-07-06', totalDurationSeconds: 3600,
  segments: [], rationale: 'r', citation: 'c', ...over,
});

const frame = (): NextWeekFrame => ({
  weekStartDate: '2026-07-06', phase: 'build_1', isRecoveryWeek: false, targetVolumeHours: 12.5,
  days: [
    { dayOfWeek: 'mon', role: 'rest', disciplines: [], targetDurationMinutes: 0 },
    { dayOfWeek: 'tue', role: 'quality', disciplines: ['bike'], targetDurationMinutes: 75 },
    { dayOfWeek: 'wed', role: 'aerobic', disciplines: ['swim'], targetDurationMinutes: 60 },
    { dayOfWeek: 'thu', role: 'recovery', disciplines: ['run'], targetDurationMinutes: 40 },
    { dayOfWeek: 'fri', role: 'long', disciplines: ['run'], targetDurationMinutes: 90 },
    { dayOfWeek: 'sat', role: 'aerobic', disciplines: ['swim'], targetDurationMinutes: 60 },
    { dayOfWeek: 'sun', role: 'long', disciplines: ['bike'], targetDurationMinutes: 180 },
  ],
  rationale: { weeksUntilRace: 8, volumeAnchorHours: 11.6, rampPct: 0.08, easeTriggered: false },
});

test('groupByDiscipline orders swim,bike,run and omits empty disciplines', () => {
  const groups = groupByDiscipline([
    wk({ discipline: 'bike', totalDurationSeconds: 3600 }),
    wk({ discipline: 'swim', totalDurationSeconds: 1800 }),
    wk({ discipline: 'bike', totalDurationSeconds: 5400 }),
  ]);
  expect(groups.map((g) => g.discipline)).toEqual(['swim', 'bike']); // no run → omitted
  const bike = groups.find((g) => g.discipline === 'bike')!;
  expect(bike.sessionCount).toBe(2);
  expect(bike.totalSeconds).toBe(9000);
});

test('sessionType joins date to day role', () => {
  expect(sessionType(wk({ discipline: 'bike', date: '2026-07-12' }), frame())).toBe('Long ride'); // sun/long
  expect(sessionType(wk({ discipline: 'run', date: '2026-07-10' }), frame())).toBe('Long run'); // fri/long
  expect(sessionType(wk({ discipline: 'bike', date: '2026-07-07' }), frame())).toBe('Threshold / quality'); // tue/quality
  expect(sessionType(wk({ discipline: 'swim', date: '2026-07-08' }), frame())).toBe('Aerobic'); // wed/aerobic
  expect(sessionType(wk({ discipline: 'run', date: '2026-07-09' }), frame())).toBe('Recovery'); // thu/recovery
});

test('sessionType falls back to workoutCode when the date is off-week', () => {
  expect(sessionType(wk({ workoutCode: 'X/9', date: '2030-01-01' }), frame())).toBe('X/9');
});

test('formatHours renders whole and half hours', () => {
  expect(formatHours(10800)).toBe('3h');
  expect(formatHours(9000)).toBe('2.5h');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @eta/web test -- nextWeekView`
Expected: FAIL — `groupByDiscipline`/`sessionType`/`formatHours` not exported.

- [ ] **Step 3: Write minimal implementation**

```typescript
import type { Discipline, NextWeekFrame, PlannedWorkout } from '@eta/shared-types';

export interface DisciplineGroup {
  discipline: Discipline;
  totalSeconds: number;
  sessionCount: number;
  sessions: PlannedWorkout[];
}

const ORDER: Discipline[] = ['swim', 'bike', 'run'];
const LONG_NOUN: Record<Discipline, string> = { swim: 'Long swim', bike: 'Long ride', run: 'Long run' };
const MS_PER_DAY = 86_400_000;

export function groupByDiscipline(workouts: PlannedWorkout[]): DisciplineGroup[] {
  return ORDER.map((discipline) => {
    const sessions = workouts.filter((w) => w.discipline === discipline);
    return {
      discipline,
      sessions,
      sessionCount: sessions.length,
      totalSeconds: sessions.reduce((sum, w) => sum + w.totalDurationSeconds, 0),
    };
  }).filter((g) => g.sessionCount > 0);
}

export function sessionType(workout: PlannedWorkout, frame: NextWeekFrame): string {
  const index = Math.round((Date.parse(workout.date) - Date.parse(frame.weekStartDate)) / MS_PER_DAY);
  const day = index >= 0 && index < frame.days.length ? frame.days[index] : undefined;
  if (!day) return workout.workoutCode;
  switch (day.role) {
    case 'long': return LONG_NOUN[workout.discipline];
    case 'quality': return 'Threshold / quality';
    case 'aerobic': return 'Aerobic';
    case 'recovery': return 'Recovery';
    default: return workout.workoutCode; // 'rest' — no workout expected
  }
}

export function formatHours(totalSeconds: number): string {
  const rounded = Math.round((totalSeconds / 3600) * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}h`;
}
```

- [ ] **Step 4: Run test + typecheck + lint**

Run: `pnpm --filter @eta/web test -- nextWeekView && pnpm --filter @eta/web exec tsc -p tsconfig.json --noEmit`
Expected: tests PASS, tsc clean.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/nextWeekView.ts apps/web/src/lib/nextWeekView.test.ts
git commit -m "feat(web): nextWeekView helpers — discipline grouping + session type"
```

---

### Task 2: Extend the next-week fixture with multi-discipline workouts

**Files:**
- Modify: `apps/web/src/test/fixtures/next-week.fixture.ts`

**Interfaces:**
- Consumes: `NextWeekResponse` from `@eta/shared-types`.
- Produces: `makeNextWeekFixture()` now returns a week with 3 workouts (swim + bike + run) so grouping is exercisable by consumers.

Why: the current fixture has a single bike workout, so a discipline-grouped board can't be meaningfully asserted. The existing `NextWeekPlan.test.tsx` assertions (`/build_1/`, `/12\.5/`) remain valid after this change.

- [ ] **Step 1: Replace the `workouts` array**

Replace the single-element `workouts: [ ... ]` (fixture lines 21–31) with three workouts. Keep the existing `frame` and `weeklyDetail` wrapper fields unchanged:

```typescript
      workouts: [
        {
          workoutCode: 'B/TH1', discipline: 'swim', date: '2026-07-08', totalDurationSeconds: 3600,
          segments: [
            { label: 'Warmup', durationSeconds: 600, zone: 'z1', description: 'Easy swim + drills' },
            { label: 'Main set', durationSeconds: 2400, zone: 'z3', description: '8x100 at threshold' },
            { label: 'Cooldown', durationSeconds: 600, zone: 'z1', description: 'Easy swim' },
          ],
          rationale: 'Threshold swim to hold CSS pace.', citation: 'knowledge-base/03-workouts.md#b-th1',
        },
        {
          workoutCode: 'C/AE1', discipline: 'bike', date: '2026-07-12', totalDurationSeconds: 10800,
          segments: [
            { label: 'Warmup', durationSeconds: 600, zone: 'z1', description: 'Easy spin' },
            { label: 'Main', durationSeconds: 9600, zone: 'z2', description: 'Steady aerobic' },
            { label: 'Cooldown', durationSeconds: 600, zone: 'z1', description: 'Easy spin' },
          ],
          rationale: 'Long aerobic ride to build the bike base.', citation: 'knowledge-base/03-workouts.md#c-ae1',
        },
        {
          workoutCode: 'D/RE1', discipline: 'run', date: '2026-07-09', totalDurationSeconds: 2400,
          segments: [
            { label: 'Steady', durationSeconds: 2400, zone: 'z1', description: 'Easy conversational run' },
          ],
          rationale: 'Recovery run to flush the legs.', citation: 'knowledge-base/03-workouts.md#d-re1',
        },
      ],
```

- [ ] **Step 2: Run the existing suites to confirm nothing broke**

Run: `pnpm --filter @eta/web test`
Expected: PASS (the existing `NextWeekPlan` tests still find `build_1` and `12.5`).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/test/fixtures/next-week.fixture.ts
git commit -m "test(web): extend next-week fixture with swim/bike/run workouts"
```

---

### Task 3: `NextWeekBoard` component + rewire `NextWeekPlan`

**Files:**
- Create: `apps/web/src/components/NextWeekBoard.tsx`
- Modify: `apps/web/src/components/NextWeekPlan.tsx` (swap `ok`-branch render; remove `toPlanTreeWeek` + now-unused imports)
- Modify: `apps/web/src/components/NextWeekPlan.test.tsx` (assert the board)

**Interfaces:**
- Consumes: `groupByDiscipline`, `sessionType`, `formatHours`, `DisciplineGroup` from `../lib/nextWeekView.js`; `formatDuration` from `../lib/format.js`; `NextWeekFrame`, `WeeklyDetail` from `@eta/shared-types`.
- Produces: `NextWeekBoard({ frame, weeklyDetail }: { frame: NextWeekFrame; weeklyDetail: WeeklyDetail }): JSX.Element`.

- [ ] **Step 1: Write the failing test** (append to `NextWeekPlan.test.tsx`)

```typescript
test('renders discipline sections with totals, session type, segment description, and rationale', async () => {
  render(<NextWeekPlan fetchNextWeekImpl={ok} />);
  fireEvent.click(screen.getByRole('button', { name: /generate next week/i }));
  await waitFor(() => expect(screen.getByText(/build_1/i)).toBeInTheDocument());
  // discipline section headers
  expect(screen.getByText(/^swim$/i)).toBeInTheDocument();
  expect(screen.getByText(/^bike$/i)).toBeInTheDocument();
  expect(screen.getByText(/^run$/i)).toBeInTheDocument();
  // a derived session type label (bike long ride, sun)
  expect(screen.getByText(/long ride/i)).toBeInTheDocument();
  // a segment description surfaced (was dropped before)
  expect(screen.getByText(/8x100 at threshold/i)).toBeInTheDocument();
  // a per-session recommendation (rationale)
  expect(screen.getByText(/build the bike base/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @eta/web test -- NextWeekPlan`
Expected: FAIL — no discipline headers / descriptions in current `WeekCard` output.

- [ ] **Step 3: Create `NextWeekBoard.tsx`**

```tsx
import type { NextWeekFrame, PlannedWorkout, WeeklyDetail } from '@eta/shared-types';
import { formatDuration } from '../lib/format.js';
import { formatHours, groupByDiscipline, sessionType, type DisciplineGroup } from '../lib/nextWeekView.js';

const RAMP = (pct: number): string => `${pct >= 0 ? '+' : ''}${Math.round(pct * 100)}%`;

export function NextWeekBoard({
  frame,
  weeklyDetail,
}: {
  frame: NextWeekFrame;
  weeklyDetail: WeeklyDetail;
}): JSX.Element {
  const groups = groupByDiscipline(weeklyDetail.workouts);
  const totalSeconds = groups.reduce((sum, g) => sum + g.totalSeconds, 0) || 1;

  return (
    <div className="next-week-board">
      <header className="nwb-head panel">
        <div className="nwb-top">
          <span className="nwb-vol">~{frame.targetVolumeHours}h</span>
          <span className={`phase-tag phase-${frame.phase}`}>{frame.phase.replace('_', ' ')}</span>
          {frame.isRecoveryWeek ? <span className="recovery-tag">recovery</span> : null}
        </div>
        <div className="nwb-bar" role="presentation">
          {groups.map((g) => (
            <span
              key={g.discipline}
              className={`nwb-seg disc-${g.discipline}`}
              style={{ width: `${(g.totalSeconds / totalSeconds) * 100}%` }}
            />
          ))}
        </div>
        <p className="nwb-why">
          {RAMP(frame.rationale.rampPct)} on your {frame.rationale.volumeAnchorHours}h recent average ·{' '}
          {frame.rationale.weeksUntilRace} weeks to race
          {frame.rationale.easeTriggered ? ' · auto-eased' : ''}
        </p>
      </header>

      {weeklyDetail.globalNotes ? <p className="nwb-notes">{weeklyDetail.globalNotes}</p> : null}

      {groups.map((g) => (
        <DisciplineSection key={g.discipline} group={g} frame={frame} />
      ))}
    </div>
  );
}

function DisciplineSection({ group, frame }: { group: DisciplineGroup; frame: NextWeekFrame }): JSX.Element {
  return (
    <section className={`nwb-disc panel disc-${group.discipline}`}>
      <header className="nwb-disc-head">
        <span className="nwb-disc-name">{group.discipline}</span>
        <span className="nwb-disc-total">
          {formatHours(group.totalSeconds)} · {group.sessionCount} session{group.sessionCount === 1 ? '' : 's'}
        </span>
      </header>
      {group.sessions.map((w, i) => (
        <SessionRow key={`${w.workoutCode}-${w.date}-${i}`} workout={w} frame={frame} />
      ))}
    </section>
  );
}

function SessionRow({ workout, frame }: { workout: PlannedWorkout; frame: NextWeekFrame }): JSX.Element {
  return (
    <article className="nwb-session">
      <div className="nwb-session-head">
        <span className="nwb-type">{sessionType(workout, frame)}</span>
        <span className="nwb-dur">{formatDuration(workout.totalDurationSeconds)}</span>
        <code className="nwb-code">{workout.workoutCode}</code>
      </div>
      {workout.segments.length > 0 ? (
        <ul className="nwb-segments">
          {workout.segments.map((s, i) => (
            <li key={`${s.label}-${i}`} className="nwb-segment">
              <span className="nwb-seg-label">{s.label}</span>
              <span className="nwb-seg-dur">{formatDuration(s.durationSeconds)}</span>
              <span className={`nwb-seg-zone zone-${s.zone}`}>{s.zone}</span>
              <span className="nwb-seg-desc">{s.description}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="nwb-rationale">↳ {workout.rationale}</p>
    </article>
  );
}
```

- [ ] **Step 4: Rewire `NextWeekPlan.tsx`**

Replace the imports and the `ok`-branch. Remove the `WeekCard` import, the `MacroPlanWeek` import, and the whole `toPlanTreeWeek` function. New top of file:

```tsx
import { useCallback, useState } from 'react';
import { fetchNextWeek, type NextWeekResult } from '../api/next-week.js';
import { NextWeekBoard } from './NextWeekBoard.js';
```

Replace the final `return (...)` inside `renderResult` (the `<> <p className="next-week-why">…</p> <WeekCard …/> </>` block) with:

```tsx
    return <NextWeekBoard frame={r.frame} weeklyDetail={r.weeklyDetail} />;
```

Leave the `idle`/`loading`/`error`/`needs_profile`/`needs_history` handling and the `RAMP` usage that moved into `NextWeekBoard` — delete the now-unused `RAMP` const from `NextWeekPlan.tsx` if it remains.

- [ ] **Step 5: Run tests + typecheck + lint**

Run: `pnpm --filter @eta/web test -- NextWeekPlan && pnpm --filter @eta/web exec tsc -p tsconfig.json --noEmit && pnpm --filter @eta/web lint`
Expected: tests PASS, tsc clean, lint 0 (no unused `WeekCard`/`MacroPlanWeek`/`toPlanTreeWeek`/`RAMP`).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/NextWeekBoard.tsx apps/web/src/components/NextWeekPlan.tsx apps/web/src/components/NextWeekPlan.test.tsx
git commit -m "feat(web): discipline-grouped NextWeekBoard replaces WeekCard in next-week section"
```

---

### Task 4: Styling — `.next-week-board` block

**Files:**
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Consumes: existing CSS vars `--cyan`, `--volt`, `--amber`, `--volt-glow`, and the existing `.panel` / `.phase-tag` / `.recovery-tag` rules.
- Produces: styles for `.next-week-board`, `.nwb-*`, `.disc-swim|bike|run` (bar segment + section accent), `.zone-*` chips. No test — visual verification.

- [ ] **Step 1: Add the style block**

Append to `styles.css` (near the existing `.next-week` rules; remove the now-unused `.next-week-why` rule if present):

```css
/* ── Next-week board ─────────────────────────────────────────── */
.next-week-board { display: flex; flex-direction: column; gap: 16px; margin-top: 16px; }

.nwb-head { display: flex; flex-direction: column; gap: 10px; }
.nwb-top { display: flex; align-items: center; gap: 10px; }
.nwb-vol { font-family: 'Bebas Neue', sans-serif; font-size: 2rem; color: var(--volt); line-height: 1; }
.nwb-bar { display: flex; height: 8px; border-radius: 4px; overflow: hidden; background: rgba(255,255,255,0.06); }
.nwb-seg { height: 100%; }
.nwb-seg.disc-swim { background: var(--cyan); }
.nwb-seg.disc-bike { background: var(--volt); }
.nwb-seg.disc-run  { background: var(--amber); }
.nwb-why { margin: 0; font-size: 0.8rem; color: rgba(255,255,255,0.6); }
.nwb-notes { margin: 0; padding: 12px 14px; border-left: 3px solid var(--volt); background: var(--volt-glow); border-radius: 6px; font-size: 0.9rem; }

.nwb-disc { display: flex; flex-direction: column; gap: 10px; }
.nwb-disc.disc-swim { border-left: 3px solid var(--cyan); }
.nwb-disc.disc-bike { border-left: 3px solid var(--volt); }
.nwb-disc.disc-run  { border-left: 3px solid var(--amber); }
.nwb-disc-head { display: flex; justify-content: space-between; align-items: baseline; }
.nwb-disc-name { font-family: 'Bebas Neue', sans-serif; font-size: 1.3rem; letter-spacing: 0.06em; text-transform: uppercase; }
.nwb-disc.disc-swim .nwb-disc-name { color: var(--cyan); }
.nwb-disc.disc-bike .nwb-disc-name { color: var(--volt); }
.nwb-disc.disc-run  .nwb-disc-name { color: var(--amber); }
.nwb-disc-total { font-size: 0.8rem; color: rgba(255,255,255,0.6); }

.nwb-session { padding: 10px 0; border-top: 1px solid rgba(255,255,255,0.06); }
.nwb-session:first-of-type { border-top: none; }
.nwb-session-head { display: flex; align-items: center; gap: 10px; }
.nwb-type { font-weight: 600; }
.nwb-dur { color: rgba(255,255,255,0.7); font-size: 0.85rem; }
.nwb-code { margin-left: auto; font-size: 0.72rem; color: rgba(255,255,255,0.4); background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; }

.nwb-segments { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.nwb-segment { display: grid; grid-template-columns: 1fr auto auto; gap: 8px; align-items: baseline; font-size: 0.82rem; }
.nwb-seg-label { color: rgba(255,255,255,0.85); }
.nwb-seg-dur { color: rgba(255,255,255,0.55); }
.nwb-seg-zone { font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.04em; color: rgba(255,255,255,0.6); background: rgba(255,255,255,0.06); padding: 1px 5px; border-radius: 3px; }
.nwb-seg-desc { grid-column: 1 / -1; color: rgba(255,255,255,0.5); font-size: 0.78rem; }
.nwb-rationale { margin: 8px 0 0; font-size: 0.82rem; color: rgba(255,255,255,0.65); font-style: italic; }
```

- [ ] **Step 2: Verify build + full web suite**

Run: `pnpm --filter @eta/web exec tsc -p tsconfig.json --noEmit && pnpm --filter @eta/web lint && pnpm --filter @eta/web test && pnpm --filter @eta/web build`
Expected: all green.

- [ ] **Step 3: Live visual check**

Run api + web (`pnpm dev:api`, `pnpm dev:web`; Docker/Postgres up), open the ETA tab, click **Generate next week**, confirm: discipline-colored split bar, Swim/Bike/Run sections with totals, per-session type + duration + segments (with descriptions + zone chips) + rationale, and the week recommendation line. (Requires Anthropic API credits for the live generator; the error panel is the graceful fallback.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/styles.css
git commit -m "style(web): instrument-panel styling for the next-week board"
```

---

## Self-Review

- **Spec coverage:** discipline grouping (Task 1/3), session type label from role (Task 1), full detail incl. segment descriptions (Task 3), per-session + week-level recommendations (Task 3), volume totals + split bar (Task 1/3/4), discipline colors + panel aesthetic (Task 4), no backend change (whole plan), old `WeekCard` untouched (Task 3 swaps caller only). ✓
- **Placeholder scan:** none — every code/CSS step is complete.
- **Type consistency:** `DisciplineGroup`, `groupByDiscipline`, `sessionType`, `formatHours` signatures match between Task 1 (definition) and Task 3 (consumption); `NextWeekBoard({ frame, weeklyDetail })` prop shape matches the `NextWeekPlan` call site. ✓
