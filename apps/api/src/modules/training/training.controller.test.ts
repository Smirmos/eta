import { describe, test, expect, it, vi } from 'vitest';
import { TrainingController } from './training.controller.js';

const config = { get: () => 'user-1' } as never;
const stubNextWeek = {} as never;
const stubProfileRepo = {} as never;

test('returns analysis with the narrative attached', async () => {
  const analysisSvc = { analyze: vi.fn(async () => ({ hasData: true })) } as never;
  const narrativeSvc = { summarize: vi.fn(async () => 'nice block') } as never;
  const ctrl = new TrainingController(analysisSvc, narrativeSvc, config, stubNextWeek, stubProfileRepo);
  const res = await ctrl.getAnalysis();
  expect(res.narrative).toBe('nice block');
  expect((analysisSvc as { analyze: ReturnType<typeof vi.fn> }).analyze).toHaveBeenCalledWith('user-1');
});

test('still returns analysis when the narrative is null', async () => {
  const analysisSvc = { analyze: vi.fn(async () => ({ hasData: true })) } as never;
  const narrativeSvc = { summarize: vi.fn(async () => null) } as never;
  const ctrl = new TrainingController(analysisSvc, narrativeSvc, config, stubNextWeek, stubProfileRepo);
  const res = await ctrl.getAnalysis();
  expect(res.narrative).toBeNull();
  expect(res.hasData).toBe(true);
});

function controllerWith(opts: { profile: unknown; analysisHasData?: boolean; generate?: () => Promise<unknown> }): TrainingController {
  const cfg = { get: () => 'user-1' } as never;
  const analysis = { analyze: vi.fn(async () => ({ hasData: opts.analysisHasData ?? true, window: opts.analysisHasData === false ? null : {} })) } as never;
  const narrative = {} as never;
  const profileRepo = { findByUserId: vi.fn(async () => opts.profile) } as never;
  const nextWeek = { generate: vi.fn(opts.generate ?? (async () => ({ frame: { weekStartDate: 'x' }, weeklyDetail: { workouts: [] } }))) } as never;
  return new TrainingController(analysis, narrative, cfg, nextWeek, profileRepo);
}

describe('GET /training/next-week', () => {
  it('returns needs_profile when no profile exists', async () => {
    const res = await controllerWith({ profile: null }).getNextWeek();
    expect(res).toEqual({ status: 'needs_profile' });
  });
  it('returns needs_history when analysis has no data', async () => {
    const res = await controllerWith({ profile: {}, analysisHasData: false }).getNextWeek();
    expect(res).toEqual({ status: 'needs_history' });
  });
  it('returns ok with frame + weeklyDetail on success', async () => {
    const res = await controllerWith({ profile: {} }).getNextWeek();
    expect(res.status).toBe('ok');
  });
  it('maps a generation error to status:error', async () => {
    const res = await controllerWith({ profile: {}, generate: async () => { throw new Error('boom'); } }).getNextWeek();
    expect(res).toEqual({ status: 'error', message: 'boom' });
  });
});
