import { describe, expect, it } from "vitest";
import { estimateHistoricalMvt } from "../LVPEstimation";
import type { SetData } from "@/src/types/index";

const set = (overrides: Partial<SetData>): SetData =>
  ({
    session_id: "session_test",
    lift: "Landmine Shoulder Press",
    set_index: 1,
    load_kg: 60,
    reps: 1,
    device_type: "OVR Velocity",
    set_type: "normal",
    avg_velocity: 0.44,
    velocity_loss: 0,
    timestamp: "2026-07-08T00:00:00.000Z",
    is_warmup: false,
    ...overrides,
  }) as SetData;

describe("estimateHistoricalMvt", () => {
  it("uses the slowest valid heavy set as the personal MVT candidate", () => {
    const estimate = estimateHistoricalMvt([
      set({ load_kg: 40, avg_velocity: 0.1 }),
      set({ load_kg: 55, avg_velocity: 0.48 }),
      set({ load_kg: 60, avg_velocity: 0.44 }),
      set({ load_kg: 60, avg_velocity: 0.18 }),
    ]);

    expect(estimate?.value).toBe(0.18);
    expect(estimate?.source).toBe("履歴MVT");
  });

  it("does not let light warmups set MY V@1RM", () => {
    const estimate = estimateHistoricalMvt([
      set({ load_kg: 40, avg_velocity: 0.11, is_warmup: true }),
      set({ load_kg: 45, avg_velocity: 0.12 }),
      set({ load_kg: 60, avg_velocity: 0.35 }),
    ]);

    expect(estimate?.value).toBe(0.35);
  });
});
