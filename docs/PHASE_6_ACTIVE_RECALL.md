# Phase 6: Active Recall Review System

> **Goal**: Implement a spaced-repetition review system using the SM-2 algorithm, with a flashcard-style interface.
> **Estimated Effort**: 1.5 days
> **Depends On**: Phase 5 (review screen placeholder), Phase 1 (review_cards table)
> **Verification**: Review cards appear on their due date, SM-2 algorithm correctly schedules next reviews, flashcard UI flips and transitions smoothly.

---

## Step 6.1 — SM-2 Algorithm Implementation

**`src/utils/sm2.ts`**

The SuperMemo SM-2 algorithm determines when to show a card again based on the user's self-assessment of difficulty.

```typescript
export interface SM2Result {
  easeFactor: number;     // Ease factor (min 1.3)
  intervalDays: number;   // Days until next review
  repetitions: number;    // Number of successful consecutive reviews
  nextReviewDate: string; // ISO date string (YYYY-MM-DD)
}

export type ReviewQuality = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * SM-2 Algorithm
 * 
 * Quality ratings:
 * 0 - Complete failure ("다시")
 * 1 - Mostly wrong (with hints)
 * 2 - Wrong but remembered after seeing answer
 * 3 - Correct with difficulty ("어려움")
 * 4 - Correct with hesitation ("보통")
 * 5 - Perfect recall ("쉬움")
 * 
 * Simplified for the app UI:
 * "다시" = 0 | "어려움" = 3 | "보통" = 4 | "쉬움" = 5
 */
export function calculateSM2(
  quality: ReviewQuality,
  currentRepetitions: number,
  currentEaseFactor: number,
  currentInterval: number,
): SM2Result {
  let repetitions: number;
  let easeFactor: number;
  let intervalDays: number;

  if (quality < 3) {
    // Failed: reset repetitions, show again soon
    repetitions = 0;
    easeFactor = currentEaseFactor;
    intervalDays = 1; // Show again tomorrow
  } else {
    // Successful recall
    repetitions = currentRepetitions + 1;

    // Calculate new interval
    if (currentRepetitions === 0) {
      intervalDays = 1;       // First success: review tomorrow
    } else if (currentRepetitions === 1) {
      intervalDays = 6;       // Second success: review in 6 days
    } else {
      intervalDays = Math.round(currentInterval * currentEaseFactor);
    }

    // Update ease factor
    easeFactor = Math.max(
      1.3,
      currentEaseFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    );
  }

  // Calculate next review date
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + intervalDays);
  const nextReviewDate = nextDate.toISOString().split('T')[0]; // YYYY-MM-DD

  return {
    easeFactor: Math.round(easeFactor * 100) / 100, // 2 decimal places
    intervalDays,
    repetitions,
    nextReviewDate,
  };
}
```

### SM-2 Behavior Reference

| Quality | Meaning | Interval Change |
|---|---|---|
| 0 ("다시") | Complete failure | Reset to 1 day |
| 3 ("어려움") | Correct but hard | Interval × EF (EF decreases) |
| 4 ("보통") | Correct, normal effort | Interval × EF (EF stays similar) |
| 5 ("쉬움") | Perfect, effortless | Interval × EF (EF increases) |

### Example Progression

For a card reviewed as "보통" (quality=4) each time:

| Review # | Interval | EF | Next Review |
|---|---|---|---|
| 1st | 1 day | 2.50 | Tomorrow |
| 2nd | 6 days | 2.50 | In 6 days |
| 3rd | 15 days | 2.50 | In 15 days |
| 4th | 38 days | 2.50 | In 38 days |
| 5th | 95 days | 2.50 | In ~3 months |

---

## Step 6.2 — Review Hook

**`src/hooks/useReview.ts`**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewRepository } from '@/db/repositories/reviewRepository';
import { calculateSM2, type ReviewQuality } from '@/utils/sm2';

interface ReviewInput {
  cardId: number;
  quality: ReviewQuality;
  currentRepetitions: number;
  currentEaseFactor: number;
  currentInterval: number;
}

