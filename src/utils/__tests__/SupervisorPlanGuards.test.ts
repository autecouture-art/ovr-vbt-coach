import { describe, expect, it } from "vitest";
import type { SessionData, SetData } from "../../types/index";
import {
  applyHeavyExposureSupervisorBlock,
  buildStickyPainState,
  buildSupervisorPlanMetadataFromProgramPlan,
  buildTrainingDayAggregates,
  evaluateSupervisorPlanGuard,
  getJstTrainingDayId,
  normalizeRpe,
  extractAiConsultationsFromSessions,
  resolvePlannedExerciseRole,
  resolveVelocityProfileStatus,
} from "../SupervisorPlanGuards";

const makeSession = (
  id: string,
  timestamp: string,
  notes?: string,
  readiness?: SessionData["readiness"],
): SessionData => ({
  session_id: id,
  date: timestamp.slice(0, 10),
  total_volume: 0,
  total_sets: 0,
  start_timestamp: timestamp,
  notes,
  readiness,
});

const makeSet = (
  sessionId: string,
  index: number,
  lift: string,
  load: number,
  reps: number,
): SetData => ({
  session_id: sessionId,
  lift,
  set_index: index,
  load_kg: load,
  reps,
  device_type: sessionId.startsWith("vbt_") ? "OVR Velocity" : "manual",
  set_type: "normal",
  avg_velocity: null,
  velocity_loss: null,
  timestamp: `2026-07-22T22:${String(index).padStart(2, "0")}:00.000Z`,
});

