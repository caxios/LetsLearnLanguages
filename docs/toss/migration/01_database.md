# 01. 데이터베이스 마이그레이션 설계서 (SQLite → Supabase PostgreSQL)

> 대상 원본: `src/db/schema.ts` (144줄, 9테이블) · `src/db/client.ts` · `src/db/repositories/*.ts` (8파일, 560줄)
> 이 문서는 위 파일들을 **전 줄 실측**한 결과다.

---

## 1. 아키텍처 전환의 핵심 3가지

### 1.1 멀티테넌시 도입
기존은 "기기 = 사용자"였으므로 `userId` 개념 자체가 없다. 서버 DB로 옮기면
**모든 조회·쓰기에 소유자 필터가 없으면 타인의 데이터가 새어나간다.**

### 1.2 트랜잭션 API 형태 변경 (⚠️ 놓치기 쉬움)
`evaluationRepository.ts:9-11` 에 명시된 제약:

```ts
// NOTE: the expo-sqlite driver runs transactions synchronously — the callback must
// not be `async`, or `commit` fires at the first `await` and the remaining writes
// land outside the transaction. Hence `.get()` / `.run()` instead of `await`.
```

`postgres-js` 드라이버는 **정반대로 async 콜백을 요구**한다.
`.get()` / `.run()` / `.all()` 은 존재하지 않는다. 트랜잭션을 쓰는 4개 함수
(`saveComplete`, `clearAllData`, `deleteByEvaluationId`, `deleteById`, `replaceForDate`)는
**전량 재작성 대상**이다.

### 1.3 날짜 처리 통일
현재 3가지 방식이 혼재한다:
- `format(new Date(), 'yyyy-MM-dd')` — 기기 로컬 타임존 (date-fns)
- `sql\`(datetime('now'))\`` — SQLite UTC
- `sql\`date(${evaluations.createdAt})\`` — UTC 기준 일자 추출

서버에서는 **`Asia/Seoul` 고정**으로 통일한다. 그렇지 않으면 "오늘의 문장"이
UTC 자정에 바뀌어 한국 사용자에게 오전 9시에 리셋된다.

---

## 2. 전체 스키마 전환 (9 → 10 테이블)

### 2.1 신규 테이블 — `users` (Toss CI/DI 매핑)

```ts
// src/db/schema.ts
import {
  boolean, index, integer, pgTable, real, serial, text,
  timestamp, uniqueIndex, varchar,
} from 'drizzle-orm/pg-core';

/**
 * Toss 미니앱 사용자. CI(연계정보)는 개인식별정보이므로 원문 저장 대신
 * 해시를 유니크 키로 쓴다. DI는 앱 단위 식별자라 그대로 보관해도 무방.
 */
export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    /** SHA-256(CI). 원문 CI는 저장하지 않는다. */
    ciHash: varchar('ci_hash', { length: 64 }).notNull(),
    /** Toss가 앱별로 발급하는 중복가입확인정보. */
    di: varchar('di', { length: 128 }),
    isPremium: boolean('is_premium').notNull().default(false),
    /** 구독 만료 시각. null = 구독 이력 없음. */
    premiumExpiresAt: timestamp('premium_expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    ciHashIdx: uniqueIndex('users_ci_hash_idx').on(t.ciHash),
  })
);
```

> `isPremium` 을 `users` 에 두는 이유: `revenue.ts` 의 `fetchPremiumStatus()` 가
> 반환하던 값을 그대로 대체한다. 클라이언트 `useMonetizationStore.isPremium` 의
> 새로운 권위 소스다.

---

### 2.2 `daily_sentences` — 오늘의 문장

| AS-IS (SQLite) | TO-BE (PG) | 변경 사유 |
|---|---|---|
| `integer id PK autoIncrement` | `serial id PK` | |
| — | `userId integer NOT NULL FK` | **멀티테넌시** |
| `text korean_text` | `text korean_text` | |
| `text difficulty {enum}` | `text difficulty {enum}` | pg enum 대신 text+enum 유지 (마이그레이션 유연) |
| `text date_assigned` | `date date_assigned` | 날짜 연산·인덱스 |
| `integer is_completed {mode:boolean}` | `boolean is_completed` | 네이티브 타입 |
| `text created_at default datetime('now')` | `timestamptz default now()` | |

