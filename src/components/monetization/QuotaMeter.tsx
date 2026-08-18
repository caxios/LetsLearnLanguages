import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ProgressBar } from '@/components/ui/ProgressBar';
import { Colors } from '@/constants/colors';
import { FontSizes, Fonts } from '@/constants/fonts';
import { BorderRadius, Spacing } from '@/constants/layout';
import { QUOTA_FEATURES, type QuotaFeature } from '@/constants/monetization';
import { remainingFor, useMonetizationStore } from '@/stores/useMonetizationStore';

interface QuotaMeterProps {
  feature: QuotaFeature;
  /** `card` is the full meter; `pill` is a compact badge for tight rows. */
  variant?: 'card' | 'pill';
}

/** Green while there is room, amber on the last try, red at zero. */
function meterColor(remaining: number, limit: number): string {
  if (remaining === 0) return Colors.error;
  if (remaining / limit <= 0.34) return Colors.warning;
  return Colors.secondary;
}

/**
 * How many tries are left today, stated loudly enough to actually read.
 *
 * Being stopped by a limit you were never shown reads as a bug rather than a
 * limit, so every metered action carries one of these. Premium has no count to
 * show, so it renders nothing.
 */
export function QuotaMeter({ feature, variant = 'card' }: QuotaMeterProps) {
  const isPremium = useMonetizationStore((s) => s.isPremium);
  const dailyUsage = useMonetizationStore((s) => s.dailyUsage);

  if (isPremium) return null;

  const { label, limit, unit, adGated } = QUOTA_FEATURES[feature];
  const remaining = remainingFor(feature, isPremium, dailyUsage);
  const color = meterColor(remaining, limit);

  if (variant === 'pill') {
    return (
      <View
        style={[styles.pill, { borderColor: color, backgroundColor: `${color}1F` }]}
        accessibilityLabel={`오늘 남은 ${label} ${remaining}${unit}, 최대 ${limit}${unit}`}
      >
        <Text style={[styles.pillCount, { color }]}>
          {remaining}/{limit}
        </Text>
        <Text style={styles.pillLabel}>{label}</Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.card, { borderColor: color }]}
      accessibilityLabel={`오늘 남은 ${label} ${remaining}${unit}, 최대 ${limit}${unit}`}
    >
      <View style={styles.header}>
        <Text style={styles.label}>오늘 남은 {label}</Text>
        <Text style={[styles.count, { color }]}>
          {remaining}
          <Text style={styles.countTotal}>
            /{limit}
            {unit}
          </Text>
        </Text>
      </View>

      <ProgressBar progress={limit > 0 ? remaining / limit : 0} color={color} height={10} />

      <Text style={styles.note}>
        {remaining === 0
          ? '내일 다시 채워져요. 프리미엄은 제한이 없어요.'
          : adGated
            ? '평가 전에 짧은 광고가 한 번 재생돼요.'
            : '매일 자정에 다시 채워져요.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.sm,
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    backgroundColor: Colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  label: {
    flex: 1,
    fontFamily: Fonts.headingSemiBold,
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
  },
  count: {
    fontFamily: Fonts.mono,
    fontSize: FontSizes['2xl'],
  },
  countTotal: {
    fontFamily: Fonts.mono,
    fontSize: FontSizes.sm,
    color: Colors.textMuted,
  },
  note: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  pillCount: {
    fontFamily: Fonts.mono,
    fontSize: FontSizes.base,
  },
  pillLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
});
