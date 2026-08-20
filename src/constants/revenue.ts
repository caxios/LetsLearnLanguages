import { Platform } from 'react-native';

/**
 * The entitlement identifier configured in the RevenueCat dashboard. Everything
 * the app calls "premium" is decided by whether this entitlement is active.
 */
export const PREMIUM_ENTITLEMENT = 'premium';

/**
 * RevenueCat's public SDK keys.
 *
 * These are safe to ship — they only permit fetching offerings and purchasing
 * for this app — but they still come from the environment so a real project's
 * keys never land in git.
 *
 * `null` when unset, which the service treats exactly like a missing native
 * module: billing is switched off and the app runs unchanged. That is better
 * than a placeholder string, which would look configured and fail at runtime.
 */
export function revenueApiKey(): string | null {
  const key = Platform.select({
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
    default: undefined,
  });

  return key && key.length > 0 ? key : null;
}
