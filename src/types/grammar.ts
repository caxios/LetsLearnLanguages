import { z } from 'zod';

export const grammarExampleSchema = z.object({
  english: z.string().min(1),
  korean: z.string().min(1),
  note: z.string().min(1),
});

export const grammarMistakeSchema = z.object({
  wrong: z.string().min(1),
  right: z.string().min(1),
  why: z.string().min(1),
});

export const grammarExplanationSchema = z.object({
  summary: z.string().min(1),
  when_to_use: z.string().min(1),
  examples: z.array(grammarExampleSchema).min(1),
  nuance: z.string().min(1),
  common_mistakes: z.array(grammarMistakeSchema),
});

export type GrammarExplanation = z.infer<typeof grammarExplanationSchema>;
