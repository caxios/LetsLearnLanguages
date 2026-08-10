import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { reviewRepository } from '@/db/repositories/reviewRepository';

export function useReviewCards() {
  return useQuery({
    queryKey: ['reviewCards', 'due'],
    queryFn: () => reviewRepository.getDueCards(),
  });
}

/** Drop a mastered card from the deck. Its logged attempts stay in the record. */
export function useDeleteReviewCard() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => reviewRepository.deleteById(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviewCards'] });
    },
  });
}
