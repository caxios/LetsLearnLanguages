import { useCallback, useState } from 'react';

import { QUOTA_FEATURES, type QuotaFeature } from '@/constants/monetization';
import { useAdGate } from '@/hooks/useAdGate';
import { remainingFor, useMonetizationStore, usageForToday } from '@/stores/useMonetizationStore';

/**
 * Everything one metered action needs: the remaining count for the UI, the
 * quota check, the ad gate, and the paywall to show when the quota runs out.
 *
 * The order is fixed and deliberate:
 *
 *   check quota → (evaluations only) show ad → run the action → consume
 *
 * Quota is checked first so a user with nothing left never sits through an ad
 * for an action that was going to be refused. Quota is consumed last so a failed
 * API call — or an ad the user backed out of — costs them nothing.
 */
export function useGatedAction(feature: QuotaFeature) {
  const isPremium = useMonetizationStore((s) => s.isPremium);
  const dailyUsage = useMonetizationStore((s) => s.dailyUsage);
  const consumeQuota = useMonetizationStore((s) => s.consume);

  const { isShowingAd, runBehindAd } = useAdGate();
  const [blocked, setBlocked] = useState(false);

  const { limit, countKey, adGated } = QUOTA_FEATURES[feature];
  const used = usageForToday(dailyUsage)[countKey];
  const remaining = remainingFor(feature, isPremium, dailyUsage);

  /** Quota check on its own, for call sites that gate navigation rather than a call. */
  const check = useCallback(() => {
    // Read through the store rather than the render snapshot: the day may have
    // rolled over, or premium may have been granted, since the last render.
    if (useMonetizationStore.getState().hasQuota(feature)) return true;
    setBlocked(true);
    return false;
  }, [feature]);

  const consume = useCallback(() => consumeQuota(feature), [consumeQuota, feature]);

  /**
   * The whole flow for one press. Resolves to `true` when the action ran.
   * Errors thrown by `action` propagate untouched — and cost no quota.
   */
  const run = useCallback(
    async (action: () => Promise<unknown>): Promise<boolean> => {
      if (!check()) return false;

      const execute = async () => {
        await action();
        consume();
        return true;
      };

      // Only evaluations are ad-gated; generating and refreshing are quota-only.
      if (!adGated || isPremium) {
        return execute();
      }

      // `undefined` means the user closed the ad early, so nothing ran.
      return (await runBehindAd(execute)) ?? false;
    },
    [adGated, check, consume, isPremium, runBehindAd]
  );

  const close = useCallback(() => setBlocked(false), []);

  return {
    feature,
    isPremium,
    limit,
    used,
    remaining,
    /** True while a rewarded ad is loading or on screen. */
    isShowingAd,
    /** True when this action is ad-gated for the current user. */
    showsAd: adGated && !isPremium,

    run,
    check,
    consume,

    modal: { visible: blocked, feature, onClose: close },
  };
}
