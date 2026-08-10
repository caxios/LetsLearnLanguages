import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { reviewRepository } from '@/db/repositories/reviewRepository';

export function useReviewCardForEvaluation(evaluationId: number) {
  return useQuery({
    queryKey: ['reviewCards', 'forEvaluation', evaluationId],
    queryFn: () => reviewRepository.getByEvaluationId(evaluationId),
    enabled: Number.isFinite(evaluationId) && evaluationId > 0,
  });
}

export function useAddToReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { evaluationId: number; koreanText: string; bestEnglish: string }) =>
      reviewRepository.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviewCards'] });
    },
  });
}
