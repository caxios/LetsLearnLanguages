import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

import { sentenceRepository } from '@/db/repositories/sentenceRepository';
import { generateMoreDailySentences, getOrCreateDailySentences } from '@/services/dailySentences';

export function todayKey() {
  return format(new Date(), 'yyyy-MM-dd');
}

export function useDailySentences() {
  const today = todayKey();

  return useQuery({
    queryKey: ['dailySentences', today],
    queryFn: () => getOrCreateDailySentences(today),
    staleTime: Infinity, // Sentences don't change within the same day
  });
}

/** Generate three additional sentences for today, keeping the existing ones. */
export function useRefreshDailySentences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => generateMoreDailySentences(todayKey()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailySentences'] });
    },
  });
}

/** Flag a sentence as seen so the card can show it has been practiced. */
export function useMarkSentenceViewed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => sentenceRepository.markCompleted(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailySentences'] });
    },
  });
}
