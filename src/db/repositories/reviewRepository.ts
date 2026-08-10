import { format } from 'date-fns';
import { eq, inArray, lte, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { reviewAttempts, reviewCards } from '@/db/schema';

export const reviewRepository = {
  // Get all cards due for review today or earlier
  async getDueCards() {
    const today = format(new Date(), 'yyyy-MM-dd');
    return db.select().from(reviewCards).where(lte(reviewCards.nextReviewDate, today));
  },

  // The card created for a given evaluation, if one exists
  async getByEvaluationId(evaluationId: number) {
    const rows = await db
      .select()
      .from(reviewCards)
      .where(eq(reviewCards.evaluationId, evaluationId))
      .limit(1);

    return rows[0] ?? null;
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

  // Remove the card bookmarked for an evaluation (un-bookmarking)
  async deleteByEvaluationId(evaluationId: number) {
    // Attempts reference the card and foreign keys are enforced, so they go first.
    return db.transaction((tx) => {
      const doomed = tx
        .select({ id: reviewCards.id })
        .from(reviewCards)
        .where(eq(reviewCards.evaluationId, evaluationId))
        .all()
        .map((row) => row.id);

      if (doomed.length === 0) return;

      tx.delete(reviewAttempts).where(inArray(reviewAttempts.reviewCardId, doomed)).run();
      tx.delete(reviewCards).where(eq(reviewCards.evaluationId, evaluationId)).run();
    });
  },

  /** Drop a single card from the deck, together with every attempt logged against it. */
  async deleteById(id: number) {
    return db.transaction((tx) => {
      tx.delete(reviewAttempts).where(eq(reviewAttempts.reviewCardId, id)).run();
      tx.delete(reviewCards).where(eq(reviewCards.id, id)).run();
    });
  },

  /** How many cards are in the deck, due or not. */
  async countAll(): Promise<number> {
    const [row] = await db.select({ count: sql<number>`count(*)` }).from(reviewCards);
    return row?.count ?? 0;
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
