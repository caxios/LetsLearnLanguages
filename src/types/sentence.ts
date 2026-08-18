import { z } from 'zod';

export const dailySentenceSchema = z.object({
  korean_text: z.string().min(1),
  difficulty: z.enum(['easy', 'medium', 'hard']),
});

export const dailySentencesResponseSchema = z.array(dailySentenceSchema).length(3);

export type DailySentenceFromAI = z.infer<typeof dailySentenceSchema>;


/** Phase A of topic practice: the four ungrounded sentences. */
export const topicSentencesResponseSchema = z.array(dailySentenceSchema).length(4);

/**
 * Phase B: the single grounded sentence. Search grounding rules out a response
 * schema, so this validates hand-parsed text and cannot assume a difficulty.
 */
export const groundedSentenceSchema = z.object({
  korean_text: z.string().min(1),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('easy'),
});
