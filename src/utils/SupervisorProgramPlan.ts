export const SUPERVISOR_PROGRAM_SCHEMA_V8 = "repvelocoach.program_menu.v8";
export const SUPERVISOR_PROGRAM_SCHEMA_V7 = "repvelocoach.program_menu.v7";

export type SupervisorProgramRole =
  | "fixed_observation"
  | "heavy_exposure_single"
  | "normal_main"
  | "tempo_accessory"
  | "secondary"
  | "upper_pull"
  | "single_leg_lower"
  | "core_arms"
  | "accessory";

export type SupervisorRequiredOptional = "required" | "optional";

export type SupervisorProfileMode = "standard" | "collect" | "confirm";

export type SupervisorBranch = {
  condition: string;
  action: string;
  load_kg?: number | null;
  reps?: number | null;
  sets?: number | null;
  rest_seconds?: number | null;
  note?: string | null;
};

export type SupervisorMachineDropSet = {
  enabled: boolean;
  weight_stack_only: boolean;
  drop_width_kg?: number | null;
  vl_cap?: number | null;
  new_baseline_after_drop?: boolean;
  max_drops?: number | null;
};

export type SupervisorProgramRowV8 = {
  week: number;
  day: string;
  row_id: string;
  order: number;
  exercise_id: string;
  display_name: string;
  role: SupervisorProgramRole;
  required_optional: SupervisorRequiredOptional;
  full_body_role: string;
  deletion_priority: number;
  load_kg: number | null;
  reps: number | null;
  sets: number | null;
  tempo_or_pause: string | null;
  rest_seconds: number | null;
  rpe_target: number | null;
  rpe_cap: number | null;
  vl_target: number | null;
  vl_cap: number | null;
  velocity_gate: string | null;
  profile_mode?: SupervisorProfileMode | null;
  final_rep_velocity_target?: number | null;
  rep_velocity_loss_pattern?: number[];
  vl_observation_points?: number[];
  green_branch: SupervisorBranch | null;
  yellow_branch: SupervisorBranch | null;
  red_branch: SupervisorBranch | null;
  pain_stop_conditions: string[];
  fatigue_stop_conditions: string[];
  machine_drop_set: SupervisorMachineDropSet | null;
};

export type SupervisorProgramPlanV8 = {
  schema: typeof SUPERVISOR_PROGRAM_SCHEMA_V8;
  plan_id: string;
  version: string;
  updated_at: string;
  effective_from: string;
  valid_until?: string | null;
  checksum: string;
  source?: string | null;
  rows: SupervisorProgramRowV8[];
};

export type SupervisorProgramValidationResult = {
  ok: boolean;
  plan: SupervisorProgramPlanV8 | null;
  errors: string[];
  warnings: string[];
};

export type SupervisorProgramDiff = {
  same_version: boolean;
  same_checksum: boolean;
  added_row_ids: string[];
  removed_row_ids: string[];
  changed_row_ids: string[];
  summary: string;
};

const normalizeId = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const SECRET_KEY_RE =
  /(secret|token|password|credential|apikey|api_key|private_key|client_secret)/i;

const PLAN_KEYS = new Set([
  "schema",
  "plan_id",
  "version",
  "updated_at",
  "effective_from",
  "valid_until",
  "checksum",
  "source",
  "rows",
]);

const ROW_KEYS = new Set([
  "week",
  "day",
  "row_id",
  "order",
  "exercise_id",
  "display_name",
  "role",
  "required_optional",
  "full_body_role",
  "deletion_priority",
  "load_kg",
  "reps",
  "sets",
  "tempo_or_pause",
  "rest_seconds",
  "rpe_target",
  "rpe_cap",
  "vl_target",
  "vl_cap",
  "velocity_gate",
  "profile_mode",
  "final_rep_velocity_target",
  "rep_velocity_loss_pattern",
  "vl_observation_points",
  "green_branch",
  "yellow_branch",
  "red_branch",
  "pain_stop_conditions",
  "fatigue_stop_conditions",
  "machine_drop_set",
]);

