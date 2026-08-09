import { z } from 'zod';

// --- Zod Schemas (runtime validation) ---

export const recommendationSchema = z.object({
  sentence: z.string().min(1),
  context_and_nuance: z.string().min(1),
  grammar_explanation: z.string().min(1),
});

export const evaluationResponseSchema = z.object({
  evaluation: z.object({
    naturalness_score: z.number().int().min(0).max(100),
    grammar_score: z.number().int().min(0).max(100),
    meaning_clarity_score: z.number().int().min(0).max(100),
    feedback: z.string().min(1),
  }),
  recommendations: z.array(recommendationSchema).min(1).max(5),
});

// --- TypeScript Types (derived from Zod) ---

export type EvaluationResponse = z.infer<typeof evaluationResponseSchema>;
export type Recommendation = z.infer<typeof recommendationSchema>;
export type EvaluationScores = EvaluationResponse['evaluation'];
