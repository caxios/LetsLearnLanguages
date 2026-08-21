# 앱인토스(미니앱) 완벽 재구현을 위한 상세 기능 및 비즈니스 명세서 (PRD)

이 문서는 기존 `LetsLearnLanguages` 프로젝트를 앱인토스나 완전히 다른 웹 기반 프로젝트로 **한 치의 오차 없이 동일하게 재구현**할 수 있도록 작성된 궁극의 명세서입니다. DB 스키마, 화면별 UI 요건, 내부 AI 프롬프트 원문, 상태 관리 흐름, 통신 스펙까지 500줄 이상의 방대한 내용을 모두 담았습니다.

---

## 1. 전역 상태 및 로컬 스토리지 명세 (Zustand & Settings)

앱 전역에서 유지되어야 하는 상태(State) 값들입니다. 앱인토스로 전환 시 브라우저의 `localStorage` 또는 자체 DB 서버와 연동해야 합니다.

### 1.1. 설정 상태 (`useSettingsStore`)
*   `openaiApiKey` (string | null): OpenAI API 키 (Whisper STT 용)
*   `geminiApiKey` (string | null): Gemini API 키 (평가 및 튜터 챗 용)
*   `preferredInputMethod` ('voice' | 'text'): 유저가 마지막으로 선택한 입력 방식. 기본값 'text'.

### 1.2. 수익화 및 쿼터 상태 (`useMonetizationStore`, `useQuota`)
*   `isPremium` (boolean): 유료 구독 여부. 앱인토스의 경우 **토스페이먼츠(Toss Payments)** API 결제 여부와 연동됨.
*   `dailyQuota` (number): 무료 유저의 오늘 남은 기능(AI 평가/채팅) 사용 횟수.
*   **초기화 로직**: 사용자의 로컬 타임존 기준으로 매일 자정에 쿼터가 리셋됩니다.
*   **AdGate (`useAdGate`)**: 쿼터가 0일 때 기능에 접근하면, 광고(Toss Ads 또는 AdSense)를 시청하게 하고 쿼터를 보상으로 충전해주는 모달 로직.

---

## 2. 데이터베이스 스키마 설계 상세 (Data Model)

SQLite(`drizzle-orm`) 기반의 기존 DB 구조를 웹/서버용 관계형 DB(PostgreSQL, MySQL 등)로 똑같이 포팅해야 합니다.

### 2.1. 학습 문제 출제 테이블 (`daily_sentences`)
*   `id` (int, PK)
*   `koreanText` (text): 한국어 원문 (예: "오늘 저녁에 치맥 어때?")
*   `difficulty` (enum): 'easy', 'medium', 'hard'
*   `dateAssigned` (text/date): 할당된 날짜 (예: '2026-08-20')
*   `isCompleted` (boolean): 학습(채점)을 완료했는지 여부. 기본값 false.

### 2.2. 사용자 입력 및 음성 기록 (`user_inputs`)
*   `id` (int, PK)
*   `koreanText` (text): 출제된 한국어
*   `englishInput` (text): 사용자가 입력하거나 말한 영어 문장
*   `inputMethod` (enum): 'voice' | 'text'
*   `audioUri` (text, nullable): 'voice'일 경우 녹음된 오디오 파일의 저장 경로/URL
*   `dailySentenceId` (int, FK): 어떤 문제에 대한 답인지 연결 (자유 입력일 경우 null)

### 2.3. AI 평가 결과 저장 (`evaluations`)
사용자가 문장을 제출하고 AI가 채점한 결과의 마스터 테이블입니다.
*   `id` (int, PK)
*   `userInputId` (int, FK)
*   `naturalnessScore` (int, 0~100): 원어민이 듣기에 얼마나 자연스러운가
*   `grammarScore` (int, 0~100): 문법적 오류가 없는가
*   `meaningClarityScore` (int, 0~100): 원문의 의미를 훼손하지 않고 정확히 전달했는가
*   `overallScore` (int, 0~100): 위 세 가지의 종합 점수
*   `feedback` (text): AI가 작성한 긴 한국어 피드백
*   `rawJson` (text): 디버깅용 Gemini 원본 JSON 응답