const BRANCH_KEYS = new Set([
  "condition",
  "action",
  "load_kg",
  "reps",
  "sets",
  "rest_seconds",
  "note",
]);

const MACHINE_DROP_KEYS = new Set([
  "enabled",
  "weight_stack_only",
  "drop_width_kg",
  "vl_cap",
  "new_baseline_after_drop",
  "max_drops",
]);

const V7_EXERCISE_ID_ALIASES: Record<string, string> = {
  "テンポベンチプレス": "tempo_bench_press",
  "Tバーロウ": "t_bar_row",
};

function collectUnknownOrSecretKeys(
  value: unknown,
  allowed: Set<string>,
  path: string,
  errors: string[],
): void {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  for (const key of Object.keys(value as Record<string, unknown>)) {
    const keyPath = `${path}.${key}`;
    if (SECRET_KEY_RE.test(key)) {
      errors.push(`secret-like field is not allowed: ${keyPath}`);
    }
    if (!allowed.has(key)) {
      errors.push(`unknown field is not allowed: ${keyPath}`);
    }
  }
}

function collectStrictV8ShapeErrors(input: unknown): string[] {
  const errors: string[] = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) return errors;
  const plan = input as Record<string, unknown>;
  if (plan.schema !== SUPERVISOR_PROGRAM_SCHEMA_V8) return errors;
  collectUnknownOrSecretKeys(plan, PLAN_KEYS, "plan", errors);
  if (!Array.isArray(plan.rows)) return errors;
  plan.rows.forEach((rowValue, rowIndex) => {
    if (!rowValue || typeof rowValue !== "object" || Array.isArray(rowValue)) {
      return;
    }
    const row = rowValue as Record<string, unknown>;
    collectUnknownOrSecretKeys(row, ROW_KEYS, `rows[${rowIndex}]`, errors);
    for (const branchKey of ["green_branch", "yellow_branch", "red_branch"] as const) {
      const branch = row[branchKey];
      if (branch && typeof branch === "object" && !Array.isArray(branch)) {
        collectUnknownOrSecretKeys(
          branch,
          BRANCH_KEYS,
          `rows[${rowIndex}].${branchKey}`,
          errors,
        );
      }
    }
    const machineDrop = row.machine_drop_set;
    if (machineDrop && typeof machineDrop === "object" && !Array.isArray(machineDrop)) {
      collectUnknownOrSecretKeys(
        machineDrop,
        MACHINE_DROP_KEYS,
        `rows[${rowIndex}].machine_drop_set`,
        errors,
      );
    }
  });
  return errors;
}

const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toStringOrNull = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
};

const toNumberArray = (value: unknown): number[] =>
  Array.isArray(value)
    ? value
        .map(toNumberOrNull)
        .filter((item): item is number => item != null)
    : [];

const mapProfileMode = (value: unknown): SupervisorProfileMode | null => {
  const mode = String(value ?? "").trim().toLowerCase();
  if (mode === "standard" || mode === "collect" || mode === "confirm") {
    return mode;
  }
  return null;
};

const mapRole = (value: unknown): SupervisorProgramRole => {
  const text = String(value ?? "").trim();
  const normalized = normalizeId(text);
  if (normalized === "fixed_observation") return "fixed_observation";
  if (normalized === "heavy_exposure_single") return "heavy_exposure_single";
  if (normalized === "normal_main") return "normal_main";
  if (normalized === "tempo_accessory") return "tempo_accessory";
  if (normalized === "secondary") return "secondary";
  if (normalized === "upper_pull") return "upper_pull";
  if (normalized === "single_leg_lower") return "single_leg_lower";
  if (normalized === "core_arms") return "core_arms";
  if (normalized === "accessory") return "accessory";
  if (normalized.includes("heavy")) return "heavy_exposure_single";
  if (text.includes("主役") && !text.includes("固定")) return "normal_main";
  if (normalized.includes("normal_main") || text.includes("通常メイン")) return "normal_main";
  if (text.includes("バックオフ")) return "normal_main";
  if (normalized.includes("tempo") || text.includes("テンポ")) return "tempo_accessory";
  if (text.includes("固定観察")) return "fixed_observation";
  if (text.includes("二次")) return "secondary";
  if (text.includes("上半身引き")) return "upper_pull";
  if (text.includes("片脚")) return "single_leg_lower";
  if (text.includes("体幹") || text.includes("腕")) return "core_arms";
  return "accessory";
};

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};

