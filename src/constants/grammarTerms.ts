/**
 * Korean names for the grammar points that come up when teaching English.
 *
 * A safety net, not the primary source: the model reports the terms it used in a
 * schema-required array. This list is what lets the app still linkify feedback
 * when that array comes back empty — and what makes evaluations stored before
 * the array existed clickable too.
 *
 * Order does not matter; matching always prefers the longest term, so
 * "가정법 과거완료" wins over "가정법".
 */
export const KNOWN_GRAMMAR_TERMS: string[] = [
  // Tense and aspect
  '현재완료진행', '과거완료진행', '현재완료', '과거완료', '미래완료',
  '현재진행', '과거진행', '미래진행', '단순과거', '단순현재', '시제일치',
  // Participles and non-finite forms
  '현재분사', '과거분사', '분사구문', '분사',
  'to부정사', '원형부정사', '부정사', '동명사',
  // Clauses
  '관계대명사', '관계부사', '선행사', '명사절', '형용사절', '부사절',
  '간접의문문', '직접의문문', '종속절', '주절',
  // Voice and mood
  '수동태', '능동태', '가정법 과거완료', '가정법 과거', '가정법', '명령문',
  // Verbs
  '조동사', '사역동사', '지각동사', '구동사', '자동사', '타동사', '동사원형',
  // Comparison
  '비교급', '최상급', '원급',
  // Nouns and determiners
  '정관사', '부정관사', '관사', '가산명사', '불가산명사', '복수형', '단수형',
  // Case and structure
  '주격', '목적격', '소유격', '가주어', '진주어', '가목적어', '진목적어',
  '도치', '강조구문', '병렬구조',
  // Other
  '접속사', '전치사', '부사', '형용사', '간접화법', '직접화법', '화법',
];
