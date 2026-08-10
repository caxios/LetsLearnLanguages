import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SentenceCard } from '@/components/daily/SentenceCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Colors } from '@/constants/colors';
import { FontSizes, Fonts } from '@/constants/fonts';
import { Spacing } from '@/constants/layout';
import type { DailySentence } from '@/db/schema';

interface DailySentenceListProps {
  sentences?: DailySentence[];
  isLoading?: boolean;
  error?: Error | null;
  onSentencePress: (sentence: DailySentence) => void;
  onRetry?: () => void;
}

export function DailySentenceList({
  sentences,
  isLoading = false,
  error = null,
  onSentencePress,
  onRetry,
}: DailySentenceListProps) {
  if (isLoading) {
    return (
      <View style={styles.list} accessibilityLabel="문장을 불러오는 중">
        {[0, 1, 2].map((index) => (
          <Card key={index}>
            <Skeleton height={20} width={72} />
            <Skeleton height={18} style={styles.skeletonLine} />
            <Skeleton height={18} width="60%" style={styles.skeletonLine} />
          </Card>
        ))}
      </View>
    );
  }

  if (error) {
    return (
      <Card variant="outlined">
        <Text style={styles.stateTitle}>오늘의 문장을 불러오지 못했어요</Text>
        <Text style={styles.stateBody}>{error.message}</Text>
        {onRetry && <Button title="다시 시도" variant="secondary" size="sm" onPress={onRetry} style={styles.retry} />}
      </Card>
    );
  }

  if (!sentences || sentences.length === 0) {
    return (
      <Card variant="outlined">
        <Text style={styles.stateTitle}>아직 오늘의 문장이 없어요</Text>
        <Text style={styles.stateBody}>
          설정에서 Gemini API 키를 입력하면 매일 새로운 문장이 생성됩니다.
        </Text>
      </Card>
    );
  }

  return (
    <View style={styles.list}>
      {sentences.map((sentence) => (
        <SentenceCard
          key={sentence.id}
          koreanText={sentence.koreanText}
          difficulty={sentence.difficulty}
          isCompleted={sentence.isCompleted}
          onPress={() => onSentencePress(sentence)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.md,
  },
  skeletonLine: {
    marginTop: Spacing.md,
  },
  stateTitle: {
    fontFamily: Fonts.headingSemiBold,
    fontSize: FontSizes.base,
    color: Colors.textPrimary,
  },
  stateBody: {
    marginTop: Spacing.sm,
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    lineHeight: FontSizes.sm * 1.5,
    color: Colors.textSecondary,
  },
  retry: {
    marginTop: Spacing.base,
    alignSelf: 'flex-start',
  },
});