export function supervisorPlanChecksumInput(
  plan: SupervisorProgramPlanV8 | Omit<SupervisorProgramPlanV8, "checksum">,
): Omit<SupervisorProgramPlanV8, "checksum"> {
  const { checksum: _checksum, ...rest } = plan as SupervisorProgramPlanV8;
  if (rest.valid_until == null) {
    delete (rest as Partial<SupervisorProgramPlanV8>).valid_until;
  }
  return rest;
}

export function computeSupervisorProgramChecksum(plan: SupervisorProgramPlanV8 | Omit<SupervisorProgramPlanV8, "checksum">): string {
  const text = stableStringify(supervisorPlanChecksumInput(plan));
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `fnv1a32:${hash.toString(16).padStart(8, "0")}`;
}

function normalizeV8Row(row: Record<string, unknown>, index: number): SupervisorProgramRowV8 {
  const displayName = String(row.display_name ?? row.exercise_id ?? `row ${index + 1}`).trim();
  const exerciseId = normalizeId(row.exercise_id ?? displayName);
  const normalized: SupervisorProgramRowV8 = {
    week: toNumberOrNull(row.week) ?? 0,
    day: String(row.day ?? "").trim(),
    row_id: String(row.row_id ?? `${exerciseId}_${index + 1}`).trim(),
    order: toNumberOrNull(row.order) ?? index + 1,
    exercise_id: exerciseId,
    display_name: displayName,
    role: mapRole(row.role),
    required_optional: row.required_optional === "optional" ? "optional" : "required",
    full_body_role: String(row.full_body_role ?? "").trim(),
    deletion_priority: toNumberOrNull(row.deletion_priority) ?? 100,
    load_kg: toNumberOrNull(row.load_kg),
    reps: toNumberOrNull(row.reps),
    sets: toNumberOrNull(row.sets),
    tempo_or_pause: toStringOrNull(row.tempo_or_pause),
    rest_seconds: toNumberOrNull(row.rest_seconds),
    rpe_target: toNumberOrNull(row.rpe_target),
    rpe_cap: toNumberOrNull(row.rpe_cap),
    vl_target: toNumberOrNull(row.vl_target),
    vl_cap: toNumberOrNull(row.vl_cap),
    velocity_gate: toStringOrNull(row.velocity_gate),
    green_branch: (row.green_branch as SupervisorBranch | null) ?? null,
    yellow_branch: (row.yellow_branch as SupervisorBranch | null) ?? null,
    red_branch: (row.red_branch as SupervisorBranch | null) ?? null,
    pain_stop_conditions: Array.isArray(row.pain_stop_conditions)
      ? row.pain_stop_conditions.map(String)
      : [],
    fatigue_stop_conditions: Array.isArray(row.fatigue_stop_conditions)
      ? row.fatigue_stop_conditions.map(String)
      : [],
    machine_drop_set: row.machine_drop_set
      ? (row.machine_drop_set as SupervisorMachineDropSet)
      : null,
  };
  if (Object.prototype.hasOwnProperty.call(row, "profile_mode")) {
    normalized.profile_mode = mapProfileMode(row.profile_mode);
  }
  if (Object.prototype.hasOwnProperty.call(row, "final_rep_velocity_target")) {
    normalized.final_rep_velocity_target = toNumberOrNull(
      row.final_rep_velocity_target,
    );
  }
  if (Object.prototype.hasOwnProperty.call(row, "rep_velocity_loss_pattern")) {
    normalized.rep_velocity_loss_pattern = toNumberArray(
      row.rep_velocity_loss_pattern,
    );
  }
  if (Object.prototype.hasOwnProperty.call(row, "vl_observation_points")) {
    normalized.vl_observation_points = toNumberArray(
      row.vl_observation_points,
    );
  }
  return normalized;
}

