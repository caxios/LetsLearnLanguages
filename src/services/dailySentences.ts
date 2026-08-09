// The database read path is final; Gemini generation lands in Phase 4.
import { sentenceRepository } from '@/db/repositories/sentenceRepository';

/**
 * Get daily sentences for the given date.
 * If none exist in the database, generate new ones via Gemini and save them.
 */
export async function getOrCreateDailySentences(date: string) {
  const existing = await sentenceRepository.getByDate(date);
  if (existing.length > 0) {
    return existing;
  }

  throw new Error('Daily sentence generation is not connected yet (Phase 4).');
}
