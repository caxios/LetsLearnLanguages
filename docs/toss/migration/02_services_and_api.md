# 02. 서비스 · 외부 API 마이그레이션 설계서 (BFF 패턴)

> 대상 원본: `src/services/*.ts` (8파일 1,553줄) · `src/constants/prompts.ts` (178줄)
> · `src/constants/ads.ts` · `src/constants/revenue.ts` · `src/constants/monetization.ts`
> · `src/types/*.ts` (Zod 스키마) · `src/utils/errors.ts`

---

## 0. 전환의 대전제

현재 앱은 **사용자가 자기 API 키를 설정 화면에 직접 입력**한다.

```ts
// src/stores/useSettingsStore.ts
openaiApiKey: openaiKey || process.env.EXPO_PUBLIC_OPENAI_API_KEY || null,
geminiApiKey: geminiKey || process.env.EXPO_PUBLIC_GEMINI_API_KEY || null,
```

토스 미니앱에서는 이 모델이 성립하지 않는다.

1. `EXPO_PUBLIC_*` 에 해당하는 `NEXT_PUBLIC_*` 은 **번들에 그대로 박힌다** → 키 유출
2. 일반 사용자에게 "Gemini API 키를 발급받아 입력하세요"를 요구할 수 없다
3. 브라우저에서 `generativelanguage.googleapis.com` 직접 호출은 **CORS 차단**된다
4. 프롬프트 원문(`constants/prompts.ts` 178줄)이 클라이언트 번들에 노출된다 — 핵심 자산 유출

**결론: AI 호출 전량을 Next.js 서버로 이관하고, 설정 화면의 API 키 입력 UI를 삭제한다.**

---

## 1. 서비스 → 라우트 매핑 총괄

| 원본 서비스 | HTTP | 신규 라우트 | 쿼터 기능 키 | 광고 게이트 |
|---|---|---|---|---|
| `gemini.evaluate()` | POST | `/api/evaluate` | `dailySentenceEvaluation` \| `topicPracticeEvaluation` | ✅ |
| `gemini.scoreOnly()` | POST | `/api/review/score` | `reviewEvaluation` | ✅ |
| `gemini.askFollowUpQuestion()` | POST | `/api/tutor/ask` | — (무제한) | ❌ |
| `dailySentences.getOrCreateDailySentences()` | GET | `/api/daily-sentences?date=` | — | ❌ |
| `dailySentences.refreshDailySentences()` | POST | `/api/daily-sentences/refresh` | `dailySentenceRefresh` | ❌ |
| `dailyMessage.getOrCreateDailyMessage()` | GET | `/api/daily-message?date=` | — | ❌ |
| `dailyMessage.refreshDailyMessage()` | (내부) | refresh 라우트에 포함 | — | ❌ |
| `topicSentences.generateTopicSentences()` | POST | `/api/topics/generate` | `topicPracticeGenerate` | ❌ |
| `grammar.explainGrammarTerm()` | POST | `/api/grammar/explain` | — | ❌ |
| `whisper.transcribe()` | POST | `/api/transcribe` | — | ❌ |
| `revenue.*` | — | `/api/payments/*` | — | — |
| `ads.*` | — | 클라이언트 전용 | — | — |

> **중요**: `askFollowUpQuestion`(AI 튜터 챗)과 `explainGrammarTerm`(문법 선생님)은
> 현재 **쿼터가 걸려 있지 않다.** Gemini 호출 비용이 발생하는데도 무제한이다.
> 파리티를 지키려면 그대로 두되, 서버 이관 후에는 **레이트 리밋(IP/유저당 분당 N회)을
> 반드시 걸어야 한다** — 클라이언트 키 시절에는 사용자가 자기 비용을 썼지만
> 이제는 서비스가 부담하기 때문이다.

---

## 2. Gemini 코어 (`src/services/gemini.ts`, 417줄)

### 2.1 모델 인스턴스 3종 — 설정값 원문 보존

`gemini.ts` 는 **서로 다른 설정의 모델 인스턴스 3개**를 API 키별로 캐싱한다.
이 설정값은 출력 품질을 결정하므로 한 글자도 바꾸지 않고 옮긴다.

