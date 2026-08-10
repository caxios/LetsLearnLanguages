import { desc } from 'drizzle-orm';

import { db } from '@/db/client';
import { appVisits } from '@/db/schema';

export const visitRepository = {
  /** Record that the app was opened on `date`. Repeat calls the same day are no-ops. */
  async recordVisit(date: string) {
    return db.insert(appVisits).values({ visitDate: date }).onConflictDoNothing();
  },

  /** Distinct visit days, newest first. */
  async getVisitDates(): Promise<string[]> {
    const rows = await db
      .select({ visitDate: appVisits.visitDate })
      .from(appVisits)
      .orderBy(desc(appVisits.visitDate));

    return rows.map((row) => row.visitDate);
  },
};
