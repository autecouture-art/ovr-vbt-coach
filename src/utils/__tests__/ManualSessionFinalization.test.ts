import { describe, expect, test } from "vitest";

import {
  SESSION_READINESS_MARKER_PREFIX,
  splitManualSessionNotes,
  mergeManualSessionNotes,
  buildManualSessionCompletionPayload,
} from "../ManualSessionFinalization";
import type { SessionData, SetData } from "../../types/index";

describe("ManualSessionFinalization", () => {
  describe("SESSION_READINESS_MARKER_PREFIX", () => {
    test("should export the marker prefix constant", () => {
      expect(SESSION_READINESS_MARKER_PREFIX).toBe("#SESSION_READINESS_JSON:");
    });
  });

  describe("splitManualSessionNotes", () => {
    test("should handle empty string", () => {
      const result = splitManualSessionNotes("");
      expect(result.body).toBe("");
      expect(result.markerBlock).toBe("");
    });

    test("should handle null", () => {
      const result = splitManualSessionNotes(null);
      expect(result.body).toBe("");
      expect(result.markerBlock).toBe("");
    });

    test("should handle undefined", () => {
      const result = splitManualSessionNotes(undefined);
      expect(result.body).toBe("");
      expect(result.markerBlock).toBe("");
    });

    test("should handle body only", () => {
      const notes = "Workout felt good today";
      const result = splitManualSessionNotes(notes);
      expect(result.body).toBe("Workout felt good today");
      expect(result.markerBlock).toBe("");
    });

    test("should handle marker only", () => {
      const notes = "#SESSION_READINESS_JSON:{\"test\": true}";
      const result = splitManualSessionNotes(notes);
      expect(result.body).toBe("");
      expect(result.markerBlock).toBe("#SESSION_READINESS_JSON:{\"test\": true}");
    });

    test("should handle body and marker", () => {
      const notes = "Workout felt good\n#SESSION_READINESS_JSON:{\"test\": true}";
      const result = splitManualSessionNotes(notes);
      expect(result.body).toBe("Workout felt good");
      expect(result.markerBlock).toBe("#SESSION_READINESS_JSON:{\"test\": true}");
    });

    test("should normalize CRLF to LF", () => {
      const notes = "Line 1\r\nLine 2\r\nLine 3";
      const result = splitManualSessionNotes(notes);
      expect(result.body).toBe("Line 1\nLine 2\nLine 3");
      expect(result.markerBlock).toBe("");
    });

    test("should normalize CR to LF", () => {
      const notes = "Line 1\rLine 2\rLine 3";
      const result = splitManualSessionNotes(notes);
      expect(result.body).toBe("Line 1\nLine 2\nLine 3");
      expect(result.markerBlock).toBe("");
    });

    test("should trim whitespace", () => {
      const notes = "  Workout felt good  \n  #SESSION_READINESS_JSON:{\"test\": true}  ";
      const result = splitManualSessionNotes(notes);
      expect(result.body).toBe("Workout felt good");
      expect(result.markerBlock).toBe("#SESSION_READINESS_JSON:{\"test\": true}");
    });

    test("should preserve line order", () => {
      const notes = "Line 1\nLine 2\nLine 3";
      const result = splitManualSessionNotes(notes);
      expect(result.body).toBe("Line 1\nLine 2\nLine 3");
    });

    test("should handle multiple markers", () => {
      const notes =
        "Workout\n#SESSION_READINESS_JSON:{\"test\": true}\n#SESSION_READINESS_JSON:{\"test2\": true}";
      const result = splitManualSessionNotes(notes);
      expect(result.body).toBe("Workout");
      expect(result.markerBlock).toBe(
        "#SESSION_READINESS_JSON:{\"test\": true}\n#SESSION_READINESS_JSON:{\"test2\": true}",
      );
    });

    test("should preserve blank lines in body", () => {
      const notes = "Line 1\n\nLine 3";
      const result = splitManualSessionNotes(notes);
      expect(result.body).toBe("Line 1\n\nLine 3");
    });
  });

  describe("mergeManualSessionNotes", () => {
    test("should filter out manual marker lines", () => {
      const existing = "Existing note\n#SESSION_READINESS_JSON:{\"existing\": true}";
      const manual = "Manual note\n#SESSION_READINESS_JSON:{\"manual\": true}";
      const result = mergeManualSessionNotes(existing, manual);
      expect(result).toBe(
        "Existing note\n\nManual note\n\n#SESSION_READINESS_JSON:{\"existing\": true}",
      );
      expect(result).not.toContain("manual");
    });

    test("should keep existing body", () => {
      const existing = "Existing note";
      const manual = "Manual note";
      const result = mergeManualSessionNotes(existing, manual);
      expect(result).toContain("Existing note");
    });

    test("should append distinct manual body block", () => {
      const existing = "Line 1\nLine 2";
      const manual = "Line 3\nLine 4";
      const result = mergeManualSessionNotes(existing, manual);
      expect(result).toBe("Line 1\nLine 2\n\nLine 3\nLine 4");
    });

    test("should append manual block even when one line overlaps existing body", () => {
      const existing = "Line 1\nLine 2";
      const manual = "Line 2\nLine 3";
      const result = mergeManualSessionNotes(existing, manual);
      expect(result).toBe("Line 1\nLine 2\n\nLine 2\nLine 3");
    });

    test("should drop manual body when block exactly equals existing body", () => {
      const existing = "Line 1\nLine 2";
      const manual = "Line 1\nLine 2\n#SESSION_READINESS_JSON:{\"manual\": true}";
      const result = mergeManualSessionNotes(existing, manual);
      expect(result).toBe("Line 1\nLine 2");
    });

    test("should keep manual body blank lines as part of the block", () => {
      const existing = "Line 1";
      const manual = "\n\nLine 2\n\n";
      const result = mergeManualSessionNotes(existing, manual);
      expect(result).toBe("Line 1\n\nLine 2");
    });

    test("should keep only existing marker block", () => {
      const existing = "Note\n#SESSION_READINESS_JSON:{\"existing\": true}";
      const manual = "Manual\n#SESSION_READINESS_JSON:{\"manual\": true}";
      const result = mergeManualSessionNotes(existing, manual);
      expect(result).toBe(
        "Note\n\nManual\n\n#SESSION_READINESS_JSON:{\"existing\": true}",
      );
      expect(result).not.toContain("manual");
    });

    test("should join body and marker blocks with one blank line", () => {
      const existing = "Body\n#SESSION_READINESS_JSON:{\"test\": true}";
      const manual = "Manual body";
      const result = mergeManualSessionNotes(existing, manual);
      expect(result).toBe(
        "Body\n\nManual body\n\n#SESSION_READINESS_JSON:{\"test\": true}",
      );
    });

    test("should return undefined when both are empty", () => {
      const result = mergeManualSessionNotes("", "");
      expect(result).toBeUndefined();
    });

    test("should return existing when manual is empty", () => {
      const existing = "Existing note";
      const result = mergeManualSessionNotes(existing, "");
      expect(result).toBe("Existing note");
    });

    test("should return manual when existing is empty", () => {
      const manual = "Manual note";
      const result = mergeManualSessionNotes("", manual);
      expect(result).toBe("Manual note");
    });

    test("should handle null existing", () => {
      const manual = "Manual note";
      const result = mergeManualSessionNotes(null, manual);
      expect(result).toBe("Manual note");
    });

    test("should handle null manual", () => {
      const existing = "Existing note";
      const result = mergeManualSessionNotes(existing, null);
      expect(result).toBe("Existing note");
    });

    test("should handle both null", () => {
      const result = mergeManualSessionNotes(null, null);
      expect(result).toBeUndefined();
    });

    test("matches Japanese legacy behavior", () => {
      expect(
        mergeManualSessionNotes(
          "既存メモ\n#SESSION_READINESS_JSON:{\"main_lift\":\"BP\"}",
          "追記メモ",
        ),
      ).toBe(
        "既存メモ\n\n追記メモ\n\n#SESSION_READINESS_JSON:{\"main_lift\":\"BP\"}",
      );
    });
  });

  describe("buildManualSessionCompletionPayload", () => {
    const mockSessionId = "test-session-123";
    const mockManualStartedAt = new Date("2026-07-15T10:00:00Z");
    const mockCompletedAt = new Date("2026-07-15T11:30:00Z");
    const durationSeconds = 5400; // 1.5 hours

    const mockSavedSets: SetData[] = [
      {
        session_id: mockSessionId,
        lift: "Bench Press",
        set_index: 1,
        load_kg: 100,
        reps: 5,
        device_type: "manual",
        set_type: "normal",
        avg_velocity: 0.5,
        velocity_loss: 10,
        velocity_loss_avg: 10,
        velocity_loss_last: 10,
        velocity_loss_min: 10,
        avg_rom_cm: 45,
        rpe: 8,
        e1rm: 115,
        timestamp: "2026-07-15T10:05:00Z",
        rest_duration_s: 120,
      },
      {
        session_id: mockSessionId,
        lift: "Bench Press",
        set_index: 2,
        load_kg: 105,
        reps: 5,
        device_type: "manual",
        set_type: "normal",
        avg_velocity: 0.48,
        velocity_loss: 12,
        velocity_loss_avg: 12,
        velocity_loss_last: 12,
        velocity_loss_min: 12,
        avg_rom_cm: 44,
        rpe: 9,
        e1rm: 120,
        timestamp: "2026-07-15T10:15:00Z",
        rest_duration_s: 180,
      },
    ];

    const mockExistingSession: SessionData = {
      session_id: mockSessionId,
      date: "2026-07-15",
      total_volume: 1025,
      total_sets: 2,
      duration_minutes: 90,
      duration_seconds: 5400,
      start_timestamp: "2026-07-15T10:00:00Z",
      end_timestamp: "2026-07-15T11:30:00Z",
      avg_hr: 145,
      notes: "Existing note\n#SESSION_READINESS_JSON:{\"test\": true}",
      readiness: {
        dieting: true,
        sleep_quality: "good",
        pain_area: null,
        pain_score: null,
        week_day: "monday",
        main_lift: "BP",
        day_role: "primary",
        captured_at: "2026-07-15T10:00:00Z",
      },
      lifts: ["Bench Press"],
    };

    test("should return null for no sets", () => {
      const result = buildManualSessionCompletionPayload({
        sessionId: mockSessionId,
        savedSets: [],
        manualStartedAt: mockManualStartedAt,
        completedAt: mockCompletedAt,
        existingSession: mockExistingSession,
        notes: "Manual note",
      });
      expect(result).toBeNull();
    });

    test("should return null for missing existing session", () => {
      const result = buildManualSessionCompletionPayload({
        sessionId: mockSessionId,
        savedSets: mockSavedSets,
        manualStartedAt: mockManualStartedAt,
        completedAt: mockCompletedAt,
        existingSession: null,
        notes: "Manual note",
      });
      expect(result).toBeNull();
    });

    test("should calculate totals correctly", () => {
      const result = buildManualSessionCompletionPayload({
        sessionId: mockSessionId,
        savedSets: mockSavedSets,
        manualStartedAt: mockManualStartedAt,
        completedAt: mockCompletedAt,
        existingSession: mockExistingSession,
        notes: "Manual note",
      });

      expect(result).not.toBeNull();
      expect(result?.total_volume).toBe(1025); // 100*5 + 105*5
      expect(result?.total_sets).toBe(2);
    });

    test("should calculate duration correctly", () => {
      const result = buildManualSessionCompletionPayload({
        sessionId: mockSessionId,
        savedSets: mockSavedSets,
        manualStartedAt: mockManualStartedAt,
        completedAt: mockCompletedAt,
        existingSession: mockExistingSession,
        notes: "Manual note",
      });

      expect(result).not.toBeNull();
      expect(result?.duration_seconds).toBe(durationSeconds);
      expect(result?.duration_minutes).toBe(durationSeconds / 60);
    });

    test("should set end timestamp to completedAt", () => {
      const result = buildManualSessionCompletionPayload({
        sessionId: mockSessionId,
        savedSets: mockSavedSets,
        manualStartedAt: mockManualStartedAt,
        completedAt: mockCompletedAt,
        existingSession: mockExistingSession,
        notes: "Manual note",
      });

      expect(result).not.toBeNull();
      expect(result?.end_timestamp).toBe(mockCompletedAt.toISOString());
    });

    test("should override session_id", () => {
      const result = buildManualSessionCompletionPayload({
        sessionId: "new-session-id",
        savedSets: mockSavedSets,
        manualStartedAt: mockManualStartedAt,
        completedAt: mockCompletedAt,
        existingSession: mockExistingSession,
        notes: "Manual note",
      });

      expect(result).not.toBeNull();
      expect(result?.session_id).toBe("new-session-id");
    });

    test("should merge notes", () => {
      const result = buildManualSessionCompletionPayload({
        sessionId: mockSessionId,
        savedSets: mockSavedSets,
        manualStartedAt: mockManualStartedAt,
        completedAt: mockCompletedAt,
        existingSession: mockExistingSession,
        notes: "Manual note",
      });

      expect(result).not.toBeNull();
      expect(result?.notes).toBe(
        "Existing note\n\nManual note\n\n#SESSION_READINESS_JSON:{\"test\": true}",
      );
    });

    test("should preserve date exactly", () => {
      const result = buildManualSessionCompletionPayload({
        sessionId: mockSessionId,
        savedSets: mockSavedSets,
        manualStartedAt: mockManualStartedAt,
        completedAt: mockCompletedAt,
        existingSession: mockExistingSession,
        notes: "Manual note",
      });

      expect(result).not.toBeNull();
      expect(result?.date).toBe(mockExistingSession.date);
    });

    test("should preserve start_timestamp exactly", () => {
      const result = buildManualSessionCompletionPayload({
        sessionId: mockSessionId,
        savedSets: mockSavedSets,
        manualStartedAt: mockManualStartedAt,
        completedAt: mockCompletedAt,
        existingSession: mockExistingSession,
        notes: "Manual note",
      });

      expect(result).not.toBeNull();
      expect(result?.start_timestamp).toBe(mockExistingSession.start_timestamp);
    });

    test("should preserve readiness exactly", () => {
      const result = buildManualSessionCompletionPayload({
        sessionId: mockSessionId,
        savedSets: mockSavedSets,
        manualStartedAt: mockManualStartedAt,
        completedAt: mockCompletedAt,
        existingSession: mockExistingSession,
        notes: "Manual note",
      });

      expect(result).not.toBeNull();
      expect(result?.readiness).toEqual(mockExistingSession.readiness);
    });

    test("should preserve avg_hr exactly", () => {
      const result = buildManualSessionCompletionPayload({
        sessionId: mockSessionId,
        savedSets: mockSavedSets,
        manualStartedAt: mockManualStartedAt,
        completedAt: mockCompletedAt,
        existingSession: mockExistingSession,
        notes: "Manual note",
      });

      expect(result).not.toBeNull();
      expect(result?.avg_hr).toBe(mockExistingSession.avg_hr);
    });

    test("should preserve lifts exactly", () => {
      const result = buildManualSessionCompletionPayload({
        sessionId: mockSessionId,
        savedSets: mockSavedSets,
        manualStartedAt: mockManualStartedAt,
        completedAt: mockCompletedAt,
        existingSession: mockExistingSession,
        notes: "Manual note",
      });

      expect(result).not.toBeNull();
      expect(result?.lifts).toEqual(mockExistingSession.lifts);
    });

    test("should handle no readiness", () => {
      const noReadinessSession: SessionData = {
        ...mockExistingSession,
        readiness: null,
      };

      const result = buildManualSessionCompletionPayload({
        sessionId: mockSessionId,
        savedSets: mockSavedSets,
        manualStartedAt: mockManualStartedAt,
        completedAt: mockCompletedAt,
        existingSession: noReadinessSession,
        notes: "Manual note",
      });

      expect(result).not.toBeNull();
      expect(result?.readiness).toBeNull();
    });

    test("should handle single set with velocity_loss null", () => {
      const singleSet: SetData = {
        ...mockSavedSets[0],
        velocity_loss: null,
      };

      const result = buildManualSessionCompletionPayload({
        sessionId: mockSessionId,
        savedSets: [singleSet],
        manualStartedAt: mockManualStartedAt,
        completedAt: mockCompletedAt,
        existingSession: mockExistingSession,
        notes: "Manual note",
      });

      expect(result).not.toBeNull();
      expect(result?.total_sets).toBe(1);
      expect(result?.total_volume).toBe(500); // 100*5
    });

    test("should handle nonnegative duration", () => {
      // Test with completedAt before manualStartedAt
      const earlyCompletedAt = new Date("2026-07-15T09:00:00Z");

      const result = buildManualSessionCompletionPayload({
        sessionId: mockSessionId,
        savedSets: mockSavedSets,
        manualStartedAt: mockManualStartedAt,
        completedAt: earlyCompletedAt,
        existingSession: mockExistingSession,
        notes: "Manual note",
      });

      expect(result).not.toBeNull();
      expect(result?.duration_seconds).toBe(0); // Should be 0, not negative
      expect(result?.duration_minutes).toBe(0);
    });

    test("should round duration seconds", () => {
      const oddDuration = new Date("2026-07-15T11:30:30.5Z"); // 1.5 hours + 30.5 seconds

      const result = buildManualSessionCompletionPayload({
        sessionId: mockSessionId,
        savedSets: mockSavedSets,
        manualStartedAt: mockManualStartedAt,
        completedAt: oddDuration,
        existingSession: mockExistingSession,
        notes: "Manual note",
      });

      expect(result).not.toBeNull();
      expect(result?.duration_seconds).toBe(5431);
      expect(result?.duration_minutes).toBe(5431 / 60);
    });

    test("should spread existing session to preserve unrelated metadata", () => {
      const sessionWithExtra: SessionData = {
        ...mockExistingSession,
        // Add any extra fields that might exist
        avg_hr: 150,
      };

      const result = buildManualSessionCompletionPayload({
        sessionId: mockSessionId,
        savedSets: mockSavedSets,
        manualStartedAt: mockManualStartedAt,
        completedAt: mockCompletedAt,
        existingSession: sessionWithExtra,
        notes: "Manual note",
      });

      expect(result).not.toBeNull();
      expect(result?.avg_hr).toBe(150);
    });

    test("matches Japanese legacy requirements", () => {
      const existingSession: SessionData = {
        session_id: "2026-07-14_070000",
        date: "2026-07-14",
        total_volume: 0,
        total_sets: 0,
        lifts: ["Bench Press"],
        start_timestamp: "2026-07-14T07:00:00.000Z",
        avg_hr: 118,
        notes: "既存メモ\n#SESSION_READINESS_JSON:{\"week_day\":\"Week 7-Day 1\"}",
        readiness: {
          dieting: false,
          sleep_quality: "good",
          pain_area: null,
          pain_score: null,
          week_day: "Week 7-Day 1",
          main_lift: "BP",
          day_role: "heavy",
        },
      };

      const savedSets: SetData[] = [
        {
          session_id: existingSession.session_id,
          lift: "Bench Press",
          set_index: 1,
          load_kg: 80,
          reps: 5,
          device_type: "manual",
          set_type: "normal",
          avg_velocity: null,
          velocity_loss: null,
          timestamp: "2026-07-14T07:10:00.000Z",
        },
        {
          session_id: existingSession.session_id,
          lift: "Bench Press",
          set_index: 2,
          load_kg: 82.5,
          reps: 3,
          device_type: "manual",
          set_type: "normal",
          avg_velocity: null,
          velocity_loss: null,
          timestamp: "2026-07-14T07:15:00.000Z",
        },
      ];

      const payload = buildManualSessionCompletionPayload({
        sessionId: existingSession.session_id,
        savedSets,
        manualStartedAt: new Date("2026-07-14T07:00:00.000Z"),
        completedAt: new Date("2026-07-14T07:20:30.000Z"),
        existingSession,
        notes: "追記メモ",
      });

      expect(payload).toMatchObject({
        date: existingSession.date,
        total_volume: 647.5,
        total_sets: 2,
        duration_seconds: 1230,
        duration_minutes: 20.5,
        start_timestamp: existingSession.start_timestamp,
        end_timestamp: "2026-07-14T07:20:30.000Z",
        avg_hr: 118,
        lifts: ["Bench Press"],
        readiness: existingSession.readiness,
      });
      expect(payload?.notes).toBe(
        "既存メモ\n\n追記メモ\n\n#SESSION_READINESS_JSON:{\"week_day\":\"Week 7-Day 1\"}",
      );
    });
  });
});