function migrateV7Row(row: Record<string, unknown>, index: number): SupervisorProgramRowV8 {
  const week = toNumberOrNull(row["週"]) ?? 0;
  const day = String(row.Day ?? row["日"] ?? "").trim();
  const displayName = String(row["種目"] ?? `row ${index + 1}`).trim();
  const exerciseId =
    normalizeId(displayName) ||
    normalizeId(V7_EXERCISE_ID_ALIASES[displayName]) ||
    `exercise_${String(index + 1).padStart(3, "0")}`;
  const role = mapRole(row["区分"] ?? row["役割"] ?? row["優先"]);
  return {
    week,
    day,
    row_id: `v7_w${week}_${normalizeId(day)}_${String(index + 1).padStart(3, "0")}_${exerciseId}`,
    order: toNumberOrNull(row["順番"]) ?? index + 1,
    exercise_id: exerciseId,
    display_name: displayName,
    role,
    required_optional:
      role === "normal_main" ||
      role === "fixed_observation" ||
      String(row["優先"] ?? "").includes("必須")
        ? "required"
        : "optional",
    full_body_role: String(row["全身法役割"] ?? "").trim(),
    deletion_priority: toNumberOrNull(row["削除優先"] ?? row["削除優先度"]) ?? 100,
    load_kg: toNumberOrNull(row["基本重量kg"]),
    reps: toNumberOrNull(row["回数"]),
    sets: toNumberOrNull(row["セット"]),
    tempo_or_pause: toStringOrNull(row["テンポ/停止"]),
    rest_seconds: toNumberOrNull(row["休憩秒"]),
    rpe_target: toNumberOrNull(row["目標RPE"]),
    rpe_cap: toNumberOrNull(row["RPE上限"]),
    vl_target: toNumberOrNull(row["VL目標%"]),
    vl_cap: toNumberOrNull(row["VL上限%"]),
    velocity_gate: toStringOrNull(row["速度ゲート"]),
    green_branch: { condition: "v7 migrated green", action: String(row["上方分岐kg"] ?? row["次回判断"] ?? "keep") },
    yellow_branch: { condition: String(row["分岐条件"] ?? "v7 migrated yellow"), action: String(row["現場判断ルール"] ?? "coach judgement within plan") },
    red_branch: { condition: "pain/fatigue", action: "stop or reduce within supervisor plan" },
    pain_stop_conditions: ["pain_score >= 4"],
    fatigue_stop_conditions: ["rpe >= rpe_cap", "vl_last >= vl_cap"],
    machine_drop_set: null,
  };
}