| 인스턴스 | 모델 | temperature | responseMimeType | responseSchema | systemInstruction |
|---|---|---|---|---|---|
| `getModel()` (평가) | `gemini-2.5-flash` | **0.7** | `application/json` | `evaluationSchema` | `EVALUATION_SYSTEM_PROMPT` |
| `getScoreModel()` (복습 채점) | `gemini-2.5-flash` | **0.2** | `application/json` | `scoreOnlySchema` | `REVIEW_SCORING_SYSTEM_PROMPT` |
| `getTutorModel()` (챗) | `gemini-2.5-flash` | **0.7** | **없음(산문)** | **없음** | `TUTOR_CHAT_SYSTEM_PROMPT` |

그 외 파일에서 생성하는 인스턴스:

| 위치 | temperature | 비고 |
|---|---|---|
| `dailyMessage.ts` | **1.1** | "Warmth over precision — 매일 다른 문장" |
| `dailySentences.ts` | **1.0** | 다양성 |
| `topicSentences.ts` 일반 | **1.0** | |
| `topicSentences.ts` 그라운디드 | **1.0** | `responseSchema` **없음** (검색 그라운딩과 동시 사용 불가) |
| `grammar.ts` | **0.3** | "같은 문법은 항상 같게 설명" |

```ts
// src/server/ai/gemini.ts  (TO-BE)
import 'server-only';
import { GoogleGenerativeAI, GoogleGenerativeAIFetchError, SchemaType } from '@google/generative-ai';

export const GEMINI_MODEL = 'gemini-2.5-flash';

/** 서버 환경변수. 클라이언트 스토어 조회를 대체한다. */
function requireGeminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY;        // NEXT_PUBLIC_ 접두사 금지
  if (!key) throw new ApiKeyMissingError('gemini');
  return key;
}
```

> **캐싱 전략 변경**: 원본은 "API 키가 바뀌면 인스턴스 재생성"(`_modelApiKey` 비교)이었다.
> 서버에서는 키가 프로세스 수명 동안 고정이므로 **모듈 스코프 싱글턴**으로 단순화한다.
> 단 서버리스(Vercel Lambda)에서는 콜드 스타트마다 재생성되므로 부작용 없음.

### 2.2 `evaluate()` — 문법 태깅 파이프라인 보존

응답 후처리가 이 앱의 핵심 차별화 로직이다. **반드시 서버에서 동일하게 수행**한다.

```ts
export async function evaluate(input: { koreanText: string; englishText: string }) {
  const model = getModel();
  const prompt = `
Korean sentence (원문): "${input.koreanText}"
User's English translation (사용자 번역): "${input.englishText}"

Please evaluate this translation and provide recommended alternatives.
  `.trim();

  return withRetry(async () => {
    const json = await generateJson(model, prompt);
    const validated = evaluationResponseSchema.safeParse(json);   // Zod, 그대로 재사용
    if (!validated.success) throw new ValidationError(/* ... */);
    return tagGrammarTerms(validated.data);                        // ← 이것이 핵심
  });
}
```

`tagGrammarTerms()` 가 하는 일 (`gemini.ts:213-229`):

```
evaluation.feedback           ← applyGrammarTags(feedback, evaluation.grammar_terms)
recommendations[].context_and_nuance    ← applyGrammarTags(text, rec.grammar_terms)
recommendations[].grammar_explanation   ← applyGrammarTags(text, rec.grammar_terms)

grammar_terms 배열이 비어 있으면 → autoTagKnownTerms(text)
                                    = KNOWN_GRAMMAR_TERMS 60개 사전으로 폴백
```

주석에 설계 근거가 명시되어 있다:
> "a schema-required array is enforced by constrained decoding, whereas markup
> inside a string value is only a hint and gets dropped"

즉 **모델에게 `[[ ]]` 를 직접 쓰라고 하면 안 되고**, 용어 배열만 받아서
코드가 결정론적으로 마크업을 삽입한다. `utils/grammarTags.ts` 는 서버·클라이언트
양쪽에서 쓰이므로 **`src/lib/grammarTags.ts` (isomorphic)** 로 배치한다.

- 서버: `applyGrammarTags` / `autoTagKnownTerms` / `stripGrammarTags`
- 클라이언트: `parseGrammarTags` (GrammarText 렌더링용)

### 2.3 `askFollowUpQuestion()` — 컨텍스트 주입 규약

