import { describe, expect, test } from 'vitest';
import type { SessionData } from '@/src/types/index';
import {
  isSnapshotRecent,
  isSessionActive,
  shouldDisplayRecovery,
  selectTodaySessionSlices,
} from '../TodayRecovery';

describe('TodayRecovery - Pure Helpers', () => {
  describe('isSnapshotRecent', () => {
    // Fixed timestamp for stable testing: 2026-07-14 12:00:00 UTC
    const FIXED_NOW = new Date('2026-07-14T12:00:00.000Z').getTime();

    test('returns true for snapshot saved less than 18 hours ago', () => {
      const seventeenHoursAgo = new Date(FIXED_NOW - 17 * 60 * 60 * 1000);
      expect(isSnapshotRecent(seventeenHoursAgo.toISOString(), FIXED_NOW)).toBe(true);
    });

    test('returns true for snapshot saved exactly 18 hours ago', () => {
      const eighteenHoursAgo = new Date(FIXED_NOW - 18 * 60 * 60 * 1000);
      expect(isSnapshotRecent(eighteenHoursAgo.toISOString(), FIXED_NOW)).toBe(true);
    });

    test('returns false for snapshot saved more than 18 hours ago', () => {
      const nineteenHoursAgo = new Date(FIXED_NOW - 19 * 60 * 60 * 1000);
      expect(isSnapshotRecent(nineteenHoursAgo.toISOString(), FIXED_NOW)).toBe(false);
    });

    test('returns false for very old snapshot', () => {
      const oldDate = new Date('2024-01-01T00:00:00.000Z');
      expect(isSnapshotRecent(oldDate.toISOString(), FIXED_NOW)).toBe(false);
    });

    test('returns false for invalid date string', () => {
      expect(isSnapshotRecent('invalid-date', FIXED_NOW)).toBe(false);
    });

    test('returns false for future timestamp', () => {
      const oneHourFromNow = new Date(FIXED_NOW + 60 * 60 * 1000);
      expect(isSnapshotRecent(oneHourFromNow.toISOString(), FIXED_NOW)).toBe(false);
    });

    test('returns false for empty string', () => {
      expect(isSnapshotRecent('', FIXED_NOW)).toBe(false);
    });
  });

  describe('isSessionActive', () => {
    test('returns true when session exists without end_timestamp', () => {
      const activeSession: SessionData = {
        session_id: 'test-session-1',
        date: '2026-07-14',
        total_volume: 1000,
        total_sets: 5,
        start_timestamp: '2026-07-14T10:00:00.000Z',
      };
      expect(isSessionActive(activeSession)).toBe(true);
    });

    test('returns false when session has end_timestamp', () => {
      const completedSession: SessionData = {
        session_id: 'test-session-2',
        date: '2026-07-14',
        total_volume: 1000,
        total_sets: 5,
        start_timestamp: '2026-07-14T10:00:00.000Z',
        end_timestamp: '2026-07-14T11:00:00.000Z',
      };
      expect(isSessionActive(completedSession)).toBe(false);
    });

    test('returns true when session is null (SessionScreen will ensureSession later)', () => {
      expect(isSessionActive(null)).toBe(true);
    });
  });

  describe('shouldDisplayRecovery', () => {
    // Fixed timestamp for stable testing: 2026-07-14 12:00:00 UTC
    const FIXED_NOW = new Date('2026-07-14T12:00:00.000Z').getTime();

    test('returns true when snapshot is recent and session is active', () => {
      const oneHourAgo = new Date(FIXED_NOW - 60 * 60 * 1000);

      const snapshot = {
        saved_at: oneHourAgo.toISOString(),
        session_id: 'active-session',
      };

      const session: SessionData = {
        session_id: 'active-session',
        date: '2026-07-14',
        total_volume: 1000,
        total_sets: 5,
        start_timestamp: '2026-07-14T10:00:00.000Z',
      };

      expect(shouldDisplayRecovery(snapshot, session, FIXED_NOW)).toBe(true);
    });

    test('returns false when snapshot is old', () => {
      const twentyHoursAgo = new Date(FIXED_NOW - 20 * 60 * 60 * 1000);

      const snapshot = {
        saved_at: twentyHoursAgo.toISOString(),
        session_id: 'active-session',
      };

      const session: SessionData = {
        session_id: 'active-session',
        date: '2026-07-14',
        total_volume: 1000,
        total_sets: 5,
        start_timestamp: '2026-07-14T10:00:00.000Z',
      };

      expect(shouldDisplayRecovery(snapshot, session, FIXED_NOW)).toBe(false);
    });

    test('returns false when session is completed', () => {
      const oneHourAgo = new Date(FIXED_NOW - 60 * 60 * 1000);

      const snapshot = {
        saved_at: oneHourAgo.toISOString(),
        session_id: 'completed-session',
      };

      const session: SessionData = {
        session_id: 'completed-session',
        date: '2026-07-14',
        total_volume: 1000,
        total_sets: 5,
        start_timestamp: '2026-07-14T10:00:00.000Z',
        end_timestamp: '2026-07-14T11:00:00.000Z',
      };

      expect(shouldDisplayRecovery(snapshot, session, FIXED_NOW)).toBe(false);
    });

    test('returns true when session does not exist but snapshot is recent (SessionScreen will ensureSession)', () => {
      const oneHourAgo = new Date(FIXED_NOW - 60 * 60 * 1000);

      const snapshot = {
        saved_at: oneHourAgo.toISOString(),
        session_id: 'non-existent-session',
      };

      expect(shouldDisplayRecovery(snapshot, null, FIXED_NOW)).toBe(true);
    });

    test('returns false when snapshot is recent but session is completed', () => {
      const oneHourAgo = new Date(FIXED_NOW - 60 * 60 * 1000);

      const snapshot = {
        saved_at: oneHourAgo.toISOString(),
        session_id: 'completed-session',
      };

      const session: SessionData = {
        session_id: 'completed-session',
        date: '2026-07-14',
        total_volume: 1000,
        total_sets: 5,
        start_timestamp: '2026-07-14T10:00:00.000Z',
        end_timestamp: '2026-07-14T11:00:00.000Z',
      };

      expect(shouldDisplayRecovery(snapshot, session, FIXED_NOW)).toBe(false);
    });

    test('returns false when snapshot is old and session does not exist', () => {
      const twentyHoursAgo = new Date(FIXED_NOW - 20 * 60 * 60 * 1000);

      const snapshot = {
        saved_at: twentyHoursAgo.toISOString(),
        session_id: 'non-existent-session',
      };

      expect(shouldDisplayRecovery(snapshot, null, FIXED_NOW)).toBe(false);
    });
  });

  describe('selectTodaySessionSlices', () => {
    const createSession = (
      sessionId: string,
      date: string,
      totalSets: number,
      startTimestamp?: string,
      endTimestamp?: string,
    ): SessionData => ({
      session_id: sessionId,
      date,
      total_sets: totalSets,
      total_volume: totalSets * 100,
      start_timestamp: startTimestamp ?? `${date}T10:00:00.000Z`,
      ...(endTimestamp ? { end_timestamp: endTimestamp } : {}),
    });

    test('excludes active recovery session from previousSession even if it is the most recent with total_sets > 0', () => {
      const activeRecoverySessionId = 'session-active-recovery';
      const sessions = [
        createSession(
          activeRecoverySessionId,
          '2026-07-14',
          5,
          '2026-07-14T11:00:00.000Z',
          undefined,
        ), // Most recent, has total_sets > 0, but is active recovery
        createSession(
          'session-2',
          '2026-07-14',
          3,
          '2026-07-14T10:00:00.000Z',
          '2026-07-14T10:30:00.000Z',
        ), // Should be previousSession
        createSession(
          'session-1',
          '2026-07-13',
          2,
          '2026-07-13T09:00:00.000Z',
          '2026-07-13T09:30:00.000Z',
        ),
      ];

      const result = selectTodaySessionSlices(sessions, activeRecoverySessionId);

      expect(result.previousSession).not.toBeNull();
      expect(result.previousSession?.session_id).toBe('session-2');
      expect(result.previousSession?.session_id).not.toBe(activeRecoverySessionId);
    });

    test('excludes active recovery session from recentSessions', () => {
      const activeRecoverySessionId = 'session-active-recovery';
      const sessions = [
        createSession(
          'session-4',
          '2026-07-14',
          1,
          '2026-07-14T12:00:00.000Z',
          '2026-07-14T12:30:00.000Z',
        ),
        createSession(
          activeRecoverySessionId,
          '2026-07-14',
          5,
          '2026-07-14T11:00:00.000Z',
          undefined,
        ), // Active recovery, should be excluded
        createSession(
          'session-3',
          '2026-07-14',
          3,
          '2026-07-14T10:00:00.000Z',
          '2026-07-14T10:30:00.000Z',
        ),
        createSession(
          'session-2',
          '2026-07-13',
          2,
          '2026-07-13T09:00:00.000Z',
          '2026-07-13T09:30:00.000Z',
        ),
        createSession(
          'session-1',
          '2026-07-12',
          1,
          '2026-07-12T08:00:00.000Z',
          '2026-07-12T08:30:00.000Z',
        ),
      ];

      const result = selectTodaySessionSlices(sessions, activeRecoverySessionId);

      expect(result.recentSessions).toHaveLength(3);
      expect(result.recentSessions.map((s) => s.session_id)).not.toContain(
        activeRecoverySessionId,
      );
    });

    test('maintains existing order and max 3 recentSessions when activeRecoverySessionId is null', () => {
      const sessions = [
        createSession(
          'session-5',
          '2026-07-14',
          5,
          '2026-07-14T12:00:00.000Z',
          '2026-07-14T12:30:00.000Z',
        ),
        createSession(
          'session-4',
          '2026-07-14',
          4,
          '2026-07-14T11:00:00.000Z',
          '2026-07-14T11:30:00.000Z',
        ),
        createSession(
          'session-3',
          '2026-07-14',
          3,
          '2026-07-14T10:00:00.000Z',
          '2026-07-14T10:30:00.000Z',
        ),
        createSession(
          'session-2',
          '2026-07-13',
          2,
          '2026-07-13T09:00:00.000Z',
          '2026-07-13T09:30:00.000Z',
        ),
        createSession(
          'session-1',
          '2026-07-12',
          1,
          '2026-07-12T08:00:00.000Z',
          '2026-07-12T08:30:00.000Z',
        ),
      ];

      const result = selectTodaySessionSlices(sessions, null);

      // Most recent recorded session is previousSession
      expect(result.previousSession?.session_id).toBe('session-5');

      // Next 3 recorded sessions are recentSessions
      expect(result.recentSessions).toHaveLength(3);
      expect(result.recentSessions.map((s) => s.session_id)).toEqual([
        'session-4',
        'session-3',
        'session-2',
      ]);

      // previousSession should not be in recentSessions
      expect(result.recentSessions.map((s) => s.session_id)).not.toContain(
        'session-5',
      );
    });

    test('handles empty sessions array', () => {
      const result = selectTodaySessionSlices([], null);

      expect(result.previousSession).toBeNull();
      expect(result.recentSessions).toHaveLength(0);
    });

    test('handles sessions with no recorded sets', () => {
      const sessions = [
        createSession(
          'session-no-sets',
          '2026-07-14',
          0,
          '2026-07-14T12:00:00.000Z',
          undefined,
        ),
      ];

      const result = selectTodaySessionSlices(sessions, null);

      expect(result.previousSession).toBeNull();
      expect(result.recentSessions).toHaveLength(0);
    });

    test('excludes active recovery from both previous and recent when it is the only session', () => {
      const activeRecoverySessionId = 'session-only-active';
      const sessions = [
        createSession(
          activeRecoverySessionId,
          '2026-07-14',
          5,
          '2026-07-14T12:00:00.000Z',
          undefined,
        ),
      ];

      const result = selectTodaySessionSlices(sessions, activeRecoverySessionId);

      expect(result.previousSession).toBeNull();
      expect(result.recentSessions).toHaveLength(0);
    });
  });
});
