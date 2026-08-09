import { create } from 'zustand';

interface InputState {
  inputMethod: 'voice' | 'text';
  koreanText: string;
  englishText: string;
  isSubmitting: boolean;
  dailySentenceId: number | null; // If translating a daily sentence

  setInputMethod: (method: 'voice' | 'text') => void;
  setKoreanText: (text: string) => void;
  setEnglishText: (text: string) => void;
  setDailySentenceId: (id: number | null) => void;
  setSubmitting: (value: boolean) => void;
  reset: () => void;
}

export const useInputStore = create<InputState>((set) => ({
  inputMethod: 'text',
  koreanText: '',
  englishText: '',
  isSubmitting: false,
  dailySentenceId: null,

  setInputMethod: (method) => set({ inputMethod: method }),
  setKoreanText: (text) => set({ koreanText: text }),
  setEnglishText: (text) => set({ englishText: text }),
  setDailySentenceId: (id) => set({ dailySentenceId: id }),
  setSubmitting: (value) => set({ isSubmitting: value }),

  reset: () =>
    set({
      inputMethod: 'text',
      koreanText: '',
      englishText: '',
      isSubmitting: false,
      dailySentenceId: null,
    }),
}));
