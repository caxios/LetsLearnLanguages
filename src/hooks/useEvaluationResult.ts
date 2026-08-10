import { useQuery } from '@tanstack/react-query';

import { evaluationRepository } from '@/db/repositories/evaluationRepository';

export function useEvaluationResult(id: number) {
  return useQuery({
    queryKey: ['evaluation', id],
    queryFn: () => evaluationRepository.getById(id),
    enabled: Number.isFinite(id) && id > 0,
  });
}

/**
 * The last evaluation the user got for a daily sentence, so re-opening a finished
 * sentence can show what they wrote instead of an empty form.
 */
export function useLatestEvaluationForSentence(dailySentenceId: number | null) {
  const id = dailySentenceId ?? 0;

  return useQuery({
    queryKey: ['evaluation', 'forSentence', id],
    queryFn: async () => {
      const latestId = await evaluationRepository.getLatestIdForDailySentence(id);
      return latestId ? evaluationRepository.getById(latestId) : null;
    },
    enabled: Number.isFinite(id) && id > 0,
  });
}
