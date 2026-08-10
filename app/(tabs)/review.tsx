import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { Colors } from '@/constants/colors';
import { FontSizes, Fonts } from '@/constants/fonts';
import { Spacing } from '@/constants/layout';
import type { ReviewCard as ReviewCardRow } from '@/db/schema';
import { useReviewCards } from '@/hooks/useReviewCards';

/**
 * Every due card is listed and can be revealed independently.
 * SM-2 grading buttons ("다시 / 어려움 / 보통 / 쉬움") arrive in Phase 6.
 */
export default function ReviewScreen() {
  const cards = useReviewCards();
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  const dueCards = useMemo(() => cards.data ?? [], [cards.data]);
  const revealedCount = dueCards.filter((card) => revealed[card.id]).length;

  const toggle = (id: number) => setRevealed((current) => ({ ...current, [id]: !current[id] }));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {cards.isLoading ? (
        <Skeleton height={20} width="60%" />
      ) : (
        <Text style={styles.due}>오늘 복습할 카드: {dueCards.length}장</Text>
      )}

      {cards.isLoading ? (
        <Card variant="elevated" style={styles.card}>
          <Skeleton height={24} width="80%" />
        </Card>
      ) : dueCards.length === 0 ? (
        <Card variant="elevated" style={styles.card}>
          <Text style={styles.hint}>복습할 카드가 없어요. 문장을 평가하면 카드가 쌓입니다.</Text>
        </Card>
      ) : (
        dueCards.map((card, index) => (
          <ReviewFlashcard
            key={card.id}
            card={card}
            index={index}
            total={dueCards.length}
            revealed={!!revealed[card.id]}
            onToggle={() => toggle(card.id)}
          />
        ))
      )}

      {dueCards.length > 0 && (
        <View style={styles.progress}>
          <ProgressBar progress={revealedCount / dueCards.length} />
          <Text style={styles.progressLabel}>
            {revealedCount}/{dueCards.length} 완료
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function ReviewFlashcard({
  card,
  index,
  total,
  revealed,
  onToggle,
}: {
  card: ReviewCardRow;
  index: number;
  total: number;
  revealed: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        revealed ? `${index + 1}번 카드 정답 숨기기` : `${index + 1}번 카드 정답 보기`
      }
      accessibilityState={{ expanded: revealed }}
      onPress={onToggle}
    >
      <Card variant="elevated" style={styles.card}>
        <Text style={styles.counter}>
          {index + 1} / {total}
        </Text>

        <Text style={styles.korean}>{card.koreanText}</Text>

        {revealed ? (
          <View style={styles.answer}>
            <Text style={styles.answerLabel}>정답</Text>
            <Text style={styles.english}>{card.bestEnglish}</Text>
            <Text style={styles.hint}>탭해서 정답 숨기기</Text>
          </View>
        ) : (
          <Text style={styles.hint}>탭해서 정답 보기</Text>
        )}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.base,
    paddingBottom: Spacing['3xl'],
    gap: Spacing.base,
  },
  due: {
    fontFamily: Fonts.headingSemiBold,
    fontSize: FontSizes.base,
    color: Colors.textPrimary,
  },
  card: {
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.base,
  },
  counter: {
    fontFamily: Fonts.mono,
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
  },
  korean: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes['2xl'],
    lineHeight: FontSizes['2xl'] * 1.4,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  answer: {
    alignItems: 'center',
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: Spacing.base,
    alignSelf: 'stretch',
  },
  answerLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.xs,
    color: Colors.secondary,
  },
  english: {
    fontFamily: Fonts.headingSemiBold,
    fontSize: FontSizes.lg,
    lineHeight: FontSizes.lg * 1.4,
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