```ts
export const dailySentences = pgTable(
  'daily_sentences',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    koreanText: text('korean_text').notNull(),
    difficulty: text('difficulty', { enum: ['easy', 'medium', 'hard'] }).notNull(),
    dateAssigned: date('date_assigned').notNull(),
    isCompleted: boolean('is_completed').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // getByDate() 의 주 조회 경로
    userDateIdx: index('daily_sentences_user_date_idx').on(t.userId, t.dateAssigned),
    // getRecent() 의 정렬 경로
    userCreatedIdx: index('daily_sentences_user_created_idx').on(t.userId, t.createdAt.desc()),
  })
);
```

---

### 2.3 `user_inputs` — 제출된 번역

```ts
export const userInputs = pgTable(
  'user_inputs',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    koreanText: text('korean_text').notNull(),
    englishInput: text('english_input').notNull(),
    inputMethod: text('input_method', { enum: ['voice', 'text'] }).notNull(),
    /** 웹에서는 Supabase Storage 객체 키. 저장 안 하면 계속 null. */
    audioUri: text('audio_uri'),
    /**
     * nullable 유지 필수: replaceForDate() 가 문장 교체 시 이 링크를 끊는다.
     * 자유 입력·토픽 연습도 항상 null.
     */
    dailySentenceId: integer('daily_sentence_id')
      .references(() => dailySentences.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // findCompletedKoreanTexts() 가 koreanText 로 조회한다
    userKoreanIdx: index('user_inputs_user_korean_idx').on(t.userId, t.koreanText),
    dailySentenceIdx: index('user_inputs_daily_sentence_idx').on(t.dailySentenceId),
  })
);
```

> **`onDelete: 'set null'` 로 승격**: SQLite 버전은 FK 제약을 피하려고
> `replaceForDate()` 안에서 수동으로 `dailySentenceId = null` UPDATE 를 먼저 실행했다.
> PG에서는 DB가 처리하게 하면 그 수동 단계를 지울 수 있다 (§4.6 참조).

---

### 2.4 `evaluations` — AI 채점 결과

```ts
export const evaluations = pgTable(
  'evaluations',
  {
    id: serial('id').primaryKey(),
    userInputId: integer('user_input_id').notNull()
      .references(() => userInputs.id, { onDelete: 'cascade' }),
    naturalnessScore: integer('naturalness_score').notNull(),
    grammarScore: integer('grammar_score').notNull(),
    meaningClarityScore: integer('meaning_clarity_score').notNull(),
    /** 가중 평균. AI가 주는 값이 아니라 서버가 계산한다 (§4.1). */
    overallScore: integer('overall_score').notNull(),
    /** [[문법용어]] 마크업이 포함된 상태로 저장된다. 절대 strip 하지 말 것. */
    feedback: text('feedback').notNull(),
    /** 디버깅용 Gemini 원본 JSON 전문. */
    rawJson: text('raw_json').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userInputIdx: index('evaluations_user_input_idx').on(t.userInputId),
    createdIdx: index('evaluations_created_idx').on(t.createdAt.desc()),
  })
);
```

> `userId` 를 두지 않는 이유: `userInputs` 를 통해 항상 도달 가능하며,
> 실제 코드의 모든 조회가 이미 `innerJoin(userInputs)` 를 거친다.
> 다만 **조인 없이 조회하는 `getStats()` / `getActivityDates()` 는 조인을 추가해야 한다** (§4.3).

---

### 2.5 `recommendations` — 추천 표현 (N:1)

```ts
export const recommendations = pgTable('recommendations', {
  id: serial('id').primaryKey(),
  evaluationId: integer('evaluation_id').notNull()
    .references(() => evaluations.id, { onDelete: 'cascade' }),
  sentence: text('sentence').notNull(),
  contextAndNuance: text('context_and_nuance').notNull(),
  /**
   * nullable 유지 필수 — 이 컬럼이 생기기 전에 저장된 행은 backfill 대상이 없다.
   * UI(RecommendationList)와 챗 컨텍스트(toTutorChatContext)가 null을 전제로 분기한다.
   */
  koreanTranslation: text('korean_translation'),
  grammarExplanation: text('grammar_explanation').notNull(),
}, (t) => ({
  evaluationIdx: index('recommendations_evaluation_idx').on(t.evaluationId),
}));
```

