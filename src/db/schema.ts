import { sql } from 'drizzle-orm';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const dailySentences = sqliteTable('daily_sentences', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  koreanText: text('korean_text').notNull(),
  difficulty: text('difficulty', { enum: ['easy', 'medium', 'hard'] }).notNull(),
  dateAssigned: text('date_assigned').notNull(),
  isCompleted: integer('is_completed', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const userInputs = sqliteTable('user_inputs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  koreanText: text('korean_text').notNull(),
  englishInput: text('english_input').notNull(),
  inputMethod: text('input_method', { enum: ['voice', 'text'] }).notNull(),
  audioUri: text('audio_uri'),
  dailySentenceId: integer('daily_sentence_id').references(() => dailySentences.id),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const evaluations = sqliteTable('evaluations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userInputId: integer('user_input_id')
    .notNull()
    .references(() => userInputs.id),
  naturalnessScore: integer('naturalness_score').notNull(),
  grammarScore: integer('grammar_score').notNull(),
  meaningClarityScore: integer('meaning_clarity_score').notNull(),
  overallScore: integer('overall_score').notNull(),
  feedback: text('feedback').notNull(),
  rawJson: text('raw_json').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const recommendations = sqliteTable('recommendations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  evaluationId: integer('evaluation_id')
    .notNull()
    .references(() => evaluations.id),
  sentence: text('sentence').notNull(),
  contextAndNuance: text('context_and_nuance').notNull(),
  // Nuance-preserving Korean rendering of `sentence`. Nullable: rows written
  // before this column existed have no translation to backfill.
  koreanTranslation: text('korean_translation'),
  grammarExplanation: text('grammar_explanation').notNull(),
});

export const reviewCards = sqliteTable('review_cards', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  evaluationId: integer('evaluation_id')
    .notNull()
    .references(() => evaluations.id),
  koreanText: text('korean_text').notNull(),
  bestEnglish: text('best_english').notNull(),
  easeFactor: real('ease_factor').notNull().default(2.5),
  intervalDays: integer('interval_days').notNull().default(1),
  repetitions: integer('repetitions').notNull().default(0),
  nextReviewDate: text('next_review_date').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/** One row per calendar day the user opened the app — powers the attendance streak. */
export const appVisits = sqliteTable('app_visits', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  visitDate: text('visit_date').notNull().unique(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * A re-attempt at a bookmarked card. Scores only — no feedback is generated.
 * `reviewCardId` is nullable on purpose: deleting a card detaches its attempts
 * rather than erasing them, so lifetime practice effort is never lost.
 */
export const reviewAttempts = sqliteTable('review_attempts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  reviewCardId: integer('review_card_id').references(() => reviewCards.id),
  englishInput: text('english_input').notNull(),
  naturalnessScore: integer('naturalness_score').notNull(),
  grammarScore: integer('grammar_score').notNull(),
  meaningClarityScore: integer('meaning_clarity_score').notNull(),
  overallScore: integer('overall_score').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/** One AI-written encouragement per day, cached so it stays stable until refreshed. */
export const dailyMessages = sqliteTable('daily_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  dateAssigned: text('date_assigned').notNull().unique(),
  message: text('message').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * A grammar point the user saved from the Grammar Teacher, kept as reading
 * material rather than a drill.
 *
 * Deliberately not a `reviewCards` row: those carry a NOT NULL evaluation link
 * and SM-2 scheduling columns, none of which mean anything for a concept the
 * user only ever re-reads. `term` is unique so saving the same point twice
 * refreshes the note instead of stacking duplicates.
 */
export const grammarNotes = sqliteTable('grammar_notes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  term: text('term').notNull().unique(),
  summary: text('summary').notNull(),
  /** The full explanation, stored as JSON so the modal can re-render it whole. */
  detailJson: text('detail_json').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

export type DailySentence = typeof dailySentences.$inferSelect;
export type NewDailySentence = typeof dailySentences.$inferInsert;
export type UserInput = typeof userInputs.$inferSelect;
export type NewUserInput = typeof userInputs.$inferInsert;
export type Evaluation = typeof evaluations.$inferSelect;
export type NewEvaluation = typeof evaluations.$inferInsert;
export type Recommendation = typeof recommendations.$inferSelect;
export type NewRecommendation = typeof recommendations.$inferInsert;
export type ReviewCard = typeof reviewCards.$inferSelect;
export type NewReviewCard = typeof reviewCards.$inferInsert;
export type AppVisit = typeof appVisits.$inferSelect;
export type ReviewAttempt = typeof reviewAttempts.$inferSelect;
export type GrammarNote = typeof grammarNotes.$inferSelect;
export type NewGrammarNote = typeof grammarNotes.$inferInsert;
export type NewReviewAttempt = typeof reviewAttempts.$inferInsert;
export type DailyMessage = typeof dailyMessages.$inferSelect;
