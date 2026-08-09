# Phase 4: AI Evaluation & Coaching Engine

> **Goal**: Integrate Google Gemini API to evaluate English translations, generate daily Korean sentences, and validate all API responses with Zod.
> **Estimated Effort**: 1.5 days (evaluation service 1 day + daily sentences 0.5 day)
> **Depends On**: Phase 2 (stores/hooks ready), Phase 1 (database for saving results)
> **Verification**: Gemini returns structured JSON that passes Zod validation. Evaluations are saved to the database. Daily sentences are generated and cached locally.

---

## Step 4.1 — Type Definitions & Zod Schemas

**`src/types/evaluation.ts`**

```typescript
import { z } from 'zod';

// --- Zod Schemas (runtime validation) ---

export const recommendationSchema = z.object({
  sentence: z.string().min(1),
  context_and_nuance: z.string().min(1),
  grammar_explanation: z.string().min(1),
});

export const evaluationResponseSchema = z.object({
  evaluation: z.object({
    naturalness_score: z.number().int().min(0).max(100),
    grammar_score: z.number().int().min(0).max(100),
    meaning_clarity_score: z.number().int().min(0).max(100),
    feedback: z.string().min(1),
  }),
  recommendations: z.array(recommendationSchema).min(1).max(5),
});

// --- TypeScript Types (derived from Zod) ---

export type EvaluationResponse = z.infer<typeof evaluationResponseSchema>;
export type Recommendation = z.infer<typeof recommendationSchema>;
export type EvaluationScores = EvaluationResponse['evaluation'];
```

**`src/types/sentence.ts`**

```typescript
import { z } from 'zod';

export const dailySentenceSchema = z.object({
  korean_text: z.string().min(1),
  difficulty: z.enum(['easy', 'medium', 'hard']),
});

export const dailySentencesResponseSchema = z.array(dailySentenceSchema).length(3);

export type DailySentenceFromAI = z.infer<typeof dailySentenceSchema>;
```

---

## Step 4.2 — Gemini System Prompts

**`src/constants/prompts.ts`**

```typescript
export const EVALUATION_SYSTEM_PROMPT = `
You are an expert English language tutor specializing in teaching Korean speakers.
Your role is to evaluate English translations of Korean sentences and provide constructive feedback.

You evaluate based on three criteria:
1. **Naturalness (자연스러움)**: How natural and fluent the English sounds to a native speaker. Consider idiomatic usage, word choice, and sentence flow.
2. **Grammar (문법)**: Grammatical correctness including verb tenses, articles, prepositions, subject-verb agreement, and sentence structure.
3. **Meaning Clarity (의미 전달)**: How clearly and accurately the original Korean meaning is conveyed in English.

IMPORTANT RULES:
- All feedback and explanations MUST be written in Korean (한국어).
- Scores range from 0 to 100.
- Provide 2-3 recommended alternative English sentences.
- Each recommendation must include:
  - The English sentence itself
  - Context and nuance explanation (when/where to use it, in Korean)
  - Grammar explanation (why this grammar is correct, in Korean)
- Be encouraging but honest. Don't inflate scores.
- Focus on real-life, conversational English — NOT textbook English.
- If the user's translation is already excellent, acknowledge it and still provide alternatives for variety.
`;

export const DAILY_SENTENCE_SYSTEM_PROMPT = `
You are a Korean language content creator for an English learning app.
Generate natural Korean sentences that Korean speakers commonly use in daily life.

RULES:
- Generate exactly 3 sentences.
- Each sentence should have a different difficulty level: easy, medium, hard.
- Each sentence should come from a different context: work/school, social/friends, daily routine/errands.
- Sentences must be natural and conversational — NOT textbook-style.
- Use casual/informal Korean (반말 or 해요체).
- Do NOT generate overly simple sentences like "안녕하세요" or "감사합니다".
- Do NOT repeat sentences from previous days (be creative and diverse).
`;
```

---

## Step 4.3 — Gemini Evaluation Service

**`src/services/gemini.ts`**

### Full Implementation

