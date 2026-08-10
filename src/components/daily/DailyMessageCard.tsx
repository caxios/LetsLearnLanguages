import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Skeleton } from '@/components/ui/Skeleton';
import { Colors } from '@/constants/colors';
import { FontSizes, Fonts } from '@/constants/fonts';
import { BorderRadius, Spacing } from '@/constants/layout';

/** Shown when Gemini is unreachable — the badge should never look broken. */
export const FALLBACK_MESSAGE = '오늘도 한 걸음, 그거면 충분해요 ✨';

interface DailyMessageCardProps {
  /** Today's AI-written encouragement, if it has been generated. */
  message?: string | null;
  isLoading?: boolean;
}

/** The warm line under the streak badge. Decorative: it never surfaces an error. */
export function DailyMessageCard({ message, isLoading = false }: DailyMessageCardProps) {
  return (
    <View style={styles.container} accessibilityLabel="오늘의 응원 메시지">
      <Text style={styles.quote}>💬</Text>

      {isLoading ? (
        <View style={styles.skeleton}>
          <Skeleton height={14} width="90%" />
        </View>
      ) : (
        <Text style={styles.message}>{message?.trim() || FALLBACK_MESSAGE}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.primaryMuted,
  },
  quote: {
    fontSize: FontSizes.base,
  },
  message: {
    flex: 1,
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.sm,
    lineHeight: FontSizes.sm * 1.5,
    color: Colors.textPrimary,
  },
  skeleton: {
    flex: 1,
  },
});
