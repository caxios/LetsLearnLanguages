import React, { useMemo } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { Colors } from '@/constants/colors';
import { Fonts } from '@/constants/fonts';
import { autoTagKnownTerms, parseGrammarTags } from '@/utils/grammarTags';

interface GrammarTextProps {
  children: string;
  style?: StyleProp<TextStyle>;
  /**
    * Required on purpose. Making it optional meant a screen that forgot to pass
    * it rendered terms as ordinary text and looked exactly like feedback with no
    * grammar in it — a failure with no symptom. Now the compiler catches it.
    */
  onTermPress: (term: string) => void;
}

/**
 * Feedback text with its `[[tagged]]` grammar terms turned into links.
 *
 * Links are nested `Text` rather than separate views so they wrap inline with
 * the prose. With no `onTermPress` the terms still render, just unstyled and
 * inert — the sentence reads the same either way.
 */
export function GrammarText({ children, style, onTermPress }: GrammarTextProps) {
  const segments = useMemo(() => {
    const tagged = parseGrammarTags(children);
    if (tagged.some((segment) => segment.term)) return tagged;

    // Nothing tagged: either the model named no grammar, or this text was stored
    // before tagging existed. Fall back to the known-terms dictionary so older
    // evaluations get links too.
    return parseGrammarTags(autoTagKnownTerms(children));
  }, [children]);

  return (
    <Text style={style}>
      {segments.map((segment, index) =>
        segment.term ? (
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
