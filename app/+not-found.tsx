import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/colors';
import { FontSizes, Fonts } from '@/constants/fonts';
import { Spacing } from '@/constants/layout';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: '없는 화면' }} />
      <View style={styles.container}>
        <Text style={styles.title}>이 화면은 존재하지 않아요.</Text>

        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>홈으로 가기</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.background,
  },
  title: {
    fontFamily: Fonts.headingSemiBold,
    fontSize: FontSizes.xl,
    color: Colors.textPrimary,
  },
  link: {
    marginTop: Spacing.base,
    paddingVertical: Spacing.base,
  },
  linkText: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.sm,
    color: Colors.primaryLight,
  },
});
