import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

import { getOrCreateDailySentences } from '@/services/dailySentences';

export function useDailySentences() {
  const today = format(new Date(), 'yyyy-MM-dd');

  return useQuery({
    queryKey: ['dailySentences', today],
    queryFn: () => getOrCreateDailySentences(today),
    staleTime: Infinity, // Sentences don't change within the same day
  });
}
