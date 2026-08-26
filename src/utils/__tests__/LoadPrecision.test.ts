import { describe, expect, it } from "vitest";

import {
  formatLoadKgTwoDecimals,
  isSameRecordedLoadKg,
  normalizeLoadKg,
  parseLoadKgInput,
} from "../LoadPrecision";

describe("LoadPrecision", () => {
  it("normalizes finite loads to two decimal places without binary artefacts", () => {
    expect(normalizeLoadKg(28.75)).toBe(28.75);
    expect(normalizeLoadKg(59.1)).toBe(59.1);
    expect(normalizeLoadKg(0.1 + 0.2)).toBe(0.3);
    expect(normalizeLoadKg(12.345)).toBe(12.35);
    expect(normalizeLoadKg(Number.NaN)).toBe(0);
    expect(normalizeLoadKg(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("always formats exactly two decimal places", () => {
    expect(formatLoadKgTwoDecimals(80)).toBe("80.00");
    expect(formatLoadKgTwoDecimals(59.1)).toBe("59.10");
    expect(formatLoadKgTwoDecimals(28.75)).toBe("28.75");
    expect(formatLoadKgTwoDecimals(0.1 + 0.2)).toBe("0.30");
  });

  it("keeps distinct cable-stack loads separate for history and PR matching", () => {
    expect(isSameRecordedLoadKg(28.75, 28.75)).toBe(true);
    expect(isSameRecordedLoadKg(28.75, 28.5)).toBe(false);
    expect(isSameRecordedLoadKg(59.1, 59.1 + Number.EPSILON)).toBe(true);
  });

  it("parses normal decimal input and rejects empty or invalid values", () => {
    expect(parseLoadKgInput(" 28.75 ")).toBe(28.75);
    expect(parseLoadKgInput("59,10")).toBe(59.1);
    expect(parseLoadKgInput(".25")).toBe(0.25);
    expect(parseLoadKgInput("12.345")).toBe(12.35);
    expect(parseLoadKgInput("")).toBeNull();
    expect(parseLoadKgInput("28..75")).toBeNull();
    expect(parseLoadKgInput("-5")).toBeNull();
    expect(parseLoadKgInput("Infinity")).toBeNull();
  });
});