Gemini 챗은 user/model 교대를 강제하므로, 평가 내용을 **첫 user 턴**으로 주입하고
가짜 model 응답을 붙인 뒤 실제 질문을 이어붙인다.

```ts
const CONTEXT_ACKNOWLEDGEMENT =
  '네, 방금 받은 평가 내용을 모두 확인했어요. 궁금한 점을 물어봐 주세요.';

const history: Content[] = [
  { role: 'user',  parts: [{ text: buildContextPrompt(input.context) }] },
  { role: 'model', parts: [{ text: CONTEXT_ACKNOWLEDGEMENT }] },
  ...input.history
    .filter((m) => !m.failed)          // 실패한 질문은 제외 — user 턴 2연속 방지
    .map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
];
```

`buildContextPrompt()` 출력 포맷 (원문 유지):

```
학습자가 방금 받은 평가입니다. 앞으로의 모든 질문은 이 내용에 대한 것입니다.

[한국어 원문]
{koreanText}

[학습자가 쓴 영어 번역]
{englishInput}

[받은 피드백]
{stripGrammarTags(feedback)}      ← [[태그]] 제거. 모델은 앱 포맷이 아닌 단어를 읽어야 함

[추천 문장]
1. "{sentence}"
   한국어: {koreanTranslation}     ← null 이면 이 줄 자체를 생략
   문법 설명: {stripGrammarTags(grammarExplanation)}
2. ...
```

**Stateless 설계**: 대화 이력을 서버가 갖지 않고 클라이언트가 매 턴 전송한다.
이 성질 덕분에 BFF 이관이 거의 무손실이다.

```ts
// POST /api/tutor/ask
{ context: TutorChatContext, history: ChatMessage[], question: string }
→ { answer: string }
```

> 페이로드 크기 주의: 추천 문장 3개 + 피드백 + 누적 대화가 매 턴 전송된다.
> 요청 본문 상한(Vercel 기본 4.5MB)에는 여유가 있으나, `history` 길이 상한
> (예: 최근 20턴)을 서버에서 강제할 것을 권장한다.

---

## 3. 문장 생성 서비스 3종

### 3.1 `dailySentences.ts` — 3문장 + 중복 회피 프롬프트

프롬프트가 **DB 상태에 의존**하므로 서버 이관이 필수다 (클라이언트는 DB를 못 봄).

```
buildPrompt() 구성 4단계:
  1. buildDateContext(date)
     → "오늘은 2026년 8월 21일 금요일, 여름입니다."
        (getSeason: 3-5=봄, 6-8=여름, 9-11=가을, else 겨울)
     → "이 시기에 한국 사람들이 실제로 할 법한 자연스러운 대화 문장을 생성하세요."
  2. pickRandomTopics(3) — 50개 풀에서 Fisher-Yates 셔플 후 3개
     → "오늘의 주제 (각 난이도에 하나씩 배정):"
        "- [easy] {topic0}"  "- [medium] {topic1}"  "- [hard] {topic2}"
  3. sentenceRepository.getRecent(20) + todayAvoid 합집합
     → "아래는 이미 생성된 문장입니다. ... 절대 생성하지 마세요:"
  4. "Generate 3 daily Korean sentences matching the topics above."
```

Zod: `z.array(dailySentenceSchema).length(3)` — **정확히 3개** 아니면 검증 실패 → 재시도.

```ts
// GET /api/daily-sentences?date=2026-08-21
// 1. sentenceRepository.getByDate(userId, date) 존재하면 그대로 반환 (AI 미호출)
// 2. 없으면 generateAndSave → createMany
→ DailySentence[]

// POST /api/daily-sentences/refresh   { date }
// 쿼터: dailySentenceRefresh (하루 2회) — 서버에서 검사·차감
// 1. 기존 문장 koreanText 를 todayAvoid 로 수집
// 2. generateAndSave(date, todayAvoid, replace=true) → replaceForDate
// 3. refreshDailyMessage(date).catch(() => null)   ← 실패해도 refresh 는 성공 처리
→ DailySentence[]
```

### 3.2 `topicSentences.ts` — 2단계 병렬 + 그라운딩 (5문장)

**이 파일이 가장 오해되기 쉽다.** 실제 동작:

