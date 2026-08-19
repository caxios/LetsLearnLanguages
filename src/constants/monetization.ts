/** The five metered actions. Premium bypasses every limit and every ad. */
export type QuotaFeature =
  | 'dailySentenceRefresh'
  | 'dailySentenceEvaluation'
  | 'topicPracticeGenerate'
  | 'topicPracticeEvaluation'
  | 'reviewEvaluation';

/** Daily allowances for free users. */
export const FreeLimits = {
  dailySentenceRefresh: 2,
  dailySentenceEvaluation: 5,
  topicPracticeGenerate: 2,
  topicPracticeEvaluation: 5,
  reviewEvaluation: 5,
} as const;

/** How many rewarded ads must be watched to earn a bonus. */
export const ADS_PER_BONUS = 2;

/** How many extra tries one completed set of ads hands back. */
export const AD_BONUS_TRIES = 1;

/** Field inside `DailyUsage` that a feature counts against. */
export type UsageCountKey = `${QuotaFeature}Count`;

export interface QuotaFeatureMeta {
  countKey: UsageCountKey;
  limit: number;
  /** Korean name of the action, used in paywall copy and quota meters. */
  label: string;
  /** Counter word that fits `label`. */
  unit: string;
  /**
   * Whether a free user must watch a rewarded ad before the action runs.
   * True for the three evaluation types; generation and refresh are quota-only.
   */
  adGated: boolean;
}

export const QUOTA_FEATURES: Record<QuotaFeature, QuotaFeatureMeta> = {
  dailySentenceRefresh: {
    countKey: 'dailySentenceRefreshCount',
    limit: FreeLimits.dailySentenceRefresh,
    label: '새 문장 받기',
    unit: '회',
    adGated: false,
  },
  dailySentenceEvaluation: {
    countKey: 'dailySentenceEvaluationCount',
    limit: FreeLimits.dailySentenceEvaluation,
    label: '오늘의 문장 평가',
    unit: '번',
    adGated: true,
  },
  topicPracticeGenerate: {
    countKey: 'topicPracticeGenerateCount',
    limit: FreeLimits.topicPracticeGenerate,
    label: '주제별 문장 생성',
    unit: '회',
    adGated: false,
  },
  topicPracticeEvaluation: {
    countKey: 'topicPracticeEvaluationCount',
    limit: FreeLimits.topicPracticeEvaluation,
    label: '주제별 연습 평가',
    unit: '번',
    adGated: true,
  },
  reviewEvaluation: {
    countKey: 'reviewEvaluationCount',
    limit: FreeLimits.reviewEvaluation,
    label: '복습 채점',
    unit: '번',
    adGated: true,
  },
};

export const QUOTA_FEATURE_LIST = Object.keys(QUOTA_FEATURES) as QuotaFeature[];

/**
 * Which evaluation quota a translation counts against. The 자유 입력 screen is
 * shared by all three entry points, so the quota follows where the sentence came
 * from — a hand-typed sentence has no origin of its own and joins the daily pool.
 */
export function evaluationFeatureFor(source: 'daily' | 'topic' | 'free'): QuotaFeature {
  if (source === 'topic') return 'topicPracticeEvaluation';
  return 'dailySentenceEvaluation';
}
