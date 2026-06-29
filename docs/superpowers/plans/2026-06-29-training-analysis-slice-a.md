# Training Analysis & Summary — Slice A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compute a deterministic training summary over the last ~4 weeks of completed workouts (volume-driven, bike-only TSS) plus a best-effort LLM narrative, expose it at `GET /training/analysis`, and render it as the web app's new primary screen.

**Architecture:** A new `TrainingModule` in the NestJS API: `TrainingAnalysisService` loads `workouts_completed` and computes metrics in-memory (window anchored to the latest activity); `TrainingNarrativeService` adds a best-effort one-paragraph narrative via the existing Anthropic client; `TrainingController` serves `GET /training/analysis`. The shared result contract lives in `@eta/shared-types`. The web app gets a typed fetch wrapper and a `TrainingSummary` view that becomes `App`'s content.

**Tech Stack:** NestJS 10 (Fastify), `@nestjs/config`, `@anthropic-ai/sdk`, Vitest; React 18, Vite, `@testing-library/react`; `zod` (shared-types).

## Global Constraints

- API: TypeScript strict; ESM `.js` import specifiers; follow existing module/provider patterns (repos are plain `@Injectable` providers with `DbModule`; services needing `ConfigService` use the `useFactory` provider style seen in `plan-generation.module.ts`).
- Web: TS strict + `noUncheckedIndexedAccess`; ESM; lint `--max-warnings 0` (`import type`/inline type imports; never `any`); React 18 react-jsx transform (no React import for JSX).
- **Default function props/args MUST have stable module-scope identity** (inline defaults cause render loops — the Slice 1 bug).
- Single-user: API resolves `DEV_USER_ID` via `ConfigService`; client calls `/api/...` through the Vite proxy (target `127.0.0.1`).
- Dates from the DB `date` column are `YYYY-MM-DD` strings; numeric columns (`actualTss`) come back as `string | null` (use `parseFloat`); `actualDurationSeconds` is `number | null`. `Discipline = 'swim' | 'bike' | 'run'`.
- Hours are `actual_duration_seconds / 3600`, rounded to 1 decimal in outputs. The analysis window is 28 days ending at the most recent activity date; weeks are 4 rolling 7-day buckets counting back from `asOf` (NOT ISO/Monday-anchored).
- TSS is bike-only; progression/trend are volume-driven.

---

### Task 1: Shared `TrainingAnalysis` contract (`@eta/shared-types`)

**Files:**
- Create: `packages/shared-types/src/training-analysis.ts`
- Create: `packages/shared-types/src/training-analysis.schema.ts`
- Modify: `packages/shared-types/src/index.ts` (export both)
- Test: `packages/shared-types/src/training-analysis.schema.test.ts`

**Interfaces:**
- Produces (consumed by every later task): the types below and
  `trainingAnalysisResponseSchema` (a Zod schema validating `TrainingAnalysisResponse`).

- [ ] **Step 1: Create `training-analysis.ts`**

```ts
import type { Discipline } from './athlete-profile.js';

export type TrendDirection = 'building' | 'steady' | 'tapering';

export interface SportSplitEntry {
  discipline: Discipline;
  sessions: number;
  hours: number;
  pctHours: number;
}

export interface WeekBucket {
  /** Earliest ISO date of the 7-day bucket. */
  weekStart: string;
  sessions: number;
  hours: number;
  byDiscipline: Partial<Record<Discipline, { sessions: number; hours: number }>>;
  /** Sum of actualTss over bike sessions that have it; null if none. */
  bikeTss: number | null;
}

export interface LongestSession {
  discipline: Discipline;
  date: string;
  minutes: number;
}

export interface TrainingAnalysis {
  hasData: boolean;
  /** null when there is no training data. */
  window: { from: string; asOf: string } | null;
  overall: {
    totalSessions: number;
    totalHours: number;
    trainingDays: number;
    avgSessionsPerWeek: number;
    avgTrainingDaysPerWeek: number;
    sportSplit: SportSplitEntry[];
  };
  /** Oldest -> newest, up to 4 buckets. */
  perWeek: WeekBucket[];
  trend: TrendDirection;
  longestSessions: LongestSession[];
  dataNote: { tssCoverage: 'bike_only'; staleDays: number };
}

export interface TrainingAnalysisResponse extends TrainingAnalysis {
  narrative: string | null;
}
```

- [ ] **Step 2: Write the failing schema test `training-analysis.schema.test.ts`**

```ts
import { trainingAnalysisResponseSchema } from './training-analysis.schema.js';

const valid = {
  hasData: true,
  window: { from: '2026-05-19', asOf: '2026-06-15' },
  overall: {
    totalSessions: 30,
    totalHours: 40.5,
    trainingDays: 18,
    avgSessionsPerWeek: 7.5,
    avgTrainingDaysPerWeek: 4.5,
    sportSplit: [{ discipline: 'bike', sessions: 12, hours: 18.2, pctHours: 45 }],
  },
  perWeek: [
    { weekStart: '2026-05-19', sessions: 8, hours: 10.1, byDiscipline: { bike: { sessions: 3, hours: 4.2 } }, bikeTss: 180 },
  ],
  trend: 'steady',
  longestSessions: [{ discipline: 'bike', date: '2026-06-10', minutes: 180 }],
  dataNote: { tssCoverage: 'bike_only', staleDays: 14 },
  narrative: 'Solid block.',
};

test('accepts a valid response', () => {
  expect(trainingAnalysisResponseSchema.safeParse(valid).success).toBe(true);
});

test('accepts a null narrative and null window', () => {
  expect(trainingAnalysisResponseSchema.safeParse({ ...valid, narrative: null, window: null }).success).toBe(true);
});

test('rejects an invalid trend', () => {
  expect(trainingAnalysisResponseSchema.safeParse({ ...valid, trend: 'sideways' }).success).toBe(false);
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm --filter @eta/shared-types test training-analysis`
Expected: FAIL — module not found.

