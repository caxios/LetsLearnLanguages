import { format } from 'date-fns';
import { eq, lte } from 'drizzle-orm';

import { db } from '@/db/client';
import { reviewCards } from '@/db/schema';

export const reviewRepository = {
  // Get all cards due for review today or earlier
  async getDueCards() {
    const today = format(new Date(), 'yyyy-MM-dd');
    return db.select().from(reviewCards).where(lte(reviewCards.nextReviewDate, today));
  },

  // Create a new review card from an evaluation
  async create(data: { evaluationId: number; koreanText: string; bestEnglish: string }) {
    const today = format(new Date(), 'yyyy-MM-dd');
    return db
      .insert(reviewCards)
      .values({
        evaluationId: data.evaluationId,
        koreanText: data.koreanText,
        bestEnglish: data.bestEnglish,
        nextReviewDate: today, // Due immediately for first review
      })
      .returning();
  },

  // Update a card after review using SM-2 algorithm results
  async updateAfterReview(
    id: number,
    updates: {
      easeFactor: number;
      intervalDays: number;
      repetitions: number;
      nextReviewDate: string;
    }
  ) {
    return db.update(reviewCards).set(updates).where(eq(reviewCards.id, id));
  },
};
