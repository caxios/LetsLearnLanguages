import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { generateTopicSentences, type TopicSentence } from '@/services/topicSentences';

const topicKey = (topic: string | null) => ['topicSentences', topic ?? ''] as const;

/**
 * Sentences for one topic, cached per topic.
 *
 * Reading and generating are deliberately separate. Opening a topic must be free
 * — it costs no quota and shows no ad — so the query never fetches on its own;
 * it only ever reads what is already cached. Generation is an explicit action
 * the caller triggers, and that is the only thing that spends a try.
 */
export function useTopicSentences(topic: string | null) {
  const queryClient = useQueryClient();

  const cached = useQuery({
    queryKey: topicKey(topic),
    queryFn: () => generateTopicSentences(topic!),
    // Never auto-fetch. Mounting this screen must not call the API.
    enabled: false,
    // Sentences are a one-off creative result, not data that goes stale, and
    // they must outlive every trip to the input screen and back.
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const generate = useMutation({
    mutationFn: (next: string) => generateTopicSentences(next),
    // Writing through the cache is what makes re-entry free afterwards.
    onSuccess: (data, next) => queryClient.setQueryData(topicKey(next), data),
  });

  /** Whether `topic` can be opened without generating anything. */
  const hasSentencesFor = useCallback(
    (next: string) => queryClient.getQueryData<TopicSentence[]>(topicKey(next)) !== undefined,
    [queryClient]
  );

  return {
    sentences: cached.data,
    hasSentencesFor,

    generate: generate.mutateAsync,
    isGenerating: generate.isPending,
    generateError: generate.error,
  };
}
