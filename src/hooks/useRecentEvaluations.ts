import { useQuery } from '@tanstack/react-query';

import { evaluationRepository } from '@/db/repositories/evaluationRepository';

export function useRecentEvaluations(limit: number = 10) {
  return useQuery({
    queryKey: ['recentEvaluations', limit],
    queryFn: () => evaluationRepository.getRecent(limit),
  });
}
