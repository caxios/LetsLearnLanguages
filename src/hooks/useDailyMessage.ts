import { useQuery } from '@tanstack/react-query';

import { getOrCreateDailyMessage } from '@/services/dailyMessage';
import { todayKey } from '@/hooks/useDailySentences';

/**
 * The day's encouragement. Decorative, so it never retries and never blocks the
 * home screen — the badge falls back to a static line if Gemini is unreachable.
 */
export function useDailyMessage() {
  const today = todayKey();

  return useQuery({
    queryKey: ['dailyMessage', today],
    queryFn: () => getOrCreateDailyMessage(today),
    staleTime: Infinity,
    retry: false,
  });
}
