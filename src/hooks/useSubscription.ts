import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import {
  fetchPremiumStatus,
  isBillingAvailable,
  purchaseSubscription,
  restorePurchases,
  type PurchaseOutcome,
  type SubscriptionOption,
} from '@/services/revenue';
import { useMonetizationStore } from '@/stores/useMonetizationStore';

const STATUS_KEY = ['subscription', 'status'] as const;

/**
 * What the stored flag should become given what RevenueCat reported.
 *
 * `null`/`undefined` mean "could not be determined" — no native module, no key,
 * or a failed request. Writing `false` for those would downgrade a paying
 * customer whenever their network dropped, and would strip the test flag on
 * every launch in Expo Go. Only a definite answer moves the flag.
 */
export function nextPremiumState(
  reported: boolean | null | undefined,
  current: boolean
): boolean {
  if (reported === null || reported === undefined) return current;
  return reported;
}

/**
 * Keeps `useMonetizationStore.isPremium` in step with RevenueCat.
 *
 * Mounted once at the root and again wherever a purchase can happen; the query
 * is shared, so the extra mounts cost nothing.
 *
 * The store stays the single source of truth for the rest of the app. Nothing
 * else needs to know that entitlements exist — quota checks keep reading
 * `isPremium` exactly as they did before billing was added.
 */
export function useSubscription() {
  const queryClient = useQueryClient();
  const setPremium = useMonetizationStore((s) => s.setPremium);
  const isPremium = useMonetizationStore((s) => s.isPremium);

  const status = useQuery({
    queryKey: STATUS_KEY,
    queryFn: fetchPremiumStatus,
    // Entitlements change rarely and only through actions we already refetch on.
    staleTime: 5 * 60 * 1000,
    // Billing being unreachable is not worth retrying into; the service already
    // reports that as `null` rather than an error.
    retry: false,
  });

  const answer = status.data;

  useEffect(() => {
    const next = nextPremiumState(answer, isPremium);
    if (next !== isPremium) setPremium(next);
  }, [answer, isPremium, setPremium]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: STATUS_KEY });

  const purchase = useMutation({
    mutationFn: (option: SubscriptionOption) => purchaseSubscription(option),
    onSuccess: (outcome: PurchaseOutcome) => {
      // A cancelled purchase changes nothing, so it does not need a refetch.
      if (outcome.status === 'purchased') {
        setPremium(true);
        refresh();
      }
    },
  });

  const restore = useMutation({
    mutationFn: restorePurchases,
    onSuccess: (restored) => {
      if (restored === null) return;
      setPremium(restored);
      refresh();
    },
  });

  return {
    isPremium,
    /** True only while the very first check is in flight. */
    isChecking: status.isLoading,
    isAvailable: isBillingAvailable(),
    purchase,
    restore,
    refresh,
  };
}

/** The offering, fetched only while a paywall is actually open. */
export function useSubscriptionOptions(enabled: boolean) {
  return useQuery({
    queryKey: ['subscription', 'options'],
    queryFn: async () => {
      const { fetchSubscriptionOptions } = await import('@/services/revenue');
      return fetchSubscriptionOptions();
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/**
 * How much the annual plan saves against paying monthly, as a whole percent.
 * `null` when there is nothing to compare or the annual plan is not cheaper.
 */
export function annualSavings(options: SubscriptionOption[]): number | null {
  const monthly = options.find((option) => option.period === 'monthly');
  const annual = options.find((option) => option.period === 'annual');
  if (!monthly || !annual || monthly.price <= 0) return null;

  const percent = Math.round((1 - annual.price / (monthly.price * 12)) * 100);
  return percent > 0 ? percent : null;
}
