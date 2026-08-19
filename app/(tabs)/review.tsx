import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { EvaluationDetail } from '@/components/evaluation/EvaluationDetail';
import { GrammarNoteCard } from '@/components/grammar/GrammarNoteCard';
import { ReviewAttemptPanel } from '@/components/evaluation/ReviewAttemptPanel';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Skeleton } from '@/components/ui/Skeleton';
import { Colors } from '@/constants/colors';
import { FontSizes, Fonts } from '@/constants/fonts';
import { Spacing } from '@/constants/layout';
import type { ReviewCard as ReviewCardRow } from '@/db/schema';
import { useDeleteGrammarNote, useGrammarNotes } from '@/hooks/useGrammar';
import { useEvaluationResult } from '@/hooks/useEvaluationResult';
import { useDeleteReviewCard, useReviewCards } from '@/hooks/useReviewCards';

/**
 * Every bookmarked card that is due is listed and can be revealed independently.
 * The front of a card is a working surface: the Korean prompt plus a re-translation
 * box, so the sentence can be attempted before the answer is shown. Scoring an
 * attempt reveals the card, and revealing replays the whole original evaluation.
 * SM-2 grading buttons ("다시 / 어려움 / 보통 / 쉬움") arrive in Phase 6.
 */
export default function ReviewScreen() {
  const cards = useReviewCards();
  const deleteCard = useDeleteReviewCard();
  const grammarNotes = useGrammarNotes();
  const deleteGrammarNote = useDeleteGrammarNote();
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  const dueCards = useMemo(() => cards.data ?? [], [cards.data]);
  const revealedCount = dueCards.filter((card) => revealed[card.id]).length;

  const toggle = (id: number) => setRevealed((current) => ({ ...current, [id]: !current[id] }));
  const reveal = (id: number) => setRevealed((current) => ({ ...current, [id]: true }));

  const confirmDeleteNote = (id: number, term: string) => {
    Alert.alert('이 문법 노트를 삭제할까요?', `«${term}» 노트가 복습 목록에서 사라져요.`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => deleteGrammarNote.mutate(id) },
    ]);
  };

  const confirmDelete = (card: ReviewCardRow) => {
    Alert.alert(
      '이 카드를 삭제할까요?',
      `«${card.koreanText}»\n복습 목록에서만 빠지고, 지금까지의 복습 기록은 그대로 남아요.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => deleteCard.mutate(card.id),
        },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {cards.isLoading ? (
        <Skeleton height={20} width="60%" />
      ) : (
        <Text style={styles.due}>오늘 복습할 카드: {dueCards.length}장</Text>
      )}

      {(grammarNotes.data?.length ?? 0) > 0 && (
        <View style={styles.grammarSection}>
          <Text style={styles.sectionTitle}>📘 문법 노트</Text>
          <Text style={styles.sectionHint}>
            번역 없이 읽기만 하면 되는 카드예요. 언제든 다시 펼쳐 보세요.
          </Text>

          {grammarNotes.data!.map((note) => (
            <GrammarNoteCard
              key={note.id}
              note={note}
              onDelete={() => confirmDeleteNote(note.id, note.term)}
            />
          ))}
        </View>
      )}

      {cards.isLoading ? (
        <Card variant="elevated" style={styles.card}>
          <Skeleton height={24} width="80%" />
        </Card>
      ) : dueCards.length === 0 ? (
        <Card variant="elevated" style={styles.card}>
          <Text style={styles.hint}>
            복습할 카드가 없어요. 평가 결과에서 «복습에 저장»을 누르면 카드가 쌓입니다.
          </Text>
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
            onScored={() => reveal(card.id)}
            onDelete={() => confirmDelete(card)}
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
  onScored,
  onDelete,
}: {
  card: ReviewCardRow;
  index: number;
  total: number;
  revealed: boolean;
  onToggle: () => void;
  onScored: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.flashcard}>
      <Card variant="elevated" style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.counter}>
            {index + 1} / {total}
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${index + 1}번 카드 삭제`}
            onPress={onDelete}
            hitSlop={10}
            style={({ pressed }) => [styles.delete, pressed && styles.deletePressed]}
          >
            <SymbolView
              name={{ ios: 'trash', android: 'delete', web: 'delete' }}
              size={18}
              tintColor={Colors.textMuted}
            />
          </Pressable>
        </View>

        <View style={styles.prompt}>
          <Text style={styles.korean}>{card.koreanText}</Text>
        </View>

        {/* The attempt box lives on the front face — nothing has to be revealed first. */}
        <ReviewAttemptPanel
          reviewCardId={card.id}
          koreanText={card.koreanText}
          onScored={onScored}
        />

        {revealed && (
          <View style={styles.answer}>
            <Text style={styles.answerLabel}>정답</Text>
            <Text style={styles.english}>{card.bestEnglish}</Text>
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            revealed ? `${index + 1}번 카드 정답 숨기기` : `${index + 1}번 카드 정답 보기`
          }
          accessibilityState={{ expanded: revealed }}
          onPress={onToggle}
          hitSlop={8}
          style={({ pressed }) => [styles.revealRow, pressed && styles.revealPressed]}
        >
          <Text style={styles.hint}>{revealed ? '탭해서 정답 숨기기' : '탭해서 정답 보기'}</Text>
        </Pressable>
      </Card>

      {revealed && <ReviewEvaluationDetail evaluationId={card.evaluationId} />}
    </View>
  );
}

/** Replays the original evaluation so a fresh attempt can be compared against it. */
function ReviewEvaluationDetail({ evaluationId }: { evaluationId: number }) {
  const result = useEvaluationResult(evaluationId);

  if (result.isLoading) {
    return (
      <View style={styles.detailLoading}>
        <ActivityIndicator color={Colors.primary} />
      </View>
    );
  }

  if (result.isError || !result.data) {
    return (
      <Card variant="outlined">
        <Text style={styles.hint}>평가 내용을 불러오지 못했어요.</Text>
      </Card>
    );
  }

  return <EvaluationDetail evaluation={result.data} />;
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
  grammarSection: {
    gap: Spacing.md,
  },
  sectionTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.lg,
    color: Colors.textPrimary,
  },
  sectionHint: {
    marginTop: -Spacing.sm,
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
  },
  flashcard: {
    gap: Spacing.base,
  },
  card: {
    gap: Spacing.base,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  delete: {
    padding: Spacing.xs,
  },
  deletePressed: {
    opacity: 0.5,
  },
  prompt: {
    alignItems: 'center',
    gap: Spacing.base,
    paddingBottom: Spacing.xs,
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
  revealRow: {
    paddingVertical: Spacing.xs,
  },
  revealPressed: {
    opacity: 0.6,
  },
  hint: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  detailLoading: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
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
