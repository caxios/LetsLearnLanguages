import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

import { refreshDailyMessage } from '@/services/dailyMessage';
import { getOrCreateDailySentences, refreshDailySentences } from '@/services/dailySentences';

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

/** Replace today's sentences with a freshly generated set of three. */
export function useRefreshDailySentences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const date = todayKey();
      const sentences = await refreshDailySentences(date);

      // New day's content deserves a new encouragement — but a failure here must
      // not fail the refresh the user actually asked for.
      await refreshDailyMessage(date).catch(() => null);

      return sentences;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailySentences'] });
      queryClient.invalidateQueries({ queryKey: ['dailyMessage'] });
    },
  });
}

