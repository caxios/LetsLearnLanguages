import { desc, eq, inArray } from 'drizzle-orm';

import { db } from '@/db/client';
import { dailySentences, userInputs } from '@/db/schema';

export const sentenceRepository = {
  // Get all sentences for a specific date
  async getByDate(date: string) {
    return db.select().from(dailySentences).where(eq(dailySentences.dateAssigned, date));
  },

  /**
   * Return the most recent `limit` sentences across all dates, newest first.
   * Used to feed the AI prompt so it avoids generating duplicates.
   */
  async getRecent(limit: number = 20) {
    return db
      .select({ koreanText: dailySentences.koreanText })
      .from(dailySentences)
      .orderBy(desc(dailySentences.createdAt), desc(dailySentences.id))
      .limit(limit);
  },

  // Insert new daily sentences
  async createMany(
    sentences: {
      koreanText: string;
      difficulty: 'easy' | 'medium' | 'hard';
      dateAssigned: string;
    }[]
  ) {
    return db.insert(dailySentences).values(sentences).returning();
  },

  /**
   * Swap out every sentence for a date. Past translations are kept: their
   * `daily_sentence_id` is cleared first so the delete does not trip the FK.
   */
  async replaceForDate(
    date: string,
    sentences: {
      koreanText: string;
      difficulty: 'easy' | 'medium' | 'hard';
      dateAssigned: string;
    }[]
  ) {
    return db.transaction((tx) => {
      const doomed = tx
        .select({ id: dailySentences.id })
        .from(dailySentences)
        .where(eq(dailySentences.dateAssigned, date))
        .all()
        .map((row) => row.id);

      if (doomed.length > 0) {
        tx.update(userInputs)
          .set({ dailySentenceId: null })
          .where(inArray(userInputs.dailySentenceId, doomed))
          .run();

        tx.delete(dailySentences).where(eq(dailySentences.dateAssigned, date)).run();
      }

      return tx.insert(dailySentences).values(sentences).returning().all();
    });
  },

  // Mark a sentence as completed
  async markCompleted(id: number) {
    return db.update(dailySentences).set({ isCompleted: true }).where(eq(dailySentences.id, id));
  },
};
