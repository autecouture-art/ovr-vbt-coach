import { describe, expect, it } from "vitest";
import { createSimulatedRep, createSimulatedSet } from "../VBTSimulator";

describe("VBTSimulator", () => {
  it("creates an OVR-like rep payload with raw values", () => {
    const rep = createSimulatedRep({
      meanVelocity: 0.5,
      peakVelocity: 0.6,
      romCm: 50,
      loadKg: 100,
      timestamp: 123,
    });

    expect(rep.mean_velocity).toBe(0.5);
    expect(rep.peak_velocity).toBe(0.6);
    expect(rep.rom_cm).toBe(50);
    expect(rep.mean_power_w).toBe(491);
    expect(rep.raw_mean_v).toBe(50);
    expect(rep.raw_peak_v).toBe(60);
    expect(rep.raw_rom).toBe(197);
    expect(rep.timestamp).toBe(123);
  });

  it("creates a velocity-loss shaped set", () => {
    const reps = createSimulatedSet({
      reps: 4,
      baseVelocity: 0.52,
      velocityDropPerRep: 0.04,
      romCm: 55,
    });

    expect(reps).toHaveLength(4);
    expect(reps.map((rep) => rep.mean_velocity)).toEqual([
      0.52, 0.48, 0.44, 0.4,
    ]);
    expect(reps[0].rom_cm).toBeGreaterThan(reps[1].rom_cm);
  });
});
