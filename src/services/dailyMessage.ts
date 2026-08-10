import { GoogleGenerativeAI, SchemaType, type Schema } from '@google/generative-ai';

import { DAILY_MESSAGE_SYSTEM_PROMPT } from '@/constants/prompts';
import { dailyMessageRepository } from '@/db/repositories/dailyMessageRepository';
import { GEMINI_MODEL, generateJson, requireGeminiApiKey } from '@/services/gemini';
import { dailyMessageResponseSchema } from '@/types/message';
import { ValidationError, withRetry } from '@/utils/errors';

const dailyMessageSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    message: {
      type: SchemaType.STRING,
      description: 'One short encouraging sentence in Korean, ending with a single emoji',
    },
  },
  required: ['message'],
};

/** Ask Gemini for one encouragement and cache it against `date`. */
async function generateAndSave(date: string) {
  const apiKey = requireGeminiApiKey();

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: dailyMessageSchema,
      temperature: 1.1, // Warmth over precision — and a different line every day.
    },
    systemInstruction: DAILY_MESSAGE_SYSTEM_PROMPT,
  });

  const prompt = `Write today's encouragement for ${date}. Make it feel personal and fresh.`;

  const validated = await withRetry(async () => {
    const jsonResponse = await generateJson(model, prompt);

    const parsed = dailyMessageResponseSchema.safeParse(jsonResponse);
    if (!parsed.success) {
      throw new ValidationError(
        `Gemini daily message response — ${parsed.error.issues
          .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
          .join(', ')}`
      );
    }

    return parsed.data;
  });

  return dailyMessageRepository.setForDate(date, validated.message.trim());
}

/**
 * The encouragement shown next to the streak badge. Written once per day and
 * served from SQLite after that, so it stays put while the app is used.
 */
export async function getOrCreateDailyMessage(date: string) {
  const existing = await dailyMessageRepository.getByDate(date);
  if (existing) {
    return existing;
  }

  return generateAndSave(date);
}

/** Write a new encouragement for `date`, replacing today's. */
export async function refreshDailyMessage(date: string) {
  return generateAndSave(date);
}
