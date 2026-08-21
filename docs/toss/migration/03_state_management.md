# 03. 상태 관리 마이그레이션 설계서 (Zustand + TanStack Query)

> 대상 원본: `src/stores/*.ts` (4파일 381줄) · `src/hooks/*.ts` (20파일 1,050줄)
> · `src/providers/QueryProvider.tsx` · `src/constants/monetization.ts` (89줄)
> · `src/utils/calendar.ts` · `src/utils/streak.ts`

**좋은 소식**: 이 계층은 React Native 의존성이 거의 없다. 20개 훅 중 **17개는
import 경로만 바꾸면 그대로 동작**한다. 진짜 작업은 스토어 2개(설정·수익화)에 집중된다.

---

## 1. 전체 이관 난이도 표

| 파일 | 줄 | RN 의존 | 난이도 | 핵심 변경 |
|---|---|---|---|---|
| `stores/useInputStore.ts` | 47 | 없음 | 🟢 복붙 | — |
| `stores/useRecordingStore.ts` | 33 | 없음 | 🟢 복붙 | `audioUri` 가 `blob:` URL 이 됨 |
| `stores/useSettingsStore.ts` | 66 | SecureStore | 🔴 재설계 | **API 키 필드 전면 삭제** |
| `stores/useMonetizationStore.ts` | 235 | SecureStore | 🔴 재설계 | 서버 권위로 전환 |
| `hooks/useQuota.ts` | 86 | 없음 | 🟡 | 서버 응답 반영 |
| `hooks/useAdGate.ts` | 51 | services/ads | 🟡 | 웹 광고 어댑터 |
| `hooks/useSubscription.ts` | 122 | services/revenue | 🟡 | Toss Payments |
| `hooks/useTranscription.ts` | 16 | services/whisper | 🟡 | Blob 업로드 |
| `hooks/useEvaluation.ts` | 68 | repositories | 🟡 | repo → fetch |
| `hooks/useAttendanceCalendar.ts` | 186 | 없음 | 🟢 복붙 | 순수 로직 |
| `hooks/useTutorChat.ts` | 106 | 없음 | 🟢 복붙 | |
| `hooks/useTopicSentences.ts` | 50 | 없음 | 🟢 복붙 | |
| 나머지 훅 9개 | ~250 | repositories | 🟡 | repo → fetch |
| `providers/QueryProvider.tsx` | 18 | 없음 | 🟡 | SSR 대응 |

---

## 2. Zustand 스토어 4종

### 2.1 `useInputStore` — 무변경 이관

화면 간에 "무엇을 번역할지"를 옮기는 임시 버스다.

```ts
interface InputState {
  inputMethod: 'voice' | 'text';
  source: 'daily' | 'topic' | 'free';    // ← 어떤 평가 쿼터를 쓸지 결정
  koreanText: string;
  englishText: string;
  isSubmitting: boolean;
  dailySentenceId: number | null;
  // setters + reset
}
```

`source` 의 역할 (`constants/monetization.ts`):

```ts
export function evaluationFeatureFor(source: 'daily' | 'topic' | 'free'): QuotaFeature {
  if (source === 'topic') return 'topicPracticeEvaluation';
  return 'dailySentenceEvaluation';       // free 는 daily 풀에 합류
}
```

#### ⚠️ 웹 전환의 유일한 진짜 리스크

네이티브에서 `free-input` 은 **탭 화면이라 항상 마운트 상태**다. 그래서
`index.tsx` 가 스토어를 세팅하고 `router.push('/free-input')` 하면 값이 살아 있다.

Next.js 에서는 페이지 이동 시 컴포넌트가 언마운트/리마운트되지만,
**Zustand 스토어는 모듈 스코프라 살아남는다.** 따라서 동작은 유지된다.

다만 **새로고침(F5) 하면 스토어가 비어 `/practice` 가 빈 화면**이 된다.
네이티브에는 없던 상황이므로 대책이 필요하다.

**권고: 라우트 파라미터로 승격 + 스토어는 보조**

