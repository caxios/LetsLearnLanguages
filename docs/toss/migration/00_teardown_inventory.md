# 00. 코드베이스 완전 해체 명세 (Exhaustive Teardown)

> 이 문서는 `LetsLearnLanguages` (Expo SDK 57 / React Native 0.86) 프로젝트의
> `src/` · `app/` 전체 **118개 파일, 14,907줄**을 건너뛰지 않고 읽은 뒤 작성한
> 실측 기반 해체 명세다. 추측이나 요약이 아니라 **실제 코드에서 확인한 사실만** 기록한다.
>
> 마이그레이션 대상: **Toss App-in-App (WebView 기반 미니앱)**
> - Frontend: Next.js (App Router) + Tailwind CSS ← Expo + NativeWind
> - Backend: Next.js API Routes (BFF) + Supabase(PostgreSQL) + Drizzle ← 로컬 SQLite
> - Auth: Toss Mini App SDK (CI/DI) ← 없음(단일 기기)
> - 수익화: Toss Payments + Web Ads ← RevenueCat + AdMob

---

## ⚠️ 0. 기존 문서의 오류 정정 (중요)

`docs/toss/toss_app_in_app_architecture.md` 는 실제 코드를 읽지 않고 작성되어
**아래 항목이 사실과 다르다.** 이 명세서 시리즈가 우선한다.

| # | 기존 문서 서술 | 실제 코드 | 근거 |
|---|---|---|---|
| 1 | 주제별 연습 = **4문장** | **5문장** (일반 4 + Google Search 그라운딩 1) | `src/services/topicSentences.ts:31` `REGULAR_COUNT = 4`, `generateTopicSentences()` 가 `[grounded, ...regular]` 반환 |
| 2 | 음성 입력(Whisper)이 동작 중 | **비활성화됨** | `src/constants/features.ts:7` `VOICE_INPUT_ENABLED: false` |
| 3 | SM-2 간격 반복 알고리즘 사용 | **미구현**. 스키마 컬럼만 존재 | `reviewRepository.updateAfterReview()` 를 호출하는 코드가 0개. `app/(tabs)/review.tsx:36` 주석 "SM-2 ... Phase 6" |
| 4 | 복습 시 [다시하기]/[알겠어] 버튼 | **없음**. 실제로는 재번역 입력창 + [채점하기] | `ReviewAttemptPanel.tsx` |
| 5 | 쿼터 = "하루 5번" 단일 카운터 | **5개 기능별 독립 카운터** (2/5/2/5/5) | `src/constants/monetization.ts` `FreeLimits` |
| 6 | 광고 1회 = 쿼터 1회 충전 | **광고 2회 = 1회 충전** | `ADS_PER_BONUS = 2`, `AD_BONUS_TRIES = 1` |
| 7 | 탭이 5개 (설정 포함) | **탭 4개** + 설정은 모달 스택 라우트 | `app/(tabs)/_layout.tsx` |
| 8 | 문법 노트 = "북마크 용도" 한 줄 | **독립 기능 전체**: `[[태그]]` 링크화 + 문법 선생님 시트 + 60개 용어 사전 | `utils/grammarTags.ts`, `constants/grammarTerms.ts`, `components/grammar/*` |

추가로 발견된 **잠재 버그** (마이그레이션 시 의사결정 필요):

- **모든 복습 카드가 항상 "오늘 마감"이다.** `reviewRepository.create()` 가
  `nextReviewDate = today` 로 넣고, `updateAfterReview()` 는 아무도 호출하지 않으며,
  `getDueCards()` 는 `lte(nextReviewDate, today)` 로 조회한다. 결과적으로 덱의
  **모든 카드가 매일 전부 노출**된다. → 03 문서에서 처리 방침 명시.

---

## 1. 디렉터리 전체 지도

