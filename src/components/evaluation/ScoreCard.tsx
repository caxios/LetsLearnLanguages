import React from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/Card';
import { ScoreCircle } from '@/components/ui/ScoreCircle';
import { Spacing } from '@/constants/layout';

interface ScoreCardProps {
  naturalness: number;
  grammar: number;
  meaningClarity: number;
}

export function ScoreCard({ naturalness, grammar, meaningClarity }: ScoreCardProps) {
  return (
    <Card variant="elevated">
      <View style={styles.row}>
        <ScoreCircle score={naturalness} label="자연스러움" />
        <ScoreCircle score={grammar} label="문법" />
        <ScoreCircle score={meaningClarity} label="의미 전달" />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    gap: Spacing.sm,
  },
});
