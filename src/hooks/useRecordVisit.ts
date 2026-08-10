import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { visitRepository } from '@/db/repositories/visitRepository';
import { todayKey } from '@/hooks/useDailySentences';

/** Stamp today's attendance once per mount so the streak counts app visits. */
export function useRecordVisit() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;

    visitRepository
      .recordVisit(todayKey())
      .then(() => {
        if (!cancelled) {
          queryClient.invalidateQueries({ queryKey: ['stats'] });
        }
      })
      .catch(() => {
        // Attendance is a nicety — never block the screen on it.
      });

    return () => {
      cancelled = true;
    };
  }, [queryClient]);
}
