import { test, expect } from 'vitest';
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
