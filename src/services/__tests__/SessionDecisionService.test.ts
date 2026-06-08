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
        makeSet({ set_index: 2, load_kg: 120, avg_velocity: 0.45, avg_rom_cm: 63.5 }),
        makeSet({ set_index: 3, load_kg: 120, avg_velocity: 0.46, avg_rom_cm: 62.0 }),
        makeSet({ set_index: 4, load_kg: 120, avg_velocity: 0.42, avg_rom_cm: 62.8 }),
        makeSet({ set_index: 5, load_kg: 110, avg_velocity: 0.49, avg_rom_cm: 61.2 }),
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
});
