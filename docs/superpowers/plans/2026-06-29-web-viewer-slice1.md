# Web Viewer — Slice 1 (Live Plan Viewer) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Vite + React app at `apps/web` that fetches `GET /plans/me` and renders the full `PlanTree` (macro overview, per-week workouts, current adaptation) live, with loading / error / empty / loaded states.

**Architecture:** New `apps/web` pnpm workspace, Vite + React + TypeScript. A Vite dev proxy forwards `/api/*` to the Nest API (default `localhost:3000`), so no CORS or backend change is needed. The client imports payload types from `@eta/shared-types`, defines a thin client-side `PlanTree` envelope, and validates the macro plan with the shared `macroPlanSchema`. Presentational components are pure functions of props; one `App` component owns the fetch and the four-state machine.

**Tech Stack:** Vite 5, React 18, TypeScript 5.6, Vitest 2.1, @testing-library/react, jsdom, `@eta/shared-types` (workspace), zod (transitive via shared-types).

## Global Constraints

- TypeScript strict mode, `noUncheckedIndexedAccess: true` (inherited from `tsconfig.base.json`) — copied verbatim from repo config. Index access may be `undefined`; guard it.
- ESM only (`"type": "module"`), NodeNext-style imports where applicable.
- No changes to `apps/api/` source. Slice 1 is frontend-only.
- Single-user: the app always calls `/api/plans/me` (server resolves `DEV_USER_ID`). No user/auth concept in the client.
- Dates in the `PlanTree` payload arrive as JSON **strings** over HTTP (not `Date`). Client types use `string` for all date fields; no `Date` conversion.
- Package name: `@eta/web`. Lint must pass with `--max-warnings 0` (repo convention).

---

### Task 1: Scaffold the `apps/web` workspace

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx` (placeholder, replaced in Task 6)
- Create: `apps/web/src/test-setup.ts`
- Create: `apps/web/src/smoke.test.tsx`
- Modify: root `package.json` (add `dev:web` script)

**Interfaces:**
- Produces: a runnable Vite app and a passing Vitest+RTL setup that later tasks extend. Exports nothing consumed by other tasks except the working toolchain.

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "@eta/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -p tsconfig.json --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run --passWithNoTests",
    "lint": "eslint \"src/**/*.{ts,tsx}\" --max-warnings 0",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@eta/shared-types": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.3",
    "jsdom": "^25.0.1",
    "typescript": "^5.6.3",
    "vite": "^5.4.10",
    "vitest": "^2.1.5"
  }
}
```

- [ ] **Step 2: Create `apps/web/tsconfig.json`**

React/Vite need DOM libs and bundler resolution, which differ from the Node base config — so override `module`/`moduleResolution`/`lib` rather than extend them.

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "noEmit": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"],
    "declaration": false,
    "declarationMap": false,
    "incremental": false
  },
  "include": ["src", "vite.config.ts"]
}
```

- [ ] **Step 3: Create `apps/web/vite.config.ts`** (dev proxy + test config)

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_PORT = process.env.PORT ?? '3000';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${API_PORT}`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});
```

Note: target is `127.0.0.1` (IPv4) — `localhost` resolves to IPv6 on this machine where an unrelated app sits; the Nest API binds IPv4 `*:3000`.

- [ ] **Step 4: Create `apps/web/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ETA — Training Plan</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `apps/web/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 6: Create `apps/web/src/App.tsx`** (placeholder — replaced in Task 6)

```tsx
export function App(): JSX.Element {
  return <h1>ETA</h1>;
}
```

- [ ] **Step 7: Create `apps/web/src/test-setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 8: Create `apps/web/src/smoke.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { App } from './App.js';

test('App renders a heading', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: 'ETA' })).toBeInTheDocument();
});
```

- [ ] **Step 9: Add `dev:web` to root `package.json` scripts**

Add this line to the `"scripts"` object in root `package.json`:

```json
    "dev:web": "pnpm --filter @eta/web dev",
```

- [ ] **Step 10: Install and verify the toolchain**

Run: `pnpm install`
Expected: installs `@eta/web` deps, links `@eta/shared-types` via `workspace:*`.

- [ ] **Step 11: Run the smoke test**

Run: `pnpm --filter @eta/web test`
Expected: PASS — `App renders a heading`.

- [ ] **Step 12: Verify typecheck and lint pass**

Run: `pnpm --filter @eta/web typecheck && pnpm --filter @eta/web lint`
Expected: no errors. (If eslint config does not yet cover `apps/web`, the root flat/`.eslintrc` already globs `{apps,packages}/**/*.{ts,tsx}` — confirm `apps/web/src` is included; if not, this is the place to widen the glob.)

