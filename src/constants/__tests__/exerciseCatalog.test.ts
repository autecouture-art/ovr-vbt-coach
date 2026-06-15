import { describe, expect, it } from "vitest";
import {
  EXERCISE_EDIT_GROUPS,
  getCanonicalExerciseName,
  getCanonicalExerciseMigrationPairs,
  getDefaultCategoryForSelectionGroup,
  getExerciseSelectionGroup,
  getExerciseSelectionGroups,
  getPrimarySelectionGroupForCategory,
  inferExercisePreset,
  matchesExerciseSelectionGroup,
} from "../exerciseCatalog";
import type { Exercise } from "@/src/types/index";

const exercise = (
  category: Exercise["category"],
  id = `${category}_test`,
): Exercise =>
  ({
    id,
    name: id,
    category,
    has_lvp: false,
    rom_data_points: 0,
  }) as Exercise;

describe("exercise selection grouping", () => {
  it("normalizes common Japanese exercise names to English canonical names", () => {
    expect(getCanonicalExerciseName("ナローベンチプレス")).toBe(
      "Close Grip Bench Press",
    );
    expect(getCanonicalExerciseName("ローバースクワット")).toBe(
      "Low Bar Squat",
    );
    expect(getCanonicalExerciseName("ハイバースクワット")).toBe(
      "High Bar Squat",
    );
    expect(getCanonicalExerciseName("Back Squat")).toBe("Squat");
    expect(getCanonicalExerciseName("Speed Bench Press")).toBe("Bench Press");
    expect(getCanonicalExerciseName("スピードベンチ")).toBe("Bench Press");
  });

  it("exposes canonical migration pairs for history data", () => {
    expect(getCanonicalExerciseMigrationPairs()).toEqual(
      expect.arrayContaining([{ from: "back squat", to: "Squat" }]),
    );
    expect(getCanonicalExerciseMigrationPairs()).toEqual(
      expect.arrayContaining([{ from: "バックスクワット", to: "Squat" }]),
    );
  });

  it("infers bench and squat variants from Japanese free-text names", () => {
    expect(inferExercisePreset("ナローベンチ").subcategory).toBe(
      "close_grip_bench",
    );
    expect(inferExercisePreset("ローバー").subcategory).toBe("low_bar_squat");
    expect(inferExercisePreset("ハイバー").subcategory).toBe("high_bar_squat");
  });

  it("treats cable face pull and cable upright row as shoulder exercises", () => {
    const facePull = inferExercisePreset("Cable Face Pull");
    const uprightRow = inferExercisePreset("Cable up right row");

    expect(facePull.category).toBe("press");
    expect(facePull.subcategory).toBe("rear_delt_face_pull");
    expect(getExerciseSelectionGroups(facePull as Exercise)).toContain(
      "shoulders",
    );
    expect(uprightRow.category).toBe("press");
    expect(uprightRow.subcategory).toBe("upright_row");
    expect(getExerciseSelectionGroups(uprightRow as Exercise)).toContain(
      "shoulders",
    );
  });

  it("groups bench assistance under the bench family", () => {
    expect(getExerciseSelectionGroup(exercise("bench"))).toBe("bench");
    expect(getExerciseSelectionGroup(exercise("press"))).toBe("bench");
    expect(getExerciseSelectionGroup(exercise("triceps"))).toBe("bench");
    expect(matchesExerciseSelectionGroup(exercise("triceps"), "bench")).toBe(
      true,
    );
  });

  it("groups squat assistance under the squat family", () => {
    expect(getExerciseSelectionGroup(exercise("squat"))).toBe("squat");
    expect(getExerciseSelectionGroup(exercise("quad"))).toBe("squat");
    expect(getExerciseSelectionGroup(exercise("single_leg"))).toBe("squat");
    expect(matchesExerciseSelectionGroup(exercise("adductor"), "squat")).toBe(
      true,
    );
  });

  it("groups deadlift assistance under the deadlift family", () => {
    expect(getExerciseSelectionGroup(exercise("deadlift"))).toBe("deadlift");
    expect(getExerciseSelectionGroup(exercise("hamstring"))).toBe("deadlift");
    expect(getExerciseSelectionGroup(exercise("glute"))).toBe("deadlift");
    expect(
      matchesExerciseSelectionGroup(exercise("adductor"), "deadlift"),
    ).toBe(true);
  });

  it("keeps supplemental body-part filters available", () => {
    expect(getExerciseSelectionGroups(exercise("press"))).toContain(
      "shoulders",
    );
    expect(getExerciseSelectionGroups(exercise("triceps"))).toContain("arms");
    expect(getExerciseSelectionGroups(exercise("quad"))).toContain("quads");
    expect(getExerciseSelectionGroups(exercise("hamstring"))).toContain(
      "posterior_chain",
    );
  });

  it("maps settings edit chips to the same exercise selection groups", () => {
    expect(EXERCISE_EDIT_GROUPS.map((group) => group.id)).not.toContain("all");
    expect(getDefaultCategoryForSelectionGroup("shoulders")).toBe("press");
    expect(getDefaultCategoryForSelectionGroup("posterior_chain")).toBe(
      "hamstring",
    );
    expect(getPrimarySelectionGroupForCategory("press")).toBe("shoulders");
    expect(getPrimarySelectionGroupForCategory("quad")).toBe("quads");
    expect(getPrimarySelectionGroupForCategory("accessory")).toBe("other");
  });
});