export function useReviewMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ReviewInput) => {
      const result = calculateSM2(
        input.quality,
        input.currentRepetitions,
        input.currentEaseFactor,
        input.currentInterval,
      );

      await reviewRepository.updateAfterReview(input.cardId, {
        easeFactor: result.easeFactor,
        intervalDays: result.intervalDays,
        repetitions: result.repetitions,
        nextReviewDate: result.nextReviewDate,
      });

      return result;
    },

    onSuccess: () => {
      // Refresh the due cards list
      queryClient.invalidateQueries({ queryKey: ['reviewCards'] });
    },
  });
}
```

---

## Step 6.3 — Review Zustand Store

**`src/stores/useReviewStore.ts`**

```typescript
import { create } from 'zustand';
import type { ReviewCard } from '@/types/review';

interface ReviewState {
  currentCardIndex: number;
  isAnswerRevealed: boolean;
  completedCount: number;
  totalCount: number;

  initialize: (total: number) => void;
  revealAnswer: () => void;
  nextCard: () => void;
  reset: () => void;
}

export const useReviewStore = create<ReviewState>((set) => ({
  currentCardIndex: 0,
  isAnswerRevealed: false,
  completedCount: 0,
  totalCount: 0,

  initialize: (total) => set({
    currentCardIndex: 0,
    isAnswerRevealed: false,
    completedCount: 0,
    totalCount: total,
  }),

  revealAnswer: () => set({ isAnswerRevealed: true }),

  nextCard: () => set((state) => ({
    currentCardIndex: state.currentCardIndex + 1,
    isAnswerRevealed: false,
    completedCount: state.completedCount + 1,
  })),

  reset: () => set({
    currentCardIndex: 0,
    isAnswerRevealed: false,
    completedCount: 0,
    totalCount: 0,
  }),
}));
```

---

## Step 6.4 — Review Screen Implementation

**`app/(tabs)/review.tsx`**

### Screen States

#### 1. Empty State (No Cards Due)
```
┌─────────────────────────────────┐
│                                 │
│         🎉                      │
│                                 │
│  오늘의 복습을 모두 완료했어요!  │
│                                 │
│  다음 복습: 내일                 │
│  총 복습 카드: 23장              │
│                                 │
│  ┌───────────────────────────┐  │
│  │   새로운 문장 학습하기     │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

#### 2. Question Side (Answer Hidden)
```
┌─────────────────────────────────┐
│  복습  2/5                      │
│  ████████░░░░░░░░ 40%           │
├─────────────────────────────────┤
│                                 │
│  ┌───────────────────────────┐  │
│  │                           │  │
│  │                           │  │
│  │  "그 사람이 무슨 의도로   │  │
│  │   그런 말을 했는지        │  │
│  │   모르겠어."              │  │
│  │                           │  │
│  │                           │  │
│  │                           │  │
│  │   💡 영어로 어떻게        │  │
│  │      말할까요?            │  │
│  │                           │  │
│  │                           │  │
│  └───────────────────────────┘  │
│                                 │
│  ┌───────────────────────────┐  │
│  │     탭해서 정답 보기       │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

#### 3. Answer Revealed
```
┌─────────────────────────────────┐
│  복습  2/5                      │
│  ████████░░░░░░░░ 40%           │
├─────────────────────────────────┤
│                                 │
│  ┌───────────────────────────┐  │
│  │ 🇰🇷 그 사람이 무슨 의도로 │  │
│  │ 그런 말을 했는지 모르겠어. │  │
│  │                           │  │
│  │ ─────────────────────     │  │
│  │                           │  │
│  │ 🇺🇸 "I don't know what   │  │
│  │ he meant by saying that." │  │
│  │                           │  │
│  └───────────────────────────┘  │
│                                 │
│  얼마나 잘 기억했나요?           │
│                                 │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐  │
│  │다시│ │어려│ │보통│ │쉬움│  │
│  │1일 │ │4일 │ │10일│ │25일│  │
│  └────┘ └────┘ └────┘ └────┘  │
└─────────────────────────────────┘
```

### Quality Buttons

Each button shows:
- Label: "다시" / "어려움" / "보통" / "쉬움"
- Next review interval (calculated from SM-2)
- Color coding: Red / Orange / Blue / Green

```typescript
const qualityButtons = [
  { label: '다시', quality: 0, color: Colors.error },
  { label: '어려움', quality: 3, color: Colors.warning },
  { label: '보통', quality: 4, color: Colors.info },
  { label: '쉬움', quality: 5, color: Colors.success },
];
```

---

## Step 6.5 — Flashcard Component

**`src/components/review/Flashcard.tsx`**

```typescript
interface FlashcardProps {
  koreanText: string;
  englishText: string;
  isRevealed: boolean;
  onReveal: () => void;
}
```

### Animation: Card Flip

Use `react-native-reanimated` for a 3D flip animation:

```typescript
// Front → Back flip animation
// - Front face: Korean text (question)
// - Back face: Korean + English (answer)
// - Triggered on tap or "정답 보기" button
// - Duration: 400ms
// - Easing: Spring
// - 3D rotation around Y-axis (0° → 180°)
// - Front face: rotateY 0° → 90° (fade out at 90°)
// - Back face: rotateY -90° → 0° (fade in at -90°)
```

---

## Step 6.6 — Review Session Complete Screen

After all cards are reviewed:

```
┌─────────────────────────────────┐
│                                 │
│         🎉 완료!                │
│                                 │
│  오늘 5장의 카드를 복습했어요    │
│                                 │
│  ┌───────────────────────────┐  │
│  │ 쉬움    ████████████  3장  │  │
│  │ 보통    ██████         1장  │  │
│  │ 어려움  ███            1장  │  │
│  │ 다시    ░              0장  │  │
│  └───────────────────────────┘  │
│                                 │
│  다음 복습: 내일 (3장 예정)      │
│                                 │
│  ┌───────────────────────────┐  │
│  │        홈으로 돌아가기     │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

