import { useQuery } from '@tanstack/react-query';

import { evaluationRepository } from '@/db/repositories/evaluationRepository';

export function useEvaluationResult(id: number) {
  return useQuery({
    queryKey: ['evaluation', id],
    queryFn: () => evaluationRepository.getById(id),
    enabled: Number.isFinite(id) && id > 0,
  });
}
