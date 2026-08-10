import { format, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Colors, scoreColor } from '@/constants/colors';
import { FontSizes, Fonts } from '@/constants/fonts';
import { BorderRadius, Spacing } from '@/constants/layout';
import type { ReviewAttempt } from '@/db/schema';
import { useReviewAttempts, useSubmitReviewAttempt } from '@/hooks/useReviewAttempt';

/** `created_at` is stored as UTC "YYYY-MM-DD HH:MM:SS". */
export function formatAttemptDate(timestamp: string): string {
  try {
    const parsed = parseISO(timestamp.replace(' ', 'T') + 'Z');
    if (Number.isNaN(parsed.getTime())) return timestamp;
    return format(parsed, 'yyyy년 M월 d일', { locale: ko });
  } catch {
    return timestamp;
  }
}

interface ReviewAttemptPanelProps {
  reviewCardId: number;
  koreanText: string;
}

/**
 * Lets the user re-translate a bookmarked sentence and get the three scores back.
 * Reviews are score-only by design — no feedback or recommendations are generated.
 */
export function ReviewAttemptPanel({ reviewCardId, koreanText }: ReviewAttemptPanelProps) {
  const [draft, setDraft] = useState('');
  const attempts = useReviewAttempts(reviewCardId);
  const submit = useSubmitReviewAttempt();

  const canSubmit = draft.trim().length > 0 && !submit.isPending;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      await submit.mutateAsync({ reviewCardId, koreanText, englishText: draft.trim() });
      setDraft('');
    } catch {
      // Surfaced below via submit.isError.
    }
  };

  return (
    <Card>
      <Text style={styles.heading}>✍️ 다시 번역해 보기</Text>
      <Text style={styles.sub}>새로 번역해 보고 예전 점수와 비교해 보세요.</Text>

      <ReviewDraftInput value={draft} onChangeText={setDraft} onSubmit={handleSubmit} />

      <Button
        title="채점하기"
        size="sm"
        onPress={handleSubmit}
        disabled={!canSubmit}
        loading={submit.isPending}
        style={styles.submit}
      />

      {submit.isError && (
        <Text style={styles.error}>
          {submit.error instanceof Error ? submit.error.message : '채점에 실패했어요.'}
        </Text>
      )}

      {(attempts.data?.length ?? 0) > 0 && (
        <View style={styles.history}>
          <Text style={styles.historyTitle}>이전 복습 기록</Text>
          {attempts.data!.map((attempt) => (
            <AttemptRow key={attempt.id} attempt={attempt} />
          ))}
        </View>
      )}
    </Card>
  );
}

function ReviewDraftInput({
  value,
  onChangeText,
  onSubmit,
}: {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit: () => void;
}) {
  return (
    <TextInput
      accessibilityLabel="복습 번역 입력"
      multiline
      textAlignVertical="top"
      value={value}
      onChangeText={onChangeText}
      onSubmitEditing={onSubmit}
      submitBehavior="blurAndSubmit"
      returnKeyType="done"
      placeholder="영어로 다시 번역해 보세요..."
      placeholderTextColor={Colors.textMuted}
      maxLength={500}
      style={styles.input}
    />
  );
}

function AttemptRow({ attempt }: { attempt: ReviewAttempt }) {
  return (
    <View style={styles.attempt}>
      <View style={styles.attemptHeader}>
        <Text style={styles.attemptDate}>{formatAttemptDate(attempt.createdAt)}</Text>
        <Text style={[styles.attemptOverall, { color: scoreColor(attempt.overallScore) }]}>
          {attempt.overallScore}점
        </Text>
      </View>

      <Text style={styles.attemptText}>{attempt.englishInput}</Text>

      <View style={styles.scoreRow}>
        <ScorePill label="자연" value={attempt.naturalnessScore} />
        <ScorePill label="문법" value={attempt.grammarScore} />
        <ScorePill label="의미" value={attempt.meaningClarityScore} />
      </View>
    </View>
  );
}

function ScorePill({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.pill} accessibilityLabel={`${label} ${value}점`}>
      <Text style={styles.pillLabel}>{label}</Text>
      <Text style={[styles.pillValue, { color: scoreColor(value) }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontFamily: Fonts.headingSemiBold,
    fontSize: FontSizes.base,
    color: Colors.textPrimary,
  },
  sub: {
    marginTop: Spacing.xs,
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  input: {
    marginTop: Spacing.md,
    minHeight: 80,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    fontFamily: Fonts.body,
    fontSize: FontSizes.base,
    color: Colors.textPrimary,
  },
  submit: {
    marginTop: Spacing.md,
  },
  error: {
    marginTop: Spacing.md,
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.error,
  },
  history: {
    marginTop: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: Spacing.md,
    gap: Spacing.md,
  },
  historyTitle: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
  },
  attempt: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  attemptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  attemptDate: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
  },
  attemptOverall: {
    fontFamily: Fonts.mono,
    fontSize: FontSizes.sm,
  },
  attemptText: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    lineHeight: FontSizes.sm * 1.5,
    color: Colors.textPrimary,
  },
  scoreRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
  },
  pillLabel: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: Colors.textMuted,
  },
  pillValue: {
    fontFamily: Fonts.mono,
    fontSize: FontSizes.xs,
  },
});
