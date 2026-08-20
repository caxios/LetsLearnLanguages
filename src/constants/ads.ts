import { Platform } from 'react-native';

/**
 * Google's public rewarded test units. These always fill and never bill a real
 * advertiser, which is what development and CI must use — serving live ads to
 * your own build is a policy violation that can get an AdMob account banned.
 */
const TEST_REWARDED = {
  android: 'ca-app-pub-3940256099942544/5224354917',
  ios: 'ca-app-pub-3940256099942544/1712485313',
} as const;

/** Google's public banner test unit. Same reasoning as the rewarded one above. */
const TEST_BANNER = {
  android: 'ca-app-pub-3940256099942544/6300978111',
  ios: 'ca-app-pub-3940256099942544/2934735716',
} as const;

/**
 * Real unit IDs come from the environment so they never land in git.
 * Anything missing falls back to the test unit rather than breaking the flow.
 *
 * The `process.env.EXPO_PUBLIC_*` reads have to stay written out in full —
 * Expo inlines them textually at build time, so a computed key resolves to
 * undefined in a release build.
 */
function pickUnit(test: { android: string; ios: string }, live: { android?: string; ios?: string }) {
  const testUnit = Platform.OS === 'ios' ? test.ios : test.android;
  if (__DEV__) return testUnit;

  return Platform.select({ android: live.android, ios: live.ios, default: undefined }) || testUnit;
}

export function rewardedAdUnitId(): string {
  return pickUnit(TEST_REWARDED, {
    android: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID,
    ios: process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS,
  });
}

export function bannerAdUnitId(): string {
  return pickUnit(TEST_BANNER, {
    android: process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID,
    ios: process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS,
  });
}

/**
 * How long to wait for an ad to fill before giving up and letting the action
 * through. Long enough for a slow network, short enough not to feel broken.
 */
export const AD_LOAD_TIMEOUT_MS = 12_000;
