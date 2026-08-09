# Phase 2: State Management (Zustand + TanStack Query)

> **Goal**: Set up Zustand stores for local UI state and TanStack Query hooks for async data operations.
> **Estimated Effort**: 0.5 day
> **Depends On**: Phase 1 (database layer functional)
> **Verification**: Stores update correctly, queries fetch data from repositories, mutations trigger database writes.

---

## Step 2.1 — TanStack Query Provider

**`src/providers/QueryProvider.tsx`**

```typescript
import React, { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,  // 5 minutes
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
  },
});

export function QueryProvider({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

**`app/_layout.tsx`** — Add QueryProvider (wrap around or inside DatabaseProvider):

```typescript
<DatabaseProvider>
  <QueryProvider>
    {/* existing layout content */}
  </QueryProvider>
</DatabaseProvider>
```

---

## Step 2.2 — Zustand Stores

### Recording Store

**`src/stores/useRecordingStore.ts`**

Manages voice recording UI state (not the actual audio API — that's in the component).

```typescript
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
  
  stopRecording: (audioUri, duration) => set({
    isRecording: false,
    audioUri,
    duration,
  }),
  
  resetRecording: () => set({
    isRecording: false,
    audioUri: null,
    duration: 0,
  }),
}));
```

### Input Store

**`src/stores/useInputStore.ts`**

Manages the current input session state.

```typescript
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
  
  reset: () => set({
    inputMethod: 'text',
    koreanText: '',
    englishText: '',
    isSubmitting: false,
    dailySentenceId: null,
  }),
}));
```

### Settings Store

**`src/stores/useSettingsStore.ts`**

Manages app settings with `expo-secure-store` persistence for API keys.

```typescript
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface SettingsState {
  openaiApiKey: string | null;
  geminiApiKey: string | null;
  preferredInputMethod: 'voice' | 'text';
  isLoaded: boolean;

  loadSettings: () => Promise<void>;
  setApiKey: (service: 'openai' | 'gemini', key: string) => Promise<void>;
  setPreferredInputMethod: (method: 'voice' | 'text') => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  openaiApiKey: null,
  geminiApiKey: null,
  preferredInputMethod: 'text',
  isLoaded: false,

  loadSettings: async () => {
    const openaiKey = await SecureStore.getItemAsync('openai_api_key');
    const geminiKey = await SecureStore.getItemAsync('gemini_api_key');
    const inputMethod = await SecureStore.getItemAsync('preferred_input_method');

    set({
      openaiApiKey: openaiKey || process.env.EXPO_PUBLIC_OPENAI_API_KEY || null,
      geminiApiKey: geminiKey || process.env.EXPO_PUBLIC_GEMINI_API_KEY || null,
      preferredInputMethod: (inputMethod as 'voice' | 'text') || 'text',
      isLoaded: true,
    });
  },

  setApiKey: async (service, key) => {
    const storeKey = service === 'openai' ? 'openai_api_key' : 'gemini_api_key';
    await SecureStore.setItemAsync(storeKey, key);
    
    if (service === 'openai') {
      set({ openaiApiKey: key });
    } else {
      set({ geminiApiKey: key });
    }
  },

  setPreferredInputMethod: (method) => {
    SecureStore.setItemAsync('preferred_input_method', method);
    set({ preferredInputMethod: method });
  },
}));
```

---

## Step 2.3 — TanStack Query Hooks

### useTranscription (Mutation)

**`src/hooks/useTranscription.ts`**

```typescript
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
```

### useEvaluation (Mutation)

**`src/hooks/useEvaluation.ts`**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { evaluate } from '@/services/gemini';
import { evaluationRepository } from '@/db/repositories/evaluationRepository';
import { reviewRepository } from '@/db/repositories/reviewRepository';
import { useInputStore } from '@/stores/useInputStore';

interface EvaluationInput {
  koreanText: string;
  englishText: string;
  inputMethod: 'voice' | 'text';
  audioUri?: string;
  dailySentenceId?: number;
}

export function useEvaluation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: EvaluationInput) => {
      // 1. Call Gemini API
      const response = await evaluate({
        koreanText: input.koreanText,
        englishText: input.englishText,
      });

      // 2. Save to local database
      const evaluationId = await evaluationRepository.saveComplete({
        koreanText: input.koreanText,
        englishInput: input.englishText,
        inputMethod: input.inputMethod,
        audioUri: input.audioUri,
        dailySentenceId: input.dailySentenceId,
        naturalnessScore: response.evaluation.naturalness_score,
        grammarScore: response.evaluation.grammar_score,
        meaningClarityScore: response.evaluation.meaning_clarity_score,
        feedback: response.evaluation.feedback,
        rawJson: JSON.stringify(response),
        recommendations: response.recommendations.map((rec) => ({
          sentence: rec.sentence,
          contextAndNuance: rec.context_and_nuance,
          grammarExplanation: rec.grammar_explanation,
        })),
      });

      // 3. Create a review card from the best recommendation
      if (response.recommendations.length > 0) {
        await reviewRepository.create({
          evaluationId,
          koreanText: input.koreanText,
          bestEnglish: response.recommendations[0].sentence,
        });
      }

      return { evaluationId, response };
    },

    onSuccess: () => {
      // Invalidate related queries so they refetch
      queryClient.invalidateQueries({ queryKey: ['dailySentences'] });
      queryClient.invalidateQueries({ queryKey: ['recentEvaluations'] });
      queryClient.invalidateQueries({ queryKey: ['reviewCards'] });
    },
  });
}
```

