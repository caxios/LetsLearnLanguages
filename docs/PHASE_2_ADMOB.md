# Phase 2: Google AdMob Integration

You are working on an Expo React Native app (SDK 57). In Phase 1, we implemented a local quota system. This phase integrates Google AdMob for free users.

---

## Task 1: Setup and Config ✅ COMPLETED

> Already done during Phase 1 monetization implementation.

- [x] `react-native-google-mobile-ads` installed via `npx expo install`
- [x] `app.json` configured with test App IDs under the `"react-native-google-mobile-ads"` plugin:
  - Android: `ca-app-pub-3940256099942544~3347511713`
  - iOS: `ca-app-pub-3940256099942544~1458002511`
- [x] `src/constants/ads.ts` created with test rewarded ad unit IDs and environment variable fallback for production IDs
- [x] `src/services/ads.ts` created with lazy module loading (graceful fallback when native module is absent, e.g. Expo Go / web)
- [x] `initializeAds()` called on app startup in `app/_layout.tsx`

## Task 2: Banner Ads — 🔲 TODO (Next Up)

Implement a small banner ad strip at the bottom of every main tab screen for free users.

### 2-1. Create a reusable `AdBanner` component
- Create `src/components/ads/AdBanner.tsx`.
- Use `BannerAd` from `react-native-google-mobile-ads` with `BannerAdSize.ANCHORED_ADAPTIVE_BANNER`.
- Use Google's test banner ad unit IDs during development:
  - Android: `ca-app-pub-3940256099942544/6300978111`
  - iOS: `ca-app-pub-3940256099942544/2934735716`
- Add these test IDs to `src/constants/ads.ts` following the same pattern as the existing `rewardedAdUnitId()` (with env variable fallback for production).
- The component must check `useMonetizationStore().isPremium` — if `true`, render nothing (`return null`).
- Handle ad load failures gracefully (hide the banner silently, do not crash).

### 2-2. Add `AdBanner` to all 4 tab screens
- Place the `AdBanner` at the **bottom** of each tab screen layout:
  - `app/(tabs)/index.tsx` (오늘의 문장 / Home)
  - `app/(tabs)/free-input.tsx` (자유 입력)
  - `app/(tabs)/topics.tsx` (주제별 연습)
  - `app/(tabs)/review.tsx` (복습)
- Make sure the banner does not overlap with any content or the bottom navigation bar. Use `useSafeAreaInsets` if needed.

### 2-3. Rules
- Premium users must NEVER see the banner.
- The banner must not interfere with keyboard input or scrollable content.

## Task 3: Interstitial Ads — ❌ NOT IMPLEMENTED (Optional)

> Interstitial ads were originally planned but are NOT currently in the codebase. Consider whether they are still desired.

1. Create a hook or utility `useInterstitialAd.ts` to preload an interstitial ad.
2. In the Evaluation Result screen (`app/result/[id].tsx`), show this interstitial ad when the user taps the "Back" or "Done" button to leave the screen.
3. Logic: Only show the ad if the user is NOT premium, and only show it once every 2-3 evaluations to avoid spamming the user.

## Task 4: Rewarded Ads (Extra Quota) ✅ COMPLETED

> Fully implemented during Phase 1 quota system work.

- [x] `showRewardedAd()` in `src/services/ads.ts` — loads, presents, and resolves with `'rewarded' | 'dismissed' | 'unavailable'`
- [x] `QuotaExceededModal.tsx` — "광고 보고 +N회 받기" button calls `showRewardedAd()` and grants bonus tries via `useMonetizationStore.grantBonus()`
- [x] `AdLoadingOverlay.tsx` — loading spinner shown while ad is being served
- [x] `useAdGate.ts` / `useGatedAction` hook — ad-gates evaluation actions for free users (mandatory ad before each evaluation submit)
- [x] Graceful error handling: ad load failures resolve as `'unavailable'`, never crash the app
- [x] Timeout: 12-second load timeout (`AD_LOAD_TIMEOUT_MS`) prevents indefinite waiting

## Remaining Work (Pre-Launch)

### Required before production release:
1. **Replace test Ad IDs with real ones**: Set environment variables `EXPO_PUBLIC_ADMOB_REWARDED_ANDROID` and `EXPO_PUBLIC_ADMOB_REWARDED_IOS` with real AdMob unit IDs from the Google AdMob console.
2. **Replace test App IDs in `app.json`**: Swap the test `androidAppId` and `iosAppId` with the real ones from the AdMob dashboard.
3. **Rebuild the app**: Since AdMob IDs are baked into the native layer via `app.json`, a new EAS build (`npx eas build`) is required after changing them.

### Optional enhancements:
- Decide whether to add Banner Ads (Task 2) and/or Interstitial Ads (Task 3).
- Add analytics tracking for ad impressions and reward completions.

## Rules:
- Handle ad loading states gracefully (don't freeze the app if an ad fails to load). ✅ Already implemented.
- Do not show any ads to premium users. ✅ Already enforced via `useGatedAction` and `isPremium` checks.