describe("SupervisorPlanGuards", () => {
  it("guards applied supervisor plan metadata without hardcoded latest version", () => {
    const metadata = buildSupervisorPlanMetadataFromProgramPlan(
      {
        plan_id: "plan-a",
        version: "2026-07-23-v8",
        updated_at: "2026-07-23T07:00:00+09:00",
        checksum: "fnv1a32:12345678",
        source: "unit-test",
      },
      "row-1",
    );
    expect(metadata).toMatchObject({
      supervisor_plan_version: "2026-07-23-v8",
      supervisor_plan_checksum: "fnv1a32:12345678",
      planned_row_id: "row-1",
    });
    expect(
      evaluateSupervisorPlanGuard(metadata).status,
    ).toBe("applied");
    expect(evaluateSupervisorPlanGuard(null).status).toBe("stale_or_missing");
  });

  it("uses Asia/Tokyo training day and aggregates split Week8-Day2 sessions to 27set / 6574kg", () => {
    const bpReadiness = {
      dieting: null,
      sleep_quality: null,
      pain_area: null,
      pain_score: null,
      week_day: "Week8-Day2",
      main_lift: "BP" as const,
      day_role: "bp_main_day",
    };
    const sessions = [
      makeSession("vbt_1", "2026-07-22T22:00:00.000Z", undefined, bpReadiness),
      makeSession("manual_2", "2026-07-23T03:00:00.000Z", undefined, bpReadiness),
    ];
    const sets: SetData[] = [
      makeSet("vbt_1", 1, "Bench Press", 20, 5),
      makeSet("vbt_1", 2, "Bench Press", 60, 3),
      makeSet("vbt_1", 3, "Bench Press", 80, 3),
      makeSet("vbt_1", 4, "Bench Press", 90, 1),
      makeSet("vbt_1", 5, "Bench Press", 75, 5),
      makeSet("vbt_1", 6, "Bench Press", 75, 5),
      makeSet("vbt_1", 7, "Bench Press", 75, 5),
      makeSet("vbt_1", 8, "Bench Press", 60, 3),
      makeSet("vbt_1", 9, "Feet-Up Close-Grip Bench Press", 60, 6),
      makeSet("vbt_1", 10, "Feet-Up Close-Grip Bench Press", 60, 6),
      ...[1, 2, 3, 4].map((set) =>
        makeSet("manual_2", 10 + set, "Reverse Lat Pull Down", 60, 10),
      ),
      ...[1, 2, 3, 4, 5].map((set) =>
        makeSet("manual_2", 14 + set, "Upright Row", 40, 5),
      ),
      ...[1, 2, 3, 4].map((set) =>
        makeSet("manual_2", 19 + set, "Face Pull", 20, 3),
      ),
      makeSet("manual_2", 24, "French Press", 30, 2),
      makeSet("manual_2", 25, "French Press", 30, 2),
      makeSet("manual_2", 26, "French Press", 30, 2),
      makeSet("manual_2", 27, "French Press", 59.5, 2),
    ];

    expect(getJstTrainingDayId("2026-07-22T22:00:00.000Z")).toBe(
      "2026-07-23",
    );

    const [day] = buildTrainingDayAggregates(sessions, sets, {
      accessorySetLimit: 3,
      blockedCandidateNames: ["Upright Row", "Face Pull", "French Press"],
    });

    expect(day).toMatchObject({
      training_day_id: "2026-07-23",
      main_lifts: ["BP"],
      total_sets: 27,
      total_volume_kg: 6574,
      session_stop_recommended: true,
    });
    expect(day.accessory_sets).toBe(19);
    expect(day.accessory_sets_remaining).toBe(0);
    expect(day.session_sources).toEqual(["vbt", "manual"]);
    expect(day.manual_session_ids).toEqual(["manual_2"]);
    expect(day.manual_set_count).toBe(17);
    expect(day.blocked_next_exercise_candidates).toEqual([
      "Upright Row",
      "Face Pull",
      "French Press",
    ]);
  });

  it("keeps last non-zero pain until explicit resolved and blocks BP95 heavy exposure", () => {
    const stickyPain = buildStickyPainState([
      {
        captured_at: "2026-07-23T07:00:00+09:00",
        pain_area: "腰局所",
        pain_score: 4,
        source: "symptom",
      },
      {
        captured_at: "2026-07-23T08:00:00+09:00",
        pain_area: null,
        pain_score: 0,
        source: "stale_readiness",
      },
      {
        captured_at: "2026-07-23T08:10:00+09:00",
        pain_area: null,
        pain_score: null,
        source: "stale_readiness",
      },
    ]);

    expect(stickyPain).toMatchObject({
      status: "active",
      pain_area: "腰局所",
      pain_score: 4,
      blocked_heavy_exposure: true,
    });

    const blocked = applyHeavyExposureSupervisorBlock({
      heavyExposureSingle: {
        lift: "BP",
        loadKg: 95,
        purpose: "重さ慣れ",
        rpeTarget: "RPE8",
        rule: "no miss",
      },
      painState: stickyPain,
      blockedLoadsKg: { BP: [95] },
    });

    expect(blocked).toMatchObject({
      status: "blocked_by_supervisor_plan",
      blocked_by_supervisor_plan: true,
    });

    expect(
      buildStickyPainState([
        {
          captured_at: "2026-07-23T07:00:00+09:00",
          pain_area: "腰局所",
          pain_score: 4,
        },
        {
          captured_at: "2026-07-23T09:00:00+09:00",
          resolved: true,
          pain_status: "resolved",
        },
      ]).status,
    ).toBe("resolved");

    expect(
      buildStickyPainState([
        {
          captured_at: "2026-07-23T07:00:00+09:00",
          pain_area: "腰局所",
          pain_score: 4,
        },
        {
          captured_at: "2026-07-23T09:00:00+09:00",
          pain_score: 0,
          zero_is_resolved: true,
          source: "current_user_reassessment",
        },
      ]).status,
    ).toBe("resolved");
  });

  it("does not count competition BIG3 sets as accessories when multiple main lifts exist in a JST training day", () => {
    const sessions = [
      makeSession("bp", "2026-07-23T00:00:00.000Z", undefined, {
        dieting: null,
        sleep_quality: null,
        pain_area: null,
        pain_score: null,
        week_day: "Week8-Day2",
        main_lift: "BP",
        day_role: "bp_main_day",
      }),
      makeSession("sq", "2026-07-23T01:00:00.000Z", undefined, {
        dieting: null,
        sleep_quality: null,
        pain_area: null,
        pain_score: null,
        week_day: "Week8-Day2-extra",
        main_lift: "SQ",
        day_role: "sq_main_day",
      }),
    ];
    const sets = [
      makeSet("bp", 1, "Bench Press", 75, 5),
      makeSet("sq", 2, "Low Bar Squat", 100, 3),
      makeSet("bp", 3, "Feet-Up Close-Grip Bench Press", 60, 6),
      makeSet("sq", 4, "Reverse Pec Deck", 30, 12),
    ];

    const [day] = buildTrainingDayAggregates(sessions, sets, {
      accessorySetLimit: 3,
    });

    expect(day.main_lifts).toEqual(["BP", "SQ"]);
    expect(day.total_sets).toBe(4);
    expect(day.accessory_sets).toBe(2);
  });

  it("does not promote Feet-Up CGBP to required main by alias only and treats history0 as baseline", () => {
    const role = resolvePlannedExerciseRole({
      exerciseId: "feet_up_cgbp",
      exerciseName: "Feet-Up Close-Grip Bench Press",
      mainLift: "BP",
      dayRole: "bp_main_day",
      plannedRowId: null,
    });

    expect(role).toMatchObject({
      requiredOptional: "optional_accessory",
      roleResolutionSource: "planned_row_missing_alias_ignored",
    });

    expect(
      resolveVelocityProfileStatus({
        exerciseId: "feet_up_cgbp",
        historyCount: 0,
      }),
    ).toMatchObject({
      status: "baseline",
      pr_status: "baseline",
      uses_exercise_specific_profile: true,
    });
  });

  it("keeps null RPE as unknown instead of inferring from velocity", () => {
    expect(normalizeRpe(null)).toEqual({ value: null, status: "unknown" });
    expect(normalizeRpe(undefined)).toEqual({ value: null, status: "unknown" });
    expect(normalizeRpe(8)).toEqual({ value: 8, status: "known" });
  });

  it("exports Chappy consultation markers with stable ids and pending adoption state", () => {
    const session = makeSession(
      "session_chappy",
      "2026-07-29T07:00:00+09:00",
      [
        "user note",
        `#AI_CONSULTATION_JSON:${JSON.stringify({
          id: "chappy_20260729_abc123",
          created_at: "2026-07-29T07:10:00+09:00",
          packet_type: "full_context",
          prompt_snapshot: "packet body",
          adopted_decision: "pending_user_review",
        })}`,
      ].join("\n"),
    );

    expect(extractAiConsultationsFromSessions([session])).toEqual([
      {
        id: "chappy_20260729_abc123",
        session_id: "session_chappy",
        created_at: "2026-07-29T07:10:00+09:00",
        packet_type: "full_context",
        source: "session_notes_marker",
        prompt_snapshot: "packet body",
        response: null,
        adopted_decision: "pending_user_review",
      },
    ]);
  });

  it("deduplicates consultation markers by session and consultation id", () => {
    const marker = `#AI_CONSULTATION_JSON:${JSON.stringify({
      id: "chappy_once",
      created_at: "2026-08-05T00:00:00.000Z",
      packet_type: "full_context",
    })}`;
    const session = makeSession("session_once", "2026-08-05T00:00:00.000Z", `${marker}\n${marker}`);
    expect(extractAiConsultationsFromSessions([session])).toHaveLength(1);
  });
});
