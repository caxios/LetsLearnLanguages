import * as Haptics from 'expo-haptics';
import { SymbolView } from 'expo-symbols';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';
import { FontSizes, Fonts } from '@/constants/fonts';
import { BorderRadius, Spacing } from '@/constants/layout';
import { useAttendanceCalendar } from '@/hooks/useAttendanceCalendar';
import { WEEKDAY_LABELS, type AttendanceDay, type DayKey } from '@/utils/calendar';

interface AttendanceCalendarProps {
  /** Distinct `YYYY-MM-DD` days the user was active on. */
  activeDates: DayKey[];
  /** Today as `YYYY-MM-DD`. */
  today: DayKey;
}

type Direction = 'left' | 'right' | 'down' | 'up';

/** `as const` keeps the names as literals, which is what `SymbolView` expects. */
const CHEVRON = {
  left: { ios: 'chevron.left', material: 'chevron_left' },
  right: { ios: 'chevron.right', material: 'chevron_right' },
  down: { ios: 'chevron.down', material: 'expand_more' },
  up: { ios: 'chevron.up', material: 'expand_less' },
} as const;

const tap = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

function Chevron({ direction }: { direction: Direction }) {
  return (
    <SymbolView
      name={{
        ios: CHEVRON[direction].ios,
        android: CHEVRON[direction].material,
        web: CHEVRON[direction].material,
      }}
      size={16}
      tintColor={Colors.textSecondary}
    />
  );
}

/** One day. The week strip shows a tick, the month grid shows the date. */
function DayCell({ day, compact }: { day: AttendanceDay; compact: boolean }) {
  return (
    <View
      style={[
        styles.dot,
        compact && styles.dotCompact,
        day.isActive && styles.dotActive,
        day.isToday && styles.dotToday,
        day.isFuture && styles.dotFuture,
      ]}
    >
      <Text
        style={[
          styles.dotLabel,
          day.isActive && styles.dotLabelActive,
          day.isFuture && styles.dotLabelFuture,
        ]}
      >
        {compact && day.isActive ? '✓' : day.dayOfMonth}
      </Text>
    </View>
  );
}

function NavButton({
  label,
  direction,
  disabled,
  onPress,
}: {
  label: string;
  direction: 'left' | 'right';
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        tap();
        onPress();
      }}
      style={({ pressed }) => [
        styles.nav,
        disabled && styles.navDisabled,
        pressed && styles.pressed,
      ]}
    >
      <Chevron direction={direction} />
    </Pressable>
  );
}

/**
 * Attendance at three zoom levels: a seven-day strip, the whole month, and a
 * month chooser for browsing back through past months. The strip is what the
 * user taps to expand; the month title is what they tap to change month.
 */
