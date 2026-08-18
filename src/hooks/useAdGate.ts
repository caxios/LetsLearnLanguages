import { useCallback, useRef, useState } from 'react';

import { showRewardedAd, type AdOutcome } from '@/services/ads';
import { useMonetizationStore } from '@/stores/useMonetizationStore';

/**
 * Shows a rewarded ad and reports whether the caller may proceed.
 *
 * Premium never sees an ad. Free users do, with one deliberate exception: when
 * no ad can be served at all — Expo Go, web, no network, no fill — the action is
 * let through anyway. Failing closed would make the app unusable whenever the ad
 * network is down, which costs far more than the impression is worth.
 */
export function useAdGate() {
  const isPremium = useMonetizationStore((s) => s.isPremium);
  const [isShowingAd, setShowingAd] = useState(false);

  // Guards the double-tap: a second press while the ad is in flight is ignored.
  const inFlight = useRef(false);

  const requestAd = useCallback(async (): Promise<AdOutcome> => {
    if (isPremium) return 'unavailable';
    if (inFlight.current) return 'dismissed';

    inFlight.current = true;
    setShowingAd(true);
    try {
      return await showRewardedAd();
    } finally {
      inFlight.current = false;
      setShowingAd(false);
    }
  }, [isPremium]);

  /**
   * Run `action` behind an ad. Returns whatever `action` returned, or
   * `undefined` when the user dismissed the ad early and it never ran.
   */
  const runBehindAd = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
      if (!isPremium) {
        const outcome = await requestAd();
        if (outcome === 'dismissed') return undefined;
      }
      return action();
    },
    [isPremium, requestAd]
  );

  return { isShowingAd, requestAd, runBehindAd };
}
