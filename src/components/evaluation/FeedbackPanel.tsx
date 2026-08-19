import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

import { GrammarText } from '@/components/grammar/GrammarText';
import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/colors';
import { FontSizes, Fonts } from '@/constants/fonts';
import { Spacing } from '@/constants/layout';

interface FeedbackPanelProps {
  feedback: string;
  /** Opens the Grammar Teacher for a tagged term. Omit to render terms inert. */
  onTermPress?: (term: string) => void;
}

export function FeedbackPanel({ feedback, onTermPress }: FeedbackPanelProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View style={{ opacity }}>
      <Text style={styles.heading}>📝 선생님 피드백</Text>
      <Card>
        <GrammarText style={styles.body} onTermPress={onTermPress}>
          {feedback}
        </GrammarText>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  heading: {
    fontFamily: Fonts.headingSemiBold,
    fontSize: FontSizes.base,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  body: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.base,
    lineHeight: FontSizes.base * 1.6,
    color: Colors.textPrimary,
  },
});
