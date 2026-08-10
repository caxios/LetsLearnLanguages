import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, LayoutAnimation, Platform, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { Colors } from '@/constants/colors';
import { FontSizes, Fonts } from '@/constants/fonts';
import { Spacing } from '@/constants/layout';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface RecommendationItem {
  sentence: string;
  contextAndNuance: string;
  grammarExplanation: string;
}

interface RecommendationListProps {
  recommendations: RecommendationItem[];
}

const STAGGER_MS = 100;

export function RecommendationList({ recommendations }: RecommendationListProps) {
  return (
    <View style={styles.list}>
      <Text style={styles.heading}>💡 추천 표현</Text>
      {recommendations.map((recommendation, index) => (
        <RecommendationCard
          key={`${recommendation.sentence}-${index}`}
          recommendation={recommendation}
          delay={index * STAGGER_MS}
        />
      ))}
    </View>
  );
}

function RecommendationCard({
  recommendation,
  delay,
}: {
  recommendation: RecommendationItem;
  delay: number;
}) {
  const [openSection, setOpenSection] = useState<'nuance' | 'grammar' | null>(null);
  const [copied, setCopied] = useState(false);

  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.spring(enter, {
      toValue: 1,
      delay,
      useNativeDriver: true,
      speed: 12,
      bounciness: 6,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, enter]);

  const toggle = (section: 'nuance' | 'grammar') => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenSection((current) => (current === section ? null : section));
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(recommendation.sentence);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Animated.View
      style={{
        opacity: enter,
        transform: [
          { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) },
        ],
      }}
    >
      <Card>
        <View style={styles.sentenceRow}>
          <Text style={styles.sentence}>{recommendation.sentence}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`"${recommendation.sentence}" 복사`}
            onPress={handleCopy}
            hitSlop={8}
          >
            <Text style={styles.copy}>{copied ? '복사됨' : '복사'}</Text>
          </Pressable>
        </View>

        <Section
          title="뉘앙스 설명"
          body={recommendation.contextAndNuance}
          expanded={openSection === 'nuance'}
          onToggle={() => toggle('nuance')}
        />
        <Section
          title="문법 설명"
          body={recommendation.grammarExplanation}
          expanded={openSection === 'grammar'}
          onToggle={() => toggle('grammar')}
        />
      </Card>
    </Animated.View>
  );
}

function Section({
  title,
  body,
  expanded,
  onToggle,
}: {
  title: string;
  body: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={styles.section}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded }}
        onPress={onToggle}
        style={styles.sectionHeader}
      >
        <Text style={styles.sectionTitle}>
          {expanded ? '▲' : '▼'} {title}
        </Text>
      </Pressable>

      {expanded && <Text style={styles.sectionBody}>{body}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.md,
  },
  heading: {
    fontFamily: Fonts.headingSemiBold,
    fontSize: FontSizes.base,
    color: Colors.textPrimary,
  },
  sentenceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  sentence: {
    flex: 1,
    fontFamily: Fonts.headingSemiBold,
    fontSize: FontSizes.lg,
    lineHeight: FontSizes.lg * 1.4,
    color: Colors.textPrimary,
  },
  copy: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.xs,
    color: Colors.secondary,
  },
  section: {
    marginTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: Spacing.md,
  },
  sectionHeader: {
    paddingVertical: Spacing.xs,
  },
  sectionTitle: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.sm,
    color: Colors.primaryLight,
  },
  sectionBody: {
    marginTop: Spacing.sm,
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    lineHeight: FontSizes.sm * 1.6,
    color: Colors.textSecondary,
  },
});
