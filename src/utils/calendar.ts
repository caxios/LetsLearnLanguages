/**
 * Calendar maths for the attendance tracker.
 *
 * Days are `YYYY-MM-DD` and months `YYYY-MM`, both compared and sorted as plain
 * strings. All arithmetic runs in UTC to match `calculateStreak` — stepping a
 * local `Date` by a day drifts across a DST boundary and would silently shift a
 * whole month's grid.
 */

/** `YYYY-MM-DD`. */
export type DayKey = string;

/** `YYYY-MM`. */
export type MonthKey = string;

export interface AttendanceDay {
  date: DayKey;
  /** 1-31. */
  dayOfMonth: number;
  /** 0 = Sunday, matching `WEEKDAY_LABELS`. */
  weekday: number;
  isActive: boolean;
  isToday: boolean;
  /** Tomorrow onwards can never be attended, so those cells render inert. */
  isFuture: boolean;
}

export interface MonthSummary {
  /** Days attended in the month. */
  attended: number;
  /** Days that could have been attended — capped at today for the current month. */
  elapsed: number;
}

export const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'] as const;

function toUtcDate(day: DayKey): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toDayKey(date: Date): DayKey {
  return date.toISOString().slice(0, 10);
}

export function shiftDays(day: DayKey, deltaDays: number): DayKey {
  const [y, m, d] = day.split('-').map(Number);
  return toDayKey(new Date(Date.UTC(y, m - 1, d + deltaDays)));
}

/** `2026-08-17` → `2026-08`. */
export function monthOf(day: DayKey): MonthKey {
  return day.slice(0, 7);
}

export function shiftMonths(month: MonthKey, deltaMonths: number): MonthKey {
  const [y, m] = month.split('-').map(Number);
  return toDayKey(new Date(Date.UTC(y, m - 1 + deltaMonths, 1))).slice(0, 7);
}

export function yearOf(month: MonthKey): number {
  return Number(month.slice(0, 4));
}

export function monthNumberOf(month: MonthKey): number {
  return Number(month.slice(5, 7));
}

export function monthKey(year: number, monthNumber: number): MonthKey {
  return `${year}-${String(monthNumber).padStart(2, '0')}`;
}

/** Day 0 of the next month is the last day of this one. */
export function daysInMonth(month: MonthKey): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function formatMonthLabel(month: MonthKey): string {
  return `${yearOf(month)}년 ${monthNumberOf(month)}월`;
}

function buildDay(date: DayKey, today: DayKey, active: Set<DayKey>): AttendanceDay {
  return {
    date,
    dayOfMonth: Number(date.slice(8, 10)),
    weekday: toUtcDate(date).getUTCDay(),
    isActive: active.has(date),
    isToday: date === today,
    isFuture: date > today,
  };
}

/** The seven days ending on `today`, oldest first so the strip reads left to right. */
export function buildWeekStrip(today: DayKey, active: Set<DayKey>): AttendanceDay[] {
  return Array.from({ length: 7 }, (_, index) => buildDay(shiftDays(today, index - 6), today, active));
}

/**
 * A Sunday-aligned month grid. Leading and trailing `null`s pad the first and
 * last weeks so every row holds exactly seven cells and the columns line up
 * under the weekday headings.
 */
export function buildMonthGrid(
  month: MonthKey,
  today: DayKey,
  active: Set<DayKey>
): (AttendanceDay | null)[] {
  const total = daysInMonth(month);
  const days = Array.from({ length: total }, (_, index) =>
    buildDay(`${month}-${String(index + 1).padStart(2, '0')}`, today, active)
  );

  const leading = Array.from<null>({ length: days[0].weekday }).fill(null);
  const cells: (AttendanceDay | null)[] = [...leading, ...days];
  const trailing = (7 - (cells.length % 7)) % 7;

  return [...cells, ...Array.from<null>({ length: trailing }).fill(null)];
}

export function summarizeMonth(
  month: MonthKey,
  today: DayKey,
  active: Set<DayKey>
): MonthSummary {
  const total = daysInMonth(month);
  const isCurrentMonth = month === monthOf(today);
  // A month still in progress is only fair to score against the days it has had.
  const elapsed = isCurrentMonth ? Number(today.slice(8, 10)) : month > monthOf(today) ? 0 : total;

  let attended = 0;
  for (let day = 1; day <= total; day += 1) {
    if (active.has(`${month}-${String(day).padStart(2, '0')}`)) attended += 1;
  }

  return { attended, elapsed };
}
