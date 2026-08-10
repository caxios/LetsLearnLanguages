import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { FontSizes, Fonts } from '@/constants/fonts';
import { BorderRadius, Spacing } from '@/constants/layout';

interface BadgeProps {
  text: string;
  color: string;
  variant?: 'filled' | 'outline';
}

export function Badge({ text, color, variant = 'filled' }: BadgeProps) {
  const filled = variant === 'filled';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: filled ? `${color}26` : 'transparent',
          borderColor: color,
        },
      ]}
    >
      <Text style={[styles.text, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  text: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.xs,
  },
});