- [ ] **Step 13: Commit**

```bash
git add apps/web package.json pnpm-lock.yaml
git commit -m "feat(web): scaffold apps/web Vite+React workspace"
```

---

### Task 2: Client `PlanTree` type, fixture, and `fetchPlanTree()` wrapper

**Files:**
- Create: `apps/web/src/api/plan-tree.types.ts`
- Create: `apps/web/src/api/fetch-plan-tree.ts`
- Create: `apps/web/src/test/fixtures/plan-tree.fixture.ts`
- Test: `apps/web/src/api/fetch-plan-tree.test.ts`

**Interfaces:**
- Produces:
  - Types `PlanTree`, `PlanTreeWeek` (see Step 1) — consumed by every component task.
  - `makePlanTreeFixture(overrides?: Partial<PlanTree>): PlanTree` — a representative fixture used by all component tests.
  - `type FetchResult = { status: 'ok'; tree: PlanTree } | { status: 'empty' } | { status: 'error'; message: string }`
  - `async function fetchPlanTree(fetchImpl?: typeof fetch): Promise<FetchResult>` — GETs `/api/plans/me`, validates the macro plan with `macroPlanSchema`, maps 404 → `empty`, any failure → `error`.

- [ ] **Step 1: Create `apps/web/src/api/plan-tree.types.ts`**

```ts
import type {
  AdaptationSuggestion,
  MacroPlan,
  MacroPlanWeek,
  WeeklyDetail,
} from '@eta/shared-types';

export interface PlanTreeWeek {
  weekNumber: number;
  macroWeek: MacroPlanWeek;
  weeklyDetail: WeeklyDetail | null;
}

export interface PlanTree {
  macroPlanId: string;
  athleteProfileId: string;
  macroPlan: MacroPlan;
  /** ISO date-time string as received over HTTP. */
  generatedAt: string;
  weeks: PlanTreeWeek[];
  currentAdaptation: AdaptationSuggestion | null;
}
```

- [ ] **Step 2: Create the fixture `apps/web/src/test/fixtures/plan-tree.fixture.ts`**

Build a minimal but schema-valid `PlanTree`: a 2-week macro plan where week 1 has a Pass 2 detail (one workout, one segment) and week 2 does not, plus a `currentAdaptation` with one adjustment. Import the real types so the compiler enforces shape. (If a field below does not match the current `@eta/shared-types` definition, fix the fixture to match the type — the type is the source of truth.)

```ts
import type { PlanTree } from '../../api/plan-tree.types.js';

const baseTree: PlanTree = {
  macroPlanId: 'plan-1',
  athleteProfileId: 'profile-1',
  generatedAt: '2026-06-29T00:00:00.000Z',
  macroPlan: {
    raceDate: '2026-07-13',
    raceType: 'full_ironman',
    weeks: [
      {
        weekNumber: 2,
        weekStartDate: '2026-06-29',
        phase: 'base_3',
        weeklyVolumeHours: 9,
        isRecoveryWeek: false,
      },
      {
        weekNumber: 1,
        weekStartDate: '2026-07-06',
        phase: 'peak',
        weeklyVolumeHours: 6,
        isRecoveryWeek: true,
      },
    ],
  } as PlanTree['macroPlan'],
  weeks: [
    {
      weekNumber: 2,
      macroWeek: {
        weekNumber: 2,
        weekStartDate: '2026-06-29',
        phase: 'base_3',
        weeklyVolumeHours: 9,
        isRecoveryWeek: false,
      } as PlanTree['weeks'][number]['macroWeek'],
      weeklyDetail: {
        workouts: [
          {
            workoutCode: 'B-E2',
            discipline: 'bike',
            date: '2026-06-30',
            totalDurationSeconds: 3600,
            segments: [{ label: 'main', durationSeconds: 3600, zone: 'Z2' }],
            rationale: 'aerobic base',
            citation: 'KB p.1',
          },
        ],
      } as PlanTree['weeks'][number]['weeklyDetail'],
    },
    {
      weekNumber: 1,
      macroWeek: {
        weekNumber: 1,
        weekStartDate: '2026-07-06',
        phase: 'peak',
        weeklyVolumeHours: 6,
        isRecoveryWeek: true,
      } as PlanTree['weeks'][number]['macroWeek'],
      weeklyDetail: null,
    },
  ],
  currentAdaptation: {
    forWeekStart: '2026-06-29',
    generatedAt: '2026-06-29T00:00:00.000Z',
    weekLevelNote: 'Ease into the block.',
    adjustments: [
      {
        action: 'modify',
        originalWorkoutCode: 'B-E2',
        originalDate: '2026-06-30',
        newDurationSeconds: 3000,
        reasoning: 'reduce load',
        citation: 'KB p.2',
      },
    ],
  } as PlanTree['currentAdaptation'],
};

export function makePlanTreeFixture(overrides: Partial<PlanTree> = {}): PlanTree {
  return { ...structuredClone(baseTree), ...overrides };
}
```

