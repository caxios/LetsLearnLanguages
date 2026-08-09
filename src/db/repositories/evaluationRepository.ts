import { desc, eq } from 'drizzle-orm';

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
