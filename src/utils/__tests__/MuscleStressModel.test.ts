import { describe, expect, it } from "vitest";

import type { SetMuscleStressInput } from "../MuscleStressModel";
import {
  estimateSetMuscleStress,
  getMuscleAllocation,
  getMuscleStressConfidence,
  projectMuscleRecovery,
  summarizeMuscleStress,
  updateRecoveryProfileFromFeedback,
} from "../MuscleStressModel";

const set = (
  overrides: Partial<SetMuscleStressInput> = {},
): SetMuscleStressInput => ({
  lift: "Low Bar Squat",
  load_kg: 120,
  reps: 5,
  rpe: 8,
  e1rm: 160,
  velocity_loss_last: 12,
  velocity_loss_min: 18,
  is_warmup: false,
  category: "squat",
  ...overrides,
});

describe("MuscleStressModel", () => {
  it("gives warmups no local stimulus or fatigue", () => {
    const estimate = estimateSetMuscleStress(set({ is_warmup: true }));

    expect(estimate).toMatchObject({
      included: false,
      reason: "warmup",
      effectiveReps: 0,
      fatigueByMuscle: {},
    });
  });

  it("uses canonical allocations before a category fallback and normalizes them", () => {
    const canonical = getMuscleAllocation("Leg Curl DELTA", "hamstring");
    const fallback = getMuscleAllocation("Unknown leg curl", "hamstring");

    expect(canonical.hamstrings).toBeCloseTo(0.85, 6);
    expect(canonical.glutes).toBeCloseTo(0.05, 6);
    expect(fallback.hamstrings).toBeCloseTo(0.8, 6);
    expect(
      Object.values(canonical).reduce((sum, value) => sum + (value ?? 0), 0),
    ).toBeCloseTo(1, 6);
  });

  it("increases estimated local fatigue with effort and velocity loss without treating it as medical damage", () => {
    const lowStress = estimateSetMuscleStress(
      set({ rpe: 6, velocity_loss_last: 0, velocity_loss_min: 0 }),
    );
    const highStress = estimateSetMuscleStress(
      set({ rpe: 9, velocity_loss_last: 20, velocity_loss_min: 30 }),
    );

    expect(highStress.effectiveReps).toBeGreaterThan(lowStress.effectiveReps);
    expect(highStress.fatigueMultiplier).toBeGreaterThan(
      lowStress.fatigueMultiplier,
    );
    expect(highStress.fatigueByMuscle.quadriceps ?? 0).toBeGreaterThan(
      lowStress.fatigueByMuscle.quadriceps ?? 0,
    );
    expect(highStress.relativeLoad).toBe(0.75);
  });

  it("projects 24/48/72 hour recovery exponentially from clearly bounded priors", () => {
    const recovery24 = projectMuscleRecovery({ hamstrings: 12 }, 24);
    const recovery48 = projectMuscleRecovery({ hamstrings: 12 }, 48);
    const recovery72 = projectMuscleRecovery({ hamstrings: 12 }, 72);
    const ham24 = recovery24.find((entry) => entry.muscle === "hamstrings")!;
    const ham48 = recovery48.find((entry) => entry.muscle === "hamstrings")!;
    const ham72 = recovery72.find((entry) => entry.muscle === "hamstrings")!;

    expect(ham24.currentLoadScore).toBe(100);
    expect(ham24.remainingLoadScore).toBeGreaterThan(ham48.remainingLoadScore);
    expect(ham48.remainingLoadScore).toBeGreaterThan(ham72.remainingLoadScore);
    expect(ham24.recoveryHours).toBe(38);
  });

  it("summarizes sessions without counting warmups and reports prior confidence before feedback", () => {
    const summary = summarizeMuscleStress([
      set({ is_warmup: true }),
      set({
        lift: "Bench Press",
        category: "bench",
        load_kg: 80,
        reps: 5,
        e1rm: 105,
      }),
    ]);

    expect(summary.fatigueByMuscle.quadriceps ?? 0).toBe(0);
    expect(summary.fatigueByMuscle.chest ?? 0).toBeGreaterThan(0);
    expect(summary.currentLoadScoreByMuscle.chest).toBeGreaterThan(0);
    expect(summary.confidenceByMuscle.chest).toBe("prior");
    expect(summary.recovery[24][0]).toHaveProperty("remainingLoadScore");
  });

  it("defers personal recovery changes until the third feedback sample, then bounds the update", () => {
    const initial = {
      sampleCountByMuscle: { hamstrings: 1 },
      recoveryHoursByMuscle: { hamstrings: 38 },
      capacityByMuscle: { hamstrings: 12 },
    };
    const second = updateRecoveryProfileFromFeedback({
      profile: initial,
      predictedCurrentLoadScoreByMuscle: { hamstrings: 30 },
      feedback: [{ muscle: "hamstrings", sorenessScore: 8 }],
    });
    const third = updateRecoveryProfileFromFeedback({
      profile: second.profile,
      predictedCurrentLoadScoreByMuscle: { hamstrings: 30 },
      feedback: [
        {
          muscle: "hamstrings",
          sorenessScore: 8,
          sameLoadVelocityChangePct: -8,
        },
      ],
    });

    expect(second.deferredMuscles).toEqual(["hamstrings"]);
    expect(second.profile.recoveryHoursByMuscle?.hamstrings).toBe(38);
    expect(third.updatedMuscles).toEqual(["hamstrings"]);
    expect(third.profile.sampleCountByMuscle?.hamstrings).toBe(3);
    expect(third.profile.recoveryHoursByMuscle?.hamstrings).toBeGreaterThan(38);
    expect(third.profile.recoveryHoursByMuscle?.hamstrings).toBeLessThanOrEqual(
      96,
    );
    expect(third.profile.capacityByMuscle?.hamstrings).toBeLessThan(12);
  });

  it("uses deterministic confidence tiers", () => {
    expect(getMuscleStressConfidence(0)).toBe("prior");
    expect(getMuscleStressConfidence(2)).toBe("collecting");
    expect(getMuscleStressConfidence(3)).toBe("provisional");
    expect(getMuscleStressConfidence(9)).toBe("personalized");
  });
});
