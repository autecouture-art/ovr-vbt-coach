import type { SessionData, SessionReadinessData, SetData } from "../types/index";
import type { SupervisorProgramPlanV8 } from "./SupervisorProgramPlan";
import { isSameRecordedLoadKg } from "./LoadPrecision";

export const DEFAULT_ACCESSORY_SET_LIMIT = 3;

export type MainLiftCode = "SQ" | "BP" | "DL";

export interface SupervisorPlanMetadata {
  supervisor_plan_version: string;
  supervisor_plan_updated_at: string;
  supervisor_plan_source: string;
  supervisor_plan_checksum?: string | null;
  planned_row_id?: string | null;
}

export interface SupervisorPlanGuardResult {
  status: "applied" | "stale_or_missing";
  required_version: string;
  actual_version: string | null;
  message: string | null;
}

export interface PainEvent {
  captured_at?: string | null;
  pain_score?: number | null;
  pain_area?: string | null;
  resolved?: boolean | null;
  zero_is_resolved?: boolean | null;
  pain_status?: "active" | "resolved" | string | null;
  source?: string | null;
}

export interface StickyPainState {
  status: "active" | "resolved" | "unknown";
  pain_score: number | null;
  pain_area: string | null;
  source: string | null;
  captured_at: string | null;
  blocked_heavy_exposure: boolean;
}

export interface HeavyExposureSingle {
  lift: MainLiftCode;
  loadKg: number;
  purpose: string;
  rpeTarget: string;
  rule: string;
  status?: "available" | "blocked_by_supervisor_plan";
  blocked_by_supervisor_plan?: boolean;
  block_reason?: string | null;
}

export interface SupervisorPlanBlockInput {
  heavyExposureSingle: HeavyExposureSingle | null;
  painState?: StickyPainState | null;
  blockedLoadsKg?: Partial<Record<MainLiftCode, number[]>>;
  planVersion?: string | null;
}

export interface PlannedRoleInput {
  exerciseId?: string | null;
  exerciseName?: string | null;
  plannedRowId?: string | null;
  plannedRowExerciseId?: string | null;
  dayRole?: string | null;
  mainLift?: MainLiftCode | null;
}

export interface PlannedRoleResolution {
  requiredOptional: "required_main" | "optional_accessory" | "unclassified";
  roleResolutionSource:
    | "planned_row_exact_match"
    | "planned_row_day_role"
    | "planned_row_missing_alias_ignored"
    | "computed_optional_accessory"
    | "unclassified"
    | "role_conflict";
  roleConflict: string | null;
}

export interface VelocityProfileStatus {
  exercise_id: string | null;
  history_count: number;
  status: "baseline" | "candidate_pr" | "confirmed_pr";
  pr_status: "baseline" | "candidate_pr" | "confirmed_pr";
  uses_exercise_specific_profile: boolean;
}

export interface NormalizedRpe {
  value: number | null;
  status: "known" | "unknown";
}

export interface TrainingDayAggregate {
  training_day_id: string;
  timezone: "Asia/Tokyo";
  session_ids: string[];
  main_lifts: MainLiftCode[];
  total_sets: number;
  accessory_sets: number;
  total_volume_kg: number;
  elapsed_seconds: number | null;
  accessory_set_limit: number;
  accessory_sets_remaining: number;
  session_stop_recommended: boolean;
  blocked_next_exercise_candidates: string[];
  manual_session_ids: string[];
  manual_set_count: number;
  session_sources: ("manual" | "vbt" | "unknown")[];
}

export interface TrainingDayAggregateOptions {
  timezone?: "Asia/Tokyo";
  accessorySetLimit?: number;
  mainLift?: MainLiftCode | null;
  blockedCandidateNames?: string[];
}

export interface AiConsultationExport {
  id: string;
  session_id: string;
  created_at: string;
  packet_type: string | null;
  source: "session_notes_marker" | "export_placeholder";
  prompt_snapshot: string | null;
  response: string | null;
  adopted_decision: string | null;
}

