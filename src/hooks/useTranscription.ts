import { useMutation } from '@tanstack/react-query';

import { transcribe } from '@/services/whisper';
import { useInputStore } from '@/stores/useInputStore';

export function useTranscription() {
  const setEnglishText = useInputStore((s) => s.setEnglishText);

  return useMutation({
    mutationFn: (audioUri: string) => transcribe(audioUri),
    onSuccess: (transcribedText) => {
      // Auto-fill the English text field with the transcription
      setEnglishText(transcribedText);
    },
  });
}
