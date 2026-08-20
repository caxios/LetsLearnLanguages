import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { EvaluationDetail, type StoredEvaluation } from '@/components/evaluation/EvaluationDetail';
import { QuotaExceededModal } from '@/components/monetization/QuotaExceededModal';
import { AdBanner } from '@/components/ads/AdBanner';
import { AdLoadingOverlay } from '@/components/monetization/AdLoadingOverlay';
import { QuotaMeter } from '@/components/monetization/QuotaMeter';
import { InputMethodToggle } from '@/components/input/InputMethodToggle';
import { KoreanInput } from '@/components/input/KoreanInput';
import { TextInputField } from '@/components/input/TextInputField';
import { VoiceRecorder } from '@/components/input/VoiceRecorder';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Colors } from '@/constants/colors';
import { Features } from '@/constants/features';
import { evaluationFeatureFor } from '@/constants/monetization';
import { FontSizes, Fonts } from '@/constants/fonts';
import { Spacing } from '@/constants/layout';
import { useReviewCardForEvaluation, useToggleReviewBookmark } from '@/hooks/useAddToReview';
import { useEvaluation } from '@/hooks/useEvaluation';
import { useGatedAction } from '@/hooks/useQuota';
import { useLatestEvaluationForSentence } from '@/hooks/useEvaluationResult';
import { useInputStore } from '@/stores/useInputStore';
import { useRecordingStore } from '@/stores/useRecordingStore';