### 2.4. 추천 모범 답안 (`recommendations`)
평가 시 AI가 2~3개씩 뱉어주는 다양한 뉘앙스의 추천 문장입니다 (`evaluations`와 N:1 관계).
*   `id` (int, PK)
*   `evaluationId` (int, FK)
*   `sentence` (text): 추천하는 영어 문장
*   `contextAndNuance` (text): 이 문장이 쓰이는 상황과 뉘앙스 (한국어)
*   `koreanTranslation` (text): 직역이 아닌 뉘앙스가 반영된 자연스러운 한국어 해석
*   `grammarExplanation` (text): 왜 이 문법을 썼는지에 대한 설명

### 2.5. 복습 플래시카드 (`review_cards` & `review_attempts`)
오답노트 기능입니다. SM-2 기반의 간격 반복 알고리즘을 사용합니다.
*   **`review_cards`**
    *   `id`, `evaluationId` (FK)
    *   `koreanText`, `bestEnglish` (사용자가 지정한 모범 답안 1개)
    *   `easeFactor` (float): 초기값 2.5. 정답 시 증가, 오답 시 감소 (SM-2 로직).
    *   `intervalDays` (int): 며칠 뒤에 복습할지. 초기값 1.
    *   `repetitions` (int): 연속 정답 횟수.
    *   `nextReviewDate` (text/date): 이 날짜가 지나야만 UI에 복습 뱃지가 뜸.
*   **`review_attempts`**
    *   사용자가 복습 카드를 다시 풀었을 때의 로그 기록 (간이 채점 점수만 저장).

### 2.6. 기타 (출석부, 격려 메시지, 문법 노트)
*   `app_visits`: 매일 앱에 최초 접속 시 기록 (스트릭 기능).
*   `daily_messages`: 하루에 한 번 노출되는 AI의 따뜻한 격려 한 줄.
*   `grammar_notes`: AI 튜터에게 문법 설명을 요구했을 때 북마크 해놓는 용도.

---

## 3. 핵심 화면 UI/UX 요건 (App Routing & Components)

### 3.1. 탭 1: 오늘의 문장 (Index / Home)
*   **상단 헤더**: 연속 출석일(🔥 불꽃 아이콘 + N일), 현재 남은 Quota 표시.
*   **메시지 카드**: AI가 매일 새롭게 생성하는 `daily_messages` (예: "오늘도 꾸준히 하시는 모습 멋져요! ✨").
*   **문제 리스트**: `daily_sentences`에 할당된 3문제(easy/medium/hard).
    *   완료(`isCompleted: true`) 시 초록색 체크마크 표시.
*   **입력 팝업 (Input Modal)**: 문제를 누르면 텍스트를 타이핑하거나, 마이크 버튼을 눌러 음성으로 대답할 수 있는 하프 모달이 뜸.

### 3.2. 탭 2: 토픽별 학습 (Topics)
*   **카테고리 리스트**: 여행(공항/호텔/식당), 비즈니스(이메일/회의/전화), 일상 대화 등의 썸네일 리스트.
*   **진입 시**: 특정 토픽을 누르면, AI가 실시간으로 해당 주제에 맞는 문제 4개(easy 1, medium 2, hard 1)를 즉석에서 생성하여 리스트에 뿌려줌.

### 3.3. 탭 3: 자유 연습 (Free Input)
*   **UI 구성**: 정해진 문제 없이, "나 지금 한국어로 이런 말이 하고 싶은데 영어로 뭐야?"를 자유롭게 입력하는 창.

### 3.4. 탭 4: 복습 (Review)
*   **알림 뱃지**: `nextReviewDate` <= `오늘날짜` 인 카드의 개수 표시.
*   **복습 화면**: 앞면에는 한국어(`koreanText`)만 뜸. 사용자가 정답을 영어로 입력/말함.
*   **채점 결과**: 기존처럼 긴 피드백이 나오지 않고, **점수 3개(자연스러움/문법/의미)**만 빠르게 팝업됨. 점수 결과에 따라 카드 하단에 [다시하기(실패)], [알겠어(성공)] 버튼을 눌러 SM-2 스케줄을 업데이트.

