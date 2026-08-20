import { useCallback, useRef, useState } from 'react';

import { askFollowUpQuestion } from '@/services/gemini';
import type { ChatMessage, TutorChatContext } from '@/types/chat';

let messageCounter = 0;
const nextId = () => `m${++messageCounter}`;

/** Index of the last message matching, or -1. Hand-rolled: `findLastIndex` needs ES2023. */
function lastIndexOfFailed(messages: ChatMessage[]): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].failed) return index;
  }
  return -1;
}

/**
 * A follow-up conversation about one evaluation.
 *
 * The history is ephemeral: it lives as long as the screen holding this hook, so
 * closing and re-opening the sheet keeps the thread, and navigating away drops
 * it. Persisting it would mean a table and a retention story for text the user
 * has already read — worth doing only once people ask to come back to it.
 */
export function useTutorChat(context: TutorChatContext | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A different evaluation is a different conversation. The review deck reuses
  // one mounted sheet across cards, so this has to be watched rather than
  // inferred from mounting.
  //
  // Adjusted during render rather than in an effect: React's own recommendation
  // for state derived from a prop, and it avoids rendering the previous
  // evaluation's thread for a frame before an effect could clear it.
  const contextKey = context ? `${context.koreanText} ${context.englishInput}` : '';
  const [renderedContextKey, setRenderedContextKey] = useState(contextKey);
  if (contextKey !== renderedContextKey) {
    setRenderedContextKey(contextKey);
    setMessages([]);
    setError(null);
  }

  // Guards a double tap firing two requests before `isSending` has rendered.
  const inFlight = useRef(false);

  const ask = useCallback(
    async (question: string, history: ChatMessage[]) => {
      if (!context || inFlight.current) return;

      const trimmed = question.trim();
      if (!trimmed) return;

      const asked: ChatMessage = { id: nextId(), role: 'user', text: trimmed };

      inFlight.current = true;
      setMessages([...history, asked]);
      setError(null);
      setIsSending(true);

      try {
        const answer = await askFollowUpQuestion({ context, history, question: trimmed });
        setMessages((current) => [...current, { id: nextId(), role: 'model', text: answer }]);
      } catch (caught) {
        // The question stays on screen and gets marked rather than disappearing —
        // nobody should have to retype it to try again.
        setError(caught instanceof Error ? caught.message : '답변을 받지 못했어요.');
        setMessages((current) =>
          current.map((message) =>
            message.id === asked.id ? { ...message, failed: true } : message
          )
        );
      } finally {
        inFlight.current = false;
        setIsSending(false);
      }
    },
    [context]
  );

  const send = useCallback((question: string) => ask(question, messages), [ask, messages]);

  /** Re-send the last question that failed, from the history it originally saw. */
  const retry = useCallback(() => {
    const index = lastIndexOfFailed(messages);
    if (index === -1) return;

    void ask(messages[index].text, messages.slice(0, index));
  }, [ask, messages]);

  const reset = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isSending,
    error,
    canRetry: lastIndexOfFailed(messages) !== -1,
    send,
    retry,
    reset,
  };
}
