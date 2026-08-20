import { Platform } from 'react-native';

import { AD_LOAD_TIMEOUT_MS, rewardedAdUnitId } from '@/constants/ads';

/**
 * - `rewarded`   the user watched it through and earned the reward
 * - `dismissed`  the user closed it early, so the gated action must not run
 * - `unavailable` no ad could be shown at all (no native module, no fill, error)
 */
export type AdOutcome = 'rewarded' | 'dismissed' | 'unavailable';

type AdsModule = typeof import('react-native-google-mobile-ads');

// `undefined` means "not tried yet", `null` means "tried and not available".
let adsModule: AdsModule | null | undefined;

/**
 * AdMob is a native module: it is absent in Expo Go and on web, and requiring it
 * there throws. Resolving it lazily keeps those environments running with ads
 * simply switched off, instead of crashing at import time.
 */
function getAdsModule(): AdsModule | null {
  if (adsModule !== undefined) return adsModule;

  if (Platform.OS === 'web') {
    adsModule = null;
    return adsModule;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    adsModule = require('react-native-google-mobile-ads') as AdsModule;
  } catch {
    adsModule = null;
  }

  return adsModule;
}

/** True when a real ad can be served — used to word the UI honestly. */
export function areAdsAvailable(): boolean {
  return getAdsModule() !== null;
}

/**
 * The banner pieces, or `null` where AdMob is not present.
 *
 * `BannerAd` is a component, so it cannot be imported at module scope like the
 * rest of the app's components — the require has to stay behind the same lazy
 * guard everything else here uses.
 */
export function getBannerAd(): Pick<AdsModule, 'BannerAd' | 'BannerAdSize'> | null {
  const module = getAdsModule();
  if (!module) return null;

  return { BannerAd: module.BannerAd, BannerAdSize: module.BannerAdSize };
}

let initialized: Promise<unknown> | null = null;

/** Idempotent; safe to call on every app start. */
export function initializeAds(): Promise<unknown> {
  if (initialized) return initialized;

  const module = getAdsModule();
  if (!module) {
    initialized = Promise.resolve(null);
    return initialized;
  }

  initialized = module.MobileAds().initialize().catch(() => null);
  return initialized;
}

/**
 * Load and present one rewarded ad, resolving once the user is back in the app.
 *
 * Never rejects. A failure to load is reported as `unavailable` rather than an
 * error, because the caller's decision is the same either way: an ad that cannot
 * be served must not cost the user the feature they asked for.
 */
export async function showRewardedAd(): Promise<AdOutcome> {
  const module = getAdsModule();
  if (!module) return 'unavailable';

  try {
    const { AdEventType, RewardedAd, RewardedAdEventType } = module;
    const ad = RewardedAd.createForAdRequest(rewardedAdUnitId(), {
      requestNonPersonalizedAdsOnly: true,
    });

    return await new Promise<AdOutcome>((resolve) => {
      const unsubscribers: (() => void)[] = [];
      let earned = false;
      let settled = false;

      const loadTimer = setTimeout(() => finish('unavailable'), AD_LOAD_TIMEOUT_MS);

      function finish(outcome: AdOutcome) {
        if (settled) return;
        settled = true;
        clearTimeout(loadTimer);
        unsubscribers.forEach((off) => off());
        resolve(outcome);
      }

      unsubscribers.push(
        ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
          // The ad filled, so the timeout has done its job — watching it may
          // take as long as the user likes from here.
          clearTimeout(loadTimer);
          ad.show().catch(() => finish('unavailable'));
        })
      );

      unsubscribers.push(
        ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
          earned = true;
        })
      );

      // CLOSED always follows a shown ad, whether or not the reward was earned.
      unsubscribers.push(
        ad.addAdEventListener(AdEventType.CLOSED, () =>
          finish(earned ? 'rewarded' : 'dismissed')
        )
      );

      unsubscribers.push(
        ad.addAdEventListener(AdEventType.ERROR, () => finish('unavailable'))
      );

      ad.load();
    });
  } catch {
    return 'unavailable';
  }
}
