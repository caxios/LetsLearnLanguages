import React from 'react';
import { Text, TextInput, View } from 'react-native';

interface KoreanInputProps {
  value: string;
  onChangeText: (text: string) => void;
}

export function KoreanInput({ value, onChangeText }: KoreanInputProps) {
  return (
    <View className="w-full gap-2">
      <Text className="text-sm font-semibold text-zinc-200">번역할 한국어 문장</Text>

      <TextInput
        accessibilityLabel="번역할 한국어 문장"
        multiline
        textAlignVertical="top"
        value={value}
        onChangeText={onChangeText}
        placeholder="예: 오늘 날씨가 좋네요."
        placeholderTextColor="#6B7280"
        maxLength={200}
        className="min-h-16 rounded-2xl border border-white/10 bg-surface-light p-3 text-base text-white"
      />

      <Text className="text-xs text-zinc-500">
        영어로 번역하고 싶은 한국어 문장을 입력하세요
      </Text>
    </View>
  );
}
