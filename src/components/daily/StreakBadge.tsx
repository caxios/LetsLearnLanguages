import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AttendanceCalendar } from '@/components/daily/AttendanceCalendar';
import { Colors } from '@/constants/colors';
import { FontSizes, Fonts } from '@/constants/fonts';
import { BorderRadius, Spacing } from '@/constants/layout';
import type { DayKey } from '@/utils/calendar';

interface StreakBadgeProps {
  streak: number;
  /** Distinct YYYY-MM-DD strings the user was active on. */
  activeDates: DayKey[];
  /** Today as YYYY-MM-DD. */
  today: DayKey;
}

/** Flame badge over the expandable attendance calendar. */
export function StreakBadge({ streak, activeDates, today }: StreakBadgeProps) {
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
            <Text style={styles.count} accessibilityLabel={`현재 ${streak}일 연속 학습 중`}>
              {streak}
            </Text>
            <Text style={styles.unit}>일 연속 학습 중</Text>
          </View>
          <Text style={styles.message}>{message}</Text>
        </View>
      </View>

      <AttendanceCalendar activeDates={activeDates} today={today} />
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
});