---

### 2.6 `review_cards` — 복습 플래시카드

```ts
export const reviewCards = pgTable('review_cards', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  evaluationId: integer('evaluation_id').notNull()
    .references(() => evaluations.id, { onDelete: 'cascade' }),
  koreanText: text('korean_text').notNull(),
  bestEnglish: text('best_english').notNull(),
  // --- SM-2 컬럼: 스키마에만 존재하고 현재 아무도 갱신하지 않는다 (00 문서 §0) ---
  easeFactor: real('ease_factor').notNull().default(2.5),
  intervalDays: integer('interval_days').notNull().default(1),
  repetitions: integer('repetitions').notNull().default(0),
  nextReviewDate: date('next_review_date').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userDueIdx: index('review_cards_user_due_idx').on(t.userId, t.nextReviewDate),
  // getByEvaluationId() 는 1건만 기대한다 → 유니크로 승격해 중복 북마크를 DB가 막게 한다
  evaluationIdx: uniqueIndex('review_cards_evaluation_idx').on(t.evaluationId),
}));
```

---

### 2.7 `review_attempts` — 복습 재시도 기록

```ts
export const reviewAttempts = pgTable('review_attempts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /**
   * ⚠️ nullable 은 의도된 설계다. 카드를 지워도 시도 기록은 남긴다
   *    ("lifetime practice effort is never lost" — schema.ts:83).
   *    ON DELETE SET NULL 로 DB에 위임하면 리포지토리의 수동 detach 로직을 지울 수 있다.
   */
  reviewCardId: integer('review_card_id')
    .references(() => reviewCards.id, { onDelete: 'set null' }),
  englishInput: text('english_input').notNull(),
  naturalnessScore: integer('naturalness_score').notNull(),
  grammarScore: integer('grammar_score').notNull(),
  meaningClarityScore: integer('meaning_clarity_score').notNull(),
  overallScore: integer('overall_score').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  cardIdx: index('review_attempts_card_idx').on(t.reviewCardId, t.createdAt.desc()),
  userIdx: index('review_attempts_user_idx').on(t.userId),
}));
```

> **`userId` 추가가 필수인 이유**: `countAll()` 이 `count(*)` 로 전체를 세는데,
> 카드가 삭제된 시도는 `reviewCardId = null` 이라 카드를 통해 소유자를 알 수 없다.
> `userId` 없이는 멀티테넌트에서 이 통계가 전역 카운트가 되어버린다.

---

### 2.8 `app_visits` — 출석 기록

```ts
export const appVisits = pgTable('app_visits', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  visitDate: date('visit_date').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // 🔴 원본은 visitDate 단독 UNIQUE. 그대로 두면 한 사용자가 방문한 날은
  //    다른 모든 사용자가 방문 기록을 남길 수 없다. 반드시 복합키로 승격.
  userDateIdx: uniqueIndex('app_visits_user_date_idx').on(t.userId, t.visitDate),
}));
```

---

### 2.9 `daily_messages` — 일일 응원 문구

```ts
export const dailyMessages = pgTable('daily_messages', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  dateAssigned: date('date_assigned').notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // 🔴 원본은 dateAssigned 단독 UNIQUE → 복합키 승격 (app_visits 와 동일한 사유)
  userDateIdx: uniqueIndex('daily_messages_user_date_idx').on(t.userId, t.dateAssigned),
}));
```

---

### 2.10 `grammar_notes` — 저장한 문법 노트

```ts
export const grammarNotes = pgTable('grammar_notes', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  term: text('term').notNull(),
  summary: text('summary').notNull(),
  /** GrammarExplanation 전문을 JSON 문자열로. jsonb 승격 권장 (§2.11). */
  detailJson: text('detail_json').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  // 🔴 원본은 term 단독 UNIQUE → 복합키 승격
  userTermIdx: uniqueIndex('grammar_notes_user_term_idx').on(t.userId, t.term),
  userCreatedIdx: index('grammar_notes_user_created_idx').on(t.userId, t.createdAt.desc()),
}));
```