```
app/                         라우팅 (expo-router, 파일 기반)          2,153줄 / 10파일
├─ _layout.tsx               루트: 폰트·DB·쿼리·스토어 부팅 + Stack
├─ (tabs)/_layout.tsx        하단 탭 4개 + 헤더 설정 버튼
├─ (tabs)/index.tsx          [탭1] 오늘의 문장 (홈)
├─ (tabs)/free-input.tsx     [탭2] 자유 입력 = 실질적 "번역 제출 화면"
├─ (tabs)/topics.tsx         [탭3] 주제별 연습 (3-phase 단일 화면)
├─ (tabs)/review.tsx         [탭4] 복습
├─ result/[id].tsx           평가 결과 상세 (스택)
├─ settings.tsx              설정 (모달 프레젠테이션)
├─ +html.tsx                 웹 정적 렌더링용 셸 → Next.js 에서 폐기
└─ +not-found.tsx            404

src/
├─ components/  30파일 4,634줄   UI 전체
│  ├─ ads/          1  광고 배너
│  ├─ chat/         1  AI 튜터 챗 시트 (470줄)
│  ├─ daily/        6  출석 캘린더(517줄)·스트릭·통계·문장카드·응원메시지
│  ├─ evaluation/   5  점수·피드백·추천표현·복습재시도·평가 리플레이
│  ├─ grammar/      3  문법 링크 텍스트·문법 선생님 시트·문법 노트 카드
│  ├─ input/        4  한/영 입력·입력방식 토글·음성 녹음기
│  ├─ monetization/ 3  쿼터 미터·쿼터 초과 모달·광고 로딩 오버레이
│  ├─ paywall/      1  구독 결제 시트 (384줄)
│  └─ ui/           6  Badge·Button·Card·ProgressBar·ScoreCircle·Skeleton
├─ constants/  10파일  709줄   프롬프트 원문·쿼터표·색상·주제 50개·문법용어 60개
├─ db/         18파일          Drizzle 스키마 9테이블 + 리포지토리 8개 + 마이그레이션 6개
├─ hooks/      20파일 1,050줄   react-query 래퍼 + 쿼터 게이트 + 캘린더 로직
├─ providers/   2파일           DatabaseProvider(마이그레이션) · QueryProvider
├─ services/    8파일 1,553줄   Gemini·Whisper·AdMob·RevenueCat + 4개 생성 서비스
├─ stores/      4파일  381줄    Zustand: 입력·수익화·녹음·설정
├─ types/       5파일  150줄    Zod 스키마 + 파생 타입
└─ utils/       6파일  415줄    캘린더 수학·스트릭·문법태그 파서·에러/재시도·오디오
```

---

## 2. 파일 → Next.js 매핑 총괄표

### 2.1 라우팅 (`app/`)

| AS-IS (expo-router) | TO-BE (Next.js App Router) | 비고 |
|---|---|---|
| `app/_layout.tsx` | `app/layout.tsx` + `app/providers.tsx` | `useFonts`→`next/font`, `DatabaseProvider` **삭제**(서버 DB), `initializeAds/Revenue`→Toss SDK init |
| `app/(tabs)/_layout.tsx` | `app/(main)/layout.tsx` + `components/layout/TabBar.tsx` | `<Tabs>` → `usePathname()` 기반 고정 하단 `<nav>` |
| `app/(tabs)/index.tsx` | `app/(main)/page.tsx` | |
| `app/(tabs)/free-input.tsx` | `app/(main)/practice/page.tsx` | ⚠️ 탭 상주(mounted) 전제가 깨짐 — 03 문서 참조 |
| `app/(tabs)/topics.tsx` | `app/(main)/topics/page.tsx` | 3-phase 를 URL 쿼리(`?category=&topic=`)로 승격 권장 |
| `app/(tabs)/review.tsx` | `app/(main)/review/page.tsx` | |
| `app/result/[id].tsx` | `app/result/[id]/page.tsx` | |
| `app/settings.tsx` | `app/settings/page.tsx` | modal presentation → 전체 페이지 or Drawer |
| `app/+html.tsx` | **삭제** | `app/layout.tsx` 가 대체 |
| `app/+not-found.tsx` | `app/not-found.tsx` | |

