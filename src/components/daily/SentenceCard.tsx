import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Colors, difficultyColor } from '@/constants/colors';
import { FontSizes, Fonts } from '@/constants/fonts';
import { Spacing } from '@/constants/layout';

const DIFFICULTY_LABEL: Record<'easy' | 'medium' | 'hard', string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

interface SentenceCardProps {
  koreanText: string;
  difficulty: 'easy' | 'medium' | 'hard';
  isCompleted: boolean;
  onPress: () => void;
}

export function SentenceCard({
  koreanText,
  difficulty,
  isCompleted,
  onPress,
}: SentenceCardProps) {
  return (
    <Card
      variant={isCompleted ? 'outlined' : 'default'}
      onPress={onPress}
      accessibilityLabel={`${DIFFICULTY_LABEL[difficulty]} 문장: ${koreanText}`}
    >
      <View style={styles.header}>
        <Badge text={DIFFICULTY_LABEL[difficulty]} color={difficultyColor[difficulty]} />
        {isCompleted && <Text style={styles.done}>✅ 완료</Text>}
      </View>

      <Text style={[styles.korean, isCompleted && styles.koreanDone]}>{koreanText}</Text>

      <Text style={styles.action}>{isCompleted ? '결과 보기 →' : '번역하기 →'}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  done: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.xs,
    color: Colors.success,
  },
  korean: {
    fontFamily: Fonts.headingSemiBold,
    fontSize: FontSizes.lg,
    lineHeight: FontSizes.lg * 1.5,
    color: Colors.textPrimary,
  },
  koreanDone: {
    color: Colors.textSecondary,
  },
  action: {
    marginTop: Spacing.md,
    alignSelf: 'flex-end',
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.sm,
    color: Colors.primaryLight,
  },
});
