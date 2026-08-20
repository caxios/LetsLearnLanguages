import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AdBanner } from '@/components/ads/AdBanner';
import { QuotaExceededModal } from '@/components/monetization/QuotaExceededModal';
import { QuotaMeter } from '@/components/monetization/QuotaMeter';
import { DailyMessageCard } from '@/components/daily/DailyMessageCard';
import { DailySentenceList } from '@/components/daily/DailySentenceList';
import { StatsPanel } from '@/components/daily/StatsPanel';
import { StreakBadge } from '@/components/daily/StreakBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Colors } from '@/constants/colors';
import { FontSizes, Fonts } from '@/constants/fonts';
import { Spacing } from '@/constants/layout';
import type { DailySentence } from '@/db/schema';
import {
  useDailySentences,
  useRefreshDailySentences,
} from '@/hooks/useDailySentences';
import { useDailyMessage } from '@/hooks/useDailyMessage';
import { useRecordVisit } from '@/hooks/useRecordVisit';
import { useGatedAction } from '@/hooks/useQuota';
import { useStats } from '@/hooks/useStats';
import { useInputStore } from '@/stores/useInputStore';

export default function HomeScreen() {
  const router = useRouter();
  const sentences = useDailySentences();
  const stats = useStats();
  const dailyMessage = useDailyMessage();
  const refreshSentences = useRefreshDailySentences();
  const refreshQuota = useGatedAction('dailySentenceRefresh');

  // Opening the app counts towards the attendance streak.
  useRecordVisit();

  const setKoreanText = useInputStore((s) => s.setKoreanText);
  const setDailySentenceId = useInputStore((s) => s.setDailySentenceId);
  const setEnglishText = useInputStore((s) => s.setEnglishText);
  const setSource = useInputStore((s) => s.setSource);

  const handleSentencePress = (sentence: DailySentence) => {
    // Opening a card is not practice: the completed badge is earned by a graded attempt.
    setKoreanText(sentence.koreanText);
    setDailySentenceId(sentence.id);
    setEnglishText('');
    // Tells the shared input screen which evaluation quota this spends.
    setSource('daily');
    router.push('/free-input');
  };

  // Refreshing is metered but not ad-gated — only evaluations carry an ad.
  const handleRefresh = () => {
    refreshQuota.run(() => refreshSentences.mutateAsync());
  };

  const today = format(new Date(), 'yyyy년 M월 d일 EEEE', { locale: ko });
  const completedCount = (sentences.data ?? []).filter((s) => s.isCompleted).length;
  const totalCount = sentences.data?.length ?? 0;

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={sentences.isFetching && !sentences.isLoading}
            onRefresh={() => {
              sentences.refetch();
              stats.refetch();
              dailyMessage.refetch();
            }}
            tintColor={Colors.textSecondary}
          />
        }
      >
        <Text style={styles.date}>📅 {today}</Text>

        {stats.isLoading ? (
          <Skeleton height={176} borderRadius={16} />
        ) : (
          <StreakBadge
            streak={stats.data?.streak ?? 0}
            activeDates={stats.data?.activeDates ?? []}
            today={stats.data?.today ?? format(new Date(), 'yyyy-MM-dd')}
          />
        )}

        <DailyMessageCard
          message={dailyMessage.data?.message}
          isLoading={dailyMessage.isLoading}
        />

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>오늘의 문장</Text>
            {totalCount > 0 && (
              <Text style={styles.progress}>
                {completedCount}/{totalCount} 연습함
              </Text>
            )}
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="새로운 문장 3개로 바꾸기"
            accessibilityState={{ busy: refreshSentences.isPending }}
            disabled={refreshSentences.isPending}
            onPress={handleRefresh}
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
              {refreshSentences.isPending ? '생성 중…' : '새 문장 받기'}
            </Text>
          </Pressable>
        </View>

        <QuotaMeter feature="dailySentenceRefresh" variant="pill" />

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

        {stats.isLoading ? (
          <Skeleton height={140} borderRadius={16} />
        ) : (
          <StatsPanel
            uniqueSentences={stats.data?.uniqueSentences ?? 0}
            totalReviews={stats.data?.totalReviews ?? 0}
          />
        )}

        <QuotaExceededModal {...refreshQuota.modal} />
      </ScrollView>

      <AdBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: Spacing.base,
    paddingBottom: Spacing['3xl'],
    gap: Spacing.base,
  },
  date: {
    fontFamily: Fonts.bodyMedium,
    fontSize: FontSizes.sm,
    color: Colors.textSecondary,
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
});
