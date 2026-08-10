import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { reviewRepository } from '@/db/repositories/reviewRepository';

export function useReviewCards() {
  return useQuery({
    queryKey: ['reviewCards', 'due'],
    queryFn: () => reviewRepository.getDueCards(),
  });
}

/** Drop a mastered card from the deck, along with its logged attempts. */
export function useDeleteReviewCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => reviewRepository.deleteById(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviewCards'] });
      // The deck's attempts are gone with it, so the home counters move too.
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });
}
