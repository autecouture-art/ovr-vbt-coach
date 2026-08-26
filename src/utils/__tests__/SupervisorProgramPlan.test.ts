import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  SUPERVISOR_PROGRAM_SCHEMA_V8,
  buildPlannedNextSetFromSupervisorRow,
  computeSupervisorProgramChecksum,
  diffSupervisorProgramPlans,
  getSupervisorRowsForDay,
  isHeavyExposureBlockedByPain,
  resolveSupervisorRowForExercise,
  resolveSupervisorRowsForExercise,
  validateSupervisorProgramPlan,
  type SupervisorProgramPlanV8,
} from "../SupervisorProgramPlan";

function makePlan(overrides: Partial<SupervisorProgramPlanV8> = {}): SupervisorProgramPlanV8 {
  const withoutChecksum = {
    schema: SUPERVISOR_PROGRAM_SCHEMA_V8,
    plan_id: "weldpeak-supervisor-menu",
    version: "2026-07-23-v8-sample",
    updated_at: "2026-07-23T07:00:00+09:00",
    effective_from: "2026-07-23",
    source: "unit-test",
    rows: [
      {
        week: 8,
        day: "Day2",
        row_id: "w8d2_main_bp_001",
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
        green_branch: { condition: "AV within gate", action: "continue planned row" },
        yellow_branch: { condition: "VL high", action: "reduce 2.5kg" },
        red_branch: { condition: "pain or fatigue", action: "stop heavy exposure" },
        pain_stop_conditions: ["pain_score >= 4"],
        fatigue_stop_conditions: ["rpe >= 8", "vl_last >= 20"],
        machine_drop_set: null,
      },
      {
        week: 8,
        day: "Day2",
        row_id: "w8d2_tempo_bp_002",
        order: 2,
        exercise_id: "tempo_bench_press",
        display_name: "Tempo Bench Press",
        role: "tempo_accessory" as const,
        required_optional: "optional" as const,
        full_body_role: "tempo_assistance",
        deletion_priority: 50,
        load_kg: 60,
        reps: 5,
        sets: 2,
        tempo_or_pause: "3-0-1",
        rest_seconds: 180,
        rpe_target: 6,
        rpe_cap: 7,
        vl_target: 8,
        vl_cap: 15,
        velocity_gate: "tempo_baseline",
        green_branch: { condition: "clean tempo", action: "continue" },
        yellow_branch: { condition: "tempo breaks", action: "repeat lower load" },
        red_branch: { condition: "main not complete", action: "do not replace main" },
        pain_stop_conditions: ["pain_score >= 4"],
        fatigue_stop_conditions: ["rpe >= 7"],
        machine_drop_set: null,
      },
      {
        week: 8,
        day: "Day2",
        row_id: "w8d2_machine_drop_003",
        order: 3,
        exercise_id: "pec_deck",
        display_name: "Pec Deck",
        role: "accessory" as const,
        required_optional: "optional" as const,
        full_body_role: "accessory_machine",
        deletion_priority: 80,
        load_kg: 40,
        reps: 12,
        sets: 2,
        tempo_or_pause: null,
        rest_seconds: 90,
        rpe_target: 8,
        rpe_cap: 9,
        vl_target: 20,
        vl_cap: 30,
        velocity_gate: "machine_accessory",
        green_branch: { condition: "RPE <= 8", action: "continue" },
        yellow_branch: { condition: "VL high", action: "drop stack" },
        red_branch: { condition: "pain", action: "stop" },
        pain_stop_conditions: ["shoulder pain"],
        fatigue_stop_conditions: ["vl_min >= 30"],
        machine_drop_set: {
          enabled: true,
          weight_stack_only: true,
          drop_width_kg: 5,
          vl_cap: 30,
          new_baseline_after_drop: true,
          max_drops: 2,
        },
      },
    ],
    ...overrides,
  } satisfies Omit<SupervisorProgramPlanV8, "checksum">;
  return {
    ...withoutChecksum,
    checksum: computeSupervisorProgramChecksum(withoutChecksum),
  };
}

