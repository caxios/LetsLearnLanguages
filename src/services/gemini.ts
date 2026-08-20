import {
  GoogleGenerativeAI,
  GoogleGenerativeAIFetchError,
  SchemaType,
  type Content,
  type GenerativeModel,
  type Schema,
} from '@google/generative-ai';

import {
  EVALUATION_SYSTEM_PROMPT,
  REVIEW_SCORING_SYSTEM_PROMPT,
  TUTOR_CHAT_SYSTEM_PROMPT,
} from '@/constants/prompts';
import { useSettingsStore } from '@/stores/useSettingsStore';
import {
  evaluationResponseSchema,
  scoreOnlyResponseSchema,
  type EvaluationResponse,
  type ScoreOnlyResponse,
} from '@/types/evaluation';
import type { ChatMessage, TutorChatContext } from '@/types/chat';
import { ApiKeyMissingError, ApiResponseError, ValidationError, withRetry } from '@/utils/errors';
import { applyGrammarTags, autoTagKnownTerms, stripGrammarTags } from '@/utils/grammarTags';

export const GEMINI_MODEL = 'gemini-2.5-flash';

// Gemini response schema (enforces structured JSON output)
const evaluationSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    evaluation: {
      type: SchemaType.OBJECT,
      properties: {
        naturalness_score: {
          type: SchemaType.INTEGER,
          description: 'Score for how natural the English sounds (0-100)',
        },
        grammar_score: {
          type: SchemaType.INTEGER,
          description: 'Score for grammatical correctness (0-100)',
        },
        meaning_clarity_score: {
          type: SchemaType.INTEGER,
          description: 'Score for how clearly the meaning is conveyed (0-100)',
        },
        feedback: {
          type: SchemaType.STRING,
          description: 'Overall feedback written in Korean',
        },
        grammar_terms: {
          type: SchemaType.ARRAY,
          items: { type: SchemaType.STRING },
          description:
            'Korean names of every grammar point named in `feedback`, spelled exactly as they appear there (예: 현재완료, 관계대명사). Empty array if none.',
        },
      },
      required: [
        'naturalness_score',
        'grammar_score',
        'meaning_clarity_score',
        'feedback',
        'grammar_terms',
      ],
    },
    recommendations: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          sentence: {
            type: SchemaType.STRING,
            description: 'Recommended English sentence',
          },
          context_and_nuance: {
            type: SchemaType.STRING,
            description: 'Context and nuance explanation in Korean',
          },
          korean_translation: {
            type: SchemaType.STRING,
            description:
              'Natural Korean translation of the recommended English sentence that preserves its nuance and tone (not literal)',
          },
          grammar_explanation: {
            type: SchemaType.STRING,
            description: 'Grammar explanation in Korean',
          },
          grammar_terms: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.STRING },
            description:
              'Korean names of every grammar point named in `grammar_explanation` or `context_and_nuance`, spelled exactly as they appear there. Empty array if none.',
          },
        },
        required: [
          'sentence',
          'context_and_nuance',
          'korean_translation',
          'grammar_explanation',
          'grammar_terms',
        ],
      },
    },
  },
  required: ['evaluation', 'recommendations'],
};

/** Reads the key from settings, throwing the shared "configure me" error when absent. */
export function requireGeminiApiKey(): string {
  const apiKey = useSettingsStore.getState().geminiApiKey;
  if (!apiKey) {
    throw new ApiKeyMissingError('gemini');
  }
  return apiKey;
}

// Model instances are cached per API key so a key change in Settings takes effect.
let _model: GenerativeModel | null = null;
let _modelApiKey: string | null = null;

function getModel(): GenerativeModel {
  const apiKey = requireGeminiApiKey();

  if (_model && _modelApiKey === apiKey) {
    return _model;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  _model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: evaluationSchema,
      temperature: 0.7,
    },
    systemInstruction: EVALUATION_SYSTEM_PROMPT,
  });
  _modelApiKey = apiKey;

  return _model;
}

/**
 * Run a prompt and hand back the raw response text.
 * Transport failures become `ApiResponseError` so `withRetry` can decide what is retryable.
 */
