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
