import AsyncStorage from "@react-native-async-storage/async-storage";

import { loadAppSettings } from "./AppSettingsService";
import {
  diffSupervisorProgramPlans,
  validateSupervisorProgramPlan,
  type SupervisorProgramDiff,
  type SupervisorProgramPlanV8,
  type SupervisorProgramValidationResult,
} from "../utils/SupervisorProgramPlan";
import { buildRepVeloCoachCurrentPlanUrl } from "../utils/LiveShareEndpoint";

const APPLIED_KEY = "@repvelocoach.supervisor_program_plan.applied.v8";
const STAGED_KEY = "@repvelocoach.supervisor_program_plan.staged.v8";
const PREVIOUS_KEY = "@repvelocoach.supervisor_program_plan.previous.v8";
const FETCH_TIMEOUT_MS = 8000;
const FALLBACK_STALE_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

export type SupervisorProgramPlanState = {
  applied: SupervisorProgramPlanV8 | null;
  staged: SupervisorProgramPlanV8 | null;
  previous: SupervisorProgramPlanV8 | null;
  is_stale: boolean;
  stale_reason: string | null;
};

export type SupervisorProgramFetchResult = {
  validation: SupervisorProgramValidationResult;
  diff: SupervisorProgramDiff | null;
  idempotent: boolean;
};

export type SupervisorProgramAutoSyncResult =
  | { status: "applied"; plan: SupervisorProgramPlanV8 }
  | { status: "unchanged"; plan: SupervisorProgramPlanV8 | null };

export type SupervisorProgramPlanExecutionState = {
  executable: boolean;
  is_stale: boolean;
  stale_reason: string | null;
  effective_from: string | null;
  valid_until: string | null;
};

const JST_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

const formatJstDateKey = (date: Date): string | null => {
  const parts = JST_DATE_FORMATTER.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : null;
};

const toJstDateKey = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (DATE_ONLY_RE.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (!Number.isFinite(parsed.getTime())) return null;
  return formatJstDateKey(parsed);
};

const nowJstDateKey = (nowMs: number): string | null => {
  if (!Number.isFinite(nowMs)) return null;
  return formatJstDateKey(new Date(nowMs));
};

export function getNextJstDateBoundaryMs(nowMs = Date.now()): number | null {
  const today = nowJstDateKey(nowMs);
  if (!today) return null;
  const [year, month, day] = today.split("-").map((value) => Number.parseInt(value, 10));
  if (![year, month, day].every(Number.isFinite)) return null;
  return Date.UTC(year, month - 1, day + 1, -9, 0, 0, 0);
}

export function getDelayUntilNextJstDateBoundaryMs(nowMs = Date.now()): number {
  const boundaryMs = getNextJstDateBoundaryMs(nowMs);
  if (boundaryMs == null) return 60_000;
  return Math.max(1_000, boundaryMs - nowMs + 50);
}

const parsePlan = (stored: string | null): SupervisorProgramPlanV8 | null => {
  if (!stored) return null;
  try {
    const validation = validateSupervisorProgramPlan(JSON.parse(stored));
    return validation.ok ? validation.plan : null;
  } catch {
    return null;
  }
};

async function readPlan(key: string): Promise<SupervisorProgramPlanV8 | null> {
  return parsePlan(await AsyncStorage.getItem(key));
}

async function writePlan(key: string, plan: SupervisorProgramPlanV8 | null): Promise<void> {
  if (!plan) {
    await AsyncStorage.removeItem(key);
    return;
  }
  await AsyncStorage.setItem(key, JSON.stringify(plan));
}

