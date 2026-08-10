import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

import { evaluationRepository } from '@/db/repositories/evaluationRepository';
import { reviewAttemptRepository } from '@/db/repositories/reviewAttemptRepository';
import { visitRepository } from '@/db/repositories/visitRepository';
import { calculateStreak } from '@/utils/streak';

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const [{ total, averageScore }, practiceDates, visitDates, uniqueSentences, totalReviews] =
        await Promise.all([
          evaluationRepository.getStats(),
          evaluationRepository.getActivityDates(),
          visitRepository.getVisitDates(),
          evaluationRepository.getUniqueSentenceCount(),
          reviewAttemptRepository.countAll(),
        ]);

      // Attendance counts, and so does practice done before visits were tracked.
      const activeDates = [...new Set([...visitDates, ...practiceDates])].sort().reverse();
      const today = format(new Date(), 'yyyy-MM-dd');

      return {
        total,
        averageScore,
        uniqueSentences,
        totalReviews,
        streak: calculateStreak(activeDates, today),
        activeDates,
        today,
      };
    },
  });
}