```ts
// index.tsx 카드 탭 → /practice?sentenceId=42&source=daily
router.push(`/practice?sentenceId=${s.id}&source=daily`);

// topics.tsx 문장 탭 → 한국어 문장은 길어서 쿼리에 부적합 → 스토어 유지 + sessionStorage 백업
```

```ts
// practice/page.tsx
const params = useSearchParams();
const sentenceId = Number(params.get('sentenceId')) || null;
const koreanText = useInputStore((s) => s.koreanText);

// 스토어가 비었고 sentenceId 도 없으면 = 직접 URL 진입. 홈으로 되돌린다.
useEffect(() => {
  if (!koreanText && !sentenceId) router.replace('/');
}, [koreanText, sentenceId, router]);
```

### 2.2 `useRecordingStore` — 사실상 무변경

```ts
{ isRecording: boolean; audioUri: string | null; duration: number }
```

`audioUri` 는 네이티브에서 `file:///...m4a`, 웹에서 `URL.createObjectURL(blob)` 의
`blob:` URL 이 된다. 스토어 자체는 문자열만 담으므로 코드 변경 없음.

**추가 필요**: `blob:` URL 은 명시적으로 해제해야 메모리가 회수된다.

```ts
resetRecording: () => set((state) => {
  if (state.audioUri?.startsWith('blob:')) URL.revokeObjectURL(state.audioUri);
  return { isRecording: false, audioUri: null, duration: 0 };
}),
```

### 2.3 `useSettingsStore` — 🔴 대폭 축소

```ts
// [AS-IS] 3개 값 × SecureStore
{
  openaiApiKey: string | null;      // ← 삭제
  geminiApiKey: string | null;      // ← 삭제
  preferredInputMethod: 'voice' | 'text';
  isLoaded: boolean;
  loadSettings(); setApiKey(); setPreferredInputMethod();
}
```

API 키는 서버 환경변수로 이동했으므로(02 문서 §0) 클라이언트에 남길 이유가 없다.
`gemini.requireGeminiApiKey()` 와 `whisper.transcribe()` 의 스토어 참조도 함께 사라진다.

```ts
// [TO-BE] localStorage 기반, persist 미들웨어로 단순화
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SettingsState {
  preferredInputMethod: 'voice' | 'text';
  setPreferredInputMethod: (m: 'voice' | 'text') => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      preferredInputMethod: 'text',
      setPreferredInputMethod: (m) => set({ preferredInputMethod: m }),
    }),
    {
      name: 'lll:settings',
      storage: createJSONStorage(() => localStorage),
      // SSR 하이드레이션 불일치 방지 — 서버에서는 항상 기본값으로 렌더
      skipHydration: true,
    }
  )
);
```

> `isLoaded` / `loadSettings()` 는 `persist` 가 대체한다. 단 `skipHydration: true` 를
> 쓰면 클라이언트에서 `useSettingsStore.persist.rehydrate()` 를 한 번 호출해야 한다
> (`app/providers.tsx` 의 `useEffect`).

**연쇄 삭제 대상**: `settings.tsx` 의 API 키 입력 UI (현재는 존재하지 않고 토글만
있으나, `Features.VOICE_INPUT_ENABLED` 가 false 라 입력 방식 토글도 렌더되지 않는다).

### 2.4 `useMonetizationStore` — 🔴 서버 권위로 전환

이 235줄이 상태 계층에서 가장 중요한 파일이다.

#### 보존해야 할 설계 4가지

**(1) 자정 롤오버를 "읽을 때마다" 수행**

```ts
export function usageForToday(usage: DailyUsage): DailyUsage {
  return usage.date === todayKey() ? usage : emptyUsage();
}
```

주석의 근거:
> "tab screens stay mounted — the app can sit open across midnight and must hand
> back a fresh allowance without a relaunch."

웹에서는 탭을 며칠씩 열어두는 경우가 더 흔하므로 **더 중요해진다.**

**(2) 보너스는 별도 필드가 아니라 "카운터 차감"**

