import { describe, expect, it } from "vitest";

import {
  isVelocityLossThreshold,
  normalizeVelocityLossThreshold,
  VELOCITY_LOSS_THRESHOLD_MAX,
  VELOCITY_LOSS_THRESHOLD_MIN,
  VELOCITY_LOSS_THRESHOLD_OPTIONS,
} from "../VelocityLossThreshold";

describe("VelocityLossThreshold", () => {
  it("provides every selectable threshold from 5% through 40%", () => {
    expect(VELOCITY_LOSS_THRESHOLD_OPTIONS).toHaveLength(36);
    expect(VELOCITY_LOSS_THRESHOLD_OPTIONS[0]).toBe(
      VELOCITY_LOSS_THRESHOLD_MIN,
    );
    expect(VELOCITY_LOSS_THRESHOLD_OPTIONS.at(-1)).toBe(
      VELOCITY_LOSS_THRESHOLD_MAX,
    );
    expect(VELOCITY_LOSS_THRESHOLD_OPTIONS).toEqual(
      Array.from({ length: 36 }, (_, index) => index + 5),
    );
    expect(
      VELOCITY_LOSS_THRESHOLD_OPTIONS.every(
        (threshold, index, options) =>
          index === 0 || threshold - options[index - 1] === 1,
      ),
    ).toBe(true);
  });

  it("rounds and clamps values at the setting boundary", () => {
    expect(normalizeVelocityLossThreshold(4)).toBe(5);
    expect(normalizeVelocityLossThreshold(12.6)).toBe(13);
    expect(normalizeVelocityLossThreshold(40)).toBe(40);
    expect(normalizeVelocityLossThreshold(41)).toBe(40);
    expect(normalizeVelocityLossThreshold(null)).toBe(20);
  });

  it("recognizes only integer values in the selectable range", () => {
    expect(isVelocityLossThreshold(5)).toBe(true);
    expect(isVelocityLossThreshold(40)).toBe(true);
    expect(isVelocityLossThreshold(4)).toBe(false);
    expect(isVelocityLossThreshold(20.5)).toBe(false);
  });
});
