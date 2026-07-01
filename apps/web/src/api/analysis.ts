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