```ts
const [regular, grounded] = await Promise.allSettled([
  generateRegularSentences(apiKey, topic),   // Phase A: 4문장, responseSchema 사용
  generateGroundedSentence(apiKey, topic),   // Phase B: 1문장, Google Search 그라운딩
]);

if (regular.status === 'rejected') throw regular.reason;    // A 실패 = 전체 실패
if (grounded.status === 'rejected') {
  console.warn(...);
  return sortByDifficulty(regular.value);                   // B 실패 = 4문장만 반환
}
return sortByDifficulty([grounded.value, ...regular.value]);// 총 5문장
```

Phase B의 특수 처리 3가지:

```ts
// 1. 타입 우회 — SDK 0.24.1 타이핑은 1.5 시대의 googleSearchRetrieval 만 안다
const GOOGLE_SEARCH_TOOL = { googleSearch: {} } as unknown as Tool;

// 2. responseSchema 사용 불가 → 산문으로 오므로 손으로 JSON 추출
function parseGroundedJson(text: string) {
  const withoutFences = text.replace(/```(?:json)?/gi, '').trim();
  const start = withoutFences.indexOf('{');
  const end = withoutFences.lastIndexOf('}');
  // ... JSON.parse(slice)
}

// 3. 재시도 1회만 — "grounded 는 옵션이고, 성공한 4문장을 붙잡아두면 안 됨"
const parsed = await withRetry(async () => { ... }, 1);
```

정렬: `sortByDifficulty` = 난이도 오름차순(easy→medium→hard), 동률이면 **그라운디드가 앞**.

```ts
// POST /api/topics/generate   { topic: string }
// 쿼터: topicPracticeGenerate (하루 2회)
→ TopicSentence[]   // { koreanText, difficulty, isGrounded }[]
```

> **생성 결과는 DB에 저장되지 않는다** (`topicSentences.ts` 주석: "These sentences are
> never persisted"). react-query 캐시(`staleTime: Infinity, gcTime: Infinity`)에만 산다.
> 웹에서는 새로고침 시 사라진다 — 네이티브 앱의 탭 상주보다 휘발성이 커진다.
> 파리티를 원하면 `sessionStorage` 백업 또는 서버 캐시(Redis/DB) 도입을 검토.

### 3.3 `dailyMessage.ts` — 하루 1문장, 40자 이내

```ts
// temperature 1.1, schema { message: string }
// prompt: `Write today's encouragement for ${date}. Make it feel personal and fresh.`
// Zod: z.string().trim().min(1).max(120)   ← 프롬프트는 40자를 요구하지만 검증은 120자
```

`getOrCreateDailyMessage()` = DB 캐시 우선, 없을 때만 생성. `refreshDailyMessage()` = 무조건 재생성.

### 3.4 `grammar.ts` — 문법 용어 설명

```ts
// temperature 0.3, systemInstruction: GRAMMAR_TEACHER_SYSTEM_PROMPT
// 응답 스키마: { summary, when_to_use, examples[3], nuance, common_mistakes[2-3] }
const prompt = [
  `문법 용어: ${term}`,
  context ? `\n학습자가 방금 본 문장/설명: "${context}"` : '',
  `\n"${term}"에 대해 설명해 주세요.`,
].filter(Boolean).join('\n');
```

```ts
// POST /api/grammar/explain   { term: string, context?: string }
// 서버가 먼저 grammarRepository.getByTerm(userId, term) 조회 → 있으면 AI 미호출
→ GrammarExplanation
```

---

## 4. 프롬프트 원문 (`src/constants/prompts.ts`)

**7개 시스템 프롬프트 전량을 `src/server/ai/prompts.ts` 로 이동한다.**
`import 'server-only'` 를 파일 최상단에 넣어 클라이언트 import를 빌드 타임에 차단한다.

| 상수 | 줄 수 | 핵심 규칙 요약 |
|---|---|---|
| `EVALUATION_SYSTEM_PROMPT` | 38 | 3기준 채점 / 한국어 피드백 / 추천 2-3개 / 각 추천에 뉘앙스·의역·문법 / **`grammar_terms` 배열에 사용한 용어를 텍스트와 철자까지 일치시켜 담을 것** / 마크업 금지 |
| `DAILY_SENTENCE_SYSTEM_PROMPT` | 13 | 정확히 3문장, 난이도 각 1개, 배정 주제 준수, 반말/해요체, "안녕하세요" 금지 |
| `DAILY_MESSAGE_SYSTEM_PROMPT` | 12 | 해요체 1문장 40자 이내, 이모지 정확히 1개, 노력·꾸준함 칭찬(성적 X), "화이팅" 반복 금지 |
| `REVIEW_SCORING_SYSTEM_PROMPT` | 12 | 점수 3개만. 피드백·수정·대안 **금지**. 같은 번역은 항상 같은 점수 |
| `TOPIC_SENTENCE_SYSTEM_PROMPT` | 15 | 정확히 4문장, easy1/medium2/hard1, 단일 주제 이탈 금지, 4문장이 서로 뚜렷이 달라야 함 |
| `GROUNDED_SENTENCE_SYSTEM_PROMPT` | 18 | 먼저 검색 → 실제 제목/이름/사건/가격을 담은 1문장. 뉴스 헤드라인 X, 구어체 O. 출처·링크 금지. JSON만 출력 |
| `GRAMMAR_TEACHER_SYSTEM_PROMPT` | 20 | 해요체, 용어 즉시 풀이, examples 정확히 3개(상황 서로 다르게), nuance는 교과서가 빼먹는 부분, common_mistakes 2-3개, **대괄호 사용 금지** |
| `TUTOR_CHAT_SYSTEM_PROMPT` | 24 | 해요체 산문 2-5문장, **마크다운·불릿·번호·대괄호 금지**, 원문 인용, 재채점 금지, 매 턴 인사 금지 |

> `GRAMMAR_TEACHER_SYSTEM_PROMPT` 의 "대괄호 금지"와 `TUTOR_CHAT` 의 "대괄호 금지"는
> `[[문법태그]]` 파서와의 충돌을 막기 위한 것이다. 임의로 완화하지 말 것.

---

## 5. Whisper STT (`src/services/whisper.ts`, 202줄)

### 5.1 현재 상태 — 기능 플래그로 OFF

```ts
// src/constants/features.ts
export const Features = { VOICE_INPUT_ENABLED: false } as const;
```

`free-input.tsx`, `settings.tsx` 가 이 플래그로 음성 UI 전체를 감싼다.
**마이그레이션 시에도 `false` 를 유지**하되, 코드 경로는 웹으로 포팅해 둔다.

### 5.2 파일 업로드 방식 전환

```ts
// [AS-IS] expo-file-system 의 File 객체를 Blob 처럼 전달 (RN WinterCG fetch 제약 회피)
if (Platform.OS === 'web') {
  const blob = await (await fetch(audioUri)).blob();
  const typed = blob.type ? blob : new Blob([blob], { type: mimeTypeFor(name) });
  formData.append('file', typed, name);
  return;
}
formData.append('file', new File(audioUri) as unknown as Blob);
```

웹 전용이 되면 **분기가 사라진다** — 위 코드의 web 브랜치만 남기면 된다.

```ts
// [TO-BE 클라이언트] MediaRecorder 결과 Blob 을 그대로 서버로
const form = new FormData();
form.append('file', recordedBlob, 'recording.webm');
const res = await fetch('/api/transcribe', { method: 'POST', body: form });
```

```ts
// [TO-BE 서버] app/api/transcribe/route.ts
export async function POST(req: Request) {
  const inbound = await req.formData();
  const file = inbound.get('file');
  if (!(file instanceof Blob)) return badRequest('missing file');
  if (file.size === 0) return badRequest('The recording is empty. Please record again.');
  if (file.size > MAX_AUDIO_BYTES) return badRequest('Recording is too long...');

  const outbound = new FormData();
  outbound.append('file', file, 'recording.webm');
  outbound.append('model', 'whisper-1');
  outbound.append('language', 'en');
  outbound.append('response_format', 'json');

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY!}` },  // Content-Type 설정 금지
    body: outbound,
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),   // 60초
  });
  // ...
}
```

