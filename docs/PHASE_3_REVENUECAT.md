# Phase 3: RevenueCat In-App Purchases

You are working on an Expo React Native app (SDK 57). We currently have a free tier with limits and AdMob. Now, we will implement the Premium tier using RevenueCat for In-App Purchases (Subscriptions).

## Task 1: Setup
1. Install the library: `npx expo install react-native-purchases`
2. Create `src/services/revenue.ts` to initialize RevenueCat. You will need placeholder API keys for Apple and Google.
3. Initialize RevenueCat in the root `app/_layout.tsx` file inside a `useEffect`.

## Task 2: Paywall UI
1. Create a premium Paywall screen or full-page Modal (`src/components/paywall/Paywall.tsx`).
2. Use `Purchases.getOfferings()` to fetch available packages (e.g., Monthly and Yearly subscriptions).
3. Display the packages clearly with prices. Highlight the Yearly discount if applicable.
4. Hook up the `Purchases.purchasePackage()` method to the buy buttons.

## Task 3: State Syncing
1. Create a hook `useSubscription.ts` that checks the customer info (`Purchases.getCustomerInfo()`).
2. Sync the result with `useMonetizationStore`:
   - If the user has an active entitlement (e.g., 'premium'), set `isPremium: true`.
   - Otherwise, set `isPremium: false`.
3. Call this check on app startup, after a successful purchase, and after restoring purchases.

## Task 4: Integrate Paywall
1. Update `QuotaExceededModal.tsx` from Phase 1. The "Upgrade to Premium" button should now open the actual Paywall instead of just mocking the state.
2. Add an "Upgrade to Premium" button in the App Settings screen so users can subscribe voluntarily at any time.

## Rules:
- Handle loading states during purchase and fetching offerings.
- Handle errors gracefully (e.g., user cancels purchase).
- Include a "Restore Purchases" button in the Paywall or Settings for users switching devices.
