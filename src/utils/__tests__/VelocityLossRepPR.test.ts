import { describe, expect, it } from "vitest";
import type { SetData } from "../../types/index";
import { buildVelocityLossRepPRTarget } from "../VelocityLossRepPR";

const historySet = (overrides: Partial<SetData> = {}): SetData => ({
  session_id: "history",
  lift: "Bench Press",
  set_index: 1,
  load_kg: 80,
  reps: 8,
  device_type: "OVR Velocity",
  set_type: "normal",
  avg_velocity: 0.35,
  velocity_loss: 12,
  velocity_loss_last: 12,
  timestamp: "2026-08-01T00:00:00.000Z",
  ...overrides,
});

describe("buildVelocityLossRepPRTarget", () => {
  it("targets one rep above the best same-load set inside the configured VL", () => {
    const target = buildVelocityLossRepPRTarget({
      lift: "Bench Press",
      loadKg: 80,
      velocityLossThreshold: 15,
      liveRepCount: 4,
      currentVelocityLoss: 8,
      historySets: [
        historySet({ reps: 8, velocity_loss_last: 12 }),
        historySet({ reps: 10, velocity_loss_last: 18 }),
        historySet({ load_kg: 82.5, reps: 12, velocity_loss_last: 10 }),
      ],
    });

    expect(target).toMatchObject({
      status: "chasing",
      historicalBestReps: 8,
      targetReps: 9,
      repsRemaining: 5,
      eligibleHistoryCount: 1,
      excludedHistoryCount: 1,
    });
  });

  it("counts a set exactly at the threshold and a single as zero VL", () => {
    const target = buildVelocityLossRepPRTarget({
      lift: "Bench Press",
      loadKg: 80,
      velocityLossThreshold: 15,
      liveRepCount: 0,
      currentVelocityLoss: null,
      historySets: [
        historySet({ reps: 6, velocity_loss_last: 15 }),
        historySet({
          reps: 1,
          velocity_loss: null,
          velocity_loss_last: null,
        }),
      ],
    });

    expect(target.historicalBestReps).toBe(6);
    expect(target.targetReps).toBe(7);
  });

  it("matches canonical lift aliases but keeps other loads separate", () => {
    const target = buildVelocityLossRepPRTarget({
      lift: "Bench Press",
      loadKg: 80,
      velocityLossThreshold: 15,
      liveRepCount: 0,
      currentVelocityLoss: null,
      historySets: [
        historySet({
          lift: "ベンチプレス",
          reps: 7,
          velocity_loss_last: 10,
        }),
        historySet({
          load_kg: 82.5,
          reps: 12,
          velocity_loss_last: 10,
        }),
      ],
    });

    expect(target.historicalBestReps).toBe(7);
    expect(target.targetReps).toBe(8);
  });

  it("excludes multi-rep history without VL and warmups", () => {
    const target = buildVelocityLossRepPRTarget({
      lift: "Bench Press",
      loadKg: 80,
      velocityLossThreshold: 15,
      liveRepCount: 0,
      currentVelocityLoss: null,
      historySets: [
        historySet({
          reps: 12,
          velocity_loss: null,
          velocity_loss_last: null,
        }),
        historySet({ reps: 10, velocity_loss_last: 10, is_warmup: true }),
      ],
    });

    expect(target).toMatchObject({
      status: "baseline",
      historicalBestReps: null,
      targetReps: 1,
      eligibleHistoryCount: 0,
      excludedHistoryCount: 1,
    });
  });

  it("marks the live target achieved while inside VL", () => {
    const target = buildVelocityLossRepPRTarget({
      lift: "Bench Press",
      loadKg: 80,
      velocityLossThreshold: 15,
      liveRepCount: 9,
      currentVelocityLoss: 15,
      historySets: [historySet({ reps: 8, velocity_loss_last: 12 })],
    });

    expect(target).toMatchObject({
      status: "achieved",
      repsRemaining: 0,
    });
  });

  it("rejects the live PR after VL exceeds the configured threshold", () => {
    const target = buildVelocityLossRepPRTarget({
      lift: "Bench Press",
      loadKg: 80,
      velocityLossThreshold: 15,
      liveRepCount: 9,
      currentVelocityLoss: 15.1,
      historySets: [historySet({ reps: 8, velocity_loss_last: 12 })],
    });

    expect(target.status).toBe("threshold_exceeded");
  });

  it("disables the target when VL is off", () => {
    expect(
      buildVelocityLossRepPRTarget({
        lift: "Bench Press",
        loadKg: 80,
        velocityLossThreshold: 0,
        liveRepCount: 0,
        currentVelocityLoss: null,
        historySets: [],
      }),
    ).toMatchObject({
      enabled: false,
      status: "disabled",
      targetReps: null,
    });
  });
});
