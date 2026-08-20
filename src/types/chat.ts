/** One turn in the tutor chat. `model` is Gemini's own role name, kept as-is. */
export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  /** Set when the request for this question failed, so the bubble can offer a retry. */
  failed?: boolean;
}

/**
 * What the tutor needs to know about the evaluation the user is asking about.
 *
 * Deliberately a plain shape rather than the stored row: the chat only needs the
 * parts the learner can see on screen, and keeping it small keeps the injected
 * context short enough to resend on every turn.
 */
export interface TutorChatContext {
  koreanText: string;
  englishInput: string;
  feedback: string;
  recommendations: {
    sentence: string;
    koreanTranslation: string;
    grammarExplanation: string;
  }[];
}

/**
 * Structural on purpose — both the stored evaluation (review deck, practice
 * screen) and the result screen's query data satisfy it without either file
 * having to import the other.
 */
type EvaluationLike = {
  input: { koreanText: string; englishInput: string };
  feedback: string;
  recommendations: {
    sentence: string;
    /** Nullable: rows written before Korean translations were part of the schema. */
    koreanTranslation: string | null;
    grammarExplanation: string;
  }[];
};

export function toTutorChatContext(evaluation: EvaluationLike): TutorChatContext {
  return {
    koreanText: evaluation.input.koreanText,
    englishInput: evaluation.input.englishInput,
    feedback: evaluation.feedback,
    recommendations: evaluation.recommendations.map((rec) => ({
      sentence: rec.sentence,
      koreanTranslation: rec.koreanTranslation ?? '',
      grammarExplanation: rec.grammarExplanation,
    })),
  };
}
