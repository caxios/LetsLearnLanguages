import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';
import { FontSizes, Fonts } from '@/constants/fonts';
import { BorderRadius, Spacing } from '@/constants/layout';

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

interface StreakBadgeProps {
  streak: number;
  /** Distinct YYYY-MM-DD strings the user was active on. */
  activeDates: string[];
  /** Today as YYYY-MM-DD. */
  today: string;
}

function shift(date: string, deltaDays: number) {
  const [y, m, d] = date.split('-').map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return shifted.toISOString().slice(0, 10);
}

/** Flame badge plus a seven-day attendance strip. */
export function StreakBadge({ streak, activeDates, today }: StreakBadgeProps) {
  const active = new Set(activeDates);

  // Oldest first, so the strip reads left-to-right ending on today.
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = shift(today, index - 6);
    const [y, m, d] = date.split('-').map(Number);
    return {
      date,
      isActive: active.has(date),
      isToday: date === today,
      label: WEEKDAY_LABELS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()],
    };
  });

  const message =
    streak === 0
      ? '오늘 첫 학습을 시작해 보세요'
      : streak === 1
        ? '좋은 시작이에요. 내일도 이어가요!'
        : `${streak}일째 이어지고 있어요. 계속 가봐요!`;

  return (
    <LinearGradient
      colors={[Colors.primaryMuted, Colors.secondaryMuted]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.top}>
        <View style={styles.flameWrap}>
          <Text style={styles.flame}>🔥</Text>
        </View>

        <View style={styles.copy}>
          <View style={styles.countRow}>
            <Text
              style={styles.count}
              accessibilityLabel={`현재 ${streak}일 연속 학습 중`}
            >
              {streak}
            </Text>
            <Text style={styles.unit}>일 연속 학습 중</Text>
          </View>
          <Text style={styles.message}>{message}</Text>
        </View>
      </View>

      <View style={styles.week} accessibilityLabel="최근 7일 출석">
        {week.map((day) => (
          <View key={day.date} style={styles.day}>
            <View
              style={[
                styles.dot,
                day.isActive && styles.dotActive,
                day.isToday && styles.dotToday,
              ]}
            >
              {day.isActive && <Text style={styles.dotMark}>✓</Text>}
            </View>
            <Text style={[styles.dayLabel, day.isToday && styles.dayLabelToday]}>{day.label}</Text>
          </View>
        ))}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: Spacing.base,
    gap: Spacing.base,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  flameWrap: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flame: {
    fontSize: 26,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.xs,
  },
  count: {
    fontFamily: Fonts.mono,
    fontSize: FontSizes['3xl'],
    color: Colors.textPrimary,
  },
  unit: {
    fontFamily: Fonts.headingSemiBold,
    fontSize: FontSizes.base,
    color: Colors.textPrimary,
  },
  message: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  week: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  day: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  dotToday: {
    borderColor: Colors.primaryLight,
    borderWidth: 2,
  },
  dotMark: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.xs,
    color: Colors.textInverse,
  },
  dayLabel: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: Colors.textMuted,
  },
  dayLabelToday: {
    color: Colors.primaryLight,
  },
});