export function normalizeSupervisorProgramPlan(input: unknown): SupervisorProgramPlanV8 | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const data = input as Record<string, unknown>;
  const rows = Array.isArray(data.rows) ? data.rows : [];
  if (data.schema === SUPERVISOR_PROGRAM_SCHEMA_V8) {
    return {
      schema: SUPERVISOR_PROGRAM_SCHEMA_V8,
      plan_id: String(data.plan_id ?? "").trim(),
      version: String(data.version ?? "").trim(),
      updated_at: String(data.updated_at ?? "").trim(),
      effective_from: String(data.effective_from ?? "").trim(),
      valid_until: toStringOrNull(data.valid_until),
      checksum: String(data.checksum ?? "").trim(),
      source: toStringOrNull(data.source),
      rows: rows
        .filter((row): row is Record<string, unknown> => !!row && typeof row === "object" && !Array.isArray(row))
        .map(normalizeV8Row),
    };
  }
  if (data.schema === SUPERVISOR_PROGRAM_SCHEMA_V7) {
    const migratedRows = rows
      .filter((row): row is Record<string, unknown> => !!row && typeof row === "object" && !Array.isArray(row))
      .filter((row) => {
        const exerciseName = toStringOrNull(row["種目"]);
        const section = String(row["区分"] ?? "").trim();
        return Boolean(exerciseName) && !section.startsWith("実績");
      })
      .map(migrateV7Row);
    const planWithoutChecksum = {
      schema: SUPERVISOR_PROGRAM_SCHEMA_V8,
      plan_id: String(data.plan_id ?? "repvelocoach.supervisor-menu").trim(),
      version: `${String(data.version ?? "v7").trim()}-migrated-v8`,
      updated_at: String(data.updated_at ?? "1970-01-01T00:00:00.000Z").trim(),
      effective_from: String(data.effective_from ?? data.updated_at ?? "1970-01-01").trim(),
      valid_until: toStringOrNull(data.valid_until),
      source: "program_menu.v7 migration",
      rows: migratedRows,
    } satisfies Omit<SupervisorProgramPlanV8, "checksum">;
    return {
      ...planWithoutChecksum,
      checksum: computeSupervisorProgramChecksum(planWithoutChecksum),
    };
  }
  return null;
}

export function validateSupervisorProgramPlan(input: unknown): SupervisorProgramValidationResult {
  const strictErrors = collectStrictV8ShapeErrors(input);
  const plan = normalizeSupervisorProgramPlan(input);
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!plan) {
    return {
      ok: false,
      plan: null,
      errors: [...strictErrors, "schema is not supported"],
      warnings,
    };
  }
  errors.push(...strictErrors);
  for (const key of ["plan_id", "version", "updated_at", "effective_from", "checksum"] as const) {
    if (!plan[key]) errors.push(`${key} is required`);
  }
  if (!plan.rows.length) errors.push("rows are required");
  if (plan.schema !== SUPERVISOR_PROGRAM_SCHEMA_V8) errors.push("schema must be repvelocoach.program_menu.v8");
  const expectedChecksum = computeSupervisorProgramChecksum(plan);
  if (plan.checksum !== expectedChecksum) {
    errors.push(`checksum mismatch: expected ${expectedChecksum}, actual ${plan.checksum || "missing"}`);
  }

  const rowIds = new Set<string>();
  const dayGroups = new Map<string, SupervisorProgramRowV8[]>();
  for (const row of plan.rows) {
    if (!row.row_id) errors.push("row_id is required");
    if (rowIds.has(row.row_id)) errors.push(`duplicate row_id: ${row.row_id}`);
    rowIds.add(row.row_id);
    if (!row.week || !row.day) errors.push(`week/day are required for ${row.row_id}`);
    if (!row.exercise_id || !row.display_name) errors.push(`exercise fields are required for ${row.row_id}`);
    if (row.role === "normal_main" && row.tempo_or_pause && row.tempo_or_pause !== "通常") {
      errors.push(`normal_main cannot include tempo_or_pause on ${row.row_id}`);
    }
    if (row.machine_drop_set?.enabled && !row.machine_drop_set.weight_stack_only) {
      errors.push(`machine_drop_set must be weight-stack only on ${row.row_id}`);
    }
    const key = `${row.week}|${row.day}`;
    dayGroups.set(key, [...(dayGroups.get(key) ?? []), row]);
  }

  for (const [key, rows] of dayGroups) {
    const normalMains = rows.filter((row) => row.role === "normal_main" && row.required_optional === "required");
    if (normalMains.length === 0) {
      errors.push(`required normal_main is missing for ${key}`);
    }
    const hasTempo = rows.some((row) => row.role === "tempo_accessory");
    if (hasTempo && normalMains.length === 0) {
      errors.push(`tempo accessory cannot replace normal_main for ${key}`);
    }
  }

  const week10Rows = plan.rows.filter((row) => row.week === 10);
  if (plan.version.toLowerCase().includes("week10") || week10Rows.length > 0) {
    for (const requiredDay of ["Day1", "Day2", "Day3"]) {
      const rows = week10Rows.filter(
        (row) => row.day.toLowerCase() === requiredDay.toLowerCase(),
      );
      if (rows.length === 0) {
        errors.push(`Week10 ${requiredDay} rows are required`);
        continue;
      }
      if (
        !rows.some(
          (row) =>
            row.role === "normal_main" &&
            row.required_optional === "required",
        )
      ) {
        errors.push(`Week10 ${requiredDay} required normal_main is missing`);
      }
    }
  }

  if (plan.rows.some((row) => !row.full_body_role)) warnings.push("some rows do not declare full_body_role");
  return { ok: errors.length === 0, plan, errors, warnings };
}

