import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, View, ViewStyle } from 'react-native';

import { Colors } from '@/constants/colors';
import { BorderRadius, Spacing } from '@/constants/layout';

interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  onPress?: () => void;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

export function Card({
  children,
  variant = 'default',
  onPress,
  style,
  accessibilityLabel,
}: CardProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const body = <View style={[styles.card, styles[variant], style]}>{children}</View>;

  if (!onPress) {
    return body;
  }

  const springTo = (toValue: number) =>
    Animated.spring(scale, { toValue, useNativeDriver: true, speed: 40, bounciness: 4 }).start();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onPressIn={() => springTo(0.97)}
      onPressOut={() => springTo(1)}
    >
      <Animated.View style={{ transform: [{ scale }] }}>{body}</Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
    borderWidth: 1,
  },
  default: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  elevated: {
    backgroundColor: Colors.surfaceElevated,
    borderColor: Colors.borderLight,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  outlined: {
    backgroundColor: 'transparent',
    borderColor: Colors.borderLight,
  },
});
