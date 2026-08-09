import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, Pressable, Text, View } from 'react-native';

import { useSettingsStore } from '@/stores/useSettingsStore';

const OPTIONS = [
  { value: 'voice', label: '🎤 Voice' },
  { value: 'text', label: '⌨️ Text' },
] as const;

interface InputMethodToggleProps {
  value: 'voice' | 'text';
  onChange: (method: 'voice' | 'text') => void;
}

export function InputMethodToggle({ value, onChange }: InputMethodToggleProps) {
  const setPreferredInputMethod = useSettingsStore((s) => s.setPreferredInputMethod);
  const [trackWidth, setTrackWidth] = useState(0);
  const offset = useRef(new Animated.Value(0)).current;

  const activeIndex = OPTIONS.findIndex((option) => option.value === value);
  const segmentWidth = trackWidth / OPTIONS.length;

  useEffect(() => {
    Animated.timing(offset, {
      toValue: activeIndex * segmentWidth,
      duration: 180,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [activeIndex, offset, segmentWidth]);

  const handleLayout = (event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  };

  const handlePress = (method: 'voice' | 'text') => {
    if (method === value) return;
    setPreferredInputMethod(method);
    onChange(method);
  };

  return (
    <View
      accessibilityRole="tablist"
      onLayout={handleLayout}
      className="w-full flex-row rounded-full bg-surface-light p-1"
    >
      {segmentWidth > 0 && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 4,
            bottom: 4,
            left: 4,
            width: segmentWidth - 8,
            borderRadius: 999,
            backgroundColor: '#4F46E5',
            transform: [{ translateX: offset }],
          }}
        />
      )}

      {OPTIONS.map((option) => {
        const isActive = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityLabel={option.label}
            accessibilityState={{ selected: isActive }}
            onPress={() => handlePress(option.value)}
            className="flex-1 items-center justify-center rounded-full py-2"
          >
            <Text className={`text-sm ${isActive ? 'font-semibold text-white' : 'text-zinc-400'}`}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