```ts
grantBonus: (feature, tries) => {
  const usage = usageForToday(get().dailyUsage);
  set({ dailyUsage: { ...usage, [countKey]: Math.max(0, usage[countKey] - tries) } });
}
```

주석:
> "Bonus tries are stored as a discount on the counter, so they expire with the
> day like everything else and need no second field to persist."

**서버 스키마(`user_quotas`)도 이 방식을 그대로 따른다** — 보너스 컬럼을 추가하지 말 것.

**(3) 광고 진행도는 임계값 미만으로 클램프**

```ts
views[feature] = Math.min(Math.floor(n), ADS_PER_BONUS - 1);
```

주석:
> "A stored value at or above the threshold would be a free bonus waiting to be
> claimed by editing the blob."

`localStorage` 는 SecureStore 보다 조작이 쉬우므로 이 방어는 **유지하되, 진짜 방어는
서버에서** 한다.

**(4) 기능 테이블 기반 방어적 파싱**

```ts
QUOTA_FEATURE_LIST.forEach((feature) => {
  const n = raw[QUOTA_FEATURES[feature].countKey];
  usage[countKey] = typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
});
```

기능이 추가/이름변경되어도 저장된 blob 이 앱을 깨뜨리지 않는다. 그대로 유지.

#### 신규 구조

```ts
interface MonetizationState {
  isPremium: boolean;
  dailyUsage: DailyUsage;      // 서버 응답의 로컬 미러 (표시 전용)
  adViews: AdViews;
  isLoaded: boolean;

  /** 서버 스냅샷으로 통째 교체. loadMonetization() 대체. */
  hydrateFromServer: (snapshot: QuotaSnapshot) => void;
  setPremium: (value: boolean) => void;
  /** 낙관적 반영. 서버 응답이 오면 hydrateFromServer 가 정정한다. */
  consume: (feature: QuotaFeature) => void;
  grantBonus: (feature: QuotaFeature, tries: number) => void;
  recordAdView: (feature: QuotaFeature) => AdViewResult;
  hasQuota: (feature: QuotaFeature) => boolean;
  resetUsage: () => void;      // 개발자 도구용. 프로덕션에서는 서버가 거부
}
```

`SecureStore.setItemAsync` 로 저장하던 `save()` 는 삭제한다. 대신:

- **읽기**: `GET /api/quota` → `hydrateFromServer()`
- **쓰기**: 각 AI 라우트가 성공 시 응답 헤더/본문에 최신 쿼터를 실어 보냄

```ts
// 예: POST /api/evaluate 응답
{ evaluationId: 123, response: {...}, quota: { dailySentenceEvaluationCount: 3, ... } }
```

이렇게 하면 별도 왕복 없이 미러가 항상 서버와 일치한다.

#### `todayKey()` 의 타임존

```ts
export function todayKey(): string { return format(new Date(), 'yyyy-MM-dd'); }
```

브라우저 로컬 타임존이다. 서버가 KST 로 판정하므로 **클라이언트도 KST 로 고정**한다.

```ts
export function todayKey(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
  // en-CA 로케일이 YYYY-MM-DD 를 준다
}
```

> 이 함수는 `useDailySentences.todayKey()` 에도 중복 정의되어 있다
> (`hooks/useDailySentences.ts:8`). **`src/lib/date.ts` 로 통합**할 것.
> 현재 `useDailyMessage`, `useRecordVisit` 가 훅 쪽 버전을,
> `useMonetizationStore` 가 스토어 쪽 버전을 import 하고 있다.

---

## 3. TanStack Query 설정

### 3.1 QueryProvider — SSR 대응 추가

```ts
// [AS-IS] 모듈 스코프 싱글턴
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60 * 5, retry: 1 },
    mutations: { retry: 0 },
  },
});
```

Next.js 에서 모듈 스코프 싱글턴은 **서버에서 요청 간 캐시가 공유되어 데이터가 샌다.**