---

## Step 6.7 — Auto-Create Review Cards

Review cards are automatically created when an evaluation is saved. This is already handled in `useEvaluation.ts` (Phase 2):

```typescript
// In useEvaluation mutation onSuccess:
if (response.recommendations.length > 0) {
  await reviewRepository.create({
    evaluationId,
    koreanText: input.koreanText,
    bestEnglish: response.recommendations[0].sentence,
  });
}
```

The card's initial values:
- `easeFactor`: 2.5 (default)
- `intervalDays`: 1 (review tomorrow)
- `repetitions`: 0
- `nextReviewDate`: today's date (available immediately for review)

---

## Step 6.8 — Review Statistics (Optional Enhancement)

**`src/hooks/useReviewStats.ts`**

```typescript
export function useReviewStats() {
  return useQuery({
    queryKey: ['reviewStats'],
    queryFn: async () => {
      const allCards = await reviewRepository.getAll();
      const dueToday = await reviewRepository.getDueCards();

      return {
        totalCards: allCards.length,
        dueToday: dueToday.length,
        averageEaseFactor: calculateAverage(allCards.map(c => c.easeFactor)),
        longestInterval: Math.max(...allCards.map(c => c.intervalDays), 0),
        matureCards: allCards.filter(c => c.intervalDays >= 21).length,
      };
    },
  });
}
```

---

## Verification Checklist

- [ ] SM-2 algorithm produces correct results:
  - Quality 0 → interval resets to 1 day
  - Quality 4 → intervals grow: 1 → 6 → 15 → 38 → ...
  - Quality 5 → intervals grow faster (higher EF)
  - Quality 3 → intervals grow slower (lower EF)
  - EF never drops below 1.3
- [ ] Review cards appear on their `next_review_date`
- [ ] Cards NOT due today are hidden from the review queue
- [ ] Flashcard flip animation is smooth
- [ ] Quality buttons show correct next-review intervals
- [ ] After selecting quality, card advances to next
- [ ] After all cards reviewed, completion screen appears
- [ ] Review statistics are accurate
- [ ] New evaluation → review card is auto-created
- [ ] Empty state shows correctly when no cards are due

---

## Next Steps

After Phase 6 is complete, the core application is fully functional! Consider:

1. **Polish & Bug Fixes** — Test edge cases, improve animations
2. **Offline Mode** — Queue evaluations when offline, sync when connected
3. **Statistics Dashboard** — Learning progress graphs, streak tracking
4. **Notifications** — Daily reminders for reviews
5. **Export/Backup** — Export learning data
6. **Backend Proxy** — Move API keys to a secure backend
