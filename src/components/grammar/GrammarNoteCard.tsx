import { SymbolView } from 'expo-symbols';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/colors';
import { FontSizes, Fonts } from '@/constants/fonts';
import { BorderRadius, Spacing } from '@/constants/layout';
import type { StoredGrammarNote } from '@/db/repositories/grammarRepository';

interface GrammarNoteCardProps {
  note: StoredGrammarNote;
  onDelete: () => void;
}

/**
 * A saved grammar point in the review deck.
 *
 * Reading material, not a drill: it has no answer to reveal and nothing to
 * submit, so it opens straight into the explanation rather than hiding it
 * behind a translation attempt.
 */
export function GrammarNoteCard({ note, onDelete }: GrammarNoteCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card variant="elevated" style={styles.card}>
      <View style={styles.header}>
        <View style={styles.badge}>
          <Text style={styles.badgeLabel}>문법</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${note.term} 삭제`}
          onPress={onDelete}
          hitSlop={10}
          style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
        >
          <SymbolView
            name={{ ios: 'trash', android: 'delete', web: 'delete' }}
            size={16}
            tintColor={Colors.textMuted}
          />
        </Pressable>
      </View>

      <Text style={styles.term}>{note.term}</Text>
      <Text style={styles.summary}>{note.summary}</Text>

      {note.detail && (
        <>
          {expanded && (
            <View style={styles.detail}>
              <Section title="언제 쓰나요">
                <Text style={styles.prose}>{note.detail.when_to_use}</Text>
              </Section>

              <Section title="예문">
                <View style={styles.examples}>
                  {note.detail.examples.map((example, index) => (
                    <View key={index} style={styles.example}>
                      <Text style={styles.english}>{example.english}</Text>
                      <Text style={styles.korean}>{example.korean}</Text>
                      <Text style={styles.note}>{example.note}</Text>
                    </View>
                  ))}
                </View>
              </Section>

              <Section title="뉘앙스">
                <Text style={styles.prose}>{note.detail.nuance}</Text>
              </Section>

              {note.detail.common_mistakes.length > 0 && (
                <Section title="자주 하는 실수">
                  <View style={styles.examples}>
                    {note.detail.common_mistakes.map((mistake, index) => (
                      <View key={index} style={styles.example}>
                        <Text style={styles.wrong}>✗ {mistake.wrong}</Text>
                        <Text style={styles.right}>✓ {mistake.right}</Text>
                        <Text style={styles.note}>{mistake.why}</Text>
                      </View>
                    ))}
                  </View>
                </Section>
              )}
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={expanded ? `${note.term} 접기` : `${note.term} 자세히 보기`}
            accessibilityState={{ expanded }}
            onPress={() => setExpanded((current) => !current)}
            hitSlop={8}
            style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
          >
            <Text style={styles.toggleLabel}>{expanded ? '접기' : '자세히 보기'}</Text>
          </Pressable>
        </>
      )}
    </Card>
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
  card: {
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.info,
    backgroundColor: `${Colors.info}26`,
  },
  badgeLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: 10,
    color: Colors.info,
  },
  delete: {
    padding: Spacing.xs,
  },
  pressed: {
    opacity: 0.6,
  },
  term: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.xl,
    color: Colors.textPrimary,
  },
  summary: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    lineHeight: FontSizes.sm * 1.6,
    color: Colors.textSecondary,
  },

  detail: {
    marginTop: Spacing.sm,
    gap: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: Spacing.base,
  },
  section: {
    gap: Spacing.xs,
  },
  sectionTitle: {
    fontFamily: Fonts.headingSemiBold,
    fontSize: FontSizes.xs,
    color: Colors.primaryLight,
  },
  prose: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    lineHeight: FontSizes.sm * 1.6,
    color: Colors.textPrimary,
  },
  examples: {
    gap: Spacing.sm,
  },
  example: {
    gap: 2,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceLight,
  },
  english: {
    fontFamily: Fonts.headingSemiBold,
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
  },
  korean: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  note: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    lineHeight: FontSizes.xs * 1.6,
    color: Colors.textMuted,
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
  toggle: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.xs,
  },
  toggleLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.xs,
    color: Colors.primaryLight,
  },
});