### 5.3 에러 메시지 매핑 — 전량 보존

`messageForStatus()` 의 분기는 UX 자산이므로 그대로 서버로 옮긴다.

| 상태 | 메시지 |
|---|---|
| 401 | Invalid API key... → **웹에서는 문구 수정 필요** ("Settings"를 가리키면 안 됨) |
| 403 | not allowed to use Whisper... → 동일하게 수정 |
| 413 | Recording is too long. Please keep recordings under 25MB. |
| 429 + `insufficient_quota` | "Your OpenAI account has no credit left... waiting will not help." |
| 429 (그 외) | `retry-after` 헤더 파싱 → "wait about {N}s" |
| 500/502/503 | "OpenAI is having trouble right now." |

> 401/403 문구가 사용자에게 "설정에서 키를 확인하라"고 안내한다. 웹에서는 사용자가
> 키를 갖지 않으므로 **"일시적인 문제가 발생했어요. 잠시 후 다시 시도해 주세요."** 로
> 교체하고, 원래 원인은 서버 로그로만 남긴다.

상수 유지: `MAX_AUDIO_BYTES = 25MB`, `DEFAULT_TIMEOUT_MS = 60_000`, `MIME_BY_EXTENSION` 표.

---

## 6. 재시도 정책 (`src/utils/errors.ts`) — 그대로 이관