- [ ] **Step 4: Create `training-analysis.schema.ts`**

```ts
import { z } from 'zod';
import { disciplineSchema } from './athlete-profile.schema.js';

const sportSplitEntrySchema = z.object({
  discipline: disciplineSchema,
  sessions: z.number(),
  hours: z.number(),
  pctHours: z.number(),
});

const weekBucketSchema = z.object({
  weekStart: z.string(),
  sessions: z.number(),
  hours: z.number(),
  byDiscipline: z.record(disciplineSchema, z.object({ sessions: z.number(), hours: z.number() })),
  bikeTss: z.number().nullable(),
});

const longestSessionSchema = z.object({
  discipline: disciplineSchema,
  date: z.string(),
  minutes: z.number(),
});

export const trainingAnalysisResponseSchema = z.object({
  hasData: z.boolean(),
  window: z.object({ from: z.string(), asOf: z.string() }).nullable(),
  overall: z.object({
    totalSessions: z.number(),
    totalHours: z.number(),
    trainingDays: z.number(),
    avgSessionsPerWeek: z.number(),
    avgTrainingDaysPerWeek: z.number(),
    sportSplit: z.array(sportSplitEntrySchema),
  }),
  perWeek: z.array(weekBucketSchema),
  trend: z.enum(['building', 'steady', 'tapering']),
  longestSessions: z.array(longestSessionSchema),
  dataNote: z.object({ tssCoverage: z.literal('bike_only'), staleDays: z.number() }),
  narrative: z.string().nullable(),
});
```

- [ ] **Step 5: Export from `index.ts`** — add these lines:

```ts
export * from './training-analysis.js';
export * from './training-analysis.schema.js';
```

- [ ] **Step 6: Run to verify it passes**

Run: `pnpm --filter @eta/shared-types test training-analysis`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add packages/shared-types/src/training-analysis.ts packages/shared-types/src/training-analysis.schema.ts packages/shared-types/src/training-analysis.schema.test.ts packages/shared-types/src/index.ts
git commit -m "feat(shared-types): TrainingAnalysis contract + zod schema"
```

---

### Task 2: `TrainingAnalysisService` (deterministic computation)

**Files:**
- Create: `apps/api/src/modules/training/training-analysis.service.ts`
- Test: `apps/api/src/modules/training/training-analysis.service.test.ts`

**Interfaces:**
- Consumes: `WorkoutsCompletedRepository.findByUserAndDateRange(userId, startDate, endDate)` → `WorkoutsCompletedRow[]` (fields: `date: string`, `discipline: string`, `actualDurationSeconds: number | null`, `actualTss: string | null`); `TrainingAnalysis` from `@eta/shared-types`.
- Produces: `TrainingAnalysisService.analyze(userId: string, today?: Date): Promise<TrainingAnalysis>`. Loads all the user's rows up to `today`, anchors the 28-day window to the latest activity, and computes the metrics. Returns an empty-shaped analysis (`hasData: false`, `window: null`) when there are no rows.

- [ ] **Step 1: Write the failing test**

```ts
import { TrainingAnalysisService } from './training-analysis.service.js';

type Row = { date: string; discipline: string; actualDurationSeconds: number | null; actualTss: string | null };

function repoWith(rows: Row[]) {
  return { findByUserAndDateRange: async () => rows } as never;
}

const today = new Date('2026-06-29T00:00:00Z');

test('returns empty analysis when there are no rows', async () => {
  const svc = new TrainingAnalysisService(repoWith([]));
  const a = await svc.analyze('u1', today);
  expect(a.hasData).toBe(false);
  expect(a.window).toBeNull();
  expect(a.overall.totalSessions).toBe(0);
});

test('anchors the window to the most recent activity and computes overall metrics', async () => {
  const rows: Row[] = [
    { date: '2026-06-15', discipline: 'bike', actualDurationSeconds: 3600, actualTss: '60' },
    { date: '2026-06-14', discipline: 'run', actualDurationSeconds: 1800, actualTss: null },
    { date: '2026-06-14', discipline: 'swim', actualDurationSeconds: 1800, actualTss: null },
    { date: '2026-04-01', discipline: 'run', actualDurationSeconds: 3600, actualTss: null }, // outside 28-day window
  ];
  const svc = new TrainingAnalysisService(repoWith(rows));
  const a = await svc.analyze('u1', today);
  expect(a.hasData).toBe(true);
  expect(a.window).toEqual({ from: '2026-05-19', asOf: '2026-06-15' });
  expect(a.overall.totalSessions).toBe(3); // the 04-01 row is excluded
  expect(a.overall.totalHours).toBe(2); // 1h + 0.5h + 0.5h
  expect(a.overall.trainingDays).toBe(2); // 06-15, 06-14
  expect(a.dataNote.staleDays).toBe(14); // 06-29 - 06-15
});

