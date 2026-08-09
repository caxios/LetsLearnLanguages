import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { dailySentences } from '@/db/schema';

export const sentenceRepository = {
  // Get all sentences for a specific date
  async getByDate(date: string) {
    return db.select().from(dailySentences).where(eq(dailySentences.dateAssigned, date));
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

  // Mark a sentence as completed
  async markCompleted(id: number) {
    return db.update(dailySentences).set({ isCompleted: true }).where(eq(dailySentences.id, id));
  },
};
