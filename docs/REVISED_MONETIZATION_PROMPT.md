# Revised Monetization Implementation Prompt

You are working on an Expo React Native app (SDK 57). We are implementing a hybrid monetization strategy: "Daily Quotas + Ad-Gated Actions" for Free users, and "Unlimited & Ad-Free" for Premium users.

Please implement the following requirements. Ensure the code is robust and integrates cleanly with our existing Zustand state management.

## 1. Monetization Rules
For Free users (`isPremium === false`), apply the following daily quotas:
- **Daily Sentences Refresh (`dailySentenceRefresh`)**: Max 2 times per day.
- **Daily Sentences Evaluation (`dailySentenceEvaluation`)**: Max 5 times per day.
- **Topic Practice Generation (`topicPracticeGenerate`)**: Max 2 times per day.
- **Topic Practice Evaluation (`topicPracticeEvaluation`)**: Max 5 times per day.
- **Review Evaluation (`reviewEvaluation`)**: Max 5 times per day.

For Premium users (`isPremium === true`), there are NO limits and NO ads.

## 2. Ad-Gated Evaluations (Free Users Only)
In addition to the quotas above, **every evaluation action** (Daily, Topic, or Review) for a Free user MUST be gated by an ad.
- When a Free user taps the "Evaluate" button, they must first watch a Google AdMob ad (e.g., Rewarded or Interstitial).
- Only after the ad is successfully watched and closed, should the evaluation API be called and the quota consumed.
- If they have 0 quota left for that specific evaluation type, show the `QuotaExceededModal` and do not show the ad.
- You will need to install `react-native-google-mobile-ads` and set up the ad flow.

## 3. Highly Visible Quota UI
The current quota hints are too small and hard to see. Free users need to clearly see their remaining quotas on the relevant screens.
- **Home Screen (`app/(tabs)/index.tsx`)**: Prominently display the remaining `dailySentenceRefresh` quota near the refresh button.
- **Topic Practice Screen (`app/(tabs)/topics.tsx`)**: Prominently display the remaining `topicPracticeGenerate` quota.
- **Evaluation Screen (`app/(tabs)/free-input.tsx` & Review flow)**: Prominently display the remaining evaluation quota (whether it's Daily, Topic, or Review) using a highly visible UI element. 
- *Design Suggestion*: Use a progress bar, a brightly colored badge, or a prominent card at the top of the screen or directly above the action buttons. Do not use tiny gray text.

## 4. Implementation Steps
1. **Update `useMonetizationStore`**: Update the store to track the 5 specific limits mentioned above instead of the old ones.
2. **Install & Setup AdMob**: Install `react-native-google-mobile-ads` and create a `useAdGate` hook that seamlessly handles showing an ad before proceeding with a callback.
3. **Refactor Quota Hooks**: Combine the quota check and the ad gate. For evaluations, the flow should be: `Check Quota -> If OK -> Show Ad -> If Watched -> Execute API -> Consume Quota`.
4. **Update UI**: Redesign the quota remaining indicators on all relevant screens to be highly visible and clear.
