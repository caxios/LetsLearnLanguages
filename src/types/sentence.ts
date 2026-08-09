import { z } from 'zod';

export const dailySentenceSchema = z.object({
  korean_text: z.string().min(1),
  difficulty: z.enum(['easy', 'medium', 'hard']),
});

export const dailySentencesResponseSchema = z.array(dailySentenceSchema).length(3);

export type DailySentenceFromAI = z.infer<typeof dailySentenceSchema>;