### 2.2 데이터 계층 (`src/db/`) → 서버 전용

| AS-IS | TO-BE | 변경 강도 |
|---|---|---|
| `db/schema.ts` (sqliteTable ×9) | `src/db/schema.ts` (pgTable ×10, `users` 추가) | 🔴 전면 |
| `db/client.ts` (expo-sqlite) | `src/db/client.ts` (`postgres-js`, **server-only**) | 🔴 전면 |
| `db/migrations/*` (6개 + migrations.js) | `drizzle-kit` pg 재생성. 기존 SQL 폐기 | 🔴 폐기 |
| `providers/DatabaseProvider.tsx` | **삭제** (런타임 마이그레이션 불필요) | 🔴 삭제 |
| `db/repositories/*.ts` (8개) | 동일 위치, 전 함수에 `userId` 파라미터 추가 | 🟡 시그니처 변경 |

### 2.3 서비스 계층 (`src/services/`) → BFF 분리

| AS-IS | TO-BE 서버 | TO-BE 클라이언트 |
|---|---|---|
| `gemini.ts` (417줄) | `src/server/ai/gemini.ts` | — (프롬프트 은닉) |
| `dailySentences.ts` | `app/api/daily-sentences/route.ts` | `lib/api/dailySentences.ts` (fetch) |
| `dailyMessage.ts` | `app/api/daily-message/route.ts` | fetch 래퍼 |
| `topicSentences.ts` | `app/api/topics/generate/route.ts` | fetch 래퍼 |
| `grammar.ts` | `app/api/grammar/explain/route.ts` | fetch 래퍼 |
| `whisper.ts` (202줄) | `app/api/transcribe/route.ts` | `FormData`+`Blob` 업로드 |
| `ads.ts` (AdMob) | — | `lib/ads/webRewarded.ts` (AdSense/Toss Ads) |
| `revenue.ts` (RevenueCat) | `app/api/payments/*` | `lib/payments/tossPayments.ts` |

### 2.4 상태 (`src/stores/`, `src/hooks/`)

| AS-IS | TO-BE | 변경 |
|---|---|---|
| `useSettingsStore` | `useSettingsStore` (축소) | 🔴 API 키 필드 **완전 삭제**. `preferredInputMethod` 만 `localStorage` |
| `useMonetizationStore` | `useMonetizationStore` + 서버 동기화 | 🔴 SecureStore → 서버 권위(`user_quotas`), 로컬은 캐시 |
| `useInputStore` | 그대로 | 🟢 복붙 |
| `useRecordingStore` | 그대로 (uri = `blob:` URL) | 🟢 |
| `hooks/*` 20개 | 대부분 그대로, 내부 호출만 repo→fetch | 🟡 |

### 2.5 컴포넌트 (`src/components/`)

30개 전부 **RN 프리미티브 → HTML** 치환 필요. 상세 매핑은 04 문서.
가장 손이 많이 가는 순:

1. `daily/AttendanceCalendar.tsx` (517) — Animated 크로스페이드 + 3단 뷰
2. `chat/TutorChatModal.tsx` (470) — Modal + KeyboardAvoidingView + 자동 스크롤
3. `paywall/Paywall.tsx` (384) — RevenueCat 상품 → Toss Payments 상품
4. `grammar/GrammarTeacherModal.tsx` (352) — 바텀시트
5. `monetization/QuotaExceededModal.tsx` (253) — 광고 진행 pip
6. `evaluation/ReviewAttemptPanel.tsx` (252)
7. `evaluation/RecommendationList.tsx` (241) — LayoutAnimation 아코디언
8. `grammar/GrammarNoteCard.tsx` (222)
9. `input/VoiceRecorder.tsx` (210) — expo-audio → MediaRecorder
10. `ui/ScoreCircle.tsx` (117) — react-native-svg → 인라인 SVG

