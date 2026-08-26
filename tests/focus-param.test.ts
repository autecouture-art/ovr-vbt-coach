/**
 * focusパラメータから表示モードを決定する純粋関数のテスト
 */
import { describe, expect, it } from 'vitest';

// Graph.tsxの純粋関数（テスト対象）
const getGraphTabFromFocus = (focus?: string): 'lvp' | 'trend' | 'zones' => {
  if (focus === 'strength') {
    return 'trend';
  }
  if (focus === 'speed') {
    return 'lvp';
  }
  return 'lvp'; // default: focusなし/未知値の場合は既定値へ
};

// HistoryScreen.tsxの純粋関数（テスト対象）
const getHistoryViewModeFromFocus = (focus?: string): 'list' | 'calendar' | 'graph' => {
  if (focus === 'recovery') {
    return 'graph';
  }
  if (focus === 'videos') {
    return 'list';
  }
  return 'list'; // default: focusなし/未知値の場合は既定値へ
};

describe('getGraphTabFromFocus', () => {
  it('strength → trend', () => {
    expect(getGraphTabFromFocus('strength')).toBe('trend');
  });

  it('speed → lvp', () => {
    expect(getGraphTabFromFocus('speed')).toBe('lvp');
  });

  it('undefined → lvp (既定値)', () => {
    expect(getGraphTabFromFocus(undefined)).toBe('lvp');
  });

  it('未知値 → lvp (既定値)', () => {
    expect(getGraphTabFromFocus('unknown')).toBe('lvp');
    expect(getGraphTabFromFocus('')).toBe('lvp');
    expect(getGraphTabFromFocus('random')).toBe('lvp');
  });
});

describe('getHistoryViewModeFromFocus', () => {
  it('recovery → graph', () => {
    expect(getHistoryViewModeFromFocus('recovery')).toBe('graph');
  });

  it('videos → list', () => {
    expect(getHistoryViewModeFromFocus('videos')).toBe('list');
  });

  it('undefined → list (既定値)', () => {
    expect(getHistoryViewModeFromFocus(undefined)).toBe('list');
  });

  it('未知値 → list (既定値)', () => {
    expect(getHistoryViewModeFromFocus('unknown')).toBe('list');
    expect(getHistoryViewModeFromFocus('')).toBe('list');
    expect(getHistoryViewModeFromFocus('random')).toBe('list');
  });
});