- [ ] **Step 3: Write the failing test `apps/web/src/api/fetch-plan-tree.test.ts`**

```ts
import { makePlanTreeFixture } from '../test/fixtures/plan-tree.fixture.js';
import { fetchPlanTree } from './fetch-plan-tree.js';

function fakeFetch(response: Partial<Response> & { jsonBody?: unknown }): typeof fetch {
  return (async () =>
    ({
      ok: response.ok ?? true,
      status: response.status ?? 200,
      json: async () => response.jsonBody,
    }) as Response) as unknown as typeof fetch;
}

test('returns ok with the tree on 200', async () => {
  const tree = makePlanTreeFixture();
  const result = await fetchPlanTree(fakeFetch({ ok: true, status: 200, jsonBody: tree }));
  expect(result.status).toBe('ok');
  if (result.status === 'ok') expect(result.tree.macroPlanId).toBe('plan-1');
});

test('returns empty on 404', async () => {
  const result = await fetchPlanTree(
    fakeFetch({ ok: false, status: 404, jsonBody: { error: 'no_plan_for_user' } }),
  );
  expect(result.status).toBe('empty');
});

test('returns error when the macro plan fails schema validation', async () => {
  const bad = makePlanTreeFixture({ macroPlan: { raceDate: 123 } as never });
  const result = await fetchPlanTree(fakeFetch({ ok: true, status: 200, jsonBody: bad }));
  expect(result.status).toBe('error');
});

test('returns error on network failure', async () => {
  const throwing = (async () => {
    throw new Error('network down');
  }) as unknown as typeof fetch;
  const result = await fetchPlanTree(throwing);
  expect(result.status).toBe('error');
  if (result.status === 'error') expect(result.message).toContain('network down');
});
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `pnpm --filter @eta/web test fetch-plan-tree`
Expected: FAIL — `fetch-plan-tree.js` does not export `fetchPlanTree`.

- [ ] **Step 5: Implement `apps/web/src/api/fetch-plan-tree.ts`**

```ts
import { macroPlanSchema } from '@eta/shared-types';
import type { PlanTree } from './plan-tree.types.js';

export type FetchResult =
  | { status: 'ok'; tree: PlanTree }
  | { status: 'empty' }
  | { status: 'error'; message: string };

