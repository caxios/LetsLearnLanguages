import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { QuotaExceededModal } from '@/components/monetization/QuotaExceededModal';
import { QuotaMeter } from '@/components/monetization/QuotaMeter';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { Colors, difficultyColor } from '@/constants/colors';
import { FontSizes, Fonts } from '@/constants/fonts';
import { BorderRadius, Spacing } from '@/constants/layout';
import { TOPIC_CATEGORIES, type TopicCategory } from '@/constants/topics';
import { useCompletedSentences } from '@/hooks/useCompletedSentences';
import { useGatedAction } from '@/hooks/useQuota';
import { useTopicSentences } from '@/hooks/useTopicSentences';
import type { TopicSentence } from '@/services/topicSentences';
import { useInputStore } from '@/stores/useInputStore';

const DIFFICULTY_LABEL: Record<TopicSentence['difficulty'], string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

/**
 * Pick a category, pick a topic, then translate the five sentences Gemini writes
 * for it. The three phases live in one screen so backing out never leaves the tab.
 */
export default function TopicsScreen() {
  const router = useRouter();
  const sentences = useTopicSentences();
  const quota = useGatedAction('topicPracticeGenerate');

  const koreanTexts = useMemo(
    () => (sentences.data ?? []).map((sentence) => sentence.koreanText),
    [sentences.data]
  );
  const { completed } = useCompletedSentences(koreanTexts);

  const [category, setCategory] = useState<TopicCategory | null>(null);
  const [topic, setTopic] = useState<string | null>(null);

  const setKoreanText = useInputStore((s) => s.setKoreanText);
  const setDailySentenceId = useInputStore((s) => s.setDailySentenceId);
  const setEnglishText = useInputStore((s) => s.setEnglishText);
  const setSource = useInputStore((s) => s.setSource);

  const phase: 'categories' | 'topics' | 'sentences' = topic ? 'sentences' : category ? 'topics' : 'categories';

  const openCategory = (next: TopicCategory) => {
    setCategory(next);
    setTopic(null);
    sentences.reset();
  };

  /** One generation = one try, spent only when the sentences actually arrive. */
  const generate = (next: string) => quota.run(() => sentences.mutateAsync(next));

  const openTopic = (next: string) => {
    // Checked before the phase switches, so a blocked user stays on the list.
    if (!quota.check()) return;
    setTopic(next);
    // mutateAsync rejects on failure; the error surfaces through the mutation.
    generate(next).catch(() => {});
  };

  const regenerate = () => {
    if (!topic) return;
    generate(topic).catch(() => {});
  };

  const goBack = () => {
    if (topic) {
      setTopic(null);
      sentences.reset();
      return;
    }
    setCategory(null);
  };

  const handleSentencePress = (sentence: TopicSentence) => {
    // Topic sentences are ephemeral, so there is no daily sentence to tie the
    // evaluation to — the graded result still gets saved on submit.
    setKoreanText(sentence.koreanText);
    setDailySentenceId(null);
    setEnglishText('');
    setSource('topic');
    router.push('/free-input');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {phase === 'categories' ? (
        <View style={styles.intro}>
          <Text style={styles.title}>주제별 연습</Text>
          <Text style={styles.subtitle}>관심 있는 주제를 골라 5문장을 연습해 보세요.</Text>
        </View>
      ) : (
        <Breadcrumb category={category!} topic={topic} onBack={goBack} />
      )}

      {phase === 'categories' && (
        <View style={styles.grid}>
          {TOPIC_CATEGORIES.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`${item.name} 주제 보기`}
              onPress={() => openCategory(item)}
              style={({ pressed }) => [styles.categoryCard, pressed && styles.pressed]}
            >
              <Text style={styles.categoryEmoji}>{item.emoji}</Text>
              <Text style={styles.categoryName}>{item.name}</Text>
              <Text style={styles.categoryCount}>{item.topics.length}개 주제</Text>
            </Pressable>
          ))}
        </View>
      )}

      {phase === 'topics' && (
        <View style={styles.topicList}>
          <QuotaMeter feature="topicPracticeGenerate" />

          {category!.topics.map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityLabel={`${item} 문장 만들기`}
              onPress={() => openTopic(item)}
              style={({ pressed }) => [styles.topicRow, pressed && styles.pressed]}
            >
              <Text style={styles.topicText}>{item}</Text>
              <SymbolView
                name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
                size={16}
                tintColor={Colors.textMuted}
              />
            </Pressable>
          ))}
        </View>
      )}

      {phase === 'sentences' && (
        <SentencePhase
          isPending={sentences.isPending}
          error={sentences.error}
          sentences={sentences.data}
          completed={completed}
          onRetry={regenerate}
          onSentencePress={handleSentencePress}
        />
      )}

      <QuotaExceededModal {...quota.modal} />
    </ScrollView>
  );
}