const norm = (value: string | null | undefined) =>
  (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export function buildSupervisorPlanMetadataFromProgramPlan(
  appliedPlan: Pick<
    SupervisorProgramPlanV8,
    "plan_id" | "version" | "updated_at" | "checksum" | "source"
  > | null | undefined,
  plannedRowId?: string | null,
): SupervisorPlanMetadata {
  if (!appliedPlan) {
    return {
      supervisor_plan_version: "missing",
      supervisor_plan_updated_at: "missing",
      supervisor_plan_source: "missing_applied_supervisor_program_plan",
      supervisor_plan_checksum: null,
      planned_row_id: plannedRowId ?? null,
    };
  }
  return {
    supervisor_plan_version: appliedPlan.version,
    supervisor_plan_updated_at: appliedPlan.updated_at,
    supervisor_plan_source: appliedPlan.source ?? appliedPlan.plan_id,
    supervisor_plan_checksum: appliedPlan.checksum,
    planned_row_id: plannedRowId ?? null,
  };
}

export function evaluateSupervisorPlanGuard(
  metadata?: Partial<SupervisorPlanMetadata> | null,
): SupervisorPlanGuardResult {
  const actualVersion = metadata?.supervisor_plan_version?.trim() || null;
  if (actualVersion && actualVersion !== "missing") {
    return {
      status: "applied",
      required_version: actualVersion,
      actual_version: actualVersion,
      message: null,
    };
  }
  return {
    status: "stale_or_missing",
    required_version: "applied_supervisor_program_plan",
    actual_version: actualVersion,
    message: `適用済み監督メニューがありません。actual=${actualVersion ?? "missing"}`,
  };
}

export function getJstTrainingDayId(timestamp?: string | null): string {
  const base = timestamp ? new Date(timestamp) : new Date();
  const validDate = Number.isFinite(base.getTime()) ? base : new Date();
  return new Date(validDate.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export function buildStickyPainState(events: PainEvent[]): StickyPainState {
  const sorted = [...events].sort((a, b) => {
    const aTime = a.captured_at ? new Date(a.captured_at).getTime() : 0;
    const bTime = b.captured_at ? new Date(b.captured_at).getTime() : 0;
    return aTime - bTime;
  });
  let state: StickyPainState = {
    status: "unknown",
    pain_score: null,
    pain_area: null,
    source: null,
    captured_at: null,
    blocked_heavy_exposure: false,
  };

  for (const event of sorted) {
    const zeroResolved =
      event.zero_is_resolved === true &&
      isFiniteNumber(event.pain_score) &&
      event.pain_score <= 0;
    const explicitResolved =
      event.resolved === true || event.pain_status === "resolved" || zeroResolved;
    if (explicitResolved) {
      state = {
        status: "resolved",
        pain_score: null,
        pain_area: null,
        source: event.source ?? state.source,
        captured_at: event.captured_at ?? state.captured_at,
        blocked_heavy_exposure: false,
      };
      continue;
    }

    if (isFiniteNumber(event.pain_score) && event.pain_score > 0) {
      state = {
        status: "active",
        pain_score: event.pain_score,
        pain_area: event.pain_area ?? state.pain_area,
        source: event.source ?? state.source,
        captured_at: event.captured_at ?? state.captured_at,
        blocked_heavy_exposure: true,
      };
    }
  }

  return state;
}

export function readinessToPainEvent(
  readiness: SessionReadinessData | null | undefined,
  fallbackCapturedAt?: string | null,
  source?: string | null,
  zeroIsResolved: boolean = false,
): PainEvent | null {
  if (!readiness) return null;
  return {
    captured_at: readiness.captured_at ?? fallbackCapturedAt ?? null,
    pain_score: readiness.pain_score,
    pain_area: readiness.pain_area,
    zero_is_resolved: zeroIsResolved,
    source,
  };
}

export function applyHeavyExposureSupervisorBlock(
  input: SupervisorPlanBlockInput,
): HeavyExposureSingle | null {
  const candidate = input.heavyExposureSingle;
  if (!candidate) return null;
  const blockedLoads = input.blockedLoadsKg?.[candidate.lift] ?? [];
  const painBlocks =
    input.painState?.status === "active" &&
    (input.painState.pain_score ?? 0) > 0 &&
    input.painState.blocked_heavy_exposure;
  const planBlocksLoad = blockedLoads.some(
    (load) => isSameRecordedLoadKg(load, candidate.loadKg),
  );

  if (painBlocks || planBlocksLoad) {
    const area = input.painState?.pain_area ?? "症状あり";
    const score = input.painState?.pain_score ?? "-";
    return {
      ...candidate,
      status: "blocked_by_supervisor_plan",
      blocked_by_supervisor_plan: true,
      block_reason: `最新監督計画と衝突: ${area} ${score}/10。heavy exposureは実施提案しない`,
    };
  }

  return {
    ...candidate,
    status: "available",
    blocked_by_supervisor_plan: false,
    block_reason: null,
  };
}

export function resolvePlannedExerciseRole(
  input: PlannedRoleInput,
): PlannedRoleResolution {
  const mainLift = input.mainLift;
  if (!mainLift || !input.exerciseName) {
    return {
      requiredOptional: "unclassified",
      roleResolutionSource: "unclassified",
      roleConflict: null,
    };
  }

  const dayRole = input.dayRole?.trim() ?? null;
  const expectedRolePrefix = `${mainLift.toLowerCase()}_`;
  if (dayRole && !dayRole.toLowerCase().startsWith(expectedRolePrefix)) {
    return {
      requiredOptional: "unclassified",
      roleResolutionSource: "role_conflict",
      roleConflict: `mainLift=${mainLift} と dayRole=${dayRole} が矛盾`,
    };
  }

  const exerciseId = norm(input.exerciseId ?? input.exerciseName);
  const plannedExerciseId = norm(input.plannedRowExerciseId);
  const hasPlannedRow = Boolean(input.plannedRowId?.trim());
  const isExactPlannedExercise =
    hasPlannedRow && plannedExerciseId.length > 0 && exerciseId === plannedExerciseId;

  if (isExactPlannedExercise && dayRole?.includes("main")) {
    return {
      requiredOptional: "required_main",
      roleResolutionSource: "planned_row_exact_match",
      roleConflict: null,
    };
  }
  if (hasPlannedRow && dayRole?.includes("main") && !plannedExerciseId) {
    return {
      requiredOptional: "required_main",
      roleResolutionSource: "planned_row_day_role",
      roleConflict: null,
    };
  }
  if (!hasPlannedRow && nameIsExactCompetitionMain(input.exerciseName, mainLift)) {
    return {
      requiredOptional: "required_main",
      roleResolutionSource: "planned_row_day_role",
      roleConflict: null,
    };
  }
  if (!hasPlannedRow && nameLooksLikeMainLiftAlias(input.exerciseName, mainLift)) {
    return {
      requiredOptional: "optional_accessory",
      roleResolutionSource: "planned_row_missing_alias_ignored",
      roleConflict: null,
    };
  }

  return {
    requiredOptional: "optional_accessory",
    roleResolutionSource: "computed_optional_accessory",
    roleConflict: null,
  };
}

export function nameIsExactCompetitionMain(
  exerciseName: string | null | undefined,
  mainLift: MainLiftCode,
): boolean {
  const name = norm(exerciseName);
  if (mainLift === "SQ") return name === "squat" || name === "back_squat";
  if (mainLift === "BP") return name === "bench_press" || name === "competition_bench_press";
  if (mainLift === "DL") return name === "deadlift" || name === "sumo_deadlift" || name === "conventional_deadlift";
  return false;
}

export function nameLooksLikeMainLiftAlias(
  exerciseName: string | null | undefined,
  mainLift: MainLiftCode,
): boolean {
  const name = norm(exerciseName);
  if (mainLift === "SQ") return name.includes("squat");
  if (mainLift === "BP") return name.includes("bench") || name.includes("cgbp");
  if (mainLift === "DL") return name.includes("deadlift");
  return false;
}

export function resolveVelocityProfileStatus(args: {
  exerciseId?: string | null;
  historyCount: number;
}): VelocityProfileStatus {
  const historyCount = Math.max(0, Math.floor(args.historyCount || 0));
  if (historyCount === 0) {
    return {
      exercise_id: args.exerciseId ?? null,
      history_count: 0,
      status: "baseline",
      pr_status: "baseline",
      uses_exercise_specific_profile: true,
    };
  }
  return {
    exercise_id: args.exerciseId ?? null,
    history_count: historyCount,
    status: historyCount >= 3 ? "confirmed_pr" : "candidate_pr",
    pr_status: historyCount >= 3 ? "confirmed_pr" : "candidate_pr",
    uses_exercise_specific_profile: true,
  };
}

export function normalizeRpe(value: number | null | undefined): NormalizedRpe {
  return isFiniteNumber(value)
    ? { value, status: "known" }
    : { value: null, status: "unknown" };
}

const setTime = (set: SetData) =>
  set.end_timestamp ?? set.timestamp ?? set.start_timestamp ?? null;

const isAccessorySet = (
  set: SetData,
  mainLifts?: MainLiftCode | MainLiftCode[] | null,
) => {
  const lifts = Array.isArray(mainLifts)
    ? mainLifts
    : mainLifts
      ? [mainLifts]
      : [];
  const name = norm(set.lift);
  const matchesMain = lifts.some((mainLift) => {
    if (mainLift === "SQ") {
      return /^low_bar_squat$|^squat$|^back_squat$/.test(name);
    }
    if (mainLift === "BP") {
      return /^bench_press$|^competition_bench_press$/.test(name);
    }
    if (mainLift === "DL") {
      return /^sumo_deadlift$|^deadlift$|^conventional_deadlift$/.test(name);
    }
    return false;
  });
  if (matchesMain) return false;

  if (lifts.length === 0) {
    return !(
      /^low_bar_squat$|^squat$|^back_squat$/.test(name) ||
      /^bench_press$|^competition_bench_press$/.test(name) ||
      /^sumo_deadlift$|^deadlift$|^conventional_deadlift$/.test(name)
    );
  }
  return true;
};

const mergeMainLift = (
  values: MainLiftCode[],
  value?: MainLiftCode | null,
) => {
  if (value && !values.includes(value)) values.push(value);
};

export function buildTrainingDayAggregates(
  sessions: SessionData[],
  sets: SetData[],
  options: TrainingDayAggregateOptions = {},
): TrainingDayAggregate[] {
  const accessorySetLimit =
    options.accessorySetLimit ?? DEFAULT_ACCESSORY_SET_LIMIT;
  const blockedCandidateNames = options.blockedCandidateNames ?? [];
  const sessionDayMap = new Map<string, string>();
  const mainLiftsByDay = new Map<string, MainLiftCode[]>();
  for (const session of sessions) {
    const timestamp = session.start_timestamp ?? session.date;
    const dayId = getJstTrainingDayId(timestamp);
    sessionDayMap.set(session.session_id, dayId);
    const lifts = mainLiftsByDay.get(dayId) ?? [];
    mergeMainLift(lifts, session.readiness?.main_lift ?? options.mainLift ?? null);
    mainLiftsByDay.set(dayId, lifts);
  }

  const grouped = new Map<string, TrainingDayAggregate & {
    firstMs: number | null;
    lastMs: number | null;
  }>();
  for (const session of sessions) {
    const dayId =
      sessionDayMap.get(session.session_id) ??
      getJstTrainingDayId(session.start_timestamp ?? session.date);
    if (!grouped.has(dayId)) {
      grouped.set(dayId, {
        training_day_id: dayId,
        timezone: "Asia/Tokyo",
        session_ids: [],
        main_lifts: mainLiftsByDay.get(dayId) ?? [],
        total_sets: 0,
        accessory_sets: 0,
        total_volume_kg: 0,
        elapsed_seconds: null,
        accessory_set_limit: accessorySetLimit,
        accessory_sets_remaining: accessorySetLimit,
        session_stop_recommended: false,
        blocked_next_exercise_candidates: [],
        manual_session_ids: [],
        manual_set_count: 0,
        session_sources: [],
        firstMs: null,
        lastMs: null,
      });
    }
    grouped.get(dayId)?.session_ids.push(session.session_id);
  }

  for (const set of sets) {
    const dayId =
      sessionDayMap.get(set.session_id) ?? getJstTrainingDayId(setTime(set));
    const row =
      grouped.get(dayId) ??
      {
        training_day_id: dayId,
        timezone: "Asia/Tokyo" as const,
        session_ids: [set.session_id],
        main_lifts: mainLiftsByDay.get(dayId) ?? [],
        total_sets: 0,
        accessory_sets: 0,
        total_volume_kg: 0,
        elapsed_seconds: null,
        accessory_set_limit: accessorySetLimit,
        accessory_sets_remaining: accessorySetLimit,
        session_stop_recommended: false,
        blocked_next_exercise_candidates: [],
        manual_session_ids: [],
        manual_set_count: 0,
        session_sources: [],
        firstMs: null,
        lastMs: null,
      };

    row.total_sets += 1;
    const source = set.device_type === "manual" ? "manual" : set.device_type ? "vbt" : "unknown";
    if (!row.session_sources.includes(source)) row.session_sources.push(source);
    if (source === "manual") {
      row.manual_set_count += 1;
      if (!row.manual_session_ids.includes(set.session_id)) row.manual_session_ids.push(set.session_id);
    }
    if (isAccessorySet(set, row.main_lifts)) row.accessory_sets += 1;
    row.total_volume_kg += (set.load_kg || 0) * (set.reps || 0);
    for (const timestamp of [set.start_timestamp, set.end_timestamp, set.timestamp]) {
      if (!timestamp) continue;
      const ms = new Date(timestamp).getTime();
      if (!Number.isFinite(ms)) continue;
      row.firstMs = row.firstMs == null ? ms : Math.min(row.firstMs, ms);
      row.lastMs = row.lastMs == null ? ms : Math.max(row.lastMs, ms);
    }
    grouped.set(dayId, row);
  }

  return [...grouped.values()]
    .map((row) => {
      const remaining = Math.max(0, accessorySetLimit - row.accessory_sets);
      return {
        training_day_id: row.training_day_id,
        timezone: row.timezone,
        session_ids: [...new Set(row.session_ids)],
        main_lifts: [...new Set(row.main_lifts)],
        total_sets: row.total_sets,
        accessory_sets: row.accessory_sets,
        total_volume_kg: Math.round(row.total_volume_kg * 10) / 10,
        elapsed_seconds:
          row.firstMs != null && row.lastMs != null
            ? Math.max(0, Math.round((row.lastMs - row.firstMs) / 1000))
            : null,
        accessory_set_limit: accessorySetLimit,
        accessory_sets_remaining: remaining,
        session_stop_recommended: row.accessory_sets >= accessorySetLimit,
        blocked_next_exercise_candidates:
          row.accessory_sets >= accessorySetLimit ? blockedCandidateNames : [],
        manual_session_ids: [...new Set(row.manual_session_ids)],
        manual_set_count: row.manual_set_count,
        session_sources: row.session_sources,
      };
    })
    .sort((a, b) => a.training_day_id.localeCompare(b.training_day_id));
}

export function extractAiConsultationsFromSessions(
  sessions: SessionData[],
): AiConsultationExport[] {
  const rows: AiConsultationExport[] = [];
  for (const session of sessions) {
    const lines = (session.notes ?? "").split("\n");
    lines.forEach((line, index) => {
      const marker = "#AI_CONSULTATION_JSON:";
      if (!line.trim().startsWith(marker)) return;
      try {
        const parsed = JSON.parse(line.trim().slice(marker.length).trim()) as {
          id?: string;
          created_at?: string;
          packet_type?: string;
          prompt_snapshot?: string;
          response?: string;
          adopted_decision?: string;
        };
        rows.push({
          id: parsed.id ?? `${session.session_id}:ai:${index}`,
          session_id: session.session_id,
          created_at: parsed.created_at ?? session.end_timestamp ?? session.date,
          packet_type: parsed.packet_type ?? null,
          source: "session_notes_marker",
          prompt_snapshot:
            parsed.prompt_snapshot ??
            (parsed.packet_type ? `packet_type=${parsed.packet_type}` : null),
          response: parsed.response ?? null,
          adopted_decision: parsed.adopted_decision ?? null,
        });
      } catch {
        // Ignore malformed historical note markers and keep export resilient.
      }
    });
  }
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = `${row.session_id}:${row.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
