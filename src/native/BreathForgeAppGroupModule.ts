import { NativeModules, Platform } from "react-native";

export const BREATHFORGE_HISTORY_SCHEMA = "breathforge.shared-history.v1" as const;
export const REPVELO_BREATH_SCHEDULE_SCHEMA = "repvelo.breath-schedule.v1" as const;

export type BreathForgeSharedSession = {
  id: string;
  started_at: string;
  mode: "training" | "warmUp";
  quarter_step: number;
  estimated_pressure_cmh2o: number;
  completed_breaths: number;
  rpe: number | null;
  form_quality: string | null;
  completion_state: "complete" | "partial";
  repvelo_session_id: string | null;
};

export type BreathForgeSharedHistory = {
  schema: typeof BREATHFORGE_HISTORY_SCHEMA;
  updated_at: string;
  sessions: BreathForgeSharedSession[];
};

export type RepVeloBreathSchedule = {
  schema: typeof REPVELO_BREATH_SCHEDULE_SCHEMA;
  generated_at: string;
  jst_date: string;
  repvelo_session_id: string;
  program_day: "Day1" | "Day2" | "Day3";
  state: "selected" | "started" | "completed";
  program_plan_id: string | null;
  program_plan_version: string | null;
};

type NativeBreathForgeAppGroupModule = {
  readHistory: () => Promise<string | null>;
  writeSchedule: (json: string) => Promise<boolean>;
};

const nativeModule = NativeModules.BreathForgeAppGroupModule as
  | NativeBreathForgeAppGroupModule
  | undefined;

function isSharedSession(value: unknown): value is BreathForgeSharedSession {
  if (typeof value !== "object" || value == null) return false;
  const session = value as Record<string, unknown>;
  return (
    typeof session.id === "string" &&
    typeof session.started_at === "string" &&
    (session.mode === "training" || session.mode === "warmUp") &&
    typeof session.quarter_step === "number" &&
    Number.isInteger(session.quarter_step) &&
    session.quarter_step >= 0 &&
    session.quarter_step <= 40 &&
    typeof session.estimated_pressure_cmh2o === "number" &&
    typeof session.completed_breaths === "number" &&
    (session.completion_state === "complete" || session.completion_state === "partial") &&
    !("symptoms" in session) &&
    !("notes" in session)
  );
}

export async function readBreathForgeSharedHistory(): Promise<BreathForgeSharedHistory | null> {
  if (Platform.OS !== "ios" || !nativeModule) return null;
  const raw = await nativeModule.readHistory();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<BreathForgeSharedHistory>;
    if (
      parsed.schema !== BREATHFORGE_HISTORY_SCHEMA ||
      typeof parsed.updated_at !== "string" ||
      !Array.isArray(parsed.sessions) ||
      !parsed.sessions.every(isSharedSession)
    ) {
      return null;
    }
    return parsed as BreathForgeSharedHistory;
  } catch {
    return null;
  }
}

export async function writeRepVeloBreathSchedule(
  schedule: RepVeloBreathSchedule,
): Promise<boolean> {
  if (Platform.OS !== "ios" || !nativeModule) return false;
  return nativeModule.writeSchedule(JSON.stringify(schedule));
}