### useDailySentences (Query)

**`src/hooks/useDailySentences.ts`**

```typescript
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
```

### useReviewCards (Query)

**`src/hooks/useReviewCards.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { reviewRepository } from '@/db/repositories/reviewRepository';

export function useReviewCards() {
  return useQuery({
    queryKey: ['reviewCards', 'due'],
    queryFn: () => reviewRepository.getDueCards(),
  });
}
```

### useRecentEvaluations (Query)

**`src/hooks/useRecentEvaluations.ts`**

```typescript
import { useQuery } from '@tanstack/react-query';
import { evaluationRepository } from '@/db/repositories/evaluationRepository';

export function useRecentEvaluations(limit: number = 10) {
  return useQuery({
    queryKey: ['recentEvaluations', limit],
    queryFn: () => evaluationRepository.getRecent(limit),
  });
}
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  UI Components                   │
│  (screens, buttons, inputs, cards)               │
└──────────┬──────────────────┬────────────────────┘
           │                  │
    ┌──────▼──────┐   ┌──────▼──────┐
    │   Zustand   │   │  TanStack   │
    │   Stores    │   │   Query     │
    │             │   │   Hooks     │
    │ • Recording │   │             │
    │ • Input     │   │ • useDaily  │
    │ • Settings  │   │ • useEval   │
    │             │   │ • useSTT    │
    │  (UI state) │   │ • useReview │
    └─────────────┘   └──────┬──────┘
                             │
                    ┌────────▼────────┐
                    │    Services     │
                    │  (API calls)    │
                    │ • whisper.ts    │
                    │ • gemini.ts     │
                    │ • dailySent.ts  │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  Repositories   │
                    │  (data access)  │
                    │ • sentence      │
                    │ • evaluation    │
                    │ • review        │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   expo-sqlite   │
                    │   + Drizzle     │
                    └─────────────────┘
```

---

## Verification Checklist

- [ ] `QueryProvider` wraps the app without errors
- [ ] `useSettingsStore.loadSettings()` loads API keys from env vars / SecureStore
- [ ] `useRecordingStore` state transitions work: idle → recording → stopped → reset
- [ ] `useInputStore` correctly manages text and method toggling
- [ ] `useDailySentences` hook returns data (mock service for now if Gemini not yet connected)
- [ ] Mutations complete without crashing (can test with mock data)

---

## Next Phase

Once all checks pass → proceed to **[Phase 3: Input & STT Interface](./PHASE_3_INPUT_STT.md)**
