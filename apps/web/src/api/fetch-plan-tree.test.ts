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
