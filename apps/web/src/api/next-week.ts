import { nextWeekResponseSchema, type NextWeekResponse } from '@eta/shared-types';

export type NextWeekResult =
  | { status: 'loaded'; response: NextWeekResponse }
  | { status: 'error'; message: string };

export async function fetchNextWeek(fetchImpl: typeof fetch = fetch): Promise<NextWeekResult> {
  try {
    const res = await fetchImpl('/api/training/next-week', { headers: { accept: 'application/json' } });
    if (!res.ok) return { status: 'error', message: `HTTP ${res.status}` };
    const parsed = nextWeekResponseSchema.safeParse(await res.json());
    if (!parsed.success) return { status: 'error', message: `Invalid next-week: ${parsed.error.message}` };
    return { status: 'loaded', response: parsed.data as NextWeekResponse };
  } catch (err) {
    return { status: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}
