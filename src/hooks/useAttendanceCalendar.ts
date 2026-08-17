import { useCallback, useMemo, useState } from 'react';

import {
  buildMonthGrid,
  buildWeekStrip,
  formatMonthLabel,
  monthKey,
  monthNumberOf,
  monthOf,
  shiftMonths,
  summarizeMonth,
  yearOf,
  type AttendanceDay,
  type DayKey,
  type MonthKey,
  type MonthSummary,
} from '@/utils/calendar';

/**
 * `week` is the collapsed strip, `month` the expanded grid, and `picker` the
 * month chooser that replaces the grid while the card stays expanded.
 */
export type AttendanceView = 'week' | 'month' | 'picker';

/**
 * How far back the arrows and the picker reach even with nothing recorded —
 * a full year, so the current year's months are always browsable.
 */
export const MIN_BROWSABLE_MONTHS = 12;

export interface PickerMonth {
  month: MonthKey;
  /** 1-12. */
  monthNumber: number;
  label: string;
  isSelected: boolean;
  /** Months with no possible history (before the first visit, or in the future). */
  isSelectable: boolean;
  attended: number;
}

interface Options {
  /** Today as `YYYY-MM-DD`. */
  today: DayKey;
  /** Distinct days the user was active on, in any order. */
  activeDates: DayKey[];
}

/**
 * Drives the expandable attendance calendar: which view is showing, which month
 * it is showing, and the derived cells for each view.
 *
 * Browsing reaches back at least `MIN_BROWSABLE_MONTHS`, and further if there
 * is older history. Only the future is closed off, since no day after today can
 * carry an attendance mark.
 */
export function useAttendanceCalendar({ today, activeDates }: Options) {
  const currentMonth = monthOf(today);

  const active = useMemo(() => new Set(activeDates), [activeDates]);

  const earliestMonth = useMemo(() => {
    // Deriving the floor from recorded days alone left every arrow and chip
    // disabled for anyone whose visits all landed in the current month, so a
    // rolling window opens the recent past whether or not it holds a mark.
    const windowFloor = shiftMonths(currentMonth, -(MIN_BROWSABLE_MONTHS - 1));
    if (activeDates.length === 0) return windowFloor;

    // A clock-skewed future record sorts above the window, so it never wins.
    const recordedFloor = monthOf(activeDates.reduce((a, b) => (a < b ? a : b)));
    return recordedFloor < windowFloor ? recordedFloor : windowFloor;
  }, [activeDates, currentMonth]);

  const [view, setView] = useState<AttendanceView>('week');
  const [visibleMonth, setVisibleMonth] = useState<MonthKey>(currentMonth);
  const [pickerYear, setPickerYear] = useState<number>(yearOf(currentMonth));

  const clampMonth = useCallback(
    (month: MonthKey) => {
      if (month < earliestMonth) return earliestMonth;
      return month > currentMonth ? currentMonth : month;
    },
    [currentMonth, earliestMonth]
  );

  const toggleExpanded = useCallback(() => {
    setView((current) => {
      if (current === 'week') return 'month';

      // Collapsing forgets where the user browsed, so reopening always lands on
      // the current month — that is what the strip above it is showing.
      setVisibleMonth(currentMonth);
      setPickerYear(yearOf(currentMonth));
      return 'week';
    });
  }, [currentMonth]);

  const openMonthPicker = useCallback(() => {
    setPickerYear(yearOf(visibleMonth));
    setView('picker');
  }, [visibleMonth]);

  const closeMonthPicker = useCallback(() => setView('month'), []);

  const selectMonth = useCallback(
    (month: MonthKey) => {
      setVisibleMonth(clampMonth(month));
      setView('month');
    },
    [clampMonth]
  );

  const stepMonth = useCallback(
    (deltaMonths: number) => {
      setVisibleMonth((current) => clampMonth(shiftMonths(current, deltaMonths)));
    },
    [clampMonth]
  );

  const stepPickerYear = useCallback(
    (deltaYears: number) => {
      setPickerYear((current) => {
        const next = current + deltaYears;
        if (next < yearOf(earliestMonth)) return yearOf(earliestMonth);
        return next > yearOf(currentMonth) ? yearOf(currentMonth) : next;
      });
    },
    [currentMonth, earliestMonth]
  );

  const week: AttendanceDay[] = useMemo(() => buildWeekStrip(today, active), [today, active]);

  const grid: (AttendanceDay | null)[] = useMemo(
    () => buildMonthGrid(visibleMonth, today, active),
    [visibleMonth, today, active]
  );

  const summary: MonthSummary = useMemo(
    () => summarizeMonth(visibleMonth, today, active),
    [visibleMonth, today, active]
  );

  const pickerMonths: PickerMonth[] = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const month = monthKey(pickerYear, index + 1);
        return {
          month,
          monthNumber: index + 1,
          label: `${index + 1}월`,
          isSelected: month === visibleMonth,
          isSelectable: month >= earliestMonth && month <= currentMonth,
          attended: summarizeMonth(month, today, active).attended,
        };
      }),
    [pickerYear, visibleMonth, earliestMonth, currentMonth, today, active]
  );

  return {
    view,
    isExpanded: view !== 'week',
    isPicking: view === 'picker',

    visibleMonth,
    visibleMonthLabel: formatMonthLabel(visibleMonth),
    visibleMonthNumber: monthNumberOf(visibleMonth),
    pickerYear,

    week,
    grid,
    summary,
    pickerMonths,

    canGoPrevMonth: visibleMonth > earliestMonth,
    canGoNextMonth: visibleMonth < currentMonth,
    canGoPrevYear: pickerYear > yearOf(earliestMonth),
    canGoNextYear: pickerYear < yearOf(currentMonth),

    toggleExpanded,
    openMonthPicker,
    closeMonthPicker,
    selectMonth,
    stepMonth,
    stepPickerYear,
  };
}
