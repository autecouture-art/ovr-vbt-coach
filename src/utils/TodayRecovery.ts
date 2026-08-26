import type { SessionData } from '@/src/types/index';

/**
 * 18-hour validity window for session recovery snapshots
 */
const RECOVERY_WINDOW_HOURS = 18;

/**
 * Maximum age in milliseconds for a snapshot to be considered valid
 */
const MAX_SNAPSHOT_AGE_MS = RECOVERY_WINDOW_HOURS * 60 * 60 * 1000;

/**
 * Check if a snapshot timestamp is within the 18-hour recovery window
 * @param savedAt - ISO timestamp string from snapshot.saved_at
 * @param nowMs - Current time in milliseconds (default: Date.now())
 * @returns true if saved within 18 hours, false otherwise
 */
export function isSnapshotRecent(savedAt: string, nowMs: number = Date.now()): boolean {
  const snapshotTime = new Date(savedAt).getTime();

  // Check for invalid date
  if (isNaN(snapshotTime)) {
    return false;
  }

  const age = nowMs - snapshotTime;
  return age <= MAX_SNAPSHOT_AGE_MS && age >= 0;
}

/**
 * Check if a session represents an active (not completed) session
 * @param session - SessionData object or null if session not found
 * @returns true if session has no end_timestamp, false otherwise
 * Note: Returns true for null sessions because SessionScreen will ensureSession later
 */
export function isSessionActive(session: SessionData | null): boolean {
  // SessionScreen ensures session later if null
  // Only reject if session has end_timestamp (completed)
  if (session && session.end_timestamp) {
    return false;
  }
  return true;
}

/**
 * Determine if a recovery snapshot should be displayed as a valid recovery option
 * Combines time-based validity and session state checks
 * @param snapshot - Snapshot containing saved_at and session_id
 * @param session - SessionData from database or null if not found
 * @param nowMs - Current time in milliseconds (default: Date.now())
 * @returns true if both recent and active, false otherwise
 */
export function shouldDisplayRecovery(
  snapshot: { saved_at: string; session_id: string },
  session: SessionData | null,
  nowMs: number = Date.now(),
): boolean {
  return isSnapshotRecent(snapshot.saved_at, nowMs) && isSessionActive(session);
}

/**
 * Get sort key for session ordering (most recent first)
 * @param session - SessionData object
 * @returns Sort key string (end_timestamp, start_timestamp, date, or session_id)
 */
const getSessionSortKey = (session: SessionData): string =>
  session.end_timestamp ??
  session.start_timestamp ??
  session.date ??
  session.session_id;

/**
 * Compare two sessions in descending order (most recent first)
 * @param left - First session
 * @param right - Second session
 * @returns Negative if right should come first, positive if left should come first
 */
const compareSessionsDesc = (left: SessionData, right: SessionData): number => {
  const sortCompare = getSessionSortKey(right).localeCompare(getSessionSortKey(left));
  if (sortCompare !== 0) {
    return sortCompare;
  }
  return right.session_id.localeCompare(left.session_id);
};

/**
 * Check if a session has recorded sets
 * @param session - SessionData object
 * @returns true if total_sets > 0, false otherwise
 */
const isRecordedSession = (session: SessionData): boolean => session.total_sets > 0;

/**
 * Check if two sessions are the same
 * @param left - First session or null
 * @param right - Second session or null
 * @returns true if both sessions exist and have the same session_id
 */
const isSameSession = (
  left: SessionData | null,
  right: SessionData | null,
): boolean => {
  if (!left || !right) {
    return false;
  }
  if (left.session_id && right.session_id) {
    return left.session_id === right.session_id;
  }
  return left === right;
};

/**
 * Select today's session slices for display
 * Excludes the active recovery session from both previousSession and recentSessions
 * @param sessions - All sessions to consider
 * @param activeRecoverySessionId - Session ID of the active recovery session to exclude (null if none)
 * @returns Object containing previousSession (most recent recorded session) and recentSessions (up to 3 additional recorded sessions)
 */
export function selectTodaySessionSlices(
  sessions: SessionData[],
  activeRecoverySessionId: string | null = null,
): {
  previousSession: SessionData | null;
  recentSessions: SessionData[];
} {
  const sortedSessions = [...sessions].sort(compareSessionsDesc);

  // Filter out active recovery session from previousSession candidates
  const previousSessionCandidates = sortedSessions.filter(
    (session) => session.session_id !== activeRecoverySessionId,
  );
  const previousSession =
    previousSessionCandidates.find((session) => isRecordedSession(session)) ?? null;

  const recentSessions = sortedSessions
    .filter(
      (session) =>
        isRecordedSession(session) &&
        !isSameSession(session, previousSession) &&
        session.session_id !== activeRecoverySessionId,
    )
    .slice(0, 3);

  return { previousSession, recentSessions };
}
