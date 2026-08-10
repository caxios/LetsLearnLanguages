import {
  GoogleGenerativeAI,
  GoogleGenerativeAIFetchError,
  SchemaType,
  type GenerativeModel,
  type Schema,
} from '@google/generative-ai';

import { EVALUATION_SYSTEM_PROMPT, REVIEW_SCORING_SYSTEM_PROMPT } from '@/constants/prompts';
import { useSettingsStore } from '@/stores/useSettingsStore';
import {
  evaluationResponseSchema,
  scoreOnlyResponseSchema,
  type EvaluationResponse,
  type ScoreOnlyResponse,
} from '@/types/evaluation';
import { ApiKeyMissingError, ApiResponseError, ValidationError, withRetry } from '@/utils/errors';

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
      },
      required: ['naturalness_score', 'grammar_score', 'meaning_clarity_score', 'feedback'],
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
        },
        required: [
          'sentence',
          'context_and_nuance',
          'korean_translation',
          'grammar_explanation',
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
 * Run a prompt and parse the JSON body out of the response.
 * Transport failures become `ApiResponseError` so `withRetry` can decide what is retryable.
 */
export async function generateJson(model: GenerativeModel, prompt: string): Promise<unknown> {
  let responseText: string;

  try {
    const result = await model.generateContent(prompt);
    responseText = result.response.text();
  } catch (error) {
    if (error instanceof GoogleGenerativeAIFetchError) {
      throw new ApiResponseError('Gemini', error.status ?? 0, error.message);
    }
    throw error;
  }

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

    return validated.data;
  });
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
