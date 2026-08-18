import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';
import { FontSizes, Fonts } from '@/constants/fonts';
import { BorderRadius, Spacing } from '@/constants/layout';
import { AD_REWARD_TRIES, QUOTA_FEATURES, type QuotaFeature } from '@/constants/monetization';
import { areAdsAvailable, showRewardedAd } from '@/services/ads';
import { useMonetizationStore } from '@/stores/useMonetizationStore';

interface QuotaExceededModalProps {
  visible: boolean;
  feature: QuotaFeature;
  onClose: () => void;
}

/**
 * The paywall a free user meets at a daily limit. One component for all five
 * quotas — the copy is built from the feature's own metadata.
 *
 * Two ways out: watch a rewarded ad for a couple more tries, or go premium.
 * Billing is not wired up yet, so "upgrade" flips the local flag.
 */
export function QuotaExceededModal({ visible, feature, onClose }: QuotaExceededModalProps) {
  const setPremium = useMonetizationStore((s) => s.setPremium);
  const grantBonus = useMonetizationStore((s) => s.grantBonus);
  const { label, limit, unit } = QUOTA_FEATURES[feature];

  const [watching, setWatching] = useState(false);
  const [adError, setAdError] = useState<string | null>(null);

  const handleWatchAd = async () => {
    setAdError(null);
    setWatching(true);
    try {
      const outcome = await showRewardedAd();

      if (outcome === 'rewarded') {
        grantBonus(feature, AD_REWARD_TRIES);
        onClose();
        return;
      }

      setAdError(
        outcome === 'dismissed'
          ? '광고를 끝까지 봐야 추가 횟수를 받을 수 있어요.'
          : '지금은 광고를 불러올 수 없어요. 잠시 후 다시 시도해 주세요.'
      );
    } finally {
      setWatching(false);
    }
  };

  const handleUpgrade = () => {
    setPremium(true);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Tapping the scrim dismisses, which is what the hardware back button does too. */}
      <Pressable style={styles.scrim} accessibilityLabel="닫기" onPress={onClose}>
        {/* Swallow taps on the sheet so they don't reach the scrim behind it. */}
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.emoji}>⏳</Text>

          <Text style={styles.title}>오늘의 {label} 횟수를 다 썼어요</Text>
          <Text style={styles.body}>
            무료로는 하루에 {label}을 {limit}
            {unit}까지 이용할 수 있어요. 내일 다시 채워집니다.
          </Text>

          <View style={styles.actions}>
            <Button
              title={`광고 보고 +${AD_REWARD_TRIES}${unit} 받기`}
              variant="secondary"
              loading={watching}
              disabled={!areAdsAvailable()}
              onPress={handleWatchAd}
            />
            {!areAdsAvailable() && (
              <Text style={styles.note}>이 기기에서는 광고를 사용할 수 없어요.</Text>
            )}
            {adError && <Text style={styles.error}>{adError}</Text>}

            <Button title="프리미엄으로 업그레이드" onPress={handleUpgrade} />
            <Button title="닫기" variant="ghost" size="sm" onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  emoji: {
    fontSize: 34,
    textAlign: 'center',
  },
  title: {
    marginTop: Spacing.xs,
    fontFamily: Fonts.heading,
    fontSize: FontSizes.lg,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  body: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    lineHeight: FontSizes.sm * 1.6,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  actions: {
    marginTop: Spacing.base,
    gap: Spacing.md,
  },
  note: {
    marginTop: -Spacing.sm,
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  error: {
    marginTop: -Spacing.sm,
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.warning,
    textAlign: 'center',
  },
});