```typescript
import {
  GoogleGenerativeAI,
  SchemaType,
  type GenerativeModel,
} from '@google/generative-ai';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { evaluationResponseSchema, type EvaluationResponse } from '@/types/evaluation';
import { EVALUATION_SYSTEM_PROMPT } from '@/constants/prompts';

// Gemini response schema (enforces structured JSON output)
const evaluationSchema = {
  type: SchemaType.OBJECT,
  properties: {
    evaluation: {
      type: SchemaType.OBJECT,
      properties: {
        naturalness_score: {
          type: SchemaType.INTEGER,
          description: 'Score for how natural the English sounds (0-100)',
        },
        grammar_score: {
          type: SchemaType.INTEGER,
          description: 'Score for grammatical correctness (0-100)',
        },
        meaning_clarity_score: {
          type: SchemaType.INTEGER,
          description: 'Score for how clearly the meaning is conveyed (0-100)',
        },
        feedback: {
          type: SchemaType.STRING,
          description: 'Overall feedback written in Korean',
        },
      },
      required: [
        'naturalness_score',
        'grammar_score',
        'meaning_clarity_score',
        'feedback',
      ],
    },
    recommendations: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          sentence: {
            type: SchemaType.STRING,
            description: 'Recommended English sentence',
          },
          context_and_nuance: {
            type: SchemaType.STRING,
            description: 'Context and nuance explanation in Korean',
          },
          grammar_explanation: {
            type: SchemaType.STRING,
            description: 'Grammar explanation in Korean',
          },
        },
        required: ['sentence', 'context_and_nuance', 'grammar_explanation'],
      },
    },
  },
  required: ['evaluation', 'recommendations'],
};

// Lazy-initialized model instance
let _model: GenerativeModel | null = null;

function getModel(): GenerativeModel {
  const apiKey = useSettingsStore.getState().geminiApiKey;
  if (!apiKey) {
    throw new Error('Gemini API key not configured. Please add it in Settings.');
  }

  // Re-create if API key changed
  const genAI = new GoogleGenerativeAI(apiKey);
  _model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: evaluationSchema,
      temperature: 0.7,
    },
    systemInstruction: EVALUATION_SYSTEM_PROMPT,
  });

  return _model;
}

/**
 * Evaluate a user's English translation of a Korean sentence.
 */
export async function evaluate(input: {
  koreanText: string;
  englishText: string;
}): Promise<EvaluationResponse> {
  const model = getModel();

  const prompt = `
Korean sentence (원문): "${input.koreanText}"
User's English translation (사용자 번역): "${input.englishText}"

Please evaluate this translation and provide recommended alternatives.
  `.trim();

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();

  // Parse JSON response
  let jsonResponse: unknown;
  try {
    jsonResponse = JSON.parse(responseText);
  } catch (parseError) {
    throw new Error(`Failed to parse Gemini response as JSON: ${responseText.substring(0, 200)}`);
  }

  // Validate with Zod
  const validated = evaluationResponseSchema.safeParse(jsonResponse);
  if (!validated.success) {
    console.error('Zod validation errors:', validated.error.issues);
    throw new Error(
      `Invalid Gemini response structure: ${validated.error.issues.map(i => i.message).join(', ')}`
    );
  }

  return validated.data;
}
```

---

## Step 4.4 — Daily Sentence Generation Service

**`src/services/dailySentences.ts`**

```typescript
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { useSettingsStore } from '@/stores/useSettingsStore';
import { sentenceRepository } from '@/db/repositories/sentenceRepository';
import { dailySentencesResponseSchema, type DailySentenceFromAI } from '@/types/sentence';
import { DAILY_SENTENCE_SYSTEM_PROMPT } from '@/constants/prompts';

// Gemini schema for daily sentence generation
const dailySentenceSchema = {
  type: SchemaType.ARRAY,
  items: {
    type: SchemaType.OBJECT,
    properties: {
      korean_text: {
        type: SchemaType.STRING,
        description: 'A natural Korean sentence',
      },
      difficulty: {
        type: SchemaType.STRING,
        enum: ['easy', 'medium', 'hard'],
        description: 'Difficulty level',
      },
    },
    required: ['korean_text', 'difficulty'],
  },
};

/**
 * Get daily sentences for the given date.
 * If none exist in the database, generate new ones via Gemini and save them.
 */
export async function getOrCreateDailySentences(date: string) {
  // 1. Check local database first
  const existing = await sentenceRepository.getByDate(date);
  if (existing.length > 0) {
    return existing;
  }

  // 2. Generate new sentences via Gemini
  const apiKey = useSettingsStore.getState().geminiApiKey;
  if (!apiKey) {
    throw new Error('Gemini API key not configured.');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: dailySentenceSchema,
      temperature: 1.0, // Higher temperature for variety
    },
    systemInstruction: DAILY_SENTENCE_SYSTEM_PROMPT,
  });

  const result = await model.generateContent(
    `Generate 3 daily Korean sentences for today (${date}). Make them interesting and practical.`
  );

  const responseText = result.response.text();
  const jsonResponse = JSON.parse(responseText);
  
  // Validate with Zod
  const validated = dailySentencesResponseSchema.safeParse(jsonResponse);
  if (!validated.success) {
    throw new Error(`Invalid daily sentence response: ${validated.error.message}`);
  }

  // 3. Save to local database
  const sentences = validated.data.map((s) => ({
    koreanText: s.korean_text,
    difficulty: s.difficulty as 'easy' | 'medium' | 'hard',
    dateAssigned: date,
  }));

  await sentenceRepository.createMany(sentences);

  // 4. Return the newly created sentences
  return sentenceRepository.getByDate(date);
}
```