```ts
// [TO-BE]
'use client';
export function QueryProvider({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        retry: 1,
        // WebView 는 백그라운드 복귀가 잦다. 원본에 없던 옵션이지만
        // 네이티브의 "탭 상주" 감각을 재현하려면 끄는 편이 가깝다.
        refetchOnWindowFocus: false,
      },
      mutations: { retry: 0 },
    },
  }));
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

### 3.2 쿼리 키 전체 목록 (실측)

| 키 | 정의 위치 | staleTime | 특이사항 |
|---|---|---|---|
| `['dailySentences', today]` | `useDailySentences` | `Infinity` | 하루 안에서는 안 바뀜 |
| `['dailyMessage', today]` | `useDailyMessage` | `Infinity` | `retry: false` (장식용) |
| `['stats']` | `useStats` | 기본 5분 | 5개 쿼리 `Promise.all` |
| `['recentEvaluations', limit]` | `useRecentEvaluations` | 기본 | **현재 호출자 없음** |
| `['evaluation', id]` | `useEvaluationResult` | 기본 | `enabled: id > 0` |
| `['evaluation', 'forSentence', id]` | `useLatestEvaluationForSentence` | 기본 | |
| `['completedSentences', texts]` | `useCompletedSentences` | 기본 | 키에 **정렬·중복제거된 배열** |
| `['reviewCards', 'due']` | `useReviewCards` | 기본 | |
| `['reviewCards', 'forEvaluation', id]` | `useReviewCardForEvaluation` | 기본 | |
| `['reviewAttempts', cardId]` | `useReviewAttempts` | 기본 | |
| `['topicSentences', topic]` | `useTopicSentences` | `Infinity` + `gcTime: Infinity` | **`enabled: false`** |
| `['grammar','explanation',term]` | `useGrammarExplanation` | `Infinity` + `gcTime: Infinity` | |
| `['grammar','notes']` | `useGrammarNotes` | 기본 | |
| `['grammar','note',term]` | `useSavedGrammarNote` | 기본 | |
| `['subscription','status']` | `useSubscription` | 5분 | `retry: false` |
| `['subscription','options']` | `useSubscriptionOptions` | 5분 | `enabled: 페이월 열림` |

### 3.3 무효화 그래프 (실측)

```
useEvaluation.onSuccess
  ├─ ['dailySentences']              완료 배지 갱신
  ├─ ['recentEvaluations']
  ├─ ['evaluation','forSentence']    재진입 시 최신 시도 표시
  ├─ ['completedSentences']          토픽 "연습함" 배지
  ├─ ['reviewCards']
  └─ ['stats']

useRefreshDailySentences.onSuccess
  ├─ ['dailySentences']
  └─ ['dailyMessage']

useSubmitReviewAttempt.onSuccess
  ├─ ['reviewAttempts', cardId]
  └─ ['stats']

useToggleReviewBookmark.onSuccess  → ['reviewCards']
useDeleteReviewCard.onSuccess      → ['reviewCards']
useSaveGrammarNote / useDeleteGrammarNote → ['grammar']   (prefix 전체)
useRecordVisit (성공 시)            → ['stats']
useSubscription.purchase/restore   → ['subscription','status']
```

**이 그래프는 그대로 유지한다.** 서버 상태로 바뀌어도 무효화 대상은 동일하다.

`useMonetizationStore` 가 서버 권위가 되면 **쿼터 키를 하나 추가**해야 한다:

```ts
// 신규
['quota']  ← GET /api/quota
// 무효화: 모든 쿼터 소모 뮤테이션의 onSuccess 에 추가
```

---

## 4. 훅 20종 개별 이관 명세

### 4.1 🟢 무변경 (순수 로직) — 4개

| 훅 | 이유 |
|---|---|
| `useAttendanceCalendar` (186줄) | `utils/calendar.ts` 순수 함수만 사용. UTC 날짜 연산, 뷰 상태(`week`/`month`/`picker`), 클램핑 로직 전부 플랫폼 무관 |
| `useTutorChat` (106줄) | `useState`/`useRef` + 서비스 호출. **렌더 중 상태 조정** 패턴(`contextKey !== renderedContextKey`) 포함 — React 정석이므로 그대로 |
| `useTopicSentences` (50줄) | queryClient 조작만 |
| `useCompletedSentences` (30줄) | `useMemo` 로 키 정규화 |

`useAttendanceCalendar` 의 `MIN_BROWSABLE_MONTHS = 12` 와 UTC 고정 근거:
> "All arithmetic runs in UTC to match `calculateStreak` — stepping a local `Date`
> by a day drifts across a DST boundary"

한국은 DST가 없어 실질 영향은 없으나, **UTC 일관성을 깨면 안 된다.**
단 `today` 를 넘겨주는 쪽(`useStats`)이 KST 로 바뀌므로 그 접점만 확인할 것.

### 4.2 🟡 repository → fetch — 9개

패턴은 전부 동일하다.

```ts
// [AS-IS]
queryFn: () => evaluationRepository.getById(id),

