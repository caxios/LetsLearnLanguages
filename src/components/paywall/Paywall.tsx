import { SymbolView } from 'expo-symbols';
import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Colors } from '@/constants/colors';
import { FontSizes, Fonts } from '@/constants/fonts';
import { BorderRadius, Spacing } from '@/constants/layout';
import { QUOTA_FEATURES, QUOTA_FEATURE_LIST } from '@/constants/monetization';
import { annualSavings, useSubscription, useSubscriptionOptions } from '@/hooks/useSubscription';
import type { SubscriptionOption } from '@/services/revenue';

interface PaywallProps {
  visible: boolean;
  onClose: () => void;
}

const PERIOD_LABEL: Record<SubscriptionOption['period'], string> = {
  monthly: '월간',
  annual: '연간',
  other: '구독',
};

/**
 * The upgrade screen: what premium removes, what it costs, and one button.
 *
 * The benefits are read from the same quota table the meters use, so a limit
 * that changes in `monetization.ts` cannot leave the sales copy claiming
 * something different from what the app actually enforces.
 */
export function Paywall({ visible, onClose }: PaywallProps) {
  const insets = useSafeAreaInsets();
  const subscription = useSubscription();
  const options = useSubscriptionOptions(visible);

  const [selected, setSelected] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const available = options.data ?? [];
  const savings = annualSavings(available);

  // Default to the annual plan, the one worth defaulting to for both sides.
  const chosen =
    available.find((option) => option.id === selected) ??
    available.find((option) => option.period === 'annual') ??
    available[0];

  const busy = subscription.purchase.isPending || subscription.restore.isPending;

  const handleBuy = async () => {
    if (!chosen) return;
    setNotice(null);

    const outcome = await subscription.purchase.mutateAsync(chosen);

    if (outcome.status === 'purchased') {
      onClose();
      return;
    }
    // A deliberate "no" is not an error and gets no message.
    if (outcome.status === 'failed') setNotice(outcome.message);
  };

  const handleRestore = async () => {
    setNotice(null);
    const restored = await subscription.restore.mutateAsync();

    if (restored === true) {
      onClose();
      return;
    }
    setNotice(
      restored === false
        ? '복원할 구독을 찾지 못했어요.'
        : '지금은 구매를 복원할 수 없어요. 잠시 후 다시 시도해 주세요.'
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.scrim}>
        <Pressable style={styles.backdrop} accessibilityLabel="닫기" onPress={onClose} />

        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>프리미엄</Text>
              <Text style={styles.title}>제한 없이 연습하기</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="닫기"
              onPress={onClose}
              hitSlop={10}
              style={({ pressed }) => [styles.close, pressed && styles.pressed]}
            >
              <SymbolView
                name={{ ios: 'xmark', android: 'close', web: 'close' }}
                size={18}
                tintColor={Colors.textSecondary}
              />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.benefits}>
              {QUOTA_FEATURE_LIST.map((feature) => {
                const { label, limit, unit } = QUOTA_FEATURES[feature];
                return (
                  <View key={feature} style={styles.benefit}>
                    <Text style={styles.check}>✓</Text>
                    <Text style={styles.benefitText}>
                      <Text style={styles.benefitLabel}>{label}</Text>
                      <Text style={styles.benefitDetail}>
                        {'  '}
                        하루 {limit}
                        {unit} → 무제한
                      </Text>
                    </Text>
                  </View>
                );
              })}

              <View style={styles.benefit}>
                <Text style={styles.check}>✓</Text>
                <Text style={styles.benefitText}>
                  <Text style={styles.benefitLabel}>광고 없음</Text>
                  <Text style={styles.benefitDetail}>{'  '}평가 전에 광고를 보지 않아도 돼요</Text>
                </Text>
              </View>
            </View>

            {!subscription.isAvailable ? (
              <Text style={styles.unavailable}>
                이 기기에서는 결제를 사용할 수 없어요. 앱 스토어에서 설치한 버전에서 다시 시도해
                주세요.
              </Text>
            ) : options.isLoading ? (
              <View style={styles.center}>
                <ActivityIndicator color={Colors.primary} />
              </View>
            ) : available.length === 0 ? (
              <Text style={styles.unavailable}>
                지금은 구독 상품을 불러올 수 없어요. 잠시 후 다시 시도해 주세요.
              </Text>
            ) : (
              <View style={styles.plans}>
                {available.map((option) => {
                  const isChosen = chosen?.id === option.id;
                  const isAnnual = option.period === 'annual';

                  return (
                    <Pressable
                      key={option.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isChosen }}
                      accessibilityLabel={`${PERIOD_LABEL[option.period]} ${option.priceString}`}
                      onPress={() => setSelected(option.id)}
                      style={[styles.plan, isChosen && styles.planChosen]}
                    >
                      <View style={styles.planCopy}>
                        <Text style={styles.planPeriod}>{PERIOD_LABEL[option.period]}</Text>
                        <Text style={styles.planPrice}>{option.priceString}</Text>
                      </View>

                      {isAnnual && savings !== null && (
                        <View style={styles.badge}>
                          <Text style={styles.badgeLabel}>{savings}% 할인</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}

            {notice && <Text style={styles.notice}>{notice}</Text>}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: Spacing.md + insets.bottom }]}>
            <Button
              title={chosen ? `${PERIOD_LABEL[chosen.period]} 구독 시작하기` : '구독 시작하기'}
              onPress={handleBuy}
              loading={subscription.purchase.isPending}
              disabled={!chosen || busy}
            />

            <Button
              title="구매 복원"
              variant="ghost"
              size="sm"
              onPress={handleRestore}
              loading={subscription.restore.isPending}
              disabled={!subscription.isAvailable || busy}
            />

            <Text style={styles.legal}>
              구독은 언제든지 스토어에서 해지할 수 있어요. 해지하지 않으면 자동으로 갱신됩니다.
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    maxHeight: '90%',
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    borderTopWidth: 1,
    borderColor: Colors.borderLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  eyebrow: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.xs,
    color: Colors.primaryLight,
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes['2xl'],
    color: Colors.textPrimary,
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  pressed: {
    opacity: 0.6,
  },

  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  center: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },

  benefits: {
    gap: Spacing.md,
  },
  benefit: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  check: {
    fontFamily: Fonts.headingSemiBold,
    fontSize: FontSizes.base,
    color: Colors.secondary,
  },
  benefitText: {
    flex: 1,
  },
  benefitLabel: {
    fontFamily: Fonts.headingSemiBold,
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
  },
  benefitDetail: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },

  plans: {
    gap: Spacing.md,
  },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  planChosen: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryMuted,
  },
  planCopy: {
    gap: 2,
  },
  planPeriod: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
  planPrice: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.lg,
    color: Colors.textPrimary,
  },
  badge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.secondaryMuted,
    borderWidth: 1,
    borderColor: Colors.secondary,
  },
  badgeLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.xs,
    color: Colors.secondaryLight,
  },

  unavailable: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    lineHeight: FontSizes.sm * 1.6,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  notice: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    lineHeight: FontSizes.xs * 1.6,
    color: Colors.error,
    textAlign: 'center',
  },

  footer: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  legal: {
    fontFamily: Fonts.body,
    fontSize: 11,
    lineHeight: 16,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
