import { desc, eq, sql } from 'drizzle-orm';

import { db } from '@/db/client';
import { evaluations, recommendations, userInputs } from '@/db/schema';

export const evaluationRepository = {
  // Save a complete evaluation (input + scores + recommendations) in a transaction.
  //
  // NOTE: the expo-sqlite driver runs transactions synchronously — the callback must
  // not be `async`, or `commit` fires at the first `await` and the remaining writes
  // land outside the transaction. Hence `.get()` / `.run()` instead of `await`.
  async saveComplete(data: {
    koreanText: string;
    englishInput: string;
    inputMethod: 'voice' | 'text';
    audioUri?: string;
    dailySentenceId?: number;
    naturalnessScore: number;
    grammarScore: number;
    meaningClarityScore: number;
    feedback: string;
    rawJson: string;
    recommendations: {
      sentence: string;
      contextAndNuance: string;
      koreanTranslation: string;
      grammarExplanation: string;
    }[];
  }) {
    return db.transaction((tx) => {
      // 1. Insert user input
      const input = tx
        .insert(userInputs)
        .values({
          koreanText: data.koreanText,
          englishInput: data.englishInput,
          inputMethod: data.inputMethod,
          audioUri: data.audioUri,
          dailySentenceId: data.dailySentenceId,
        })
        .returning()
        .get();

      // 2. Calculate overall score (weighted average)
      const overallScore = Math.round(
        data.naturalnessScore * 0.4 + data.grammarScore * 0.35 + data.meaningClarityScore * 0.25
      );

      // 3. Insert evaluation
      const evaluation = tx
        .insert(evaluations)
        .values({
          userInputId: input.id,
          naturalnessScore: data.naturalnessScore,
          grammarScore: data.grammarScore,
          meaningClarityScore: data.meaningClarityScore,
          overallScore,
          feedback: data.feedback,
          rawJson: data.rawJson,
        })
        .returning()
        .get();

      // 4. Insert recommendations
      if (data.recommendations.length > 0) {
        tx.insert(recommendations)
          .values(
            data.recommendations.map((rec) => ({
              evaluationId: evaluation.id,
              sentence: rec.sentence,
              contextAndNuance: rec.contextAndNuance,
              koreanTranslation: rec.koreanTranslation,
              grammarExplanation: rec.grammarExplanation,
            }))
          )
          .run();
      }

      return evaluation.id;
    });
  },

  // Get evaluation by ID with related input and recommendations
  async getById(id: number) {
    const evaluation = await db.select().from(evaluations).where(eq(evaluations.id, id)).limit(1);

    if (!evaluation[0]) return null;

    const input = await db
      .select()
      .from(userInputs)
      .where(eq(userInputs.id, evaluation[0].userInputId))
      .limit(1);

    const recs = await db
      .select()
      .from(recommendations)
      .where(eq(recommendations.evaluationId, id));

    return {
      ...evaluation[0],
      input: input[0],
      recommendations: recs,
    };
  },

  // Aggregate totals for the home screen header
  async getStats() {
    const [row] = await db
      .select({
        total: sql<number>`count(*)`,
        averageScore: sql<number>`coalesce(cast(round(avg(${evaluations.overallScore})) as integer), 0)`,
      })
      .from(evaluations);

    return row ?? { total: 0, averageScore: 0 };
  },

  /**
   * How many *different* Korean sentences have been translated. Retrying the same
   * sentence sharpens it but doesn't widen coverage, so it counts once.
   */
  async getUniqueSentenceCount(): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(distinct ${userInputs.koreanText})` })
      .from(userInputs)
      .innerJoin(evaluations, eq(evaluations.userInputId, userInputs.id));

    return row?.count ?? 0;
  },

  // Distinct days (UTC, YYYY-MM-DD) on which the user submitted something, newest first
  async getActivityDates(): Promise<string[]> {
    const rows = await db
      .select({ day: sql<string>`date(${evaluations.createdAt})` })
      .from(evaluations)
      .groupBy(sql`date(${evaluations.createdAt})`)
      .orderBy(desc(sql`date(${evaluations.createdAt})`));

    return rows.map((row) => row.day);
  },

  /**
   * The most recent evaluation for a daily sentence, or null if it hasn't been
   * translated yet. Sentences swapped out by a refresh have their link nulled,
   * so this only ever finds attempts at the sentence still on the card.
   */
  async getLatestIdForDailySentence(dailySentenceId: number): Promise<number | null> {
    const rows = await db
      .select({ id: evaluations.id })
      .from(evaluations)
      .innerJoin(userInputs, eq(evaluations.userInputId, userInputs.id))
      .where(eq(userInputs.dailySentenceId, dailySentenceId))
      .orderBy(desc(evaluations.createdAt), desc(evaluations.id))
      .limit(1);

    return rows[0]?.id ?? null;
  },

  // Get recent evaluations (for history/activity feed)
  async getRecent(limit: number = 10) {
    return db
      .select()
      .from(evaluations)
      .innerJoin(userInputs, eq(evaluations.userInputId, userInputs.id))
      .orderBy(desc(evaluations.createdAt))
      .limit(limit);
  },
};