// [TO-BE]
queryFn: () => api.get<StoredEvaluation>(`/api/evaluations/${id}`),
```

```ts
// src/lib/api/client.ts — 공용 fetch 래퍼
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    credentials: 'include',        // Toss 세션 쿠키
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message ?? '요청을 처리하지 못했어요.');
  }
  return res.json();
}
```

대상: `useEvaluationResult`, `useLatestEvaluationForSentence`, `useRecentEvaluations`,
`useReviewCards`, `useDeleteReviewCard`, `useReviewCardForEvaluation`,
`useToggleReviewBookmark`, `useReviewAttempts`, `useGrammar*`(4개), `useStats`, `useRecordVisit`.

#### `useStats` 는 서버에서 한 번에 계산

```ts
// [AS-IS] 클라이언트가 5개 쿼리를 Promise.all 하고 스트릭까지 계산
const [{ total, averageScore }, practiceDates, visitDates, uniqueSentences, totalReviews] =
  await Promise.all([...]);
const activeDates = [...new Set([...visitDates, ...practiceDates])].sort().reverse();
return { total, averageScore, uniqueSentences, totalReviews,
         streak: calculateStreak(activeDates, today), activeDates, today };
```

```ts
// [TO-BE] GET /api/stats 가 동일한 shape 을 반환
// 왕복 5회 → 1회. calculateStreak 는 서버로 이동(utils/streak.ts 는 isomorphic)
```

반환 shape(`total`, `averageScore`, `uniqueSentences`, `totalReviews`, `streak`,
`activeDates`, `today`)은 `StatsPanel`, `StreakBadge`, `AttendanceCalendar` 가
의존하므로 **한 필드도 바꾸지 말 것**.

### 4.3 🔴 재설계 — 3개

#### `useQuota.useGatedAction` — 순서 규약 유지 + 서버 확인

```ts
// 실행 순서 (원본 주석 그대로):
//   check quota → (evaluations only) show ad → run the action → consume
const run = useCallback(async (action: () => Promise<unknown>): Promise<boolean> => {
  if (!check()) return false;                       // 1. 로컬 선검사 (UX)

  const execute = async () => {
    await action();                                  // 3. 서버가 최종 판정 + 차감
    consume();                                       // 4. 로컬 미러 갱신
    return true;
  };

  if (!adGated || isPremium) return execute();
  return (await runBehindAd(execute)) ?? false;      // 2. 광고
}, [...]);
```

**변경점**: 서버가 429(쿼터 초과)를 반환하면 로컬 미러가 어긋난 것이므로
모달을 띄우고 `['quota']` 를 무효화한다.

```ts
const execute = async () => {
  try {
    const result = await action();
    consume();
    return true;
  } catch (error) {
    if (error instanceof ApiError && error.status === 429) {
      setBlocked(true);                              // QuotaExceededModal
      queryClient.invalidateQueries({ queryKey: ['quota'] });
      return false;
    }
    throw error;                                     // 그 외 에러는 호출자에게
  }
};
```

반환 인터페이스(`{ feature, isPremium, limit, used, remaining, isShowingAd, showsAd,
run, check, consume, modal }`)는 5개 화면이 쓰므로 **불변 유지**.

#### `useAdGate` — 웹 광고 어댑터

로직 자체는 무변경. `showRewardedAd` import 만 `@/lib/ads/webRewarded` 로 교체.

보존할 정책 2가지:
- `isPremium` 이면 `requestAd()` 가 즉시 `'unavailable'` 반환 (광고 안 봄)
- `inFlight` ref 로 더블탭 차단

```ts
const runBehindAd = async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
  if (!isPremium) {
    const outcome = await requestAd();
    if (outcome === 'dismissed') return undefined;   // 'unavailable' 은 통과!
  }
  return action();
};
```

#### `useSubscription` — Toss Payments

`nextPremiumState()` 의 `null ≠ false` 규약(02 문서 §7.1)을 그대로 유지한다.
`isAvailable` 은 `isBillingAvailable()` → **웹에서는 항상 true** (또는 Toss SDK 로드 여부).

```ts
// annualSavings() 는 순수 함수 — 무변경
export function annualSavings(options: SubscriptionOption[]): number | null {
  const monthly = options.find((o) => o.period === 'monthly');
  const annual  = options.find((o) => o.period === 'annual');
  if (!monthly || !annual || monthly.price <= 0) return null;
  const percent = Math.round((1 - annual.price / (monthly.price * 12)) * 100);
  return percent > 0 ? percent : null;
}
```

### 4.4 `useEvaluation` — 뮤테이션 단일화

```ts
// [AS-IS] 클라이언트가 3단계를 조율
//   1. evaluate()                        Gemini
//   2. evaluationRepository.saveComplete() 트랜잭션
//   3. sentenceRepository.markCompleted()

