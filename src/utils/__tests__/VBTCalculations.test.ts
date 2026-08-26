import { describe, expect, it } from "vitest";
import {
  calculateVelocityLossMetrics,
  stabilizeDaily1RMEstimate,
} from "../VBTCalculations";
import type { RepData } from "../../types/index";

const makeRep = (meanVelocity: number, repIndex: number): RepData => ({
  session_id: "test-session",
  lift: "Low Bar Squat",
  set_index: 1,
  rep_index: repIndex,
  load_kg: 122.5,
  device_type: "OVR Velocity",
  mean_velocity: meanVelocity,
  peak_velocity: null,
  rom_cm: null,
  mean_power_w: null,
  rep_duration_ms: null,
  is_valid_rep: true,
  set_type: "normal",
  timestamp: `2026-06-01T00:00:0${repIndex}.000Z`,
});

const metricsFor = (velocities: number[]) =>
  calculateVelocityLossMetrics(
    velocities.map((velocity, index) => makeRep(velocity, index + 1)),
  );

describe("calculateVelocityLossMetrics", () => {
  it("separates average, final-rep, and slowest-rep velocity loss", () => {
    expect(metricsFor([0.42, 0.39, 0.36, 0.3])).toMatchObject({
      vlAvg: 12.5,
      vlLast: 28.6,
      vlMin: 28.6,
      vlJudgementMetric: "vlLast",
    });
  });

  it("uses the fastest rep even when it is not the first rep", () => {
    expect(metricsFor([0.41, 0.42, 0.41, 0.38, 0.34])).toMatchObject({
      vlAvg: 6.7,
      vlLast: 19,
      vlMin: 19,
    });
  });

  it("distinguishes final-rep loss from within-set minimum loss", () => {
    expect(metricsFor([0.44, 0.43, 0.4, 0.36, 0.39])).toMatchObject({
      vlAvg: 8.2,
      vlLast: 11.4,
      vlMin: 18.2,
    });
  });

  it("does not produce decision VL metrics for one valid rep", () => {
    expect(metricsFor([0.42])).toMatchObject({
      vlAvg: null,
      vlLast: null,
      vlMin: null,
    });
  });
});

describe("stabilizeDaily1RMEstimate", () => {
  it("uses historical floor when a light set badly underestimates today's 1RM", () => {
    expect(
      stabilizeDaily1RMEstimate({
        rawEstimate: 66,
        currentLoad: 60,
        historicalBest1RM: 95,
        confidence: "medium",
      }),
    ).toMatchObject({
      estimated1RM: 90.3,
      confidence: "low",
      source: "history_floor",
    });
  });

  it("keeps raw estimates when they are plausible against history", () => {
    expect(
      stabilizeDaily1RMEstimate({
        rawEstimate: 93,
        currentLoad: 85,
        historicalBest1RM: 95,
        confidence: "medium",
      }),
    ).toMatchObject({
      estimated1RM: 93,
      confidence: "medium",
      source: "raw",
    });
  });
});
