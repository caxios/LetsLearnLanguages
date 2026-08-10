import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Colors, scoreColor } from '@/constants/colors';
import { FontSizes, Fonts } from '@/constants/fonts';
import { Spacing } from '@/constants/layout';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ScoreCircleProps {
  score: number;
  label: string;
  size?: number;
}

const STROKE = 8;
const DURATION = 1000;

export function ScoreCircle({ score, label, size = 84 }: ScoreCircleProps) {
  const target = Math.min(100, Math.max(0, Math.round(score)));
  const color = scoreColor(target);

  const radius = (size - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = useRef(new Animated.Value(0)).current;
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    // Count-up of the number and the stroke fill share one driver so they stay in step.
    const listener = progress.addListener(({ value }) => {
      setDisplayed(Math.round(value * target));
    });

    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION,
      easing: Easing.out(Easing.cubic),
      // strokeDashoffset is not a native-driver supported prop.
      useNativeDriver: false,
    });
    animation.start();

    return () => {
      animation.stop();
      progress.removeListener(listener);
    };
  }, [progress, target]);

  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, circumference * (1 - target / 100)],
  });

  return (
    <View style={styles.container} accessibilityLabel={`${label} ${target}점`}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={Colors.surfaceLight}
            strokeWidth={STROKE}
            fill="none"
          />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            // Start the arc at 12 o'clock instead of 3 o'clock.
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>

        <View style={styles.center} pointerEvents="none">
          <Text style={[styles.score, { color }]}>{displayed}</Text>
        </View>
      </View>

      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    fontFamily: Fonts.mono,
    fontSize: FontSizes.xl,
  },
  label: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.textSecondary,
  },
});
