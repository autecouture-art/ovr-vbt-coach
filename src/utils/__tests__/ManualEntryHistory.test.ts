import { describe, expect, it } from "vitest";
import type { SetData } from "../../types/index";
import { getManualEntryHistoryPreview } from "../ManualEntryHistory";

const createSet = (
  setIndex: number,
  timestamp: string,
): SetData =>
  ({
    session_id: "manual-session",
    set_index: setIndex,
    lift: "Chinning",
    load_kg: 0,
    reps: 8,
    set_type: "normal",
    timestamp,
  }) as SetData;

describe("getManualEntryHistoryPreview", () => {
  it("shows the newest saved entries first and caps the visible history", () => {
    const preview = getManualEntryHistoryPreview(
      [
        createSet(1, "2026-08-25T06:00:00.000Z"),
        createSet(3, "2026-08-25T06:03:00.000Z"),
        createSet(2, "2026-08-25T06:02:00.000Z"),
      ],
      2,
    );

    expect(preview.map((set) => set.set_index)).toEqual([3, 2]);
  });

  it("uses the set index as a stable fallback when timestamps match", () => {
    const preview = getManualEntryHistoryPreview([
      createSet(1, "2026-08-25T06:00:00.000Z"),
      createSet(2, "2026-08-25T06:00:00.000Z"),
    ]);

    expect(preview.map((set) => set.set_index)).toEqual([2, 1]);
  });
});