```ts
export async function withRetry<T>(fn, maxRetries = 2, delayMs = 1000): Promise<T> {
  // 재시도 하지 않는 경우:
  //  - ValidationError      (같은 입력이면 같은 실패)
  //  - ApiKeyMissingError   (설정 문제)
  //  - ApiResponseError 4xx (단, 429 는 재시도)
  // 백오프: delayMs * (attempt + 1) → 1s, 2s
}
```

`ApiKeyMissingError` 는 서버에서 **500 + 일반 메시지**로 변환한다. 사용자에게
"API 키가 설정되지 않았다"고 알릴 이유가 없다 (운영 실수 노출).

---

## 7. 결제: RevenueCat → Toss Payments

### 7.1 현재 구조 (`src/services/revenue.ts`, 196줄)

| 함수 | 반환 | 설계 의도 |
|---|---|---|
| `isBillingAvailable()` | boolean | 네이티브 모듈 + 키 둘 다 있어야 true |
| `initializeRevenue()` | Promise\<boolean\> | 멱등, 앱 시작 시 호출 |
| `fetchSubscriptionOptions()` | `SubscriptionOption[]` | 실패 시 **throw 대신 빈 배열** |
| `purchaseSubscription(option)` | `{status:'purchased'\|'cancelled'\|'failed'}` | **절대 throw 안 함**. 취소는 에러가 아님 |
| `restorePurchases()` | `boolean \| null` | `null` = 판정 불가 |
| `fetchPremiumStatus()` | `boolean \| null` | `null` = 판정 불가 |

**`null` 과 `false` 의 구분이 설계의 핵심**이다 (`useSubscription.nextPremiumState`):

```ts
export function nextPremiumState(reported: boolean | null | undefined, current: boolean) {
  if (reported === null || reported === undefined) return current;   // 네트워크 장애로
  return reported;                                                    // 유료회원 강등 금지
}
```

### 7.2 Toss Payments 이관

```ts
// src/lib/payments/tossPayments.ts  (클라이언트)
import { loadTossPayments } from '@tosspayments/tosspayments-sdk';

export async function purchaseSubscription(option: SubscriptionOption): Promise<PurchaseOutcome> {
  try {
    const toss = await loadTossPayments(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!);
    const payment = toss.payment({ customerKey });
    await payment.requestPayment({
      method: 'CARD',
      amount: { currency: 'KRW', value: option.price },
      orderId: crypto.randomUUID(),
      orderName: option.title,
      successUrl: `${origin}/payments/success`,
      failUrl: `${origin}/payments/fail`,
    });
    return { status: 'purchased' };            // 실제 확정은 서버 승인 후
  } catch (error) {
    // 사용자가 결제창을 닫은 경우 = cancelled. 에러 표시 금지 (원본 규약 유지)
    if (isUserCancelled(error)) return { status: 'cancelled' };
    return { status: 'failed', message: '결제에 실패했어요.' };
  }
}
```

```
POST /api/payments/confirm   { paymentKey, orderId, amount }
  1. Toss 결제 승인 API 호출 (Basic {base64(SECRET_KEY + ':')})
  2. amount 검증 — 클라이언트가 보낸 금액을 신뢰하지 말고 주문 원장과 대조
  3. users.isPremium = true, premiumExpiresAt = now + 기간
  4. → { isPremium: true }

GET  /api/payments/status
  → { isPremium: boolean }        // fetchPremiumStatus() 대체
  // 판정 불가 상황은 5xx 로 응답 → 클라이언트가 null 로 해석해 강등하지 않음

POST /api/payments/restore
  → { restored: boolean | null }  // Toss 는 "복원" 개념이 없으므로
                                  // users 테이블의 CI 기준 구독 이력 조회로 구현
```