export function getSupervisorProgramPlanExecutionState(
  applied: SupervisorProgramPlanV8 | null,
  nowMs = Date.now(),
): SupervisorProgramPlanExecutionState {
  if (!applied) {
    return {
      executable: false,
      is_stale: true,
      stale_reason: "監督メニュー未適用",
      effective_from: null,
      valid_until: null,
    };
  }
  const today = nowJstDateKey(nowMs);
  if (!today) {
    return {
      executable: false,
      is_stale: true,
      stale_reason: "現在日時が不正です",
      effective_from: applied.effective_from,
      valid_until: applied.valid_until ?? null,
    };
  }
  const effectiveFrom = toJstDateKey(applied.effective_from);
  if (!effectiveFrom) {
    return {
      executable: false,
      is_stale: true,
      stale_reason: "監督メニューの開始日が不正です",
      effective_from: applied.effective_from,
      valid_until: applied.valid_until ?? null,
    };
  }
  if (today < effectiveFrom) {
    return {
      executable: false,
      is_stale: true,
      stale_reason: "監督メニューの開始日前です",
      effective_from: applied.effective_from,
      valid_until: applied.valid_until ?? null,
    };
  }
  if (applied.valid_until) {
    const validUntil = toJstDateKey(applied.valid_until);
    if (!validUntil) {
      return {
        executable: false,
        is_stale: true,
        stale_reason: "監督メニューの有効期限が不正です",
        effective_from: applied.effective_from,
        valid_until: applied.valid_until ?? null,
      };
    }
    if (today > validUntil) {
      return {
        executable: false,
        is_stale: true,
        stale_reason: "監督メニューの有効期限を過ぎています",
        effective_from: applied.effective_from,
        valid_until: applied.valid_until ?? null,
      };
    }
    return {
      executable: true,
      is_stale: false,
      stale_reason: null,
      effective_from: applied.effective_from,
      valid_until: applied.valid_until ?? null,
    };
  }
  const updatedAt = applied.updated_at ? new Date(applied.updated_at).getTime() : NaN;
  if (!Number.isFinite(updatedAt)) {
    return {
      executable: false,
      is_stale: true,
      stale_reason: "監督メニューの更新日時が不正です",
      effective_from: applied.effective_from,
      valid_until: applied.valid_until ?? null,
    };
  }
  const staleReason =
    nowMs - updatedAt > FALLBACK_STALE_AFTER_MS
      ? "監督メニューが古くなっています"
      : null;
  return {
    executable: staleReason == null,
    is_stale: staleReason != null,
    stale_reason: staleReason,
    effective_from: applied.effective_from,
    valid_until: applied.valid_until ?? null,
  };
}

class SupervisorProgramPlanService {
  async getState(): Promise<SupervisorProgramPlanState> {
    const [applied, staged, previous] = await Promise.all([
      readPlan(APPLIED_KEY),
      readPlan(STAGED_KEY),
      readPlan(PREVIOUS_KEY),
    ]);
    const executionState = getSupervisorProgramPlanExecutionState(applied);
    return {
      applied,
      staged,
      previous,
      is_stale: executionState.is_stale,
      stale_reason: executionState.stale_reason,
    };
  }

  async stagePlan(rawPlan: unknown): Promise<SupervisorProgramFetchResult> {
    const validation = validateSupervisorProgramPlan(rawPlan);
    if (!validation.ok || !validation.plan) {
      return { validation, diff: null, idempotent: false };
    }
    const state = await this.getState();
    const diff = diffSupervisorProgramPlans(state.applied, validation.plan);
    const idempotent =
      state.applied?.plan_id === validation.plan.plan_id &&
      state.applied?.version === validation.plan.version &&
      state.applied?.checksum === validation.plan.checksum;
    if (!idempotent) {
      await writePlan(STAGED_KEY, validation.plan);
    }
    return { validation, diff, idempotent };
  }

  async fetchAndStage(): Promise<SupervisorProgramFetchResult> {
    const settings = await loadAppSettings();
    if (!settings.enable_live_share) {
      throw new Error("設定 > 共有でLive ShareをONにしてください。");
    }
    const endpoint = buildRepVeloCoachCurrentPlanUrl(settings.live_share_url);
    if (!endpoint) {
      throw new Error("Mac / MCPの監督メニューURLが設定されていません。");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(settings.live_share_token.trim()
            ? { "X-RepVelo-Sync-Token": settings.live_share_token.trim() }
            : {}),
        },
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`監督メニュー取得 HTTP ${response.status}`);
      return this.stagePlan(await response.json());
    } finally {
      clearTimeout(timeout);
    }
  }

  async syncCurrentPlanIfChanged(): Promise<SupervisorProgramAutoSyncResult> {
    const result = await this.fetchAndStage();
    if (!result.validation.ok || !result.validation.plan) {
      throw new Error(result.validation.errors.join("\n") || "監督メニューの検証に失敗しました。");
    }
    if (result.idempotent) {
      return { status: "unchanged", plan: (await this.getState()).applied };
    }
    return { status: "applied", plan: await this.applyStagedPlan() };
  }

  async applyStagedPlan(): Promise<SupervisorProgramPlanV8> {
    const staged = await readPlan(STAGED_KEY);
    if (!staged) throw new Error("適用できる取得済み監督メニューがありません。");
    const applied = await readPlan(APPLIED_KEY);
    if (applied && applied.checksum !== staged.checksum) {
      await writePlan(PREVIOUS_KEY, applied);
    }
    await writePlan(APPLIED_KEY, staged);
    await writePlan(STAGED_KEY, null);
    return staged;
  }

  async rollbackToPreviousPlan(): Promise<SupervisorProgramPlanV8> {
    const previous = await readPlan(PREVIOUS_KEY);
    if (!previous) throw new Error("戻せる前版がありません。");
    const applied = await readPlan(APPLIED_KEY);
    await writePlan(APPLIED_KEY, previous);
    await writePlan(PREVIOUS_KEY, applied);
    return previous;
  }
}

export default new SupervisorProgramPlanService();