export async function generateText(model: GenerativeModel, prompt: string): Promise<string> {
  try {
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (error) {
    if (error instanceof GoogleGenerativeAIFetchError) {
      throw new ApiResponseError('Gemini', error.status ?? 0, error.message);
    }
    throw error;
  }
}

/**
 * Run a prompt and parse the JSON body out of the response.
 */
export async function generateJson(model: GenerativeModel, prompt: string): Promise<unknown> {
  const responseText = await generateText(model, prompt);

  try {
    return JSON.parse(responseText);
  } catch {
    throw new Error(`Failed to parse Gemini response as JSON: ${responseText.substring(0, 200)}`);
  }
}

/**
 * Evaluate a user's English translation of a Korean sentence.
 */
export async function evaluate(input: {
  koreanText: string;
  englishText: string;
}): Promise<EvaluationResponse> {
  const model = getModel();

  const prompt = `
Korean sentence (원문): "${input.koreanText}"
User's English translation (사용자 번역): "${input.englishText}"

Please evaluate this translation and provide recommended alternatives.
  `.trim();

  return withRetry(async () => {
    const jsonResponse = await generateJson(model, prompt);

    const validated = evaluationResponseSchema.safeParse(jsonResponse);
    if (!validated.success) {
      console.error('Zod validation errors:', validated.error.issues);
      throw new ValidationError(
        `Gemini evaluation response — ${validated.error.issues
          .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
          .join(', ')}`
      );
    }

    return tagGrammarTerms(validated.data);
  });
}

/**
 * Turn the reported term list into `[[tags]]` the UI can linkify.
 *
 * Done here rather than asked of the model: a schema-required array is enforced
 * by constrained decoding, whereas markup inside a string value is only a hint
 * and gets dropped. Anything the model missed falls back to the known-terms
 * dictionary, so feedback still links even when the array comes back empty.
 */
function tagGrammarTerms(response: EvaluationResponse): EvaluationResponse {
  const tag = (text: string, terms: string[]) =>
    terms.length > 0 ? applyGrammarTags(text, terms) : autoTagKnownTerms(text);

  return {
    ...response,
    evaluation: {
      ...response.evaluation,
      feedback: tag(response.evaluation.feedback, response.evaluation.grammar_terms),
    },
    recommendations: response.recommendations.map((rec) => ({
      ...rec,
      context_and_nuance: tag(rec.context_and_nuance, rec.grammar_terms),
      grammar_explanation: tag(rec.grammar_explanation, rec.grammar_terms),
    })),
  };
}

// --- Lightweight review scoring -------------------------------------------

const scoreOnlySchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    naturalness_score: {
      type: SchemaType.INTEGER,
      description: 'Score for how natural the English sounds (0-100)',
    },
    grammar_score: {
      type: SchemaType.INTEGER,
      description: 'Score for grammatical correctness (0-100)',
    },
    meaning_clarity_score: {
      type: SchemaType.INTEGER,
      description: 'Score for how clearly the meaning is conveyed (0-100)',
    },
  },
  required: ['naturalness_score', 'grammar_score', 'meaning_clarity_score'],
};

let _scoreModel: GenerativeModel | null = null;
let _scoreModelApiKey: string | null = null;

function getScoreModel(): GenerativeModel {
  const apiKey = requireGeminiApiKey();

  if (_scoreModel && _scoreModelApiKey === apiKey) {
    return _scoreModel;
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  _scoreModel = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: scoreOnlySchema,
      // Low temperature: the same translation should score the same way twice.
      temperature: 0.2,
    },
    systemInstruction: REVIEW_SCORING_SYSTEM_PROMPT,
  });
  _scoreModelApiKey = apiKey;

  return _scoreModel;
}

/**
 * Score a review re-attempt. Deliberately returns only the three numbers —
 * no feedback, nuance notes or recommended sentences.
 */
