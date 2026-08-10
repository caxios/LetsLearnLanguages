import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

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
import { useEvaluation } from '@/hooks/useEvaluation';
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
      </ScrollView>
    </KeyboardAvoidingView>
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
