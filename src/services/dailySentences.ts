import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai';

import { DAILY_SENTENCE_SYSTEM_PROMPT } from '@/constants/prompts';
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

/**
 * Ask Gemini for three sentences for `date`.
 * `avoid` keeps a refresh from handing back sentences the user already saw.
 * When `replace` is set the day's existing sentences are swapped out entirely.
 */
async function generateAndSave(date: string, avoid: string[], replace = false) {
  const apiKey = requireGeminiApiKey();

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

  const avoidClause = avoid.length
    ? `\n\nThe user has already practiced the sentences below today. Do NOT repeat them, and do not produce close paraphrases of them:\n${avoid
        .map((text) => `- ${text}`)
        .join('\n')}`
    : '';

  const prompt = `Generate 3 daily Korean sentences for today (${date}). Make them interesting and practical.${avoidClause}`;

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
