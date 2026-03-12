import { describe, expect, it } from 'vitest';

import {
  getExerciseCategoryLabel,
  getLocalizedExerciseName,
  matchesExerciseQuery,
} from '../exerciseLocalization';

describe('exerciseLocalization', () => {
  it('localizes known exercise names into Japanese labels', () => {
    expect(getLocalizedExerciseName('bench press')).toBe('ベンチプレス');
    expect(getLocalizedExerciseName('Sumo Deadlift')).toBe('スモウデッドリフト');
    expect(getLocalizedExerciseName('tempo squat ')).toBe('テンポスクワット');
  });

  it('returns Japanese category labels', () => {
    expect(getExerciseCategoryLabel('bench')).toBe('ベンチ');
    expect(getExerciseCategoryLabel('pull')).toBe('プル');
  });

  it('matches search against both original and localized labels', () => {
    expect(matchesExerciseQuery('bench press', 'ベンチ')).toBe(true);
    expect(matchesExerciseQuery('Romanian Deadlift', 'ルーマニアン')).toBe(true);
    expect(matchesExerciseQuery('Seal Row', 'スクワット')).toBe(false);
  });
});
