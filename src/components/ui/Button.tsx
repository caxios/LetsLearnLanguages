import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { Colors } from '@/constants/colors';
import { FontSizes, Fonts } from '@/constants/fonts';
import { BorderRadius, Spacing } from '@/constants/layout';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

const SIZES: Record<Size, { paddingVertical: number; fontSize: number }> = {
  sm: { paddingVertical: Spacing.sm, fontSize: FontSizes.sm },
  md: { paddingVertical: Spacing.md, fontSize: FontSizes.base },
  lg: { paddingVertical: Spacing.base, fontSize: FontSizes.lg },
};

const SOLID_BACKGROUND: Record<Exclude<Variant, 'primary'>, string> = {
  secondary: Colors.surfaceLight,
  ghost: 'transparent',
  danger: Colors.error,
};

const LABEL_COLOR: Record<Variant, string> = {
  primary: Colors.textPrimary,
  secondary: Colors.textPrimary,
  ghost: Colors.primaryLight,
  danger: Colors.textPrimary,
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const sizing = SIZES[size];

  const handlePress = () => {
    if (isDisabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  };

  const content = loading ? (
    <ActivityIndicator color={LABEL_COLOR[variant]} />
  ) : (
    <View style={styles.labelRow}>
      {icon}
      <Text style={[styles.label, { color: LABEL_COLOR[variant], fontSize: sizing.fontSize }]}>
        {title}
      </Text>
    </View>
  );

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={handlePress}
      style={[styles.pressable, isDisabled && styles.disabled, style]}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={[Colors.primary, Colors.primaryLight]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.body, { paddingVertical: sizing.paddingVertical }]}
        >
          {content}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.body,
            {
              paddingVertical: sizing.paddingVertical,
              backgroundColor: SOLID_BACKGROUND[variant],
              borderWidth: variant === 'ghost' ? 1 : 0,
              borderColor: Colors.borderLight,
            },
          ]}
        >
          {content}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.5,
  },
  body: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  label: {
    fontFamily: Fonts.headingSemiBold,
  },
});
