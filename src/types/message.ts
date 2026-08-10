import { z } from 'zod';

/**
 * The daily encouragement. Capped well above the 40-character brief so a slightly
 * chatty model still passes, but short enough that a paragraph is rejected.
 */
export const dailyMessageResponseSchema = z.object({
  message: z.string().trim().min(1).max(120),
});

export type DailyMessageFromAI = z.infer<typeof dailyMessageResponseSchema>;
