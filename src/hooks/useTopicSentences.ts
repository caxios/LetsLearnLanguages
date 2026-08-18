import { useMutation } from '@tanstack/react-query';

import { generateTopicSentences, type TopicSentence } from '@/services/topicSentences';

/**
 * Generate practice sentences for one topic.
 *
 * A mutation rather than a query: it fires when the user taps a topic, costs an
 * API call every time, and the result is deliberately not cached — tapping the
 * same topic again should hand back a fresh set.
 */
export function useTopicSentences() {
  return useMutation<TopicSentence[], Error, string>({
    mutationFn: (topic: string) => generateTopicSentences(topic),
  });
}
