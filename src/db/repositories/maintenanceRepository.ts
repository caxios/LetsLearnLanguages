import { db } from '@/db/client';
import {
  appVisits,
  dailySentences,
  evaluations,
  recommendations,
  reviewAttempts,
  reviewCards,
  userInputs,
} from '@/db/schema';

export const maintenanceRepository = {
  /**
   * Wipe every user-generated row. Order matters: children before parents, since
   * foreign keys are enforced (see src/db/client.ts).
   */
  async clearAllData() {
    return db.transaction((tx) => {
      tx.delete(recommendations).run();
      tx.delete(reviewAttempts).run();
      tx.delete(reviewCards).run();
      tx.delete(evaluations).run();
      tx.delete(userInputs).run();
      tx.delete(dailySentences).run();
      tx.delete(appVisits).run();
    });
  },
};
