# 04. UI · 라우팅 마이그레이션 설계서 (React Native → Next.js + Tailwind + TDS)

> 대상 원본: `app/*` (10파일 2,153줄) · `src/components/**` (30파일 4,634줄)
> · `src/constants/colors.ts` · `fonts.ts` · `layout.ts` · `tailwind.config.js`

---

## 1. 스타일링 전략 — 3중 체계를 1개로 통합

현재 코드베이스에는 **스타일 방식이 3가지 혼재**한다.

| 방식 | 사용 파일 수 | 예시 |
|---|---|---|
| `StyleSheet.create` + `Colors`/`Spacing` 상수 | 26개 | 대부분의 컴포넌트 |
| NativeWind `className` | 4개 | `KoreanInput`, `TextInputField`, `InputMethodToggle`, `VoiceRecorder` |
| 인라인 `style={{}}` (Animated 등) | 9개 | 애니메이션 값 바인딩 |

**목표: 전부 Tailwind 클래스로 통일한다.**

### 1.1 디자인 토큰 → Tailwind 테마

`src/constants/colors.ts` (58줄, 28개 색)를 CSS 변수 + Tailwind 테마로 승격한다.
**현재 앱은 다크 테마 단일**(`DarkTheme` 고정, `StatusBar style="light"`)이므로
TDS 라이트 모드를 쓸지 다크를 유지할지 **먼저 결정해야 한다.**

```css
/* app/globals.css */
@theme {
  /* Backgrounds */
  --color-background:       #0F0F1A;
  --color-surface:          #1A1A2E;
  --color-surface-light:    #25253B;
  --color-surface-elevated: #2F2F4A;

  /* Primary / Secondary */
  --color-primary:        #6C63FF;
  --color-primary-light:  #8B83FF;
  --color-primary-dark:   #4F46E5;
  --color-primary-muted:  rgb(108 99 255 / 0.15);
  --color-secondary:       #00D4AA;
  --color-secondary-light: #34E0C0;
  --color-secondary-muted: rgb(0 212 170 / 0.15);

  /* Scores — scoreColor() 가 참조 */
  --color-score-high:   #4ADE80;   /* 80-100 */
  --color-score-medium: #FFB347;   /* 50-79  */
  --color-score-low:    #FF6B6B;   /* 0-49   */

  /* Text */
  --color-text-primary:   #FFFFFF;
  --color-text-secondary: #9CA3AF;
  --color-text-muted:     #6B7280;
  --color-text-inverse:   #0F0F1A;

  /* Borders */
  --color-border:       rgb(255 255 255 / 0.08);
  --color-border-light: rgb(255 255 255 / 0.15);
  --color-divider:      rgb(255 255 255 / 0.05);

  /* Status */
  --color-success: #4ADE80;  --color-warning: #FBBF24;
  --color-error:   #EF4444;  --color-info:    #60A5FA;

  /* Difficulty badges */
  --color-difficulty-easy:   #4ADE80;
  --color-difficulty-medium: #FBBF24;
  --color-difficulty-hard:   #EF4444;
}
```

`scoreColor()` 와 `difficultyColor` 는 **런타임 함수라 그대로 유지**하되 CSS 변수를 반환하게 한다.

```ts
// src/lib/theme.ts  (isomorphic, 무변경에 가깝게)
export function scoreColor(score: number): string {
  if (score >= 80) return 'var(--color-score-high)';
  if (score >= 50) return 'var(--color-score-medium)';
  return 'var(--color-score-low)';
}
```

### 1.2 Spacing / BorderRadius → Tailwind 스케일

`src/constants/layout.ts` 는 4px 배수 체계라 Tailwind 기본 스케일과 거의 일치한다.

| 원본 | 값 | Tailwind |
|---|---|---|
| `Spacing.xs` | 4 | `1` |
| `Spacing.sm` | 8 | `2` |
| `Spacing.md` | 12 | `3` |
| `Spacing.base` | 16 | `4` |
| `Spacing.lg` | 20 | `5` |
| `Spacing.xl` | 24 | `6` |
| `Spacing['2xl']` | 32 | `8` |
| `Spacing['3xl']` | 40 | `10` |
| `BorderRadius.sm/md/lg/xl/full` | 8/12/16/20/9999 | `rounded-lg`/`xl`/`2xl`/`[20px]`/`full` |

`layout.ts` 는 **삭제 가능**하다 (Tailwind 클래스가 대체).

### 1.3 폰트

```ts
// [AS-IS] expo-font + @expo-google-fonts, Fonts.heading = 'Inter_700Bold' 등
// [TO-BE] next/font/google
import { Inter, JetBrains_Mono } from 'next/font/google';
const inter = Inter({ subsets: ['latin'], weight: ['400','500','600','700'], variable: '--font-sans' });
const mono  = JetBrains_Mono({ subsets: ['latin'], weight: ['400'], variable: '--font-mono' });
```

