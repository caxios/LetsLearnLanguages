export const Colors = {
  // Backgrounds
  background: '#0F0F1A',
  surface: '#1A1A2E',
  surfaceLight: '#25253B',
  surfaceElevated: '#2F2F4A',

  // Primary
  primary: '#6C63FF',
  primaryLight: '#8B83FF',
  primaryDark: '#4F46E5',
  primaryMuted: 'rgba(108, 99, 255, 0.15)',

  // Secondary
  secondary: '#00D4AA',
  secondaryLight: '#34E0C0',
  secondaryMuted: 'rgba(0, 212, 170, 0.15)',

  // Scores
  scoreHigh: '#4ADE80', // Green (80-100)
  scoreMedium: '#FFB347', // Amber (50-79)
  scoreLow: '#FF6B6B', // Coral (0-49)

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  textInverse: '#0F0F1A',

  // Borders & Dividers
  border: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.15)',
  divider: 'rgba(255, 255, 255, 0.05)',

  // Status
  success: '#4ADE80',
  warning: '#FBBF24',
  error: '#EF4444',
  info: '#60A5FA',

  // Difficulty badges
  difficultyEasy: '#4ADE80',
  difficultyMedium: '#FBBF24',
  difficultyHard: '#EF4444',
} as const;

/** Score → colour, shared by ScoreCircle and anywhere else scores are rendered. */
export function scoreColor(score: number): string {
  if (score >= 80) return Colors.scoreHigh;
  if (score >= 50) return Colors.scoreMedium;
  return Colors.scoreLow;
}

export const difficultyColor: Record<'easy' | 'medium' | 'hard', string> = {
  easy: Colors.difficultyEasy,
  medium: Colors.difficultyMedium,
  hard: Colors.difficultyHard,
};
