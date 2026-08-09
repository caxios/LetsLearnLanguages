// PLACEHOLDER — the real Gemini integration lands in Phase 4.
// The signature is final so `useEvaluation` is already wired against it.
import type { EvaluationResponse } from '@/types/evaluation';

export async function evaluate(_input: {
  koreanText: string;
  englishText: string;
}): Promise<EvaluationResponse> {
  throw new Error('AI evaluation is not connected yet (Phase 4).');
}