| `Fonts.*` | Tailwind |
|---|---|
| `heading` (Inter 700) | `font-sans font-bold` |
| `headingSemiBold` (600) | `font-sans font-semibold` |
| `body` (400) | `font-sans` |
| `bodyMedium` (500) | `font-sans font-medium` |
| `mono` (JetBrains 400) | `font-mono` |

**한글 폰트 추가 필수**: 현재 Inter 는 라틴 서브셋만 로드하므로 한글은 시스템 폰트로
렌더된다. 토스 환경에서는 **Pretendard** 또는 TDS 지정 서체를 추가할 것.

`FontSizes` (xs12/sm14/base16/lg18/xl20/2xl24/3xl30/4xl36)는 Tailwind 기본과 동일 →
`text-xs`~`text-4xl` 로 1:1 치환.

> ⚠️ 원본은 `lineHeight: FontSizes.base * 1.5` 처럼 **곱셈으로 행간을 지정**한다.
> Tailwind 의 `leading-relaxed`(1.625) 등과 정확히 일치하지 않으므로
> `leading-[1.5]` 같은 임의값으로 명시해 시각적 파리티를 지킬 것.

---

## 2. 라우팅 재구성

### 2.1 파일 구조

```
app/
├─ layout.tsx                  ← app/_layout.tsx (폰트/전역 CSS/Providers)
├─ providers.tsx               ← QueryProvider + TossAuth + BootstrapGate
├─ globals.css                 ← global.css + @theme 토큰
├─ not-found.tsx               ← app/+not-found.tsx
├─ (main)/
│  ├─ layout.tsx               ← app/(tabs)/_layout.tsx (헤더 + 하단 탭)
│  ├─ page.tsx                 ← app/(tabs)/index.tsx           [오늘의 문장]
│  ├─ practice/page.tsx        ← app/(tabs)/free-input.tsx       [자유 입력]
│  ├─ topics/page.tsx          ← app/(tabs)/topics.tsx           [주제별 연습]
│  └─ review/page.tsx          ← app/(tabs)/review.tsx           [복습]
├─ result/[id]/page.tsx        ← app/result/[id].tsx
├─ settings/page.tsx           ← app/settings.tsx
└─ api/…                       ← 02 문서 참조
```

`app/+html.tsx` 는 삭제 (`app/layout.tsx` 가 대체).

### 2.2 탭 바 구현

```tsx
// components/layout/TabBar.tsx
'use client';
const TABS = [
  { href: '/',         label: '오늘의 문장', icon: Home },
  { href: '/practice', label: '자유 입력',   icon: PencilLine },
  { href: '/topics',   label: '주제별 연습', icon: BookOpen },
  { href: '/review',   label: '복습',        icon: NotebookText },
] as const;

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface
                 pb-[env(safe-area-inset-bottom)]"
      /* 원본: height 60 + insets.bottom, paddingBottom: insets.bottom */
    >
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return (
          <Link key={href} href={href}
            className={`flex h-[60px] flex-1 flex-col items-center justify-center gap-1
                        text-xs font-medium
                        ${active ? 'text-primary' : 'text-text-muted'}`}>
            <Icon size={26} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
```

