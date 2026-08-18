/**
 * Feature flags for controlling optional functionality.
 * Flip these to re-enable features when ready.
 */
export const Features = {
  /** OpenAI Whisper voice transcription — disabled to reduce API costs. */
  VOICE_INPUT_ENABLED: false,
} as const;