### 7.3 `SubscriptionOption` 어댑터

UI(`Paywall.tsx`)는 RevenueCat 타입을 직접 만지지 않도록 이미 평탄화되어 있다.
이 인터페이스를 **그대로 유지**하면 Paywall 컴포넌트 로직 변경이 최소화된다.

```ts
export interface SubscriptionOption {
  id: string;
  period: 'monthly' | 'annual' | 'other';
  priceString: string;   // "₩4,900" — 서버에서 Intl.NumberFormat('ko-KR') 로 포맷
  price: number;         // 4900 — annualSavings() 계산용
  title: string;
  pkg: ...;              // ← RevenueCat 전용. Toss 에서는 상품 코드로 대체
}
```

`annualSavings(options)` (`useSubscription.ts:113`)는 `price` 숫자만 쓰므로 무변경 동작한다.

### 7.4 필수 정책 확인
- 토스 미니앱 내 디지털 구독 결제는 **토스 정책 심사 대상**이다. 상품 등록·심사 절차를 선행할 것.
- 자동 갱신 구독은 빌링키(자동결제) 연동이 별도로 필요하다. 1회성 기간제 결제로 시작할지 결정 필요.

---

## 8. 광고: AdMob → Web Ads

### 8.1 현재 계약 (`src/services/ads.ts`)

```ts
export type AdOutcome = 'rewarded' | 'dismissed' | 'unavailable';
```

이 3값 계약이 `useAdGate` 와 `QuotaExceededModal` 전체를 지배한다. **반드시 보존**한다.

핵심 정책 (`useAdGate.ts` 주석):
> "when no ad can be served at all — Expo Go, web, no network, no fill — the action
> is let through anyway. Failing closed would make the app unusable whenever the ad
> network is down."

즉 `unavailable` 이면 **광고 없이 통과시킨다.** 웹 광고가 불안정할 것을 감안하면
이 관대한 정책은 더욱 중요하다.

### 8.2 웹 구현

```ts
// src/lib/ads/webRewarded.ts
export async function showRewardedAd(): Promise<AdOutcome> {
  if (!isAdsConfigured()) return 'unavailable';
  try {
    return await new Promise<AdOutcome>((resolve) => {
      const timer = setTimeout(() => resolve('unavailable'), AD_LOAD_TIMEOUT_MS); // 12s 유지
      openRewardedSheet({
        onEarned:    () => { clearTimeout(timer); resolve('rewarded'); },
        onDismissed: () => { clearTimeout(timer); resolve('dismissed'); },
        onError:     () => { clearTimeout(timer); resolve('unavailable'); },
      });
    });
  } catch { return 'unavailable'; }
}
```

옵션 비교:

| 방식 | 보상형 지원 | 비고 |
|---|---|---|
| Google AdSense | 웹 보상형 광고 제한적 | 정책상 인앱 WebView 게재 가능 여부 확인 필요 |
| Toss Ads | ✅ 미니앱 네이티브 연동 | 토스 파트너 문의 필요. **1순위 권장** |
| 자체 타이머 + 제휴 배너 | 15초 타이머 후 `rewarded` | 임시 대체안. `AD_LOAD_TIMEOUT_MS` 재활용 |

### 8.3 `AdBanner` 특수 요건 3가지 (반드시 이관)

```ts
// 1. 프리미엄이면 렌더링 자체를 안 함 (빈 박스도 아님)
// 2. 한 번 실패하면 세션 내내 숨김 — "Retrying a no-fill on a loop costs battery"
// 3. 키보드가 올라오면 숨김 — "An ad directly above an open keyboard is the classic
//    accidental-tap layout, and accidental taps are what gets an AdMob account flagged"
if (isPremium || failed || keyboardVisible || !banner) return null;
```

웹에서 3번은 `visualViewport.resize` 로 대체한다. 광고 정책 위반 리스크는
웹 광고망에서도 동일하므로 **반드시 유지**한다.