---

## 3. 네이티브 모듈 → 웹 대체 매핑 (전수)

| 네이티브 패키지 | 사용처 | 웹 대체 |
|---|---|---|
| `expo-sqlite` + `drizzle-orm/expo-sqlite` | `db/client.ts` | Supabase PostgreSQL + `drizzle-orm/postgres-js` (서버) |
| `expo-secure-store` | `useSettingsStore`, `useMonetizationStore` | API 키는 **서버 env**, 나머지는 `localStorage` |
| `expo-file-system` (`File`) | `whisper.ts`, `utils/audioHelpers.ts` | `Blob` / `File` (Web API) |
| `expo-audio` | `VoiceRecorder.tsx` | `MediaRecorder` + `getUserMedia` |
| `react-native-google-mobile-ads` | `services/ads.ts`, `AdBanner.tsx` | AdSense 보상형 / Toss Ads |
| `react-native-purchases` | `services/revenue.ts` | `@tosspayments/tosspayments-sdk` |
| `expo-symbols` (`SymbolView`) | 12개 컴포넌트 | `lucide-react` 또는 TDS 아이콘 |
| `expo-linear-gradient` | `Button`, `StreakBadge` | CSS `linear-gradient()` |
| `expo-haptics` | `Button`, `Card`, `AttendanceCalendar`, `RecommendationList` | `navigator.vibrate()` / Toss SDK haptic |
| `expo-clipboard` | `RecommendationList` | `navigator.clipboard.writeText()` |
| `react-native-svg` | `ScoreCircle` | 인라인 `<svg>` |
| `react-native-safe-area-context` | 8개 파일 | `env(safe-area-inset-bottom)` |
| `react-native-reanimated` / `Animated` | 9개 컴포넌트 | CSS transition / `framer-motion` |
| `Modal` (RN) | 5개 시트 | `<dialog>` 또는 Radix Dialog + TDS BottomSheet |
| `KeyboardAvoidingView` | 3개 화면 | `visualViewport` 리스너 |
| `BackHandler` | `topics.tsx` | `history.pushState` + `popstate` / Toss SDK back |
| `Alert.alert` | `settings.tsx`, `review.tsx` | 커스텀 확인 다이얼로그 (TDS) |
| `Share.share` | `result/[id].tsx` | `navigator.share()` (Toss WebView 지원 확인 필요) |
| `RefreshControl` | `index.tsx` | 당겨서 새로고침 라이브러리 또는 버튼 |
| `Keyboard` 리스너 | `AdBanner`, `TutorChatModal` | `visualViewport.resize` |
| `LayoutAnimation` | `RecommendationList` | CSS `grid-template-rows` 트랜지션 |
| `Constants.expoConfig` | `settings.tsx` | `process.env.NEXT_PUBLIC_APP_VERSION` |

---

## 4. 데이터 흐름 실측 (핵심 3개)

### Flow A — 오늘의 문장 번역 제출

```
(tabs)/index.tsx  카드 탭
  → useInputStore.setKoreanText / setDailySentenceId / setSource('daily')
  → router.push('/free-input')
(tabs)/free-input.tsx
  → useLatestEvaluationForSentence(dailySentenceId)   ← 이미 푼 문장이면 과거 결과 표시
  → [평가 받기] → quota.run(...)                       ← useGatedAction('dailySentenceEvaluation')
       1. check()      : hasQuota? 아니면 QuotaExceededModal
       2. runBehindAd(): adGated=true 이므로 보상형 광고 재생
       3. action()     : useEvaluation.mutateAsync()
            → services/gemini.evaluate()               ← Gemini 2.5-flash, temp 0.7, responseSchema
            → tagGrammarTerms()                        ← [[문법용어]] 마크업 주입
            → evaluationRepository.saveComplete()      ← 트랜잭션: userInputs → evaluations → recommendations
            → overallScore = 0.4*자연 + 0.35*문법 + 0.25*의미   ← 클라이언트 계산
            → sentenceRepository.markCompleted(id)
       4. consume()    : 쿼터 1 차감 (성공했을 때만)
  → router.push('/result/{evaluationId}')
```

