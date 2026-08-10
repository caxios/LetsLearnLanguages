import { eq } from 'drizzle-orm';

import { db } from '@/db/client';
import { dailyMessages } from '@/db/schema';

export const dailyMessageRepository = {
  /** The encouragement written for `date`, if one has been generated already. */
  async getByDate(date: string) {
    const rows = await db
      .select()
      .from(dailyMessages)
      .where(eq(dailyMessages.dateAssigned, date))
      .limit(1);

    return rows[0] ?? null;
  },

  /** Store the day's message, replacing any earlier one for the same date. */
  async setForDate(date: string, message: string) {
    const [row] = await db
      .insert(dailyMessages)
      .values({ dateAssigned: date, message })
      .onConflictDoUpdate({
        target: dailyMessages.dateAssigned,
        set: { message },
      })
      .returning();

    return row;
  },
};
