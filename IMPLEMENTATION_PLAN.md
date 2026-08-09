# LetsLearnLanguages — Implementation Plan

> **AI-Powered 1:1 English Tutor App**
> Built with Expo (React Native) · TypeScript · Gemini API · OpenAI Whisper · Drizzle ORM

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack & Dependencies](#2-tech-stack--dependencies)
3. [Project Structure](#3-project-structure)
4. [Phase 0: Project Initialization & Configuration](#4-phase-0-project-initialization--configuration)
5. [Phase 1: Database Layer (expo-sqlite + Drizzle ORM)](#5-phase-1-database-layer)
6. [Phase 2: State Management (Zustand + TanStack Query)](#6-phase-2-state-management)
7. [Phase 3: Input & STT Interface](#7-phase-3-input--stt-interface)
8. [Phase 4: AI Evaluation & Coaching Engine](#8-phase-4-ai-evaluation--coaching-engine)
9. [Phase 5: UI/UX Implementation](#9-phase-5-uiux-implementation)
10. [Phase 6: Active Recall Review System (Future)](#10-phase-6-active-recall-review-system-future)
11. [API Schemas & Contracts](#11-api-schemas--contracts)
12. [Environment Variables](#12-environment-variables)
13. [Testing Strategy](#13-testing-strategy)
14. [Deployment Considerations](#14-deployment-considerations)

---

## 1. Project Overview

### Goal
Build an AI-powered English learning mobile application that acts as a **1:1 personalized native tutor**. The app helps Korean-speaking users practice translating Korean sentences into natural English, receive AI-based evaluations, and review past learnings through an active-recall system.

### Core User Flow
```
[User sees daily Korean sentences or enters their own]
        ↓
[User inputs English translation via Voice (STT) or Text]
        ↓
[App sends input to Gemini API for evaluation]
        ↓
[AI returns structured JSON: scores + feedback + recommendations]
        ↓
[Results are displayed and saved to local SQLite database]
        ↓
[User reviews past entries via Active Recall system]
```

---

## 2. Tech Stack & Dependencies

### Core Framework
| Technology | Package | Purpose |
|---|---|---|
| Expo SDK 53+ | `expo` | React Native framework |
| TypeScript | `typescript` | Type safety |
| Expo Router | `expo-router` | File-based navigation |

### AI & Speech
| Technology | Package | Purpose |
|---|---|---|
| OpenAI Whisper API | `openai` (REST) | Speech-to-Text transcription |
| Google Gemini API | `@google/generative-ai` | AI evaluation & coaching |
| Audio Recording | `expo-audio` | Record user voice input |

### Data Layer
| Technology | Package | Purpose |
|---|---|---|
| SQLite | `expo-sqlite` | Local persistent database |
| Drizzle ORM | `drizzle-orm`, `drizzle-kit` | Type-safe ORM for SQLite |

### State Management
| Technology | Package | Purpose |
|---|---|---|
| Zustand | `zustand` | Lightweight global state |
| TanStack Query | `@tanstack/react-query` | Server state, caching, mutations |

### Styling
| Technology | Package | Purpose |
|---|---|---|
| NativeWind v4 | `nativewind`, `tailwindcss` | Tailwind CSS for React Native |

### Utility Libraries
| Technology | Package | Purpose |
|---|---|---|
| Zod | `zod` | Runtime schema validation for API responses |
| date-fns | `date-fns` | Date manipulation for daily sentences |
| expo-secure-store | `expo-secure-store` | Secure storage for API keys |
| expo-haptics | `expo-haptics` | Haptic feedback for interactions |

---

## 3. Project Structure

```
LetsLearnLanguages/
├── app/                          # Expo Router — file-based routing
│   ├── _layout.tsx               # Root layout (providers, fonts, splash)
│   ├── (tabs)/                   # Tab-based navigation
│   │   ├── _layout.tsx           # Tab navigator config
│   │   ├── index.tsx             # Home / Daily Sentences screen
│   │   ├── free-input.tsx        # Free Input screen
│   │   └── review.tsx            # Active Recall Review screen
│   ├── result/
│   │   └── [id].tsx              # Evaluation Result detail screen
│   └── settings.tsx              # Settings screen (API keys, preferences)
│
├── src/
│   ├── components/               # Reusable UI components
│   │   ├── ui/                   # Base UI primitives
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── ProgressBar.tsx
│   │   │   └── ScoreCircle.tsx
│   │   ├── input/                # Input-related components
│   │   │   ├── VoiceRecorder.tsx
│   │   │   ├── TextInputField.tsx
│   │   │   └── InputMethodToggle.tsx
│   │   ├── evaluation/           # Evaluation display components
│   │   │   ├── ScoreCard.tsx
│   │   │   ├── FeedbackPanel.tsx
│   │   │   └── RecommendationList.tsx
│   │   └── daily/                # Daily sentences components
│   │       ├── SentenceCard.tsx
│   │       └── DailySentenceList.tsx
│   │
│   ├── db/                       # Database layer
│   │   ├── client.ts             # expo-sqlite connection setup
│   │   ├── schema.ts             # Drizzle ORM table definitions
│   │   ├── migrations/           # Generated migration files
│   │   └── repositories/         # Data access layer
│   │       ├── sentenceRepository.ts
│   │       ├── evaluationRepository.ts
│   │       └── reviewRepository.ts
│   │
│   ├── services/                 # External API integrations
│   │   ├── whisper.ts            # OpenAI Whisper STT service
│   │   ├── gemini.ts             # Gemini API evaluation service
│   │   └── dailySentences.ts     # Daily sentence generation service
│   │
│   ├── stores/                   # Zustand stores
│   │   ├── useRecordingStore.ts  # Recording state (isRecording, audioUri)
│   │   ├── useInputStore.ts      # Input mode state (voice/text, current text)
│   │   └── useSettingsStore.ts   # App settings state
│   │
│   ├── hooks/                    # Custom React hooks (TanStack Query wrappers)
│   │   ├── useEvaluation.ts      # Mutation: submit input → get evaluation
│   │   ├── useTranscription.ts   # Mutation: audio → text via Whisper
│   │   ├── useDailySentences.ts  # Query: fetch today's sentences
│   │   └── useReviewCards.ts     # Query: fetch review cards
│   │
│   ├── types/                    # TypeScript type definitions
│   │   ├── evaluation.ts         # Evaluation response types
│   │   ├── sentence.ts           # Sentence types
│   │   └── review.ts             # Review system types
│   │
│   ├── utils/                    # Utility functions
│   │   ├── audioHelpers.ts       # Audio file handling utilities
│   │   ├── dateHelpers.ts        # Date formatting/comparison
│   │   └── scoreHelpers.ts       # Score calculation utilities
│   │
│   ├── constants/                # App constants
│   │   ├── colors.ts             # Color palette
│   │   ├── fonts.ts              # Font configuration
│   │   └── prompts.ts            # Gemini system prompts
│   │
│   └── providers/                # React context providers
│       ├── DatabaseProvider.tsx   # Database initialization provider
│       └── QueryProvider.tsx      # TanStack Query provider
│
├── assets/                       # Static assets (icons, images, fonts)
├── drizzle.config.ts             # Drizzle Kit configuration
├── tailwind.config.js            # NativeWind/Tailwind configuration
├── app.json                      # Expo configuration
├── tsconfig.json                 # TypeScript configuration
├── .env                          # Environment variables (gitignored)
└── package.json
```

---

## 4. Phase 0: Project Initialization & Configuration

### Step 0.1 — Create Expo Project
```bash
npx -y create-expo-app@latest LetsLearnLanguages --template tabs
cd LetsLearnLanguages
```

### Step 0.2 — Install Core Dependencies
```bash
# Navigation (included with tabs template, verify)
npx expo install expo-router expo-linking expo-constants

# AI & Speech
npx expo install expo-audio
npm install @google/generative-ai

# Database
npx expo install expo-sqlite
npm install drizzle-orm
npm install -D drizzle-kit

# State Management
npm install zustand @tanstack/react-query

# Styling
npm install nativewind tailwindcss

# Utilities
npm install zod date-fns
npx expo install expo-secure-store expo-haptics expo-file-system
```

### Step 0.3 — Configure TypeScript Path Aliases
**`tsconfig.json`**
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@/components/*": ["src/components/*"],
      "@/db/*": ["src/db/*"],
      "@/services/*": ["src/services/*"],
      "@/stores/*": ["src/stores/*"],
      "@/hooks/*": ["src/hooks/*"],
      "@/types/*": ["src/types/*"],
      "@/utils/*": ["src/utils/*"],
      "@/constants/*": ["src/constants/*"]
    }
  }
}
```

### Step 0.4 — Configure NativeWind
**`tailwind.config.js`**
```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#EEF2FF',
          100: '#E0E7FF',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
        },
        surface: {
          DEFAULT: '#1E1E2E',
          light: '#2A2A3E',
          dark: '#16161F',
        },
        accent: '#F59E0B',
      },
    },
  },
  plugins: [],
};
```

### Step 0.5 — Configure Environment Variables
**`.env`**
```env
EXPO_PUBLIC_OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
EXPO_PUBLIC_GEMINI_API_KEY=AIzaxxxxxxxxxxxxxxxx
```

> **⚠️ CAUTION**: For production, API keys should be proxied through a backend server. Embedding keys in the client is acceptable for development/prototyping only.

---

## 5. Phase 1: Database Layer

### Step 1.1 — Database Client Setup
**`src/db/client.ts`**
```typescript
import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

const expoDb = openDatabaseSync('letslearnlanguages.db');
export const db = drizzle(expoDb, { schema });
```

### Step 1.2 — Schema Definition
**`src/db/schema.ts`**

#### `daily_sentences` Table
Stores the daily Korean sentences provided to the user.

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER (PK, auto) | Primary key |
| `korean_text` | TEXT | The Korean sentence |
| `date_assigned` | TEXT | The date this sentence was assigned (YYYY-MM-DD) |
| `is_completed` | INTEGER (boolean) | Whether the user has attempted this sentence |
| `created_at` | TEXT | Timestamp of creation |

#### `user_inputs` Table
Stores every input the user submits (voice or text).

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER (PK, auto) | Primary key |
| `korean_text` | TEXT | The original Korean sentence |
| `english_input` | TEXT | The user's English translation |
| `input_method` | TEXT | 'voice' or 'text' |
| `audio_uri` | TEXT (nullable) | Path to recorded audio file |
| `daily_sentence_id` | INTEGER (FK, nullable) | Link to daily_sentences if applicable |
| `created_at` | TEXT | Timestamp |

#### `evaluations` Table
Stores the AI evaluation results.

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER (PK, auto) | Primary key |
| `user_input_id` | INTEGER (FK) | Link to user_inputs |
| `naturalness_score` | INTEGER | 0–100 |
| `grammar_score` | INTEGER | 0–100 |
| `meaning_clarity_score` | INTEGER | 0–100 |
| `overall_score` | INTEGER | Weighted average |
| `feedback` | TEXT | AI's overall feedback (in Korean) |
| `raw_json` | TEXT | Full raw JSON response from Gemini |
| `created_at` | TEXT | Timestamp |

#### `recommendations` Table
Stores individual recommended sentences from the AI.

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER (PK, auto) | Primary key |
| `evaluation_id` | INTEGER (FK) | Link to evaluations |
| `sentence` | TEXT | Recommended English sentence |
| `context_and_nuance` | TEXT | Context/nuance explanation (in Korean) |
| `grammar_explanation` | TEXT | Grammar explanation (in Korean) |

#### `review_cards` Table (for Active Recall system)
Stores spaced-repetition review data.

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER (PK, auto) | Primary key |
| `evaluation_id` | INTEGER (FK) | Link to evaluations |
| `korean_text` | TEXT | The Korean sentence (question side) |
| `best_english` | TEXT | Best recommended English (answer side) |
| `ease_factor` | REAL | SM-2 algorithm ease factor (default: 2.5) |
| `interval_days` | INTEGER | Days until next review |
| `repetitions` | INTEGER | Number of successful reviews |
| `next_review_date` | TEXT | Date of next scheduled review |
| `created_at` | TEXT | Timestamp |

### Step 1.3 — Repository Pattern
Each repository file provides a clean data access interface:

**`src/db/repositories/sentenceRepository.ts`**
- `getDailySentences(date: string): Promise<DailySentence[]>` — Get sentences for a given date
- `createDailySentences(sentences: NewDailySentence[]): Promise<void>` — Insert new daily sentences
- `markAsCompleted(id: number): Promise<void>` — Mark a sentence as completed

**`src/db/repositories/evaluationRepository.ts`**
- `saveEvaluation(input: UserInput, evaluation: GeminiResponse): Promise<number>` — Save full evaluation result, returns evaluation ID
- `getEvaluationById(id: number): Promise<EvaluationWithRecommendations>` — Get evaluation with all recommendations
- `getRecentEvaluations(limit: number): Promise<Evaluation[]>` — Get recent evaluations for history

**`src/db/repositories/reviewRepository.ts`**
- `getDueReviewCards(): Promise<ReviewCard[]>` — Get cards due for review today
- `createReviewCard(evaluationId: number): Promise<void>` — Create a new review card
- `updateReviewCard(id: number, quality: number): Promise<void>` — Update card using SM-2 algorithm

### Step 1.4 — Database Migration Strategy
Use Drizzle Kit to generate and manage migrations:
```bash
npx drizzle-kit generate
```

Apply migrations at app startup inside `DatabaseProvider.tsx`:
```typescript
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import migrations from './migrations/migrations';

// Inside provider component:
const { success, error } = useMigrations(db, migrations);
```

---

## 6. Phase 2: State Management

### Step 2.1 — Zustand Stores

#### `useRecordingStore.ts`
```typescript
interface RecordingState {
  isRecording: boolean;
  audioUri: string | null;
  duration: number;
  // Actions
  startRecording: () => void;
  stopRecording: () => void;
  resetRecording: () => void;
}
```

#### `useInputStore.ts`
```typescript
interface InputState {
  inputMethod: 'voice' | 'text';
  koreanText: string;         // The Korean sentence being translated
  englishText: string;         // User's English translation
  isSubmitting: boolean;
  // Actions
  setInputMethod: (method: 'voice' | 'text') => void;
  setKoreanText: (text: string) => void;
  setEnglishText: (text: string) => void;
  reset: () => void;
}
```

#### `useSettingsStore.ts`
```typescript
interface SettingsState {
  openaiApiKey: string | null;
  geminiApiKey: string | null;
  preferredInputMethod: 'voice' | 'text';
  // Actions
  setApiKey: (service: 'openai' | 'gemini', key: string) => void;
  loadApiKeys: () => Promise<void>;
}
```
> API keys are persisted via `expo-secure-store` and loaded into Zustand on app launch.

### Step 2.2 — TanStack Query Hooks

#### `useTranscription.ts` (Mutation)
```typescript
// Sends audio file to OpenAI Whisper API
// Input: audioUri (string)
// Output: transcribed text (string)
useMutation({
  mutationFn: (audioUri: string) => whisperService.transcribe(audioUri),
});
```

#### `useEvaluation.ts` (Mutation)
```typescript
// Sends Korean + English text to Gemini API for evaluation
// Input: { koreanText: string, englishText: string }
// Output: validated EvaluationResponse
useMutation({
  mutationFn: (input) => geminiService.evaluate(input),
  onSuccess: (data) => {
    // Save to local database
    // Create review card
  },
});
```

#### `useDailySentences.ts` (Query)
```typescript
// Fetches today's daily sentences from local DB
// If none exist for today, generates new ones via Gemini
useQuery({
  queryKey: ['dailySentences', todayString],
  queryFn: () => dailySentenceService.getOrCreateForToday(),
  staleTime: Infinity, // Sentences don't change within the day
});
```

#### `useReviewCards.ts` (Query)
```typescript
// Fetches review cards due today
useQuery({
  queryKey: ['reviewCards', 'due'],
  queryFn: () => reviewRepository.getDueReviewCards(),
});
```

---

## 7. Phase 3: Input & STT Interface

### Step 3.1 — Audio Recording with `expo-audio`

**`src/components/input/VoiceRecorder.tsx`**

Implementation details:
1. Request microphone permissions using `Audio.requestPermissionsAsync()`
2. Configure recording with high-quality preset:
   ```typescript
   const recording = new Audio.Recording();
   await recording.prepareToRecordAsync(
     Audio.RecordingOptionsPresets.HIGH_QUALITY
   );
   ```
3. Provide visual feedback during recording:
   - Animated pulsing microphone icon
   - Elapsed time counter
   - Waveform visualization (optional, use `onRecordingStatusUpdate`)
4. On stop, save the audio URI to `useRecordingStore`

### Step 3.2 — Whisper STT Service

**`src/services/whisper.ts`**

```typescript
export async function transcribe(audioUri: string): Promise<string> {
  const formData = new FormData();
  
  // Read audio file and append to FormData
  formData.append('file', {
    uri: audioUri,
    type: 'audio/m4a',     // expo-audio default format
    name: 'recording.m4a',
  } as any);
  formData.append('model', 'whisper-1');
  formData.append('language', 'en');      // Expect English input
  formData.append('response_format', 'json');
  
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });
  
  const result = await response.json();
  return result.text;
}
```

### Step 3.3 — Text Input Field

**`src/components/input/TextInputField.tsx`**

- Multi-line `TextInput` component
- Character count display
- Clear button
- Placeholder: "Type your English translation here..."
- Auto-focus when text input mode is selected

### Step 3.4 — Input Method Toggle

**`src/components/input/InputMethodToggle.tsx`**

- Toggle switch between Voice and Text input modes
- Animated transition between the two modes
- Persists user preference via `useSettingsStore`

---

## 8. Phase 4: AI Evaluation & Coaching Engine

### Step 4.1 — Gemini Service

**`src/services/gemini.ts`**

#### System Prompt Design
```typescript
const SYSTEM_PROMPT = `
You are an expert English language tutor specializing in teaching Korean speakers.
You evaluate English translations of Korean sentences based on three criteria:
1. Naturalness: How natural the English sounds to a native speaker
2. Grammar: Grammatical correctness
3. Meaning Clarity: How clearly the meaning is conveyed

IMPORTANT RULES:
- All feedback and explanations MUST be written in Korean (한국어).
- Provide 2-3 recommended alternative sentences.
- Each recommendation must include context/nuance and grammar explanations.
- Be encouraging but honest in feedback.
- Focus on real-life, conversational English usage.
`;
```

#### Structured JSON Output (Gemini's Native Feature)
Use Gemini's `responseMimeType: "application/json"` and `responseSchema` to enforce structured output:

```typescript
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const evaluationSchema = {
  type: SchemaType.OBJECT,
  properties: {
    evaluation: {
      type: SchemaType.OBJECT,
      properties: {
        naturalness_score: { type: SchemaType.INTEGER },
        grammar_score: { type: SchemaType.INTEGER },
        meaning_clarity_score: { type: SchemaType.INTEGER },
        feedback: { type: SchemaType.STRING },
      },
      required: ['naturalness_score', 'grammar_score', 'meaning_clarity_score', 'feedback'],
    },
    recommendations: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          sentence: { type: SchemaType.STRING },
          context_and_nuance: { type: SchemaType.STRING },
          grammar_explanation: { type: SchemaType.STRING },
        },
        required: ['sentence', 'context_and_nuance', 'grammar_explanation'],
      },
    },
  },
  required: ['evaluation', 'recommendations'],
};

const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema: evaluationSchema,
  },
  systemInstruction: SYSTEM_PROMPT,
});
```

#### Evaluation Function
```typescript
export async function evaluate(input: {
  koreanText: string;
  englishText: string;
}): Promise<EvaluationResponse> {
  const prompt = `
Korean sentence: "${input.koreanText}"
User's English translation: "${input.englishText}"

Evaluate this translation and provide recommendations.
  `;

  const result = await model.generateContent(prompt);
  const jsonResponse = JSON.parse(result.response.text());
  
  // Validate with Zod schema
  return evaluationResponseSchema.parse(jsonResponse);
}
```

### Step 4.2 — Zod Validation Schema

**`src/types/evaluation.ts`**

```typescript
import { z } from 'zod';

export const recommendationSchema = z.object({
  sentence: z.string(),
  context_and_nuance: z.string(),
  grammar_explanation: z.string(),
});

export const evaluationResponseSchema = z.object({
  evaluation: z.object({
    naturalness_score: z.number().min(0).max(100),
    grammar_score: z.number().min(0).max(100),
    meaning_clarity_score: z.number().min(0).max(100),
    feedback: z.string(),
  }),
  recommendations: z.array(recommendationSchema).min(1).max(5),
});

export type EvaluationResponse = z.infer<typeof evaluationResponseSchema>;
export type Recommendation = z.infer<typeof recommendationSchema>;
```

### Step 4.3 — Daily Sentence Generation

**`src/services/dailySentences.ts`**

Use Gemini to generate 3 random Korean sentences daily:

```typescript
const DAILY_SENTENCE_PROMPT = `
Generate 3 natural Korean sentences that a Korean speaker might want to say in English
in daily life. The sentences should:
- Be conversational and practical
- Cover different difficulty levels (easy, medium, hard)
- Cover different contexts (work, social, daily life)
- NOT be textbook-style sentences

Return as JSON array of objects with "korean_text" and "difficulty" fields.
`;
```

The service checks the local database first. If no sentences exist for today, it calls Gemini to generate new ones and saves them locally.

---

## 9. Phase 5: UI/UX Implementation

### Step 5.1 — Navigation Structure (Expo Router)

```
(tabs)/
├── index.tsx        → Home (Daily Sentences)
├── free-input.tsx   → Free Input Mode
└── review.tsx       → Active Recall Review
```

### Step 5.2 — Screen Breakdown

#### Home Screen (`(tabs)/index.tsx`)
- **Header**: Date display, streak counter
- **Daily Sentences Section**: 3 cards showing Korean sentences
  - Each card shows: Korean text, difficulty badge, completion status
  - Tap a card → Navigate to input screen with the Korean sentence pre-filled
- **Recent Activity**: Quick summary of recent evaluations
- **Stats Bar**: Today's scores, total sentences practiced

#### Free Input Screen (`(tabs)/free-input.tsx`)
- **Korean Input**: TextInput for user to type any Korean sentence
- **English Input Area**: Toggle between Voice and Text input
  - Voice mode: Large microphone button with recording animation
  - Text mode: Multi-line text input
- **Submit Button**: Sends to Gemini for evaluation
- **Loading State**: Animated skeleton while waiting for AI response

#### Result Screen (`result/[id].tsx`)
- **Score Overview**: Three circular progress indicators for each score
  - Color-coded: Green (80+), Yellow (50-79), Red (0-49)
- **Overall Feedback**: AI's feedback text in Korean
- **Recommendations Section**: Expandable cards for each recommendation
  - English sentence (large, bold)
  - Context & nuance explanation (collapsible)
  - Grammar explanation (collapsible)
- **Action Buttons**: "Try Again", "Save to Review", "Share"

#### Review Screen (`(tabs)/review.tsx`)
- **Flashcard Interface**: Swipeable cards
  - Front: Korean sentence
  - Back: Best English translation + context
- **Self-Assessment**: Rate difficulty (1-5) after each card
- **Progress Indicators**: Cards remaining, today's review count
- **Empty State**: Encouraging message when all reviews are complete

### Step 5.3 — Design System

#### Color Palette (Dark Mode Primary)
```
Background:     #0F0F1A (deep dark)
Surface:        #1A1A2E (card background)
Surface Light:  #25253B (elevated surface)
Primary:        #6C63FF (indigo/purple)
Primary Light:  #8B83FF
Secondary:      #00D4AA (teal/mint)
Accent:         #FF6B6B (coral red for low scores)
Warning:        #FFB347 (amber for medium scores)
Success:        #4ADE80 (green for high scores)
Text Primary:   #FFFFFF
Text Secondary: #9CA3AF
Text Muted:     #6B7280
```

#### Typography
- Headings: `Pretendard` or `Inter` (Bold, Semi-Bold)
- Body: `Inter` (Regular, Medium)
- Monospace: `JetBrains Mono` (for scores/numbers)

#### Component Design Guidelines
- **Cards**: Rounded corners (16px), subtle border (1px, rgba white 5%), glass-morphism effect
- **Buttons**: Rounded (12px), gradient backgrounds for primary actions
- **Animations**: React Native Reanimated for micro-interactions
  - Score counting up animation
  - Card flip animation for reviews
  - Recording pulse animation
  - Slide-in transitions for result recommendations

---

## 10. Phase 6: Active Recall Review System (Future)

### SM-2 Spaced Repetition Algorithm

The review system uses a modified SM-2 algorithm:

```typescript
function calculateNextReview(
  quality: number,  // User's self-assessment: 0-5
  repetitions: number,
  easeFactor: number,
  interval: number
): { repetitions: number; easeFactor: number; interval: number } {
  
  if (quality < 3) {
    // Reset on failure
    return { repetitions: 0, easeFactor, interval: 1 };
  }

  let newInterval: number;
  if (repetitions === 0) newInterval = 1;
  else if (repetitions === 1) newInterval = 6;
  else newInterval = Math.round(interval * easeFactor);

  const newEaseFactor = Math.max(
    1.3,
    easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  );

  return {
    repetitions: repetitions + 1,
    easeFactor: newEaseFactor,
    interval: newInterval,
  };
}
```

### Review Flow
1. App shows review cards due today (based on `next_review_date`)
2. User sees Korean sentence → thinks of English translation
3. User reveals the answer (best English recommendation)
4. User self-assesses: "Again" (0) | "Hard" (3) | "Good" (4) | "Easy" (5)
5. SM-2 calculates the next review date
6. Card is updated in the database

---

## 11. API Schemas & Contracts

### OpenAI Whisper API

**Endpoint**: `POST https://api.openai.com/v1/audio/transcriptions`

| Parameter | Value |
|---|---|
| `model` | `whisper-1` |
| `file` | Audio file (m4a, wav, mp3, etc.) |
| `language` | `en` |
| `response_format` | `json` |

**Response**:
```json
{
  "text": "Transcribed English text here"
}
```

### Gemini API — Evaluation

**Model**: `gemini-2.0-flash`

**Request Config**:
```json
{
  "responseMimeType": "application/json",
  "responseSchema": "...see Step 4.1..."
}
```

**Expected Response**:
```json
{
  "evaluation": {
    "naturalness_score": 85,
    "grammar_score": 90,
    "meaning_clarity_score": 78,
    "feedback": "전반적으로 좋은 번역입니다. 다만 일상 대화에서는 좀 더 자연스러운 표현이 있습니다..."
  },
  "recommendations": [
    {
      "sentence": "I'm on my way to work right now.",
      "context_and_nuance": "출근 중이라는 것을 간단하고 자연스럽게 표현할 때 사용합니다. 'on my way'는 이동 중임을 나타내는 매우 일반적인 표현입니다.",
      "grammar_explanation": "'be on one's way'는 '~로 향하는 중이다'라는 의미의 관용구입니다. 현재진행형 'I'm'과 함께 사용하여 지금 이 순간 이동 중임을 나타냅니다."
    }
  ]
}
```

### Gemini API — Daily Sentence Generation

**Expected Response**:
```json
[
  {
    "korean_text": "오늘 회의 몇 시에 시작해?",
    "difficulty": "easy"
  },
  {
    "korean_text": "그 사람이 무슨 의도로 그런 말을 했는지 모르겠어.",
    "difficulty": "medium"
  },
  {
    "korean_text": "이 프로젝트는 예산 대비 효율성이 좀 떨어지는 것 같아.",
    "difficulty": "hard"
  }
]
```

---

## 12. Environment Variables

| Variable | Description | Required |
|---|---|---|
| `EXPO_PUBLIC_OPENAI_API_KEY` | OpenAI API key for Whisper STT | Yes |
| `EXPO_PUBLIC_GEMINI_API_KEY` | Google Gemini API key | Yes |

> **⚠️ IMPORTANT**: These are prefixed with `EXPO_PUBLIC_` to be accessible in the client bundle.
> For production, implement a backend proxy to keep keys secure.

---

## 13. Testing Strategy

### Unit Tests
| Target | Framework | What to Test |
|---|---|---|
| Zod schemas | Jest | Validate correct and malformed API responses |
| SM-2 algorithm | Jest | Various quality inputs, edge cases |
| Utility functions | Jest | Date helpers, score calculations |
| Repository methods | Jest + expo-sqlite mock | CRUD operations |

### Integration Tests
| Target | Framework | What to Test |
|---|---|---|
| Whisper service | Jest (mocked fetch) | FormData construction, error handling |
| Gemini service | Jest (mocked API) | Prompt construction, schema validation |
| TanStack Query hooks | React Testing Library | Loading/success/error states |

### E2E Tests
| Target | Framework | What to Test |
|---|---|---|
| Full user flow | Detox or Maestro | Daily sentence → Input → Evaluation → Review |

---

## 14. Deployment Considerations

### Development
```bash
npx expo start          # Start Expo dev server
npx expo start --ios    # iOS simulator
npx expo start --android  # Android emulator
```

### Build (EAS Build)
```bash
npx eas-cli build --platform ios
npx eas-cli build --platform android
```

### Pre-Launch Checklist
- [ ] API key security (backend proxy)
- [ ] Error boundary implementation
- [ ] Offline mode handling (queue evaluations)
- [ ] App icon and splash screen
- [ ] Rate limiting for API calls
- [ ] Analytics integration (optional)
- [ ] Crash reporting (Sentry / Bugsnag)
- [ ] Accessibility audit (VoiceOver, TalkBack)

---

## Implementation Order (Recommended)

| Priority | Task | Estimated Effort |
|---|---|---|
| 1 | Phase 0: Project init + config | 0.5 day |
| 2 | Phase 1: Database schema + repositories | 1 day |
| 3 | Phase 2: Zustand stores + Query hooks | 0.5 day |
| 4 | Phase 5 (partial): Navigation + basic UI screens | 1 day |
| 5 | Phase 4: Gemini evaluation service | 1 day |
| 6 | Phase 3: Voice recording + Whisper STT | 1 day |
| 7 | Phase 4 (continued): Daily sentence generation | 0.5 day |
| 8 | Phase 5 (continued): Polish UI/UX, animations | 1.5 days |
| 9 | Phase 6: Active Recall review system | 1.5 days |
| 10 | Testing + Bug fixes | 1.5 days |

**Total Estimated: ~10 working days**

---

> **NOTE**: This plan is a living document. Update it as implementation progresses and new requirements emerge. Each phase should be committed separately with clear git commit messages.
