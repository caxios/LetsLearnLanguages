import {
  GoogleGenerativeAI,
  SchemaType,
  type Schema,
  type Tool,
} from '@google/generative-ai';

import {
  GROUNDED_SENTENCE_SYSTEM_PROMPT,
  TOPIC_SENTENCE_SYSTEM_PROMPT,
} from '@/constants/prompts';
import {
  GEMINI_MODEL,
  generateJson,
  generateText,
  requireGeminiApiKey,
} from '@/services/gemini';
import { groundedSentenceSchema, topicSentencesResponseSchema } from '@/types/sentence';
import { ValidationError, withRetry } from '@/utils/errors';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface TopicSentence {
  koreanText: string;
  difficulty: Difficulty;
  /** True for the one sentence generated with Google Search grounding. */
  isGrounded: boolean;
}

/** How many ungrounded sentences phase A produces. */
const REGULAR_COUNT = 4;

const topicSentenceSchema: Schema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      korean_text: {
        type: SchemaType.STRING,
        description: 'A natural Korean sentence about the given topic',
      },
      difficulty: {
        type: SchemaType.STRING,
        // `format: 'enum'` is what constrains the model to these three values.
        format: 'enum',
        enum: ['easy', 'medium', 'hard'],
        description: 'Difficulty level',
      },
    },
    required: ['korean_text', 'difficulty'],
  },
};

/**
 * Gemini 2.x wants the `google_search` tool, but the 0.24.1 typings only carry
 * the 1.5-era `googleSearchRetrieval`. The SDK forwards `tools` into the request
 * body untouched, so the cast is the whole workaround.
 */
const GOOGLE_SEARCH_TOOL = { googleSearch: {} } as unknown as Tool;

const DIFFICULTY_RANK: Record<Difficulty, number> = { easy: 0, medium: 1, hard: 2 };

/** Phase A — four ordinary sentences, structured JSON output. */
async function generateRegularSentences(apiKey: string, topic: string): Promise<TopicSentence[]> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: topicSentenceSchema,
      temperature: 1.0, // Higher temperature for variety
    },
    systemInstruction: TOPIC_SENTENCE_SYSTEM_PROMPT,
  });

  const prompt = [
    `주제: ${topic}`,
    '',
    `이 주제 하나에 대해 한국어 문장 ${REGULAR_COUNT}개를 만드세요.`,
    '난이도 배분: easy 1개, medium 2개, hard 1개.',
  ].join('\n');

  const validated = await withRetry(async () => {
    const jsonResponse = await generateJson(model, prompt);

    const parsed = topicSentencesResponseSchema.safeParse(jsonResponse);
    if (!parsed.success) {
      throw new ValidationError(
        `Gemini topic sentence response — ${parsed.error.issues
          .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
          .join(', ')}`
      );
    }

    return parsed.data;
  });

  return validated.map((sentence) => ({
    koreanText: sentence.korean_text,
    difficulty: sentence.difficulty,
    isGrounded: false,
  }));
}

/**
 * Pull the JSON object out of a grounded reply.
 * Search grounding disallows `responseMimeType: 'application/json'`, so the model
 * answers in prose-shaped text and may wrap the object in a code fence.
 */
function parseGroundedJson(text: string): unknown {
  const withoutFences = text.replace(/```(?:json)?/gi, '').trim();
  const start = withoutFences.indexOf('{');
  const end = withoutFences.lastIndexOf('}');

  if (start === -1 || end <= start) {
    throw new ValidationError(
      `grounded sentence response had no JSON object: ${text.substring(0, 200)}`
    );
  }

  try {
    return JSON.parse(withoutFences.slice(start, end + 1));
  } catch {
    throw new ValidationError(
      `grounded sentence response was not valid JSON: ${text.substring(0, 200)}`
    );
  }
}

/** Phase B — one timely sentence, backed by a live Google Search. */
async function generateGroundedSentence(apiKey: string, topic: string): Promise<TopicSentence> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    // No `responseSchema` here: structured output and search grounding cannot be
    // requested together, so the reply is parsed by hand instead.
    generationConfig: { temperature: 1.0 },
    systemInstruction: GROUNDED_SENTENCE_SYSTEM_PROMPT,
    tools: [GOOGLE_SEARCH_TOOL],
  });

  const prompt = [
    `주제: ${topic}`,
    '',
    '이 주제와 관련해 지금 실제로 화제가 되는 것을 검색한 뒤,',
    '그 구체적인 내용을 담은 한국어 문장 1개를 만드세요.',
    'JSON 객체 하나만 출력하세요.',
  ].join('\n');

  // One retry only: grounded generation is the optional half of the pair, and a
  // long backoff here would hold up the four sentences that already succeeded.
  const parsed = await withRetry(async () => {
    const text = await generateText(model, prompt);

    const result = groundedSentenceSchema.safeParse(parseGroundedJson(text));
    if (!result.success) {
      throw new ValidationError(
        `Gemini grounded sentence response — ${result.error.issues
          .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
          .join(', ')}`
      );
    }

    return result.data;
  }, 1);

  return {
    koreanText: parsed.korean_text,
    difficulty: parsed.difficulty,
    isGrounded: true,
  };
}

/**
 * Five practice sentences for a single topic: four written from the model's own
 * knowledge plus one grounded in a live search, so the set always contains
 * something timely.
 *
 * Both phases run concurrently. The grounded call is best-effort — if search is
 * unavailable or over quota the user simply gets the other four rather than an
 * error, since those are the bulk of the exercise.
 *
 * These sentences are never persisted; only the evaluation of a translation is.
 */
export async function generateTopicSentences(topic: string): Promise<TopicSentence[]> {
  const apiKey = requireGeminiApiKey();

  const [regular, grounded] = await Promise.allSettled([
    generateRegularSentences(apiKey, topic),
    generateGroundedSentence(apiKey, topic),
  ]);

  // The regular batch is the exercise itself, so its failure is the user's problem.
  if (regular.status === 'rejected') {
    throw regular.reason;
  }

  if (grounded.status === 'rejected') {
    console.warn('[topicSentences] grounded sentence unavailable:', grounded.reason);
    return sortByDifficulty(regular.value);
  }

  return sortByDifficulty([grounded.value, ...regular.value]);
}

/** Easy first, and the timely sentence leads its difficulty group. */
function sortByDifficulty(sentences: TopicSentence[]): TopicSentence[] {
  return [...sentences].sort((a, b) => {
    const byDifficulty = DIFFICULTY_RANK[a.difficulty] - DIFFICULTY_RANK[b.difficulty];
    if (byDifficulty !== 0) return byDifficulty;
    return Number(b.isGrounded) - Number(a.isGrounded);
  });
}
