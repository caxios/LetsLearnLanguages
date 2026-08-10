import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

import { evaluationRepository } from '@/db/repositories/evaluationRepository';
import { calculateStreak } from '@/utils/streak';

export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: async () => {
      const [{ total, averageScore }, activityDates] = await Promise.all([
        evaluationRepository.getStats(),
        evaluationRepository.getActivityDates(),
      ]);

      return {
        total,
        averageScore,
        streak: calculateStreak(activityDates, format(new Date(), 'yyyy-MM-dd')),
      };
    },
  });
}
