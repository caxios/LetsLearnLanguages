import { create } from 'zustand';

/** Where the Korean sentence came from — decides which evaluation quota it spends. */
export type InputSource = 'daily' | 'topic' | 'free';

interface InputState {
  inputMethod: 'voice' | 'text';
  source: InputSource;
  koreanText: string;
  englishText: string;
  isSubmitting: boolean;
  dailySentenceId: number | null; // If translating a daily sentence

  setInputMethod: (method: 'voice' | 'text') => void;
  setSource: (source: InputSource) => void;
  setKoreanText: (text: string) => void;
  setEnglishText: (text: string) => void;
  setDailySentenceId: (id: number | null) => void;
  setSubmitting: (value: boolean) => void;
  reset: () => void;
}

export const useInputStore = create<InputState>((set) => ({
  inputMethod: 'text',
  source: 'free',
  koreanText: '',
  englishText: '',
  isSubmitting: false,
  dailySentenceId: null,

  setInputMethod: (method) => set({ inputMethod: method }),
  setSource: (source) => set({ source }),
  setKoreanText: (text) => set({ koreanText: text }),
  setEnglishText: (text) => set({ englishText: text }),
  setDailySentenceId: (id) => set({ dailySentenceId: id }),
  setSubmitting: (value) => set({ isSubmitting: value }),

  reset: () =>
    set({
      inputMethod: 'text',
      source: 'free',
      koreanText: '',
      englishText: '',
      isSubmitting: false,
      dailySentenceId: null,
    }),
}));
