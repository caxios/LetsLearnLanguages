# Phase 1: Database Layer (expo-sqlite + Drizzle ORM)

> **Goal**: Define the database schema, set up Drizzle ORM, generate migrations, and implement the repository pattern for data access.
> **Estimated Effort**: 1 day
> **Depends On**: Phase 0 (project initialized, `expo-sqlite` and `drizzle-orm` installed)
> **Verification**: Migrations run at app startup, repositories can CRUD records, data persists across app restarts.

---

## Step 1.1 — Database Client Setup

**`src/db/client.ts`**

Set up the SQLite connection and wrap it with Drizzle ORM:

```typescript
import { openDatabaseSync } from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

const expoDb = openDatabaseSync('letslearnlanguages.db');
export const db = drizzle(expoDb, { schema });
```

---

## Step 1.2 — Schema Definition

**`src/db/schema.ts`**

Define all 5 tables using Drizzle's SQLite schema builder.

### Table 1: `daily_sentences`

Stores the daily Korean sentences provided to the user.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, autoincrement | Primary key |
| `korean_text` | TEXT | NOT NULL | The Korean sentence |
| `difficulty` | TEXT | NOT NULL | 'easy', 'medium', or 'hard' |
| `date_assigned` | TEXT | NOT NULL | Date assigned (YYYY-MM-DD) |
| `is_completed` | INTEGER | NOT NULL, default 0 | Boolean: attempted or not |
| `created_at` | TEXT | NOT NULL, default now | Timestamp |

```typescript
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const dailySentences = sqliteTable('daily_sentences', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  koreanText: text('korean_text').notNull(),
  difficulty: text('difficulty', { enum: ['easy', 'medium', 'hard'] }).notNull(),
  dateAssigned: text('date_assigned').notNull(),
  isCompleted: integer('is_completed', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});
```

### Table 2: `user_inputs`

Stores every input the user submits (voice or text).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, autoincrement | Primary key |
| `korean_text` | TEXT | NOT NULL | Original Korean sentence |
| `english_input` | TEXT | NOT NULL | User's English translation |
| `input_method` | TEXT | NOT NULL | 'voice' or 'text' |
| `audio_uri` | TEXT | nullable | Path to recorded audio |
| `daily_sentence_id` | INTEGER | FK, nullable | Link to daily_sentences |
| `created_at` | TEXT | NOT NULL, default now | Timestamp |

```typescript
export const userInputs = sqliteTable('user_inputs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  koreanText: text('korean_text').notNull(),
  englishInput: text('english_input').notNull(),
  inputMethod: text('input_method', { enum: ['voice', 'text'] }).notNull(),
  audioUri: text('audio_uri'),
  dailySentenceId: integer('daily_sentence_id').references(() => dailySentences.id),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});
```

### Table 3: `evaluations`

Stores AI evaluation results.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, autoincrement | Primary key |
| `user_input_id` | INTEGER | FK, NOT NULL | Link to user_inputs |
| `naturalness_score` | INTEGER | NOT NULL | 0–100 |
| `grammar_score` | INTEGER | NOT NULL | 0–100 |
| `meaning_clarity_score` | INTEGER | NOT NULL | 0–100 |
| `overall_score` | INTEGER | NOT NULL | Weighted average |
| `feedback` | TEXT | NOT NULL | AI feedback (Korean) |
| `raw_json` | TEXT | NOT NULL | Full raw Gemini response |
| `created_at` | TEXT | NOT NULL, default now | Timestamp |

```typescript
export const evaluations = sqliteTable('evaluations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userInputId: integer('user_input_id').notNull().references(() => userInputs.id),
  naturalnessScore: integer('naturalness_score').notNull(),
  grammarScore: integer('grammar_score').notNull(),
  meaningClarityScore: integer('meaning_clarity_score').notNull(),
  overallScore: integer('overall_score').notNull(),
  feedback: text('feedback').notNull(),
  rawJson: text('raw_json').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});
```

### Table 4: `recommendations`

Stores individual AI-recommended English sentences.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, autoincrement | Primary key |
| `evaluation_id` | INTEGER | FK, NOT NULL | Link to evaluations |
| `sentence` | TEXT | NOT NULL | Recommended English sentence |
| `context_and_nuance` | TEXT | NOT NULL | Usage context (Korean) |
| `grammar_explanation` | TEXT | NOT NULL | Grammar explanation (Korean) |

```typescript
export const recommendations = sqliteTable('recommendations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  evaluationId: integer('evaluation_id').notNull().references(() => evaluations.id),
  sentence: text('sentence').notNull(),
  contextAndNuance: text('context_and_nuance').notNull(),
  grammarExplanation: text('grammar_explanation').notNull(),
});
```

### Table 5: `review_cards`

