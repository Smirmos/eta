import { test, expect, vi } from 'vitest';
import { TrainingController } from './training.controller.js';

const config = { get: () => 'user-1' } as never;

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
