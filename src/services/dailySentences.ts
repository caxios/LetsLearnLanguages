import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';

import { DAILY_SENTENCE_SYSTEM_PROMPT } from '@/constants/prompts';
import { pickRandomTopics } from '@/constants/topics';
import { sentenceRepository } from '@/db/repositories/sentenceRepository';
import { GEMINI_MODEL, generateJson, requireGeminiApiKey } from '@/services/gemini';
import { dailySentencesResponseSchema } from '@/types/sentence';
import { ValidationError, withRetry } from '@/utils/errors';

// Gemini schema for daily sentence generation
const dailySentenceSchema: Schema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      korean_text: {
        type: SchemaType.STRING,
        description: 'A natural Korean sentence',
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

// ---------------------------------------------------------------------------
// Helpers for building a rich, diversity-aware prompt
// ---------------------------------------------------------------------------

/** Map month → Korean season name. */
function getSeason(month: number): string {
  if (month >= 3 && month <= 5) return '봄';
  if (month >= 6 && month <= 8) return '여름';
  if (month >= 9 && month <= 11) return '가을';
  return '겨울';
}

/** Build date/season context line, e.g. "오늘은 2026년 8월 13일 수요일, 여름입니다." */
function buildDateContext(date: string): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const dayOfWeek = format(d, 'EEEE', { locale: ko }); // 월요일, 화요일 ...
  const season = getSeason(month);
  return `오늘은 ${year}년 ${month}월 ${day}일 ${dayOfWeek}, ${season}입니다.`;
}

/**
 * Build the full user prompt with:
 * 1. Date & season context
 * 2. Assigned topics (randomly picked from the pool)
 * 3. Recently generated sentences to avoid
 * 4. Today's sentences to also avoid (for refresh)
 */
function buildPrompt(
  date: string,
  topics: string[],
  recentSentences: string[],
  todayAvoid: string[]
): string {
  const parts: string[] = [];

  // 1. Date & season context
  parts.push(buildDateContext(date));
  parts.push(
    '이 시기에 한국 사람들이 실제로 할 법한 자연스러운 대화 문장을 생성하세요.\n'
  );

  // 2. Assigned topics
  parts.push('오늘의 주제 (각 난이도에 하나씩 배정):');
  topics.forEach((topic, i) => {
    const difficulty = ['easy', 'medium', 'hard'][i];
    parts.push(`- [${difficulty}] ${topic}`);
  });
  parts.push('');

  // 3. Recently generated sentences to avoid
  const allAvoid = [...new Set([...recentSentences, ...todayAvoid])];
  if (allAvoid.length > 0) {
    parts.push(
      '아래는 이미 생성된 문장입니다. 이 문장들과 동일하거나 유사한 문장은 절대 생성하지 마세요:'
    );
    allAvoid.forEach((s) => parts.push(`- "${s}"`));
    parts.push('');
  }

  parts.push('Generate 3 daily Korean sentences matching the topics above.');

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Ask Gemini for three sentences for `date`.
 * `todayAvoid` keeps a refresh from handing back sentences the user already saw.
 * When `replace` is set the day's existing sentences are swapped out entirely.
 */
async function generateAndSave(date: string, todayAvoid: string[], replace = false) {
  const apiKey = requireGeminiApiKey();

  // 1. Fetch recent sentences from DB (for dedup in prompt)
  const recentRows = await sentenceRepository.getRecent(20);
  const recentSentences = recentRows.map((r) => r.koreanText);

  // 2. Pick 3 random topics from the 50-item pool.
  //    The pool is shuffled each time, providing natural variety.
  const topics = pickRandomTopics(3);

  // 3. Build the enriched prompt
  const prompt = buildPrompt(date, topics, recentSentences, todayAvoid);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: dailySentenceSchema,
      temperature: 1.0, // Higher temperature for variety
    },
    systemInstruction: DAILY_SENTENCE_SYSTEM_PROMPT,
  });

  const validated = await withRetry(async () => {
    const jsonResponse = await generateJson(model, prompt);

    const parsed = dailySentencesResponseSchema.safeParse(jsonResponse);
    if (!parsed.success) {
      throw new ValidationError(
        `Gemini daily sentence response — ${parsed.error.issues
          .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
          .join(', ')}`
      );
    }

    return parsed.data;
  });

  const sentences = validated.map((s) => ({
    koreanText: s.korean_text,
    difficulty: s.difficulty,
    dateAssigned: date,
  }));

  if (replace) {
    await sentenceRepository.replaceForDate(date, sentences);
  } else {
    await sentenceRepository.createMany(sentences);
  }

  return sentenceRepository.getByDate(date);
}

/**
 * Get daily sentences for the given date.
 * If none exist in the database, generate new ones via Gemini and save them.
 */
export async function getOrCreateDailySentences(date: string) {
  // 1. Check local database first
  const existing = await sentenceRepository.getByDate(date);
  if (existing.length > 0) {
    return existing;
  }

  // 2. Generate new sentences via Gemini and save them
  return generateAndSave(date, []);
}

/**
 * Swap today's sentences for a brand new set of three.
 * Past translations survive — only the daily list is cleared.
 */
export async function refreshDailySentences(date: string) {
  const existing = await sentenceRepository.getByDate(date);
  return generateAndSave(
    date,
    existing.map((sentence) => sentence.koreanText),
    true
  );
}

