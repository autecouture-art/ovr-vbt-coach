import { describe, expect, it } from "vitest";
import type { SessionReadinessData, SetData } from "../../types/index";
import {
  AI_CONSULTATION_NOTE_PREFIX,
  SESSION_READINESS_NOTE_PREFIX,
  appendAiConsultationMarkerToNotes,
  buildConsultationId,
  buildSessionNotesWithReadiness,
  mergeSessionBodyWithLatestMarkers,
  removeSessionSystemMarkers,
} from "../SessionNotes";

const readiness: SessionReadinessData = {
  dieting: null,
  sleep_quality: "ok",
  pain_area: null,
  pain_score: 0,
  pain_reviewed: true,
  pain_reviewed_at: "2026-08-05T01:00:00.000Z",
  week_day: "Week10-Day1",
  main_lift: "SQ",
  day_role: "sq_main_day",
};

const latestSet = (setIndex: number): SetData => ({
  session_id: "session-1",
  lift: "Low Bar Squat",
  set_index: setIndex,
  load_kg: 112.5,
  reps: 3,
  device_type: "OVR Velocity",
  set_type: "normal",
  avg_velocity: 0.4,
  velocity_loss: 8,
  timestamp: `2026-08-05T01:0${setIndex}:00.000Z`,
});

describe("SessionNotes", () => {
  it("preserves latest DB consultation markers when completion refreshes readiness", () => {
    const consultation = `${AI_CONSULTATION_NOTE_PREFIX}${JSON.stringify({
      id: "consult-1",
    })}`;
    const latestDbNotes = `user note\n${consultation}\n#SESSION_READINESS_JSON:{"pain_score":null}`;
    const merged = buildSessionNotesWithReadiness(
      latestDbNotes,
      "stale currentSession note",
      readiness,
    );

    expect(merged).toContain("user note");
    expect(merged).toContain(consultation);
    expect(merged).not.toContain("stale currentSession note");
    expect(merged.match(/#SESSION_READINESS_JSON:/g)).toHaveLength(1);
    expect(merged).toContain('"pain_reviewed":true');
  });

  it("deduplicates an identical consultation marker", () => {
    const payload = {
      id: "consult-1",
      created_at: "2026-08-05T01:00:00.000Z",
      packet_type: "latest_set" as const,
      prompt_snapshot: "packet",
    };
    const once = appendAiConsultationMarkerToNotes("", payload);
    expect(appendAiConsultationMarkerToNotes(once, payload)).toBe(once);
  });

  it("keeps latest markers when the editable note body is replaced", () => {
    const marker = `${AI_CONSULTATION_NOTE_PREFIX}{"id":"consult-1"}`;
    expect(
      mergeSessionBodyWithLatestMarkers(
        "edited user note",
        `old user note\n${marker}\n#SESSION_READINESS_JSON:{}`,
      ),
    ).toBe(`edited user note\n${marker}`);
  });

  it("does not duplicate a marker already present in the editable body", () => {
    const marker = `${AI_CONSULTATION_NOTE_PREFIX}{"id":"consult-1"}`;
    const merged = mergeSessionBodyWithLatestMarkers(
      `edited user note\n${marker}`,
      `old user note\n${marker}`,
    );

    expect(merged.match(/#AI_CONSULTATION_JSON:/g)).toHaveLength(1);
  });

  it("hides large machine markers from the editable training memo", () => {
    const promptSnapshot = "# VBT相談パケット\n" + "詳細データ\n".repeat(100);
    const consultation = `${AI_CONSULTATION_NOTE_PREFIX}${JSON.stringify({
      id: "consult-1",
      prompt_snapshot: promptSnapshot,
    })}`;
    const visible = removeSessionSystemMarkers(
      `user memo\n${consultation}\n#SESSION_READINESS_JSON:{"week_day":"Week10-Day1"}`,
    );

    expect(visible).toBe("user memo");
    expect(visible).not.toContain(AI_CONSULTATION_NOTE_PREFIX);
    expect(visible).not.toContain(SESSION_READINESS_NOTE_PREFIX);
  });

  it("does not turn repeated resume/save cycles into a growing memo", () => {
    const consultation = appendAiConsultationMarkerToNotes("user memo", {
      id: "consult-1",
      created_at: "2026-08-05T01:00:00.000Z",
      packet_type: "full_context",
      prompt_snapshot: "large packet",
    });
    const stored = buildSessionNotesWithReadiness(null, consultation, readiness);

    expect(removeSessionSystemMarkers(stored)).toBe("user memo");
    expect(
      removeSessionSystemMarkers(
        buildSessionNotesWithReadiness(stored, stored, readiness),
      ),
    ).toBe("user memo");
  });

  it("uses a deterministic id for identical packets and changes it for a new set", () => {
    const first = buildConsultationId({
      sessionId: "session-1",
      packetType: "latest_set",
      latestSet: latestSet(1),
      contentRevision: { plan: "week10-v1" },
    });
    expect(
      buildConsultationId({
        sessionId: "session-1",
        packetType: "latest_set",
        latestSet: latestSet(1),
        contentRevision: { plan: "week10-v1" },
      }),
    ).toBe(first);
    expect(
      buildConsultationId({
        sessionId: "session-1",
        packetType: "latest_set",
        latestSet: latestSet(2),
        contentRevision: { plan: "week10-v1" },
      }),
    ).not.toBe(first);
  });
});