describe("SupervisorProgramPlan v8", () => {
  it("validates a v8 package and checksum", () => {
    const validation = validateSupervisorProgramPlan(makePlan());
    expect(validation.ok).toBe(true);
    expect(validation.plan?.schema).toBe(SUPERVISOR_PROGRAM_SCHEMA_V8);
    expect(validation.plan?.rows[0].row_id).toBe("w8d2_main_bp_001");
  });

  it("rejects checksum mismatch and broken JSON shape", () => {
    const bad = { ...makePlan(), checksum: "fnv1a32:deadbeef" };
    expect(validateSupervisorProgramPlan(bad).errors.join("\n")).toContain("checksum mismatch");
    expect(validateSupervisorProgramPlan({ schema: "other" }).ok).toBe(false);
  });

  it("rejects tempo assistance replacing the required normal main", () => {
    const plan = makePlan({
      rows: makePlan().rows.filter((row) => row.role !== "normal_main"),
    });
    const signed = { ...plan, checksum: computeSupervisorProgramChecksum({ ...plan, checksum: "" }) };
    const validation = validateSupervisorProgramPlan(signed);
    expect(validation.ok).toBe(false);
    expect(validation.errors.join("\n")).toContain("required normal_main is missing");
    expect(validation.errors.join("\n")).toContain("tempo accessory cannot replace normal_main");
  });

  it("migrates explicit v7 rows instead of parsing markdown", () => {
    const validation = validateSupervisorProgramPlan({
      schema: "repvelocoach.program_menu.v7",
      version: "20260623",
      rows: [
        {
          "週": 8,
          Day: "Day2",
          "順番": 1,
          "役割": "通常メイン",
          "全身法役割": "competition_main",
          "種目": "Bench Press",
          "テンポ/停止": "通常",
          "基本重量kg": 85,
          "回数": 5,
          "セット": 3,
        },
      ],
    });
    expect(validation.ok).toBe(true);
    expect(validation.plan?.schema).toBe(SUPERVISOR_PROGRAM_SCHEMA_V8);
    expect(validation.plan?.rows[0].role).toBe("normal_main");
  });

  it("migrates the approved v7 fixture deterministically with normal mains preserved", () => {
    const fixture = JSON.parse(
      readFileSync(
        "docs/repvelocoach_program_menu_current_20260623_fullbody_main_plus_tempo.json",
        "utf8",
      ),
    );
    const first = validateSupervisorProgramPlan(fixture);
    const second = validateSupervisorProgramPlan(fixture);
    expect(first.ok).toBe(true);
    expect(first.plan?.checksum).toBe(second.plan?.checksum);

    const rows = first.plan?.rows ?? [];
    const dayKeys = new Set(rows.map((row) => `${row.week}|${row.day}`));
    for (const key of dayKeys) {
      const [weekText, day] = key.split("|");
      const dayRows = getSupervisorRowsForDay(first.plan, Number(weekText), day);
      expect(dayRows.some((row) => row.role === "normal_main" && row.required_optional === "required")).toBe(true);
    }

    const week5Day2Rows = getSupervisorRowsForDay(first.plan, 5, "Day2");
    expect(week5Day2Rows.some((row) => row.display_name === "Bench Press" && row.role === "normal_main")).toBe(true);
    expect(week5Day2Rows.some((row) => row.display_name === "Tempo Bench Press" && row.role === "tempo_accessory")).toBe(true);
    expect(week5Day2Rows.some((row) => row.full_body_role === "主役固定補助")).toBe(true);
  });

  it("rejects unknown and secret-like v8 fields before checksum-time sanitizing", () => {
    const plan = makePlan();
    const badPlan = {
      ...plan,
      apiToken: "do-not-ship",
      checksum: computeSupervisorProgramChecksum({ ...plan, apiToken: "do-not-ship" } as Record<string, unknown> as SupervisorProgramPlanV8),
    } as Record<string, unknown>;
    const validation = validateSupervisorProgramPlan(badPlan);
    expect(validation.ok).toBe(false);
    expect(validation.errors.join("\n")).toContain("secret-like field is not allowed");
  });

  it("accepts explicit individual-profile collection fields without breaking v8 validation", () => {
    const base = makePlan();
    const rows = base.rows.map((row, index) =>
      index === 0
        ? {
            ...row,
            profile_mode: "collect" as const,
            final_rep_velocity_target: null,
            rep_velocity_loss_pattern: [],
            vl_observation_points: [10, 15, 20, 25, 30],
          }
        : row,
    );
    const { checksum: _checksum, ...unsigned } = { ...base, rows };
    const plan = {
      ...unsigned,
      checksum: computeSupervisorProgramChecksum(unsigned),
    };

    const validation = validateSupervisorProgramPlan(plan);
    expect(validation.ok).toBe(true);
    expect(validation.plan?.rows[0]).toMatchObject({
      profile_mode: "collect",
      vl_observation_points: [10, 15, 20, 25, 30],
    });
  });

  it("resolves an applied row into the planned next-set contract", () => {
    const plan = makePlan();
    const row = resolveSupervisorRowForExercise(plan, 8, "Day2", "Bench Press");
    expect(row?.row_id).toBe("w8d2_main_bp_001");
    expect(buildPlannedNextSetFromSupervisorRow(row)).toMatchObject({
      loadKg: 85,
      reps: 5,
      rowId: "w8d2_main_bp_001",
      source: "applied_supervisor_row",
    });
  });

  it("returns every ordered row when one exercise has heavy and main work", () => {
    const base = makePlan();
    const heavy = {
      ...base.rows[0],
      row_id: "w8d2_bp_single_000",
      order: 0,
      role: "heavy_exposure_single" as const,
      load_kg: 92.5,
      reps: 1,
      sets: 1,
    };
    const rows = resolveSupervisorRowsForExercise(
      makePlan({ rows: [heavy, ...base.rows] }),
      8,
      "Day2",
      "Bench Press",
    );
    expect(rows.map((row) => row.row_id)).toEqual([
      "w8d2_bp_single_000",
      "w8d2_main_bp_001",
    ]);
  });

  it("keeps machine drop sets weight-stack only and blocks heavy exposure only with active pain", () => {
    const plan = makePlan();
    const machine = plan.rows.find((row) => row.machine_drop_set?.enabled);
    expect(machine?.machine_drop_set?.weight_stack_only).toBe(true);
    expect(isHeavyExposureBlockedByPain({ ...plan.rows[0], role: "heavy_exposure_single" }, 4)).toBe(true);
    expect(isHeavyExposureBlockedByPain({ ...plan.rows[0], role: "heavy_exposure_single" }, 0)).toBe(false);
  });

  it("reports idempotent and changed rows through diff", () => {
    const oldPlan = makePlan();
    const newRows = oldPlan.rows.map((row) =>
      row.row_id === "w8d2_main_bp_001" ? { ...row, load_kg: 87.5 } : row,
    );
    const nextWithoutChecksum = { ...oldPlan, version: "2026-07-24-v8", rows: newRows };
    const next = { ...nextWithoutChecksum, checksum: computeSupervisorProgramChecksum(nextWithoutChecksum) };
    const diff = diffSupervisorProgramPlans(oldPlan, next);
    expect(diff.same_checksum).toBe(false);
    expect(diff.changed_row_ids).toEqual(["w8d2_main_bp_001"]);
  });
});
