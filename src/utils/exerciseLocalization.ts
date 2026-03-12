import type { Exercise } from '../types/index';

const CATEGORY_LABELS: Record<Exercise['category'], string> = {
  squat: 'スクワット',
  bench: 'ベンチ',
  deadlift: 'デッドリフト',
  press: 'プレス',
  pull: 'プル',
  accessory: '補助',
};

const EXERCISE_NAME_LABELS: Record<string, string> = {
  'larsen bench press': 'ラーセンベンチプレス',
  'sumo deadlift': 'スモウデッドリフト',
  'cable arm curl': 'ケーブルアームカール',
  'adductor delta new': 'アダクター DELTA',
  'shoulder press': 'ショルダープレス',
  'bench press': 'ベンチプレス',
  dips: 'ディップス',
  'behindneck shoulder press': 'ビハインドネックショルダープレス',
  'box squat': 'ボックススクワット',
  'leg extension delta': 'レッグエクステンション DELTA',
  'reverse pec deck fly': 'リバースペックデックフライ',
  'leg curl delta': 'レッグカール DELTA',
  'lat pull delta': 'ラットプル DELTA',
  'short range pec fly': 'ショートレンジペックフライ',
  'larsen narrow bench': 'ラーセンナローベンチ',
  'back squat': 'バックスクワット',
  'one hand row': 'ワンハンドロウ',
  'pec fly': 'ペックフライ',
  chinning: 'チンニング',
  'cable side raise': 'ケーブルサイドレイズ',
  '1/2/5 tempo sumodeadlift': '1/2/5 テンポ スモウデッドリフト',
  'larsen bottom pulse bench': 'ラーセンボトムパルスベンチ',
  'adductor focused wide dea': 'アダクター重視ワイドデッドリフト',
  'cable press down': 'ケーブルプレスダウン',
  'ssb adductor squat': 'SSB アダクタースクワット',
  'cable french press': 'ケーブルフレンチプレス',
  'seal row': 'シールロウ',
  'pendulum squat': 'ペンデュラムスクワット',
  'military press': 'ミリタリープレス',
  'larsen 4/2/0 tempo bench': 'ラーセン 4/2/0 テンポベンチ',
  'landmune shoulder press': 'ランドマインショルダープレス',
  'cable face pull': 'ケーブルフェイスプル',
  'sumo stiff legged deadli': 'スモウスティッフレッグドデッドリフト',
  'sbb support squat': 'SBB サポートスクワット',
  'deficit sumo deadlift': 'デフィシットスモウデッドリフト',
  'romanian deadlift': 'ルーマニアンデッドリフト',
  'low bar squat': 'ローバースクワット',
  'ssb bulgarian squat': 'SSB ブルガリアンスクワット',
  'tempo squat': 'テンポスクワット',
  'lat pull down delta.co': 'ラットプルダウン DELTA',
  squat: 'スクワット',
  deadlift: 'デッドリフト',
};

const normalizeExerciseKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');

export const getExerciseCategoryLabel = (
  category?: Exercise['category'] | string | null,
) => {
  if (!category) return '未分類';
  return CATEGORY_LABELS[category as Exercise['category']] ?? category;
};

export const getLocalizedExerciseName = (name?: string | null) => {
  if (!name) return '不明';

  const normalized = normalizeExerciseKey(name);
  const directMatch = EXERCISE_NAME_LABELS[normalized];
  if (directMatch) return directMatch;

  return name.trim();
};

export const matchesExerciseQuery = (name: string, query: string) => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const source = normalizeExerciseKey(name);
  const localized = normalizeExerciseKey(getLocalizedExerciseName(name));
  return source.includes(normalizedQuery) || localized.includes(normalizedQuery);
};