Stores spaced-repetition review data (SM-2 algorithm).

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK, autoincrement | Primary key |
| `evaluation_id` | INTEGER | FK, NOT NULL | Link to evaluations |
| `korean_text` | TEXT | NOT NULL | Question side |
| `best_english` | TEXT | NOT NULL | Answer side |
| `ease_factor` | REAL | NOT NULL, default 2.5 | SM-2 ease factor |
| `interval_days` | INTEGER | NOT NULL, default 1 | Days until next review |
| `repetitions` | INTEGER | NOT NULL, default 0 | Successful review count |
| `next_review_date` | TEXT | NOT NULL | Next scheduled review |
| `created_at` | TEXT | NOT NULL, default now | Timestamp |

```typescript
export const reviewCards = sqliteTable('review_cards', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  evaluationId: integer('evaluation_id').notNull().references(() => evaluations.id),
  koreanText: text('korean_text').notNull(),
  bestEnglish: text('best_english').notNull(),
  easeFactor: real('ease_factor').notNull().default(2.5),
  intervalDays: integer('interval_days').notNull().default(1),
  repetitions: integer('repetitions').notNull().default(0),
  nextReviewDate: text('next_review_date').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
});
```

> Don't forget to import `real` from `drizzle-orm/sqlite-core`.

---

## Step 1.3 — Drizzle Kit Configuration

**`drizzle.config.ts`** — At project root:

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  driver: 'expo',
} satisfies Config;
```

### Generate Migrations

```bash
npx drizzle-kit generate
```

This creates migration SQL files in `src/db/migrations/`.

---

## Step 1.4 — Database Provider

**`src/providers/DatabaseProvider.tsx`**

Wrap the app in a provider that initializes the database and runs migrations at startup:

```typescript
import React, { PropsWithChildren } from 'react';
import { Text, View } from 'react-native';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { db } from '@/db/client';
import migrations from '@/db/migrations/migrations';

export function DatabaseProvider({ children }: PropsWithChildren) {
  const { success, error } = useMigrations(db, migrations);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Database migration error: {error.message}</Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Initializing database...</Text>
      </View>
    );
  }

  return <>{children}</>;
}
```

**`app/_layout.tsx`** — Wrap with DatabaseProvider:

```typescript
// Inside the root layout:
<DatabaseProvider>
  {/* existing layout content */}
</DatabaseProvider>
```

---

## Step 1.5 — Repository Pattern

### Sentence Repository

**`src/db/repositories/sentenceRepository.ts`**

```typescript
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { dailySentences } from '@/db/schema';

