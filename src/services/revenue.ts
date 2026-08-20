import { Platform } from 'react-native';
import type { CustomerInfo, PurchasesPackage } from 'react-native-purchases';

import { PREMIUM_ENTITLEMENT, revenueApiKey } from '@/constants/revenue';

/**
 * - `purchased` the entitlement is now active
 * - `cancelled` the user backed out; not an error, and nothing should be shown
 * - `failed`    the store or network refused; the message is worth showing
 */
export type PurchaseOutcome =
  | { status: 'purchased' }
  | { status: 'cancelled' }
  | { status: 'failed'; message: string };

/** One buyable subscription, flattened so the UI never touches RevenueCat types. */
export interface SubscriptionOption {
  id: string;
  period: 'monthly' | 'annual' | 'other';
  /** Already localised and currency-formatted by the store. */
  priceString: string;
  /** The raw number, only for comparing plans against each other. */
  price: number;
  title: string;
  /** Handed straight back to `purchaseSubscription`. */
  pkg: PurchasesPackage;
}

type PurchasesModule = typeof import('react-native-purchases');

// `undefined` means "not tried yet", `null` means "tried and not available".
let purchasesModule: PurchasesModule | null | undefined;

/**
 * RevenueCat is a native module: it is absent in Expo Go and on web, and
 * requiring it there throws. Resolving it lazily keeps those environments
 * running with billing simply switched off, instead of crashing at import time.
 */
function getPurchases(): PurchasesModule['default'] | null {
  if (purchasesModule === undefined) {
    if (Platform.OS === 'web') {
      purchasesModule = null;
    } else {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        purchasesModule = require('react-native-purchases') as PurchasesModule;
      } catch {
        purchasesModule = null;
      }
    }
  }

  return purchasesModule?.default ?? null;
}

/**
 * True when a purchase could actually be made — the native module is present
 * AND a key is configured. Used to word the UI honestly rather than offering a
 * buy button that cannot work.
 */
export function isBillingAvailable(): boolean {
  return getPurchases() !== null && revenueApiKey() !== null;
}

let initialized: Promise<boolean> | null = null;

/** Idempotent; safe to call on every app start. Resolves false when unavailable. */
export function initializeRevenue(): Promise<boolean> {
  if (initialized) return initialized;

  const purchases = getPurchases();
  const apiKey = revenueApiKey();

  if (!purchases || !apiKey) {
    initialized = Promise.resolve(false);
    return initialized;
  }

  initialized = (async () => {
    try {
      await purchases.configure({ apiKey });
      return true;
    } catch {
      return false;
    }
  })();

  return initialized;
}

function periodOf(pkg: PurchasesPackage): SubscriptionOption['period'] {
  const type = String(pkg.packageType).toUpperCase();
  if (type === 'ANNUAL') return 'annual';
  if (type === 'MONTHLY') return 'monthly';
  return 'other';
}

/**
 * The packages on the current offering, cheapest period first.
 *
 * Returns an empty array rather than throwing when billing is unavailable or
 * the dashboard has no offering configured — the paywall renders a plain
 * "unavailable" state from that, which is what the user should see either way.
 */
export async function fetchSubscriptionOptions(): Promise<SubscriptionOption[]> {
  const purchases = getPurchases();
  if (!purchases || !(await initializeRevenue())) return [];

  try {
    const offerings = await purchases.getOfferings();
    const packages = offerings.current?.availablePackages ?? [];

    return packages
      .map((pkg) => ({
        id: pkg.identifier,
        period: periodOf(pkg),
        priceString: pkg.product.priceString,
        price: pkg.product.price,
        title: pkg.product.title,
        pkg,
      }))
      .sort((a, b) => a.price - b.price);
  } catch {
    return [];
  }
}

/** Whether this customer info carries an active premium entitlement. */
function isPremiumInfo(info: CustomerInfo): boolean {
  return info.entitlements.active[PREMIUM_ENTITLEMENT] !== undefined;
}

/**
 * Buy one package.
 *
 * Never throws. A user backing out of the store sheet is reported as
 * `cancelled`, which the UI must treat as an ordinary outcome — showing an
 * error for a deliberate "no" is the most common paywall mistake.
 */
export async function purchaseSubscription(option: SubscriptionOption): Promise<PurchaseOutcome> {
  const purchases = getPurchases();
  if (!purchases) return { status: 'failed', message: '이 기기에서는 결제를 사용할 수 없어요.' };

  try {
    const { customerInfo } = await purchases.purchasePackage(option.pkg);

    return isPremiumInfo(customerInfo)
      ? { status: 'purchased' }
      : {
          status: 'failed',
          message: '결제는 완료됐지만 아직 반영되지 않았어요. 잠시 후 "구매 복원"을 눌러 주세요.',
        };
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'userCancelled' in error) {
      if ((error as { userCancelled?: boolean }).userCancelled) return { status: 'cancelled' };
    }

    return {
      status: 'failed',
      message: error instanceof Error ? error.message : '결제에 실패했어요.',
    };
  }
}

/**
 * Re-read entitlements from the store, for someone on a new device.
 * Resolves to whether premium is active, or `null` when it could not be checked.
 */
export async function restorePurchases(): Promise<boolean | null> {
  const purchases = getPurchases();
  if (!purchases || !(await initializeRevenue())) return null;

  try {
    return isPremiumInfo(await purchases.restorePurchases());
  } catch {
    return null;
  }
}

/**
 * The current premium status according to RevenueCat.
 *
 * `null` means "could not be determined" — no native module, no key, or the
 * request failed. That is deliberately distinct from `false`: a caller must not
 * downgrade someone just because the network was down.
 */
export async function fetchPremiumStatus(): Promise<boolean | null> {
  const purchases = getPurchases();
  if (!purchases || !(await initializeRevenue())) return null;

  try {
    return isPremiumInfo(await purchases.getCustomerInfo());
  } catch {
    return null;
  }
}
