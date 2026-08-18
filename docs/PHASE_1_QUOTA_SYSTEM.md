# Phase 1: Local Quota System & Paywall UI

You are working on an Expo React Native app (SDK 57). Our goal in this phase is to implement a local daily usage quota system for free users and build the foundational UI for limits and premium features.

**IMPORTANT:** DO NOT install `react-native-google-mobile-ads` or `react-native-purchases` yet. We are only building the local state management and UI first.

## Task 1: Constants and Store Setup
1. Create `src/constants/monetization.ts` with the following limits for Free users:
   - `dailyEvaluations: 5`
   - `dailyTopicPractice: 1`
   - `dailyReviews: 3`
2. Create `src/stores/useMonetizationStore.ts` using Zustand and `expo-secure-store` (or AsyncStorage) to persist data.
   - State should include: `isPremium: boolean` (default false), and a `dailyUsage` object: `{ date: string (YYYY-MM-DD), evaluationCount: number, topicPracticeCount: number, reviewCount: number }`.
   - Add actions to increment these counts.
   - Add logic to reset the counts to 0 if the current date does not match the stored `date`.

## Task 2: Implement Quota Checks
Modify the following flows to check for quotas before proceeding. If `isPremium` is true, bypass the limits.
1. **Free Input (Evaluation)**: In `app/(tabs)/free-input.tsx` or the corresponding hook, before calling the evaluate API, check if `evaluationCount < dailyEvaluations`.
2. **Topic Practice**: In `app/(tabs)/topics.tsx` (if it exists), check if `topicPracticeCount < dailyTopicPractice` before generating sentences.
3. **Review**: In the review flow, check if `reviewCount < dailyReviews`.

## Task 3: Quota Exceeded UI (Paywall / Modal)
Create a generic `QuotaExceededModal.tsx` component.
- When a user hits a limit, present this modal instead of executing the action.
- The modal should clearly state they have reached their daily limit for this feature.
- Show two placeholder buttons: "Watch Ad for +2 Tries" (disabled for now) and "Upgrade to Premium" (which simply toggles `isPremium = true` for testing purposes right now).

## Rules:
- Ensure the app works seamlessly. Free users should be blocked at limits, and changing `isPremium` to true should instantly unlock everything.
- Use the existing design system (`Colors`, `Fonts`, `Spacing`).
