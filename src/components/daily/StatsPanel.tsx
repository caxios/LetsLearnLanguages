import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ProgressBar } from '@/components/ui/ProgressBar';
import { Colors, scoreColor } from '@/constants/colors';
import { FontSizes, Fonts } from '@/constants/fonts';
import { BorderRadius, Spacing } from '@/constants/layout';

/** Goalposts close enough to feel reachable, spaced out as the habit sticks. */
const MILESTONES = [5, 10, 25, 50, 100, 200, 500, 1000];

export function nextMilestone(value: number): number {
  const next = MILESTONES.find((milestone) => milestone > value);
  // Past the ladder, keep rolling in thousands.
  return next ?? (Math.floor(value / 1000) + 1) * 1000;
}

interface StatsPanelProps {
  /** Distinct Korean sentences the user has translated. */
  uniqueSentences: number;
  /** Review re-attempts completed across the whole deck. */
  totalReviews: number;
  /** Mean overall score, 0-100. */
  averageScore: number;
}

/** Progress widget on the home screen: what has been done, and what's next. */
export function StatsPanel({ uniqueSentences, totalReviews, averageScore }: StatsPanelProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>📊 나의 기록</Text>

      <View style={styles.row}>
        <MetricCard
          icon="✍️"
          label="번역한 문장"
          value={uniqueSentences}
          unit="문장"
          color={Colors.primaryLight}
        />
        <MetricCard
          icon="🔁"
          label="복습 완료"
          value={totalReviews}
          unit="회"
          color={Colors.secondary}
        />
      </View>

      <View style={styles.average}>
        <View style={styles.averageHeader}>
          <Text style={styles.averageLabel}>평균 점수</Text>
          <Text style={[styles.averageValue, { color: scoreColor(averageScore) }]}>
            {averageScore}점
          </Text>
        </View>
        <ProgressBar progress={averageScore / 100} color={scoreColor(averageScore)} height={10} />
      </View>
    </View>
  );
}

function MetricCard({
  icon,
  label,
  value,
  unit,
  color,
}: {
  icon: string;
  label: string;
  value: number;
  unit: string;
  color: string;
}) {
  const target = nextMilestone(value);

  return (
    <View style={styles.metric} accessibilityLabel={`${label} ${value}${unit}`}>
      <View style={styles.metricHeader}>
        <Text style={styles.metricIcon}>{icon}</Text>
        <Text style={styles.metricLabel}>{label}</Text>
      </View>

      <View style={styles.metricValueRow}>
        <Text style={[styles.metricValue, { color }]}>{value}</Text>
        <Text style={styles.metricUnit}>{unit}</Text>
      </View>

      <ProgressBar progress={value / target} color={color} height={6} />
      <Text style={styles.metricTarget}>
        다음 목표 {target}
        {unit}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.xl,
    color: Colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  metric: {
    flex: 1,
    gap: Spacing.sm,
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metricIcon: {
    fontSize: FontSizes.sm,
  },
  metricLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.xs,
  },
  metricValue: {
    fontFamily: Fonts.mono,
    fontSize: FontSizes['2xl'],
  },
  metricUnit: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
  },
  metricTarget: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: Colors.textMuted,
  },
  average: {
    gap: Spacing.sm,
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  averageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  averageLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  averageValue: {
    fontFamily: Fonts.mono,
    fontSize: FontSizes.lg,
  },
});
