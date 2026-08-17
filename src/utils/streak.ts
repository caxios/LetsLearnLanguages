import { shiftDays } from '@/utils/calendar';

/**
 * Count consecutive days of activity ending today (or yesterday — a streak is
 * only broken once a full day has been skipped).
 *
 * @param activityDates distinct YYYY-MM-DD strings, newest first
 * @param today YYYY-MM-DD
 */
export function calculateStreak(activityDates: string[], today: string): number {
  const days = new Set(activityDates);
  if (days.size === 0) return 0;

  // Yesterday still counts — today's session may just not have happened yet.
  let cursor = days.has(today) ? today : shiftDays(today, -1);
  if (!days.has(cursor)) return 0;

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = shiftDays(cursor, -1);
  }

  return streak;
}