**`tabBarHideOnKeyboard: true` 재현** (원본 주석: "the bar rides up on top of the
keyboard and eats the room the input needs"):

```ts
// hooks/useKeyboardVisible.ts — AdBanner 와 공유
export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => setVisible(window.innerHeight - vv.height > 150);
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);
  return visible;
}
```

### 2.3 화면별 스크롤 컨테이너

RN 은 `<ScrollView>` 가 명시적 스크롤 영역이지만 웹은 body 가 스크롤한다.
`app/+html.tsx` 의 `ScrollViewStyleReset`(body 스크롤 차단)은 **폐기**하고
자연스러운 문서 스크롤을 쓰되, 하단 탭 높이만큼 패딩을 준다.

```tsx
<main className="min-h-dvh bg-background px-4 pt-4
                 pb-[calc(60px+env(safe-area-inset-bottom)+2.5rem)]">
```

### 2.4 `topics.tsx` 의 3-phase + BackHandler

원본은 단일 화면에서 `categories → topics → sentences` 를 로컬 state 로 전환하고,
`BackHandler` 로 안드로이드 뒤로가기를 가로채 **탭을 벗어나지 않고 phase 만 pop** 한다.

```ts
useFocusEffect(useCallback(() => {
  const sub = BackHandler.addEventListener('hardwareBackPress', () => {
    if (topic === null && category === null) return false;  // 루트면 OS에 양보
    goBack(); return true;
  });
  return () => sub.remove();
}, [category, goBack, topic]));
```

**웹 이관 권고: phase 를 URL 로 승격한다.**

```
/topics                              → categories
/topics?category=work-school         → topics
/topics?category=work-school&topic=… → sentences
```

이렇게 하면 브라우저/토스 뒤로가기가 **공짜로** 동일하게 동작하고,
`useFocusEffect`(탭 상주 전제) 자체가 불필요해진다. 새로고침·딥링크도 보너스로 얻는다.

```tsx
const params = useSearchParams();
const router = useRouter();
const categoryId = params.get('category');
const topic = params.get('topic');
const phase = topic ? 'sentences' : categoryId ? 'topics' : 'categories';

const openCategory = (c: TopicCategory) => router.push(`/topics?category=${c.id}`);
const openTopic = (t: string) => {
  if (hasSentencesFor(t)) { router.push(`/topics?category=${categoryId}&topic=${encodeURIComponent(t)}`); return; }
  if (!quota.check()) return;
  router.push(`/topics?category=${categoryId}&topic=${encodeURIComponent(t)}`);
  generate(t);
};
const goBack = () => router.back();
```

### 2.5 `settings.tsx` 의 modal presentation

원본은 `presentation: 'modal'` 로 아래에서 올라오는 시트다.
웹에서는 **전체 페이지**(`/settings`)로 두고, 헤더에 뒤로가기를 두는 편이 단순하다.
TDS 의 풀스크린 모달 패턴이 있으면 그쪽을 따른다.

---

## 3. RN 프리미티브 → HTML 치환 규칙

| RN | HTML | 주의 |
|---|---|---|
| `<View>` | `<div>` | RN 은 기본 `display:flex; flex-direction:column`. **`div` 는 아니다** → `flex flex-col` 명시 필요 |
| `<Text>` | `<span>` / `<p>` | RN `<Text>` 는 중첩 시 스타일 상속. `GrammarText` 가 이 성질을 씀 |
| `<Pressable>` | `<button>` | `({pressed}) => style` → `active:` 변형자 |
| `<ScrollView>` | `<div class="overflow-y-auto">` 또는 문서 스크롤 | |
| `<TextInput multiline>` | `<textarea>` | |
| `<TextInput>` | `<input>` | |
| `<Modal>` | `<dialog>` / Radix Dialog | |
| `<ActivityIndicator>` | CSS 스피너 | |
| `<Image>` | `<Image>` (next/image) | 이 프로젝트엔 사용처 없음 |
| `flex: 1` | `flex-1` | RN 은 `flexShrink:1` 기본, 웹은 `flexShrink:1`이지만 `flex-basis` 차이 |
| `gap: N` | `gap-*` | 지원됨 |
| `accessibilityRole="button"` | `<button>` 자체 | |
| `accessibilityLabel` | `aria-label` | |
| `accessibilityState={{expanded}}` | `aria-expanded` | |
| `hitSlop` | `p-*` 또는 `::before` 확장 | 터치 타겟 44px 확보 |

### 3.1 `<View>` 기본 flex 함정

```tsx
// RN — 세로 배치가 기본
<View style={{ gap: 12 }}>...</View>

// 웹 — 반드시 명시
<div className="flex flex-col gap-3">...</div>
```

**30개 컴포넌트 전부에서 이 실수가 발생 가능**하다. 변환 시 최우선 확인 항목.

---

## 4. 컴포넌트 30종 이관 명세

### 4.1 `ui/` — 디자인 시스템 기초 (6개)

#### `Badge.tsx` (43줄) — 🟢 단순

```tsx
// 동적 색상: backgroundColor = `${color}26` (16진 알파 15%)
export function Badge({ text, color, variant = 'filled' }: BadgeProps) {
  return (
    <span
      className="inline-flex self-start rounded-full border px-2 py-1 text-xs font-medium"
      style={{
        color,
        borderColor: color,
        backgroundColor: variant === 'filled' ? `${color}26` : 'transparent',
      }}
    >{text}</span>
  );
}
```

> 색이 런타임 값(`difficultyColor[difficulty]`)이라 Tailwind 클래스로 못 만든다.
> **인라인 `style` 유지가 정답**이다. 억지로 safelist 하지 말 것.

#### `Button.tsx` (132줄) — 🟡 그래디언트 + 햅틱

4 variant × 3 size. `primary` 만 `LinearGradient`.

```tsx
const VARIANT = {
  primary:   'bg-[linear-gradient(135deg,var(--color-primary),var(--color-primary-light))] text-text-primary',
  secondary: 'bg-surface-light text-text-primary',
  ghost:     'border border-border-light bg-transparent text-primary-light',
  danger:    'bg-error text-text-primary',
} as const;
const SIZE = { sm: 'py-2 text-sm', md: 'py-3 text-base', lg: 'py-4 text-lg' } as const;

const handlePress = () => {
  if (isDisabled) return;
  navigator.vibrate?.(10);          // Haptics.impactAsync(Light) 대체
  onPress();
};
```

`disabled` 시 `opacity-50`, `loading` 시 스피너로 라벨 교체 — 원본 동작 유지.

#### `Card.tsx` (69줄) — 🟡 press 스케일 애니메이션

```tsx
// Animated.spring(scale, {toValue: 0.97, speed: 40, bounciness: 4})
// → CSS transition 으로 근사
<button className="transition-transform duration-150 active:scale-[0.97]">
```

3 variant: `default`(surface+border), `elevated`(surfaceElevated+shadow), `outlined`(투명+borderLight).
`onPress` 없으면 `<div>`, 있으면 `<button>` 으로 분기하는 원본 로직 유지.

#### `ProgressBar.tsx` (55줄) — 🟢

```tsx
// Animated.timing 400ms easing.out(ease) → CSS transition
<div role="progressbar" aria-valuenow={Math.round(clamped*100)} aria-valuemin={0} aria-valuemax={100}
     className="w-full overflow-hidden rounded-full bg-surface-light" style={{ height }}>
  <div className="h-full rounded-full transition-[width] duration-[400ms] ease-out"
       style={{ width: `${clamped*100}%`, backgroundColor: color }} />
</div>
```

#### `ScoreCircle.tsx` (117줄) — 🔴 SVG + 카운트업

`react-native-svg` → 인라인 `<svg>`. 스트로크 애니메이션과 숫자 카운트업이
**하나의 드라이버를 공유**하는 것이 원본 설계다.

```tsx
const STROKE = 8, DURATION = 1000;
const radius = (size - STROKE) / 2;
const circumference = 2 * Math.PI * radius;

// 1) 스트로크: CSS transition 으로 충분
<circle r={radius} cx={size/2} cy={size/2} fill="none" strokeWidth={STROKE}
        stroke={color} strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={mounted ? circumference * (1 - target/100) : circumference}
        transform={`rotate(-90 ${size/2} ${size/2})`}   /* 12시 방향 시작 — 유지 */
        className="transition-[stroke-dashoffset] duration-1000 ease-out" />

// 2) 숫자 카운트업: requestAnimationFrame 으로 별도 구현
useEffect(() => {
  let raf: number; const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min(1, (now - start) / DURATION);
    const eased = 1 - Math.pow(1 - t, 3);          // Easing.out(Easing.cubic)
    setDisplayed(Math.round(eased * target));
    if (t < 1) raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}, [target]);
```

`prefers-reduced-motion` 존중 추가를 권장한다 (네이티브엔 없던 웹 관례).

#### `Skeleton.tsx` (80줄) — 🟢

`onLayout` 으로 폭 측정 후 shimmer 를 `-measured → +measured` 이동시킨다.
웹에서는 측정 없이 CSS 만으로 가능하다.

```css
@keyframes shimmer { from { transform: translateX(-100%) } to { transform: translateX(100%) } }
```

```tsx
<div role="progressbar" aria-label="불러오는 중"
     className="relative overflow-hidden bg-surface-light" style={{ height, width, borderRadius }}>
  <div className="absolute inset-0 animate-[shimmer_1.2s_linear_infinite] bg-surface-elevated opacity-60" />
</div>
```

### 4.2 `input/` (4개)

| 컴포넌트 | 난이도 | 핵심 |
|---|---|---|
| `KoreanInput` (31) | 🟢 | 이미 NativeWind. `<textarea maxLength={200}>` |
| `TextInputField` (74) | 🟡 | auto-grow (96→200px), Clear 버튼, `{len}/{max}` 카운터(초과 시 `text-red-400`) |
| `InputMethodToggle` (84) | 🟡 | 슬라이딩 인디케이터. `Features.VOICE_INPUT_ENABLED=false` 라 **현재 렌더 안 됨** |
| `VoiceRecorder` (210) | 🔴 | expo-audio → MediaRecorder |

#### `TextInputField` auto-grow

```tsx
// onContentSizeChange → 웹은 scrollHeight 사용
const onInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
  const el = e.currentTarget;
  el.style.height = 'auto';
  el.style.height = `${Math.min(200, Math.max(96, el.scrollHeight))}px`;
};
```

`submitBehavior="blurAndSubmit"` + `returnKeyType="done"` → 웹에서는
`onKeyDown` 에서 `Enter && !shiftKey` 처리로 대체.

#### `VoiceRecorder` (플래그 OFF 상태로 포팅)

```ts
// expo-audio                         →  Web
useAudioRecorder(HIGH_QUALITY)        →  new MediaRecorder(stream, {mimeType:'audio/webm'})
AudioModule.requestRecordingPermissionsAsync()
                                      →  navigator.mediaDevices.getUserMedia({audio:true})
setAudioModeAsync({allowsRecording})  →  불필요
audioRecorder.record()/stop()         →  recorder.start()/stop()
audioRecorder.uri                     →  URL.createObjectURL(new Blob(chunks))
recorderState.durationMillis (250ms)  →  setInterval 로 경과 시간 측정
```

펄스 애니메이션(1 → 1.35 → 1, 700ms 씩)은 CSS keyframes 로 치환.
권한 거부 문구, "Recording…" / "Transcribing…" / "Transcribed" 상태 표시,
"Record again" 버튼 로직은 그대로 유지.

### 4.3 `daily/` (6개)

#### `AttendanceCalendar.tsx` (517줄) — 🔴 최대 난이도

3단 뷰(`week` / `month` / `picker`)를 크로스페이드로 전환한다.
**로직은 `useAttendanceCalendar`(무변경)에 전부 있으므로 이 파일은 순수 렌더링이다.**

구조:
```
[isExpanded] monthBar:  ◀ | {2026년 8월} ▼ | ▶
             (NavButton) (월 선택 토글)  (NavButton)

<Animated.View opacity/translateY>   ← view·visibleMonth·pickerYear 변경 시 220ms 페이드
  !isExpanded  → <Pressable> 주간 스트립 7칸 (활성일은 '✓', 그 외 날짜 숫자)
  'month'      → 요일 헤더 7 + buildMonthGrid() 셀 (null 패딩 포함)
  'picker'     → 연도 네비 + 12개월 칩 (isSelectable / attended 표시)
</Animated.View>
```

```tsx
// 크로스페이드 — key 를 바꿔 CSS 애니메이션 재시작
<div key={`${view}-${visibleMonth}-${pickerYear}`}
     className="animate-[fadeUp_220ms_ease-out]">
```

```css
@keyframes fadeUp { from { opacity:0; transform: translateY(6px) } to { opacity:1; transform:none } }
```

`DayCell` 상태 5종(`isActive` / `isToday` / `isFuture` / compact / 일반)의
스타일 분기를 정확히 옮길 것. 월 그리드의 `null` 셀은 빈 `<div>` 로 렌더한다.

**보존할 UX 규칙** (`useAttendanceCalendar` 주석):
- 접으면 browsing 위치를 잊고 항상 현재 월로 복귀
- 미래 월은 선택 불가, 과거는 최소 12개월 열람 가능
- 그리드/피커에는 press 핸들러를 두지 않음 (원본 주석: "would put a second
  touchable over every day and month chip, and collapse the card on any stray tap")

#### 나머지 5개

| 컴포넌트 | 난이도 | 비고 |
|---|---|---|
| `StreakBadge` (104) | 🟡 | LinearGradient → CSS gradient. streak 0/1/N 문구 3분기 유지 |
| `DailyMessageCard` (60) | 🟢 | `FALLBACK_MESSAGE = '오늘도 한 걸음, 그거면 충분해요 ✨'` 유지 |
| `DailySentenceList` (101) | 🟢 | loading/error/empty/list 4상태 |
| `SentenceCard` (84) | 🟢 | 완료 시 초록 배경(`secondaryMuted`)+`success` 보더, "결과 보기 →" |
| `StatsPanel` (125) | 🟢 | 2칸 메트릭 카드 |

### 4.4 `evaluation/` (5개)

| 컴포넌트 | 난이도 | 핵심 |
|---|---|---|
| `ScoreCard` (33) | 🟢 | ScoreCircle ×3 (자연스러움/문법/의미 전달) |
| `FeedbackPanel` (54) | 🟢 | 500ms 페이드인 + GrammarText |
| `RecommendationList` (241) | 🔴 | 스태거 진입 + 3섹션 아코디언 + 클립보드 |
| `ReviewAttemptPanel` (252) | 🟡 | 재번역 입력 + 쿼터/광고 + 이전 기록 |
| `EvaluationDetail` (123) | 🟢 | 위 조각들의 조립 + 모달 2개 소유 |

#### `RecommendationList` 세부

```tsx
// 1. 스태거 진입: index * 100ms, spring(translateY 50→0, opacity 0→1)
<div className="animate-[slideUp_400ms_ease-out_both]" style={{ animationDelay: `${index*100}ms` }}>

// 2. 아코디언 3개 (nuance / translation / grammar) — 독립 토글
//    LayoutAnimation.easeInEaseOut → CSS grid 트릭
<div className="grid transition-[grid-template-rows] duration-200"
     style={{ gridTemplateRows: expanded ? '1fr' : '0fr' }}>
  <div className="overflow-hidden">{body}</div>
</div>

// 3. 복사: Clipboard.setStringAsync → navigator.clipboard.writeText
//    1500ms 동안 "복사됨" 표시 후 복귀 — 그대로 유지
```

`koreanTranslation` 이 null 이면 "한국어 번역" 섹션 **전체를 렌더하지 않는다** —
nullable 컬럼(01 문서 §2.5)과 짝을 이루는 분기이므로 반드시 유지.

### 4.5 `grammar/` (3개)

#### `GrammarText.tsx` (64줄) — 🔴 개념적으로 가장 민감

RN 의 `<Text>` 중첩 인라인 렌더링을 웹에서 재현한다.

```tsx
export function GrammarText({ children, className, onTermPress }: GrammarTextProps) {
  const segments = useMemo(() => {
    const tagged = parseGrammarTags(children);
    if (tagged.some((s) => s.term)) return tagged;
    return parseGrammarTags(autoTagKnownTerms(children));   // 폴백 유지
  }, [children]);

  return (
    <p className={className}>
      {segments.map((seg, i) =>
        seg.term ? (
          <button key={i} type="button"
            aria-label={`${seg.term} 문법 설명 보기`}
            onClick={() => onTermPress(seg.term!)}
            className="inline font-medium text-info underline decoration-info/60">
            {seg.text}
          </button>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </p>
  );
}
```

> `<button>` 을 인라인으로 쓰려면 `display:inline` 을 강제해야 텍스트가 자연스럽게
> 줄바꿈된다. `inline` 클래스 필수.
>
> `onTermPress` 를 **required prop 으로 유지**할 것. 원본 주석:
> "Making it optional meant a screen that forgot to pass it rendered terms as
> ordinary text and looked exactly like feedback with no grammar in it — a failure
> with no symptom."

#### `GrammarTeacherModal.tsx` (352줄) — 바텀시트

```
Modal(animationType="slide", 아래 정렬, maxHeight 85%)
├─ backdrop (flex:1, 탭하면 닫힘)
└─ sheet
   ├─ header: "문법 선생님" / {term} / ✕
   ├─ ScrollView: loading | error+재시도 | ExplanationBody
   │    ExplanationBody = summary / 언제 쓰나요 / 예문 3 / 뉘앙스 / 자주 하는 실수
   └─ footer(explanation 있을 때만): [복습에 저장] ↔ [복습에서 빼기]
```

`navigationBarTranslucent` + `insets.bottom` 보정 → `pb-[env(safe-area-inset-bottom)]`.

#### `GrammarNoteCard.tsx` (222줄) — 🟢 접기/펼치기

`detail` 이 null 이면 "자세히 보기" 토글 자체를 렌더하지 않는 분기 유지.

### 4.6 `chat/TutorChatModal.tsx` (470줄) — 🔴

```
Modal + KeyboardAvoidingView
├─ backdrop
└─ sheet
   ├─ header "AI 선생님 / 질문하기" + ✕
   ├─ ScrollView (ref, 새 메시지마다 60ms 후 scrollToEnd)
   │   ├─ contextCard: 한국어 원문(2줄) + 영어 번역(2줄)
   │   ├─ 빈 상태: STARTERS 3개 버튼
   │   ├─ Bubble[] (user 우측 / model 좌측 / failed 는 별도 스타일 + "전송 실패")
   │   └─ isSending: 스피너 + "선생님이 답을 쓰고 있어요..."
   ├─ errorBar: 에러 문구 + [다시 시도] (canRetry 일 때만)
   └─ composer: textarea(max 300자) + 전송 버튼(↑)
```

**웹 이관 핵심 2가지:**

1. **키보드 대응** — `KeyboardAvoidingView` 는 없다. `visualViewport` 로 시트 높이 조정:
```tsx
const kbInset = useKeyboardInset();   // window.innerHeight - visualViewport.height
<div style={{ paddingBottom: kbInset || 'env(safe-area-inset-bottom)' }}>
```
원본 주석의 규칙 유지: 키보드가 올라오면 safe-area inset 을 **더하지 않는다**
("paying the inset as well would float the composer a finger's width above the keyboard").

2. **마운트 유지** — 원본 주석:
> "Mounted, not conditionally rendered: the sheet owns the conversation, so
> unmounting on close would discard the thread."

`{chatOpen && <TutorChatModal/>}` 로 바꾸면 **대화가 날아간다.** `open` prop 으로만
가시성을 제어할 것. (`result/[id].tsx` 와 `EvaluationDetail.tsx` 두 곳 모두 해당)

STARTERS 3개 문구 유지:
```
'제 번역은 왜 어색한가요?'
'추천 문장이랑 제 문장, 뭐가 다른가요?'
'이 표현은 언제 쓰면 좋을까요?'
```

### 4.7 `monetization/` + `paywall/` + `ads/` (5개)

#### `QuotaMeter.tsx` (138줄) — 🟢

```ts
function meterColor(remaining: number, limit: number): string {
  if (remaining === 0) return Colors.error;              // 빨강
  if (remaining / limit <= 0.34) return Colors.warning;  // 노랑
  return Colors.secondary;                                // 초록
}
```

2 variant: `card`(제목+숫자+ProgressBar+안내문) / `pill`(컴팩트 배지).
**프리미엄이면 `null` 반환** — 유지.

하단 안내 문구 3분기 유지:
- `remaining === 0` → "내일 다시 채워져요. 프리미엄은 제한이 없어요."
- `adGated` → "평가 전에 짧은 광고가 한 번 재생돼요."
- 그 외 → "매일 자정에 다시 채워져요."

#### `QuotaExceededModal.tsx` (253줄) — 🟡

`ADS_PER_BONUS`(2)개의 pip 진행도 표시. 문구는 전부 `QUOTA_FEATURES[feature]` 의
`label`/`limit`/`unit` 에서 조립되므로 **하드코딩 금지**.

```
"오늘의 {label} 횟수를 다 썼어요"
"무료로는 하루에 {label}을 {limit}{unit}까지 이용할 수 있어요. 내일 다시 채워집니다."
"광고 {ADS_PER_BONUS}번 = {AD_BONUS_TRIES}{unit}"
[광고 보기 ({watched}/{ADS_PER_BONUS})]
```

`handlePaywallClose` 규칙 유지:
> "a successful purchase lifts the limit that opened it, so returning to a
> 'you are out of tries' sheet would be a lie."

#### `AdLoadingOverlay.tsx` (55줄) — 🟢
"광고를 불러오는 중..." + "광고가 끝나면 바로 평가가 시작돼요."

#### `Paywall.tsx` (384줄) — 🟡

혜택 목록을 `QUOTA_FEATURE_LIST` 에서 자동 생성한다. 원본 주석:
> "so a limit that changes in `monetization.ts` cannot leave the sales copy
> claiming something different from what the app actually enforces."

```
{label}  하루 {limit}{unit} → 무제한     (×5)
광고 없음  평가 전에 광고를 보지 않아도 돼요
```

플랜 선택: 연간 기본 선택, `annualSavings()` 로 "{N}% 할인" 배지.
상태 4분기(결제 불가 / 로딩 / 상품 없음 / 목록) 유지.

#### `ads/AdBanner.tsx` (61줄) — 🟡
숨김 조건 3가지(프리미엄 / 로드 실패 / 키보드) — 02 문서 §8.3 참조. **반드시 유지**.

---

## 5. 화면 5종 조립 명세

### 5.1 홈 `(main)/page.tsx`

```
📅 {2026년 8월 21일 금요일}                  date-fns ko locale
[StreakBadge]  ← stats.isLoading 이면 Skeleton h=176 r=16
  └ [AttendanceCalendar]
[DailyMessageCard]
── 섹션 헤더 ──
  "오늘의 문장" + "{완료}/{전체} 연습함"      |  [🔄 새 문장 받기]
[QuotaMeter feature="dailySentenceRefresh" variant="pill"]
{refresh 에러 시 에러 문구}
[DailySentenceList]
──────────
[StatsPanel]  ← stats.isLoading 이면 Skeleton h=140
[QuotaExceededModal {...refreshQuota.modal}]
[AdBanner]  ← ScrollView 밖, 화면 하단 고정
```

`RefreshControl`(당겨서 새로고침)은 `sentences.refetch()` + `stats.refetch()` +
`dailyMessage.refetch()` 3개를 동시 실행한다. 웹에서는 생략하거나
`react-simple-pull-to-refresh` 류로 대체.

### 5.2 자유 입력 `(main)/practice/page.tsx`

```
[KoreanInput]
previous.isLoading && !retrying  → 스피너
showPrevious (= !retrying && previous.data)
  → [PreviousAttempt]
      "✅ 이미 연습한 문장이에요" / "지난 평가 결과예요. 다시 풀어봐도 좋아요."
      [EvaluationDetail]
      [다시 시도하기] [복습에 저장/저장됨]
  → 아니면
      [QuotaMeter feature={quota.feature}]
      "나의 영어 번역"
      {VOICE_INPUT_ENABLED && [InputMethodToggle]}
      useVoice ? [VoiceRecorder] : [TextInputField]
      {useVoice && englishText && [TextInputField]}   ← 전사 결과 편집용
      evaluation.isPending ? "✨ AI가 분석 중..." + Skeleton×3
                           : [✨ 평가 받기 | ✨ 광고 보고 평가 받기]
      {submitError}
[AdBanner] [AdLoadingOverlay] [QuotaExceededModal]
```

`retrying` state 는 `dailySentenceId` 변경 시 리셋된다 (원본: 탭이 상주하므로 필요).
웹에서는 페이지 리마운트로 자동 초기화되지만 **로직은 그대로 두는 편이 안전**하다
(Zustand 가 값을 유지하므로 같은 상황이 재현될 수 있다).

### 5.3 주제별 연습 `(main)/topics/page.tsx`

3 phase (§2.4). Phase 3 의 스켈레톤은 **5개**(`[0,1,2,3,4].map`) — 5문장 생성과 일치.

문장 카드: `Badge`(난이도) + `Badge "🔍 트렌드"`(isGrounded) + `✅ 연습함`(completed).
소개 문구 "관심 있는 주제를 골라 5문장을 연습해 보세요." 유지.

### 5.4 복습 `(main)/review/page.tsx`

```
"오늘 복습할 카드: {N}장"
{문법 노트 있으면}
  📘 문법 노트
  "번역 없이 읽기만 하면 되는 카드예요..."
  [GrammarNoteCard]×N
{카드 없으면} "복습할 카드가 없어요. 평가 결과에서 «복습에 저장»을..."
{카드}
  [ReviewFlashcard]×N
    카운터 {i+1}/{N} + 🗑 삭제
    한국어 원문 (중앙, 2xl)
    [ReviewAttemptPanel]  ← 앞면에 위치. 채점하면 onScored → reveal
    {revealed} "정답" + bestEnglish
    [탭해서 정답 보기 / 숨기기]
    {revealed} [ReviewEvaluationDetail] ← 원래 평가 전체 리플레이
[ProgressBar revealedCount/total] + "{n}/{N} 완료"
[AdBanner]
```

`Alert.alert` 확인 다이얼로그 2개(카드 삭제 / 노트 삭제)를 TDS 다이얼로그로 교체.
문구 유지: `«{koreanText}»\n복습 목록에서만 빠지고, 지금까지의 복습 기록은 그대로 남아요.`

### 5.5 결과 `result/[id]/page.tsx`

```
헤더 우측: [공유 ↗]   → navigator.share()
[ScoreCard]
[Card outlined] "원문" / koreanText / "나의 번역" / englishInput
[FeedbackPanel]
[RecommendationList]
[선생님께 질문하기]
[다시 해보기] [복습에 저장/저장됨]
[GrammarTeacherModal] [TutorChatModal]  ← 둘 다 상시 마운트
```

공유 텍스트 포맷 유지:
```
{koreanText}

내 번역: {englishInput}
추천 표현: {recommendations[0]?.sentence ?? englishInput}
종합 점수: {overallScore}점
```

```ts
// Share.share → Web Share API (미지원 시 클립보드 폴백)
const handleShare = async () => {
  const message = `...`;
  if (navigator.share) { await navigator.share({ text: message }).catch(() => {}); return; }
  await navigator.clipboard.writeText(message);
  toast('클립보드에 복사했어요');
};
```

`[다시 해보기]` 는 `router.replace('/free-input')` → `router.replace('/practice')`.

---

## 6. 접근성 이관

원본은 접근성이 잘 갖춰져 있다. **누락 없이 옮긴다.**

| RN | HTML |
|---|---|
| `accessibilityRole="button"` | `<button type="button">` |
| `accessibilityRole="link"` | `<a>` 또는 `role="link"` |
| `accessibilityRole="tab"` / `"tablist"` | `role="tab"` / `role="tablist"` |
| `accessibilityRole="radio"` | `role="radio"` + `aria-checked` |
| `accessibilityRole="progressbar"` + `accessibilityValue` | `role="progressbar"` + `aria-valuenow/min/max` |
| `accessibilityLabel` | `aria-label` |
| `accessibilityState={{ disabled }}` | `disabled` 속성 |
| `accessibilityState={{ busy }}` | `aria-busy` |
| `accessibilityState={{ expanded }}` | `aria-expanded` |
| `accessibilityState={{ selected }}` | `aria-selected` |

`Modal` → `<dialog>` 또는 Radix 사용 시 **포커스 트랩과 `aria-modal` 이 무료로** 따라온다
(RN Modal 에는 없던 개선).

---

## 7. 체크리스트

- [ ] `Colors` 28색 → CSS 변수, `scoreColor`/`difficultyColor` 런타임 함수 유지
- [ ] `Spacing`/`BorderRadius` → Tailwind 스케일, `layout.ts` 삭제
- [ ] `next/font` + **한글 서체(Pretendard/TDS) 추가**
- [ ] `lineHeight` 곱셈값 → `leading-[N]` 임의값으로 정확히 이식
- [ ] `<View>` → `<div class="flex flex-col">` (기본 flex 함정 30곳 전수 점검)
- [ ] 탭 바 + `env(safe-area-inset-bottom)` + 키보드 시 숨김
- [ ] `topics` 3-phase 를 URL 쿼리로 승격 (BackHandler 제거)
- [ ] `ScoreCircle` SVG + rAF 카운트업, `rotate(-90)` 유지
- [ ] `GrammarText` 인라인 `<button>`, `onTermPress` required 유지
- [ ] `TutorChatModal` / `GrammarTeacherModal` **상시 마운트** (조건부 렌더 금지)
- [ ] `RecommendationList` 3섹션 독립 아코디언 + `koreanTranslation` null 분기
- [ ] `QuotaMeter` 3색 임계값(0 / ≤34% / 그 외) + 3분기 안내 문구
- [ ] `Paywall` 혜택 목록을 `QUOTA_FEATURE_LIST` 에서 자동 생성
- [ ] `AdBanner` 3대 숨김 조건
- [ ] `Alert.alert` 2곳 → TDS 다이얼로그 (문구 그대로)
- [ ] `Share.share` → `navigator.share` + 클립보드 폴백
- [ ] 접근성 속성 전수 이관
- [ ] `prefers-reduced-motion` 대응 추가 (신규)
