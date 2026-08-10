import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { reviewAttemptRepository } from '@/db/repositories/reviewAttemptRepository';
import { scoreOnly } from '@/services/gemini';

export function useReviewAttempts(reviewCardId: number) {
  return useQuery({
    queryKey: ['reviewAttempts', reviewCardId],
    queryFn: () => reviewAttemptRepository.listByCard(reviewCardId),
    enabled: Number.isFinite(reviewCardId) && reviewCardId > 0,
  });
}

interface ReviewAttemptInput {
  reviewCardId: number;
  koreanText: string;
  englishText: string;
}

/**
 * Score a re-attempt and log it. Intentionally uses the score-only Gemini call:
 * no feedback, nuance notes or recommendations are generated for reviews.
 */
export function useSubmitReviewAttempt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ reviewCardId, koreanText, englishText }: ReviewAttemptInput) => {
      const scores = await scoreOnly({ koreanText, englishText });

      return reviewAttemptRepository.create({
        reviewCardId,
        englishInput: englishText,
        naturalnessScore: scores.naturalness_score,
        grammarScore: scores.grammar_score,
        meaningClarityScore: scores.meaning_clarity_score,
      });
    },
    onSuccess: (_attempt, variables) => {
      queryClient.invalidateQueries({ queryKey: ['reviewAttempts', variables.reviewCardId] });
    },
  });
}