### 2.11 선택: `detail_json` → `jsonb`
`grammarRepository.parseDetail()` 은 `JSON.parse` 실패를 `null` 로 흡수한다.
`jsonb` 로 바꾸면 파싱 실패가 구조적으로 불가능해지고 `parseDetail()` 을 지울 수 있다.
단 기존 로컬 데이터 이관이 없다면(=신규 서비스라면) 즉시 `jsonb` 채택을 권장한다.

---

### 2.12 신규: `user_quotas` — 쿼터 서버화

현재 쿼터는 `useMonetizationStore` 가 SecureStore 에 JSON blob 으로 저장한다.
클라이언트 저장은 **조작 가능**하며(코드 주석도 이를 인정하고 방어 파싱을 한다),
웹에서는 `localStorage` 라 더 쉽다. 서버로 옮긴다.

```ts
export const userQuotas = pgTable('user_quotas', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  /** KST 기준 날짜. 이 값이 오늘과 다르면 전 카운터를 0으로 간주한다. */
  quotaDate: date('quota_date').notNull(),

  dailySentenceRefreshCount: integer('daily_sentence_refresh_count').notNull().default(0),
  dailySentenceEvaluationCount: integer('daily_sentence_evaluation_count').notNull().default(0),
  topicPracticeGenerateCount: integer('topic_practice_generate_count').notNull().default(0),
  topicPracticeEvaluationCount: integer('topic_practice_evaluation_count').notNull().default(0),
  reviewEvaluationCount: integer('review_evaluation_count').notNull().default(0),

  /** 기능별 "다음 보너스까지 시청한 광고 수". 항상 < ADS_PER_BONUS(2). */
  adViews: jsonb('ad_views').$type<Record<string, number>>().notNull().default({}),

  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userDateIdx: uniqueIndex('user_quotas_user_date_idx').on(t.userId, t.quotaDate),
}));
```

> 컬럼명은 `QUOTA_FEATURES[feature].countKey` 와 정확히 일치시킨다
> (`dailySentenceRefreshCount` 등). 그래야 `constants/monetization.ts` 의
> 기능 테이블을 **한 글자도 고치지 않고** 재사용할 수 있다.

---

## 3. DB 클라이언트 (`src/db/client.ts`)

```ts
// [AS-IS] 클라이언트 번들에 포함되는 로컬 SQLite
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
export const expoDb = openDatabaseSync('letslearnlanguages.db', { enableChangeListener: true });
expoDb.execSync('PRAGMA foreign_keys = ON;');
export const db = drizzle(expoDb, { schema });
```

```ts
// [TO-BE] 서버 전용
import 'server-only';                      // 클라이언트 import 시 빌드 에러
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// Supabase Transaction 풀 모드는 prepared statement 를 지원하지 않는다.
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
```

- `PRAGMA foreign_keys = ON` → PG는 기본 활성. 삭제.
- `enableChangeListener` → drizzle `useLiveQuery` 용이었으나 **이 프로젝트는 사용처가 없다.** 삭제.
- `providers/DatabaseProvider.tsx` (런타임 마이그레이션 + 로딩 UI) → **파일 삭제**.
  마이그레이션은 배포 파이프라인의 `drizzle-kit migrate` 로 옮긴다.

### drizzle.config.ts

```ts
export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',                    // was: 'sqlite' + driver: 'expo'
  dbCredentials: { url: process.env.DATABASE_URL! },
} satisfies Config;
```

기존 `src/db/migrations/` 의 SQL 6개와 `migrations.js`, `meta/*` 는 전부 폐기한다.
`babel-plugin-inline-import`(SQL을 문자열로 인라인)도 `package.json` 에서 제거.

---

## 4. 리포지토리 8종 전 함수 마이그레이션

전 함수 시그니처에 `userId: number` 를 **첫 번째 인자**로 추가하는 규칙을 채택한다.

### 4.1 `evaluationRepository.saveComplete()` — 트랜잭션 재작성

가장 중요한 변경. 동기 → 비동기.

```ts
// [AS-IS] 동기 콜백 + .get()/.run()
return db.transaction((tx) => {
  const input = tx.insert(userInputs).values({...}).returning().get();
  const overallScore = Math.round(
    data.naturalnessScore * 0.4 + data.grammarScore * 0.35 + data.meaningClarityScore * 0.25
  );
  const evaluation = tx.insert(evaluations).values({...}).returning().get();
  if (data.recommendations.length > 0) {
    tx.insert(recommendations).values(...).run();
  }
  return evaluation.id;
});
```

