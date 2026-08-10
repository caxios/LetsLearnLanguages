import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { FeedbackPanel } from '@/components/evaluation/FeedbackPanel';
import { RecommendationList } from '@/components/evaluation/RecommendationList';
import { ScoreCard } from '@/components/evaluation/ScoreCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/colors';
import { FontSizes, Fonts } from '@/constants/fonts';
import { Spacing } from '@/constants/layout';
import { useAddToReview, useReviewCardForEvaluation } from '@/hooks/useAddToReview';
import { useEvaluationResult } from '@/hooks/useEvaluationResult';

export default function ResultScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const evaluationId = Number(id);

  const result = useEvaluationResult(evaluationId);
  const reviewCard = useReviewCardForEvaluation(evaluationId);
  const addToReview = useAddToReview();

  const handleShare = async () => {
    if (!result.data) return;
    const best = result.data.recommendations[0]?.sentence ?? result.data.input.englishInput;
    await Share.share({
      message: `${result.data.input.koreanText}\n\n내 번역: ${result.data.input.englishInput}\n추천 표현: ${best}\n종합 점수: ${result.data.overallScore}점`,
    });
  };

  if (result.isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (result.isError || !result.data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.missing}>평가 결과를 찾을 수 없습니다.</Text>
        <Button title="돌아가기" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const evaluation = result.data;
  const alreadyInReview = !!reviewCard.data || addToReview.isSuccess;

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable accessibilityRole="button" accessibilityLabel="공유" onPress={handleShare}>
              <Text style={styles.share}>공유 ↗</Text>
            </Pressable>
          ),
        }}
      />

      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <ScoreCard
          naturalness={evaluation.naturalnessScore}
          grammar={evaluation.grammarScore}
          meaningClarity={evaluation.meaningClarityScore}
        />

        <Card variant="outlined">
          <Text style={styles.originalLabel}>원문</Text>
          <Text style={styles.original}>{evaluation.input.koreanText}</Text>
          <Text style={[styles.originalLabel, styles.spaced]}>나의 번역</Text>
          <Text style={styles.original}>{evaluation.input.englishInput}</Text>
        </Card>

        <FeedbackPanel feedback={evaluation.feedback} />

        <RecommendationList
          recommendations={evaluation.recommendations.map((rec) => ({
            sentence: rec.sentence,
            contextAndNuance: rec.contextAndNuance,
            grammarExplanation: rec.grammarExplanation,
          }))}
        />

        <View style={styles.actions}>
          <Button
            title="다시 해보기"
            variant="secondary"
            style={styles.action}
            onPress={() => router.replace('/free-input')}
          />
          <Button
            title={alreadyInReview ? '복습에 추가됨' : '복습에 추가'}
            style={styles.action}
            disabled={alreadyInReview}
            loading={addToReview.isPending}
            onPress={() =>
              addToReview.mutate({
                evaluationId,
                koreanText: evaluation.input.koreanText,
                bestEnglish: evaluation.recommendations[0]?.sentence ?? evaluation.input.englishInput,
              })
            }
          />
        </View>
      </ScrollView>
    </>
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
    gap: Spacing.lg,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.base,
    backgroundColor: Colors.background,
  },
  missing: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.base,
    color: Colors.textSecondary,
  },
  share: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.sm,
    color: Colors.primaryLight,
    marginRight: Spacing.base,
  },
  originalLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
  },
  spaced: {
    marginTop: Spacing.md,
  },
  original: {
    marginTop: Spacing.xs,
    fontFamily: Fonts.body,
    fontSize: FontSizes.base,
    lineHeight: FontSizes.base * 1.5,
    color: Colors.textPrimary,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  action: {
    flex: 1,
  },
});