export function AttendanceCalendar({ activeDates, today }: AttendanceCalendarProps) {
  const calendar = useAttendanceCalendar({ activeDates, today });
  const { view, isExpanded, isPicking } = calendar;

  // Cross-fade whenever the view or month changes, so swapping strip / grid /
  // picker doesn't snap. Height is left to flow — measuring it buys little here.
  const reveal = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    reveal.setValue(0);
    const animation = Animated.timing(reveal, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [view, calendar.visibleMonth, calendar.pickerYear, reveal]);

  const handleToggle = () => {
    tap();
    calendar.toggleExpanded();
  };

  const handleMonthTitle = () => {
    tap();
    if (isPicking) {
      calendar.closeMonthPicker();
    } else {
      calendar.openMonthPicker();
    }
  };

  const toggleLabel = isExpanded ? '출석 달력 접기' : '한 달 출석 달력 펼치기';

  return (
    <View style={styles.container}>
      {isExpanded && (
        <View style={styles.monthBar}>
          <NavButton
            label="이전 달"
            direction="left"
            disabled={isPicking || !calendar.canGoPrevMonth}
            onPress={() => calendar.stepMonth(-1)}
          />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isPicking ? '달 선택 닫기' : `${calendar.visibleMonthLabel}, 다른 달 선택하기`
            }
            accessibilityState={{ expanded: isPicking }}
            onPress={handleMonthTitle}
            style={({ pressed }) => [styles.monthTitle, pressed && styles.pressed]}
          >
            <Text style={styles.monthTitleLabel}>{calendar.visibleMonthLabel}</Text>
            <Chevron direction={isPicking ? 'up' : 'down'} />
          </Pressable>

          <NavButton
            label="다음 달"
            direction="right"
            disabled={isPicking || !calendar.canGoNextMonth}
            onPress={() => calendar.stepMonth(1)}
          />
        </View>
      )}

      <Animated.View
        style={{
          opacity: reveal,
          transform: [
            { translateY: reveal.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) },
          ],
        }}
      >
        {/* Only the collapsed strip is a press target. Wrapping the grid and the
            picker too would put a second touchable over every day and month
            chip, and collapse the card on any stray tap. */}
        {!isExpanded && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={toggleLabel}
            accessibilityState={{ expanded: false }}
            onPress={handleToggle}
            style={({ pressed }) => [styles.weekPress, pressed && styles.pressed]}
          >
            {/* The row lives on a plain View, not on the Pressable itself —
                the same shape the month grid below uses, and the same shape
                Card uses for its press target. */}
            <View style={styles.week}>
              {calendar.week.map((day) => (
                <View key={day.date} style={styles.weekDay}>
                  <DayCell day={day} compact />
                  <Text style={[styles.weekdayLabel, day.isToday && styles.weekdayLabelToday]}>
                    {WEEKDAY_LABELS[day.weekday]}
                  </Text>
                </View>
              ))}
            </View>
          </Pressable>
        )}

        {isExpanded && !isPicking && (
          <View style={styles.grid} accessibilityLabel={`${calendar.visibleMonthLabel} 출석`}>
            <View style={styles.gridHeader}>
              {WEEKDAY_LABELS.map((label) => (
                <Text key={label} style={styles.gridHeaderLabel}>
                  {label}
                </Text>
              ))}
            </View>

            <View style={styles.gridBody}>
              {calendar.grid.map((day, index) => (
                <View key={day?.date ?? `blank-${index}`} style={styles.gridCell}>
                  {day && <DayCell day={day} compact={false} />}
                </View>
              ))}
            </View>
          </View>
        )}

        {isPicking && (
          <View style={styles.picker}>
            <View style={styles.pickerHeader}>
              <NavButton
                label="이전 해"
                direction="left"
                disabled={!calendar.canGoPrevYear}
                onPress={() => calendar.stepPickerYear(-1)}
              />
              <Text style={styles.pickerYear}>{calendar.pickerYear}년</Text>
              <NavButton
                label="다음 해"
                direction="right"
                disabled={!calendar.canGoNextYear}
                onPress={() => calendar.stepPickerYear(1)}
              />
            </View>

            <View style={styles.pickerGrid}>
              {calendar.pickerMonths.map((month) => (
                <Pressable
                  key={month.month}
                  accessibilityRole="button"
                  accessibilityLabel={`${calendar.pickerYear}년 ${month.label} 출석 보기`}
                  accessibilityState={{
                    selected: month.isSelected,
                    disabled: !month.isSelectable,
                  }}
                  disabled={!month.isSelectable}
                  onPress={() => {
                    tap();
                    calendar.selectMonth(month.month);
                  }}
                  style={({ pressed }) => [
                    styles.monthChip,
                    month.isSelected && styles.monthChipSelected,
                    !month.isSelectable && styles.monthChipDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.monthChipLabel,
                      month.isSelected && styles.monthChipLabelSelected,
                      !month.isSelectable && styles.monthChipLabelDisabled,
                    ]}
                  >
                    {month.label}
                  </Text>
                  {month.isSelectable && (
                    <Text style={styles.monthChipCount}>
                      {month.attended > 0 ? `${month.attended}일` : '—'}
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </Animated.View>

      <View style={styles.footer}>
        <Text style={styles.summary}>
          {!isExpanded
            ? '지난 7일'
            : calendar.summary.elapsed > 0
              ? `${calendar.visibleMonthNumber}월 ${calendar.summary.elapsed}일 중 ${calendar.summary.attended}일 출석`
              : '아직 기록이 없는 달이에요'}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={toggleLabel}
          accessibilityState={{ expanded: isExpanded }}
          onPress={handleToggle}
          style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
        >
          <Text style={styles.toggleLabel}>{isExpanded ? '접기' : '한 달 보기'}</Text>
          <Chevron direction={isExpanded ? 'up' : 'down'} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.md,
  },
  pressed: {
    opacity: 0.6,
  },

  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
  },
  monthTitleLabel: {
    fontFamily: Fonts.headingSemiBold,
    fontSize: FontSizes.base,
    color: Colors.textPrimary,
  },
  nav: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  navDisabled: {
    opacity: 0.3,
  },

  /** Touch target only — it must not carry the row, or it has none of its own. */
  weekPress: {
    alignSelf: 'stretch',
  },
  week: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  weekDay: {
    // Seven fixed columns, exactly like `gridCell`. `flex: 1` measures to zero
    // here because the strip has no intrinsic width to divide up.
    width: `${100 / 7}%`,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  weekdayLabel: {
    fontFamily: Fonts.body,
    fontSize: 10,
    color: Colors.textMuted,
  },
  weekdayLabelToday: {
    color: Colors.primaryLight,
  },

  grid: {
    gap: Spacing.sm,
  },
  gridHeader: {
    flexDirection: 'row',
  },
  gridHeaderLabel: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontFamily: Fonts.body,
    fontSize: 10,
    color: Colors.textMuted,
  },
  gridBody: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: Spacing.xs,
  },
  gridCell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
  },

  dot: {
    width: 30,
    height: 30,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCompact: {
    width: 28,
    height: 28,
  },
  dotActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  dotToday: {
    borderColor: Colors.primaryLight,
    borderWidth: 2,
  },
  dotFuture: {
    backgroundColor: 'transparent',
    borderColor: Colors.divider,
  },
  dotLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  dotLabelActive: {
    color: Colors.textInverse,
  },
  dotLabelFuture: {
    color: Colors.textMuted,
    opacity: 0.5,
  },

  picker: {
    gap: Spacing.md,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerYear: {
    fontFamily: Fonts.headingSemiBold,
    fontSize: FontSizes.base,
    color: Colors.textPrimary,
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: Spacing.sm,
  },
  monthChip: {
    width: '25%',
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    gap: 2,
  },
  monthChipSelected: {
    // An inner pill would clip against the 25% column, so tint the whole cell.
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primaryMuted,
  },
  monthChipDisabled: {
    opacity: 0.35,
  },
  monthChipLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
  },
  monthChipLabelSelected: {
    color: Colors.primaryLight,
  },
  monthChipLabelDisabled: {
    color: Colors.textMuted,
  },
  monthChipCount: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    color: Colors.textMuted,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summary: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  toggleLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.xs,
    color: Colors.primaryLight,
  },
});
