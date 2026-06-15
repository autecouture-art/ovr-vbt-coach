import { describe, expect, it } from "vitest";
import {
  buildAccessoryRMTargetContext,
  calculateAccessoryE1RM,
} from "../AccessoryRMTarget";
import type { Exercise, SetData } from "../../types/index";

const accessoryExercise: Exercise = {
  id: "reverse_pec_deck_fly",
  name: "Reverse Pec Deck Fly",
  category: "accessory",
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
});
