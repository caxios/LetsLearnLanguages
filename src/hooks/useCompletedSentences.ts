import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { evaluationRepository } from '@/db/repositories/evaluationRepository';

/**
 * Which of `koreanTexts` have already been graded.
 *
 * Reads the evaluation history rather than any per-sentence flag, so the status
 * is correct the moment the screen mounts, survives leaving and returning, and
 * outlives the sentences themselves — topic practice throws its sentences away
 * and regenerates them, but a sentence you have practiced stays practiced.
 */
export function useCompletedSentences(koreanTexts: string[]) {
  // Deduped and sorted so the cache key depends on the set, not on the order
  // the sentences happened to arrive in.
  const texts = useMemo(() => [...new Set(koreanTexts)].sort(), [koreanTexts]);

  const query = useQuery({
    queryKey: ['completedSentences', texts],
    queryFn: async () => new Set(await evaluationRepository.findCompletedKoreanTexts(texts)),
    enabled: texts.length > 0,
  });

  return {
    ...query,
    /** Empty until the lookup resolves, so nothing is badged on a guess. */
    completed: query.data ?? new Set<string>(),
  };
}
