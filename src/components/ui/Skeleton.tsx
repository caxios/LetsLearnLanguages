import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, LayoutChangeEvent, StyleSheet, View, ViewStyle } from 'react-native';

import { Colors } from '@/constants/colors';
import { BorderRadius } from '@/constants/layout';

interface SkeletonProps {
  height?: number;
  width?: ViewStyle['width'];
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({
  height = 16,
  width = '100%',
  borderRadius = BorderRadius.sm,
  style,
}: SkeletonProps) {
  const shimmer = useRef(new Animated.Value(0)).current;
  const [measured, setMeasured] = useState(0);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 1200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  const handleLayout = (event: LayoutChangeEvent) => setMeasured(event.nativeEvent.layout.width);

  return (
    <View
      onLayout={handleLayout}
      style={[styles.base, { height, width, borderRadius }, style]}
      accessibilityRole="progressbar"
      accessibilityLabel="불러오는 중"
    >
      {measured > 0 && (
        <Animated.View
          style={[
            styles.sheen,
            {
              transform: [
                {
                  translateX: shimmer.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-measured, measured],
                  }),
                },
              ],
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.surfaceLight,
    overflow: 'hidden',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.surfaceElevated,
    opacity: 0.6,
  },
});