```ts
// [TO-BE] async 콜백 + await + 구조분해
async saveComplete(userId: number, data: SaveCompleteInput) {
  return db.transaction(async (tx) => {
    const [input] = await tx
      .insert(userInputs)
      .values({
        userId,                                   // ← 추가
        koreanText: data.koreanText,
        englishInput: data.englishInput,
        inputMethod: data.inputMethod,
        audioUri: data.audioUri,
        dailySentenceId: data.dailySentenceId,
      })
      .returning();

    // 가중치는 절대 바꾸지 말 것 — UI의 모든 점수 표시가 이 값에 의존한다.
    const overallScore = Math.round(
      data.naturalnessScore * 0.4 +
      data.grammarScore * 0.35 +
      data.meaningClarityScore * 0.25
    );

    const [evaluation] = await tx
      .insert(evaluations)
      .values({
        userInputId: input.id,
        naturalnessScore: data.naturalnessScore,
        grammarScore: data.grammarScore,
        meaningClarityScore: data.meaningClarityScore,
        overallScore,
        feedback: data.feedback,                  // [[태그]] 포함 상태 그대로
        rawJson: data.rawJson,
        })
      .returning();

    if (data.recommendations.length > 0) {
      await tx.insert(recommendations).values(
        data.recommendations.map((rec) => ({
          evaluationId: evaluation.id,
          sentence: rec.sentence,
          contextAndNuance: rec.contextAndNuance,
          koreanTranslation: rec.koreanTranslation,
          grammarExplanation: rec.grammarExplanation,
        }))
      );
    }

    return evaluation.id;
  });
}
```

> 동일한 `0.4 / 0.35 / 0.25` 가중치가 `reviewAttemptRepository.create()` 에도
> 중복되어 있다. 서버 이관 시 `src/server/scoring.ts` 로 추출해 한 곳에서 관리할 것.

### 4.2 `evaluationRepository.getById()` — 소유권 검증 추가

3번의 순차 쿼리로 되어 있다. **소유자 확인이 없으면 IDOR 취약점**이 된다.

```ts
async getById(userId: number, id: number) {
  const [row] = await db
    .select()
    .from(evaluations)
    .innerJoin(userInputs, eq(evaluations.userInputId, userInputs.id))
    .where(and(eq(evaluations.id, id), eq(userInputs.userId, userId)))  // ← 소유권
    .limit(1);

  if (!row) return null;

  const recs = await db
    .select()
    .from(recommendations)
    .where(eq(recommendations.evaluationId, id));

  return { ...row.evaluations, input: row.user_inputs, recommendations: recs };
}
```

> 반환 형태(`{ ...evaluation, input, recommendations }`)는 반드시 유지한다.
> `StoredEvaluation` 타입이 이 반환값에서 파생되고 `EvaluationDetail`,
> `toTutorChatContext()`, `result/[id].tsx` 가 전부 이 모양에 의존한다.

### 4.3 나머지 `evaluationRepository` 함수

| 함수 | 변경 |
|---|---|
| `getStats()` | `innerJoin(userInputs)` 추가 + `where userId`. `coalesce(cast(round(avg(...)) as integer), 0)` → PG는 `round()` 가 numeric 반환이므로 `::int` 캐스팅 필요 |
| `getUniqueSentenceCount()` | 이미 조인 있음. `where userId` 만 추가 |
| `getActivityDates()` | `date(created_at)` → **`(created_at AT TIME ZONE 'Asia/Seoul')::date`**. UTC 그대로 두면 스트릭이 어긋난다 |
| `getLatestIdForDailySentence()` | 이미 조인 있음. `where userId` 추가 |
| `findCompletedKoreanTexts()` | 빈 배열 early-return 유지(`inArray` 빈 목록은 PG에서도 무효 SQL). `where userId` 추가 |
| `getRecent(limit)` | 이미 조인 있음. `where userId` 추가 |

```ts
// getActivityDates() — 타임존 수정이 핵심
async getActivityDates(userId: number): Promise<string[]> {
  const day = sql<string>`(${evaluations.createdAt} AT TIME ZONE 'Asia/Seoul')::date`;
  const rows = await db
    .select({ day })
    .from(evaluations)
    .innerJoin(userInputs, eq(evaluations.userInputId, userInputs.id))
    .where(eq(userInputs.userId, userId))
    .groupBy(day)
    .orderBy(desc(day));
  return rows.map((r) => r.day);
}
```

