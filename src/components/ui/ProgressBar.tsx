import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { Colors } from '@/constants/colors';
import { BorderRadius } from '@/constants/layout';

interface ProgressBarProps {
  progress: number; // 0-1
  color?: string;
  height?: number;
}

export function ProgressBar({ progress, color = Colors.primary, height = 8 }: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0));
  const width = useRef(new Animated.Value(clamped)).current;

  useEffect(() => {
    Animated.timing(width, {
      toValue: clamped,
      duration: 400,
      easing: Easing.out(Easing.ease),
      // Percentage widths cannot run on the native driver.
      useNativeDriver: false,
    }).start();
  }, [clamped, width]);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[styles.track, { height, borderRadius: height / 2 }]}
    >
      <Animated.View
        style={{
          height,
          borderRadius: height / 2,
          backgroundColor: color,
          width: width.interpolate({
            inputRange: [0, 1],
            outputRange: ['0%', '100%'],
          }),
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
});
