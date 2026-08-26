import { describe, expect, it } from "vitest";

import type { RepData } from "../../types/index";
import {
  buildIndividualVBTProfile,
  buildLiveSetProfileTarget,
  buildRepVelocityLossPattern,
} from "../IndividualVBTProfile";

const rep = (
  repIndex: number,
  meanVelocity: number,
  overrides: Partial<RepData> = {},
): RepData => ({
  session_id: "profile-session",
  lift: "Bench Press",
  set_index: 1,
  rep_index: repIndex,
  load_kg: 80,
  device_type: "OVR Velocity",
  mean_velocity: meanVelocity,
  peak_velocity: null,
  rom_cm: 30,
  mean_power_w: null,
  rep_duration_ms: null,
  is_valid_rep: true,
  set_type: "normal",
  timestamp: "2026-08-10T00:00:00.000Z",
  ...overrides,
});

describe("IndividualVBTProfile", () => {
  it("builds VL_last and rep-to-rep loss from valid full-ROM reps only", () => {
    const pattern = buildRepVelocityLossPattern([
      rep(1, 0.5),
      rep(2, 0.6),
      rep(3, 0.51),
      rep(4, 0.48),
      rep(5, 0.3, { is_excluded: true }),
      rep(6, 0.3, { is_short_rom: true }),
      rep(7, 0.3, { is_failed: true }),
    ]);

    expect(pattern.repCount).toBe(4);
    expect(pattern.fastestVelocity).toBe(0.6);
    expect(pattern.finalVelocity).toBe(0.48);
    expect(pattern.velocityLossLastPct).toBeCloseTo(20, 6);
    expect(pattern.points[0]?.previousRepLossPct).toBeNull();
    expect(pattern.points[1]?.previousRepLossPct).toBeCloseTo(-20, 6);
    expect(pattern.points[2]?.previousRepLossPct).toBeCloseTo(15, 6);
    expect(pattern.points[3]?.previousRepLossPct).toBeCloseTo(5.88235294117647, 6);
    expect(pattern.maxSequentialLossPct).toBeCloseTo(15, 6);
  });

  it("uses three comparable samples before declaring an individual target ready", () => {
    const profile = buildIndividualVBTProfile([
      {
        finalVelocity: 0.4,
        velocityLossLastPct: 20,
        sequentialLossPatternPct: [5, 10],
      },
      {
        finalVelocity: 0.38,
        velocityLossLastPct: 22,
        sequentialLossPatternPct: [7, 8],
      },
      {
        finalVelocity: 0.42,
        velocityLossLastPct: 18,
        sequentialLossPatternPct: [6, 12],
      },
    ]);

    expect(profile).toMatchObject({
      sampleCount: 3,
      confidence: "ready",
      targetFinalVelocity: 0.4,
      targetVelocityLossPct: 20,
      expectedSequentialLossPatternPct: [6, 10],
    });
  });

  it("shows the next VL observation point instead of a generic stop in collection mode", () => {
    const target = buildLiveSetProfileTarget({
      mode: "collect",
      plannedLoadKg: 80,
      plannedReps: 6,
      plannedRpe: 9,
      targetVelocityLossPct: 10,
      capVelocityLossPct: 15,
      reps: [rep(1, 0.6), rep(2, 0.54)],
    });

    expect(target.observationOnly).toBe(true);
    expect(target.plannedLoadKg).toBe(80);
    expect(target.plannedReps).toBe(6);
    expect(target.currentRepCount).toBe(2);
    expect(target.currentVelocityLossLastPct).toBeCloseTo(10, 6);
    expect(target.nextObservationPointPct).toBe(15);
    expect(target.currentFinalVelocity).toBe(0.54);
  });
});
