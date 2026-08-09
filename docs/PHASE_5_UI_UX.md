# Phase 5: UI/UX Implementation

> **Goal**: Build all screens, design system, and polish the user interface with animations and premium aesthetics.
> **Estimated Effort**: 2.5 days (navigation + basic screens 1 day, polish 1.5 days)
> **Depends On**: Phase 3 (input components), Phase 4 (AI services)
> **Verification**: All screens render correctly, navigation works, inputs trigger evaluations, results display properly.

---

## Step 5.1 — Design System

### Color Palette

**`src/constants/colors.ts`**

```typescript
export const Colors = {
  // Backgrounds
  background: '#0F0F1A',
  surface: '#1A1A2E',
  surfaceLight: '#25253B',
  surfaceElevated: '#2F2F4A',

  // Primary
  primary: '#6C63FF',
  primaryLight: '#8B83FF',
  primaryDark: '#4F46E5',
  primaryMuted: 'rgba(108, 99, 255, 0.15)',

  // Secondary
  secondary: '#00D4AA',
  secondaryLight: '#34E0C0',
  secondaryMuted: 'rgba(0, 212, 170, 0.15)',

  // Scores
  scoreHigh: '#4ADE80',       // Green (80-100)
  scoreMedium: '#FFB347',     // Amber (50-79)
  scoreLow: '#FF6B6B',        // Coral (0-49)

  // Text
  textPrimary: '#FFFFFF',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  textInverse: '#0F0F1A',

  // Borders & Dividers
  border: 'rgba(255, 255, 255, 0.08)',
  borderLight: 'rgba(255, 255, 255, 0.15)',
  divider: 'rgba(255, 255, 255, 0.05)',

  // Status
  success: '#4ADE80',
  warning: '#FBBF24',
  error: '#EF4444',
  info: '#60A5FA',

  // Difficulty badges
  difficultyEasy: '#4ADE80',
  difficultyMedium: '#FBBF24',
  difficultyHard: '#EF4444',
} as const;
```

### Fonts

**`src/constants/fonts.ts`**

```typescript
export const Fonts = {
  // Using expo-google-fonts or bundled fonts
  heading: 'Inter_700Bold',
  headingSemiBold: 'Inter_600SemiBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  mono: 'JetBrainsMono_400Regular', // For scores/numbers
} as const;

export const FontSizes = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
} as const;
```

### Spacing & Borders

```typescript
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
} as const;

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;
```

---

## Step 5.2 — Base UI Components

### ScoreCircle

**`src/components/ui/ScoreCircle.tsx`**

A circular progress indicator for displaying scores.

- **Features**: Animated fill on mount, color changes based on score range, large centered number
- **Props**: `score: number`, `label: string`, `size?: number`
- **Animations**: Use `react-native-svg` with `Animated` to animate the circle stroke

```
    ┌──────────┐
    │   ╭──╮   │
    │  │ 85 │  │  ← Score number (animated count-up)
    │   ╰──╯   │  ← Circular progress (animated fill)
    │ Grammar   │  ← Label below
    └──────────┘
```

Color logic:
- Score ≥ 80 → `Colors.scoreHigh` (green)
- Score ≥ 50 → `Colors.scoreMedium` (amber)
- Score < 50 → `Colors.scoreLow` (coral)

### Card

**`src/components/ui/Card.tsx`**

A reusable card component with glassmorphism effect.

```typescript
interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  onPress?: () => void;
}
```

Style: `backgroundColor: Colors.surface`, `borderRadius: 16`, `border: 1px solid Colors.border`, subtle shadow.

### Badge

**`src/components/ui/Badge.tsx`**

Small label for difficulty, status, etc.

```typescript
interface BadgeProps {
  text: string;
  color: string;
  variant?: 'filled' | 'outline';
}
```

### Button

**`src/components/ui/Button.tsx`**

```typescript
interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
}
```

- Primary: Gradient background (primary → primaryLight)
- Loading: Replace title with ActivityIndicator
- Haptic feedback on press via `expo-haptics`

### ProgressBar

**`src/components/ui/ProgressBar.tsx`**

Horizontal progress bar with animated fill.

```typescript
interface ProgressBarProps {
  progress: number; // 0-1
  color?: string;
  height?: number;
}
```

---

## Step 5.3 — Navigation Structure

### Tab Layout

**`app/(tabs)/_layout.tsx`**

Three tabs with custom icons:

| Tab | Icon | Label | Screen |
|---|---|---|---|
| Home | 🏠 `home` | 오늘의 문장 | Daily Sentences |
| Free Input | ✏️ `edit-3` | 자유 입력 | Free Input |
| Review | 🔄 `refresh-cw` | 복습 | Active Recall |

