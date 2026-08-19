import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { grammarRepository } from '@/db/repositories/grammarRepository';
import { explainGrammarTerm } from '@/services/grammar';
import type { GrammarExplanation } from '@/types/grammar';

/**
 * The explanation for one grammar term.
 *
 * A saved note is served from the database first, so re-opening a term the user
 * kept costs nothing. Otherwise Gemini is asked once and the answer is cached
 * for the session — grammar does not change, so it never needs refetching.
 */
export function useGrammarExplanation(term: string | null, context?: string) {
  return useQuery({
    queryKey: ['grammar', 'explanation', term ?? ''],
    queryFn: async (): Promise<GrammarExplanation> => {
      const saved = await grammarRepository.getByTerm(term!);
      if (saved?.detail) return saved.detail;

      return explainGrammarTerm(term!, context);
    },
    enabled: !!term,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/** Notes the user kept, for the review tab. */
export function useGrammarNotes() {
  return useQuery({
    queryKey: ['grammar', 'notes'],
    queryFn: () => grammarRepository.list(),
  });
}

/** Whether this term is already in the review deck. */
export function useSavedGrammarNote(term: string | null) {
  return useQuery({
    queryKey: ['grammar', 'note', term ?? ''],
    queryFn: () => grammarRepository.getByTerm(term!),
    enabled: !!term,
  });
}

export function useSaveGrammarNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ term, explanation }: { term: string; explanation: GrammarExplanation }) =>
      grammarRepository.save(term, explanation),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['grammar'] }),
  });
}

export function useDeleteGrammarNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => grammarRepository.deleteById(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['grammar'] }),
  });
}