export function getSupervisorRowsForDay(plan: SupervisorProgramPlanV8 | null, week: number | null | undefined, day: string | null | undefined): SupervisorProgramRowV8[] {
  if (!plan || !week || !day) return [];
  return plan.rows
    .filter((row) => row.week === week && row.day.toLowerCase() === day.toLowerCase())
    .sort((a, b) => a.order - b.order);
}

export function resolveSupervisorRowForExercise(
  plan: SupervisorProgramPlanV8 | null,
  week: number | null | undefined,
  day: string | null | undefined,
  exerciseNameOrId: string | null | undefined,
): SupervisorProgramRowV8 | null {
  return (
    resolveSupervisorRowsForExercise(
      plan,
      week,
      day,
      exerciseNameOrId,
    )[0] ?? null
  );
}

export function resolveSupervisorRowsForExercise(
  plan: SupervisorProgramPlanV8 | null,
  week: number | null | undefined,
  day: string | null | undefined,
  exerciseNameOrId: string | null | undefined,
): SupervisorProgramRowV8[] {
  const target = normalizeId(exerciseNameOrId);
  if (!target) return [];
  const rows = getSupervisorRowsForDay(plan, week, day);
  const exactRows = rows.filter(
    (row) =>
      row.exercise_id === target || normalizeId(row.display_name) === target,
  );
  if (exactRows.length > 0) return exactRows;
  return rows.filter((row) => {
    const display = normalizeId(row.display_name);
    return Boolean(
      display && (target.includes(display) || display.includes(target)),
    );
  });
}

export function buildPlannedNextSetFromSupervisorRow(row: SupervisorProgramRowV8 | null) {
  if (
    !row ||
    row.load_kg == null ||
    row.load_kg <= 0 ||
    row.reps == null ||
    row.reps <= 0
  ) {
    return null;
  }
  return {
    loadKg: row.load_kg,
    reps: row.reps,
    remainingSets: row.sets,
    rpe: row.rpe_target,
    rowId: row.row_id,
    source: "applied_supervisor_row" as const,
  };
}

export function diffSupervisorProgramPlans(previous: SupervisorProgramPlanV8 | null, next: SupervisorProgramPlanV8): SupervisorProgramDiff {
  const previousRows = new Map((previous?.rows ?? []).map((row) => [row.row_id, row]));
  const nextRows = new Map(next.rows.map((row) => [row.row_id, row]));
  const added = [...nextRows.keys()].filter((id) => !previousRows.has(id));
  const removed = [...previousRows.keys()].filter((id) => !nextRows.has(id));
  const changed = [...nextRows.entries()]
    .filter(([id, row]) => previousRows.has(id) && stableStringify(previousRows.get(id)) !== stableStringify(row))
    .map(([id]) => id);
  return {
    same_version: previous?.version === next.version,
    same_checksum: previous?.checksum === next.checksum,
    added_row_ids: added,
    removed_row_ids: removed,
    changed_row_ids: changed,
    summary: `version ${previous?.version ?? "none"} -> ${next.version}; +${added.length} / -${removed.length} / changed ${changed.length}`,
  };
}

export function isHeavyExposureBlockedByPain(
  row: SupervisorProgramRowV8,
  painScore: number | null | undefined,
): boolean {
  return row.role === "heavy_exposure_single" && typeof painScore === "number" && painScore > 0;
}
