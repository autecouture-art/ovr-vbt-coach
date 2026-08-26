import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_MANUAL_ENTRY_FAVORITES,
  buildManualEntryFavoriteId,
  sortManualEntryFavoritePresets,
  upsertManualEntryFavoritePreset,
} from "../ManualEntryFavorites";

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

describe("ManualEntryFavorites", () => {
  it("ships with fast Chinning defaults for bodyweight and weighted work", () => {
    expect(DEFAULT_MANUAL_ENTRY_FAVORITES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          exerciseName: "Chinning",
          loadKg: 0,
          reps: 8,
          setType: "normal",
        }),
        expect.objectContaining({
          exerciseName: "Chinning",
          loadKg: 10,
          reps: 5,
          setType: "normal",
        }),
      ]),
    );
  });

  it("builds stable IDs from exercise, load, reps, and set type", () => {
    expect(buildManualEntryFavoriteId(" Chinning ", 10, 5, "normal")).toBe(
      "chinning-10kg-5rep-normal",
    );
    expect(
      buildManualEntryFavoriteId("Close Grip Bench Press", 72.5, 8, "backoff"),
    ).toBe("close-grip-bench-press-72p5kg-8rep-backoff");
  });

  it("updates an existing favorite instead of duplicating it", () => {
    const first = upsertManualEntryFavoritePreset(
      [],
      {
        exerciseName: "Chinning",
        loadKg: 0,
        reps: 8,
        setType: "normal",
      },
      "2026-08-05T00:00:00.000Z",
    );
    const second = upsertManualEntryFavoritePreset(
      first,
      {
        exerciseName: "Chinning",
        loadKg: 0,
        reps: 8,
        setType: "normal",
      },
      "2026-08-05T00:01:00.000Z",
    );

    expect(second).toHaveLength(1);
    expect(second[0]).toEqual(
      expect.objectContaining({
        exerciseName: "Chinning",
        loadKg: 0,
        reps: 8,
        useCount: 2,
        lastUsedAt: "2026-08-05T00:01:00.000Z",
      }),
    );
  });

  it("sorts favorites by use count before recency", () => {
    const sorted = sortManualEntryFavoritePresets([
      {
        id: "a",
        exerciseName: "Bench Press",
        loadKg: 60,
        reps: 8,
        setType: "normal",
        createdAt: "2026-08-05T00:00:00.000Z",
        lastUsedAt: "2026-08-05T00:10:00.000Z",
        useCount: 1,
      },
      {
        id: "b",
        exerciseName: "Chinning",
        loadKg: 0,
        reps: 8,
        setType: "normal",
        createdAt: "2026-08-05T00:00:00.000Z",
        lastUsedAt: "2026-08-05T00:01:00.000Z",
        useCount: 3,
      },
    ]);

    expect(sorted.map((preset) => preset.id)).toEqual(["b", "a"]);
  });
});
