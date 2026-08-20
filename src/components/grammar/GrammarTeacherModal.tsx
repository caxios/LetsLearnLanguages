import { SymbolView } from 'expo-symbols';
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';
import { FontSizes, Fonts } from '@/constants/fonts';
import { BorderRadius, Spacing } from '@/constants/layout';
import {
  useDeleteGrammarNote,
  useGrammarExplanation,
  useSaveGrammarNote,
  useSavedGrammarNote,
} from '@/hooks/useGrammar';
import type { GrammarExplanation } from '@/types/grammar';

interface GrammarTeacherModalProps {
  /** The tapped term, or `null` when the sheet is closed. */
  term: string | null;
  /** The sentence or feedback the term was tagged in, if any. */
  context?: string;
  onClose: () => void;
}

/**
 * A full explanation of one grammar point, fetched on open.
 *
 * A term the user has already saved is served straight from the database, so
 * re-opening a kept note costs no API call and works offline.
 */
export function GrammarTeacherModal({ term, context, onClose }: GrammarTeacherModalProps) {
  const insets = useSafeAreaInsets();
  const explanation = useGrammarExplanation(term, context);
  const saved = useSavedGrammarNote(term);
  const saveNote = useSaveGrammarNote();
  const deleteNote = useDeleteGrammarNote();

  const isSaved = !!saved.data;

  const handleToggleSave = () => {
    if (!term) return;

    if (isSaved && saved.data) {
      deleteNote.mutate(saved.data.id);
      return;
    }
    if (explanation.data) {
      saveNote.mutate({ term, explanation: explanation.data });
    }
  };

  return (
    <Modal
      visible={term !== null}
      transparent
      animationType="slide"
      statusBarTranslucent
      // Lets the sheet reach the bottom edge on Android rather than stopping
      // above the navigation bar; the element below pays the inset back.
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.scrim}>
        {/* The backdrop above the sheet dismisses; the sheet itself does not. */}
        <Pressable style={styles.backdrop} accessibilityLabel="닫기" onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>문법 선생님</Text>
              <Text style={styles.term}>{term}</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="닫기"
              onPress={onClose}
              hitSlop={10}
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            >
              <SymbolView
                name={{ ios: 'xmark', android: 'close', web: 'close' }}
                size={18}
                tintColor={Colors.textSecondary}
              />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {explanation.isLoading ? (
              <View style={styles.center}>
                <ActivityIndicator color={Colors.primary} />
                <Text style={styles.loading}>설명을 준비하고 있어요...</Text>
              </View>
            ) : explanation.isError ? (
              <View style={styles.center}>
                <Text style={styles.error}>
                  {explanation.error instanceof Error
                    ? explanation.error.message
                    : '설명을 불러오지 못했어요.'}
                </Text>
                <Button title="다시 시도하기" variant="secondary" onPress={() => explanation.refetch()} />
              </View>
            ) : explanation.data ? (
              <ExplanationBody explanation={explanation.data} />
            ) : null}
          </ScrollView>

          {explanation.data && (
            <View style={[styles.footer, { paddingBottom: Spacing.md + insets.bottom }]}>
              <Button
                title={isSaved ? '복습에서 빼기' : '복습에 저장'}
                variant={isSaved ? 'secondary' : 'primary'}
                loading={saveNote.isPending || deleteNote.isPending}
                onPress={handleToggleSave}
                icon={
                  <SymbolView
                    name={
                      isSaved
                        ? { ios: 'bookmark.fill', android: 'bookmark', web: 'bookmark' }
                        : { ios: 'bookmark', android: 'bookmark_border', web: 'bookmark_border' }
                    }
                    size={16}
                    tintColor={Colors.textPrimary}
                  />
                }
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function ExplanationBody({ explanation }: { explanation: GrammarExplanation }) {
  return (
    <View style={styles.body}>
      <Text style={styles.summary}>{explanation.summary}</Text>

      <Section title="언제 쓰나요">
        <Text style={styles.prose}>{explanation.when_to_use}</Text>
      </Section>

      <Section title="예문">
        <View style={styles.examples}>
          {explanation.examples.map((example, index) => (
            <View key={index} style={styles.example}>
              <Text style={styles.english}>{example.english}</Text>
              <Text style={styles.korean}>{example.korean}</Text>
              <Text style={styles.note}>{example.note}</Text>
            </View>
          ))}
        </View>
      </Section>

      <Section title="뉘앙스">
        <Text style={styles.prose}>{explanation.nuance}</Text>
      </Section>

      {explanation.common_mistakes.length > 0 && (
        <Section title="자주 하는 실수">
          <View style={styles.examples}>
            {explanation.common_mistakes.map((mistake, index) => (
              <View key={index} style={styles.mistake}>
                <Text style={styles.wrong}>✗ {mistake.wrong}</Text>
                <Text style={styles.right}>✓ {mistake.right}</Text>
                <Text style={styles.note}>{mistake.why}</Text>
              </View>
            ))}
          </View>
        </Section>
      )}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    maxHeight: '85%',
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderTopWidth: 1,
    borderColor: Colors.borderLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.xs,
    color: Colors.primaryLight,
  },
  term: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes['2xl'],
    color: Colors.textPrimary,
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  pressed: {
    opacity: 0.6,
  },

  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  center: {
    paddingVertical: Spacing['2xl'],
    alignItems: 'center',
    gap: Spacing.md,
  },
  loading: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  error: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.error,
    textAlign: 'center',
  },

  body: {
    gap: Spacing.lg,
  },
  summary: {
    fontFamily: Fonts.headingSemiBold,
    fontSize: FontSizes.lg,
    lineHeight: FontSizes.lg * 1.5,
    color: Colors.textPrimary,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontFamily: Fonts.headingSemiBold,
    fontSize: FontSizes.sm,
    color: Colors.primaryLight,
  },
  prose: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.base,
    lineHeight: FontSizes.base * 1.6,
    color: Colors.textPrimary,
  },
  examples: {
    gap: Spacing.md,
  },
  example: {
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  english: {
    fontFamily: Fonts.headingSemiBold,
    fontSize: FontSizes.base,
    lineHeight: FontSizes.base * 1.4,
    color: Colors.textPrimary,
  },
  korean: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  note: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    lineHeight: FontSizes.xs * 1.6,
    color: Colors.textMuted,
  },
  mistake: {
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  wrong: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.scoreLow,
    textDecorationLine: 'line-through',
  },
  right: {
    fontFamily: Fonts.headingSemiBold,
    fontSize: FontSizes.sm,
    color: Colors.success,
  },

  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
});
