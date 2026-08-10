import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DailySentenceList } from '@/components/daily/DailySentenceList';
import { Skeleton } from '@/components/ui/Skeleton';
import { Colors } from '@/constants/colors';
import { FontSizes, Fonts } from '@/constants/fonts';
import { Spacing } from '@/constants/layout';
import type { DailySentence } from '@/db/schema';
import {
  useDailySentences,
  useMarkSentenceViewed,
  useRefreshDailySentences,
} from '@/hooks/useDailySentences';
import { useStats } from '@/hooks/useStats';
import { useInputStore } from '@/stores/useInputStore';

export default function HomeScreen() {
  const router = useRouter();
  const sentences = useDailySentences();
  const stats = useStats();
  const markViewed = useMarkSentenceViewed();
  const refreshSentences = useRefreshDailySentences();

  const setKoreanText = useInputStore((s) => s.setKoreanText);
  const setDailySentenceId = useInputStore((s) => s.setDailySentenceId);
  const setEnglishText = useInputStore((s) => s.setEnglishText);

  const handleSentencePress = (sentence: DailySentence) => {
    // Tapping counts as practiced — the card carries a completed badge from here on.
    if (!sentence.isCompleted) {
      markViewed.mutate(sentence.id);
    }

    setKoreanText(sentence.koreanText);
    setDailySentenceId(sentence.id);
    setEnglishText('');
    router.push('/free-input');
  };

  const today = format(new Date(), 'yyyy년 M월 d일 EEEE', { locale: ko });
  const viewedCount = (sentences.data ?? []).filter((s) => s.isCompleted).length;
  const totalCount = sentences.data?.length ?? 0;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={sentences.isFetching && !sentences.isLoading}
          onRefresh={() => {
            sentences.refetch();
            stats.refetch();
          }}
          tintColor={Colors.textSecondary}
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.date}>📅 {today}</Text>
        {stats.isLoading ? (
          <Skeleton height={18} width={140} />
        ) : (
          <Text style={styles.streak}>🔥 {stats.data?.streak ?? 0}일 연속 학습 중</Text>
        )}
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.sectionTitle}>오늘의 문장</Text>
          {totalCount > 0 && (
            <Text style={styles.progress}>
              {viewedCount}/{totalCount} 연습함
            </Text>
          )}
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="새로운 문장 3개 받기"
          accessibilityState={{ busy: refreshSentences.isPending }}
          disabled={refreshSentences.isPending}
          onPress={() => refreshSentences.mutate()}
          style={({ pressed }) => [styles.refresh, pressed && styles.refreshPressed]}
        >
          {refreshSentences.isPending ? (
            <ActivityIndicator size="small" color={Colors.primaryLight} />
          ) : (
            <SymbolView
              name={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }}
              size={18}
              tintColor={Colors.primaryLight}
            />
          )}
          <Text style={styles.refreshLabel}>
            {refreshSentences.isPending ? '생성 중…' : '문장 더 받기'}
          </Text>
        </Pressable>
      </View>

      {refreshSentences.isError && (
        <Text style={styles.error}>
          {refreshSentences.error instanceof Error
            ? refreshSentences.error.message
            : '새 문장을 만들지 못했어요.'}
        </Text>
      )}

      <DailySentenceList
        sentences={sentences.data}
        isLoading={sentences.isLoading}
        error={sentences.error as Error | null}
        onSentencePress={handleSentencePress}
        onRetry={() => sentences.refetch()}
      />

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>최근 학습</Text>
      {stats.isLoading ? (
        <Skeleton height={18} width="70%" />
      ) : (
        <Text style={styles.stats}>
          평균 점수: {stats.data?.averageScore ?? 0}점 | 총 {stats.data?.total ?? 0}문장
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.base,
    paddingBottom: Spacing['3xl'],
    gap: Spacing.base,
  },
  header: {
    gap: Spacing.xs,
  },
  date: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
  streak: {
    fontFamily: Fonts.headingSemiBold,
    fontSize: FontSizes.base,
    color: Colors.textPrimary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  sectionTitle: {
    fontFamily: Fonts.heading,
    fontSize: FontSizes.xl,
    color: Colors.textPrimary,
  },
  progress: {
    marginTop: Spacing.xs,
    fontFamily: Fonts.body,
    fontSize: FontSizes.xs,
    color: Colors.textMuted,
  },
  refresh: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  refreshPressed: {
    opacity: 0.6,
  },
  refreshLabel: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.xs,
    color: Colors.primaryLight,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: Spacing.sm,
  },
  error: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.error,
  },
  stats: {
    fontFamily: Fonts.body,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
  },
});
