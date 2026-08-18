# Phase 2: Google AdMob Integration

You are working on an Expo React Native app (SDK 57). In the previous phase, we implemented a local quota system. Now, we are integrating Google AdMob for free users.

## Task 1: Setup and Config
1. Install the library: `npx expo install react-native-google-mobile-ads`
2. Add the required configuration to `app.json` under the `"react-native-google-mobile-ads"` plugin section. Use test App IDs for now.

## Task 2: Banner Ads
1. Create a `BannerAd.tsx` component in `src/components/ads/`.
2. Add this Banner ad to the bottom of the Home screen (`app/(tabs)/index.tsx`).
3. Ensure the banner is ONLY rendered if `useMonetizationStore().isPremium` is `false`.

## Task 3: Interstitial Ads
1. Create a hook or utility `useInterstitialAd.ts` to preload an interstitial ad.
2. In the Evaluation Result screen (`app/result/[id].tsx`), show this interstitial ad when the user taps the "Back" or "Done" button to leave the screen.
3. Logic: Only show the ad if the user is NOT premium, and only show it once every 2-3 evaluations to avoid spamming the user.

## Task 4: Rewarded Ads (Extra Quota)
1. Create a hook `useRewardedAd.ts` to preload a rewarded ad.
2. Update the `QuotaExceededModal.tsx` we created in Phase 1. Activate the "Watch Ad for +2 Tries" button.
3. When tapped, show the rewarded ad. If the user successfully watches it, update the `useMonetizationStore`: increment a `rewardedAdsWatched` counter, and decrement the `evaluationCount` by 2 (effectively giving them 2 more tries).
4. Limit rewarded ads to 3 times per day.

## Rules:
- Handle ad loading states gracefully (don't freeze the app if an ad fails to load).
- Do not show any ads to premium users.
