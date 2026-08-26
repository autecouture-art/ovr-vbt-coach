import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testFilePath = fileURLToPath(import.meta.url);
const source = readFileSync(
  resolve(dirname(testFilePath), "useSessionLogic.ts"),
  "utf8",
);

describe("useSessionLogic accessory e1RM persistence contract", () => {
  it("gates persisted e1RM, historical baseline, and e1RM PR by exact competition-lift identity", () => {
    expect(source).toContain("resolveSetE1RMForPersistence({");
    expect(source).toMatch(/const e1rm = e1rmDecision\.e1rm;/);
    expect(source).toMatch(
      /getBestE1RMForLift\(\s*liftForEstimate,\s*currentExercise \? !isBig3Exercise\(currentExercise\) : false/,
    );
    expect(source).toMatch(
      /getBestPR\(\s*lift,\s*"e1rm",\s*currentExercise \? !isBig3Exercise\(currentExercise\) : false/,
    );
  });
});