---

## Step 4.5 — Error Handling Strategy

### Custom Error Classes

**`src/utils/errors.ts`**

```typescript
export class ApiKeyMissingError extends Error {
  constructor(service: 'openai' | 'gemini') {
    super(`${service === 'openai' ? 'OpenAI' : 'Gemini'} API key not configured. Please add it in Settings.`);
    this.name = 'ApiKeyMissingError';
  }
}

export class ApiResponseError extends Error {
  constructor(
    public service: string,
    public statusCode: number,
    message: string,
  ) {
    super(`${service} API error (${statusCode}): ${message}`);
    this.name = 'ApiResponseError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(`Response validation failed: ${message}`);
    this.name = 'ValidationError';
  }
}
```

### Retry Logic

For transient errors (network timeouts, 429 rate limits), implement a simple retry:

```typescript
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 2,
  delayMs: number = 1000,
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      // Don't retry on validation or API key errors
      if (error instanceof ValidationError || error instanceof ApiKeyMissingError) {
        throw error;
      }
      
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
  }
  
  throw lastError;
}
```

---

## API Request/Response Reference

### Evaluation Request

**Prompt sent to Gemini:**
```
Korean sentence (원문): "오늘 날씨가 너무 좋아서 산책하고 싶다"
User's English translation (사용자 번역): "The weather is so nice today I want to take a walk"

Please evaluate this translation and provide recommended alternatives.
```

**Expected JSON Response:**
```json
{
  "evaluation": {
    "naturalness_score": 82,
    "grammar_score": 75,
    "meaning_clarity_score": 90,
    "feedback": "전반적으로 의미 전달이 잘 되었습니다! 다만 두 절을 연결할 때 접속사 'that'이나 'so'를 사용하면 문법적으로 더 정확합니다. 'take a walk'는 매우 자연스러운 표현이에요."
  },
  "recommendations": [
    {
      "sentence": "The weather is so nice today that I want to go for a walk.",
      "context_and_nuance": "'go for a walk'은 'take a walk'과 거의 같은 의미이지만, 좀 더 가벼운 산책의 느낌을 줍니다. 일상 대화에서 매우 자주 사용됩니다.",
      "grammar_explanation": "'so ... that' 구문은 '너무 ~해서 ~하다'를 표현하는 정확한 영어 문법입니다. 'so + 형용사 + that + 결과절' 구조입니다."
    },
    {
      "sentence": "It's such a beautiful day, I feel like going for a walk.",
      "context_and_nuance": "좀 더 감성적이고 자연스러운 표현입니다. 'feel like ~ing'는 '~하고 싶다'를 부드럽게 표현할 때 원어민들이 자주 사용합니다.",
      "grammar_explanation": "'feel like + 동명사(-ing)'는 '~하고 싶다'는 의미의 관용 표현입니다. 'want to'보다 더 캐주얼하고 자연스럽습니다."
    }
  ]
}
```

### Daily Sentences Request

**Prompt sent to Gemini:**
```
Generate 3 daily Korean sentences for today (2026-08-09). Make them interesting and practical.
```

**Expected JSON Response:**
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

## Verification Checklist

- [ ] Gemini API key is correctly loaded from settings/env
- [ ] Evaluation API returns valid structured JSON
- [ ] Zod validation passes for correct responses
- [ ] Zod validation correctly rejects malformed responses
- [ ] Scores are within 0-100 range
- [ ] Feedback and explanations are in Korean
- [ ] Recommendations array contains 2-3 items
- [ ] Evaluation results are saved to the database with all related data
- [ ] Daily sentence generation produces 3 sentences with different difficulties
- [ ] Daily sentences are cached in local DB (no re-generation on same day)
- [ ] Error messages are user-friendly for: no API key, network error, invalid response
- [ ] Retry logic works for transient failures

---

## Next Phase

Once all checks pass → proceed to **[Phase 5: UI/UX Implementation](./PHASE_5_UI_UX.md)**