export const sentenceRepository = {
  // Get all sentences for a specific date
  async getByDate(date: string) {
    return db.select()
      .from(dailySentences)
      .where(eq(dailySentences.dateAssigned, date));
  },

  // Insert new daily sentences
  async createMany(sentences: {
    koreanText: string;
    difficulty: 'easy' | 'medium' | 'hard';
    dateAssigned: string;
  }[]) {
    return db.insert(dailySentences).values(sentences);
  },

  // Mark a sentence as completed
  async markCompleted(id: number) {
    return db.update(dailySentences)
      .set({ isCompleted: true })
      .where(eq(dailySentences.id, id));
  },
};
```

### Evaluation Repository

**`src/db/repositories/evaluationRepository.ts`**

```typescript
import { eq, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { userInputs, evaluations, recommendations } from '@/db/schema';

export const evaluationRepository = {
  // Save a complete evaluation (input + scores + recommendations) in a transaction
  async saveComplete(data: {
    koreanText: string;
    englishInput: string;
    inputMethod: 'voice' | 'text';
    audioUri?: string;
    dailySentenceId?: number;
    naturalnessScore: number;
    grammarScore: number;
    meaningClarityScore: number;
    feedback: string;
    rawJson: string;
    recommendations: {
      sentence: string;
      contextAndNuance: string;
      grammarExplanation: string;
    }[];
  }) {
    return db.transaction(async (tx) => {
      // 1. Insert user input
      const [input] = await tx.insert(userInputs).values({
        koreanText: data.koreanText,
        englishInput: data.englishInput,
        inputMethod: data.inputMethod,
        audioUri: data.audioUri,
        dailySentenceId: data.dailySentenceId,
      }).returning();

      // 2. Calculate overall score (weighted average)
      const overallScore = Math.round(
        data.naturalnessScore * 0.4 +
        data.grammarScore * 0.35 +
        data.meaningClarityScore * 0.25
      );

      // 3. Insert evaluation
      const [evaluation] = await tx.insert(evaluations).values({
        userInputId: input.id,
        naturalnessScore: data.naturalnessScore,
        grammarScore: data.grammarScore,
        meaningClarityScore: data.meaningClarityScore,
        overallScore,
        feedback: data.feedback,
        rawJson: data.rawJson,
      }).returning();

      // 4. Insert recommendations
      if (data.recommendations.length > 0) {
        await tx.insert(recommendations).values(
          data.recommendations.map((rec) => ({
            evaluationId: evaluation.id,
            sentence: rec.sentence,
            contextAndNuance: rec.contextAndNuance,
            grammarExplanation: rec.grammarExplanation,
          }))
        );
      }

      return evaluation.id;
    });
  },

  // Get evaluation by ID with related input and recommendations
  async getById(id: number) {
    const evaluation = await db.select()
      .from(evaluations)
      .where(eq(evaluations.id, id))
      .limit(1);

    if (!evaluation[0]) return null;

    const input = await db.select()
      .from(userInputs)
      .where(eq(userInputs.id, evaluation[0].userInputId))
      .limit(1);

    const recs = await db.select()
      .from(recommendations)
      .where(eq(recommendations.evaluationId, id));

    return {
      ...evaluation[0],
      input: input[0],
      recommendations: recs,
    };
  },

  // Get recent evaluations (for history/activity feed)
  async getRecent(limit: number = 10) {
    return db.select()
      .from(evaluations)
      .innerJoin(userInputs, eq(evaluations.userInputId, userInputs.id))
      .orderBy(desc(evaluations.createdAt))
      .limit(limit);
  },
};
```

### Review Repository

**`src/db/repositories/reviewRepository.ts`**

```typescript
import { eq, lte } from 'drizzle-orm';
import { db } from '@/db/client';
import { reviewCards } from '@/db/schema';
import { format } from 'date-fns';

export const reviewRepository = {
  // Get all cards due for review today or earlier
  async getDueCards() {
    const today = format(new Date(), 'yyyy-MM-dd');
    return db.select()
      .from(reviewCards)
      .where(lte(reviewCards.nextReviewDate, today));
  },

  // Create a new review card from an evaluation
  async create(data: {
    evaluationId: number;
    koreanText: string;
    bestEnglish: string;
  }) {
    const today = format(new Date(), 'yyyy-MM-dd');
    return db.insert(reviewCards).values({
      evaluationId: data.evaluationId,
      koreanText: data.koreanText,
      bestEnglish: data.bestEnglish,
      nextReviewDate: today, // Due immediately for first review
    });
  },

  // Update a card after review using SM-2 algorithm results
  async updateAfterReview(id: number, updates: {
    easeFactor: number;
    intervalDays: number;
    repetitions: number;
    nextReviewDate: string;
  }) {
    return db.update(reviewCards)
      .set(updates)
      .where(eq(reviewCards.id, id));
  },
};
```

---

## Entity Relationship Diagram

```
┌─────────────────┐
│ daily_sentences  │
│─────────────────│
│ id (PK)         │
│ korean_text     │
│ difficulty      │
│ date_assigned   │
│ is_completed    │
│ created_at      │
└────────┬────────┘
         │ 1:N (optional)
         ▼
┌─────────────────┐
│   user_inputs   │
│─────────────────│
│ id (PK)         │
│ korean_text     │
│ english_input   │
│ input_method    │
│ audio_uri       │
│ daily_sentence_id (FK) │
│ created_at      │
└────────┬────────┘
         │ 1:1
         ▼
┌─────────────────┐       ┌─────────────────┐
│  evaluations    │       │  review_cards   │
│─────────────────│       │─────────────────│
│ id (PK)         │──────▶│ id (PK)         │
│ user_input_id   │  1:1  │ evaluation_id   │
│ naturalness_*   │       │ korean_text     │
│ grammar_*       │       │ best_english    │
│ meaning_*       │       │ ease_factor     │
│ overall_score   │       │ interval_days   │
│ feedback        │       │ repetitions     │
│ raw_json        │       │ next_review_date│
│ created_at      │       │ created_at      │
└────────┬────────┘       └─────────────────┘
         │ 1:N
         ▼
┌──────────────────┐
│ recommendations  │
│──────────────────│
│ id (PK)          │
│ evaluation_id(FK)│
│ sentence         │
│ context_and_*    │
│ grammar_*        │
└──────────────────┘
```

---

## Verification Checklist

- [ ] `npx drizzle-kit generate` creates migration files without errors
- [ ] App starts and `DatabaseProvider` shows "Initializing..." then renders children
- [ ] No migration errors in console
- [ ] Can manually test `sentenceRepository.createMany()` and `sentenceRepository.getByDate()` via a temporary test button
- [ ] Data persists after fully closing and reopening the app
- [ ] Foreign key relationships work correctly (cascading references)

---

## Next Phase

Once all checks pass → proceed to **[Phase 2: State Management](./PHASE_2_STATE_MANAGEMENT.md)**
