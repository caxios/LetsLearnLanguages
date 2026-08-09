import React, { useState } from 'react';
import { NativeSyntheticEvent, Pressable, Text, TextInput, TextInputContentSizeChangeEventData, View } from 'react-native';

const MIN_HEIGHT = 96;
const MAX_HEIGHT = 200;

interface TextInputFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  maxLength?: number;
  autoFocus?: boolean;
  /** Fired when the keyboard's "Done" action is pressed. */
  onSubmit?: () => void;
}

export function TextInputField({
  value,
  onChangeText,
  placeholder = 'Type your English translation here...',
  maxLength = 500,
  autoFocus = false,
  onSubmit,
}: TextInputFieldProps) {
  const [height, setHeight] = useState(MIN_HEIGHT);

  const handleContentSizeChange = (
    event: NativeSyntheticEvent<TextInputContentSizeChangeEventData>
  ) => {
    const next = event.nativeEvent.contentSize.height;
    setHeight(Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, next)));
  };

  return (
    <View className="w-full rounded-2xl border border-white/10 bg-surface-light p-3">
      <TextInput
        accessibilityLabel="English translation"
        multiline
        textAlignVertical="top"
        value={value}
        onChangeText={onChangeText}
        onContentSizeChange={handleContentSizeChange}
        placeholder={placeholder}
        placeholderTextColor="#6B7280"
        maxLength={maxLength}
        autoFocus={autoFocus}
        returnKeyType="done"
        submitBehavior="blurAndSubmit"
        onSubmitEditing={onSubmit}
        className="text-base text-white"
        style={{ height }}
      />

      <View className="mt-2 flex-row items-center justify-between">
        {value.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear text"
            onPress={() => onChangeText('')}
            hitSlop={8}
          >
            <Text className="text-sm text-zinc-400">Clear</Text>
          </Pressable>
        ) : (
          <View />
        )}

        <Text className={`text-xs ${value.length >= maxLength ? 'text-red-400' : 'text-zinc-500'}`}>
          {value.length}/{maxLength}
        </Text>
      </View>
    </View>
  );
}
