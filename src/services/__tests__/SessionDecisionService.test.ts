import { describe, expect, it } from "vitest";
import SessionDecisionService from "../SessionDecisionService";
import type { SetData } from "../../types/index";

const makeSet = (overrides: Partial<SetData>): SetData => ({
  session_id: "session_test",
  lift: "Low Bar Squat",
  set_index: 1,
  load_kg: 120,
  reps: 5,
  device_type: "OVR Velocity",
  set_type: "normal",
  avg_velocity: 0.45,
  velocity_loss: 7,
  avg_rom_cm: 63.5,
  e1rm: 140,
  timestamp: "2026-05-25T00:00:00.000Z",
  is_warmup: false,
  ...overrides,
});

describe("SessionDecisionService", () => {
  it("separates working-set AV and detects same-load AV/ROM drop", () => {
    const decision = SessionDecisionService.analyze({
      currentLoad: 110,
      currentHeartRate: 164,
      purpose: "form_consistency",
      targetVelocityRange: [0.42, 0.48],
      sets: [
        makeSet({
          set_index: 1,
          load_kg: 70,
          avg_velocity: 0.77,
          avg_rom_cm: 64,
          is_warmup: true,
        }),
        makeSet({
          set_index: 2,
          load_kg: 120,
          avg_velocity: 0.45,
          avg_rom_cm: 63.5,
        }),
        makeSet({
          set_index: 3,
          load_kg: 120,
          avg_velocity: 0.46,
          avg_rom_cm: 62.0,
        }),
        makeSet({
          set_index: 4,
          load_kg: 120,
          avg_velocity: 0.42,
          avg_rom_cm: 62.8,
        }),
        makeSet({
          set_index: 5,
          load_kg: 110,
          avg_velocity: 0.49,
          avg_rom_cm: 61.2,
        }),
      ],
    });

    expect(decision.workingSets).toHaveLength(4);
    expect(decision.allSetAvgAV).toBeGreaterThan(decision.workingSetAvgAV ?? 0);
    expect(decision.trendFlags.sameLoadAVDrop).toBe(true);
    expect(decision.trendFlags.romDrop).toBe(true);
    expect(decision.trendFlags.hrHigh).toBe(true);
    expect(decision.formStatus).toBe("rom_drop_detected");
    expect(decision.recommendedNextLoad).toBe(102.5);
    expect(decision.waitUntilHRBelow).toBe(135);
  });

  it("ignores zero HR recovery values in averages", () => {
    const decision = SessionDecisionService.analyze({
      currentLoad: 120,
      currentHeartRate: 132,
      purpose: "menu_completion",
      sets: [
        makeSet({ set_index: 1, hr_recovery_to_120_s: 0 }),
        makeSet({ set_index: 2, hr_recovery_to_120_s: 200 }),
        makeSet({ set_index: 3, hr_recovery_to_120_s: 120 }),
      ],
    });

    expect(decision.avgHrTo120Working).toBe(160);
    expect(decision.hrDataReliability).toBe("good");
  });

  it("uses VL_last for fatigue decisions while preserving legacy VL_avg", () => {
    const decision = SessionDecisionService.analyze({
      currentLoad: 122.5,
      currentHeartRate: 128,
      purpose: "form_consistency",
      sets: [
        makeSet({
          set_index: 1,
          velocity_loss: 12.5,
          velocity_loss_avg: 12.5,
          velocity_loss_last: 28.6,
          velocity_loss_min: 28.6,
        }),
      ],
    });

    expect(decision.trendFlags.vlHigh).toBe(true);
    expect(decision.workingSets[0]).toMatchObject({
      vl: 12.5,
      vlAvg: 12.5,
      vlLast: 28.6,
      vlMin: 28.6,
      vlJudgementMetric: "vlLast",
    });
    expect(decision.reasonBullets.join(" ")).toContain("VL_last");
  });

  it("keeps high VL as an observation rather than an automatic fatigue stop during profile collection", () => {
    const decision = SessionDecisionService.analyze({
      currentLoad: 80,
      currentHeartRate: 120,
      purpose: "lvp_building",
      configuredVelocityLossThresholdPct: 15,
      individualProfileMode: "collect",
      sets: [
        makeSet({
          lift: "Bench Press",
          load_kg: 80,
          reps: 6,
          avg_velocity: 0.38,
          velocity_loss_last: 28,
          velocity_loss_min: 33,
        }),
      ],
    });

    expect(decision.trendFlags.vlHigh).toBe(true);
    expect(decision.trendFlags.vlMinHigh).toBe(true);
    expect(decision.fatigueStatus).toBe("good");
    expect(decision.sessionTerminationLevel).toBe("planned_accessory_only");
    expect(decision.nextSetQualityGoal).toMatchObject({
      targetVlLastPct: null,
      hardCapVlLastPct: null,
    });
    expect(decision.nextSetQualityGoal?.summary).toContain("一般VLカットなし");
    expect(decision.stopCriteria.join(" ")).toContain("単独のVL高値");
  });

  it("exposes a configured next-set quality goal after a completed set", () => {
    const decision = SessionDecisionService.analyze({
      currentLoad: 120,
      currentHeartRate: 125,
      purpose: "form_consistency",
      configuredVelocityLossThresholdPct: 15,
      sets: [
        makeSet({
          load_kg: 120,
          reps: 5,
          avg_rom_cm: 63.5,
          velocity_loss_last: 14.3,
        }),
      ],
    });

    expect(decision.nextSetQualityGoal).toMatchObject({
      targetVlLastPct: 10,
      hardCapVlLastPct: 15,
      minimumRomCm: 63,
      previousVlLastPct: 14.3,
    });
    expect(decision.nextSetQualityGoal?.summary).toContain(
      "前回14.3% → 次回10%前後",
    );
  });

  it("keeps the quality goal for stale plans and does not apply top-single AV ranges to accessories", () => {
    const decision = SessionDecisionService.analyze({
      currentLoad: 30,
      currentHeartRate: 120,
      purpose: "hypertrophy_volume",
      targetVelocityRange: [0.2, 0.3],
      configuredVelocityLossThresholdPct: null,
      supervisorPlanGuard: { planExecutable: false },
      sets: [
        makeSet({
          lift: "Cable Row",
          load_kg: 30,
          reps: 12,
          set_type: "normal",
          velocity_loss_last: 8,
        }),
      ],
    });

    expect(decision.candidateSource).toBe("stale_supervisor_plan_blocked");
    expect(decision.nextSetQualityGoal).toMatchObject({
      hardCapVlLastPct: 15,
      previousVlLastPct: 8,
    });
    expect(decision.passCriteria.join(" ")).not.toContain("AV 0.20〜0.30");
  });

  it("flags VL10 stop guidance for speed bench work", () => {
    const decision = SessionDecisionService.analyze({
      currentLoad: 60,
      currentHeartRate: 125,
      purpose: "lvp_building",
      sets: [
        makeSet({
          lift: "Bench Press",
          set_index: 9,
          load_kg: 60,
          reps: 3,
          avg_velocity: 0.48,
          velocity_loss: 5,
          velocity_loss_avg: 5,
          velocity_loss_last: 12,
          velocity_loss_min: 12,
        }),
      ],
    });

    expect(decision.trendFlags.speedWorkVl10Stop).toBe(true);
    expect(decision.reasonBullets.join(" ")).toContain("スピード練習");
    expect(decision.stopCriteria.join(" ")).toContain("VL_last 10%超");
  });

  it("prioritizes the Week7-Day1 planned row despite high HR and suspect ROM", () => {
    const decision = SessionDecisionService.analyze({
      currentLoad: 117.5,
      currentHeartRate: 163,
      purpose: "menu_completion",
      mainLift: "SQ",
      plannedNextSet: {
        loadKg: 117.5,
        reps: 4,
        remainingSets: 2,
        rpe: 8,
        rowId: "week7-day1-sq-main-117.5x4",
        source: "applied_supervisor_row",
      },
      sets: [
        makeSet({
          set_index: 1,
          lift: "Low Bar Squat",
          load_kg: 125,
          reps: 3,
          avg_velocity: 0.43,
          velocity_loss_avg: 2.3,
          velocity_loss_last: 2.3,
          velocity_loss_min: 2.3,
          avg_rom_cm: 62,
        }),
        makeSet({
          set_index: 2,
          lift: "Low Bar Squat",
          load_kg: 117.5,
          reps: 4,
          avg_velocity: 0.47,
          velocity_loss_avg: 4.2,
          velocity_loss_last: 4.2,
          velocity_loss_min: 4.2,
          avg_rom_cm: 52,
          hr_recovery_to_120_s: null,
        }),
      ],
    });

    expect(decision.candidateSource).toBe("applied_supervisor_row");
    expect(decision.plannedRowId).toBe("week7-day1-sq-main-117.5x4");
    expect(decision.roundingIncrementKg).toBe(2.5);
    expect(decision.recommendedNextLoad).toBe(117.5);
    expect(decision.recommendedNextReps).toBe(4);
    expect(decision.recommendedRestMin).toBe(5);
    expect(decision.waitUntilHRBelow).toBe(135);
    expect(decision.romMeasurementSuspect).toBe(true);
    expect(decision.romExcludedDecisionText).toContain("ROM急変15%以上");
    expect(decision.reasonBullets.join(" ")).toContain("予定行優先");
    expect(decision.heavyExposureSingle).toMatchObject({
      lift: "SQ",
      loadKg: 130,
    });
  });

  it("rounds BIG3 algorithmic candidates to 2.5kg instead of odd micro loads", () => {
    const decision = SessionDecisionService.analyze({
      currentLoad: 122.5,
      currentHeartRate: 120,
      purpose: "form_consistency",
      mainLift: "SQ",
      sets: [
        makeSet({
          set_index: 1,
          load_kg: 122.5,
          avg_velocity: 0.5,
          velocity_loss_last: 5,
        }),
        makeSet({
          set_index: 2,
          load_kg: 122.5,
          avg_velocity: 0.44,
          velocity_loss_last: 16,
        }),
      ],
    });

    expect(decision.candidateSource).toBe("fallback_algorithmic_candidate");
    expect(decision.roundingIncrementKg).toBe(2.5);
    expect(decision.recommendedNextLoad).toBe(117.5);
    expect([116.5, 109.5, 83.5, 56]).not.toContain(
      decision.recommendedNextLoad,
    );
  });

  it("marks heavy exposure as blocked when the latest supervisor plan conflicts", () => {
    const decision = SessionDecisionService.analyze({
      currentLoad: 75,
      currentHeartRate: 128,
      purpose: "menu_completion",
      mainLift: "BP",
      supervisorPlanGuard: {
        painState: {
          status: "active",
          pain_score: 4,
          pain_area: "腰局所",
          source: "symptom",
          captured_at: "2026-07-23T07:00:00+09:00",
          blocked_heavy_exposure: true,
        },
        blockedHeavyExposureLoadsKg: {
          BP: [95],
        },
        planVersion: "2026-07-23-week8-day2",
      },
      sets: [
        makeSet({
          lift: "Bench Press",
          set_index: 1,
          load_kg: 75,
          reps: 5,
          avg_velocity: 0.35,
        }),
      ],
    });

    expect(decision.heavyExposureSingle).toMatchObject({
      lift: "BP",
      loadKg: 95,
      status: "blocked_by_supervisor_plan",
      blocked_by_supervisor_plan: true,
    });
    expect(decision.heavyExposureSingle?.block_reason).toContain("腰局所");
  });

  it("keeps heavy exposure available when pain is resolved and the latest plan does not block the load", () => {
    const decision = SessionDecisionService.analyze({
      currentLoad: 75,
      currentHeartRate: 118,
      purpose: "menu_completion",
      mainLift: "BP",
      supervisorPlanGuard: {
        painState: {
          status: "resolved",
          pain_score: null,
          pain_area: null,
          source: "current_user_reassessment",
          captured_at: "2026-07-23T09:00:00+09:00",
          blocked_heavy_exposure: false,
        },
        blockedHeavyExposureLoadsKg: {},
        planVersion: "2026-07-23-week8-day2",
      },
      sets: [
        makeSet({
          lift: "Bench Press",
          set_index: 1,
          load_kg: 75,
          reps: 5,
          avg_velocity: 0.35,
        }),
      ],
    });

    expect(decision.heavyExposureSingle).toMatchObject({
      lift: "BP",
      loadKg: 95,
      status: "available",
      blocked_by_supervisor_plan: false,
    });
    expect(decision.heavyExposureSingle?.block_reason).toBeNull();
  });

  it("blocks stale supervisor plan rows from executable next-set decisions while preserving logging analysis", () => {
    const decision = SessionDecisionService.analyze({
      currentLoad: 80,
      currentHeartRate: 122,
      purpose: "menu_completion",
      mainLift: "BP",
      plannedNextSet: {
        loadKg: 95,
        reps: 1,
        remainingSets: 1,
        rpe: 8,
        rowId: "w8d2-heavy-bp-95",
        source: "applied_supervisor_row",
      },
      supervisorPlanGuard: {
        painState: {
          status: "resolved",
          pain_score: null,
          pain_area: null,
          source: "current_user_reassessment",
          captured_at: "2026-07-24T09:00:00+09:00",
          blocked_heavy_exposure: false,
        },
        blockedHeavyExposureLoadsKg: {},
        planVersion: "2026-07-23-week8-day2",
        planExecutable: false,
        staleReason: "監督メニューの有効期限を過ぎています",
      },
      sets: [
        makeSet({
          lift: "Bench Press",
          set_index: 1,
          load_kg: 80,
          reps: 5,
          avg_velocity: 0.34,
        }),
      ],
    });

    expect(decision.workingSets).toHaveLength(1);
    expect(decision.candidateSource).toBe("stale_supervisor_plan_blocked");
    expect(decision.plannedRowId).toBeNull();
    expect(decision.recommendedNextLoad).toBe(80);
    expect(decision.recommendedNextReps).toBe(5);
    expect(decision.reasonBullets.join(" ")).toContain("監督メニューstale");
    expect(decision.heavyExposureSingle).toMatchObject({
      lift: "BP",
      loadKg: 95,
      status: "blocked_by_supervisor_plan",
      blocked_by_supervisor_plan: true,
    });
    expect(decision.heavyExposureSingle?.block_reason).toContain("有効期限");
  });

  it("does not create fallback loads after all planned rows are completed", () => {
    const decision = SessionDecisionService.analyze({
      currentLoad: 75,
      currentHeartRate: 118,
      purpose: "menu_completion",
      mainLift: "BP",
      plannedNextSet: null,
      plannedSessionContext: {
        plannedRowsTotal: 1,
        plannedRowsCompleted: 1,
        plannedRowsRemaining: 0,
        currentRowRemainingSets: 0,
        totalSessionSets: 2,
        accessorySetsAfterMain: 0,
        latestPainScore: 0,
        latestRpe: 7,
        latestVlLast: 8,
        remainingMinutes: 20,
      },
      sets: [
        makeSet({
          lift: "Bench Press",
          set_index: 1,
          load_kg: 75,
          reps: 4,
          avg_velocity: 0.34,
          velocity_loss_last: 8,
        }),
        makeSet({
          lift: "Bench Press",
          set_index: 2,
          load_kg: 75,
          reps: 4,
          avg_velocity: 0.35,
          velocity_loss_last: 7,
        }),
      ],
    });

    expect(decision.candidateSource).toBe("planned_rows_complete_no_candidate");
    expect(decision.recommendedNextLoad).toBeNull();
    expect(decision.recommendedNextReps).toBeNull();
    expect(decision.sessionTerminationLevel).toBe("main_done_light_accessory_ok");
    expect(decision.exerciseTerminationLevel).toBe("main_lift_complete");
    expect(decision.allowLightFullBodyAccessory).toBe(true);
    expect(decision.shouldSuggestAdditionalLoad).toBe(false);
  });

  it("returns full session stop when planned rows are done but pain or fatigue is present", () => {
    const decision = SessionDecisionService.analyze({
      currentLoad: 75,
      currentHeartRate: 132,
      purpose: "menu_completion",
      mainLift: "BP",
      plannedNextSet: null,
      plannedSessionContext: {
        plannedRowsTotal: 1,
        plannedRowsCompleted: 1,
        plannedRowsRemaining: 0,
        currentRowRemainingSets: 0,
        totalSessionSets: 3,
        accessorySetsAfterMain: 1,
        latestPainScore: 2,
        latestRpe: 8,
        latestVlLast: 12,
      },
      sets: [
        makeSet({
          lift: "Bench Press",
          set_index: 1,
          load_kg: 75,
          reps: 4,
          avg_velocity: 0.34,
        }),
      ],
    });

    expect(decision.sessionTerminationLevel).toBe("session_complete");
    expect(decision.exerciseTerminationLevel).toBe("session_complete");
    expect(decision.recommendedNextLoad).toBeNull();
    expect(decision.allowLightFullBodyAccessory).toBe(false);
  });

  it("does not invent a current-exercise candidate when that planned row is complete and other rows remain", () => {
    const decision = SessionDecisionService.analyze({
      currentLoad: 75,
      currentHeartRate: 120,
      purpose: "menu_completion",
      mainLift: "BP",
      plannedNextSet: null,
      plannedSessionContext: {
        plannedRowsTotal: 3,
        plannedRowsCompleted: 1,
        plannedRowsRemaining: 2,
        currentRowRemainingSets: 0,
        totalSessionSets: 2,
        accessorySetsAfterMain: 0,
        latestPainScore: 0,
      },
      sets: [
        makeSet({
          lift: "Bench Press",
          set_index: 1,
          load_kg: 75,
          reps: 4,
          avg_velocity: 0.34,
        }),
      ],
    });

    expect(decision.candidateSource).toBe(
      "planned_rows_remaining_no_current_candidate",
    );
    expect(decision.recommendedNextLoad).toBeNull();
    expect(decision.sessionTerminationLevel).toBe("planned_accessory_only");
    expect(decision.exerciseTerminationLevel).toBe("current_exercise_complete");
  });
});