// [TO-BE] 서버 라우트 1회 호출로 3단계 전부 수행
mutationFn: (input: EvaluationInput) =>
  apiFetch<{ evaluationId: number; response: EvaluationResponse }>('/api/evaluate', {
    method: 'POST',
    body: JSON.stringify(input),
  }),
```

`onSuccess` 의 무효화 6개(§3.3)는 **그대로 유지** + `['quota']` 추가.

### 4.5 `useRecordVisit` — 마운트 시 1회

```ts
useEffect(() => {
  let cancelled = false;
  visitRepository.recordVisit(todayKey())
    .then(() => { if (!cancelled) queryClient.invalidateQueries({ queryKey: ['stats'] }); })
    .catch(() => {/* 출석은 부가 기능 — 절대 화면을 막지 않는다 */});
  return () => { cancelled = true; };
}, [queryClient]);
```

**웹에서 주의**: React 18 StrictMode 는 개발 모드에서 effect 를 2번 실행한다.
`recordVisit` 은 `onConflictDoNothing` 이라 멱등하므로 안전하지만,
POST 가 2번 나가는 것은 확인해 둘 것.

`todayKey()` 를 KST 로 통일(§2.4)해야 출석일과 서버 판정이 일치한다.

### 4.6 `useTranscription`

```ts
mutationFn: (audioUri: string) => transcribe(audioUri),
onSuccess: (text) => setEnglishText(text),      // useInputStore 자동 채움
```

웹에서는 `audioUri`(blob URL) 대신 **Blob 을 직접** 넘기는 편이 낫다.

```ts
mutationFn: async (blob: Blob) => {
  const form = new FormData();
  form.append('file', blob, 'recording.webm');
  const res = await fetch('/api/transcribe', { method: 'POST', body: form });
  if (!res.ok) throw new ApiError(res.status, (await res.json()).message);
  return (await res.json()).text as string;
},
```

---

## 5. 복습 due 로직 — 의사결정 필요

00 문서에서 지적한 사항의 처리 방침:

```
reviewRepository.create()          → nextReviewDate = today
reviewRepository.updateAfterReview() → 호출자 0개
reviewRepository.getDueCards()     → where nextReviewDate <= today
∴ 모든 카드가 매일 전부 due
```

| 옵션 | 내용 | 권고 |
|---|---|---|
| A. 그대로 이관 | 동작 100% 동일. 사용자 체감 변화 0 | ✅ **1차 마이그레이션은 A** |
| B. SM-2 구현 | `ReviewAttemptPanel` 채점 후 `updateAfterReview` 호출 | 마이그레이션 완료 후 별도 과제 |

100% 파리티가 목표이므로 **A를 채택**하고, `updateAfterReview()` 는 미사용 상태로
그대로 옮기되 주석에 "현재 호출자 없음 — SM-2 미구현" 을 명시한다.

---

## 6. 앱 부팅 시퀀스 재구성

```ts
// [AS-IS] app/_layout.tsx
useFonts(...)                    → SplashScreen.hideAsync()
loadSettings()                   → SecureStore 3키 읽기
loadMonetization()               → SecureStore blob 읽기
initializeAds()                  → AdMob SDK
initializeRevenue()              → RevenueCat SDK
<SafeAreaProvider>
  <DatabaseProvider>             → useMigrations, 로딩 UI
    <QueryProvider>
      <SubscriptionSync />       → useSubscription() 렌더 없음