### 4.4 `sentenceRepository` (5함수)

| 함수 | 변경 |
|---|---|
| `getByDate(date)` | `+userId` |
| `getRecent(limit=20)` | `+userId`. AI 프롬프트의 중복 회피 목록을 만든다 — 타인 문장이 섞이면 안 됨 |
| `createMany(sentences)` | 각 row 에 `userId` 주입 |
| `replaceForDate(date, sentences)` | 트랜잭션 async 화 + **수동 detach 제거 가능** (§2.3에서 `onDelete:'set null'` 채택 시) |
| `markCompleted(id)` | `+userId` (타인 문장 완료 처리 방지) |

```ts
// replaceForDate — FK 를 DB에 위임해 3단계 → 2단계로 축소
async replaceForDate(userId: number, date: string, sentences: NewSentence[]) {
  return db.transaction(async (tx) => {
    // user_inputs.daily_sentence_id 는 ON DELETE SET NULL 이므로
    // 과거 번역은 자동으로 링크만 끊기고 살아남는다.
    await tx.delete(dailySentences)
      .where(and(eq(dailySentences.userId, userId), eq(dailySentences.dateAssigned, date)));

    return tx.insert(dailySentences)
      .values(sentences.map((s) => ({ ...s, userId })))
      .returning();
  });
}
```

### 4.5 `reviewRepository` (6함수)

| 함수 | 변경 |
|---|---|
| `getDueCards()` | `format(new Date(),'yyyy-MM-dd')` → 서버 KST 오늘. `+userId` |
| `getByEvaluationId(id)` | `+userId` |
| `create(data)` | `+userId`. `nextReviewDate = today` 유지 (파리티) |
| `deleteByEvaluationId(id)` | `ON DELETE SET NULL` 채택 시 **수동 detach 삭제 → 단순 delete 1줄** |
| `deleteById(id)` | 동상 |
| `updateAfterReview(...)` | **현재 호출자 0개.** 그대로 이관하되 미사용임을 주석에 명시 |

```ts
// deleteById — 트랜잭션이 아예 불필요해진다
async deleteById(userId: number, id: number) {
  return db.delete(reviewCards)
    .where(and(eq(reviewCards.id, id), eq(reviewCards.userId, userId)));
  // review_attempts.review_card_id 는 SET NULL 로 자동 detach
}
```

### 4.6 `reviewAttemptRepository` (3함수)

```ts
async create(userId: number, data: {...}) {
  const overallScore = computeOverallScore(data);   // §4.1 에서 추출한 공용 함수
  const [row] = await db.insert(reviewAttempts)
    .values({ ...data, userId, overallScore })
    .returning();
  return row;
}

/** 카드가 삭제된 시도까지 포함한 평생 복습 횟수. userId 컬럼이 있어야 성립한다. */
async countAll(userId: number): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reviewAttempts)
    .where(eq(reviewAttempts.userId, userId));
  return row?.count ?? 0;
}

async listByCard(userId: number, reviewCardId: number) { /* +userId */ }
```

> PG의 `count(*)` 는 `bigint` 를 반환해 JS에서 문자열이 된다. **`::int` 캐스팅 필수.**
> `countAll`, `getStats`, `reviewRepository.countAll` 3곳 모두 해당.

### 4.7 `visitRepository` (2함수)

```ts
async recordVisit(userId: number, date: string) {
  return db.insert(appVisits)
    .values({ userId, visitDate: date })
    .onConflictDoNothing({ target: [appVisits.userId, appVisits.visitDate] });  // 복합키
}

async getVisitDates(userId: number): Promise<string[]> { /* +userId, desc 정렬 유지 */ }
```

### 4.8 `dailyMessageRepository` (2함수)

```ts
async setForDate(userId: number, date: string, message: string) {
  const [row] = await db.insert(dailyMessages)
    .values({ userId, dateAssigned: date, message })
    .onConflictDoUpdate({
      target: [dailyMessages.userId, dailyMessages.dateAssigned],   // 복합키로 변경
      set: { message },
    })
    .returning();
  return row;
}
```

