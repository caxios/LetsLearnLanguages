import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';
import { FontSizes, Fonts } from '@/constants/fonts';
import { BorderRadius, Spacing } from '@/constants/layout';

interface StatsPanelProps {
  /** Distinct Korean sentences the user has translated. */
  uniqueSentences: number;
  /** Review re-attempts completed across the whole deck. */
  totalReviews: number;
}

/** Progress widget on the home screen: two plain counters, no goalposts. */
export function StatsPanel({ uniqueSentences, totalReviews }: StatsPanelProps) {
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
  return (
    <View style={styles.metric} accessibilityLabel={`${label} ${value}${unit}`}>
      <View style={[styles.iconWrap, { borderColor: color }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>

      <Text style={styles.label}>{label}</Text>

      <View style={styles.valueRow}>
        <Text style={[styles.value, { color }]}>{value}</Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>
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
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.base,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: FontSizes.base,
  },
  label: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.xs,
  },
  value: {
    fontFamily: Fonts.mono,
    fontSize: FontSizes['3xl'],
  },
  unit: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
  },
});