### Flow B — 쿼터 소진 → 광고 보상

```
useGatedAction.check() 실패
  → QuotaExceededModal (feature별 문구 자동 생성)
  → [광고 보기 (0/2)] → showRewardedAd()
       'rewarded'    → recordAdView(feature)
                        watched+1 < 2  ? 진행도만 저장, 안내 문구
                                       : adViews[feature]=0 + grantBonus(feature, 1)
                                         (grantBonus = 카운터를 1 깎는 방식 = 자정에 자동 소멸)
       'dismissed'   → "끝까지 봐야 해요"
       'unavailable' → "지금은 불러올 수 없어요"
```

### Flow C — 문법 용어 링크 → 문법 선생님

```
Gemini 응답의 evaluation.grammar_terms[] (스키마 강제 배열)
  → utils/grammarTags.applyGrammarTags(feedback, terms)   ← [[현재완료]] 삽입, 긴 용어 우선
  → (배열이 비면) autoTagKnownTerms()                      ← KNOWN_GRAMMAR_TERMS 60개 사전 폴백
  → DB feedback 컬럼에 마크업 포함 저장
  → GrammarText 가 parseGrammarTags() 로 분해 → <Text onPress> 링크
  → GrammarTeacherModal(term)
       → useGrammarExplanation: 저장된 노트 우선 → 없으면 services/grammar.explainGrammarTerm()
       → [복습에 저장] → grammar_notes upsert (term UNIQUE)
```

---

## 5. 아키텍처 전환 시 반드시 결정해야 할 항목

| # | 쟁점 | 현재 | 권고 |
|---|---|---|---|
| 1 | AI API 키 소유자 | **사용자가 직접 입력** (설정 화면) | 서비스가 제공. 설정의 키 입력 UI 전면 삭제 |
| 2 | 쿼터 권위 | 클라이언트 SecureStore (조작 가능) | **서버 DB**. 클라이언트는 표시용 캐시 |
| 3 | 트랜잭션 | expo-sqlite = **동기 콜백** (`.get()/.run()`) | postgres-js = **async 콜백** (`await tx...`) — 전량 재작성 |
| 4 | 날짜 기준 | 기기 로컬 `format(new Date())` + SQL `date()` 는 UTC | 서버 KST(`Asia/Seoul`) 고정. 혼용 금지 |
| 5 | 복습 due 로직 | 전 카드 상시 due (버그) | 그대로 이관 후 SM-2 별도 과제 (파리티 우선) |
| 6 | 음성 입력 | 플래그로 OFF | OFF 유지하되 코드 경로는 웹으로 포팅 |
| 7 | 토픽 문장 저장 | 저장 안 함 (react-query 캐시 only) | 서버 캐시 or 그대로 — 재로그인 시 소실 감수 |
| 8 | 오디오 파일 | `audioUri` 로컬 경로 저장 | Supabase Storage 또는 저장 안 함 |

---

## 6. 문서 구성

| 문서 | 범위 |
|---|---|
| `00_teardown_inventory.md` | (이 문서) 전수 조사 · 매핑 총괄 · 오류 정정 |
| `01_database.md` | 9→10 테이블 pg 전환, 멀티테넌시, RLS, 리포지토리 8개 전 함수 |
| `02_services_and_api.md` | 서비스 8개 → BFF 라우트, 프롬프트 원문, 결제/광고 |
| `03_state_management.md` | Zustand 4개, 훅 20개, react-query 키 체계, 쿼터 서버화 |
| `04_ui_and_routing.md` | 라우트 10개, 컴포넌트 30개, RN→HTML 치환, TDS 적용 |
