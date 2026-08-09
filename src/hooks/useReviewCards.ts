import { useQuery } from '@tanstack/react-query';

import { reviewRepository } from '@/db/repositories/reviewRepository';

export function useReviewCards() {
  return useQuery({
    queryKey: ['reviewCards', 'due'],
    queryFn: () => reviewRepository.getDueCards(),
  });
}
