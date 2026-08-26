import { describe, expect, it } from "vitest";
import {
  getFocusVelocityLossState,
  getLiveVelocityLossDecision,
  getLiveVelocityLossDecisionFromLoss,
  resolveVelocityLossThreshold,
} from "../PowerliftingVBTProtocol";
import type { RepData } from "../../types/index";

const makeRep = (
  meanVelocity: number,
  repIndex: number,
  overrides: Partial<RepData> = {},
): RepData => ({
  session_id: "test-session",
  lift: "Bench Press",
  set_index: 1,
  rep_index: repIndex,
  load_kg: 100,
  device_type: "OVR Velocity",
  mean_velocity: meanVelocity,
  peak_velocity: null,
  rom_cm: null,
  mean_power_w: null,
  rep_duration_ms: null,
  is_valid_rep: true,
  set_type: "normal",
  timestamp: "2026-07-21T00:00:00.000Z",
  ...overrides,
});

describe("getFocusVelocityLossState", () => {
  it("keeps VL waiting for zero or one rep", () => {
    expect(getFocusVelocityLossState([], 20)).toMatchObject({
      repCount: 0,
      decision: null,
    });
    expect(getFocusVelocityLossState([makeRep(0.5, 1)], 20)).toMatchObject({
      repCount: 1,
      latestAverageVelocity: 0.5,
      decision: null,
    });
  });

  it("classifies fresh, watch, and stop from VL_last", () => {
    expect(
      getFocusVelocityLossState([makeRep(0.5, 1), makeRep(0.45, 2)], 20)
        .decision?.status,
    ).toBe("fresh");
    expect(
      getFocusVelocityLossState([makeRep(0.5, 1), makeRep(0.41, 2)], 20)
        .decision?.status,
    ).toBe("watch");
    expect(
      getFocusVelocityLossState([makeRep(0.5, 1), makeRep(0.39, 2)], 20)
        .decision?.status,
    ).toBe("stop");
  });

  it("uses only warning-eligible reps for counts, latest AV, and VL", () => {
    const state = getFocusVelocityLossState(
      [
        makeRep(0.5, 1),
        makeRep(0.2, 2, { is_excluded: true }),
        makeRep(0.2, 3, { is_failed: true }),
        makeRep(0.2, 4, { is_valid_rep: false }),
        makeRep(0.45, 5),
      ],
      20,
    );

    expect(state).toMatchObject({
      repCount: 2,
      latestAverageVelocity: 0.45,
      velocityLossAverage: 5,
      velocityLossMinimum: 10,
    });
  });

  it("keeps a zero threshold as an explicit warning-off state", () => {
    expect(
      getFocusVelocityLossState([makeRep(0.5, 1), makeRep(0.3, 2)], 0),
    ).toMatchObject({ decision: null, velocityLossMinimum: 40 });
  });

  it("uses rounded VL_last at the stop boundary", () => {
    const state = getFocusVelocityLossState(
      [makeRep(0.5, 1), makeRep(0.41025, 2)],
      18,
    );
    expect(state.decision).toMatchObject({ velocityLoss: 18, status: "stop" });
  });

  it("stops at a 100% rounded VL", () => {
    expect(getLiveVelocityLossDecisionFromLoss(100, 20)).toMatchObject({
      velocityLoss: 100,
      status: "stop",
    });
  });
});

describe("resolveVelocityLossThreshold", () => {
  it("prefers exercise, then settings, then protocol fallback", () => {
    expect(resolveVelocityLossThreshold(15, 20, 25)).toBe(15);
    expect(resolveVelocityLossThreshold(undefined, 20, 25)).toBe(20);
    expect(resolveVelocityLossThreshold(undefined, undefined, 25)).toBe(25);
    expect(resolveVelocityLossThreshold(0, 20, 25)).toBe(0);
    expect(resolveVelocityLossThreshold(Number.NaN, 20, 25)).toBe(20);
    expect(resolveVelocityLossThreshold(-1, 20, 25)).toBe(20);
  });
});

describe("getLiveVelocityLossDecision", () => {
  it("preserves the detailed warning messages", () => {
    expect(getLiveVelocityLossDecision(0.5, 0.39, 20)).toMatchObject({
      status: "stop",
      message: "VL上限に到達。このセットは終了です。",
      nextSetMessage:
        "次セットは同重量で続けず、2.5〜5%落とすかセット数を削ります。",
    });
    expect(getLiveVelocityLossDecision(0.5, 0.41, 20)).toMatchObject({
      status: "watch",
      message: "あと2.0%でVL上限です。次のレップで止める準備をします。",
      nextSetMessage: "フォームとROMが崩れたら速度に関係なく止めます。",
    });
  });

  it("rounds its calculated loss before classifying the boundary", () => {
    expect(getLiveVelocityLossDecision(0.5, 0.41025, 18)).toMatchObject({
      velocityLoss: 18,
      status: "stop",
    });
  });
});
