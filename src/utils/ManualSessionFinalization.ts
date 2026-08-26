import type { SessionData, SetData } from "../types/index";

export const SESSION_READINESS_MARKER_PREFIX = "#SESSION_READINESS_JSON:";

export interface SplitManualSessionNotesResult {
  body: string;
  markerBlock: string;
}

export interface BuildManualSessionCompletionPayloadParams {
  sessionId: string;
  savedSets: SetData[];
  manualStartedAt: Date;
  completedAt: Date;
  existingSession: SessionData | null;
  notes?: string;
}

/**
 * Split session notes into body and readiness marker block.
 * Normalizes CRLF to LF, trims whitespace, and preserves order.
 */
export const splitManualSessionNotes = (
  notes: string | null | undefined,
): SplitManualSessionNotesResult => {
  if (!notes) {
    return { body: "", markerBlock: "" };
  }

  // Normalize CRLF to LF
  const normalized = notes.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const bodyLines: string[] = [];
  const markerLines: string[] = [];

  for (const line of normalized.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) {
      // Preserve blank lines in body only
      bodyLines.push("");
      continue;
    }

    if (trimmed.startsWith(SESSION_READINESS_MARKER_PREFIX)) {
      markerLines.push(trimmed);
    } else {
      bodyLines.push(trimmed);
    }
  }

  // Join with newlines, trim trailing whitespace
  const body = bodyLines.join("\n").trim();
  const markerBlock = markerLines.join("\n").trim();

  return { body, markerBlock };
};

/**
 * Merge existing and manual session notes.
 * - Keeps existing body
 * - Appends the manual body block only when nonempty and not exactly equal
 * - Keeps ONLY existing markerBlock (drops manual marker lines)
 * - Adds one blank line between blocks
 */
export const mergeManualSessionNotes = (
  existingNotes?: string | null,
  manualNotes?: string | null,
): string | undefined => {
  const existing = splitManualSessionNotes(existingNotes);
  const manual = splitManualSessionNotes(manualNotes);

  const blocks: string[] = [];

  if (existing.body) {
    blocks.push(existing.body);
  }

  if (manual.body && manual.body !== existing.body) {
    blocks.push(manual.body);
  }

  if (existing.markerBlock) {
    blocks.push(existing.markerBlock);
  }

  return blocks.length > 0 ? blocks.join("\n\n") : undefined;
};

/**
 * Build session completion payload for manual entry.
 * Returns null for no sets or missing existing session.
 */
export const buildManualSessionCompletionPayload = ({
  sessionId,
  savedSets,
  manualStartedAt,
  completedAt,
  existingSession,
  notes,
}: BuildManualSessionCompletionPayloadParams): SessionData | null => {
  // Return null for no sets or missing existing session
  if (savedSets.length === 0) {
    return null;
  }
  if (!existingSession) {
    return null;
  }

  const durationSeconds = Math.max(
    0,
    Math.round((completedAt.getTime() - manualStartedAt.getTime()) / 1000),
  );

  return {
    // Spread existing session to preserve unrelated metadata
    ...existingSession,

    // Override these fields with new values
    session_id: sessionId,
    total_volume: savedSets.reduce(
      (total, set) => total + set.load_kg * set.reps,
      0,
    ),
    total_sets: savedSets.length,
    duration_minutes: durationSeconds / 60,
    duration_seconds: durationSeconds,
    end_timestamp: completedAt.toISOString(),
    notes: mergeManualSessionNotes(existingSession.notes, notes),

    // Preserve these fields exactly from existing session
    date: existingSession.date,
    start_timestamp: existingSession.start_timestamp,
    readiness: existingSession.readiness,
    avg_hr: existingSession.avg_hr,
    lifts: existingSession.lifts,
  };
};
