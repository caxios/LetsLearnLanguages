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

/**
 * Real unit IDs come from the environment so they never land in git.
 * Anything missing falls back to the test unit rather than breaking the flow.
 */
function productionUnitId(): string | undefined {
  return Platform.select({
    android: process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID,
    ios: process.env.EXPO_PUBLIC_ADMOB_REWARDED_IOS,
    default: undefined,
  });
}

export function rewardedAdUnitId(): string {
  const testUnit = Platform.OS === 'ios' ? TEST_REWARDED.ios : TEST_REWARDED.android;
  if (__DEV__) return testUnit;
  return productionUnitId() || testUnit;
}

/**
 * How long to wait for an ad to fill before giving up and letting the action
 * through. Long enough for a slow network, short enough not to feel broken.
 */
export const AD_LOAD_TIMEOUT_MS = 12_000;
