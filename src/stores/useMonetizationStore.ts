import { format } from 'date-fns';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import {
  ADS_PER_BONUS,
  AD_BONUS_TRIES,
  QUOTA_FEATURES,
  QUOTA_FEATURE_LIST,
  type QuotaFeature,
  type UsageCountKey,
} from '@/constants/monetization';

const STORAGE_KEY = 'monetization_state';

export type DailyUsage = { date: string } & Record<UsageCountKey, number>;

/** Ads watched so far towards the next bonus, per feature. Always < ADS_PER_BONUS. */
export type AdViews = Record<QuotaFeature, number>;

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

function emptyAdViews(): AdViews {
  const views = {} as AdViews;
  QUOTA_FEATURE_LIST.forEach((feature) => {
    views[feature] = 0;
  });
  return views;
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

function parseAdViews(value: unknown): AdViews {
  const views = emptyAdViews();
  if (!value || typeof value !== 'object') return views;

  const raw = value as Record<string, unknown>;
  QUOTA_FEATURE_LIST.forEach((feature) => {
    const n = raw[feature];
    if (typeof n !== 'number' || !Number.isFinite(n) || n <= 0) return;
    // A stored value at or above the threshold would be a free bonus waiting to
    // be claimed by editing the blob, so progress is clamped below it.
    views[feature] = Math.min(Math.floor(n), ADS_PER_BONUS - 1);
  });

  return views;
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

export interface AdViewResult {
  /** True when this ad completed a set and a bonus try was granted. */
  granted: boolean;
  /** Ads watched towards the next bonus after this one. */
  progress: number;
  /** How many are needed in total — for the caller's copy. */
  required: number;
}

interface MonetizationState {
  isPremium: boolean;
  dailyUsage: DailyUsage;
  adViews: AdViews;
  isLoaded: boolean;

  loadMonetization: () => Promise<void>;
  setPremium: (value: boolean) => void;
  /** Record one use of `feature`. Premium is still counted, just never enforced. */
  consume: (feature: QuotaFeature) => void;
  /** Credit the counter down, handing back `tries`. */
  grantBonus: (feature: QuotaFeature, tries: number) => void;
  /**
   * Record one watched rewarded ad. Grants a bonus try only once
   * `ADS_PER_BONUS` have been watched for that feature, then starts over.
   */
  recordAdView: (feature: QuotaFeature) => AdViewResult;
  /**
   * Whether `feature` may run right now. Non-reactive by design — call it from
   * an event handler; components should read `useGatedAction` instead.
   */
  hasQuota: (feature: QuotaFeature) => boolean;
  /** Testing affordance: clears today's counts and ad progress. */
  resetUsage: () => void;
}

export const useMonetizationStore = create<MonetizationState>((set, get) => {
  // Persistence always writes the whole current snapshot, so no action can save
  // a partial state by forgetting a field. Fire-and-forget: an unhandled
  // rejection here would crash in dev.
  const save = () => {
    const { isPremium, dailyUsage, adViews } = get();
    SecureStore.setItemAsync(
      STORAGE_KEY,
      JSON.stringify({ isPremium, dailyUsage, adViews })
    ).catch(() => {});
  };

  return {
    isPremium: false,
    dailyUsage: emptyUsage(),
    adViews: emptyAdViews(),
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
          adViews: parseAdViews(parsed.adViews),
          isLoaded: true,
        });
      } catch {
        // A corrupt blob is the same as no blob: start the day clean.
        set({ isLoaded: true });
      }
    },

    setPremium: (value) => {
      set({ isPremium: value, dailyUsage: usageForToday(get().dailyUsage) });
      save();
    },

    consume: (feature) => {
      const { countKey } = QUOTA_FEATURES[feature];
      const usage = usageForToday(get().dailyUsage);
      set({ dailyUsage: { ...usage, [countKey]: usage[countKey] + 1 } });
      save();
    },

    grantBonus: (feature, tries) => {
      const { countKey } = QUOTA_FEATURES[feature];
      const usage = usageForToday(get().dailyUsage);
      // Bonus tries are stored as a discount on the counter, so they expire with
      // the day like everything else and need no second field to persist.
      set({ dailyUsage: { ...usage, [countKey]: Math.max(0, usage[countKey] - tries) } });
      save();
    },

    recordAdView: (feature) => {
      const watched = (get().adViews[feature] ?? 0) + 1;

      if (watched < ADS_PER_BONUS) {
        set({ adViews: { ...get().adViews, [feature]: watched } });
        save();
        return { granted: false, progress: watched, required: ADS_PER_BONUS };
      }

      // Set complete: bank the try and start the next set from zero. Progress is
      // deliberately not carried over, so every bonus costs the full ratio.
      set({ adViews: { ...get().adViews, [feature]: 0 } });
      get().grantBonus(feature, AD_BONUS_TRIES);
      return { granted: true, progress: 0, required: ADS_PER_BONUS };
    },

    hasQuota: (feature) => {
      const { isPremium, dailyUsage } = get();
      if (isPremium) return true;

      const { countKey, limit } = QUOTA_FEATURES[feature];
      return usageForToday(dailyUsage)[countKey] < limit;
    },

    resetUsage: () => {
      set({ dailyUsage: emptyUsage(), adViews: emptyAdViews() });
      save();
    },
  };
});
