import { desc, eq, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { reviewAttempts } from '@/db/schema';

export const reviewAttemptRepository = {
  /** Log a re-attempt at a bookmarked card together with its three scores. */
  async create(data: {
    reviewCardId: number;
    englishInput: string;
    naturalnessScore: number;
    grammarScore: number;
    meaningClarityScore: number;
  }) {
    const overallScore = Math.round(
      data.naturalnessScore * 0.4 + data.grammarScore * 0.35 + data.meaningClarityScore * 0.25
    );

    const [row] = await db
      .insert(reviewAttempts)
      .values({ ...data, overallScore })
      .returning();

    return row;
  },

  /** How many review attempts have been completed across every card. */
  async countAll(): Promise<number> {
    const [row] = await db.select({ count: sql<number>`count(*)` }).from(reviewAttempts);
    return row?.count ?? 0;
  },

  /** Every attempt at a card, newest first. */
  async listByCard(reviewCardId: number) {
    return db
      .select()
      .from(reviewAttempts)
      .where(eq(reviewAttempts.reviewCardId, reviewCardId))
      .orderBy(desc(reviewAttempts.createdAt), desc(reviewAttempts.id));
  },
};
