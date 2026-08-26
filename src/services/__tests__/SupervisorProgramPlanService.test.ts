/* eslint-disable import/first */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  computeSupervisorProgramChecksum,
  getSupervisorRowsForDay,
  validateSupervisorProgramPlan,
} from "../../utils/SupervisorProgramPlan";
import fs from "node:fs";

const storage = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(storage.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      storage.delete(key);
      return Promise.resolve();
    }),
  },
}));

vi.mock("../AppSettingsService", () => ({
  loadAppSettings: vi.fn(() =>
    Promise.resolve({
      enable_live_share: true,
      live_share_url: "http://line93.local:3001",
      live_share_token: "sync-token",
    }),
  ),
}));

import SupervisorProgramPlanService, {
  getDelayUntilNextJstDateBoundaryMs,
  getNextJstDateBoundaryMs,
  getSupervisorProgramPlanExecutionState,
} from "../SupervisorProgramPlanService";

function makePlan(version = "2026-07-23-v8") {
  const withoutChecksum = {
    schema: "repvelocoach.program_menu.v8" as const,
    plan_id: "weldpeak-supervisor-menu",
    version,
    updated_at: "2026-07-23T07:00:00+09:00",
    effective_from: "2026-07-23",
    valid_until: "2099-07-30T23:59:59+09:00",
    source: null,
    rows: [
      {
        week: 8,
        day: "Day2",
        row_id: "w8d2_main_bp",
        order: 1,
        exercise_id: "bench_press",
        display_name: "Bench Press",
        role: "normal_main" as const,
        required_optional: "required" as const,
        full_body_role: "competition_main",
        deletion_priority: 0,
        load_kg: 85,
        reps: 5,
        sets: 3,
        tempo_or_pause: "通常",
        rest_seconds: 240,
        rpe_target: 7,
        rpe_cap: 8,
        vl_target: 10,
        vl_cap: 20,
        velocity_gate: "exercise_specific",
        green_branch: { condition: "ok", action: "continue" },
        yellow_branch: { condition: "fatigue", action: "reduce" },
        red_branch: { condition: "pain", action: "stop" },
        pain_stop_conditions: ["pain_score >= 4"],
        fatigue_stop_conditions: ["vl_last >= 20"],
        machine_drop_set: null,
      },
    ],
  };
  return {
    ...withoutChecksum,
    checksum: computeSupervisorProgramChecksum(withoutChecksum),
  };
}

