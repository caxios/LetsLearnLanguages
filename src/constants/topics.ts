export interface TopicCategory {
  id: string;
  /** Korean display name, e.g. '직장 / 학교'. */
  name: string;
  emoji: string;
  topics: string[];
}

/**
 * 50 diverse real-life topics, grouped into 10 categories.
 *
 * The Topic Practice tab browses these groups directly; daily sentence
 * generation flattens them into {@link TOPIC_POOL} and picks at random, so the
 * two features never drift apart.
 */
export const TOPIC_CATEGORIES: TopicCategory[] = [
  {
    id: 'work-school',
    name: '직장 / 학교',
    emoji: '💼',
    topics: [
      '상사에게 업무 보고하기',
      '회의에서 의견 제시하기',
      '동료와 점심 메뉴 정하기',
      '퇴근 후 약속 잡기',
      '시험/과제 마감에 대한 스트레스',
    ],
  },
  {
    id: 'daily-life',
    name: '일상생활',
    emoji: '☀️',
    topics: [
      '카페에서 음료 주문하기',
      '편의점에서 간식 사기',
      '택배 배송 문의하기',
      '대중교통 이용 중 상황',
      '날씨에 대한 일상 대화',
    ],
  },
  {
    id: 'social',
    name: '사교 / 친구',
    emoji: '🧑‍🤝‍🧑',
    topics: [
      '친구에게 고민 상담하기',
      '친구와 여행 계획 세우기',
      '모임 날짜/장소 조율하기',
      '오랜만에 만난 지인과 근황 나누기',
      '친구의 새로운 소식에 반응하기',
    ],
  },
  {
    id: 'shopping',
    name: '쇼핑 / 소비',
    emoji: '🛍️',
    topics: [
      '온라인 쇼핑 후기 남기기',
      '옷 가게에서 사이즈 문의',
      '중고거래 가격 흥정하기',
      '환불/교환 요청하기',
      '세일 정보 공유하기',
    ],
  },
  {
    id: 'food',
    name: '음식 / 요리',
    emoji: '🍜',
    topics: [
      '맛집 추천 요청하기',
      '배달 음식 주문하기',
      '요리 레시피 설명하기',
      '식당에서 메뉴 고르기',
      '다이어트/건강 식단 이야기',
    ],
  },
  {
    id: 'health',
    name: '건강 / 의료',
    emoji: '🩺',
    topics: [
      '병원 예약 전화하기',
      '아픈 증상 설명하기',
      '약국에서 약 사기',
      '운동 루틴에 대해 이야기하기',
      '건강 검진 결과 이야기',
    ],
  },
  {
    id: 'home',
    name: '주거 / 생활',
    emoji: '🏠',
    topics: [
      '이사 준비/짐 정리하기',
      '부동산에 집 문의하기',
      '층간소음 문제 해결하기',
      '가전제품 AS 요청하기',
      '인테리어/가구 배치 상의하기',
    ],
  },
  {
    id: 'hobby',
    name: '취미 / 여가',
    emoji: '🎬',
    topics: [
      '넷플릭스 드라마 추천하기',
      '주말 계획 이야기하기',
      '콘서트/공연 티켓 예매하기',
      '새로운 취미 시작하기',
      '반려동물 관련 대화',
    ],
  },
  {
    id: 'emotion',
    name: '감정 / 관계',
    emoji: '💬',
    topics: [
      '연인과 사소한 다툼',
      '부모님과 진지한 대화',
      '고마운 마음 전하기',
      '실수에 대해 사과하기',
      '위로/격려의 말 건네기',
    ],
  },
  {
    id: 'finance',
    name: '금융 / 행정',
    emoji: '🏦',
    topics: [
      '은행 업무 보기',
      '공과금/구독료 관리하기',
      '면접 준비/자기소개',
      '미용실/이발소 예약하기',
      '자동차/교통 관련 상황',
    ],
  },
];

/**
 * Flat view of every topic, for daily sentence generation.
 * Each day, 3 topics are randomly selected (excluding recently used ones)
 * so that sentences always come from fresh, varied situations.
 */
export const TOPIC_POOL: string[] = TOPIC_CATEGORIES.flatMap((category) => category.topics);

/** Look a category up by its id — used when restoring the Topic Practice screen. */
export function findCategory(id: string): TopicCategory | undefined {
  return TOPIC_CATEGORIES.find((category) => category.id === id);
}

/**
 * Pick `count` topics at random, excluding any in `exclude`.
 * Falls back to the full pool if too many are excluded.
 */
export function pickRandomTopics(count: number, exclude: string[] = []): string[] {
  const excludeSet = new Set(exclude.map((t) => t.toLowerCase()));
  let available = TOPIC_POOL.filter((t) => !excludeSet.has(t.toLowerCase()));

  // If we've excluded too many, reset to the full pool.
  if (available.length < count) {
    available = [...TOPIC_POOL];
  }

  // Fisher-Yates shuffle on a copy
  const shuffled = [...available];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count);
}
