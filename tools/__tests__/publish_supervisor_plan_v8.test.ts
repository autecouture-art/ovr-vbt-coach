import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  packageSupervisorPlanFromFile,
  publishSupervisorPlanAtomically,
} from "../publish_supervisor_plan_v8";
import { validateSupervisorProgramPlan } from "../../src/utils/SupervisorProgramPlan";

let dir: string | null = null;

afterEach(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
  dir = null;
});

describe("publish_supervisor_plan_v8", () => {
  it("packages the approved v7 fixture deterministically", async () => {
    const first = await packageSupervisorPlanFromFile(
      "docs/repvelocoach_program_menu_current_20260623_fullbody_main_plus_tempo.json",
      {
        version: "2026-07-23-production-like",
        updated_at: "2026-07-23T07:00:00+09:00",
        effective_from: "2026-07-23",
        valid_until: "2026-07-30T23:59:59+09:00",
      },
    );
    const second = await packageSupervisorPlanFromFile(
      "docs/repvelocoach_program_menu_current_20260623_fullbody_main_plus_tempo.json",
      {
        version: "2026-07-23-production-like",
        updated_at: "2026-07-23T07:00:00+09:00",
        effective_from: "2026-07-23",
        valid_until: "2026-07-30T23:59:59+09:00",
      },
    );

    expect(first.schema).toBe("repvelocoach.program_menu.v8");
    expect(first.version).toBe("2026-07-23-production-like");
    expect(first.checksum).toBe(second.checksum);
    expect(first.rows.length).toBeGreaterThan(60);
    expect(validateSupervisorProgramPlan(first).ok).toBe(true);
  });

  it("atomically publishes only validated plans", async () => {
    dir = await mkdtemp(join(tmpdir(), "repvelo-plan-publish-"));
    const output = join(dir, "current.json");
    await writeFile(output, "KEEP", "utf8");

    const plan = await packageSupervisorPlanFromFile(
      "docs/repvelocoach_program_menu_current_20260623_fullbody_main_plus_tempo.json",
    );
    await publishSupervisorPlanAtomically(plan, output);
    const saved = JSON.parse(await readFile(output, "utf8"));
    expect(saved.checksum).toBe(plan.checksum);

    await expect(
      publishSupervisorPlanAtomically({ ...plan, checksum: "fnv1a32:badbad00" }, output),
    ).rejects.toThrow("publish前validation失敗");
    const stillSaved = JSON.parse(await readFile(output, "utf8"));
    expect(stillSaved.checksum).toBe(plan.checksum);
  });
});
