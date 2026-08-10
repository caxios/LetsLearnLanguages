import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { reviewRepository } from '@/db/repositories/reviewRepository';

export function useReviewCardForEvaluation(evaluationId: number) {
  return useQuery({
    queryKey: ['reviewCards', 'forEvaluation', evaluationId],
    queryFn: () => reviewRepository.getByEvaluationId(evaluationId),
    enabled: Number.isFinite(evaluationId) && evaluationId > 0,
  });
}

interface BookmarkInput {
  evaluationId: number;
  koreanText: string;
  bestEnglish: string;
}

/**
 * Bookmark toggle for the result screen: adds the evaluation to the review deck,
 * or removes it again if it is already bookmarked.
 */
export function useToggleReviewBookmark() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ bookmarked, ...data }: BookmarkInput & { bookmarked: boolean }) => {
      if (bookmarked) {
        await reviewRepository.deleteByEvaluationId(data.evaluationId);
        return false;
      }

      await reviewRepository.create(data);
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviewCards'] });
    },
  });
}
