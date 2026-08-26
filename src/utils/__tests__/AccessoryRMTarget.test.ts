import { describe, expect, it } from "vitest";
import {
  buildAccessoryRMTargetContext,
  calculateAccessoryE1RM,
  resolveSetE1RMForPersistence,
} from "../AccessoryRMTarget";
import type { Exercise, SetData } from "../../types/index";

const accessoryExercise: Exercise = {
  id: "reverse_pec_deck_fly",
  name: "Reverse Pec Deck Fly",
  category: "accessory",
  has_lvp: false,
};

const squatAccessoryExercise: Exercise = {
  id: "ex_38",
  name: "SSB Bulgarian Squat",
  category: "squat",
  subcategory: "squat_variant",
  has_lvp: false,
};

const historySet = (overrides: Partial<SetData>): SetData => ({
  session_id: "history-session",
  lift: "Reverse Pec Deck Fly",
  set_index: 1,
  load_kg: 75,
  reps: 10,
  device_type: "manual",
  set_type: "normal",
  avg_velocity: null,
  velocity_loss: null,
  timestamp: "2026-06-10T00:00:00.000Z",
  e1rm: calculateAccessoryE1RM(75, 10),
  ...overrides,
});

describe("AccessoryRMTarget", () => {
  it("uses Epley e1RM for accessory rep-max targets", () => {
    expect(calculateAccessoryE1RM(75, 10)).toBe(100);
  });

  it("builds a 5-15 rep conversion table from previous best e1RM", () => {
    const context = buildAccessoryRMTargetContext({
      lift: "Reverse Pec Deck Fly",
      currentLoadKg: 72.5,
      currentReps: 10,
      exercise: accessoryExercise,
      historySets: [historySet({})],
    });

    expect(context.enabled).toBe(true);
    expect(context.repRange).toEqual([5, 15]);
    expect(context.previousBestE1RMKg).toBe(100);
    expect(context.targetSource).toBe("previous_best");
    expect(context.conversionTable).toHaveLength(11);
    expect(context.conversionTable.find((row) => row.reps === 10)).toMatchObject({
      reps: 10,
      targetLoadKg: 75,
      targetE1RMKg: 100,
    });
  });

  it("falls back to current set as a first baseline when history is missing", () => {
    const context = buildAccessoryRMTargetContext({
      lift: "Reverse Pec Deck Fly",
      currentLoadKg: 40,
      currentReps: 15,
      exercise: accessoryExercise,
      historySets: [],
    });

    expect(context.previousBestE1RMKg).toBeNull();
    expect(context.targetSource).toBe("current_baseline");
    expect(context.targetE1RMKg).toBe(60);
  });

  it("excludes raw sets outside 5-15 reps from baseline, PR, and conversion targets", () => {
    const context = buildAccessoryRMTargetContext({
      lift: "Reverse Pec Deck Fly",
      currentLoadKg: 60,
      currentReps: 8,
      exercise: accessoryExercise,
      historySets: [
        historySet({ load_kg: 55, reps: 22, e1rm: calculateAccessoryE1RM(55, 22) }),
        historySet({ load_kg: 60, reps: 8, e1rm: calculateAccessoryE1RM(60, 8) }),
      ],
    });

    expect(calculateAccessoryE1RM(55, 22)).toBe(95.3);
    expect(context.excludedHistorySetCount).toBe(1);
    expect(context.previousBestE1RMKg).toBe(76);
    expect(context.targetE1RMKg).toBe(76);
    expect(context.e1RMPR).toBe(false);
  });

  it("keeps an out-of-range current set raw but excludes it from e1RM decisions", () => {
    const context = buildAccessoryRMTargetContext({
      lift: "Reverse Pec Deck Fly",
      currentLoadKg: 55,
      currentReps: 22,
      exercise: accessoryExercise,
      historySets: [historySet({ load_kg: 60, reps: 8 })],
    });

    expect(context.currentE1RMKg).toBeNull();
    expect(context.e1RMPR).toBeNull();
    expect(context.sameLoadRepPR).toBeNull();
    expect(context.sameLoadVolumePR).toBeNull();
    expect(context.note).toContain("範囲外");
  });

  it("treats squat-category variants as accessories unless they are competition lifts", () => {
    const context = buildAccessoryRMTargetContext({
      lift: "SSB Bulgarian Squat",
      currentLoadKg: 72,
      currentReps: 16,
      currentE1RMKg: 110.4,
      exercise: squatAccessoryExercise,
      historySets: [],
    });

    expect(context.enabled).toBe(true);
    expect(context.currentE1RMKg).toBeNull();
    expect(context.targetE1RMKg).toBeNull();
    expect(context.note).toContain("範囲外");
  });

  it("persists raw accessory sets but excludes out-of-range e1RM and keeps BIG3 unchanged", () => {
    expect(
      resolveSetE1RMForPersistence({
        rawE1RM: 95.3,
        reps: 22,
        isAccessory: true,
      }),
    ).toEqual({
      e1rm: null,
      eligibleForBaselineAndPR: false,
      exclusionReason: "e1rm_excluded: accessory reps outside 5-15",
    });
    expect(
      resolveSetE1RMForPersistence({
        rawE1RM: 95.3,
        reps: 22,
        isAccessory: false,
      }),
    ).toEqual({
      e1rm: 95.3,
      eligibleForBaselineAndPR: true,
      exclusionReason: null,
    });
  });
});