export async function fetchPlanTree(fetchImpl: typeof fetch = fetch): Promise<FetchResult> {
  try {
    const res = await fetchImpl('/api/plans/me', {
      headers: { accept: 'application/json' },
    });
    if (res.status === 404) return { status: 'empty' };
    if (!res.ok) return { status: 'error', message: `HTTP ${res.status}` };

    const body = (await res.json()) as PlanTree;
    const parsed = macroPlanSchema.safeParse(body.macroPlan);
    if (!parsed.success) {
      return { status: 'error', message: `Invalid macro plan: ${parsed.error.message}` };
    }
    if (typeof body.macroPlanId !== 'string' || !Array.isArray(body.weeks)) {
      return { status: 'error', message: 'Malformed PlanTree envelope' };
    }
    return { status: 'ok', tree: body };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter @eta/web test fetch-plan-tree`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/api apps/web/src/test
git commit -m "feat(web): PlanTree client type, fixture, and fetchPlanTree wrapper"
```

---

### Task 3: `PlanHeader` and `AdaptationCard` components

**Files:**
- Create: `apps/web/src/components/PlanHeader.tsx`
- Create: `apps/web/src/components/AdaptationCard.tsx`
- Test: `apps/web/src/components/PlanHeader.test.tsx`
- Test: `apps/web/src/components/AdaptationCard.test.tsx`

**Interfaces:**
- Consumes: `PlanTree` from `../api/plan-tree.types.js`; `makePlanTreeFixture` in tests.
- Produces:
  - `PlanHeader({ tree }: { tree: PlanTree })`
  - `AdaptationCard({ adaptation }: { adaptation: PlanTree['currentAdaptation'] })` — renders nothing when `adaptation` is null.

- [ ] **Step 1: Write the failing test `PlanHeader.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { makePlanTreeFixture } from '../test/fixtures/plan-tree.fixture.js';
import { PlanHeader } from './PlanHeader.js';

test('shows race date and plan id', () => {
  render(<PlanHeader tree={makePlanTreeFixture()} />);
  expect(screen.getByText('2026-07-13')).toBeInTheDocument();
  expect(screen.getByText('plan-1')).toBeInTheDocument();
});
```

Note: `MacroPlan` has no `raceType` field (it lives on `AthleteProfile`, which the
`PlanTree` does not carry), so the header shows race date, week count, and plan ID only.

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @eta/web test PlanHeader`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `PlanHeader.tsx`**

```tsx
import type { PlanTree } from '../api/plan-tree.types.js';

export function PlanHeader({ tree }: { tree: PlanTree }): JSX.Element {
  const { macroPlan, macroPlanId } = tree;
  return (
    <header className="plan-header">
      <h1>Training plan</h1>
      <dl className="plan-meta">
        <div>
          <dt>Race date</dt>
          <dd>{macroPlan.raceDate}</dd>
        </div>
        <div>
          <dt>Weeks</dt>
          <dd>{tree.weeks.length}</dd>
        </div>
        <div>
          <dt>Plan ID</dt>
          <dd>
            <code>{macroPlanId}</code>
          </dd>
        </div>
      </dl>
    </header>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @eta/web test PlanHeader`
Expected: PASS.

- [ ] **Step 5: Write the failing tests `AdaptationCard.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { makePlanTreeFixture } from '../test/fixtures/plan-tree.fixture.js';
import { AdaptationCard } from './AdaptationCard.js';

test('renders adjustments with reasoning', () => {
  const { currentAdaptation } = makePlanTreeFixture();
  render(<AdaptationCard adaptation={currentAdaptation} />);
  expect(screen.getByText(/reduce load/i)).toBeInTheDocument();
  expect(screen.getByText('modify')).toBeInTheDocument();
});

test('renders nothing when adaptation is null', () => {
  const { container } = render(<AdaptationCard adaptation={null} />);
  expect(container).toBeEmptyDOMElement();
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm --filter @eta/web test AdaptationCard`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement `AdaptationCard.tsx`**

```tsx
import type { PlanTree } from '../api/plan-tree.types.js';

export function AdaptationCard({
  adaptation,
}: {
  adaptation: PlanTree['currentAdaptation'];
}): JSX.Element | null {
  if (!adaptation) return null;
  return (
    <section className="adaptation-card">
      <h2>This week’s adjustments</h2>
      <p className="for-week">For week starting {adaptation.forWeekStart}</p>
      {adaptation.weekLevelNote ? <p className="week-note">{adaptation.weekLevelNote}</p> : null}
      <ul className="adjustments">
        {adaptation.adjustments.map((adj, i) => (
          <li key={`${adj.originalWorkoutCode}-${adj.originalDate}-${i}`} className={`adj a-${adj.action}`}>
            <div className="adj-head">
              <span className="action">{adj.action}</span>
              <code>{adj.originalWorkoutCode}</code>
              <span className="date">{adj.originalDate}</span>
            </div>
            <p className="reasoning">{adj.reasoning}</p>
            <p className="citation">{adj.citation}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `pnpm --filter @eta/web test AdaptationCard`
Expected: PASS (2 tests).

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/PlanHeader.tsx apps/web/src/components/PlanHeader.test.tsx apps/web/src/components/AdaptationCard.tsx apps/web/src/components/AdaptationCard.test.tsx
git commit -m "feat(web): PlanHeader and AdaptationCard components"
```

---

### Task 4: Workout rendering — `SegmentRow`, `WorkoutCard`, `WeekCard`

**Files:**
- Create: `apps/web/src/components/SegmentRow.tsx`
- Create: `apps/web/src/components/WorkoutCard.tsx`
- Create: `apps/web/src/components/WeekCard.tsx`
- Create: `apps/web/src/lib/format.ts`
- Test: `apps/web/src/components/WeekCard.test.tsx`
- Test: `apps/web/src/lib/format.test.ts`

**Interfaces:**
- Consumes: `PlanTreeWeek` from `../api/plan-tree.types.js`; `PlannedWorkout`, `WorkoutSegment` from `@eta/shared-types`.
- Produces:
  - `formatDuration(seconds: number): string` in `lib/format.ts`
  - `SegmentRow({ segment }: { segment: WorkoutSegment })`
  - `WorkoutCard({ workout }: { workout: PlannedWorkout })`
  - `WeekCard({ week, isCurrent }: { week: PlanTreeWeek; isCurrent: boolean })` — renders the macro-week header, then either workouts or a "no detail yet" placeholder. The article has `id={`week-${week.weekNumber}`}` for scroll targeting (Task 5).

- [ ] **Step 1: Write the failing test `lib/format.test.ts`**

```ts
import { formatDuration } from './format.js';

test('formats hours and minutes', () => {
  expect(formatDuration(3600)).toBe('1h');
  expect(formatDuration(3900)).toBe('1h 5m');
  expect(formatDuration(1800)).toBe('30m');
  expect(formatDuration(0)).toBe('0m');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @eta/web test format`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/format.ts`**

```ts
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0m';
  const totalMin = Math.round(seconds / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin - h * 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @eta/web test format`
Expected: PASS.

- [ ] **Step 5: Implement `SegmentRow.tsx`**

```tsx
import type { WorkoutSegment } from '@eta/shared-types';
import { formatDuration } from '../lib/format.js';

export function SegmentRow({ segment }: { segment: WorkoutSegment }): JSX.Element {
  return (
    <li className="segment">
      <span className="seg-label">{segment.label}</span>
      <span className="seg-dur">{formatDuration(segment.durationSeconds)}</span>
      <span className="seg-zone">{segment.zone}</span>
    </li>
  );
}
```

- [ ] **Step 6: Implement `WorkoutCard.tsx`**

```tsx
import type { PlannedWorkout } from '@eta/shared-types';
import { formatDuration } from '../lib/format.js';
import { SegmentRow } from './SegmentRow.js';

export function WorkoutCard({ workout }: { workout: PlannedWorkout }): JSX.Element {
  return (
    <div className="workout">
      <div className="wkt-head">
        <code className="code">{workout.workoutCode}</code>
        <span className="disc">{workout.discipline}</span>
        <span className="date">{workout.date}</span>
        <span className="dur">{formatDuration(workout.totalDurationSeconds)}</span>
      </div>
      {workout.segments.length > 0 ? (
        <ul className="segments">
          {workout.segments.map((s, i) => (
            <SegmentRow key={`${s.label}-${i}`} segment={s} />
          ))}
        </ul>
      ) : null}
      <p className="rationale">{workout.rationale}</p>
      <p className="citation">{workout.citation}</p>
    </div>
  );
}
```

- [ ] **Step 7: Implement `WeekCard.tsx`**

```tsx
import type { PlanTreeWeek } from '../api/plan-tree.types.js';
import { WorkoutCard } from './WorkoutCard.js';

export function WeekCard({
  week,
  isCurrent,
}: {
  week: PlanTreeWeek;
  isCurrent: boolean;
}): JSX.Element {
  const mw = week.macroWeek;
  return (
    <article id={`week-${week.weekNumber}`} className={`week-card${isCurrent ? ' current' : ''}`}>
      <header className="week-head">
        <span className="wn">week {week.weekNumber}</span>
        <span className="wstart">{mw.weekStartDate}</span>
        <span className="phase">{mw.phase}</span>
        <span className="vol">{mw.weeklyVolumeHours}h</span>
        {mw.isRecoveryWeek ? <span className="badge recovery">recovery</span> : null}
      </header>
      {week.weeklyDetail ? (
        <div className="workouts">
          {week.weeklyDetail.workouts.map((w, i) => (
            <WorkoutCard key={`${w.workoutCode}-${w.date}-${i}`} workout={w} />
          ))}
        </div>
      ) : (
        <p className="placeholder">No detailed workouts generated for this week yet.</p>
      )}
    </article>
  );
}
```

- [ ] **Step 8: Write the failing test `WeekCard.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { makePlanTreeFixture } from '../test/fixtures/plan-tree.fixture.js';
import { WeekCard } from './WeekCard.js';

test('renders workouts when a detail exists', () => {
  const week = makePlanTreeFixture().weeks[0]!;
  render(<WeekCard week={week} isCurrent={true} />);
  expect(screen.getByText('B-E2')).toBeInTheDocument();
  expect(screen.getByText(/aerobic base/)).toBeInTheDocument();
});

test('renders a placeholder when no detail exists', () => {
  const week = makePlanTreeFixture().weeks[1]!;
  render(<WeekCard week={week} isCurrent={false} />);
  expect(screen.getByText(/No detailed workouts/)).toBeInTheDocument();
});
```

- [ ] **Step 9: Run to verify it passes**

Run: `pnpm --filter @eta/web test WeekCard`
Expected: PASS (2 tests).

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/components/SegmentRow.tsx apps/web/src/components/WorkoutCard.tsx apps/web/src/components/WeekCard.tsx apps/web/src/components/WeekCard.test.tsx apps/web/src/lib
git commit -m "feat(web): SegmentRow, WorkoutCard, WeekCard, duration formatter"
```

---

### Task 5: `WeekOverview` component + current-week helper

**Files:**
- Create: `apps/web/src/lib/current-week.ts`
- Create: `apps/web/src/components/WeekOverview.tsx`
- Test: `apps/web/src/lib/current-week.test.ts`
- Test: `apps/web/src/components/WeekOverview.test.tsx`

**Interfaces:**
- Consumes: `PlanTreeWeek` from `../api/plan-tree.types.js`.
- Produces:
  - `indexOfCurrentWeek(weeks: PlanTreeWeek[], today: Date): number` in `lib/current-week.ts` — index of the week whose `[start, start+7d)` (UTC) contains `today`, else the last index, else `-1` for empty.
  - `WeekOverview({ weeks, currentIndex }: { weeks: PlanTreeWeek[]; currentIndex: number })` — a list; each row is a link to `#week-<weekNumber>`; the current row gets `aria-current="true"` and class `current`.

- [ ] **Step 1: Write the failing test `lib/current-week.test.ts`**

```ts
import { makePlanTreeFixture } from '../test/fixtures/plan-tree.fixture.js';
import { indexOfCurrentWeek } from './current-week.js';

const weeks = makePlanTreeFixture().weeks;

test('finds the week containing today', () => {
  expect(indexOfCurrentWeek(weeks, new Date('2026-06-30T12:00:00Z'))).toBe(0);
  expect(indexOfCurrentWeek(weeks, new Date('2026-07-07T00:00:00Z'))).toBe(1);
});

test('returns the last index when today is past the plan', () => {
  expect(indexOfCurrentWeek(weeks, new Date('2026-09-01T00:00:00Z'))).toBe(1);
});

test('returns -1 for an empty plan', () => {
  expect(indexOfCurrentWeek([], new Date('2026-06-30T00:00:00Z'))).toBe(-1);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @eta/web test current-week`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/current-week.ts`**

```ts
import type { PlanTreeWeek } from '../api/plan-tree.types.js';

export function indexOfCurrentWeek(weeks: PlanTreeWeek[], today: Date): number {
  if (weeks.length === 0) return -1;
  const todayMs = Date.parse(`${today.toISOString().slice(0, 10)}T00:00:00Z`);
  for (let i = 0; i < weeks.length; i++) {
    const w = weeks[i]!;
    const startMs = Date.parse(`${w.macroWeek.weekStartDate}T00:00:00Z`);
    if (todayMs >= startMs && todayMs < startMs + 7 * 86_400_000) return i;
  }
  return weeks.length - 1;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @eta/web test current-week`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the failing test `WeekOverview.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { makePlanTreeFixture } from '../test/fixtures/plan-tree.fixture.js';
import { WeekOverview } from './WeekOverview.js';

test('lists weeks and marks the current one', () => {
  const weeks = makePlanTreeFixture().weeks;
  render(<WeekOverview weeks={weeks} currentIndex={0} />);
  const links = screen.getAllByRole('link');
  expect(links).toHaveLength(2);
  expect(links[0]).toHaveAttribute('href', '#week-2');
  expect(links[0]).toHaveAttribute('aria-current', 'true');
});
```

- [ ] **Step 6: Run to verify it fails**

Run: `pnpm --filter @eta/web test WeekOverview`
Expected: FAIL — module not found.

- [ ] **Step 7: Implement `WeekOverview.tsx`**

```tsx
import type { PlanTreeWeek } from '../api/plan-tree.types.js';

export function WeekOverview({
  weeks,
  currentIndex,
}: {
  weeks: PlanTreeWeek[];
  currentIndex: number;
}): JSX.Element {
  return (
    <nav className="week-overview" aria-label="Weeks">
      <h2>Overview</h2>
      <ul>
        {weeks.map((w, i) => (
          <li key={w.weekNumber} className={i === currentIndex ? 'current' : undefined}>
            <a
              href={`#week-${w.weekNumber}`}
              aria-current={i === currentIndex ? 'true' : undefined}
            >
              <span className="wnum">week {w.weekNumber}</span>
              <span className="phase">{w.macroWeek.phase}</span>
              <span className="vol">{w.macroWeek.weeklyVolumeHours}h</span>
              {w.macroWeek.isRecoveryWeek ? <span className="badge recovery">recovery</span> : null}
              {w.weeklyDetail ? <span className="badge detail">P2</span> : null}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

- [ ] **Step 8: Run to verify it passes**

Run: `pnpm --filter @eta/web test WeekOverview`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/lib/current-week.ts apps/web/src/lib/current-week.test.ts apps/web/src/components/WeekOverview.tsx apps/web/src/components/WeekOverview.test.tsx
git commit -m "feat(web): WeekOverview component and current-week helper"
```

---

### Task 6: `App` — fetch + four-state machine + composition

**Files:**
- Modify: `apps/web/src/App.tsx` (replace the Task 1 placeholder)
- Test: `apps/web/src/App.test.tsx`

**Interfaces:**
- Consumes: `fetchPlanTree`, `FetchResult` from `./api/fetch-plan-tree.js`; all components from Tasks 3–5; `indexOfCurrentWeek` from `./lib/current-week.js`; `makePlanTreeFixture` in tests.
- Produces: `App` — accepts an optional injected fetcher for tests: `App({ fetchTree }: { fetchTree?: () => Promise<FetchResult> })`, defaulting to `() => fetchPlanTree()`.

- [ ] **Step 1: Write the failing tests `App.test.tsx`**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { makePlanTreeFixture } from './test/fixtures/plan-tree.fixture.js';
import type { FetchResult } from './api/fetch-plan-tree.js';
import { App } from './App.js';

const ok = (): Promise<FetchResult> =>
  Promise.resolve({ status: 'ok', tree: makePlanTreeFixture() });

test('renders the plan on success', async () => {
  render(<App fetchTree={ok} />);
  await waitFor(() => expect(screen.getByText('2026-07-13')).toBeInTheDocument());
  expect(screen.getByText('B-E2')).toBeInTheDocument();
});

test('shows the empty state on 404', async () => {
  render(<App fetchTree={() => Promise.resolve({ status: 'empty' })} />);
  await waitFor(() => expect(screen.getByText(/no plan yet/i)).toBeInTheDocument());
});

test('shows the error state with a retry button', async () => {
  render(<App fetchTree={() => Promise.resolve({ status: 'error', message: 'boom' })} />);
  await waitFor(() => expect(screen.getByText(/boom/)).toBeInTheDocument());
  expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @eta/web test App`
Expected: FAIL — `App` does not accept `fetchTree` / states not rendered.

- [ ] **Step 3: Replace `apps/web/src/App.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { fetchPlanTree, type FetchResult } from './api/fetch-plan-tree.js';
import { PlanHeader } from './components/PlanHeader.js';
import { AdaptationCard } from './components/AdaptationCard.js';
import { WeekOverview } from './components/WeekOverview.js';
import { WeekCard } from './components/WeekCard.js';
import { indexOfCurrentWeek } from './lib/current-week.js';

type State = { kind: 'loading' } | { kind: 'done'; result: FetchResult };

export function App({
  fetchTree = (): Promise<FetchResult> => fetchPlanTree(),
}: {
  fetchTree?: () => Promise<FetchResult>;
} = {}): JSX.Element {
  const [state, setState] = useState<State>({ kind: 'loading' });

  const load = useCallback(() => {
    setState({ kind: 'loading' });
    void fetchTree().then((result) => setState({ kind: 'done', result }));
  }, [fetchTree]);

  useEffect(() => load(), [load]);

  if (state.kind === 'loading') {
    return <main className="app">
      <p className="status loading">Loading plan…</p>
    </main>;
  }

  const { result } = state;
  if (result.status === 'empty') {
    return (
      <main className="app">
        <p className="status empty">
          No plan yet — run the pipeline (<code>pnpm seed:profile</code> →{' '}
          <code>generate:test-plan</code> → <code>generate:test-week</code> →{' '}
          <code>adapt:current-week</code>), then refresh.
        </p>
        <button type="button" onClick={load}>
          Refresh
        </button>
      </main>
    );
  }
  if (result.status === 'error') {
    return (
      <main className="app">
        <p className="status error">Couldn’t load the plan: {result.message}</p>
        <button type="button" onClick={load}>
          Retry
        </button>
      </main>
    );
  }

  const { tree } = result;
  const currentIndex = indexOfCurrentWeek(tree.weeks, new Date());
  return (
    <main className="app">
      <div className="toolbar">
        <button type="button" onClick={load}>
          Refresh
        </button>
      </div>
      <PlanHeader tree={tree} />
      <AdaptationCard adaptation={tree.currentAdaptation} />
      <WeekOverview weeks={tree.weeks} currentIndex={currentIndex} />
      <section className="weeks">
        {tree.weeks.map((w, i) => (
          <WeekCard key={w.weekNumber} week={w} isCurrent={i === currentIndex} />
        ))}
      </section>
    </main>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @eta/web test App`
Expected: PASS (3 tests).

- [ ] **Step 5: Run the full web test suite + typecheck + lint**

Run: `pnpm --filter @eta/web test && pnpm --filter @eta/web typecheck && pnpm --filter @eta/web lint`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/App.test.tsx
git commit -m "feat(web): App fetch + loading/error/empty/loaded states"
```

---

### Task 7: Visual design pass + live end-to-end verification

This task styles the app (no new behavior) and verifies it against the live API. Styling is not TDD; verification is manual against the running stack.

**Files:**
- Create: `apps/web/src/styles.css` (or per-component CSS modules — implementer's choice; keep it one cohesive system)
- Modify: `apps/web/src/main.tsx` (import the stylesheet)
- Modify: component `className`s only as needed to support the design (no logic changes; existing tests must stay green)

**Interfaces:**
- Consumes: all components from Tasks 3–6.
- Produces: a styled, responsive UI. No exported API.

- [ ] **Step 1: Invoke the `frontend-design` skill**

Use the `frontend-design` skill to produce the visual treatment: clear hierarchy, good typography, responsive layout, with deliberate emphasis on the current week (`.week-card.current`, `.week-overview li.current`) and the adaptation card. The component DOM and class hooks already exist from Tasks 3–6 — design against them; do not change component logic.

- [ ] **Step 2: Import the stylesheet in `main.tsx`**

Add at the top of `apps/web/src/main.tsx`:

```tsx
import './styles.css';
```

- [ ] **Step 3: Re-run the web test suite to confirm styling changed nothing behavioral**

Run: `pnpm --filter @eta/web test && pnpm --filter @eta/web typecheck && pnpm --filter @eta/web lint`
Expected: all green (same tests as Task 6).

- [ ] **Step 4: Live verification against the running stack**

Ensure Postgres is up and a plan is seeded (the live DB already has macro plan `6113a89c-…` with a current-week detail + adaptation from the 2026-06-29 run; if empty, run the pipeline).

Run, in two terminals:
- `pnpm dev:api`
- `pnpm dev:web`

Open the Vite URL (default `http://localhost:5173`). Expected:
- Header shows race date `2026-10-05`, race type, week count 14.
- Adaptation card shows the current-week adjustments (6 items).
- Overview lists 14 weeks; the week containing today is highlighted and has a `P2` badge.
- Clicking the current week scrolls to its card; that card shows the generated workouts; the other 13 show the "no detail yet" placeholder.
- Stop the API → click Refresh → the error state with Retry appears. Restart API → Retry recovers.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/styles.css apps/web/src/main.tsx apps/web/src/components
git commit -m "feat(web): visual design pass for the plan viewer"
```

---

## Self-Review

**Spec coverage:**
- Vite+React in `apps/web`, shared-types, dev proxy → Task 1.
- Client `PlanTree` type + Zod-validated fetch wrapper + four states → Tasks 2, 6.
- Components (header, adaptation, overview, week/workout/segment) → Tasks 3–5.
- Fresh polished visual via `frontend-design` → Task 7.
- Component + state + fetch-wrapper tests, canonical fixture → Tasks 2–6.
- Non-goals (triggers, write-actions, auth, E2E, deploy) → not present. ✓
- Done criteria (dev:web serves; all four states; tests pass; no apps/api changes) → Tasks 1–7. ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code. Task 7 styling is intentionally open-ended (delegated to `frontend-design`) but its DOM contract and verification are concrete. ✓

**Type consistency:** `PlanTree`/`PlanTreeWeek` defined in Task 2 and consumed unchanged in Tasks 3–6. `FetchResult` defined in Task 2, consumed in Task 6. `fetchPlanTree(fetchImpl?)` and `App({ fetchTree })` signatures match their tests. Component prop names (`tree`, `adaptation`, `week`, `isCurrent`, `weeks`, `currentIndex`, `segment`, `workout`) are consistent between implementations and tests. ✓

**Note for implementer:** the fixture in Task 2 Step 2 casts a few literals to the shared types. If the current `@eta/shared-types` definitions have additional required fields, extend the fixture literals to satisfy them — the imported types are the source of truth, and `typecheck` will flag any gap.
