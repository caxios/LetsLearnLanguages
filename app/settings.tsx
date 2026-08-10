import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { InputMethodToggle } from '@/components/input/InputMethodToggle';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/colors';
import { FontSizes, Fonts } from '@/constants/fonts';
import { BorderRadius, Spacing } from '@/constants/layout';
import { maintenanceRepository } from '@/db/repositories/maintenanceRepository';
import { useSettingsStore } from '@/stores/useSettingsStore';

export default function SettingsScreen() {
  const queryClient = useQueryClient();

  const openaiApiKey = useSettingsStore((s) => s.openaiApiKey);
  const geminiApiKey = useSettingsStore((s) => s.geminiApiKey);
  const preferredInputMethod = useSettingsStore((s) => s.preferredInputMethod);
  const setApiKey = useSettingsStore((s) => s.setApiKey);
  const setPreferredInputMethod = useSettingsStore((s) => s.setPreferredInputMethod);

  const [openai, setOpenai] = useState(openaiApiKey ?? '');
  const [gemini, setGemini] = useState(geminiApiKey ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Keys arrive asynchronously from SecureStore on first launch.
  useEffect(() => setOpenai(openaiApiKey ?? ''), [openaiApiKey]);
  useEffect(() => setGemini(geminiApiKey ?? ''), [geminiApiKey]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await setApiKey('openai', openai.trim());
      await setApiKey('gemini', gemini.trim());
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>API 키</Text>

      <Card>
        <SecretField
          label="OpenAI API Key (음성 인식)"
          value={openai}
          onChangeText={setOpenai}
          placeholder="sk-..."
        />
        <View style={styles.fieldGap} />
        <SecretField
          label="Gemini API Key (평가·문장 생성)"
          value={gemini}
          onChangeText={setGemini}
          placeholder="AIza..."
        />

        <Button
          title={saved ? '저장됨' : '저장'}
          onPress={handleSave}
          loading={saving}
          style={styles.save}
        />
        <Text style={styles.note}>
          키는 기기의 보안 저장소(SecureStore)에 저장되며 서버로 전송되지 않습니다.
        </Text>
      </Card>

      <Text style={styles.sectionTitle}>기본 입력 방식</Text>
      <InputMethodToggle value={preferredInputMethod} onChange={setPreferredInputMethod} />

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

function SecretField({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <View>
      <View style={styles.fieldHeader}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={visible ? `${label} 숨기기` : `${label} 표시`}
          onPress={() => setVisible((v) => !v)}
          hitSlop={8}
        >
          <Text style={styles.toggle}>{visible ? '숨기기' : '표시'}</Text>
        </Pressable>
      </View>

      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
    </View>
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
  fieldHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  fieldLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  toggle: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.xs,
    color: Colors.primaryLight,
  },
  input: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontFamily: Fonts.mono,
    fontSize: FontSizes.sm,
    color: Colors.textPrimary,
  },
  fieldGap: {
    height: Spacing.base,
  },
  save: {
    marginTop: Spacing.base,
  },
  note: {
    marginTop: Spacing.md,
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    lineHeight: FontSizes.xs * 1.6,
    color: Colors.textMuted,
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