```

```tsx
// [TO-BE] app/layout.tsx (Server Component) + app/providers.tsx (Client)
export default function RootLayout({ children }) {
  return (
    <html lang="ko" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

```tsx
// app/providers.tsx
'use client';
export function Providers({ children }: PropsWithChildren) {
  return (
    <QueryProvider>
      <TossAuthProvider>     {/* Toss SDK 로 CI/DI 획득 → /api/auth/session */}
        <BootstrapGate>      {/* GET /api/quota + /api/payments/status 로 스토어 하이드레이트 */}
          {children}
        </BootstrapGate>
      </TossAuthProvider>
    </QueryProvider>
  );
}
```

| AS-IS 단계 | TO-BE |
|---|---|
| `useFonts` + SplashScreen | `next/font` (FOUT 없음, 코드 불필요) |
| `DatabaseProvider` | **삭제** |
| `loadSettings()` | `persist.rehydrate()` (preferredInputMethod 만) |
| `loadMonetization()` | `GET /api/quota` → `hydrateFromServer()` |
| `initializeAds()` | 웹 광고 스크립트 주입 (`next/script`, `strategy="lazyOnload"`) |
| `initializeRevenue()` | `loadTossPayments()` 지연 로드 |
| `<SubscriptionSync />` | `BootstrapGate` 내부 `useSubscription()` |
| `SafeAreaProvider` | CSS `env(safe-area-inset-*)` |

**보존할 부팅 규약** (`_layout.tsx` 주석):
> "Quotas start full until this resolves, so a metered action fired in the first
> frames is allowed — a rare over-grant beats blocking a paying user."

서버가 최종 판정하므로 이 낙관적 초기값은 이제 **안전하게** 유지할 수 있다.

---

## 7. 체크리스트

- [ ] `useInputStore` / `useRecordingStore` 그대로 이관 + `revokeObjectURL` 추가
- [ ] `useSettingsStore` 에서 API 키 2필드 **삭제**, `persist(localStorage)` 로 전환
- [ ] `useMonetizationStore` 를 서버 스냅샷 미러로 전환 (`save()` 삭제)
- [ ] 보너스 = 카운터 차감 방식 유지 (별도 필드 신설 금지)
- [ ] `usageForToday()` 읽기 시 롤오버 유지
- [ ] `todayKey()` 중복 정의 2곳 → `src/lib/date.ts` 통합 + **KST 고정**
- [ ] `QueryClient` 를 `useState` 로 요청별 생성 (SSR 캐시 누수 방지)
- [ ] 쿼리 키 16종 + 무효화 그래프 그대로 유지, `['quota']` 추가
- [ ] `useGatedAction` 반환 인터페이스 불변 유지 + 429 처리 추가
- [ ] `runBehindAd` 의 `unavailable = 통과` 정책 유지
- [ ] `nextPremiumState` 의 `null ≠ false` 유지
- [ ] `useStats` 반환 shape 7필드 불변 유지 (서버 계산으로 이동)
- [ ] `/practice` 직접 진입 시 홈 리다이렉트 가드 추가
- [ ] `updateAfterReview()` 미사용 상태로 이관 + 주석 명시
