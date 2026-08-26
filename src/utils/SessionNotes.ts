import type { SessionReadinessData, SetData } from "../types/index";

export const SESSION_READINESS_NOTE_PREFIX = "#SESSION_READINESS_JSON:";
export const AI_CONSULTATION_NOTE_PREFIX = "#AI_CONSULTATION_JSON:";

export type ConsultationPacketType = "full_context" | "latest_set";

export type AiConsultationMarkerPayload = {
  id: string;
  created_at: string;
  packet_type: ConsultationPacketType;
  prompt_snapshot: string;
  adopted_decision?: string | null;
};

export function removeSessionReadinessMarkers(notes: string): string {
  return notes
    .split("\n")
    .filter((line) => !line.trim().startsWith(SESSION_READINESS_NOTE_PREFIX))
    .join("\n")
    .trim();
}

/**
 * Return only the user-authored portion of a session note.
 *
 * Readiness and consultation records are intentionally kept in the persisted
 * note for backwards-compatible export, but they are machine records rather
 * than text the user should see or edit in the training memo field. In
 * particular, consultation markers contain a prompt snapshot and can be very
 * large after resuming a session.
 */
export function removeSessionSystemMarkers(notes: string): string {
  return notes
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      return (
        !trimmed.startsWith(SESSION_READINESS_NOTE_PREFIX) &&
        !trimmed.startsWith(AI_CONSULTATION_NOTE_PREFIX)
      );
    })
    .join("\n")
    .trim();
}

export function buildSessionNotesWithReadiness(
  latestDbNotes: string | null | undefined,
  fallbackNotes: string | null | undefined,
  readiness: SessionReadinessData,
): string {
  const source = latestDbNotes ?? fallbackNotes ?? "";
  const baseNotes = removeSessionReadinessMarkers(source);
  const marker = `${SESSION_READINESS_NOTE_PREFIX}${JSON.stringify(readiness)}`;
  return baseNotes ? `${baseNotes}\n${marker}` : marker;
}

export function mergeSessionBodyWithLatestMarkers(
  editedBody: string,
  latestDbNotes: string | null | undefined,
): string {
  const markers = (latestDbNotes ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.startsWith("#") &&
        !line.startsWith(SESSION_READINESS_NOTE_PREFIX),
    );
  const uniqueMarkers = [...new Set(markers)];
  const latestMarkerSet = new Set(uniqueMarkers);
  const body = removeSessionReadinessMarkers(editedBody)
    .split("\n")
    .filter((line) => !latestMarkerSet.has(line.trim()))
    .join("\n")
    .trim();
  return [body, ...uniqueMarkers].filter(Boolean).join("\n");
}

export function appendAiConsultationMarkerToNotes(
  notes: string,
  payload: AiConsultationMarkerPayload,
): string {
  const alreadySaved = notes
    .split("\n")
    .filter((line) => line.trim().startsWith(AI_CONSULTATION_NOTE_PREFIX))
    .some((line) => {
      try {
        const parsed = JSON.parse(
          line.trim().slice(AI_CONSULTATION_NOTE_PREFIX.length),
        ) as { id?: string };
        return parsed.id === payload.id;
      } catch {
        return false;
      }
    });
  if (alreadySaved) return notes.trim();

  const marker = `${AI_CONSULTATION_NOTE_PREFIX}${JSON.stringify({
    ...payload,
    response: null,
    adopted_decision: payload.adopted_decision ?? "pending_user_review",
  })}`;
  const base = notes.trim();
  return base ? `${base}\n${marker}` : marker;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function fnv1a32(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function buildConsultationId(input: {
  sessionId: string;
  packetType: ConsultationPacketType;
  latestSet?: SetData | null;
  contentRevision?: unknown;
}): string {
  const latestSet = input.latestSet
    ? {
        session_id: input.latestSet.session_id,
        lift: input.latestSet.lift,
        set_index: input.latestSet.set_index,
        load_kg: input.latestSet.load_kg,
        reps: input.latestSet.reps,
        rpe: input.latestSet.rpe ?? null,
        e1rm: input.latestSet.e1rm ?? null,
        timestamp:
          input.latestSet.end_timestamp ?? input.latestSet.timestamp ?? null,
      }
    : null;
  const fingerprint = stableStringify({
    session_id: input.sessionId,
    packet_type: input.packetType,
    latest_set: latestSet,
    content_revision: input.contentRevision ?? null,
  });
  return `chappy_${input.packetType}_${fnv1a32(fingerprint)}`;
}