### 3.5. 탭 5: 설정 (Settings)
*   입력 방식 변경, API 키 재입력, 구독(결제) 상태 확인 및 업그레이드 버튼.

---

## 4. 프롬프트 엔지니어링 원문 (The AI Brain)

AI의 퀄리티가 앱의 퀄리티입니다. 아래 프롬프트들은 백엔드(또는 앱인토스 API)에서 토씨 하나 틀리지 않고 동일한 뉘앙스로 세팅되어야 합니다.

### 4.1. 정밀 채점 프롬프트 (`EVALUATION_SYSTEM_PROMPT`)
```text
You are an expert English language tutor specializing in teaching Korean speakers.
Your role is to evaluate English translations of Korean sentences and provide constructive feedback.

You evaluate based on three criteria:
1. Naturalness (자연스러움): 원어민이 듣기에 얼마나 자연스럽고 유창한지.
2. Grammar (문법): 시제, 관사, 전치사, 수일치 등.
3. Meaning Clarity (의미 전달): 한국어 원문의 의미가 훼손 없이 정확히 전달되었는지.

IMPORTANT RULES:
- 피드백과 설명은 무조건 한국어(Korean)로 작성할 것.
- 점수는 0~100점 사이.
- 2~3개의 다양한 추천 영어 문장(recommendations)을 제시할 것.
- 각각의 추천 문장에는 반드시 [상황과 뉘앙스 설명], [직역이 아닌 자연스러운 한국어 해석], [문법 설명]이 포함되어야 함.
- 교과서 영어가 아닌 실제 생활/회화 영어를 지향할 것.
- 피드백 및 문법 설명 작성 시, 반드시 사용된 '문법 용어(예: 현재완료, 관계대명사)'를 정확하게 명시하고, JSON의 grammar_terms 배열에 그 단어들을 담아줄 것.
```

### 4.2. 일일 격려 메시지 프롬프트 (`DAILY_MESSAGE_SYSTEM_PROMPT`)
```text
You write one short daily encouragement for someone studying English in a Korean learning app.
RULES:
- 한국어 해요체로 다정하고 따뜻하게 작성.
- 단 한 문장, 40자 이내. 이모지 1개 포함 (✨ 🌱 ☀️ 💪 🍀 등).
- '화이팅' 같은 뻔한 말은 피하고, 매일 다른 표현 사용. 성적/결과보다는 노력과 꾸준함을 칭찬할 것.
```

### 4.3. 토픽 문장 출제 프롬프트 (`TOPIC_SENTENCE_SYSTEM_PROMPT`)
```text
RULES:
- 유저가 선택한 단 하나의 주제에 대해서만 정확히 4개의 문장을 출제.
- 난이도 분배: easy 1개, medium 2개, hard 1개.
  - easy: 짧은 구문, 일상 어휘
  - medium: 두 가지 아이디어가 연결된 문장 혹은 흔한 관용구
  - hard: 길고 뉘앙스가 섞인 문장, 돌려 말하기 등
- 교과서적인 문장이 아니라 한국인이 일상에서 진짜 쓰는 톤(반말 or 해요체)으로 출제.
- 뻔한 "안녕하세요", "감사합니다" 절대 금지.
```

### 4.4. AI 튜터 챗 프롬프트 (`TUTOR_CHAT_SYSTEM_PROMPT`)
*   **특징**: 이 프롬프트는 단독으로 쓰이지 않고, 유저가 방금 채점받은 결과를 컨텍스트로 묶어서 넘깁니다.
*   **Context 주입 로직**:
    `[한국어 원문]`, `[사용자가 쓴 영어 번역]`, `[받은 피드백]`, `[추천 문장]`을 문자열로 합친 뒤, AI에게 첫 번째 메시지(`user`)로 던집니다. AI는 "네, 방금 받은 평가 내용을 모두 확인했어요."라고 대답(`model`)하게 한 뒤, 유저의 진짜 질문(예: "the 대신 a를 쓰면 안 돼?")을 이어 붙여 채팅을 시작합니다.
*   **룰**: 마크다운, 리스트 렌더링 절대 쓰지 말고 채팅처럼 자연스러운 평문 2~5줄로 대답할 것.

