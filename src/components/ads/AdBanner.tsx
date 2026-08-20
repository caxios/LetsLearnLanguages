import { useEffect, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';

import { bannerAdUnitId } from '@/constants/ads';
import { Colors } from '@/constants/colors';
import { getBannerAd } from '@/services/ads';
import { useMonetizationStore } from '@/stores/useMonetizationStore';

/**
 * The banner strip that sits below a tab screen's content.
 *
 * Renders nothing at all — not an empty box — whenever it should not be shown,
 * so screens can drop it in unconditionally without reserving space for it.
 */
export function AdBanner() {
  const isPremium = useMonetizationStore((s) => s.isPremium);

  // A banner that failed once stays hidden for the session. Retrying a no-fill
  // on a loop costs battery and gets the same answer.
  const [failed, setFailed] = useState(false);

  // An ad directly above an open keyboard is the classic accidental-tap layout,
  // and accidental taps are what gets an AdMob account flagged for invalid
  // traffic. It also steals the room the input needs.
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const shown = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  // Null in Expo Go and on web, where the native module is absent.
  const banner = getBannerAd();

  if (isPremium || failed || keyboardVisible || !banner) return null;

  const { BannerAd, BannerAdSize } = banner;

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={bannerAdUnitId()}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdFailedToLoad={() => setFailed(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
});