export async function scoreOnly(input: {
  koreanText: string;
  englishText: string;
}): Promise<ScoreOnlyResponse> {
  const model = getScoreModel();

  const prompt = `
Korean sentence (원문): "${input.koreanText}"
User's English translation (사용자 번역): "${input.englishText}"

Score this translation. Return only the three scores.
  `.trim();

  return withRetry(async () => {
    const jsonResponse = await generateJson(model, prompt);

    const validated = scoreOnlyResponseSchema.safeParse(jsonResponse);
    if (!validated.success) {
      throw new ValidationError(
        `Gemini review score response — ${validated.error.issues
          .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
          .join(', ')}`
      );
    }

    return validated.data;
  });
}

// --- Follow-up Q&A (AI tutor chat) ----------------------------------------

/**
 * The model's reply to the injected context. It is never displayed — it exists
 * so the conversation history alternates user/model, which the API requires
 * before the learner's first real question can be appended.
 */
const CONTEXT_ACKNOWLEDGEMENT =
  '네, 방금 받은 평가 내용을 모두 확인했어요. 궁금한 점을 물어봐 주세요.';

let _tutorModel: GenerativeModel | null = null;
let _tutorModelApiKey: string | null = null;

function getTutorModel(): GenerativeModel {
  const apiKey = requireGeminiApiKey();

  if (_tutorModel && _tutorModelApiKey === apiKey) return _tutorModel;

  const genAI = new GoogleGenerativeAI(apiKey);
  _tutorModel = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    // Prose, not JSON — note the absence of responseMimeType/responseSchema that
    // every other model instance in this file sets.
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    },
    systemInstruction: TUTOR_CHAT_SYSTEM_PROMPT,
  });
  _tutorModelApiKey = apiKey;

  return _tutorModel;
}

/** The evaluation, rendered as the opening message of the conversation. */
function buildContextPrompt(context: TutorChatContext): string {
  const recommendations = context.recommendations
    .map((rec, index) =>
      [
        `${index + 1}. "${rec.sentence}"`,
        // Older rows have no Korean translation; an empty label is just noise.
        rec.koreanTranslation ? `   한국어: ${rec.koreanTranslation}` : '',
        `   문법 설명: ${stripGrammarTags(rec.grammarExplanation)}`,
      ]
        .filter(Boolean)
        .join('\n')
    )
    .join('\n');

  return [
    '학습자가 방금 받은 평가입니다. 앞으로의 모든 질문은 이 내용에 대한 것입니다.',
    '',
    `[한국어 원문]\n${context.koreanText}`,
    '',
    `[학습자가 쓴 영어 번역]\n${context.englishInput}`,
    '',
    // Stored feedback carries [[...]] markup for the grammar links; the model
    // should read the words, not the app's formatting.
    `[받은 피드백]\n${stripGrammarTags(context.feedback)}`,
    '',
    `[추천 문장]\n${recommendations || '(없음)'}`,
  ].join('\n');
}

/**
 * Ask the tutor one follow-up question about an evaluation.
 *
 * Stateless by design: the caller owns the conversation and passes it in, so a
 * failed turn can be retried and the screen's state stays the single source of
 * truth. The context is injected as the opening turn rather than baked into the
 * system prompt because the model instance is cached across evaluations — the
 * part that changes has to travel with the conversation.
 */
export async function askFollowUpQuestion(input: {
  context: TutorChatContext;
  history: ChatMessage[];
  question: string;
}): Promise<string> {
  const model = getTutorModel();

  const history: Content[] = [
    { role: 'user', parts: [{ text: buildContextPrompt(input.context) }] },
    { role: 'model', parts: [{ text: CONTEXT_ACKNOWLEDGEMENT }] },
    // A question that never got an answer would leave two user turns in a row.
    ...input.history
      .filter((message) => !message.failed)
      .map((message) => ({ role: message.role, parts: [{ text: message.text }] })),
  ];

  return withRetry(async () => {
    try {
      const chat = model.startChat({ history });
      const result = await chat.sendMessage(input.question);
      const answer = result.response.text().trim();

      if (!answer) {
        throw new ApiResponseError('Gemini', 0, 'Tutor returned an empty answer');
      }
      return answer;
    } catch (error) {
      if (error instanceof GoogleGenerativeAIFetchError) {
        throw new ApiResponseError('Gemini', error.status ?? 0, error.message);
      }
      throw error;
    }
  });
}