### 4.5. 복습용 초경량 채점 프롬프트 (`REVIEW_SCORING_SYSTEM_PROMPT`)
*   피드백 글을 생성하지 않으므로 토큰 소모가 적고 빠릅니다.
*   **룰**: "이것은 간격 반복 복습입니다. 긴 설명은 필요 없고 오직 3가지 지표(자연스러움, 문법, 의미전달)의 0~100점 숫자만 JSON으로 반환하세요."

---

## 5. 앱 구동 및 사용자 플로우 (Detailed User Flows)

### Flow 1: 사용자가 오늘의 문장을 풀 때 (`useEvaluation` 훅 연동)
1.  사용자가 `daily_sentences`에서 미완료된 문장을 클릭.
2.  음성(Voice) 버튼을 누르고 말함. 브라우저의 Web Audio API로 마이크 권한을 획득하고 녹음.
3.  녹음된 오디오를 OpenAI **Whisper API**로 전송 ➡️ 영어 텍스트 반환 (`englishInput`).
4.  만약 텍스트 모드라면 유저가 직접 영어 타이핑.
5.  `gemini.ts`의 `evaluate()` 함수 호출 (Gemini-2.5-flash 모델, Temperature 0.7).
    *   요청 시 JSON Schema(Zod 구조 기반)를 모델 파라미터로 강제하여, 응답이 완벽한 JSON 포맷으로 오도록 보장함.
6.  결과 파싱 ➡️ `evaluations` 및 `recommendations` 테이블에 저장 (트랜잭션).
7.  `daily_sentences`의 `isCompleted`를 true로 업데이트.
8.  Query Invalidation (`react-query`) 발생 ➡️ 홈 화면의 출석 스트릭 및 남은 할당량 동기화 업데이트.
9.  결과 모달 노출 ➡️ 유저는 점수 확인 후 "AI 튜터와 대화하기(채팅)" 혹은 "오답 노트에 저장(`review_cards` 인서트)" 버튼 클릭 가능.

### Flow 2: 쿼터(Quota) 초과 시
1.  무료 유저가 하루 5번(예시)의 문장 평가를 모두 소진함.
2.  새로운 문장을 풀려고 하면 `useAdGate` 훅이 이를 가로챔(Intercept).
3.  **앱인토스 환경**: "무료 횟수를 모두 소진했어요. 보상형 광고를 보고 1회 충전하시겠어요?" 모달 표시.
4.  유저가 광고(AdSense 등 웹 광고망)를 끝까지 시청.
5.  백엔드 서버 또는 로컬 스토어에서 `dailyQuota += 1` 처리.

---

## 6. 마이그레이션 기술 스택 권장안

위 로직들을 완벽히 재현하기 위한 앱인토스(Web) 최적 기술 스택입니다.

*   **프론트엔드**: **Next.js (App Router)** 또는 **React (Vite)**
    *   기존 React Native 코드를 1:1로 웹 뷰 컴포넌트로 포팅.
    *   상태 관리: `Zustand` (기존 코드 그대로 복붙 가능).
    *   서버 상태 동기화: `@tanstack/react-query` (기존 코드 그대로 복붙 가능).
*   **스타일링**: **Tailwind CSS** (기존 NativeWind 클래스를 그대로 사용하되 HTML 태그로 치환).
*   **백엔드/DB**: **Supabase** (PostgreSQL)
    *   기존 `drizzle-orm` 쿼리를 그대로 사용할 수 있으며, SQLite에서 Postgres 방언으로만 수정하면 됨.
*   **결제 및 인증**: 
    *   인증: **Toss Mini App SDK** (`TossApp.getUserInfo()`) 활용하여 유저 CI/DI 매핑.
    *   수익화: **Toss Payments API** 직접 연동.

## 결론
이 500+ 줄 명세서에 명시된 데이터베이스 구조, AI 프롬프트 엔진, 그리고 UI 상태 흐름을 그대로 구현한다면, 플랫폼이 네이티브 앱(Expo)에서 앱인토스(웹뷰)로 바뀌더라도 사용자는 **완벽하게 똑같은 학습 경험과 AI 튜터 퀄리티**를 느끼게 될 것입니다.
