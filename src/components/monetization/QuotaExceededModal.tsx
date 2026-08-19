import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';
import { FontSizes, Fonts } from '@/constants/fonts';
import { BorderRadius, Spacing } from '@/constants/layout';
import {
  ADS_PER_BONUS,
  AD_BONUS_TRIES,
  QUOTA_FEATURES,
  type QuotaFeature,
} from '@/constants/monetization';
import { areAdsAvailable, showRewardedAd } from '@/services/ads';
import { useMonetizationStore } from '@/stores/useMonetizationStore';

interface QuotaExceededModalProps {
  visible: boolean;
  feature: QuotaFeature;
  onClose: () => void;
}

/** Filled and empty pips for the ads watched so far towards the next bonus. */
function AdProgress({ watched }: { watched: number }) {
  return (
    <View
      style={styles.pips}
      accessibilityLabel={`광고 ${watched}/${ADS_PER_BONUS} 시청 완료`}
    >
      {Array.from({ length: ADS_PER_BONUS }, (_, index) => (
        <View key={index} style={[styles.pip, index < watched && styles.pipFilled]} />
      ))}
    </View>
  );
}

/**
 * The paywall a free user meets at a daily limit. One component for all five
 * quotas — the copy is built from the feature's own metadata.
 *
 * Bonus tries are earned at a fixed ratio: `ADS_PER_BONUS` ads for
 * `AD_BONUS_TRIES` try. Progress is shown up front so a half-finished set never
 * looks like a broken button.
 */
export function QuotaExceededModal({ visible, feature, onClose }: QuotaExceededModalProps) {
  const setPremium = useMonetizationStore((s) => s.setPremium);
  const recordAdView = useMonetizationStore((s) => s.recordAdView);
  const watched = useMonetizationStore((s) => s.adViews[feature] ?? 0);

  const { label, limit, unit } = QUOTA_FEATURES[feature];
  const remainingAds = Math.max(0, ADS_PER_BONUS - watched);

  const [playing, setPlaying] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const handleWatchAd = async () => {
    setNotice(null);
    setPlaying(true);
    try {
      const outcome = await showRewardedAd();

      if (outcome !== 'rewarded') {
        setNotice(
          outcome === 'dismissed'
            ? '광고를 끝까지 봐야 시청 횟수가 올라가요.'
            : '지금은 광고를 불러올 수 없어요. 잠시 후 다시 시도해 주세요.'
        );
        return;
      }

      const result = recordAdView(feature);

      if (result.granted) {
        onClose();
        return;
      }

      const left = result.required - result.progress;
      setNotice(`광고 ${result.progress}/${result.required} 시청 완료! ${left}번 더 보면 ${AD_BONUS_TRIES}${unit}를 받아요.`);
    } finally {
      setPlaying(false);
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

          <View style={styles.reward}>
            <View style={styles.rewardHeader}>
              <Text style={styles.rewardLabel}>
                광고 {ADS_PER_BONUS}번 = {AD_BONUS_TRIES}
                {unit}
              </Text>
              <Text style={styles.rewardCount}>
                {watched}/{ADS_PER_BONUS}
              </Text>
            </View>

            <AdProgress watched={watched} />

            <Text style={styles.rewardHint}>
              {remainingAds === ADS_PER_BONUS
                ? `광고 ${ADS_PER_BONUS}번을 보면 ${AD_BONUS_TRIES}${unit}를 더 받을 수 있어요.`
                : `${remainingAds}번만 더 보면 ${AD_BONUS_TRIES}${unit}를 받아요.`}
            </Text>
          </View>

          <View style={styles.actions}>
            <Button
              title={`광고 보기 (${watched}/${ADS_PER_BONUS})`}
              variant="secondary"
              loading={playing}
              disabled={!areAdsAvailable()}
              onPress={handleWatchAd}
            />
            {!areAdsAvailable() && (
              <Text style={styles.note}>이 기기에서는 광고를 사용할 수 없어요.</Text>
            )}
            {notice && <Text style={styles.notice}>{notice}</Text>}

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

  reward: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
  },
  rewardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  rewardLabel: {
    fontFamily: Fonts.headingSemiBold,
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
  },
  rewardCount: {
    fontFamily: Fonts.mono,
    fontSize: FontSizes.base,
    color: Colors.primaryLight,
  },
  pips: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  pip: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.surfaceElevated,
  },
  pipFilled: {
    backgroundColor: Colors.primary,
  },
  rewardHint: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
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
  notice: {
    marginTop: -Spacing.sm,
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.warning,
    textAlign: 'center',
  },
});