### 8.4 폐기되는 것
`src/constants/ads.ts` 의 AdMob 테스트/실 유닛 ID 표(`TEST_REWARDED`, `TEST_BANNER`,
`pickUnit`, `rewardedAdUnitId`, `bannerAdUnitId`)는 전부 삭제.
`AD_LOAD_TIMEOUT_MS = 12_000` 만 남긴다.

---

## 9. 서버 쿼터 강제 (신설)

클라이언트 `useGatedAction` 은 **UX 장치일 뿐 보안 경계가 아니다.**
BFF 이관 후에는 서버가 최종 판정한다.

```ts
// src/server/quota.ts
import { QUOTA_FEATURES, type QuotaFeature } from '@/constants/monetization';  // 그대로 재사용

export async function consumeQuota(userId: number, feature: QuotaFeature) {
  const today = kstToday();
  const { countKey, limit } = QUOTA_FEATURES[feature];

  return db.transaction(async (tx) => {
    const user = await tx.query.users.findFirst({ where: eq(users.id, userId) });
    if (user?.isPremium) return { allowed: true, remaining: Infinity };

    // 오늘 행이 없으면 생성 = 자동 롤오버 (usageForToday() 의 서버판)
    const [row] = await tx.insert(userQuotas)
      .values({ userId, quotaDate: today })
      .onConflictDoNothing({ target: [userQuotas.userId, userQuotas.quotaDate] })
      .returning();

    const current = row ?? await tx.query.userQuotas.findFirst({ /* userId + today */ });
    if (current[countKey] >= limit) {
      return { allowed: false, remaining: 0 };
    }

    await tx.update(userQuotas)
      .set({ [countKey]: current[countKey] + 1, updatedAt: new Date() })
      .where(eq(userQuotas.id, current.id));

    return { allowed: true, remaining: limit - current[countKey] - 1 };
  });
}
```

**순서 규약 (원본 `useQuota.ts` 주석과 동일하게 유지):**

```
check quota → (평가류만) 광고 → 실행 → consume
```

> "Quota is checked first so a user with nothing left never sits through an ad for
> an action that was going to be refused. Quota is consumed last so a failed API
> call — or an ad the user backed out of — costs them nothing."

서버 라우트에서도 동일하게 **AI 호출이 성공한 뒤에 차감**한다.

광고 보상 라우트:

```
POST /api/quota/ad-view   { feature }
  // 클라이언트가 'rewarded' 를 받았다고 주장하는 것을 서버가 검증할 수단이 필요.
  // Toss Ads/AdSense 의 SSV(Server-Side Verification) 콜백을 사용할 것.
  // 검증 없이 신뢰하면 무한 쿼터 획득이 가능하다.
  → { granted: boolean, progress: number, required: 2 }
```

> 원본은 `recordAdView` 를 클라이언트가 직접 호출한다(조작 가능). 서버 이관 시
> **SSV 도입은 선택이 아니라 필수**다.

---

## 10. 체크리스트

- [ ] `src/server/ai/` 신설 + `import 'server-only'` (gemini/prompts/schemas)
- [ ] 프롬프트 7종 원문 그대로 이동, 클라이언트 번들에서 완전 제거
- [ ] 모델 인스턴스 6종의 temperature (0.2/0.3/0.7/1.0/1.1) 정확히 보존
- [ ] `tagGrammarTerms()` 파이프라인 서버 재현 + `grammarTags.ts` isomorphic 배치
- [ ] `topicSentences` 2-phase `Promise.allSettled` + 그라운딩 폴백 로직 보존
- [ ] `parseGroundedJson()` 코드펜스 제거 로직 보존
- [ ] Zod 스키마 5종(`types/*.ts`) 서버 검증에 재사용
- [ ] `withRetry` 재시도 제외 규칙 보존 (429만 재시도)
- [ ] Whisper 에러 메시지 표 이관 + 401/403 문구를 웹용으로 교체
- [ ] `AdOutcome` 3값 계약 + `unavailable = 통과` 정책 보존
- [ ] `AdBanner` 3대 숨김 조건(프리미엄/실패/키보드) 보존
- [ ] `nextPremiumState` 의 `null ≠ false` 규약 보존
- [ ] 서버 쿼터 강제 + 광고 SSV 도입
- [ ] 튜터 챗·문법 설명에 레이트 리밋 신설 (원본에 쿼터 없음)