### 4.9 `grammarRepository` (5함수)

```ts
async save(userId: number, term: string, explanation: GrammarExplanation) {
  return db.insert(grammarNotes)
    .values({
      userId, term,
      summary: explanation.summary,
      detailJson: JSON.stringify(explanation),   // jsonb 채택 시 explanation 그대로
    })
    .onConflictDoUpdate({
      target: [grammarNotes.userId, grammarNotes.term],
      set: { summary: explanation.summary, detailJson: JSON.stringify(explanation) },
    });
}
```

`list()` / `getByTerm()` 의 `StoredGrammarNote` 매핑 형태와 `parseDetail()` 폴백은
UI(`GrammarNoteCard`, `useGrammarExplanation`)가 `detail: null` 을 분기하므로 그대로 유지한다.

### 4.10 `maintenanceRepository.clearAllData()`

```ts
// [AS-IS] FK 순서를 지키려고 8개 테이블을 수동 순차 삭제
// [TO-BE] users 를 지우지 않고 소유 데이터만 지운다. CASCADE 로 자식은 자동.
async clearAllData(userId: number) {
  return db.transaction(async (tx) => {
    // evaluations/recommendations 는 user_inputs CASCADE 로 함께 사라진다
    await tx.delete(reviewAttempts).where(eq(reviewAttempts.userId, userId));
    await tx.delete(reviewCards).where(eq(reviewCards.userId, userId));
    await tx.delete(userInputs).where(eq(userInputs.userId, userId));
    await tx.delete(dailySentences).where(eq(dailySentences.userId, userId));
    await tx.delete(appVisits).where(eq(appVisits.userId, userId));
    await tx.delete(dailyMessages).where(eq(dailyMessages.userId, userId));
    await tx.delete(grammarNotes).where(eq(grammarNotes.userId, userId));
  });
}
```

> 원본은 `grammarNotes` 를 지우지 않는다 — **버그로 보인다** (설정 화면의
> "모든 데이터 삭제"가 문법 노트만 남긴다). 위 코드는 이를 포함하도록 고쳤다.
> 파리티를 엄격히 지켜야 한다면 해당 줄을 빼면 된다.

---

## 5. Row Level Security (Supabase)

BFF 패턴에서는 서버가 service-role 키로 접속하므로 RLS를 우회한다.
그럼에도 **2차 방어선으로 반드시 켠다** — 애플리케이션 코드에서 `where userId` 를
한 번이라도 빠뜨리면 그것이 곧 데이터 유출이기 때문이다.

```sql
ALTER TABLE daily_sentences  ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_inputs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_cards     ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_attempts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_visits       ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE grammar_notes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_quotas      ENABLE ROW LEVEL SECURITY;
ALTER TABLE users            ENABLE ROW LEVEL SECURITY;

-- anon/authenticated 롤에는 어떤 정책도 부여하지 않는다 = 전면 차단.
-- 접근은 오직 서버의 service_role 을 통해서만 이뤄진다.
```

추가 권장: `NEXT_PUBLIC_` 접두사가 붙은 Supabase 키를 **절대 만들지 않는다.**
클라이언트는 DB에 직접 접근하지 않고 오직 `/api/*` 만 호출한다.

---

## 6. 체크리스트

- [ ] `pgTable` ×11 (`users`, `user_quotas` 신규 포함) 작성
- [ ] `app_visits` / `daily_messages` / `grammar_notes` 단독 UNIQUE → **복합 UNIQUE 승격**
- [ ] `review_attempts.userId` 추가 (카드 삭제 후에도 소유자 추적)
- [ ] 트랜잭션 5곳 동기 → async 재작성
- [ ] `count(*)` 3곳 `::int` 캐스팅
- [ ] `date(created_at)` → `AT TIME ZONE 'Asia/Seoul'`
- [ ] `overallScore` 가중치 계산 공용 함수로 추출 (2곳 중복 제거)
- [ ] 리포지토리 34개 함수 전부 `userId` 파라미터화
- [ ] `getById` 소유권 검증 (IDOR 방지)
- [ ] `client.ts` 에 `import 'server-only'`
- [ ] `DatabaseProvider.tsx` 삭제, `drizzle-kit migrate` 를 CI로 이관
- [ ] RLS 전 테이블 활성화 + anon 정책 0개
