import * as Linking from "expo-linking";

import {
  REPVELO_BREATH_SCHEDULE_SCHEMA,
  readBreathForgeSharedHistory,
  writeRepVeloBreathSchedule,
  type BreathForgeSharedHistory,
  type RepVeloBreathSchedule,
} from "../native/BreathForgeAppGroupModule";

const JST_DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const JST_WEEKDAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Tokyo",
  weekday: "short",
});

export type BreathForgeScheduleInput = {
  repVeloSessionID: string;
  readinessWeekDay: string;
  state: RepVeloBreathSchedule["state"];
  programPlanID?: string | null;
  programPlanVersion?: string | null;
};

export function jstDateID(date = new Date()): string {
  const parts = JST_DATE_FORMATTER.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return year && month && day ? `${year}-${month}-${day}` : "1970-01-01";
}

export function jstWeekStartDateID(now = new Date()): string {
  const weekday = JST_WEEKDAY_FORMATTER.format(now);
  const offsetFromMonday: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const offset = offsetFromMonday[weekday] ?? 0;
  const [year, month, day] = jstDateID(now).split("-").map(Number);
  const utcMidnight = new Date(Date.UTC(year, month - 1, day - offset));
  return utcMidnight.toISOString().slice(0, 10);
}

export function completedBreathSessionsThisWeek(
  history: BreathForgeSharedHistory | null,
  now = new Date(),
): number {
  if (!history) return 0;
  const weekStart = jstWeekStartDateID(now);
  return history.sessions.filter(
    (session) =>
      session.completed_breaths > 0 &&
      jstDateID(new Date(session.started_at)) >= weekStart,
  ).length;
}

export function programDayFromReadiness(value: string): "Day1" | "Day2" | "Day3" | null {
  const match = value.match(/day\s*([1-3])\b/i);
  return match ? (`Day${match[1]}` as "Day1" | "Day2" | "Day3") : null;
}

export function buildBreathSchedule(
  input: BreathForgeScheduleInput,
  now = new Date(),
): RepVeloBreathSchedule | null {
  const programDay = programDayFromReadiness(input.readinessWeekDay);
  const sessionID = input.repVeloSessionID.trim();
  if (!programDay || !sessionID) return null;
  return {
    schema: REPVELO_BREATH_SCHEDULE_SCHEMA,
    generated_at: now.toISOString(),
    jst_date: jstDateID(now),
    repvelo_session_id: sessionID,
    program_day: programDay,
    state: input.state,
    program_plan_id: input.programPlanID?.trim() || null,
    program_plan_version: input.programPlanVersion?.trim() || null,
  };
}

export async function publishBreathSchedule(
  input: BreathForgeScheduleInput,
): Promise<RepVeloBreathSchedule | null> {
  const schedule = buildBreathSchedule(input);
  if (!schedule) return null;
  try {
    const wrote = await writeRepVeloBreathSchedule(schedule);
    return wrote ? schedule : null;
  } catch {
    return null;
  }
}

export async function openBreathForgeWarmup(
  input: Omit<BreathForgeScheduleInput, "state">,
): Promise<boolean> {
  const schedule = await publishBreathSchedule({ ...input, state: "selected" });
  if (!schedule) return false;
  const url = `breathforge30://session/warmup?repveloSessionId=${encodeURIComponent(schedule.repvelo_session_id)}`;
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) return false;
  await Linking.openURL(url);
  return true;
}

export async function openBreathForgeHome(): Promise<boolean> {
  const url = "breathforge30://";
  const canOpen = await Linking.canOpenURL(url);
  if (!canOpen) return false;
  await Linking.openURL(url);
  return true;
}

export async function loadBreathForgeHistory(): Promise<BreathForgeSharedHistory | null> {
  try {
    return await readBreathForgeSharedHistory();
  } catch {
    return null;
  }
}
