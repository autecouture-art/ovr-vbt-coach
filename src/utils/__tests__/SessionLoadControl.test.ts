import { describe, expect, it } from "vitest";
import { resolveUserSelectedSessionLoad } from "../SessionLoadControl";

describe("resolveUserSelectedSessionLoad", () => {
  it("keeps stale-plan user controls operable for direct, suggested, and warmup load selections", () => {
    expect(resolveUserSelectedSessionLoad(82.5)).toBe(82.5);
    expect(resolveUserSelectedSessionLoad(100)).toBe(100);
    expect(resolveUserSelectedSessionLoad(120)).toBe(120);
  });

  it("normalizes user-selected loads to recording precision without imposing a supervisor-plan ceiling", () => {
    expect(resolveUserSelectedSessionLoad(82.74)).toBe(82.74);
    expect(resolveUserSelectedSessionLoad(28.754)).toBe(28.75);
    expect(resolveUserSelectedSessionLoad(-1)).toBe(0);
  });
});