```typescript
<Tabs
  screenOptions={{
    tabBarStyle: {
      backgroundColor: Colors.surface,
      borderTopColor: Colors.border,
      height: 85,
      paddingBottom: 20,
    },
    tabBarActiveTintColor: Colors.primary,
    tabBarInactiveTintColor: Colors.textMuted,
    headerStyle: {
      backgroundColor: Colors.background,
    },
    headerTintColor: Colors.textPrimary,
  }}
>
```

---

## Step 5.4 — Screen Implementations

### Home Screen (`(tabs)/index.tsx`)

```
┌─────────────────────────────────┐
│  📅 2026년 8월 9일 토요일        │
│  🔥 5일 연속 학습 중             │
├─────────────────────────────────┤
│                                 │
│  오늘의 문장                    │
│                                 │
│  ┌───────────────────────────┐  │
│  │ 🟢 Easy                   │  │
│  │ "오늘 회의 몇 시에 시작해?" │  │
│  │              [번역하기 →]  │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ 🟡 Medium                 │  │
│  │ "그 사람이 무슨 의도로..." │  │
│  │              [번역하기 →]  │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ 🔴 Hard         ✅ Done   │  │
│  │ "이 프로젝트는 예산..."    │  │
│  │              [결과 보기 →] │  │
│  └───────────────────────────┘  │
│                                 │
│  ────────────────────────────── │
│  최근 학습                      │
│  평균 점수: 82점 | 총 23문장    │
└─────────────────────────────────┘
```

#### Components Used:
- `SentenceCard` — Each daily sentence card
- `DailySentenceList` — Scrollable list of 3 cards
- `Badge` — Difficulty indicator
- Custom header with date and streak

#### Data Flow:
```typescript
const { data: sentences, isLoading } = useDailySentences();
// On card press → navigate to free-input with korean text pre-filled
// OR navigate directly to an inline input modal
```

---

### Free Input Screen (`(tabs)/free-input.tsx`)

```
┌─────────────────────────────────┐
│  자유 입력                      │
├─────────────────────────────────┤
│                                 │
│  번역할 한국어 문장              │
│  ┌───────────────────────────┐  │
│  │ 오늘 날씨가 너무 좋아서    │  │
│  │ 산책하고 싶다              │  │
│  └───────────────────────────┘  │
│                                 │
│  나의 영어 번역                  │
│  ┌─ 🎤 Voice ──── ⌨️ Text ──┐  │
│  │                           │  │
│  │  [Voice Recorder UI]      │  │
│  │    or                     │  │
│  │  [Text Input Field]       │  │
│  │                           │  │
│  │  "The weather is so nice  │  │
│  │   today I want to take    │  │
│  │   a walk"                 │  │
│  │                  128/500  │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │    ✨ 평가 받기            │  │
│  └───────────────────────────┘  │
│                                 │
│  [Loading skeleton when         │
│   evaluating...]                │
└─────────────────────────────────┘
```

#### Key Interactions:
1. If navigated from Home with a daily sentence → Korean text pre-filled, focus on English input
2. Toggle between Voice and Text input
3. Submit triggers `useEvaluation` mutation
4. On success → navigate to `result/[id]`
5. Loading state: Skeleton animation with "AI가 분석 중..." message

---

### Result Screen (`result/[id].tsx`)

```
┌─────────────────────────────────┐
│  ← 뒤로                 공유 ↗ │
├─────────────────────────────────┤
│                                 │
│  ┌─────┐  ┌─────┐  ┌─────┐    │
│  │ 82  │  │ 90  │  │ 78  │    │
│  │자연  │  │문법  │  │의미  │    │
│  └─────┘  └─────┘  └─────┘    │
│                                 │
│  ──────────────────────────────│
│  📝 AI 피드백                   │
│  ┌───────────────────────────┐  │
│  │ 전반적으로 좋은 번역입니다! │  │
│  │ 다만 일상 대화에서는 좀 더 │  │
│  │ 자연스러운 표현이 있습니다. │  │
│  └───────────────────────────┘  │
│                                 │
│  💡 추천 표현                   │
│  ┌───────────────────────────┐  │
│  │ "The weather is so nice   │  │
│  │  today that I want to go  │  │
│  │  for a walk."             │  │
│  │                           │  │
│  │  ▼ 뉘앙스 설명            │  │
│  │  ▼ 문법 설명              │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │ "It's such a beautiful    │  │
│  │  day, I feel like going   │  │
│  │  for a walk."             │  │
│  │                           │  │
│  │  ▼ 뉘앙스 설명            │  │
│  │  ▼ 문법 설명              │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌────────────┐ ┌────────────┐  │
│  │ 다시 해보기 │ │ 복습에 추가 │  │
│  └────────────┘ └────────────┘  │
└─────────────────────────────────┘
```

#### Components Used:
- `ScoreCircle` × 3 — Naturalness, Grammar, Meaning Clarity
- `FeedbackPanel` — AI feedback display
- `RecommendationList` — Expandable recommendation cards
- `Button` — "다시 해보기" and "복습에 추가"