export default function FreeInputScreen() {
  const router = useRouter();
  const evaluation = useEvaluation();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const inputMethod = useInputStore((s) => s.inputMethod);
  const koreanText = useInputStore((s) => s.koreanText);
  const englishText = useInputStore((s) => s.englishText);
  const dailySentenceId = useInputStore((s) => s.dailySentenceId);
  const source = useInputStore((s) => s.source);
  const setInputMethod = useInputStore((s) => s.setInputMethod);
  const setKoreanText = useInputStore((s) => s.setKoreanText);
  const setEnglishText = useInputStore((s) => s.setEnglishText);
  const reset = useInputStore((s) => s.reset);

  // A topic sentence and a daily sentence share this screen but not their quota.
  const quota = useGatedAction(evaluationFeatureFor(source));

  // The store still carries 'voice' from an earlier session, so the flag —
  // not the stored preference — decides what the screen offers.
  const useVoice = Features.VOICE_INPUT_ENABLED && inputMethod === 'voice';

  const audioUri = useRecordingStore((s) => s.audioUri);
  const resetRecording = useRecordingStore((s) => s.resetRecording);

  // A finished daily sentence opens on its last result rather than a blank form.
  const previous = useLatestEvaluationForSentence(dailySentenceId);
  const [retrying, setRetrying] = useState(false);

  // This is a tab screen and stays mounted, so a new sentence has to clear the flag.
  useEffect(() => {
    setRetrying(false);
  }, [dailySentenceId]);

  const showPrevious = !retrying && !!previous.data;

  const handleRetry = () => {
    setEnglishText('');
    resetRecording();
    setSubmitError(null);
    setRetrying(true);
  };

  const canSubmit =
    koreanText.trim().length > 0 && englishText.trim().length > 0 && !evaluation.isPending;

  const handleSubmit = async () => {
    setSubmitError(null);

    try {
      // Quota first, then the ad, then the call — and only then is a try spent.
      // A dismissed ad or a failed call costs the user nothing.
      let evaluationId: number | null = null;

      await quota.run(async () => {
        const result = await evaluation.mutateAsync({
          koreanText: koreanText.trim(),
          englishText: englishText.trim(),
          inputMethod: useVoice ? 'voice' : 'text',
          audioUri: useVoice && audioUri ? audioUri : undefined,
          dailySentenceId: dailySentenceId ?? undefined,
        });
        evaluationId = result.evaluationId;
      });

      if (evaluationId === null) return;

      reset();
      resetRecording();
      router.push(`/result/${evaluationId}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '평가에 실패했습니다.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <KoreanInput value={koreanText} onChangeText={setKoreanText} />

        {previous.isLoading && !retrying ? (
          <View style={styles.loading}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : showPrevious ? (
          <PreviousAttempt evaluation={previous.data!} onRetry={handleRetry} />
        ) : (
          <>
            <QuotaMeter feature={quota.feature} />

            <View style={styles.section}>
              <Text style={styles.label}>나의 영어 번역</Text>

              {/* Voice input is behind a flag while Whisper is switched off; with
                  it false this collapses to the plain text field. */}
              {Features.VOICE_INPUT_ENABLED && (
                <InputMethodToggle value={inputMethod} onChange={setInputMethod} />
              )}

              {useVoice ? (
                <VoiceRecorder />
              ) : (
                <TextInputField value={englishText} onChangeText={setEnglishText} />
              )}

              {useVoice && englishText.length > 0 && (
                <TextInputField value={englishText} onChangeText={setEnglishText} />
              )}
            </View>

            {evaluation.isPending ? (
              <Card>
                <Text style={styles.analyzing}>✨ AI가 분석 중...</Text>
                <Skeleton height={16} style={styles.skeletonLine} />
                <Skeleton height={16} width="80%" style={styles.skeletonLine} />
                <Skeleton height={16} width="60%" style={styles.skeletonLine} />
              </Card>
            ) : (
              <Button
                title={quota.showsAd ? '✨ 광고 보고 평가 받기' : '✨ 평가 받기'}
                size="lg"
                onPress={handleSubmit}
                disabled={!canSubmit}
                loading={evaluation.isPending}
              />
            )}

            {submitError && <Text style={styles.error}>{submitError}</Text>}
          </>
        )}
      </ScrollView>

      <AdBanner />

      <AdLoadingOverlay visible={quota.isShowingAd} />
      <QuotaExceededModal {...quota.modal} />
    </KeyboardAvoidingView>
  );
}

/**
 * What the user gets when they re-open a sentence they've already finished:
 * the whole previous result, the bookmark they may have skipped, and a way back
 * to a blank form.
 */
function PreviousAttempt({
  evaluation,
  onRetry,
}: {
  evaluation: StoredEvaluation;
  onRetry: () => void;
}) {
  const reviewCard = useReviewCardForEvaluation(evaluation.id);
  const toggleBookmark = useToggleReviewBookmark();
  const bookmarked = !!reviewCard.data;

  return (
    <View style={styles.previous}>
      <View>
        <Text style={styles.previousTitle}>✅ 이미 연습한 문장이에요</Text>
        <Text style={styles.previousHint}>지난 평가 결과예요. 다시 풀어봐도 좋아요.</Text>
      </View>

      <EvaluationDetail evaluation={evaluation} />

      <View style={styles.actions}>
        <Button
          title="다시 시도하기"
          variant="secondary"
          style={styles.action}
          onPress={onRetry}
        />
        <Button
          title={bookmarked ? '복습에 저장됨' : '복습에 저장'}
          variant={bookmarked ? 'secondary' : 'primary'}
          style={styles.action}
          loading={toggleBookmark.isPending}
          icon={
            <SymbolView
              name={
                bookmarked
                  ? { ios: 'bookmark.fill', android: 'bookmark', web: 'bookmark' }
                  : { ios: 'bookmark', android: 'bookmark_border', web: 'bookmark_border' }
              }
              size={16}
              tintColor={Colors.textPrimary}
            />
          }
          onPress={() =>
            toggleBookmark.mutate({
              bookmarked,
              evaluationId: evaluation.id,
              koreanText: evaluation.input.koreanText,
              bestEnglish:
                evaluation.recommendations[0]?.sentence ?? evaluation.input.englishInput,
            })
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  loading: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  previous: {
    gap: Spacing.base,
  },
  previousTitle: {
    fontFamily: Fonts.headingSemiBold,
    fontSize: FontSizes.base,
    color: Colors.textPrimary,
  },
  previousHint: {
    marginTop: Spacing.xs,
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  action: {
    flex: 1,
  },
  content: {
    padding: Spacing.base,
    paddingBottom: Spacing['3xl'],
    gap: Spacing.lg,
  },
  section: {
    gap: Spacing.md,
  },
  label: {
    fontFamily: Fonts.headingSemiBold,
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
  },
  analyzing: {
    fontFamily: Fonts.headingSemiBold,
    fontSize: FontSizes.base,
    color: Colors.primaryLight,
    marginBottom: Spacing.md,
  },
  skeletonLine: {
    marginTop: Spacing.sm,
  },
  error: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.error,
    textAlign: 'center',
  },
});
