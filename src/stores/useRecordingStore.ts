import { create } from 'zustand';

interface RecordingState {
  isRecording: boolean;
  audioUri: string | null;
  duration: number; // seconds

  startRecording: () => void;
  stopRecording: (audioUri: string, duration: number) => void;
  resetRecording: () => void;
}

export const useRecordingStore = create<RecordingState>((set) => ({
  isRecording: false,
  audioUri: null,
  duration: 0,

  startRecording: () => set({ isRecording: true, audioUri: null, duration: 0 }),

  stopRecording: (audioUri, duration) =>
    set({
      isRecording: false,
      audioUri,
      duration,
    }),

  resetRecording: () =>
    set({
      isRecording: false,
      audioUri: null,
      duration: 0,
    }),
}));
