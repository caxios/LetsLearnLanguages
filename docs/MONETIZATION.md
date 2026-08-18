# Monetization Plan

## Overview

The app follows a **freemium model** with two revenue streams:

1. **Rewarded Ads** — free users watch ads to unlock results
2. **Monthly Subscription** — paying users skip all ads

---

## User Tiers

| Tier | Price | Experience |
|------|-------|------------|
| **Free** | $0 | Must watch **2 rewarded ads** per submission to view results |
| **Premium** | TBD / month | No ads, unlimited submissions, results shown immediately |

---

## Core Flow

```
[User taps Submit]
    │
    ├─ Premium subscriber?
    │   └─ YES → Show results immediately
    │
    └─ NO (Free user)
        ├─ Show Rewarded Ad #1 → completed?
        ├─ Show Rewarded Ad #2 → completed?
        └─ Both completed → Show results
            └─ Display "Go Premium — no ads" upsell banner
```

---

## Tech Stack (to be integrated at deployment stage)

| Component | Service | Library |
|-----------|---------|---------|
| Rewarded Ads | Google AdMob | `react-native-google-mobile-ads` |
| Subscriptions | RevenueCat | `react-native-purchases` |
| Build | EAS Build | `eas-cli` |

---

## Prerequisites (before implementation)

- [ ] Apple Developer account ($99/year)
- [ ] Google Play Console account ($25 one-time)
- [ ] Migrate from Expo Go to **EAS Development Build** (native modules required)
- [ ] Set up AdMob account & create rewarded ad unit IDs (iOS + Android)
- [ ] Set up RevenueCat project & configure subscription products in App Store Connect / Google Play Console

---

## Implementation Notes

- **Ad failure handling**: If an ad fails to load, allow a retry or fall back gracefully (never block the user permanently).
- **Restore purchases**: Must implement a "Restore Purchases" button for App Store review compliance.
- **Apple policy**: Rewarded ads must be opt-in (the user chooses to watch). Forced ad viewing may violate App Store guidelines.
- **Apple/Google commission**: 30% of subscription revenue (drops to 15% after 1 year for Apple's Small Business Program).
- **Offline consideration**: Cache subscription status locally so premium users aren't blocked when offline.

---

## Status

> **🟡 Planned** — Will be implemented at deployment stage after core features are complete.