function Breadcrumb({
  category,
  topic,
  onBack,
}: {
  category: TopicCategory;
  topic: string | null;
  onBack: () => void;
}) {
  return (
    <View style={styles.breadcrumb}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="뒤로"
        onPress={onBack}
        hitSlop={8}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      >
        <SymbolView
          name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
          size={18}
          tintColor={Colors.primaryLight}
        />
      </Pressable>

      <View style={styles.breadcrumbCopy}>
        <Text style={styles.breadcrumbTrail}>
          {category.emoji} {category.name}
        </Text>
        <Text style={styles.breadcrumbTitle}>{topic ?? '주제를 선택하세요'}</Text>
      </View>
    </View>
  );
}

function SentencePhase({
  isPending,
  error,
  sentences,
  completed,
  onRetry,
  onSentencePress,
}: {
  isPending: boolean;
  error: Error | null;
  sentences: TopicSentence[] | undefined;
  completed: Set<string>;
  onRetry: () => void;
  onSentencePress: (sentence: TopicSentence) => void;
}) {
  if (isPending) {
    return (
      <View style={styles.sentenceList}>
        <Text style={styles.generating}>✨ AI가 문장을 만드는 중...</Text>
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} height={104} borderRadius={BorderRadius.lg} />
        ))}
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.sentenceList}>
        <Text style={styles.error}>{error.message || '문장을 만들지 못했어요.'}</Text>
        <Button title="다시 시도하기" variant="secondary" onPress={onRetry} />
      </View>
    );
  }

  if (!sentences || sentences.length === 0) {
    return null;
  }

  const doneCount = sentences.filter((sentence) => completed.has(sentence.koreanText)).length;

  return (
    <View style={styles.sentenceList}>
      <Text style={styles.progress}>
        {doneCount}/{sentences.length} 연습함
      </Text>

      {sentences.map((sentence, index) => {
        const isDone = completed.has(sentence.koreanText);

        return (
          <Card
            key={`${index}-${sentence.koreanText}`}
            style={isDone ? styles.doneCard : undefined}
            onPress={() => onSentencePress(sentence)}
            accessibilityLabel={`${DIFFICULTY_LABEL[sentence.difficulty]} 문장: ${
              sentence.koreanText
            }${isDone ? ' (연습함)' : ''}`}
          >
            <View style={styles.sentenceHeader}>
              <Badge
                text={DIFFICULTY_LABEL[sentence.difficulty]}
                color={difficultyColor[sentence.difficulty]}
              />
              {/* The one sentence written from a live search, so the user knows why
                  it mentions something this week. */}
              {sentence.isGrounded && <Badge text="🔍 트렌드" color={Colors.info} />}
              {isDone && <Text style={styles.done}>✅ 연습함</Text>}
            </View>

            <Text style={[styles.korean, isDone && styles.koreanDone]}>
              {sentence.koreanText}
            </Text>
            {/* Topic sentences are not stored, so there is no past result to
                re-open — tapping one always starts a fresh attempt. */}
            <Text style={styles.action}>{isDone ? '다시 번역하기 →' : '번역하기 →'}</Text>
          </Card>
        );
      })}

      <Button title="다른 문장 받기" variant="secondary" onPress={onRetry} />
    </View>
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
  intro: {
    gap: Spacing.xs,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.xl,
    color: Colors.textPrimary,
  },
  subtitle: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  pressed: {
    opacity: 0.6,
  },

  // Phase 1 — category grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  categoryCard: {
    // Two per row: just under half each, so the gap fits between them.
    flexBasis: '47%',
    flexGrow: 1,
    gap: Spacing.xs,
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  categoryEmoji: {
    fontSize: 28,
  },
  categoryName: {
    fontFamily: Fonts.headingSemiBold,
    fontSize: FontSizes.base,
    color: Colors.textPrimary,
  },
  categoryCount: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
  },

  // Breadcrumb
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  breadcrumbCopy: {
    flex: 1,
    gap: 2,
  },
  breadcrumbTrail: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
  },
  breadcrumbTitle: {
    fontFamily: Fonts.headingSemiBold,
    fontSize: FontSizes.lg,
    color: Colors.textPrimary,
  },

  // Phase 2 — topic list
  topicList: {
    gap: Spacing.sm,
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  topicText: {
    flex: 1,
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.base,
    color: Colors.textPrimary,
  },

  // Phase 3 — generated sentences
  sentenceList: {
    gap: Spacing.md,
  },
  generating: {
    fontFamily: Fonts.headingSemiBold,
    fontSize: FontSizes.base,
    color: Colors.primaryLight,
  },
  sentenceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  progress: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
  },
  doneCard: {
    // Same green wash the daily sentence cards use when practiced.
    backgroundColor: Colors.secondaryMuted,
    borderColor: Colors.success,
  },
  done: {
    marginLeft: 'auto',
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.xs,
    color: Colors.success,
  },
  koreanDone: {
    color: Colors.textSecondary,
  },
  korean: {
    fontFamily: Fonts.headingSemiBold,
    fontSize: FontSizes.lg,
    lineHeight: FontSizes.lg * 1.5,
    color: Colors.textPrimary,
  },
  action: {
    marginTop: Spacing.md,
    alignSelf: 'flex-end',
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.sm,
    color: Colors.primaryLight,
  },
  error: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.error,
  },
});
