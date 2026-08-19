import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GrammarTeacherModal } from '@/components/grammar/GrammarTeacherModal';
import { FeedbackPanel } from '@/components/evaluation/FeedbackPanel';
import { RecommendationList } from '@/components/evaluation/RecommendationList';
import { ScoreCard } from '@/components/evaluation/ScoreCard';
import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/colors';
import { FontSizes, Fonts } from '@/constants/fonts';
import { Spacing } from '@/constants/layout';
import type { evaluationRepository } from '@/db/repositories/evaluationRepository';
import { formatAttemptDate } from '@/utils/dates';

/** An evaluation with its input row and recommendations, as stored. */
export type StoredEvaluation = NonNullable<
  Awaited<ReturnType<typeof evaluationRepository.getById>>
>;

interface EvaluationDetailProps {
  evaluation: StoredEvaluation;
}

/**
 * Replays a saved evaluation: scores, the translation that earned them and when,
 * the feedback, and the recommended alternatives. Shared by the review deck and
 * the practice screen so a past attempt looks the same wherever it resurfaces.
 */
export function EvaluationDetail({ evaluation }: EvaluationDetailProps) {
  // The sheet is owned here so a term tapped in the feedback and one tapped in a
  // recommendation open the same thing.
  const [term, setTerm] = useState<string | null>(null);

  return (
    <View style={styles.container}>
      <ScoreCard
        naturalness={evaluation.naturalnessScore}
        grammar={evaluation.grammarScore}
        meaningClarity={evaluation.meaningClarityScore}
      />

      <Card variant="outlined">
        <View style={styles.header}>
          <Text style={styles.label}>나의 번역</Text>
          <Text style={styles.date}>{formatAttemptDate(evaluation.input.createdAt)}</Text>
        </View>
        <Text style={styles.body}>{evaluation.input.englishInput}</Text>
      </Card>

      <FeedbackPanel feedback={evaluation.feedback} onTermPress={setTerm} />

      <RecommendationList
        recommendations={evaluation.recommendations.map((rec) => ({
          sentence: rec.sentence,
          contextAndNuance: rec.contextAndNuance,
          koreanTranslation: rec.koreanTranslation,
          grammarExplanation: rec.grammarExplanation,
        }))}
        onTermPress={setTerm}
      />

      <GrammarTeacherModal
        term={term}
        context={evaluation.input.koreanText}
        onClose={() => setTerm(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.base,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
  },
  date: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
  },
  body: {
    marginTop: Spacing.xs,
    fontFamily: Fonts.body,
    fontSize: FontSizes.base,
    lineHeight: FontSizes.base * 1.5,
    color: Colors.textPrimary,
  },
});
