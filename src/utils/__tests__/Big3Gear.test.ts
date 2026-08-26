import { describe, expect, it } from "vitest";

import {
  BIG3_GEAR_OPTIONS_BY_LIFT,
  GENERAL_GEAR_OPTIONS,
  formatBig3GearSummary,
  getCompetitionBig3Lift,
  normalizeBig3GearSelection,
  parseBig3GearSelection,
  serializeBig3GearSelection,
} from "../Big3Gear";

describe("Big3Gear", () => {
  it("defines exactly the requested selectable options per lift", () => {
    expect(BIG3_GEAR_OPTIONS_BY_LIFT).toEqual({
      SQ: ["belt", "wrist_wraps", "regular_knee_sleeves", "pro_knee_sleeves"],
      BP: ["belt", "wrist_wraps", "elbow_sleeves", "thumbless_grip"],
      DL: [
        "belt",
        "power_grips",
        "wrist_straps",
        "figure_8_straps",
        "hook_grip",
      ],
    });
  });

  it("keeps a general equipment catalog for non-BIG3 exercises", () => {
    expect(GENERAL_GEAR_OPTIONS).toEqual(
      expect.arrayContaining([
        "belt",
        "wrist_wraps",
        "wrist_straps",
        "lifting_shoes",
        "chalk",
      ]),
    );
    expect(
      formatBig3GearSummary({
        gear: ["lifting_shoes", "chalk"],
      }),
    ).toBe("リフティングシューズ・チョーク");
  });

  it("recognizes only explicit canonical competition BIG3 names", () => {
    expect(getCompetitionBig3Lift("Low Bar Squat")).toBe("SQ");
    expect(getCompetitionBig3Lift(" Squat ")).toBe("SQ");
    expect(getCompetitionBig3Lift("Bench Press")).toBe("BP");
    expect(getCompetitionBig3Lift("Sumo Deadlift")).toBe("DL");
    expect(getCompetitionBig3Lift("Conventional Deadlift")).toBe("DL");
    expect(getCompetitionBig3Lift("Tempo Bench Press")).toBeNull();
    expect(getCompetitionBig3Lift("Back Squat")).toBeNull();
    expect(getCompetitionBig3Lift("Deficit Sumo Deadlift")).toBeNull();
  });

  it("normalizes, deduplicates, and serializes selections stably", () => {
    const normalized = normalizeBig3GearSelection({
      gear: ["knee_wraps", "belt", "belt", "invalid"],
      other: "  滑り止め   ソックス ",
    });

    expect(normalized).toEqual({
      gear: ["belt", "knee_wraps"],
      other: "滑り止め ソックス",
    });
    expect(serializeBig3GearSelection(normalized)).toBe(
      '{"gear":["belt","knee_wraps"],"other":"滑り止め ソックス"}',
    );
  });

  it("parses explicit empty, legacy shapes, and rejects missing or malformed values", () => {
    expect(parseBig3GearSelection('{"gear":[]}')).toEqual({ gear: [] });
    expect(parseBig3GearSelection(["belt", "belt"])).toEqual({
      gear: ["belt"],
    });
    expect(
      parseBig3GearSelection({
        gears: ["wrist_wraps"],
        otherGear: "テーピング",
      }),
    ).toEqual({ gear: ["wrist_wraps"], other: "テーピング" });
    expect(
      parseBig3GearSelection({
        gear: [
          "knee_sleeves",
          "knee_wraps",
          "lifting_straps",
          "deadlift_suit",
          "squat_suit",
          "bench_shirt",
        ],
      }),
    ).toEqual({
      gear: [
        "knee_sleeves",
        "knee_wraps",
        "lifting_straps",
        "deadlift_suit",
        "squat_suit",
        "bench_shirt",
      ],
    });
    expect(parseBig3GearSelection(undefined)).toBeNull();
    expect(parseBig3GearSelection("not json")).toBeNull();
    expect(parseBig3GearSelection('{"unknown":true}')).toBeNull();
  });

  it("distinguishes an empty gear record from an absent record in Japanese", () => {
    expect(formatBig3GearSummary('{"gear":[]}')).toBe("ギアなし");
    expect(formatBig3GearSummary(undefined)).toBe("未記録");
    expect(formatBig3GearSummary({ gear: ["belt"], other: "テーピング" })).toBe(
      "ベルト・その他: テーピング",
    );
    expect(
      formatBig3GearSummary({
        gear: ["knee_sleeves", "lifting_straps", "bench_shirt"],
      }),
    ).toBe("ニースリーブ・ストラップ・ベンチシャツ");
    expect(
      formatBig3GearSummary({
        gear: ["pro_knee_sleeves", "figure_8_straps"],
      }),
    ).toBe("プロ系ニースリーブ・エイトストラップ");
  });
});
