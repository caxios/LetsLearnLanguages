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
 * Get daily sentences for the given date.
 * If none exist in the database, generate new ones via Gemini and save them.
 */
export async function getOrCreateDailySentences(date: string) {
  // 1. Check local database first
  const existing = await sentenceRepository.getByDate(date);
  if (existing.length > 0) {
    return existing;
  }

  // 2. Generate new sentences via Gemini
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

  const prompt = `Generate 3 daily Korean sentences for today (${date}). Make them interesting and practical.`;

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

  // 3. Save to local database
  const sentences = validated.map((s) => ({
    koreanText: s.korean_text,
    difficulty: s.difficulty,
    dateAssigned: date,
  }));

  await sentenceRepository.createMany(sentences);

  // 4. Return the newly created sentences
  return sentenceRepository.getByDate(date);
}
