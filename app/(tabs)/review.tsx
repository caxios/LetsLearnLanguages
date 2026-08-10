import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { Colors } from '@/constants/colors';
import { FontSizes, Fonts } from '@/constants/fonts';
import { Spacing } from '@/constants/layout';
import { useReviewCards } from '@/hooks/useReviewCards';

/**
 * Placeholder — the SM-2 review flow (card flip, grading buttons) lands in Phase 6.
 * For now this shows how many cards are waiting.
 */
export default function ReviewScreen() {
  const cards = useReviewCards();
  const dueCount = cards.data?.length ?? 0;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {cards.isLoading ? (
        <Skeleton height={20} width="60%" />
      ) : (
        <Text style={styles.due}>오늘 복습할 카드: {dueCount}장</Text>
      )}

      <Card variant="elevated" style={styles.card}>
        {dueCount > 0 ? (
          <>
            <Text style={styles.korean}>{cards.data?.[0]?.koreanText}</Text>
            <Text style={styles.hint}>탭해서 정답 보기 (Phase 6)</Text>
          </>
        ) : (
          <Text style={styles.hint}>복습할 카드가 없어요. 문장을 평가하면 카드가 쌓입니다.</Text>
        )}
      </Card>

      <View style={styles.progress}>
        <ProgressBar progress={0} />
        <Text style={styles.progressLabel}>0/{dueCount} 완료</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.base,
    gap: Spacing.lg,
  },
  due: {
    fontFamily: Fonts.headingSemiBold,
    fontSize: FontSizes.base,
    color: Colors.textPrimary,
  },
  card: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.base,
  },
  korean: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes['2xl'],
    lineHeight: FontSizes['2xl'] * 1.4,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  hint: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  progress: {
    gap: Spacing.sm,
  },
  progressLabel: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
    textAlign: 'right',
  },
});
