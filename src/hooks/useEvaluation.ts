import { useMutation, useQueryClient } from '@tanstack/react-query';

import { evaluationRepository } from '@/db/repositories/evaluationRepository';
import { reviewRepository } from '@/db/repositories/reviewRepository';
import { evaluate } from '@/services/gemini';

interface EvaluationInput {
  koreanText: string;
  englishText: string;
  inputMethod: 'voice' | 'text';
  audioUri?: string;
  dailySentenceId?: number;
}

export function useEvaluation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: EvaluationInput) => {
      // 1. Call Gemini API
      const response = await evaluate({
        koreanText: input.koreanText,
        englishText: input.englishText,
      });

      // 2. Save to local database
      const evaluationId = await evaluationRepository.saveComplete({
        koreanText: input.koreanText,
        englishInput: input.englishText,
        inputMethod: input.inputMethod,
        audioUri: input.audioUri,
        dailySentenceId: input.dailySentenceId,
        naturalnessScore: response.evaluation.naturalness_score,
        grammarScore: response.evaluation.grammar_score,
        meaningClarityScore: response.evaluation.meaning_clarity_score,
        feedback: response.evaluation.feedback,
        rawJson: JSON.stringify(response),
        recommendations: response.recommendations.map((rec) => ({
          sentence: rec.sentence,
          contextAndNuance: rec.context_and_nuance,
          grammarExplanation: rec.grammar_explanation,
        })),
      });

      // 3. Create a review card from the best recommendation
      if (response.recommendations.length > 0) {
        await reviewRepository.create({
          evaluationId,
          koreanText: input.koreanText,
          bestEnglish: response.recommendations[0].sentence,
        });
      }

      return { evaluationId, response };
    },

    onSuccess: () => {
      // Invalidate related queries so they refetch
      queryClient.invalidateQueries({ queryKey: ['dailySentences'] });
      queryClient.invalidateQueries({ queryKey: ['recentEvaluations'] });
      queryClient.invalidateQueries({ queryKey: ['reviewCards'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}
