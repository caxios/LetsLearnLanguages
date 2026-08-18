import { format } from 'date-fns';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import {
  QUOTA_FEATURES,
  QUOTA_FEATURE_LIST,
  type QuotaFeature,
  type UsageCountKey,
} from '@/constants/monetization';

const STORAGE_KEY = 'monetization_state';

export type DailyUsage = { date: string } & Record<UsageCountKey, number>;

export function todayKey(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

function emptyUsage(date: string = todayKey()): DailyUsage {
  const usage = { date } as DailyUsage;
  QUOTA_FEATURE_LIST.forEach((feature) => {
    usage[QUOTA_FEATURES[feature].countKey] = 0;
  });
  return usage;
}

/**
 * Yesterday's counts are not today's.
 *
 * This rolls over on every read rather than only at startup, because tab screens
 * stay mounted — the app can sit open across midnight and must hand back a fresh
 * allowance without a relaunch.
 */
export function usageForToday(usage: DailyUsage): DailyUsage {
  return usage.date === todayKey() ? usage : emptyUsage();
}

/** How many tries are left today. `Infinity` for premium. */
export function remainingFor(
  feature: QuotaFeature,
  isPremium: boolean,
  usage: DailyUsage
): number {
  if (isPremium) return Infinity;
  const { countKey, limit } = QUOTA_FEATURES[feature];
  return Math.max(0, limit - usageForToday(usage)[countKey]);
}

/**
 * A persisted blob is user-writable in principle, so nothing in it is trusted.
 * Reading through the feature table also means a blob written before a feature
 * was renamed simply loads that counter as zero instead of failing.
 */
function parseUsage(value: unknown): DailyUsage {
  if (!value || typeof value !== 'object') return emptyUsage();

  const raw = value as Record<string, unknown>;
  if (typeof raw.date !== 'string') return emptyUsage();

  const usage = emptyUsage(raw.date);
  QUOTA_FEATURE_LIST.forEach((feature) => {
    const { countKey } = QUOTA_FEATURES[feature];
    const n = raw[countKey];
    usage[countKey] = typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  });

  return usageForToday(usage);
}

// SecureStore is unavailable on some platforms (e.g. web); a storage failure must
// never block the app, it just means quotas do not survive a restart there.
async function readSecure(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

function persist(isPremium: boolean, dailyUsage: DailyUsage) {
  // Fire-and-forget; an unhandled rejection here would crash in dev.
  SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify({ isPremium, dailyUsage })).catch(() => {});
}

interface MonetizationState {
  isPremium: boolean;
  dailyUsage: DailyUsage;
  isLoaded: boolean;

  loadMonetization: () => Promise<void>;
  setPremium: (value: boolean) => void;
  /** Record one use of `feature`. Premium is still counted, just never enforced. */
  consume: (feature: QuotaFeature) => void;
  /** Hand back `AD_REWARD_TRIES` by crediting the counter down. */
  grantBonus: (feature: QuotaFeature, tries: number) => void;
  /**
   * Whether `feature` may run right now. Non-reactive by design — call it from
   * an event handler; components should read `useGatedAction` instead.
   */
  hasQuota: (feature: QuotaFeature) => boolean;
  /** Testing affordance: clears today's counts without touching premium. */
  resetUsage: () => void;
}

export const useMonetizationStore = create<MonetizationState>((set, get) => ({
  isPremium: false,
  dailyUsage: emptyUsage(),
  isLoaded: false,

  loadMonetization: async () => {
    const raw = await readSecure(STORAGE_KEY);

    if (!raw) {
      set({ isLoaded: true });
      return;
    }

    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      set({
        isPremium: parsed.isPremium === true,
        dailyUsage: parseUsage(parsed.dailyUsage),
        isLoaded: true,
      });
    } catch {
      // A corrupt blob is the same as no blob: start the day clean.
      set({ isLoaded: true });
    }
  },

  setPremium: (value) => {
    const dailyUsage = usageForToday(get().dailyUsage);
    set({ isPremium: value, dailyUsage });
    persist(value, dailyUsage);
  },

  consume: (feature) => {
    const { countKey } = QUOTA_FEATURES[feature];
    const usage = usageForToday(get().dailyUsage);
    const next: DailyUsage = { ...usage, [countKey]: usage[countKey] + 1 };

    set({ dailyUsage: next });
    persist(get().isPremium, next);
  },

  grantBonus: (feature, tries) => {
    const { countKey } = QUOTA_FEATURES[feature];
    const usage = usageForToday(get().dailyUsage);
    // Bonus tries are stored as a discount on the counter, so they expire with
    // the day like everything else and need no second field to persist.
    const next: DailyUsage = { ...usage, [countKey]: Math.max(0, usage[countKey] - tries) };

    set({ dailyUsage: next });
    persist(get().isPremium, next);
  },

  hasQuota: (feature) => {
    const { isPremium, dailyUsage } = get();
    if (isPremium) return true;

    const { countKey, limit } = QUOTA_FEATURES[feature];
    return usageForToday(dailyUsage)[countKey] < limit;
  },

  resetUsage: () => {
    const fresh = emptyUsage();
    set({ dailyUsage: fresh });
    persist(get().isPremium, fresh);
  },
}));
