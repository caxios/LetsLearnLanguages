import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InputMethodToggle } from '@/components/input/InputMethodToggle';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/colors';
import { Features } from '@/constants/features';
import { FontSizes, Fonts } from '@/constants/fonts';
import { Spacing } from '@/constants/layout';
import { maintenanceRepository } from '@/db/repositories/maintenanceRepository';
import { QUOTA_FEATURES, type QuotaFeature } from '@/constants/monetization';
import { useMonetizationStore, usageForToday } from '@/stores/useMonetizationStore';
import { useSettingsStore } from '@/stores/useSettingsStore';

export default function SettingsScreen() {
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const preferredInputMethod = useSettingsStore((s) => s.preferredInputMethod);
  const setPreferredInputMethod = useSettingsStore((s) => s.setPreferredInputMethod);

  const isPremium = useMonetizationStore((s) => s.isPremium);
  const dailyUsage = useMonetizationStore((s) => s.dailyUsage);
  const setPremium = useMonetizationStore((s) => s.setPremium);
  const resetUsage = useMonetizationStore((s) => s.resetUsage);

  const [clearing, setClearing] = useState(false);

  const clearAllData = async () => {
    setClearing(true);
    try {
      await maintenanceRepository.clearAllData();
      await queryClient.invalidateQueries();
    } finally {
      setClearing(false);
    }
  };

  const confirmClear = () => {
    Alert.alert(
      '모든 데이터를 삭제할까요?',
      '학습 기록, 평가 결과, 복습 카드가 모두 사라집니다. 되돌릴 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: clearAllData },
      ]
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: Spacing['3xl'] + insets.bottom }]}
    >
      {Features.VOICE_INPUT_ENABLED && (
        <>
          <Text style={styles.sectionTitle}>기본 입력 방식</Text>
          <InputMethodToggle value={preferredInputMethod} onChange={setPreferredInputMethod} />
        </>
      )}

      {/* Phase 1 has no billing yet, so premium is a local switch. Being able to
          turn it back off is what makes the free limits testable at all. */}
      <Text style={styles.sectionTitle}>구독 (테스트용)</Text>
      <Card variant="outlined">
        <Row label="상태" value={isPremium ? '프리미엄' : '무료'} />
        {(Object.keys(QUOTA_FEATURES) as QuotaFeature[]).map((feature) => {
          const { label, limit, countKey, unit } = QUOTA_FEATURES[feature];
          const used = usageForToday(dailyUsage)[countKey];
          return (
            <Row
              key={feature}
              label={label}
              value={isPremium ? '무제한' : `${used}/${limit}${unit}`}
            />
          );
        })}
      </Card>
      <Button
        title={isPremium ? '무료로 되돌리기' : '프리미엄 켜기'}
        variant="secondary"
        onPress={() => setPremium(!isPremium)}
      />
      <Button title="오늘 사용량 초기화" variant="ghost" onPress={resetUsage} />

      <Text style={styles.sectionTitle}>앱 정보</Text>
      <Card variant="outlined">
        <Row label="버전" value={Constants.expoConfig?.version ?? '—'} />
        <Row label="빌드" value={String(Constants.expoConfig?.runtimeVersion ?? 'development')} />
      </Card>

      <Text style={styles.sectionTitle}>데이터</Text>
      <Button
        title="모든 데이터 삭제"
        variant="danger"
        onPress={confirmClear}
        loading={clearing}
      />
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.base,
    paddingBottom: Spacing['3xl'],
    gap: Spacing.md,
  },
  sectionTitle: {
    marginTop: Spacing.sm,
    fontFamily: Fonts.headingSemiBold,
    fontSize: FontSizes.base,
    color: Colors.textPrimary,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.xs,
  },
  rowLabel: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  rowValue: {
    fontFamily: Fonts.mono,
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
  },
});