#### Animations:
- Score circles animate from 0 to final value on mount (1s duration, ease-out)
- Recommendation cards slide in from bottom with stagger delay
- Feedback panel fades in

---

### Review Screen (`(tabs)/review.tsx`)

> This will be fully implemented in **Phase 6**. For now, create a placeholder screen.

```
┌─────────────────────────────────┐
│  복습                           │
├─────────────────────────────────┤
│                                 │
│  오늘 복습할 카드: 5장           │
│                                 │
│  ┌───────────────────────────┐  │
│  │                           │  │
│  │  "오늘 회의 몇 시에       │  │
│  │   시작해?"                │  │
│  │                           │  │
│  │                           │  │
│  │     [탭해서 정답 보기]     │  │
│  │                           │  │
│  └───────────────────────────┘  │
│                                 │
│  After reveal:                  │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐  │
│  │다시│ │어려│ │보통│ │쉬움│  │
│  │ 0  │ │ 3  │ │ 4  │ │ 5  │  │
│  └────┘ └────┘ └────┘ └────┘  │
│                                 │
│  3/5 완료                       │
└─────────────────────────────────┘
```

---

## Step 5.5 — Evaluation-Specific Components

### ScoreCard

**`src/components/evaluation/ScoreCard.tsx`**

Displays the three score circles in a row.

```typescript
interface ScoreCardProps {
  naturalness: number;
  grammar: number;
  meaningClarity: number;
}
```

### FeedbackPanel

**`src/components/evaluation/FeedbackPanel.tsx`**

Displays the AI's feedback text in a styled card.

```typescript
interface FeedbackPanelProps {
  feedback: string;
}
```

### RecommendationList

**`src/components/evaluation/RecommendationList.tsx`**

Displays a list of expandable recommendation cards.

```typescript
interface RecommendationListProps {
  recommendations: {
    sentence: string;
    contextAndNuance: string;
    grammarExplanation: string;
  }[];
}
```

Each recommendation card:
- English sentence always visible (bold, large)
- "뉘앙스 설명" — collapsible section (animated height)
- "문법 설명" — collapsible section (animated height)
- Copy button to copy the English sentence

---

## Step 5.6 — Daily Sentence Components

### SentenceCard

**`src/components/daily/SentenceCard.tsx`**

```typescript
interface SentenceCardProps {
  koreanText: string;
  difficulty: 'easy' | 'medium' | 'hard';
  isCompleted: boolean;
  onPress: () => void;
}
```

- Difficulty badge (colored: green/amber/red)
- Checkmark overlay when completed
- Press animation (scale down slightly)
- Right arrow indicator "번역하기 →"

### DailySentenceList

**`src/components/daily/DailySentenceList.tsx`**

```typescript
interface DailySentenceListProps {
  sentences: DailySentence[];
  onSentencePress: (sentence: DailySentence) => void;
}
```

- Renders 3 SentenceCards in a vertical list
- Loading skeleton when data is being fetched
- Empty state if generation fails

---

## Step 5.7 — Settings Screen

**`app/settings.tsx`**

- API key input fields (masked, with show/hide toggle)
- Preferred input method selector
- App version info
- Clear all data button (with confirmation)

---

## Step 5.8 — Animations Guide

### Required Animations (using `react-native-reanimated` or `Animated`)

| Animation | Where | Type |
|---|---|---|
| Score count-up | Result screen | Timing (0 → score, 1s, ease-out) |
| Circle progress fill | Result screen | Timing (0 → progress, 1s, ease-out) |
| Card flip | Review screen | Spring (front → back, 3D rotation) |
| Recording pulse | Voice recorder | Loop (scale 1 → 1.3 → 1, infinite) |
| Slide-in from bottom | Recommendation cards | Spring (translateY: 50 → 0, stagger 100ms) |
| Fade in | Feedback panel | Timing (opacity 0 → 1, 500ms) |
| Scale press | All pressable cards | Spring (scale 1 → 0.97 → 1) |
| Skeleton shimmer | Loading states | Loop (translateX, linear, infinite) |

---

## Verification Checklist

- [ ] All 3 tabs render correctly with proper icons and labels
- [ ] Home screen shows daily sentences (or loading skeleton)
- [ ] Tapping a sentence card navigates to input screen with Korean text pre-filled
- [ ] Free Input screen allows Korean text entry + English translation (voice/text)
- [ ] Submit button triggers evaluation and shows loading state
- [ ] Result screen displays scores, feedback, and recommendations
- [ ] Recommendation sections expand/collapse smoothly
- [ ] Score circles animate on mount
- [ ] Recording pulse animation works
- [ ] Settings screen allows API key entry
- [ ] Dark mode colors are applied consistently
- [ ] All text is readable (sufficient contrast ratios)
- [ ] Bottom tab bar is styled and functional

---

## Next Phase

Once all checks pass → proceed to **[Phase 6: Active Recall Review System](./PHASE_6_ACTIVE_RECALL.md)**
