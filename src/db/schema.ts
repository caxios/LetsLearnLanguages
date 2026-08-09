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
