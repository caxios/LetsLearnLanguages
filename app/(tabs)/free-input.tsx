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
import { InputMethodToggle } from '@/components/input/InputMethodToggle';
import { KoreanInput } from '@/components/input/KoreanInput';
import { TextInputField } from '@/components/input/TextInputField';
import { VoiceRecorder } from '@/components/input/VoiceRecorder';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Colors } from '@/constants/colors';
import { FontSizes, Fonts } from '@/constants/fonts';
import { Spacing } from '@/constants/layout';
import { useReviewCardForEvaluation, useToggleReviewBookmark } from '@/hooks/useAddToReview';
import { useEvaluation } from '@/hooks/useEvaluation';
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
  const setInputMethod = useInputStore((s) => s.setInputMethod);
  const setKoreanText = useInputStore((s) => s.setKoreanText);
  const setEnglishText = useInputStore((s) => s.setEnglishText);
  const reset = useInputStore((s) => s.reset);

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
      const { evaluationId } = await evaluation.mutateAsync({
        koreanText: koreanText.trim(),
        englishText: englishText.trim(),
        inputMethod,
        audioUri: inputMethod === 'voice' && audioUri ? audioUri : undefined,
        dailySentenceId: dailySentenceId ?? undefined,
      });

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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <KoreanInput value={koreanText} onChangeText={setKoreanText} />

        {previous.isLoading && !retrying ? (
          <View style={styles.loading}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : showPrevious ? (
          <PreviousAttempt evaluation={previous.data!} onRetry={handleRetry} />
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.label}>나의 영어 번역</Text>

              <InputMethodToggle value={inputMethod} onChange={setInputMethod} />

              {inputMethod === 'voice' ? (
                <VoiceRecorder />
              ) : (
                <TextInputField value={englishText} onChangeText={setEnglishText} />
              )}

              {inputMethod === 'voice' && englishText.length > 0 && (
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
                title="✨ 평가 받기"
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
