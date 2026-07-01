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
