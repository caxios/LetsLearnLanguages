import { useMutation, useQueryClient } from '@tanstack/react-query';

import { evaluationRepository } from '@/db/repositories/evaluationRepository';
import { sentenceRepository } from '@/db/repositories/sentenceRepository';
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
          koreanTranslation: rec.korean_translation,
          grammarExplanation: rec.grammar_explanation,
        })),
      });

      // A daily sentence counts as practiced only once an attempt has been graded —
      // opening the card is not practice.
      if (input.dailySentenceId) {
        await sentenceRepository.markCompleted(input.dailySentenceId);
      }

      // Review cards are opt-in: the user bookmarks a result from the result screen.
      return { evaluationId, response };
    },

    onSuccess: () => {
      // Invalidate related queries so they refetch
      queryClient.invalidateQueries({ queryKey: ['dailySentences'] });
      queryClient.invalidateQueries({ queryKey: ['recentEvaluations'] });
      // Re-opening the sentence must show this attempt, not the one before it.
      queryClient.invalidateQueries({ queryKey: ['evaluation', 'forSentence'] });
      queryClient.invalidateQueries({ queryKey: ['reviewCards'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}
