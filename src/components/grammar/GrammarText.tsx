import React, { useMemo } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { parseGrammarTags } from '@/utils/grammarTags';

interface GrammarTextProps {
  children: string;
  style?: StyleProp<TextStyle>;
  /** Omit to render the terms as plain text — used where a sheet cannot open. */
  onTermPress?: (term: string) => void;
}

/**
 * Feedback text with its `[[tagged]]` grammar terms turned into links.
 *
 * Links are nested `Text` rather than separate views so they wrap inline with
 * the prose. With no `onTermPress` the terms still render, just unstyled and
 * inert — the sentence reads the same either way.
 */
export function GrammarText({ children, style, onTermPress }: GrammarTextProps) {
  const segments = useMemo(() => parseGrammarTags(children), [children]);

  return (
    <Text style={style}>
      {segments.map((segment, index) =>
        segment.term && onTermPress ? (
          <Text
            key={index}
            accessibilityRole="link"
            accessibilityLabel={`${segment.term} 문법 설명 보기`}
            style={styles.link}
            onPress={() => onTermPress(segment.term as string)}
          >
            {segment.text}
          </Text>
        ) : (
          <Text key={index}>{segment.text}</Text>
        )
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  link: {
    fontFamily: Fonts.bodyMedium,
    color: Colors.info,
    textDecorationLine: 'underline',
  },
});