test('computes sport split and bike-only TSS', async () => {
  const rows: Row[] = [
    { date: '2026-06-15', discipline: 'bike', actualDurationSeconds: 3600, actualTss: '60' },
    { date: '2026-06-15', discipline: 'run', actualDurationSeconds: 3600, actualTss: null },
  ];
  const svc = new TrainingAnalysisService(repoWith(rows));
  const a = await svc.analyze('u1', today);
  const bike = a.overall.sportSplit.find((s) => s.discipline === 'bike');
  expect(bike?.pctHours).toBe(50);
  expect(a.perWeek.at(-1)?.bikeTss).toBe(60);
});

test('classifies trend as tapering when the latest week is much lighter', async () => {
  const rows: Row[] = [
    // older week (bucket -4..-3 weeks): heavy
    { date: '2026-05-20', discipline: 'run', actualDurationSeconds: 36000, actualTss: null },
    // latest week: light
    { date: '2026-06-15', discipline: 'run', actualDurationSeconds: 1800, actualTss: null },
  ];
  const svc = new TrainingAnalysisService(repoWith(rows));
  const a = await svc.analyze('u1', today);
  expect(a.trend).toBe('tapering');
});

test('reports the longest session per sport', async () => {
  const rows: Row[] = [
    { date: '2026-06-10', discipline: 'bike', actualDurationSeconds: 7200, actualTss: '120' },
    { date: '2026-06-12', discipline: 'bike', actualDurationSeconds: 3600, actualTss: '60' },
  ];
  const svc = new TrainingAnalysisService(repoWith(rows));
  const a = await svc.analyze('u1', today);
  expect(a.longestSessions.find((l) => l.discipline === 'bike')).toEqual({ discipline: 'bike', date: '2026-06-10', minutes: 120 });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @eta/api test training-analysis.service`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `training-analysis.service.ts`**

```ts
import { Injectable } from '@nestjs/common';
import type { Discipline, TrainingAnalysis, TrendDirection, WeekBucket } from '@eta/shared-types';
import type { WorkoutsCompletedRepository } from '../../db/repositories/workouts-completed.repository.js';

const DISCIPLINES: Discipline[] = ['swim', 'bike', 'run'];
const round1 = (n: number): number => Math.round(n * 10) / 10;
const addDaysIso = (iso: string, days: number): string =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
const daysBetween = (fromIso: string, toIso: string): number =>
  Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);

interface AnalysisRow {
  date: string;
  discipline: string;
  actualDurationSeconds: number | null;
  actualTss: string | null;
}

function emptyAnalysis(): TrainingAnalysis {
  return {
    hasData: false,
    window: null,
    overall: {
      totalSessions: 0,
      totalHours: 0,
      trainingDays: 0,
      avgSessionsPerWeek: 0,
      avgTrainingDaysPerWeek: 0,
      sportSplit: [],
    },
    perWeek: [],
    trend: 'steady',
    longestSessions: [],
    dataNote: { tssCoverage: 'bike_only', staleDays: 0 },
  };
}

@Injectable()
export class TrainingAnalysisService {
  constructor(private readonly workoutsRepo: WorkoutsCompletedRepository) {}

  async analyze(userId: string, today: Date = new Date()): Promise<TrainingAnalysis> {
    const todayIso = today.toISOString().slice(0, 10);
    const all = (await this.workoutsRepo.findByUserAndDateRange(
      userId,
      '1970-01-01',
      todayIso,
    )) as unknown as AnalysisRow[];
    if (all.length === 0) return emptyAnalysis();

    const asOf = all.reduce((max, r) => (r.date > max ? r.date : max), all[0]!.date);
    const from = addDaysIso(asOf, -27);
    const rows = all.filter((r) => r.date >= from && r.date <= asOf);
    if (rows.length === 0) return emptyAnalysis();

    const hours = (r: AnalysisRow): number => (r.actualDurationSeconds ?? 0) / 3600;

    // 4 rolling 7-day buckets counting back from asOf; index 0 = oldest.
    const buckets: WeekBucket[] = [];
    for (let b = 3; b >= 0; b -= 1) {
      const end = addDaysIso(asOf, -7 * b);
      const start = addDaysIso(end, -6);
      const inBucket = rows.filter((r) => r.date >= start && r.date <= end);
      const byDiscipline: WeekBucket['byDiscipline'] = {};
      for (const d of DISCIPLINES) {
        const ds = inBucket.filter((r) => r.discipline === d);
        if (ds.length > 0) {
          byDiscipline[d] = { sessions: ds.length, hours: round1(ds.reduce((s, r) => s + hours(r), 0)) };
        }
      }
      const bikeTssRows = inBucket.filter((r) => r.discipline === 'bike' && r.actualTss != null);
      buckets.push({
        weekStart: start,
        sessions: inBucket.length,
        hours: round1(inBucket.reduce((s, r) => s + hours(r), 0)),
        byDiscipline,
        bikeTss: bikeTssRows.length > 0 ? round1(bikeTssRows.reduce((s, r) => s + parseFloat(r.actualTss as string), 0)) : null,
      });
    }

    const totalHours = rows.reduce((s, r) => s + hours(r), 0);
    const sportSplit = DISCIPLINES.map((d) => {
      const ds = rows.filter((r) => r.discipline === d);
      const h = ds.reduce((s, r) => s + hours(r), 0);
      return {
        discipline: d,
        sessions: ds.length,
        hours: round1(h),
        pctHours: totalHours > 0 ? Math.round((h / totalHours) * 100) : 0,
      };
    }).filter((s) => s.sessions > 0);

    const trainingDays = new Set(rows.map((r) => r.date)).size;

    const longestSessions = DISCIPLINES.flatMap((d) => {
      const ds = rows.filter((r) => r.discipline === d);
      if (ds.length === 0) return [];
      const longest = ds.reduce((max, r) =>
        (r.actualDurationSeconds ?? 0) > (max.actualDurationSeconds ?? 0) ? r : max,
      );
      return [{ discipline: d, date: longest.date, minutes: Math.round((longest.actualDurationSeconds ?? 0) / 60) }];
    });

    const recent = buckets[buckets.length - 1]!.hours;
    const prior = buckets.slice(0, -1).filter((b) => b.hours > 0);
    const priorMean = prior.length > 0 ? prior.reduce((s, b) => s + b.hours, 0) / prior.length : 0;
    let trend: TrendDirection = 'steady';
    if (priorMean > 0) {
      const ratio = recent / priorMean;
      trend = ratio > 1.1 ? 'building' : ratio < 0.9 ? 'tapering' : 'steady';
    }

    return {
      hasData: true,
      window: { from, asOf },
      overall: {
        totalSessions: rows.length,
        totalHours: round1(totalHours),
        trainingDays,
        avgSessionsPerWeek: round1(rows.length / 4),
        avgTrainingDaysPerWeek: round1(trainingDays / 4),
        sportSplit,
      },
      perWeek: buckets,
      trend,
      longestSessions,
      dataNote: { tssCoverage: 'bike_only', staleDays: Math.max(0, daysBetween(asOf, todayIso)) },
    };
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @eta/api test training-analysis.service`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/training/training-analysis.service.ts apps/api/src/modules/training/training-analysis.service.test.ts
git commit -m "feat(api): TrainingAnalysisService — deterministic recent-training metrics"
```

---

### Task 3: `TrainingNarrativeService` (best-effort LLM narrative)

**Files:**
- Create: `apps/api/src/modules/training/training-narrative.service.ts`
- Test: `apps/api/src/modules/training/training-narrative.service.test.ts`

**Interfaces:**
- Consumes: `TrainingAnalysis` from `@eta/shared-types`; an injected Anthropic-like client `{ messages: { create(args): Promise<{ content: Array<{ type: string; text?: string }> }> } }`.
- Produces: `TrainingNarrativeService` with `summarize(analysis: TrainingAnalysis): Promise<string | null>` — returns one paragraph, or `null` on any error or when `hasData` is false. Constructor takes `(config: ConfigService<Env, true>, client?: AnthropicLike)` so tests inject a fake client.

- [ ] **Step 1: Write the failing test**

```ts
import { TrainingNarrativeService } from './training-narrative.service.js';
import type { TrainingAnalysis } from '@eta/shared-types';

const config = { get: () => 'x' } as never;
const analysis = { hasData: true, overall: { totalHours: 40, totalSessions: 30 }, trend: 'steady' } as unknown as TrainingAnalysis;

test('returns the model text', async () => {
  const client = { messages: { create: async () => ({ content: [{ type: 'text', text: 'Strong, consistent block.' }] }) } };
  const svc = new TrainingNarrativeService(config, client as never);
  expect(await svc.summarize(analysis)).toBe('Strong, consistent block.');
});

test('returns null when hasData is false', async () => {
  const client = { messages: { create: async () => ({ content: [{ type: 'text', text: 'x' }] }) } };
  const svc = new TrainingNarrativeService(config, client as never);
  expect(await svc.summarize({ ...analysis, hasData: false })).toBeNull();
});

test('returns null when the client throws', async () => {
  const client = { messages: { create: async () => { throw new Error('boom'); } } };
  const svc = new TrainingNarrativeService(config, client as never);
  expect(await svc.summarize(analysis)).toBeNull();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @eta/api test training-narrative.service`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `training-narrative.service.ts`**

Mirror the Anthropic setup used in `pass2.service.ts` (apiKey/model from `ConfigService`), but allow an injected client for tests and a small `max_tokens`.

```ts
import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { ConfigService } from '@nestjs/config';
import type { TrainingAnalysis } from '@eta/shared-types';
import type { Env } from '../../config/env.schema.js';

interface AnthropicLike {
  messages: { create: (args: unknown) => Promise<{ content: Array<{ type: string; text?: string }> }> };
}

@Injectable()
export class TrainingNarrativeService {
  private readonly client: AnthropicLike;
  private readonly model: string;

  constructor(config: ConfigService<Env, true>, client?: AnthropicLike) {
    this.model = config.get('ANTHROPIC_MODEL', { infer: true });
    this.client =
      client ?? (new Anthropic({ apiKey: config.get('ANTHROPIC_API_KEY', { infer: true }) }) as unknown as AnthropicLike);
  }

  async summarize(analysis: TrainingAnalysis): Promise<string | null> {
    if (!analysis.hasData) return null;
    try {
      const res = await this.client.messages.create({
        model: this.model,
        max_tokens: 400,
        messages: [
          {
            role: 'user',
            content:
              'Write ONE short paragraph (<=4 sentences) summarizing this endurance athlete’s last 4 weeks for the athlete to read. ' +
              'Cover consistency, sport balance, and the load trend. Be concrete and encouraging, no markdown. Data:\n' +
              JSON.stringify(analysis),
          },
        ],
      });
      const text = res.content.find((c) => c.type === 'text')?.text?.trim();
      return text && text.length > 0 ? text : null;
    } catch {
      return null;
    }
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @eta/api test training-narrative.service`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/training/training-narrative.service.ts apps/api/src/modules/training/training-narrative.service.test.ts
git commit -m "feat(api): TrainingNarrativeService — best-effort LLM summary"
```

---

### Task 4: `TrainingController` + `TrainingModule` + app wiring

**Files:**
- Create: `apps/api/src/modules/training/training.controller.ts`
- Create: `apps/api/src/modules/training/training.module.ts`
- Test: `apps/api/src/modules/training/training.controller.test.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `TrainingAnalysisService.analyze(userId)`, `TrainingNarrativeService.summarize(analysis)`, `ConfigService` for `DEV_USER_ID`.
- Produces: `TrainingController` with `@Get('training/analysis') getAnalysis(): Promise<TrainingAnalysisResponse>` — analysis + best-effort narrative; and `TrainingModule`.

- [ ] **Step 1: Write the failing test**

```ts
import { TrainingController } from './training.controller.js';

const config = { get: () => 'user-1' } as never;
const analysis = { hasData: true, narrative: undefined } as never;

test('returns analysis with the narrative attached', async () => {
  const analysisSvc = { analyze: vi.fn(async () => ({ hasData: true })) } as never;
  const narrativeSvc = { summarize: vi.fn(async () => 'nice block') } as never;
  const ctrl = new TrainingController(analysisSvc, narrativeSvc, config);
  const res = await ctrl.getAnalysis();
  expect(res.narrative).toBe('nice block');
  expect((analysisSvc as { analyze: ReturnType<typeof vi.fn> }).analyze).toHaveBeenCalledWith('user-1');
});

test('still returns analysis when the narrative is null', async () => {
  const analysisSvc = { analyze: vi.fn(async () => ({ hasData: true })) } as never;
  const narrativeSvc = { summarize: vi.fn(async () => null) } as never;
  const ctrl = new TrainingController(analysisSvc, narrativeSvc, config);
  const res = await ctrl.getAnalysis();
  expect(res.narrative).toBeNull();
  expect(res.hasData).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @eta/api test training.controller`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `training.controller.ts`**

```ts
import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TrainingAnalysisResponse } from '@eta/shared-types';
import type { Env } from '../../config/env.schema.js';
import { TrainingAnalysisService } from './training-analysis.service.js';
import { TrainingNarrativeService } from './training-narrative.service.js';

@Controller('training')
export class TrainingController {
  constructor(
    private readonly analysis: TrainingAnalysisService,
    private readonly narrative: TrainingNarrativeService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Get('analysis')
  async getAnalysis(): Promise<TrainingAnalysisResponse> {
    const userId = this.config.get('DEV_USER_ID', { infer: true });
    const analysis = await this.analysis.analyze(userId);
    const narrative = await this.narrative.summarize(analysis);
    return { ...analysis, narrative };
  }
}
```

- [ ] **Step 4: Implement `training.module.ts`**

Both services import their dependencies with `import type` (the codebase
convention in `plan-generation.module.ts` — keeps `consistent-type-imports` happy
under `--max-warnings 0`), so both are registered via `useFactory`, providing the
real instances explicitly rather than relying on decorator metadata.

```ts
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema.js';
import { DbModule } from '../../db/db.module.js';
import { WorkoutsCompletedRepository } from '../../db/repositories/workouts-completed.repository.js';
import { TrainingAnalysisService } from './training-analysis.service.js';
import { TrainingNarrativeService } from './training-narrative.service.js';
import { TrainingController } from './training.controller.js';

@Module({
  imports: [DbModule],
  controllers: [TrainingController],
  providers: [
    WorkoutsCompletedRepository,
    {
      provide: TrainingAnalysisService,
      inject: [WorkoutsCompletedRepository],
      useFactory: (workoutsRepo: WorkoutsCompletedRepository): TrainingAnalysisService =>
        new TrainingAnalysisService(workoutsRepo),
    },
    {
      provide: TrainingNarrativeService,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): TrainingNarrativeService =>
        new TrainingNarrativeService(config),
    },
  ],
})
export class TrainingModule {}
```

- [ ] **Step 5: Register `TrainingModule` in `app.module.ts`**

Add the import alongside the others:

```ts
import { TrainingModule } from './modules/training/training.module.js';
```

Add `TrainingModule` to the `imports` array (after `PlansModule`):

```ts
    PlansModule,
    TrainingModule,
    ...optionalStravaModule(),
```

- [ ] **Step 6: Run the controller test + typecheck**

Run: `pnpm --filter @eta/api test training.controller && pnpm --filter @eta/api typecheck`
Expected: PASS (2 tests) + clean typecheck.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/training apps/api/src/app.module.ts
git commit -m "feat(api): GET /training/analysis (TrainingModule)"
```

---

### Task 5: Web analysis fetch wrapper + fixture

**Files:**
- Create: `apps/web/src/api/analysis.ts`
- Create: `apps/web/src/test/fixtures/analysis.fixture.ts`
- Test: `apps/web/src/api/analysis.test.ts`

**Interfaces:**
- Consumes: `trainingAnalysisResponseSchema`, `TrainingAnalysisResponse` from `@eta/shared-types`.
- Produces:
  - `makeAnalysisFixture(overrides?: Partial<TrainingAnalysisResponse>): TrainingAnalysisResponse` (used by component tests).
  - `type AnalysisResult = { status: 'ok'; analysis: TrainingAnalysisResponse } | { status: 'error'; message: string }`
  - `fetchAnalysis(fetchImpl?: typeof fetch): Promise<AnalysisResult>` — GET `/api/training/analysis`, validate with the schema; any failure → `error`.

- [ ] **Step 1: Create the fixture `analysis.fixture.ts`**

```ts
import type { TrainingAnalysisResponse } from '@eta/shared-types';

const base: TrainingAnalysisResponse = {
  hasData: true,
  window: { from: '2026-05-19', asOf: '2026-06-15' },
  overall: {
    totalSessions: 30,
    totalHours: 40.5,
    trainingDays: 18,
    avgSessionsPerWeek: 7.5,
    avgTrainingDaysPerWeek: 4.5,
    sportSplit: [
      { discipline: 'bike', sessions: 12, hours: 18.2, pctHours: 45 },
      { discipline: 'run', sessions: 15, hours: 18.0, pctHours: 44 },
      { discipline: 'swim', sessions: 3, hours: 4.3, pctHours: 11 },
    ],
  },
  perWeek: [
    { weekStart: '2026-05-19', sessions: 6, hours: 7.1, byDiscipline: { bike: { sessions: 2, hours: 3 } }, bikeTss: 120 },
    { weekStart: '2026-05-26', sessions: 9, hours: 12.9, byDiscipline: { run: { sessions: 4, hours: 5 } }, bikeTss: 180 },
    { weekStart: '2026-06-02', sessions: 9, hours: 10.2, byDiscipline: { swim: { sessions: 1, hours: 1 } }, bikeTss: null },
    { weekStart: '2026-06-09', sessions: 6, hours: 10.3, byDiscipline: { bike: { sessions: 3, hours: 5 } }, bikeTss: 200 },
  ],
  trend: 'steady',
  longestSessions: [
    { discipline: 'bike', date: '2026-06-10', minutes: 180 },
    { discipline: 'run', date: '2026-06-05', minutes: 95 },
  ],
  dataNote: { tssCoverage: 'bike_only', staleDays: 14 },
  narrative: 'A consistent four weeks across all three sports.',
};

export function makeAnalysisFixture(
  overrides: Partial<TrainingAnalysisResponse> = {},
): TrainingAnalysisResponse {
  return { ...structuredClone(base), ...overrides };
}
```

- [ ] **Step 2: Write the failing test `analysis.test.ts`**

```ts
import { makeAnalysisFixture } from '../test/fixtures/analysis.fixture.js';
import { fetchAnalysis } from './analysis.js';

function fakeFetch(opts: { ok?: boolean; status?: number; body?: unknown }): typeof fetch {
  return (async () =>
    ({ ok: opts.ok ?? true, status: opts.status ?? 200, json: async () => opts.body }) as Response) as unknown as typeof fetch;
}

test('returns ok with the analysis on 200', async () => {
  const result = await fetchAnalysis(fakeFetch({ body: makeAnalysisFixture() }));
  expect(result.status).toBe('ok');
  if (result.status === 'ok') expect(result.analysis.overall.totalSessions).toBe(30);
});

test('returns error on a schema-invalid body', async () => {
  const result = await fetchAnalysis(fakeFetch({ body: { hasData: 'yes' } }));
  expect(result.status).toBe('error');
});

test('returns error on non-2xx', async () => {
  const result = await fetchAnalysis(fakeFetch({ ok: false, status: 500, body: {} }));
  expect(result.status).toBe('error');
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `pnpm --filter @eta/web test analysis`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `api/analysis.ts`**

```ts
import { trainingAnalysisResponseSchema, type TrainingAnalysisResponse } from '@eta/shared-types';

export type AnalysisResult =
  | { status: 'ok'; analysis: TrainingAnalysisResponse }
  | { status: 'error'; message: string };

export async function fetchAnalysis(fetchImpl: typeof fetch = fetch): Promise<AnalysisResult> {
  try {
    const res = await fetchImpl('/api/training/analysis', { headers: { accept: 'application/json' } });
    if (!res.ok) return { status: 'error', message: `HTTP ${res.status}` };
    const parsed = trainingAnalysisResponseSchema.safeParse(await res.json());
    if (!parsed.success) return { status: 'error', message: `Invalid analysis: ${parsed.error.message}` };
    return { status: 'ok', analysis: parsed.data as TrainingAnalysisResponse };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `pnpm --filter @eta/web test analysis`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/api/analysis.ts apps/web/src/api/analysis.test.ts apps/web/src/test/fixtures/analysis.fixture.ts
git commit -m "feat(web): training analysis fetch wrapper + fixture"
```

---

### Task 6: `TrainingSummary` view component

**Files:**
- Create: `apps/web/src/components/TrainingSummary.tsx`
- Test: `apps/web/src/components/TrainingSummary.test.tsx`

**Interfaces:**
- Consumes: `TrainingAnalysisResponse` from `@eta/shared-types`; `makeAnalysisFixture` in tests.
- Produces: `TrainingSummary({ analysis }: { analysis: TrainingAnalysisResponse })` — renders the summary, or an empty-state message when `!analysis.hasData`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { makeAnalysisFixture } from '../test/fixtures/analysis.fixture.js';
import { TrainingSummary } from './TrainingSummary.js';

test('renders headline stats and window', () => {
  render(<TrainingSummary analysis={makeAnalysisFixture()} />);
  expect(screen.getByText(/40\.5/)).toBeInTheDocument(); // total hours
  expect(screen.getByText(/2026-06-15/)).toBeInTheDocument(); // asOf
});

test('renders the narrative when present', () => {
  render(<TrainingSummary analysis={makeAnalysisFixture()} />);
  expect(screen.getByText(/consistent four weeks/i)).toBeInTheDocument();
});

test('shows a staleness note when data is old', () => {
  render(<TrainingSummary analysis={makeAnalysisFixture()} />);
  expect(screen.getByText(/14 days old/i)).toBeInTheDocument();
});

test('shows an empty state when there is no data', () => {
  render(<TrainingSummary analysis={makeAnalysisFixture({ hasData: false, window: null, narrative: null })} />);
  expect(screen.getByText(/no recent training/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @eta/web test TrainingSummary`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `TrainingSummary.tsx`**

```tsx
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

      <div className="stat-strip">
        <div><dt>Hours</dt><dd>{overall.totalHours}</dd></div>
        <div><dt>Sessions</dt><dd>{overall.totalSessions}</dd></div>
        <div><dt>Days/week</dt><dd>{overall.avgTrainingDaysPerWeek}</dd></div>
        <div><dt>Trend</dt><dd><span className={`trend trend-${trend}`}>{trend}</span></dd></div>
      </div>

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
            <li key={l.discipline}>
              <span className="disc">{l.discipline}</span> {l.minutes} min <span className="date">({l.date})</span>
            </li>
          ))}
        </ul>
      </div>

      {narrative ? <p className="narrative">{narrative}</p> : null}
    </section>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm --filter @eta/web test TrainingSummary`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/TrainingSummary.tsx apps/web/src/components/TrainingSummary.test.tsx
git commit -m "feat(web): TrainingSummary view component"
```

---

### Task 7: `App` swap + styles + live verification

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/App.test.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Consumes: `fetchAnalysis`, `AnalysisResult` from `./api/analysis.js`; `TrainingSummary` from `./components/TrainingSummary.js`; `makeAnalysisFixture` in tests.
- Produces: `App` renders the training summary. Accepts an optional injected fetcher for tests: `App({ fetchAnalysisImpl }: { fetchAnalysisImpl?: () => Promise<AnalysisResult> })`, defaulting to `() => fetchAnalysis()` (module-scope stable). Four states: loading / error (with Retry) / loaded (TrainingSummary, incl. its own empty state).

- [ ] **Step 1: Replace `App.test.tsx`**

The app no longer renders a `PlanTree`; replace the Slice 1 tests with analysis-driven ones.

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { makeAnalysisFixture } from './test/fixtures/analysis.fixture.js';
import type { AnalysisResult } from './api/analysis.js';
import { App } from './App.js';

const ok = (): Promise<AnalysisResult> => Promise.resolve({ status: 'ok', analysis: makeAnalysisFixture() });

test('renders the training summary on success', async () => {
  render(<App fetchAnalysisImpl={ok} />);
  await waitFor(() => expect(screen.getByText('Training summary')).toBeInTheDocument());
  expect(screen.getByText(/40\.5/)).toBeInTheDocument();
});

test('shows the error state with a retry button', async () => {
  render(<App fetchAnalysisImpl={() => Promise.resolve({ status: 'error', message: 'boom' })} />);
  await waitFor(() => expect(screen.getByText(/boom/)).toBeInTheDocument());
  expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
});

test('renders with the default fetcher without an update-depth loop', async () => {
  const analysis = makeAnalysisFixture();
  const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => analysis }) as Response) as unknown as typeof fetch;
  vi.stubGlobal('fetch', fetchMock);
  try {
    render(<App />);
    await waitFor(() => expect(screen.getByText('Training summary')).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  } finally {
    vi.unstubAllGlobals();
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm --filter @eta/web test App`
Expected: FAIL — `App` has no `fetchAnalysisImpl` / renders the old plan tree.

- [ ] **Step 3: Replace `App.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react';
import { fetchAnalysis, type AnalysisResult } from './api/analysis.js';
import { TrainingSummary } from './components/TrainingSummary.js';

type State = { kind: 'loading' } | { kind: 'done'; result: AnalysisResult };

const defaultFetchAnalysis = (): Promise<AnalysisResult> => fetchAnalysis();

export function App({
  fetchAnalysisImpl = defaultFetchAnalysis,
}: {
  fetchAnalysisImpl?: () => Promise<AnalysisResult>;
} = {}): JSX.Element {
  const [state, setState] = useState<State>({ kind: 'loading' });

  const load = useCallback(() => {
    setState({ kind: 'loading' });
    void fetchAnalysisImpl().then((result) => setState({ kind: 'done', result }));
  }, [fetchAnalysisImpl]);

  useEffect(() => load(), [load]);

  if (state.kind === 'loading') {
    return (
      <main className="app">
        <p className="status loading">Analyzing training…</p>
      </main>
    );
  }

  const { result } = state;
  if (result.status === 'error') {
    return (
      <main className="app">
        <p className="status error">Couldn’t load your training: {result.message}</p>
        <button type="button" onClick={load}>
          Retry
        </button>
      </main>
    );
  }

  return (
    <main className="app">
      <div className="toolbar">
        <button type="button" onClick={load}>
          Refresh
        </button>
      </div>
      <TrainingSummary analysis={result.analysis} />
    </main>
  );
}
```

- [ ] **Step 4: Run the App test + full web suite + typecheck + lint**

Run: `pnpm --filter @eta/web test && pnpm --filter @eta/web typecheck && pnpm --filter @eta/web lint`
Expected: all green. (The old plan-tree component tests still pass — those files are untouched and remain in the tree, just unreferenced by `App`.)

- [ ] **Step 5: Add summary styles to `styles.css`**

Append (reuses the existing tokens/fonts):

```css
/* ── Training summary (Slice A) ────────────────────────────────────────── */
.summary { display: flex; flex-direction: column; gap: 26px; }
.summary-head .eyebrow {
  font-family: var(--font-mono); font-size: 11px; letter-spacing: 0.22em;
  text-transform: uppercase; color: var(--volt); margin: 0 0 8px;
}
.summary-head h1 {
  font-family: var(--font-display); font-weight: 400; font-size: clamp(40px, 7vw, 72px);
  line-height: 0.95; text-transform: uppercase; margin: 0;
}
.stale-note { color: var(--warn, #f5b740); font-size: 13px; margin: 10px 0 0; }

.stat-strip { display: flex; flex-wrap: wrap; gap: 14px; }
.stat-strip > div {
  flex: 1 1 130px; display: flex; flex-direction: column; gap: 4px;
  padding: 14px 16px; background: var(--ink-800); border: 1px solid var(--line); border-radius: 8px;
}
.stat-strip dt { font-family: var(--font-mono); font-size: 10px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--text-3); }
.stat-strip dd { margin: 0; font-family: var(--font-mono); font-size: 22px; color: var(--text); }
.trend { font-family: var(--font-mono); font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; }
.trend-building { color: var(--volt); }
.trend-tapering { color: var(--cyan); }
.trend-steady { color: var(--text-2); }

.sport-split, .weeks-breakdown, .longest { background: var(--ink-800); border: 1px solid var(--line); border-radius: 12px; padding: 18px 20px; }
.weeks-breakdown h2, .longest h2 { font-family: var(--font-display); font-weight: 400; font-size: 24px; text-transform: uppercase; margin: 0 0 12px; }
.split-row, .wk-row { display: grid; grid-template-columns: 70px 1fr auto; align-items: center; gap: 12px; margin-bottom: 8px; }
.split-row .disc, .wk-row .wk-start { font-family: var(--font-mono); font-size: 12px; color: var(--text-2); text-transform: uppercase; }
.bar, .wk-bar { height: 10px; border-radius: 999px; background: var(--volt); min-width: 4px; }
.disc-run .bar { background: var(--amber, #f5b740); }
.disc-swim .bar { background: var(--cyan, #46d6c6); }
.split-row .val, .wk-row .wk-val { font-family: var(--font-mono); font-size: 12px; color: var(--text-3); white-space: nowrap; }
.longest ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.longest li { font-size: 14px; }
.longest .disc { font-family: var(--font-mono); text-transform: uppercase; color: var(--volt); font-size: 12px; }
.longest .date { color: var(--text-3); }
.narrative { font-size: 15px; line-height: 1.6; color: var(--text); background: var(--volt-glow); border-left: 3px solid var(--volt); border-radius: 8px; padding: 16px 18px; margin: 0; }
.summary-empty { text-align: center; margin: 80px auto; max-width: 480px; color: var(--text-2); }
.summary-empty h2 { font-family: var(--font-display); font-weight: 400; font-size: 32px; text-transform: uppercase; }
```

- [ ] **Step 6: Re-run the web suite to confirm styling changed nothing behavioral**

Run: `pnpm --filter @eta/web test`
Expected: all green.

- [ ] **Step 7: Live verification**

Ensure Docker/Postgres is up and a user has Strava workouts (the dev DB does). Run `pnpm dev:api` + `pnpm dev:web`; open the Vite URL. Expected:
- The screen shows "Training summary", the window `2026-05-19 → 2026-06-15` (or whatever the latest data yields), headline hours/sessions/days-per-week, a trend chip, sport-split bars (run/bike/swim), a per-week breakdown, longest sessions, and a narrative paragraph.
- A staleness note appears (data is ~2 weeks old).
- Confirm exactly one `GET /api/training/analysis` request and no console errors (no render loop).
- Stop the API → Refresh → the error state with Retry shows.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/App.tsx apps/web/src/App.test.tsx apps/web/src/styles.css
git commit -m "feat(web): make TrainingSummary the primary screen + styles"
```

---

## Self-Review

**Spec coverage:**
- Shared contract (`TrainingAnalysis`/`TrainingAnalysisResponse` + schema) → Task 1.
- Deterministic metrics (window anchored to latest activity, 7-day buckets, sport split, trend, longest, training-days, bike-only TSS, staleness, empty case) → Task 2.
- Best-effort LLM narrative (null on failure / no data) → Task 3.
- `GET /training/analysis` (metrics + narrative, single-user) → Task 4.
- Web fetch wrapper (schema-validated) → Task 5; `TrainingSummary` view with all states → Tasks 6, 7; design-system styling → Task 7; `App` swap → Task 7.
- Tests at every layer + live verification → all tasks.
- Non-goals (generator, removing old code, configurable window, charts, re-sync, auth) → absent. ✓

**Placeholder scan:** No TBD/TODO; every code step has complete code; live-verify step is concrete. ✓

**Type consistency:** `TrainingAnalysis`/`TrainingAnalysisResponse`/`WeekBucket`/`TrendDirection`/`SportSplitEntry`/`LongestSession` defined in Task 1 and consumed unchanged in Tasks 2–7; `AnalysisResult` + `fetchAnalysis` defined in Task 5 and consumed in Task 7; `makeAnalysisFixture` defined in Task 5 and used in Tasks 6–7; `TrainingSummary` prop `{ analysis }` matches between Task 6 (definition) and Task 7 (usage); service method `analyze(userId, today?)` and `summarize(analysis)` signatures match between definition (Tasks 2, 3) and the controller (Task 4). ✓

**Stable-default note:** `App`'s `fetchAnalysisImpl` default is a module-scope reference (`defaultFetchAnalysis`); `analyze`/`fetchAnalysis` use module-scope defaults too. No inline-default render loop. ✓
