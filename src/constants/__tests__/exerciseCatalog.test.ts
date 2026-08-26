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
  isDefaultExerciseCatalogItem,
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
    expect(getCanonicalExerciseName("Squat")).toBe("Low Bar Squat");
    expect(getCanonicalExerciseName("Back Squat")).toBe("Low Bar Squat");
    expect(getCanonicalExerciseName("squt")).toBe("Low Bar Squat");
    expect(getCanonicalExerciseName("low ber squad")).toBe("Low Bar Squat");
    expect(getCanonicalExerciseName("ナローベンチプレス")).toBe(
      "Close Grip Bench Press",
    );
    expect(getCanonicalExerciseName("ローバースクワット")).toBe(
      "Low Bar Squat",
    );
    expect(getCanonicalExerciseName("ハイバースクワット")).toBe(
      "High Bar Squat",
    );
    expect(getCanonicalExerciseName("Speed Bench Press")).toBe("Bench Press");
    expect(getCanonicalExerciseName("スピードベンチ")).toBe("Bench Press");
    expect(getCanonicalExerciseName("Tバーロウ")).toBe("T-Bar Row");
    expect(getCanonicalExerciseName("Lat pull down delta.co")).toBe(
      "Lat Pulldown",
    );
    expect(getCanonicalExerciseName("ダンベルシュラッグ")).toBe(
      "Dumbbell Shrug",
    );
    expect(getCanonicalExerciseName("トライセプスエクステンション")).toBe(
      "Cable French Press",
    );
    expect(getCanonicalExerciseName("テンポベンチプレス")).toBe(
      "Larsen 4-2-0 Tempo Bench Press",
    );
    expect(getCanonicalExerciseName("Larsen Narrow Bench")).toBe(
      "Larsen Narrow Bench",
    );
    expect(getCanonicalExerciseName("larsen narrow bench press")).toBe(
      "Larsen Narrow Bench",
    );
  });

  it("exposes canonical migration pairs for history data", () => {
    expect(getCanonicalExerciseMigrationPairs()).toEqual(
      expect.arrayContaining([{ from: "back squat", to: "Low Bar Squat" }]),
    );
    expect(getCanonicalExerciseMigrationPairs()).toEqual(
      expect.arrayContaining([
        { from: "バックスクワット", to: "Low Bar Squat" },
      ]),
    );
    expect(getCanonicalExerciseMigrationPairs()).toEqual(
      expect.arrayContaining([{ from: "low ber squad", to: "Low Bar Squat" }]),
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

  it("treats pec fly variants as chest exercises", () => {
    const pecFly = inferExercisePreset("pec fly");
    const pecDeck = inferExercisePreset("Pec Deck Fly");

    expect(pecFly.category).toBe("bench");
    expect(pecFly.subcategory).toBe("chest_fly");
    expect(getExerciseSelectionGroups(pecFly as Exercise)).toContain("chest");
    expect(pecDeck.category).toBe("bench");
    expect(getDefaultCategoryForSelectionGroup("chest")).toBe("bench");

    const reversePecDeck = inferExercisePreset("Reverse Pec Deck Fly");
    expect(reversePecDeck.category).toBe("press");
    expect(reversePecDeck.subcategory).toBe("rear_delt_fly");
    expect(getExerciseSelectionGroups(reversePecDeck as Exercise)).toContain(
      "shoulders",
    );
    expect(getCanonicalExerciseName("Short-Range Pec Fly")).toBe("Pec Fly");
  });

  it("normalizes visible app exercise duplicates into canonical English names", () => {
    expect(getCanonicalExerciseName("Cable arm curl wide")).toBe("Arm Curl");
    expect(getCanonicalExerciseName("Larsen Narrow Bench")).toBe(
      "Larsen Narrow Bench",
    );
    expect(getCanonicalExerciseName("Close Grip Bench Press")).toBe(
      "Close Grip Bench Press",
    );
    expect(getCanonicalExerciseName("Cable Side Raise")).toBe(
      "Cable Side Raise",
    );
    expect(getCanonicalExerciseName("Porse deadlift sumo")).toBe(
      "Sumo Deadlift",
    );
    expect(getCanonicalExerciseName("Porse squat")).toBe("Low Bar Squat");
    expect(getCanonicalExerciseName("1/2/5 Tempo SumoDeadlift")).toBe(
      "Sumo Deadlift",
    );
  });

  it("does not treat user-added alias-like exercise names as catalog-managed rows", () => {
    expect(
      isDefaultExerciseCatalogItem({
        id: "tempo_bench_press",
        name: "Tempo Bench Press",
      }),
    ).toBe(false);

    expect(
      isDefaultExerciseCatalogItem({
        id: "larsen_tempo_bench_press",
        name: "Larsen 4-2-0 Tempo Bench Press",
      }),
    ).toBe(true);
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