describe("SupervisorProgramPlanService", () => {
  beforeEach(() => {
    storage.clear();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("accepts the local Week10 import artifact over a stale Week9 applied plan", async () => {
    const week10 = JSON.parse(
      fs.readFileSync("docs/repvelocoach_supervisor_plan_week10_20260805.json", "utf8"),
    );
    expect(validateSupervisorProgramPlan(week10).ok).toBe(true);
    expect(getSupervisorRowsForDay(week10, 10, "Day1")).toHaveLength(5);
    expect(getSupervisorRowsForDay(week10, 10, "Day2")).toHaveLength(5);
    expect(getSupervisorRowsForDay(week10, 10, "Day3")).toHaveLength(5);
    expect(
      getSupervisorRowsForDay(week10, 10, "Day2").find(
        (row) => row.row_id === "w10d2_bp_single_001",
      ),
    ).toMatchObject({
      load_kg: 92.5,
      reps: 1,
      sets: 1,
      velocity_gate: expect.stringContaining("90kg AV >= 0.22"),
    });
    expect(
      getSupervisorRowsForDay(week10, 10, "Day3").find(
        (row) => row.row_id === "w10d3_dl_single_001",
      ),
    ).toMatchObject({
      load_kg: 140,
      reps: 1,
      sets: 1,
      velocity_gate: expect.stringContaining("120kg AV >= 0.40"),
    });
    await SupervisorProgramPlanService.stagePlan(makePlan("2026-07-27-week9-v1"));
    await SupervisorProgramPlanService.applyStagedPlan();
    const staged = await SupervisorProgramPlanService.stagePlan(week10);
    expect(staged.validation.ok).toBe(true);
    expect(staged.idempotent).toBe(false);
    expect((await SupervisorProgramPlanService.applyStagedPlan()).version).toBe(
      "2026-08-05-week10-v1",
    );
  });

  it("rejects a Week10 plan that omits required Day2 and Day3 coverage", () => {
    const complete = JSON.parse(
      fs.readFileSync("docs/repvelocoach_supervisor_plan_week10_20260805.json", "utf8"),
    );
    const partial = {
      ...complete,
      rows: complete.rows.filter((row: { day: string }) => row.day === "Day1"),
      checksum: "",
    };
    partial.checksum = computeSupervisorProgramChecksum(partial);

    const validation = validateSupervisorProgramPlan(partial);
    expect(validation.ok).toBe(false);
    expect(validation.errors).toContain("Week10 Day2 rows are required");
    expect(validation.errors).toContain("Week10 Day3 rows are required");
  });

  it("fetches and stages without applying immediately, then applies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(makePlan()),
        }),
      ),
    );

    const staged = await SupervisorProgramPlanService.fetchAndStage();
    expect(staged.validation.ok).toBe(true);
    expect((globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(
      "http://line93.local:3001/api/repvelocoach/plan/current",
    );
    expect((await SupervisorProgramPlanService.getState()).applied).toBeNull();

    const applied = await SupervisorProgramPlanService.applyStagedPlan();
    expect(applied.version).toBe("2026-07-23-v8");
    expect((await SupervisorProgramPlanService.getState()).applied?.checksum).toBe(applied.checksum);
  });

  it("auto-applies only a validated changed plan and makes identical fetches a no-op", async () => {
    const firstPlan = makePlan("auto-v1");
    const nextPlan = makePlan("auto-v2");
    let responsePlan = firstPlan;
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(responsePlan),
        }),
      ),
    );

    await SupervisorProgramPlanService.stagePlan(firstPlan);
    await SupervisorProgramPlanService.applyStagedPlan();

    const unchanged = await SupervisorProgramPlanService.syncCurrentPlanIfChanged();
    expect(unchanged.status).toBe("unchanged");
    expect((await SupervisorProgramPlanService.getState()).staged).toBeNull();
    expect((await SupervisorProgramPlanService.getState()).applied?.version).toBe("auto-v1");

    responsePlan = nextPlan;
    const applied = await SupervisorProgramPlanService.syncCurrentPlanIfChanged();
    expect(applied.status).toBe("applied");
    expect((await SupervisorProgramPlanService.getState()).applied?.version).toBe("auto-v2");
    expect((await SupervisorProgramPlanService.getState()).previous?.version).toBe("auto-v1");
  });

  it("keeps previous version and supports back-and-forth rollback", async () => {
    await SupervisorProgramPlanService.stagePlan(makePlan("v1"));
    await SupervisorProgramPlanService.applyStagedPlan();
    await SupervisorProgramPlanService.stagePlan(makePlan("v2"));
    await SupervisorProgramPlanService.applyStagedPlan();

    expect((await SupervisorProgramPlanService.getState()).previous?.version).toBe("v1");
    const rolledBack = await SupervisorProgramPlanService.rollbackToPreviousPlan();
    expect(rolledBack.version).toBe("v1");
    expect((await SupervisorProgramPlanService.getState()).previous?.version).toBe("v2");
    const rolledForward = await SupervisorProgramPlanService.rollbackToPreviousPlan();
    expect(rolledForward.version).toBe("v2");
    expect((await SupervisorProgramPlanService.getState()).previous?.version).toBe("v1");
  });

  it("uses valid_until for stale detection and keeps week-length fallback", async () => {
    await SupervisorProgramPlanService.stagePlan(makePlan("valid"));
    await SupervisorProgramPlanService.applyStagedPlan();
    expect((await SupervisorProgramPlanService.getState()).is_stale).toBe(false);

    const expired = makePlan("expired");
    await SupervisorProgramPlanService.stagePlan({
      ...expired,
      valid_until: "2000-01-01T00:00:00+09:00",
      checksum: computeSupervisorProgramChecksum({
        ...expired,
        valid_until: "2000-01-01T00:00:00+09:00",
        checksum: "",
      }),
    });
    await SupervisorProgramPlanService.applyStagedPlan();
    const state = await SupervisorProgramPlanService.getState();
    expect(state.is_stale).toBe(true);
    expect(state.stale_reason).toContain("有効期限");
  });

  it("treats valid_until as a full Asia/Tokyo day boundary", () => {
    const plan = {
      ...makePlan("jst-boundary"),
      valid_until: "2026-07-30",
    };
    plan.checksum = computeSupervisorProgramChecksum({
      ...plan,
      checksum: "",
    });

    expect(
      getSupervisorProgramPlanExecutionState(
        plan,
        new Date("2026-07-30T14:59:59.999Z").getTime(),
      ),
    ).toMatchObject({
      executable: true,
      is_stale: false,
      stale_reason: null,
    });

    expect(
      getSupervisorProgramPlanExecutionState(
        plan,
        new Date("2026-07-30T15:00:00.000Z").getTime(),
      ),
    ).toMatchObject({
      executable: false,
      is_stale: true,
      stale_reason: "監督メニューの有効期限を過ぎています",
    });
  });

  it("calculates the exact next Asia/Tokyo date boundary", () => {
    const beforeBoundary = new Date("2026-07-30T14:59:59.000Z").getTime();
    expect(getNextJstDateBoundaryMs(beforeBoundary)).toBe(
      new Date("2026-07-30T15:00:00.000Z").getTime(),
    );
    expect(getDelayUntilNextJstDateBoundaryMs(beforeBoundary)).toBe(1_050);

    const afterBoundary = new Date("2026-07-30T15:00:00.000Z").getTime();
    expect(getNextJstDateBoundaryMs(afterBoundary)).toBe(
      new Date("2026-07-31T15:00:00.000Z").getTime(),
    );
  });

  it("blocks execution before effective_from in Asia/Tokyo", () => {
    const plan = {
      ...makePlan("future-effective"),
      effective_from: "2026-07-25",
      valid_until: "2026-07-31",
    };
    plan.checksum = computeSupervisorProgramChecksum({
      ...plan,
      checksum: "",
    });

    expect(
      getSupervisorProgramPlanExecutionState(
        plan,
        new Date("2026-07-24T14:59:59.999Z").getTime(),
      ),
    ).toMatchObject({
      executable: false,
      is_stale: true,
      stale_reason: "監督メニューの開始日前です",
    });
    expect(
      getSupervisorProgramPlanExecutionState(
        plan,
        new Date("2026-07-24T15:00:00.000Z").getTime(),
      ),
    ).toMatchObject({
      executable: true,
      is_stale: false,
    });
  });

  it("rejects broken JSON/checksum and preserves offline applied version", async () => {
    await SupervisorProgramPlanService.stagePlan(makePlan("v1"));
    await SupervisorProgramPlanService.applyStagedPlan();
    const bad = { ...makePlan("v2"), checksum: "fnv1a32:badbad00" };
    const result = await SupervisorProgramPlanService.stagePlan(bad);
    expect(result.validation.ok).toBe(false);
    expect((await SupervisorProgramPlanService.getState()).applied?.version).toBe("v1");
  });
});
