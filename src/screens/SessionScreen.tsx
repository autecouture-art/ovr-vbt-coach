/**
 * VBT Session Screen
 * Refactored to use useSessionLogic and trainingStore
 * UI is now a "Dumb Component" driven by global state
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  Suspense,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  AppState,
  Share,
  Modal,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as Sharing from "expo-sharing";
import { shallow } from "zustand/shallow";
import { useTrainingStore } from "@/src/store/trainingStore";
import { useSessionLogic } from "@/src/hooks/useSessionLogic";
import { ExerciseSelectModal } from "@/src/components/ExerciseSelectModal";
import PRNotification from "@/src/components/PRNotification";
import DatabaseService from "@/src/services/DatabaseService";
import BLEService from "@/src/services/BLEService";
import ExerciseService from "@/src/services/ExerciseService";
import SessionRecoveryService from "@/src/services/SessionRecoveryService";
import VideoRecordingService from "@/src/services/VideoRecordingService";
import LiveShareService from "@/src/services/LiveShareService";
import ImprovementFeedbackService from "@/src/services/ImprovementFeedbackService";
import {
  openBreathForgeWarmup,
  publishBreathSchedule,
} from "@/src/services/BreathForgeIntegrationService";
import SupervisorProgramPlanService, {
  getDelayUntilNextJstDateBoundaryMs,
  getSupervisorProgramPlanExecutionState,
  type SupervisorProgramPlanState,
} from "@/src/services/SupervisorProgramPlanService";
import CrashReportService, {
  type VBTScreenCrashContext,
} from "@/src/services/CrashReportService";
import { saveAppSettings } from "@/src/services/AppSettingsService";
import SessionDecisionService, {
  type NextSetPurpose,
  type SetTrendRow,
} from "@/src/services/SessionDecisionService";
import VBTGuideService from "@/src/services/VBTGuideService";
import { VBTLogic } from "@/src/services/VBTLogic";
import { RepDetailModal } from "@/src/components/RepDetailModal";
import { ImprovementFeedbackSheet } from "@/src/components/ImprovementFeedbackSheet";
import { SetEditModal } from "@/src/components/SetEditModal";
import { RepVelocityChart } from "@/src/components/RepVelocityChart";
import { ManualRepModal } from "@/src/components/ManualRepModal";
import { VelocityLossThresholdPicker } from "@/src/components/VelocityLossThresholdPicker";
import { Big3GearSelector } from "@/src/components/Big3GearSelector";
import SessionDashboard from "@/src/components/session/SessionDashboard";
import { calculateWarmupSteps, isBig3 } from "@/src/utils/WarmupLogic";
import {
  formatLoadKg,
  getExerciseCategoryLabel,
  getCanonicalExerciseSeed,
  getCanonicalExerciseName,
  isBig3Exercise,
} from "@/src/constants/exerciseCatalog";
import { resolveUserSelectedSessionLoad } from "@/src/utils/SessionLoadControl";
import {
  formatLoadKgTwoDecimals,
  isSameRecordedLoadKg,
  parseLoadKgInput,
} from "@/src/utils/LoadPrecision";
import { normalizeVelocityLossThreshold } from "@/src/utils/VelocityLossThreshold";
import {
  formatBig3GearSummary,
  parseBig3GearSelection,
  serializeBig3GearSelection,
  type Big3GearSelection,
} from "@/src/utils/Big3Gear";
import { GarageTheme } from "@/src/constants/garageTheme";
import { estimateRPEFromVelocityLoss } from "@/src/utils/RPECalculator";
import {
  formatVelocityLossTriplet,
  getVelocityLossForJudgement,
  stabilizeDaily1RMEstimate,
} from "@/src/utils/VBTCalculations";
import {
  buildAccessoryRMTargetContext,
  formatAccessoryTargetLoad,
  isAccessoryRmRepRange,
} from "@/src/utils/AccessoryRMTarget";
import {
  appendAiConsultationMarkerToNotes,
  buildConsultationId,
  buildSessionNotesWithReadiness,
  mergeSessionBodyWithLatestMarkers,
  removeSessionReadinessMarkers,
  removeSessionSystemMarkers,
  SESSION_READINESS_NOTE_PREFIX,
} from "@/src/utils/SessionNotes";
import {
  buildSupervisorPlanMetadataFromProgramPlan,
  buildTrainingDayAggregates,
  buildStickyPainState,
  evaluateSupervisorPlanGuard,
  getJstTrainingDayId,
  normalizeRpe,
  readinessToPainEvent,
  resolvePlannedExerciseRole,
  type TrainingDayAggregate,
  type PainEvent,
} from "@/src/utils/SupervisorPlanGuards";
import {
  buildPlannedNextSetFromSupervisorRow,
  getSupervisorRowsForDay,
  resolveSupervisorRowsForExercise,
  type SupervisorProgramRowV8,
} from "@/src/utils/SupervisorProgramPlan";
import {
  calculateRecoverySignal,
  getPeakHeartRate,
} from "@/src/utils/HeartRateUtils";
import {
  VelocityTooltip,
  VELOCITY_GLOSSARY,
} from "@/src/components/VelocityTooltip";
import {
  LVP_CHECKPOINTS,
  getAttemptPlan,
  getBlockWeekPlan,
  getFocusVelocityLossState,
  getPowerliftingProtocol,
  getReadinessDecision,
  getTopSingleTargetText,
  resolveVelocityLossThreshold,
} from "@/src/utils/PowerliftingVBTProtocol";
import { buildVelocityLossRepPRTarget } from "@/src/utils/VelocityLossRepPR";
import {
  buildLiveSetProfileTarget,
  type IndividualProfileMode,
} from "@/src/utils/IndividualVBTProfile";
import {
  estimateSetMuscleStress,
  summarizeMuscleStress,
  type MuscleGroup,
} from "@/src/utils/MuscleStressModel";
import type {
  Exercise,
  AppSettings,
  FormVideoRecord,
  LVPData,
  PRRecord,
  RepData,
  SetData,
  SetType,
  SessionData,
  SessionReadinessData,
} from "@/src/types/index";

const getDisplayPower = (
  reportedPower: number | null | undefined,
  velocity: number | null | undefined,
  loadKg: number,
): number | null => {
  if (reportedPower != null && reportedPower > 0) {
    return reportedPower;
  }
  if (velocity != null && velocity > 0 && loadKg > 0) {
    return VBTLogic.calculatePower(loadKg, velocity);
  }
  return null;
};

const formatDurationSeconds = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const restSeconds = safeSeconds % 60;
  return `${minutes}:${restSeconds.toString().padStart(2, "0")}`;
};

const formatClockTime = (timestamp?: string | null): string | null => {
  if (!timestamp) return null;
  const time = new Date(timestamp);
  if (Number.isNaN(time.getTime())) return null;
  return time.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatClockTimeWithSeconds = (
  timestamp?: string | null,
): string | null => {
  if (!timestamp) return null;
  const time = new Date(timestamp);
  if (Number.isNaN(time.getTime())) return null;
  return time.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

const formatDateTimeWithSeconds = (date: Date): string =>
  date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

const formatVLTrendTriplet = (set: {
  vlAvg?: number | null;
  vlLast?: number | null;
  vlMin?: number | null;
  vl?: number | null;
}): string => {
  const format = (value: number | null | undefined) =>
    value == null || !Number.isFinite(value) ? "-" : value.toFixed(1);
  return `${format(set.vlAvg ?? set.vl)} / ${format(set.vlLast ?? set.vl)} / ${format(set.vlMin ?? set.vl)}%`;
};

const SESSION_LIGHTWEIGHT_SET_LIMIT = 5;
const SESSION_RECOVERY_MAX_AGE_MS = 18 * 60 * 60 * 1000;
const CHATGPT_APP_URL = "chatgpt://";
const CHATGPT_WEB_URL = "https://chatgpt.com/";
const breathForgeSelectionID = (weekDay: string) =>
  `repvelo-selection-${getJstTrainingDayId(new Date().toISOString())}-${weekDay
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}`;
const NEXT_SET_PURPOSE_OPTIONS: {
  value: NextSetPurpose;
  label: string;
  shortLabel: string;
}[] = [
  { value: "menu_completion", label: "メニュー完遂優先", shortLabel: "完遂" },
  {
    value: "form_consistency",
    label: "フォーム固定優先",
    shortLabel: "フォーム",
  },
  { value: "lvp_building", label: "LVP作成優先", shortLabel: "LVP" },
  {
    value: "hypertrophy_volume",
    label: "筋肥大ボリューム優先",
    shortLabel: "量",
  },
];

const MAIN_LIFT_OPTIONS: {
  value: NonNullable<SessionReadinessData["main_lift"]>;
  label: string;
  canonicalLift: string;
}[] = [
  { value: "SQ", label: "SQ", canonicalLift: "Squat" },
  { value: "BP", label: "BP", canonicalLift: "Bench Press" },
  { value: "DL", label: "DL", canonicalLift: "Deadlift" },
];

const SLEEP_QUALITY_OPTIONS: {
  value: NonNullable<SessionReadinessData["sleep_quality"]>;
  label: string;
}[] = [
  { value: "good", label: "良い" },
  { value: "ok", label: "普通" },
  { value: "bad", label: "悪い" },
];

const RECOVERY_STATUS_OPTIONS: {
  value: NonNullable<SessionReadinessData["recovery_status"]>;
  label: string;
}[] = [
  { value: "recovered", label: "回復" },
  { value: "partial", label: "少し残る" },
  { value: "not_recovered", label: "残る" },
];

const RECOVERY_MUSCLE_OPTIONS = [
  { value: "chest", label: "胸" },
  { value: "triceps", label: "三頭" },
  { value: "front_delts", label: "肩前" },
  { value: "upper_back", label: "上背部" },
  { value: "lats", label: "広背" },
  { value: "spinal_erectors", label: "腰背部" },
  { value: "quadriceps", label: "大腿前" },
  { value: "adductors", label: "内転" },
  { value: "hamstrings", label: "ハム" },
  { value: "glutes", label: "臀部" },
] as const;

const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: "胸",
  triceps: "三頭",
  biceps: "二頭",
  front_delts: "肩前",
  rear_delts: "肩後",
  upper_back: "上背部",
  lats: "広背",
  spinal_erectors: "腰背部",
  quadriceps: "大腿前",
  adductors: "内転",
  hamstrings: "ハム",
  glutes: "臀部",
  calves: "ふくらはぎ",
  forearms: "前腕",
  core: "体幹",
};

const PROGRAM_WEEK_COUNT = 12;
const PROGRAM_DAYS_PER_WEEK = 4;

const WEEK_DAY_OPTIONS = Array.from(
  { length: PROGRAM_WEEK_COUNT },
  (_, weekIndex) =>
    Array.from({ length: 4 }, (_, dayIndex) => ({
      value: `Week${weekIndex + 1}-Day${dayIndex + 1}`,
      label: `W${weekIndex + 1}-D${dayIndex + 1}`,
    })),
).flat();

type ProgramLocation = {
  week: number;
  day: number;
  value: string;
  shortLabel: string;
};

const clampProgramWeek = (week: number) =>
  Math.min(PROGRAM_WEEK_COUNT, Math.max(1, Math.round(week)));

const clampProgramDay = (day: number) =>
  Math.min(PROGRAM_DAYS_PER_WEEK, Math.max(1, Math.round(day)));

const formatProgramLocation = (week: number, day: number): ProgramLocation => {
  const normalizedWeek = clampProgramWeek(week);
  const normalizedDay = clampProgramDay(day);
  return {
    week: normalizedWeek,
    day: normalizedDay,
    value: `Week${normalizedWeek}-Day${normalizedDay}`,
    shortLabel: `W${normalizedWeek}-D${normalizedDay}`,
  };
};

const parseProgramLocation = (
  value?: string | null,
): ProgramLocation | null => {
  if (!value) return null;
  const match = value.match(/week\s*(\d+)\s*[-_ ]?\s*day\s*(\d+)/i);
  if (!match) return null;
  return formatProgramLocation(Number(match[1]), Number(match[2]));
};

const getNextProgramLocation = (location: ProgramLocation): ProgramLocation => {
  if (location.day < PROGRAM_DAYS_PER_WEEK) {
    return formatProgramLocation(location.week, location.day + 1);
  }
  if (location.week < PROGRAM_WEEK_COUNT) {
    return formatProgramLocation(location.week + 1, 1);
  }
  return formatProgramLocation(PROGRAM_WEEK_COUNT, PROGRAM_DAYS_PER_WEEK);
};

const normalizePlanMatchName = (value: string | null | undefined) =>
  getCanonicalExerciseName(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

function setMatchesSupervisorRow(set: SetData, row: SupervisorProgramRowV8) {
  const lift = normalizePlanMatchName(set.lift);
  const rowName = normalizePlanMatchName(row.display_name);
  const rowId = normalizePlanMatchName(row.exercise_id);
  const nameMatches =
    Boolean(lift) &&
    (lift === rowName ||
      lift === rowId ||
      rowName.includes(lift) ||
      lift.includes(rowName));
  const loadMatches =
    row.load_kg == null || isSameRecordedLoadKg(set.load_kg ?? 0, row.load_kg);
  const repsMatches = row.reps == null || set.reps === row.reps;
  return nameMatches && loadMatches && repsMatches;
}

function summarizePlannedRowsForSets(
  rows: SupervisorProgramRowV8[],
  sets: SetData[],
  currentRowId?: string | null,
) {
  const rowSummaries = rows.map((row) => {
    const completedSets = sets.filter((set) =>
      setMatchesSupervisorRow(set, row),
    ).length;
    const plannedSets = row.sets ?? 0;
    const remainingSets =
      plannedSets > 0 ? Math.max(0, plannedSets - completedSets) : null;
    return {
      row,
      completed_sets: completedSets,
      planned_sets: plannedSets || null,
      remaining_sets: remainingSets,
      completed: plannedSets > 0 ? completedSets >= plannedSets : false,
    };
  });
  const completedRows = rowSummaries.filter((summary) => summary.completed);
  const remainingRows = rowSummaries.filter((summary) => !summary.completed);
  const current = currentRowId
    ? rowSummaries.find((summary) => summary.row.row_id === currentRowId)
    : null;
  return {
    rows: rowSummaries,
    completedRows,
    remainingRows,
    currentRowRemainingSets: current?.remaining_sets ?? null,
  };
}

function selectActiveSupervisorRowForSets(
  rows: SupervisorProgramRowV8[],
  sets: SetData[],
  currentLoad: number,
  currentReps: number,
) {
  if (rows.length === 0) return null;
  const summary = summarizePlannedRowsForSets(rows, sets);
  const exactRemainingRow = summary.remainingRows.find(({ row }) => {
    const loadMatches =
      row.load_kg == null || isSameRecordedLoadKg(currentLoad, row.load_kg);
    const repsMatch = row.reps == null || currentReps === row.reps;
    return loadMatches && repsMatch;
  });
  return (
    exactRemainingRow?.row ??
    summary.remainingRows[0]?.row ??
    rows[rows.length - 1] ??
    null
  );
}

export type SessionScreenQuickLaunchParams = {
  supervisorRowId?: string;
  supervisorWeekDay?: string;
  quickLaunchToken?: string;
  autoOpen?: string;
};

function inferMainLiftFromSupervisorRow(
  row: SupervisorProgramRowV8,
): SessionReadinessData["main_lift"] {
  const value = `${row.exercise_id} ${row.display_name}`.toLowerCase();
  if (value.includes("bench") || /(^|[_\s])bp([_\s]|$)/.test(value)) {
    return "BP";
  }
  if (value.includes("deadlift") || /(^|[_\s])dl([_\s]|$)/.test(value)) {
    return "DL";
  }
  if (value.includes("squat") || /(^|[_\s])sq([_\s]|$)/.test(value)) {
    return "SQ";
  }
  return null;
}

function parseSessionReadinessMarker(
  notes?: string | null,
): SessionReadinessData | null {
  if (!notes) return null;
  const markerLine = notes
    .split("\n")
    .find((line) => line.trim().startsWith(SESSION_READINESS_NOTE_PREFIX));
  if (!markerLine) return null;

  try {
    const parsed = JSON.parse(
      markerLine.trim().slice(SESSION_READINESS_NOTE_PREFIX.length),
    ) as SessionReadinessData;
    return {
      dieting: typeof parsed.dieting === "boolean" ? parsed.dieting : null,
      sleep_quality:
        parsed.sleep_quality === "good" ||
        parsed.sleep_quality === "ok" ||
        parsed.sleep_quality === "bad"
          ? parsed.sleep_quality
          : null,
      pain_area:
        typeof parsed.pain_area === "string" && parsed.pain_area.trim()
          ? parsed.pain_area
          : null,
      pain_score:
        typeof parsed.pain_score === "number" &&
        Number.isFinite(parsed.pain_score)
          ? parsed.pain_score
          : null,
      pain_reviewed: parsed.pain_reviewed === true,
      pain_reviewed_at:
        typeof parsed.pain_reviewed_at === "string"
          ? parsed.pain_reviewed_at
          : null,
      recovery_status:
        parsed.recovery_status === "recovered" ||
        parsed.recovery_status === "partial" ||
        parsed.recovery_status === "not_recovered"
          ? parsed.recovery_status
          : null,
      recovery_muscles: Array.isArray(parsed.recovery_muscles)
        ? parsed.recovery_muscles.filter(
            (muscle): muscle is string =>
              typeof muscle === "string" && muscle.trim().length > 0,
          )
        : [],
      recovery_soreness_score:
        typeof parsed.recovery_soreness_score === "number" &&
        Number.isFinite(parsed.recovery_soreness_score)
          ? Math.max(0, Math.min(10, parsed.recovery_soreness_score))
          : null,
      week_day:
        typeof parsed.week_day === "string" && parsed.week_day.trim()
          ? parsed.week_day
          : null,
      main_lift:
        parsed.main_lift === "SQ" ||
        parsed.main_lift === "BP" ||
        parsed.main_lift === "DL"
          ? parsed.main_lift
          : null,
      day_role:
        typeof parsed.day_role === "string" && parsed.day_role.trim()
          ? parsed.day_role
          : null,
      captured_at:
        typeof parsed.captured_at === "string" ? parsed.captured_at : undefined,
    };
  } catch {
    return null;
  }
}

type CurrentLiftRoleResolution = {
  requiredOptional: "required_main" | "optional_accessory" | "unclassified";
  roleResolutionSource:
    | "planned_row_exact_match"
    | "planned_row_day_role"
    | "planned_row_missing_alias_ignored"
    | "computed_optional_accessory"
    | "unclassified"
    | "role_conflict";
  roleConflict: string | null;
};

function resolveCurrentLiftDayRole(
  currentLift: string | null | undefined,
  mainLift: SessionReadinessData["main_lift"],
  dayRole?: string | null,
): CurrentLiftRoleResolution {
  if (!mainLift || !currentLift) {
    return {
      requiredOptional: "unclassified",
      roleResolutionSource: "unclassified",
      roleConflict: null,
    };
  }
  const expectedRolePrefix = `${mainLift.toLowerCase()}_`;
  if (dayRole && !dayRole.toLowerCase().startsWith(expectedRolePrefix)) {
    return {
      requiredOptional: "unclassified",
      roleResolutionSource: "role_conflict",
      roleConflict: `mainLift=${mainLift} と dayRole=${dayRole} が矛盾`,
    };
  }
  const resolved = resolvePlannedExerciseRole({
    exerciseName: currentLift,
    mainLift,
    dayRole,
  });
  return {
    requiredOptional: resolved.requiredOptional,
    roleResolutionSource: resolved.roleResolutionSource,
    roleConflict: resolved.roleConflict,
  };
}

type LazyFormVideoOverlayProps = {
  visible: boolean;
  sessionId: string;
  lift: string;
  setIndex: number;
  loadKg: number;
  autoStopToken?: number;
  onClose: () => void;
  onSaved?: (record: FormVideoRecord) => void;
};

const LazyFormVideoOverlay = React.lazy(
  async (): Promise<{
    default: React.ComponentType<LazyFormVideoOverlayProps>;
  }> => {
    const module = await import("@/src/components/FormVideoOverlay");
    return { default: module.FormVideoOverlay };
  },
);

let hasMarkedSessionScreenRenderEntry = false;

const formatNumber = (
  value: number | null | undefined,
  digits: number = 2,
  suffix: string = "",
): string => {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${value.toFixed(digits)}${suffix}`;
};

const openChatGPT = async (): Promise<"app" | "web" | "none"> => {
  try {
    const canOpenApp = await Linking.canOpenURL(CHATGPT_APP_URL);
    if (canOpenApp) {
      await Linking.openURL(CHATGPT_APP_URL);
      return "app";
    }
    await Linking.openURL(CHATGPT_WEB_URL);
    return "web";
  } catch (error) {
    console.warn("[SessionScreen] Failed to open ChatGPT:", error);
    return "none";
  }
};

const formatNullableSeconds = (seconds: number | null | undefined) =>
  seconds == null ? "-" : formatDurationSeconds(seconds);

const getDecisionLabel = (status: string) => {
  switch (status) {
    case "good":
      return "良好";
    case "watch":
      return "注意";
    case "moderate_to_high":
      return "中〜高";
    case "high":
      return "高";
    case "rom_drop_detected":
      return "ROM低下";
    case "candidate_pr":
      return "Candidate";
    case "confirmed_pr":
      return "Confirmed";
    case "baseline":
      return "Baseline";
    case "excluded":
      return "除外";
    case "unknown":
      return "不明";
    default:
      return status;
  }
};

const parseTrimInput = (
  input: string,
): { trimStartS: number; trimEndS: number } | null => {
  const parts = input
    .split(/[,\s/]+/)
    .map((part) => Number.parseFloat(part.trim()))
    .filter((value) => Number.isFinite(value) && value >= 0);
  if (parts.length === 0) return null;
  return {
    trimStartS: Math.round((parts[0] ?? 0) * 10) / 10,
    trimEndS: Math.round((parts[1] ?? 0) * 10) / 10,
  };
};

const parseFormVideoTrim = (
  notes?: string | null,
): { trimStartS: number; trimEndS: number } | null => {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes) as {
      trim_start_s?: unknown;
      trim_end_s?: unknown;
    };
    const trimStartS =
      typeof parsed.trim_start_s === "number" ? parsed.trim_start_s : 0;
    const trimEndS =
      typeof parsed.trim_end_s === "number" ? parsed.trim_end_s : 0;
    if (trimStartS <= 0 && trimEndS <= 0) return null;
    return { trimStartS, trimEndS };
  } catch {
    return null;
  }
};

export default function SessionScreen({
  supervisorRowId,
  supervisorWeekDay,
  quickLaunchToken,
  autoOpen,
}: SessionScreenQuickLaunchParams = {}) {
  if (!hasMarkedSessionScreenRenderEntry) {
    hasMarkedSessionScreenRenderEntry = true;
    void CrashReportService.saveVBTSessionStageAttempt(
      "session_screen_render_entered",
      {
        entry_point: "bottom_tab",
        is_connected: Boolean(BLEService.getLastDeviceInfo().id),
      },
    ).catch((error) => {
      console.warn("[SessionScreen] Failed to mark render entry:", error);
    });
  }

  const router = useRouter();
  const navigationState = useNavigation();
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const isCompactFocusLayout = windowHeight < 720 || windowWidth < 360;

  // PR検知時のモーダル状態
  const [prRecord, setPRRecord] = useState<PRRecord | null>(null);
  const [showPRModal, setShowPRModal] = useState(false);

  // 手動レップ追加モーダル状態
  const [showManualRepModal, setShowManualRepModal] = useState(false);
  const [isReconnectingSensor, setIsReconnectingSensor] = useState(false);
  const [gearByLift, setGearByLift] = useState<Record<string, string>>({});
  const gearSessionIdRef = useRef<string | null>(null);

  const [readinessDieting, setReadinessDieting] = useState<boolean | null>(
    null,
  );
  const [readinessSleepQuality, setReadinessSleepQuality] =
    useState<NonNullable<SessionReadinessData["sleep_quality"]>>("ok");
  const [readinessPainArea, setReadinessPainArea] = useState("");
  const [readinessPainScore, setReadinessPainScore] = useState("0");
  const [readinessPainReviewedAt, setReadinessPainReviewedAt] = useState<
    string | null
  >(null);
  const [readinessRecoveryStatus, setReadinessRecoveryStatus] = useState<
    NonNullable<SessionReadinessData["recovery_status"]>
  >("recovered");
  const [readinessRecoveryMuscles, setReadinessRecoveryMuscles] = useState<
    string[]
  >([]);
  const [readinessRecoverySorenessScore, setReadinessRecoverySorenessScore] =
    useState("0");
  const [readinessPainHistory, setReadinessPainHistory] = useState<PainEvent[]>(
    [],
  );
  const [readinessWeekDay, setReadinessWeekDay] = useState("Week1-Day1");
  const [programLocationHint, setProgramLocationHint] =
    useState("設定値から初期化");
  const [weekDayPickerVisible, setWeekDayPickerVisible] = useState(false);
  const readinessWeekDayTouchedRef = useRef(false);
  const [readinessMainLift, setReadinessMainLift] =
    useState<SessionReadinessData["main_lift"]>(null);
  const [supervisorProgramPlanState, setSupervisorProgramPlanState] =
    useState<SupervisorProgramPlanState | null>(null);
  const [supervisorPlanEvaluationMs, setSupervisorPlanEvaluationMs] = useState(
    () => Date.now(),
  );
  const appliedSupervisorPlan = supervisorProgramPlanState?.applied ?? null;
  const supervisorProgramPlanExecutionState = useMemo(
    () =>
      getSupervisorProgramPlanExecutionState(
        appliedSupervisorPlan,
        supervisorPlanEvaluationMs,
      ),
    [appliedSupervisorPlan, supervisorPlanEvaluationMs],
  );
  const supervisorProgramPlanExecutable =
    supervisorProgramPlanExecutionState.executable;
  const supervisorProgramPlanStaleReason =
    supervisorProgramPlanExecutionState.stale_reason;
  const executableSupervisorPlan = supervisorProgramPlanExecutable
    ? appliedSupervisorPlan
    : null;
  const buildSessionReadinessPayload = useCallback((): SessionReadinessData => {
    const painScore = Number.parseInt(readinessPainScore, 10);
    const recoverySorenessScore = Number.parseInt(
      readinessRecoverySorenessScore,
      10,
    );
    return {
      dieting: readinessDieting,
      sleep_quality: readinessSleepQuality,
      pain_area: readinessPainArea.trim() || null,
      pain_score: Number.isFinite(painScore)
        ? Math.max(0, Math.min(10, painScore))
        : null,
      pain_reviewed: readinessPainReviewedAt != null,
      pain_reviewed_at: readinessPainReviewedAt,
      recovery_status: readinessRecoveryStatus,
      recovery_muscles: readinessRecoveryMuscles,
      recovery_soreness_score: Number.isFinite(recoverySorenessScore)
        ? Math.max(0, Math.min(10, recoverySorenessScore))
        : null,
      week_day: readinessWeekDay.trim() || null,
      main_lift: readinessMainLift,
      day_role: readinessMainLift
        ? `${readinessMainLift.toLowerCase()}_main_day`
        : null,
      captured_at: new Date().toISOString(),
      ...buildSupervisorPlanMetadataFromProgramPlan(
        supervisorProgramPlanState?.applied ?? null,
        null,
      ),
      supervisor_plan_is_stale: supervisorProgramPlanExecutionState.is_stale,
      supervisor_plan_stale_reason: supervisorProgramPlanStaleReason,
      supervisor_plan_effective_from:
        supervisorProgramPlanExecutionState.effective_from,
      supervisor_plan_valid_until:
        supervisorProgramPlanExecutionState.valid_until,
      supervisor_plan_executable: supervisorProgramPlanExecutable,
    };
  }, [
    readinessDieting,
    readinessMainLift,
    readinessPainArea,
    readinessPainReviewedAt,
    readinessPainScore,
    readinessRecoveryMuscles,
    readinessRecoverySorenessScore,
    readinessRecoveryStatus,
    readinessSleepQuality,
    readinessWeekDay,
    supervisorProgramPlanState?.applied,
    supervisorProgramPlanExecutionState,
    supervisorProgramPlanExecutable,
    supervisorProgramPlanStaleReason,
  ]);

  const publishBreathForgeSchedule = useCallback(
    (state: "selected" | "started" | "completed", repVeloSessionID: string, weekDay = readinessWeekDay) => {
      void publishBreathSchedule({
        repVeloSessionID,
        readinessWeekDay: weekDay,
        state,
        programPlanID: appliedSupervisorPlan?.plan_id ?? null,
        programPlanVersion: appliedSupervisorPlan?.version ?? null,
      });
    },
    [appliedSupervisorPlan?.plan_id, appliedSupervisorPlan?.version, readinessWeekDay],
  );

  const handleOpenBreathForgeWarmup = useCallback(async () => {
    const repVeloSessionID = breathForgeSelectionID(readinessWeekDay);
    const opened = await openBreathForgeWarmup({
      repVeloSessionID,
      readinessWeekDay,
      programPlanID: appliedSupervisorPlan?.plan_id ?? null,
      programPlanVersion: appliedSupervisorPlan?.version ?? null,
    });
    if (!opened) {
      Alert.alert(
        "BREATHFORGEを開けません",
        "Day1〜3を選択し、同じiPhoneにBREATHFORGEをインストールしてから再試行してください。",
      );
    }
  }, [appliedSupervisorPlan?.plan_id, appliedSupervisorPlan?.version, readinessWeekDay]);

  const resolveCurrentGearJson = useCallback(
    (lift: string | null) => {
      const key = lift?.trim().toLowerCase();
      return key ? (gearByLift[key] ?? null) : null;
    },
    [gearByLift],
  );

  // Custom Hook for Logic（PR検知コールバックを渡す）
  const {
    finishSet,
    startSet,
    resumeSet,
    handleExcludeRep,
    handleMarkFailedRep,
    calculateAndProposeMVT,
    setWarmupMode,
    setCurrentSetType,
  } = useSessionLogic(
    (pr: PRRecord) => {
      setPRRecord(pr);
      setShowPRModal(true);
    },
    // Auto-start callback
    async () => {
      if (!isConnected) {
        Alert.alert(
          "センサー未接続",
          "BLEセンサーを接続してからセッションを開始してください。",
        );
        return;
      }
      const startedAt = new Date().toISOString();
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      startSession(sessionId);
      publishBreathForgeSchedule("started", sessionId);
      try {
        await DatabaseService.insertSession({
          session_id: sessionId,
          date: getJstTrainingDayId(startedAt),
          total_volume: 0,
          total_sets: 0,
          lifts: [],
          start_timestamp: startedAt,
          notes: buildSessionNotesWithReadiness(
            null,
            "",
            buildSessionReadinessPayload(),
          ),
        });
      } catch (e) {
        console.error("セッション作成失敗:", e);
      }
    },
    resolveCurrentGearJson,
  );

  // Global State
  const {
    currentSetIndex,
    isConnected,
    liveData,
    currentExercise,
    currentLoad,
    currentReps,
    plannedSetCount,
    plannedRpe,
    setHistory,
    sensorInputMuted,
    currentSession,
    isSessionActive,
    sessionStartTime,
    currentLift,
    updateLoad,
    updateReps,
    setPlannedSetCount,
    setPlannedRpe,
    targetWeight,
    setTargetWeight,
    setConnectionStatus,
    setSensorInputMuted,
    currentHeartRate,
    restStartTime,
    sessionHRPoints,
    repHistory,
    setCurrentExercise,
    startSession,
    restoreRecoveredSession,
    endSession,
    isPaused,
    setPaused,
    pauseReason,

    // VBT Intelligence
    cnsBattery,
    estimated1RM,
    estimated1RM_confidence,
    suggestedLoad,
    proposedMVT,
    setProposedMVT,
    updateSetHistory,
    removeSetFromHistory,
    settings,
    updateSettings,
  } = useTrainingStore(
    (state) => ({
      currentSetIndex: state.currentSetIndex,
      isConnected: state.isConnected,
      liveData: state.liveData,
      currentExercise: state.currentExercise,
      currentLoad: state.currentLoad,
      currentReps: state.currentReps,
      plannedSetCount: state.plannedSetCount,
      plannedRpe: state.plannedRpe,
      setHistory: state.setHistory,
      sensorInputMuted: state.sensorInputMuted,
      currentSession: state.currentSession,
      isSessionActive: state.isSessionActive,
      sessionStartTime: state.sessionStartTime,
      currentLift: state.currentLift,
      updateLoad: state.updateLoad,
      updateReps: state.updateReps,
      setPlannedSetCount: state.setPlannedSetCount,
      setPlannedRpe: state.setPlannedRpe,
      targetWeight: state.targetWeight,
      setTargetWeight: state.setTargetWeight,
      setConnectionStatus: state.setConnectionStatus,
      setSensorInputMuted: state.setSensorInputMuted,
      currentHeartRate: state.currentHeartRate,
      restStartTime: state.restStartTime,
      sessionHRPoints: state.sessionHRPoints,
      repHistory: state.repHistory,
      setCurrentExercise: state.setCurrentExercise,
      startSession: state.startSession,
      restoreRecoveredSession: state.restoreRecoveredSession,
      endSession: state.endSession,
      isPaused: state.isPaused,
      setPaused: state.setPaused,
      pauseReason: state.pauseReason,
      cnsBattery: state.cnsBattery,
      estimated1RM: state.estimated1RM,
      estimated1RM_confidence: state.estimated1RM_confidence,
      suggestedLoad: state.suggestedLoad,
      proposedMVT: state.proposedMVT,
      setProposedMVT: state.setProposedMVT,
      updateSetHistory: state.updateSetHistory,
      removeSetFromHistory: state.removeSetFromHistory,
      settings: state.settings,
      updateSettings: state.updateSettings,
    }),
    shallow,
  );

  useEffect(() => {
    const nextSessionId = currentSession?.session_id ?? null;
    const previousSessionId = gearSessionIdRef.current;
    if (nextSessionId === previousSessionId) return;

    gearSessionIdRef.current = nextSessionId;
    if (!nextSessionId) {
      setGearByLift({});
      return;
    }

    const recoveredGear: Record<string, string> = {};
    for (const set of setHistory) {
      const key = set.lift?.trim().toLowerCase();
      if (key && set.gear_json) {
        recoveredGear[key] = set.gear_json;
      }
    }
    setGearByLift((current) =>
      previousSessionId == null
        ? { ...current, ...recoveredGear }
        : recoveredGear,
    );
  }, [currentSession?.session_id, setHistory]);

  const currentGear = parseBig3GearSelection(
    currentLift ? gearByLift[currentLift.trim().toLowerCase()] : null,
  );
  const handleGearChange = useCallback(
    (selection: Big3GearSelection) => {
      const key = currentLift?.trim().toLowerCase();
      if (!key) return;
      setGearByLift((current) => ({
        ...current,
        [key]: serializeBig3GearSelection(selection),
      }));
    },
    [currentLift],
  );

  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [availableExercises, setAvailableExercises] = useState<Exercise[]>([]);
  const quickLaunchAppliedTokenRef = useRef<string | null>(null);
  const [isWarmupMode, setIsWarmupMode] = useState(false);
  const [isDropSetMode, setIsDropSetMode] = useState(false);
  const [isAmrapMode, setIsAmrapMode] = useState(false);
  const [isSimulatingSet, setIsSimulatingSet] = useState(false);
  const [nextSetPurpose, setNextSetPurpose] =
    useState<NextSetPurpose>("form_consistency");
  const vbtProtocol = useMemo(
    () =>
      getPowerliftingProtocol(
        currentExercise?.category,
        settings.target_training_phase,
      ),
    [currentExercise?.category, settings.target_training_phase],
  );
  const topSingleTargetText = useMemo(
    () => getTopSingleTargetText(currentExercise?.mvt, vbtProtocol),
    [currentExercise?.mvt, vbtProtocol],
  );
  useEffect(() => {
    if (readinessWeekDayTouchedRef.current) return;
    setReadinessWeekDay((current) =>
      current === "Week1-Day1"
        ? `Week${settings.powerlifting_block_week}-Day1`
        : current,
    );
    setProgramLocationHint("設定値から初期化");
  }, [settings.powerlifting_block_week]);
  // レップ詳細モーダルの状態
  const [repDetailVisible, setRepDetailVisible] = useState(false);
  const [selectedSetIndex, setSelectedSetIndex] = useState<number>(1);
  const [selectedSetLift, setSelectedSetLift] = useState<string>("");
  const [selectedSetSessionId, setSelectedSetSessionId] = useState<string>("");
  const [detailSet, setDetailSet] = useState<SetData | null>(null);
  const [editingSet, setEditingSet] = useState<SetData | null>(null);

  // ツールチップの状態
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipData, setTooltipData] = useState<{
    term: string;
    definition: string;
    targetRange?: string;
    currentStatus?: "good" | "warning" | "danger";
    currentValue?: string;
  } | null>(null);

  // Session note editing state
  const [sessionNote, setSessionNote] = useState("");
  const [legacyDetailsOpen, setLegacyDetailsOpen] = useState(false);
  const [editingSessionNote, setEditingSessionNote] = useState(false);

  // Fetch all reps on mount or when returning
  const [sessionAllReps, setSessionAllReps] = useState<RepData[]>([]);

  // Recent exercise history (from previous sessions)
  const [recentExerciseHistory, setRecentExerciseHistory] = useState<SetData[]>(
    [],
  );
  const [sameLoadRepPRHistory, setSameLoadRepPRHistory] = useState<SetData[]>(
    [],
  );
  const [sameLoadRepPRHistoryLoading, setSameLoadRepPRHistoryLoading] =
    useState(false);
  const [previousVbtCrashContext, setPreviousVbtCrashContext] =
    useState<VBTScreenCrashContext | null>(null);
  const lastCrashContextSavedAtRef = useRef(0);
  const lastCrashContextSignatureRef = useRef<string | null>(null);
  const [lvpProfile, setLvpProfile] = useState<LVPData | null>(null);
  const targetVelocityRange = useMemo<[number, number] | null>(() => {
    const mvt = currentExercise?.mvt ?? lvpProfile?.mvt ?? null;
    if (mvt == null) return null;
    return [
      Number((mvt + vbtProtocol.topSingleMvtMargin.min).toFixed(2)),
      Number((mvt + vbtProtocol.topSingleMvtMargin.max).toFixed(2)),
    ];
  }, [
    currentExercise?.mvt,
    lvpProfile?.mvt,
    vbtProtocol.topSingleMvtMargin.max,
    vbtProtocol.topSingleMvtMargin.min,
  ]);
  // Historical session reps for detail modal
  const [historicalSessionReps, setHistoricalSessionReps] = useState<{
    sessionId: string;
    reps: RepData[];
  } | null>(null);
  const [selectedSetReps, setSelectedSetReps] = useState<RepData[] | null>(
    null,
  );
  const [detailFormVideos, setDetailFormVideos] = useState<FormVideoRecord[]>(
    [],
  );
  const shouldLoadSessionReps =
    (!settings.enable_session_lightweight_mode &&
      settings.session_display_session_history) ||
    repDetailVisible;

  useEffect(() => {
    let mounted = true;
    void CrashReportService.getLastVBTScreenContext().then((snapshot) => {
      if (mounted) {
        setPreviousVbtCrashContext(snapshot);
      }
    });

    return () => {
      mounted = false;
      void CrashReportService.clearVBTScreenContext();
    };
  }, []);

  useEffect(() => {
    if (!isConnected && !isSessionActive && !currentSession?.session_id) {
      return;
    }

    const now = Date.now();
    if (now - lastCrashContextSavedAtRef.current < 1500) {
      return;
    }
    lastCrashContextSavedAtRef.current = now;

    const latestCompletedSet =
      setHistory.length > 0 ? setHistory[setHistory.length - 1] : null;
    const crashContextSignature = [
      currentSession?.session_id ?? "no-session",
      isSessionActive ? "active" : "idle",
      isPaused ? `paused:${pauseReason ?? "-"}` : "running",
      isConnected ? "vbt:on" : "vbt:off",
      sensorInputMuted ? "sensor:off" : "sensor:on",
      currentLift,
      currentLoad,
      currentReps,
      currentSetIndex,
      setHistory.length,
      repHistory.length,
      currentHeartRate ?? "hr:-",
      liveData?.timestamp ?? "live:-",
      latestCompletedSet?.session_id ?? "set:-",
      latestCompletedSet?.set_index ?? "-",
      latestCompletedSet?.reps ?? "-",
    ].join("|");

    if (lastCrashContextSignatureRef.current === crashContextSignature) {
      return;
    }
    lastCrashContextSignatureRef.current = crashContextSignature;

    void CrashReportService.saveVBTScreenContext({
      session_id: currentSession?.session_id ?? null,
      is_session_active: isSessionActive,
      is_paused: isPaused,
      pause_reason: pauseReason ?? null,
      is_connected: isConnected,
      sensor_input_muted: sensorInputMuted,
      current_lift: currentLift,
      current_exercise_name: currentExercise?.name ?? null,
      current_load: currentLoad,
      current_reps: currentReps,
      current_set_index: currentSetIndex,
      completed_set_count: setHistory.length,
      current_rep_count: repHistory.length,
      current_heart_rate: currentHeartRate,
      live_data: liveData,
      latest_completed_set: latestCompletedSet,
      settings_snapshot: {
        lightweight_mode: Boolean(settings.enable_session_lightweight_mode),
        session_history: Boolean(settings.session_display_session_history),
        velocity_chart: Boolean(settings.session_display_velocity_chart),
        recent_history: Boolean(settings.session_display_recent_history),
        same_load_history: Boolean(settings.session_display_same_load_history),
        form_video: Boolean(settings.enable_video_recording),
      },
    }).catch((error) => {
      console.warn("[SessionScreen] Failed to save VBT crash context:", error);
    });
  }, [
    currentExercise?.name,
    currentHeartRate,
    currentLift,
    currentLoad,
    currentReps,
    currentSession?.session_id,
    currentSetIndex,
    isConnected,
    isPaused,
    isSessionActive,
    liveData,
    pauseReason,
    repHistory.length,
    sensorInputMuted,
    setHistory,
    settings.enable_session_lightweight_mode,
    settings.enable_video_recording,
    settings.session_display_recent_history,
    settings.session_display_same_load_history,
    settings.session_display_session_history,
    settings.session_display_velocity_chart,
  ]);

  const showDashboard = false;

  const handleGoToday = useCallback(() => {
    router.replace("/(tabs)");
  }, [router]);

  useEffect(() => {
    if (!isSessionActive || !isPaused) {
      setLegacyDetailsOpen(false);
    }
  }, [isPaused, isSessionActive]);

  const findSetByIdentity = useCallback(
    (setRef: { sessionId: string; lift: string; setIndex: number }) =>
      setHistory.find(
        (setItem) =>
          setItem.session_id === setRef.sessionId &&
          setItem.lift === setRef.lift &&
          setItem.set_index === setRef.setIndex,
      ) ??
      null,
    [setHistory],
  );

  const refreshSessionAllReps = useCallback(async () => {
    if (!currentSession?.session_id) {
      setSessionAllReps([]);
      return;
    }

    const reps = await DatabaseService.getRepsForSession(
      currentSession.session_id,
    );
    setSessionAllReps(reps);
  }, [currentSession?.session_id]);

  const refreshRecentExerciseHistory = useCallback(async () => {
    if (!currentLift) {
      setRecentExerciseHistory([]);
      return;
    }

    try {
      const recentSets = await DatabaseService.getRecentSetsForLift(
        currentLift,
        30,
        currentSession?.session_id,
      );
      setRecentExerciseHistory(recentSets);
    } catch (error) {
      console.error("Failed to fetch recent exercise history:", error);
      setRecentExerciseHistory([]);
    }
  }, [currentLift, currentSession?.session_id]);

  const refreshLvpProfile = useCallback(async () => {
    if (!currentLift) {
      setLvpProfile(null);
      return;
    }

    try {
      const profile = await DatabaseService.getLVPProfile(currentLift);
      setLvpProfile(profile);
    } catch (error) {
      console.error("Failed to fetch LVP profile:", error);
      setLvpProfile(null);
    }
  }, [currentLift]);

  useEffect(() => {
    if (!shouldLoadSessionReps) {
      setSessionAllReps([]);
      return;
    }

    void refreshSessionAllReps();

    if (settings.enable_session_lightweight_mode && setHistory.length >= 5) {
      return;
    }

    // セット保存直後はDB書き込みが少し遅延するため、短い再読込を入れて詳細を即時参照可能にする
    const timerId = setTimeout(() => {
      void refreshSessionAllReps();
    }, 450);

    return () => clearTimeout(timerId);
  }, [
    refreshSessionAllReps,
    setHistory.length,
    settings.enable_session_lightweight_mode,
    shouldLoadSessionReps,
  ]);

  // Refresh recent exercise history when lift changes
  useEffect(() => {
    void refreshRecentExerciseHistory();
  }, [refreshRecentExerciseHistory]);

  useEffect(() => {
    let cancelled = false;
    const lift = currentLift || currentExercise?.name || "";
    if (!lift || !Number.isFinite(currentLoad) || currentLoad <= 0) {
      setSameLoadRepPRHistory([]);
      setSameLoadRepPRHistoryLoading(false);
      return;
    }

    setSameLoadRepPRHistoryLoading(true);
    DatabaseService.getHistoricalSetsAtLoad(currentLoad)
      .then((sets) => {
        if (!cancelled) setSameLoadRepPRHistory(sets);
      })
      .catch((error) => {
        console.error("Failed to fetch same-load REP PR history:", error);
        if (!cancelled) setSameLoadRepPRHistory([]);
      })
      .finally(() => {
        if (!cancelled) setSameLoadRepPRHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    currentExercise?.name,
    currentLift,
    currentLoad,
    setHistory.length,
  ]);

  useEffect(() => {
    void refreshLvpProfile();
  }, [refreshLvpProfile, proposedMVT]);

  const sameLoadRecentHistory = useMemo(
    () =>
      recentExerciseHistory.filter((set) =>
        isSameRecordedLoadKg(set.load_kg, currentLoad),
      ),
    [currentLoad, recentExerciseHistory],
  );
  const sameLoadFastestSet = useMemo(() => {
    const candidates = sameLoadRecentHistory.filter(
      (set) => set.avg_velocity != null && set.avg_velocity > 0,
    );
    if (candidates.length === 0) return null;
    return candidates.reduce((best, set) =>
      (set.avg_velocity ?? 0) > (best.avg_velocity ?? 0) ? set : best,
    );
  }, [sameLoadRecentHistory]);
  const sameLoadFastestText =
    sameLoadFastestSet?.avg_velocity != null
      ? `${sameLoadFastestSet.avg_velocity.toFixed(2)} m/s`
      : "-";
  const sameLoadFastestMeta = sameLoadFastestSet
    ? `${sameLoadFastestSet.reps} reps / ${new Date(
        sameLoadFastestSet.timestamp,
      ).toLocaleDateString("ja-JP", {
        month: "numeric",
        day: "numeric",
      })}`
    : "履歴なし";
  const historicalBestE1RM = useMemo(() => {
    const candidates = recentExerciseHistory
      .map((set) => set.e1rm)
      .filter(
        (value): value is number =>
          value != null && Number.isFinite(value) && value > 0,
      );
    return candidates.length > 0 ? Math.max(...candidates) : null;
  }, [recentExerciseHistory]);
  const stableDisplayedE1RM = useMemo(
    () =>
      stabilizeDaily1RMEstimate({
        rawEstimate: estimated1RM,
        currentLoad,
        historicalBest1RM: historicalBestE1RM,
        confidence: estimated1RM_confidence ?? undefined,
      }),
    [currentLoad, estimated1RM, estimated1RM_confidence, historicalBestE1RM],
  );
  const displayedEstimated1RM = stableDisplayedE1RM.estimated1RM;
  const displayedEstimated1RMConfidence = stableDisplayedE1RM.confidence;
  const sameLoadFastestDeltaText =
    liveData?.mean_velocity != null && sameLoadFastestSet?.avg_velocity
      ? `${liveData.mean_velocity >= sameLoadFastestSet.avg_velocity ? "+" : ""}${(
          liveData.mean_velocity - sameLoadFastestSet.avg_velocity
        ).toFixed(2)}`
      : null;
  const similarLoadRecentHistory = useMemo(
    () =>
      recentExerciseHistory.filter(
        (set) =>
          set.avg_velocity != null && Math.abs(set.load_kg - currentLoad) <= 5,
      ),
    [currentLoad, recentExerciseHistory],
  );
  const currentProgramLocation = useMemo(
    () => parseProgramLocation(readinessWeekDay),
    [readinessWeekDay],
  );
  const currentProgramWeek =
    currentProgramLocation?.week ?? settings.powerlifting_block_week;
  const currentProgramDay = currentProgramLocation?.day ?? 1;
  const appliedSupervisorRowsForToday = useMemo(
    () =>
      getSupervisorRowsForDay(
        appliedSupervisorPlan,
        currentProgramWeek,
        `Day${currentProgramDay}`,
      ),
    [appliedSupervisorPlan, currentProgramDay, currentProgramWeek],
  );
  const appliedCurrentSupervisorRow = useMemo(
    () => {
      const matchingRows = resolveSupervisorRowsForExercise(
        appliedSupervisorPlan,
        currentProgramWeek,
        `Day${currentProgramDay}`,
        currentLift || currentExercise?.name || currentExercise?.id || null,
      );
      return selectActiveSupervisorRowForSets(
        matchingRows,
        setHistory,
        currentLoad,
        currentReps,
      );
    },
    [
      appliedSupervisorPlan,
      currentLoad,
      currentReps,
      currentExercise?.id,
      currentExercise?.name,
      currentLift,
      currentProgramDay,
      currentProgramWeek,
      setHistory,
    ],
  );
  const executableCurrentSupervisorRow = useMemo(
    () => {
      const matchingRows = resolveSupervisorRowsForExercise(
        executableSupervisorPlan,
        currentProgramWeek,
        `Day${currentProgramDay}`,
        currentLift || currentExercise?.name || currentExercise?.id || null,
      );
      return selectActiveSupervisorRowForSets(
        matchingRows,
        setHistory,
        currentLoad,
        currentReps,
      );
    },
    [
      currentLoad,
      currentReps,
      currentExercise?.id,
      currentExercise?.name,
      currentLift,
      currentProgramDay,
      currentProgramWeek,
      executableSupervisorPlan,
      setHistory,
    ],
  );
  const currentSessionPlannedRowsSummary = useMemo(
    () =>
      summarizePlannedRowsForSets(
        appliedSupervisorRowsForToday,
        setHistory,
        executableCurrentSupervisorRow?.row_id ?? null,
      ),
    [
      appliedSupervisorRowsForToday,
      executableCurrentSupervisorRow?.row_id,
      setHistory,
    ],
  );
  const appliedPlannedNextSet = useMemo(() => {
    const planned = buildPlannedNextSetFromSupervisorRow(
      executableCurrentSupervisorRow,
    );
    if (!planned) return null;
    const remaining =
      currentSessionPlannedRowsSummary.currentRowRemainingSets ?? planned.remainingSets;
    if (remaining != null && remaining <= 0) return null;
    return {
      ...planned,
      remainingSets: remaining,
    };
  }, [
    currentSessionPlannedRowsSummary.currentRowRemainingSets,
    executableCurrentSupervisorRow,
  ]);
  const supervisorRecommendationRows = useMemo(() => {
    if (!supervisorProgramPlanExecutable) return [];
    return currentSessionPlannedRowsSummary.remainingRows
      .map((summary) => summary.row)
      .filter((row) => row.role !== "fixed_observation")
      .slice(0, 8);
  }, [
    currentSessionPlannedRowsSummary.remainingRows,
    supervisorProgramPlanExecutable,
  ]);
  const individualProfileMode = useMemo<IndividualProfileMode>(() => {
    const rowMode = executableCurrentSupervisorRow?.profile_mode;
    if (rowMode === "collect" || rowMode === "confirm" || rowMode === "standard") {
      return rowMode;
    }
    return currentProgramWeek >= 1 && currentProgramWeek <= 4
      ? "collect"
      : "standard";
  }, [currentProgramWeek, executableCurrentSupervisorRow?.profile_mode]);
  const individualProfileCollecting = individualProfileMode === "collect";
  const supervisorRecommendedVl = useMemo(() => {
    if (individualProfileCollecting) return null;
    const value =
      executableCurrentSupervisorRow?.vl_cap ??
      executableCurrentSupervisorRow?.vl_target;
    return value != null && Number.isFinite(value)
      ? normalizeVelocityLossThreshold(value)
      : null;
  }, [executableCurrentSupervisorRow, individualProfileCollecting]);
  const supervisorRecommendationEmptyMessage = useMemo(() => {
    if (supervisorProgramPlanExecutable) {
      return currentSessionPlannedRowsSummary.remainingRows.length === 0
        ? "本日の監督メニューは完了です。追加種目はここから増やしません。"
        : "このWeek-Dayに実行できる残り行がありません。データ管理で対象日を確認してください。";
    }
    if (supervisorProgramPlanState?.staged) {
      return "取得済みの監督メニューがあります。適用すると、ここに種目・重量・VLの推奨が表示されます。";
    }
    return "監督メニューを取得・適用すると、今日の種目・重量・rep・VLを一括設定できます。未適用でも手入力は続行できます。";
  }, [
    currentSessionPlannedRowsSummary.remainingRows.length,
    supervisorProgramPlanExecutable,
    supervisorProgramPlanState?.staged,
  ]);
  const blockWeekPlan = useMemo(
    () => getBlockWeekPlan(currentProgramWeek, currentExercise?.category),
    [currentExercise?.category, currentProgramWeek],
  );

  const refreshSupervisorProgramPlanState = useCallback(() => {
    let cancelled = false;
    setSupervisorPlanEvaluationMs(Date.now());
    SupervisorProgramPlanService.getState()
      .then((state) => {
        if (!cancelled) setSupervisorProgramPlanState(state);
      })
      .catch((error) => {
        console.warn("[SessionScreen] Failed to load supervisor program plan:", error);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => refreshSupervisorProgramPlanState(), [
    refreshSupervisorProgramPlanState,
  ]);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const scheduleNextJstBoundaryRefresh = () => {
      timeout = setTimeout(() => {
        refreshSupervisorProgramPlanState();
        scheduleNextJstBoundaryRefresh();
      }, getDelayUntilNextJstDateBoundaryMs());
    };

    scheduleNextJstBoundaryRefresh();

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        refreshSupervisorProgramPlanState();
      }
    });

    return () => {
      if (timeout) clearTimeout(timeout);
      subscription.remove();
    };
  }, [refreshSupervisorProgramPlanState]);

  useEffect(() => {
    let mounted = true;
    void ExerciseService.initialize()
      .then(() => ExerciseService.getAllExercises())
      .then((exercises) => {
        if (mounted) setAvailableExercises(exercises);
      })
      .catch((error) => {
        console.warn("[SessionScreen] Failed to load supervisor exercise options:", error);
      });
    return () => {
      mounted = false;
    };
  }, []);
  const liveVelocityLossPaperThreshold = useMemo(
    () =>
      VBTGuideService.getVlThresholdByExercise(
        currentExercise?.category || "",
        settings.target_training_phase,
      ),
    [currentExercise?.category, settings.target_training_phase],
  );
  const liveVelocityLossThreshold = useMemo(
    () =>
      resolveVelocityLossThreshold(
        currentExercise?.velocity_loss_threshold,
        settings.velocity_loss_threshold,
        liveVelocityLossPaperThreshold,
      ),
    [
      currentExercise?.velocity_loss_threshold,
      settings.velocity_loss_threshold,
      liveVelocityLossPaperThreshold,
    ],
  );
  const effectiveLiveVelocityLossThreshold = individualProfileCollecting
    ? 0
    : liveVelocityLossThreshold;
  const liveIndividualSetTarget = useMemo(
    () =>
      buildLiveSetProfileTarget({
        mode: individualProfileMode,
        plannedLoadKg:
          executableCurrentSupervisorRow?.load_kg ?? currentLoad,
        plannedReps: executableCurrentSupervisorRow?.reps ?? currentReps,
        plannedRpe: executableCurrentSupervisorRow?.rpe_target ?? plannedRpe,
        targetVelocityLossPct: executableCurrentSupervisorRow?.vl_target,
        capVelocityLossPct: executableCurrentSupervisorRow?.vl_cap,
        targetFinalVelocity:
          executableCurrentSupervisorRow?.final_rep_velocity_target,
        expectedSequentialLossPatternPct:
          executableCurrentSupervisorRow?.rep_velocity_loss_pattern,
        observationPointsPct:
          executableCurrentSupervisorRow?.vl_observation_points,
        reps: repHistory,
      }),
    [
      currentLoad,
      currentReps,
      executableCurrentSupervisorRow?.final_rep_velocity_target,
      executableCurrentSupervisorRow?.load_kg,
      executableCurrentSupervisorRow?.rep_velocity_loss_pattern,
      executableCurrentSupervisorRow?.reps,
      executableCurrentSupervisorRow?.rpe_target,
      executableCurrentSupervisorRow?.vl_cap,
      executableCurrentSupervisorRow?.vl_observation_points,
      executableCurrentSupervisorRow?.vl_target,
      individualProfileMode,
      plannedRpe,
      repHistory,
    ],
  );
  const focusVelocityLossState = useMemo(() => {
    return getFocusVelocityLossState(
      repHistory,
      effectiveLiveVelocityLossThreshold,
    );
  }, [
    effectiveLiveVelocityLossThreshold,
    repHistory,
  ]);
  const liveVelocityLossDecision = focusVelocityLossState.decision;
  const liveProfilePatternText =
    liveIndividualSetTarget.observedSequentialLossPatternPct.length > 0
      ? liveIndividualSetTarget.observedSequentialLossPatternPct
          .map((loss) => `${loss >= 0 ? "+" : ""}${loss.toFixed(1)}%`)
          .join(" / ")
      : "2 REPから記録";
  const expectedProfilePatternText =
    liveIndividualSetTarget.expectedSequentialLossPatternPct.length > 0
      ? liveIndividualSetTarget.expectedSequentialLossPatternPct
          .map((loss) => `${loss >= 0 ? "+" : ""}${loss.toFixed(1)}%`)
          .join(" / ")
      : "3件の比較可能セット後に作成";
  const sessionMuscleStress = useMemo(
    () =>
      summarizeMuscleStress(
        setHistory.map((set) => ({
          ...set,
          category: getCanonicalExerciseSeed(set.lift)?.category ?? null,
        })),
      ),
    [setHistory],
  );
  const currentSetMuscleStress = useMemo(() => {
    const activeLift = currentLift || currentExercise?.name || "Unknown";
    const sequentialLosses =
      liveIndividualSetTarget.observedSequentialLossPatternPct;
    return estimateSetMuscleStress({
      lift: activeLift,
      category:
        currentExercise?.category ??
        getCanonicalExerciseSeed(activeLift)?.category ??
        null,
      load_kg: currentLoad,
      reps: currentReps,
      rpe: plannedRpe ?? undefined,
      e1rm: displayedEstimated1RM,
      velocity_loss_last: liveIndividualSetTarget.currentVelocityLossLastPct,
      maxSequentialVelocityLossPct:
        sequentialLosses.length > 0 ? Math.max(...sequentialLosses) : 0,
      is_warmup: false,
    });
  }, [
    currentExercise?.category,
    currentExercise?.name,
    currentLift,
    currentLoad,
    currentReps,
    displayedEstimated1RM,
    liveIndividualSetTarget.currentVelocityLossLastPct,
    liveIndividualSetTarget.observedSequentialLossPatternPct,
    plannedRpe,
  ]);
  const sessionMuscleLoadRows = useMemo(
    () =>
      (
        Object.entries(sessionMuscleStress.currentLoadScoreByMuscle) as [
          MuscleGroup,
          number,
        ][]
      )
        .filter(([, score]) => score > 0)
        .sort(([, left], [, right]) => right - left),
    [sessionMuscleStress.currentLoadScoreByMuscle],
  );
  const currentSetMuscleLoadRows = useMemo(
    () =>
      (
        Object.entries(currentSetMuscleStress.fatigueByMuscle) as [
          MuscleGroup,
          number,
        ][]
      )
        .filter(([, score]) => score > 0)
        .sort(([, left], [, right]) => right - left),
    [currentSetMuscleStress.fatigueByMuscle],
  );
  const nextDayRecoveryRows = useMemo(
    () =>
      [...sessionMuscleStress.recovery[24]].sort(
        (left, right) => right.remainingLoadScore - left.remainingLoadScore,
      ),
    [sessionMuscleStress.recovery],
  );
  const twoDayRecoveryRows = useMemo(
    () =>
      [...sessionMuscleStress.recovery[48]].sort(
        (left, right) => right.remainingLoadScore - left.remainingLoadScore,
      ),
    [sessionMuscleStress.recovery],
  );
  const threeDayRecoveryRows = useMemo(
    () =>
      [...sessionMuscleStress.recovery[72]].sort(
        (left, right) => right.remainingLoadScore - left.remainingLoadScore,
      ),
    [sessionMuscleStress.recovery],
  );
  const velocityLossRepPRTarget = useMemo(
    () =>
      buildVelocityLossRepPRTarget({
        lift: currentLift || currentExercise?.name || "Unknown",
        loadKg: currentLoad,
        velocityLossThreshold: effectiveLiveVelocityLossThreshold,
        liveRepCount: focusVelocityLossState.repCount,
        currentVelocityLoss:
          focusVelocityLossState.decision?.velocityLoss ??
          (focusVelocityLossState.repCount === 1 ? 0 : null),
        historySets: [...sameLoadRepPRHistory, ...setHistory],
      }),
    [
      currentExercise?.name,
      currentLift,
      currentLoad,
      focusVelocityLossState.decision?.velocityLoss,
      focusVelocityLossState.repCount,
      effectiveLiveVelocityLossThreshold,
      sameLoadRepPRHistory,
      setHistory,
    ],
  );
  const velocityLossRepPRMessage = useMemo(() => {
    if (sameLoadRepPRHistoryLoading) return "同重量履歴を確認中";
    switch (velocityLossRepPRTarget.status) {
      case "disabled":
        return "VLをONにするとPR目標を表示";
      case "threshold_exceeded":
        return "VL上限超過・このセットは対象外";
      case "achieved":
        return "VL内 REP PR達成";
      case "baseline":
        return velocityLossRepPRTarget.liveRepCount >= 1
          ? "初回VL内基準を達成"
          : "初回基準は1 REP";
      case "chasing":
        return velocityLossRepPRTarget.repsRemaining === 0
          ? "VL内 REP PR達成"
          : `あと ${velocityLossRepPRTarget.repsRemaining} REPでPR`;
    }
  }, [sameLoadRepPRHistoryLoading, velocityLossRepPRTarget]);
  const readinessDecision = useMemo(() => {
    if (!liveData?.mean_velocity || similarLoadRecentHistory.length < 2) {
      return null;
    }

    const baselineVelocities = similarLoadRecentHistory
      .map((set) => set.avg_velocity)
      .filter(
        (velocity): velocity is number => velocity != null && velocity > 0,
      )
      .sort((a, b) => a - b);
    if (baselineVelocities.length < 2) return null;

    const midpoint = Math.floor(baselineVelocities.length / 2);
    const medianVelocity =
      baselineVelocities.length % 2 === 0
        ? (baselineVelocities[midpoint - 1] + baselineVelocities[midpoint]) / 2
        : baselineVelocities[midpoint];
    return {
      baselineVelocity: medianVelocity,
      sampleCount: baselineVelocities.length,
      decision: getReadinessDecision(liveData.mean_velocity - medianVelocity),
    };
  }, [liveData?.mean_velocity, similarLoadRecentHistory]);
  const attemptPlan = useMemo(
    () => getAttemptPlan(displayedEstimated1RM ?? 0),
    [displayedEstimated1RM],
  );
  const lvpStatusText = useMemo(() => {
    if (!lvpProfile) {
      return "まだLVP未作成。4週間、同じフォームでAVとROMを集めます。";
    }

    const samples = lvpProfile.sample_count ?? 0;
    if (samples >= 8 && lvpProfile.r_squared >= 0.9) {
      return `LVP良好: ${samples}点 / R² ${lvpProfile.r_squared.toFixed(2)}`;
    }

    return `LVP作成中: ${samples || "少数"}点 / R² ${lvpProfile.r_squared.toFixed(2)}。80%以上の重い単発を足すと精度が上がります。`;
  }, [lvpProfile]);
  const currentDayRoleResolution = useMemo(
    () =>
      resolveCurrentLiftDayRole(
        currentLift || currentExercise?.name,
        readinessMainLift,
        readinessMainLift
          ? `${readinessMainLift.toLowerCase()}_main_day`
          : null,
      ),
    [currentExercise?.name, currentLift, readinessMainLift],
  );
  const currentDayRole = currentDayRoleResolution.requiredOptional;
  const currentDayRoleLabel =
    currentDayRole === "required_main"
      ? "主種目"
      : currentDayRole === "optional_accessory"
        ? "補助/任意"
        : "未分類";
  const accessoryRMTarget = useMemo(
    () =>
      buildAccessoryRMTargetContext({
        lift: currentLift || currentExercise?.name || "Unknown",
        currentLoadKg: currentLoad,
        currentReps,
        exercise: currentExercise,
        historySets: recentExerciseHistory,
      }),
    [
      currentExercise,
      currentLift,
      currentLoad,
      currentReps,
      recentExerciseHistory,
    ],
  );
  const romConsistencyMessage = useMemo(() => {
    if (!liveData?.rom_cm || !currentExercise) return null;
    const minRom =
      currentExercise.rom_range_min_cm ?? currentExercise.min_rom_threshold;
    const maxRom = currentExercise.rom_range_max_cm;

    if (minRom != null && liveData.rom_cm < minRom) {
      return `ROMが基準より短いです。目安 ${minRom}cm 以上にそろえます。`;
    }

    if (maxRom != null && liveData.rom_cm > maxRom) {
      return `ROMが普段より大きいです。深さやタッチ位置が変わっていないか確認します。`;
    }

    if (minRom != null || maxRom != null) {
      return "ROMは基準範囲です。同じ可動域のデータとして扱えます。";
    }

    return "ROMも一緒に見ます。速度が速くても深さやポーズが変わったデータは別扱いです。";
  }, [currentExercise, liveData?.rom_cm]);
  const liveMeanPower = useMemo(
    () =>
      getDisplayPower(
        liveData?.mean_power_w,
        liveData?.mean_velocity,
        currentLoad,
      ),
    [currentLoad, liveData?.mean_power_w, liveData?.mean_velocity],
  );
  const livePeakPower = useMemo(
    () =>
      getDisplayPower(
        liveData?.peak_power_w,
        liveData?.peak_velocity,
        currentLoad,
      ),
    [currentLoad, liveData?.peak_power_w, liveData?.peak_velocity],
  );
  const focusRomText =
    liveData?.rom_cm != null ? `${Math.round(liveData.rom_cm)} cm` : "-";
  const focusVelocityText =
    liveData?.mean_velocity != null
      ? `${liveData.mean_velocity.toFixed(2)} m/s`
      : "-";
  const focusPowerText =
    liveMeanPower != null ? `${Math.round(liveMeanPower)} W` : "-";
  const visibleSetHistory = useMemo(() => {
    if (!settings.enable_session_lightweight_mode) {
      return setHistory;
    }
    return setHistory.slice(-SESSION_LIGHTWEIGHT_SET_LIMIT);
  }, [setHistory, settings.enable_session_lightweight_mode]);
  const hiddenSetHistoryCount = setHistory.length - visibleSetHistory.length;
  const formRecordingAvailable =
    Boolean(settings.enable_video_recording) &&
    Boolean(currentSession?.session_id) &&
    Boolean(currentLift || currentExercise?.name);
  const currentRecordingLift = currentLift || currentExercise?.name || "";
  const handleToggleFormVideoRecording = useCallback(async () => {
    const shouldEnable = !settings.enable_video_recording;
    const nextSettings: AppSettings = {
      ...settings,
      enable_video_recording: shouldEnable,
      session_display_action_buttons: shouldEnable
        ? true
        : settings.session_display_action_buttons,
    };

    updateSettings(nextSettings);
    try {
      const saved = await saveAppSettings(nextSettings);
      updateSettings(saved);
    } catch (error) {
      console.error(
        "[SessionScreen] Failed to save form video setting:",
        error,
      );
      updateSettings(settings);
      Alert.alert("設定保存エラー", "フォーム動画モードの保存に失敗しました。");
    }
  }, [settings, updateSettings]);
  const lastCompletedSetAt =
    setHistory[setHistory.length - 1]?.timestamp ?? null;
  const showAdviceDisplay = settings.session_display_advice_group;
  const nextSetPurposeLabel =
    NEXT_SET_PURPOSE_OPTIONS.find((option) => option.value === nextSetPurpose)
      ?.label ?? "フォーム固定優先";
  const plannedSetText =
    plannedSetCount == null
      ? `現在Set ${currentSetIndex}`
      : `${plannedSetCount}セット予定`;
  const plannedRpeText = plannedRpe == null ? "任意" : `RPE ${plannedRpe}`;
  const sessionDecision = useMemo(
    () =>
      SessionDecisionService.analyze({
        sets: setHistory.filter(
          (setItem) =>
            !currentLift ||
            setItem.lift === currentLift ||
            setItem.lift === currentExercise?.name,
        ),
        currentLoad,
        currentHeartRate,
        purpose: nextSetPurpose,
        targetVelocityRange,
        configuredVelocityLossThresholdPct: effectiveLiveVelocityLossThreshold,
        individualProfileMode,
        mainLift: readinessMainLift,
        plannedNextSet:
          appliedPlannedNextSet ??
          ((appliedSupervisorRowsForToday.length === 0 ||
            !supervisorProgramPlanExecutable) &&
          currentLoad > 0 &&
          currentReps > 0
            ? {
                loadKg: currentLoad,
                reps: currentReps,
                remainingSets: plannedSetCount,
                rpe: plannedRpe,
                rowId: `${readinessWeekDay}:${readinessMainLift ?? "unknown"}:${currentLift || currentExercise?.name || "unknown"}:${currentSetIndex}`,
                source: "fallback_planned_row" as const,
              }
            : null),
        plannedSessionContext: {
          plannedRowsTotal: appliedSupervisorRowsForToday.length,
          plannedRowsCompleted:
            currentSessionPlannedRowsSummary.completedRows.length,
          plannedRowsRemaining:
            currentSessionPlannedRowsSummary.remainingRows.length,
          currentRowRemainingSets:
            currentSessionPlannedRowsSummary.currentRowRemainingSets,
          totalSessionSets: setHistory.length,
          accessorySetsAfterMain: Math.max(
            0,
            currentSessionPlannedRowsSummary.completedRows.length > 0
              ? setHistory.length -
                  currentSessionPlannedRowsSummary.completedRows.reduce(
                    (sum, summary) => sum + summary.completed_sets,
                    0,
                  )
              : 0,
          ),
          latestPainScore: Number.isFinite(
            Number.parseInt(readinessPainScore, 10),
          )
            ? Number.parseInt(readinessPainScore, 10)
            : null,
          latestRpe: setHistory[setHistory.length - 1]?.rpe ?? null,
          latestVlLast:
            setHistory[setHistory.length - 1]?.velocity_loss_last ?? null,
        },
        supervisorPlanGuard: {
          painState: buildStickyPainState([
            ...readinessPainHistory,
            {
              captured_at: new Date().toISOString(),
              pain_area: readinessPainArea.trim() || null,
              pain_score: Number.isFinite(Number.parseInt(readinessPainScore, 10))
                ? Number.parseInt(readinessPainScore, 10)
                : null,
              source: "session_readiness_form",
              zero_is_resolved: readinessPainReviewedAt != null,
            },
          ]),
          planVersion:
            appliedSupervisorPlan?.version ??
            buildSupervisorPlanMetadataFromProgramPlan(null, null)
              .supervisor_plan_version,
          planExecutable: supervisorProgramPlanExecutable,
          staleReason: supervisorProgramPlanStaleReason,
        },
      }),
    [
      appliedPlannedNextSet,
      appliedSupervisorPlan?.version,
      appliedSupervisorRowsForToday.length,
      currentExercise?.name,
      currentHeartRate,
      currentLift,
      currentLoad,
      effectiveLiveVelocityLossThreshold,
      individualProfileMode,
      currentSessionPlannedRowsSummary.completedRows,
      currentSessionPlannedRowsSummary.currentRowRemainingSets,
      currentSessionPlannedRowsSummary.remainingRows,
      readinessPainArea,
      readinessPainHistory,
      readinessPainReviewedAt,
      readinessPainScore,
      currentReps,
      currentSetIndex,
      nextSetPurpose,
      plannedRpe,
      plannedSetCount,
      readinessMainLift,
      readinessWeekDay,
      setHistory,
      supervisorProgramPlanExecutable,
      supervisorProgramPlanStaleReason,
      targetVelocityRange,
    ],
  );

  // Initialize session note from current session
  useEffect(() => {
    const notes = currentSession?.notes ?? "";
    // Keep machine-readable readiness/consultation records in the DB, but do
    // not expose their (potentially very large) JSON snapshots in the memo UI.
    setSessionNote(removeSessionSystemMarkers(notes));
    const parsedReadiness = parseSessionReadinessMarker(notes);
    if (!parsedReadiness) return;
    setReadinessDieting(parsedReadiness.dieting);
    if (parsedReadiness.sleep_quality) {
      setReadinessSleepQuality(parsedReadiness.sleep_quality);
    }
    setReadinessPainArea(parsedReadiness.pain_area ?? "");
    setReadinessPainScore(
      parsedReadiness.pain_score != null
        ? String(parsedReadiness.pain_score)
        : "0",
    );
    setReadinessPainReviewedAt(
      parsedReadiness.pain_reviewed === true
        ? parsedReadiness.pain_reviewed_at ??
            parsedReadiness.captured_at ??
            currentSession?.start_timestamp ??
            null
        : null,
    );
    if (parsedReadiness.recovery_status) {
      setReadinessRecoveryStatus(parsedReadiness.recovery_status);
    }
    setReadinessRecoveryMuscles(parsedReadiness.recovery_muscles ?? []);
    setReadinessRecoverySorenessScore(
      parsedReadiness.recovery_soreness_score != null
        ? String(parsedReadiness.recovery_soreness_score)
        : "0",
    );
    if (parsedReadiness.week_day) {
      readinessWeekDayTouchedRef.current = true;
      setReadinessWeekDay(parsedReadiness.week_day);
      setProgramLocationHint("このセッションに保存済み");
    }
    setReadinessMainLift(parsedReadiness.main_lift);
  }, [currentSession?.notes, currentSession?.start_timestamp]);

  useEffect(() => {
    let mounted = true;

    const loadPainHistory = async () => {
      try {
        await DatabaseService.initialize();
        const sessions = await DatabaseService.getSessions();
        if (!mounted) return;
        setReadinessPainHistory(
          sessions
            .map((session) =>
              readinessToPainEvent(
                parseSessionReadinessMarker(session.notes),
                session.start_timestamp ?? session.date,
                "session_readiness_history",
                false,
              ),
            )
            .filter((event): event is PainEvent => event != null),
        );
      } catch (error) {
        console.warn("[SessionScreen] Failed to load pain history:", error);
      }
    };

    void loadPainHistory();

    return () => {
      mounted = false;
    };
  }, [currentSession?.session_id]);

  useEffect(() => {
    if (isSessionActive || currentSession?.session_id) return;
    if (readinessWeekDayTouchedRef.current) return;

    let mounted = true;

    const inferNextProgramLocation = async () => {
      try {
        await DatabaseService.initialize();
        const sessions = await DatabaseService.getSessions();
        const latestReadiness = sessions
          .map((session) => ({
            session,
            readiness: parseSessionReadinessMarker(session.notes),
          }))
          .find(({ readiness }) => parseProgramLocation(readiness?.week_day));
        const previousLocation = parseProgramLocation(
          latestReadiness?.readiness?.week_day,
        );
        if (!mounted || !previousLocation) return;

        const nextLocation = getNextProgramLocation(previousLocation);
        setReadinessWeekDay(nextLocation.value);
        setProgramLocationHint(
          `前回 ${previousLocation.value} から自動計算: ${nextLocation.value}`,
        );
      } catch (error) {
        console.warn(
          "[SessionScreen] Failed to infer program location from sessions:",
          error,
        );
      }
    };

    void inferNextProgramLocation();

    return () => {
      mounted = false;
    };
  }, [currentSession?.session_id, isSessionActive]);

  const recoveryInitializedRef = useRef(false);
  const recoverySaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    if (recoveryInitializedRef.current || isSessionActive) return;
    recoveryInitializedRef.current = true;

    const restoreSessionOrLastExercise = async () => {
      try {
        await DatabaseService.initialize();
        await ExerciseService.initialize();
        const exercises = await ExerciseService.getAllExercises();
        const recovery = await SessionRecoveryService.getActiveSession();

        if (recovery) {
          const recoveryAge =
            Date.now() - new Date(recovery.saved_at).getTime();
          if (recoveryAge <= SESSION_RECOVERY_MAX_AGE_MS) {
            const session =
              (await DatabaseService.getSession(recovery.session_id)) ??
              (await DatabaseService.ensureSession(recovery.session_id));

            if (!session.end_timestamp) {
              const sets = await DatabaseService.getSetsForSession(
                recovery.session_id,
              );
              const exercise =
                exercises.find(
                  (item) => item.id === recovery.current_exercise_id,
                ) ??
                exercises.find(
                  (item) => item.name === recovery.current_exercise_name,
                ) ??
                exercises.find((item) => item.name === recovery.current_lift) ??
                null;
              const restoredLift =
                exercise?.name ??
                recovery.current_lift ??
                sets[sets.length - 1]?.lift ??
                null;

              restoreRecoveredSession({
                session: {
                  ...session,
                  id: session.session_id,
                  exercises: exercise ? [exercise] : [],
                  sets,
                  total_volume: sets.reduce(
                    (sum, setItem) => sum + setItem.load_kg * setItem.reps,
                    0,
                  ),
                  start_timestamp:
                    session.start_timestamp ??
                    recovery.session_start_timestamp ??
                    undefined,
                },
                setHistory: sets,
                currentExercise: exercise,
                currentLift: restoredLift,
                currentLoad: recovery.current_load,
                currentReps: recovery.current_reps,
                currentSetIndex: recovery.current_set_index,
                sessionStartTime: recovery.session_start_time,
                sessionStartTimeStamp: recovery.session_start_timestamp,
              });
              Alert.alert(
                "前回セッションを復元しました",
                `${restoredLift ?? "前回種目"} / ${sets.length}セット目までを同じセッションとして継続できます。`,
              );
              return;
            }
          }

          await SessionRecoveryService.clearActiveSession();
        }

        const lastExercise = await SessionRecoveryService.getLastExercise();
        const exercise =
          (lastExercise
            ? (exercises.find((item) => item.id === lastExercise.exercise_id) ??
              exercises.find(
                (item) => item.name === lastExercise.exercise_name,
              ))
            : null) ?? null;
        if (exercise && !currentExercise) {
          setCurrentExercise(exercise);
        }
      } catch (error) {
        console.error("[SessionScreen] Failed to restore session:", error);
      }
    };

    void restoreSessionOrLastExercise();
  }, [
    currentExercise,
    isSessionActive,
    restoreRecoveredSession,
    setCurrentExercise,
  ]);

  useEffect(() => {
    if (recoverySaveTimerRef.current) {
      clearTimeout(recoverySaveTimerRef.current);
      recoverySaveTimerRef.current = null;
    }

    if (!isSessionActive || !currentSession?.session_id) return;

    recoverySaveTimerRef.current = setTimeout(() => {
      void SessionRecoveryService.saveActiveSession({
        session_id: currentSession.session_id,
        session_start_time: sessionStartTime,
        session_start_timestamp:
          currentSession.start_timestamp ?? currentSession.date ?? null,
        current_exercise_id: currentExercise?.id ?? null,
        current_exercise_name: currentExercise?.name ?? null,
        current_lift: currentLift ?? currentExercise?.name ?? null,
        current_load: currentLoad,
        current_reps: currentReps,
        current_set_index: currentSetIndex,
        completed_set_count: setHistory.length,
        last_completed_set_at: lastCompletedSetAt,
      }).catch((error) => {
        console.error("[SessionScreen] Failed to save recovery:", error);
      });
    }, 600);

    return () => {
      if (recoverySaveTimerRef.current) {
        clearTimeout(recoverySaveTimerRef.current);
        recoverySaveTimerRef.current = null;
      }
    };
  }, [
    currentExercise?.id,
    currentExercise?.name,
    currentLift,
    currentLoad,
    currentReps,
    currentSession?.date,
    currentSession?.session_id,
    currentSession?.start_timestamp,
    currentSetIndex,
    isSessionActive,
    lastCompletedSetAt,
    sessionStartTime,
    setHistory.length,
  ]);

  // Auto-finish session on app background to prevent data loss
  const autoFinishHandled = useRef(false);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (
        nextAppState === "background" &&
        isSessionActive &&
        repHistory.length > 0 &&
        !autoFinishHandled.current
      ) {
        autoFinishHandled.current = true;
        console.log(
          "[SessionScreen] App going to background with active session and reps, auto-finishing...",
        );

        // Use setTimeout to allow the UI to update before blocking on save
        setTimeout(async () => {
          try {
            await finishSet();
            await refreshSessionAllReps();
            console.log("[SessionScreen] Auto-finish completed successfully");
          } catch (error) {
            console.error("[SessionScreen] Auto-finish failed:", error);
          }
        }, 100);
      } else if (nextAppState === "active") {
        // Reset the flag when app comes back to foreground
        autoFinishHandled.current = false;
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isSessionActive, repHistory.length, finishSet, refreshSessionAllReps]);

  const [inputTargetWeight, setInputTargetWeight] = useState("");
  const [inputLoad, setInputLoad] = useState(formatLoadKg(currentLoad));
  const [formVideoOverlayVisible, setFormVideoOverlayVisible] = useState(false);
  const [improvementFeedbackVisible, setImprovementFeedbackVisible] = useState(false);
  const [queuedFeedbackCount, setQueuedFeedbackCount] = useState(0);
  const sensorInputMutedBeforeVideoRef = useRef<boolean | null>(null);
  const pauseBeforeVideoRef = useRef<{ paused: boolean; reason: typeof pauseReason } | null>(null);
  const [formVideoCountsBySet, setFormVideoCountsBySet] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    void ImprovementFeedbackService.listQueued().then((items) => {
      setQueuedFeedbackCount(items.filter((item) => item.status === "queued").length);
    });
  }, []);

  const getSetKey = useCallback(
    (lift: string, setIndex: number) => `${lift}::${setIndex}`,
    [],
  );

  const repsBySetKey = useMemo(() => {
    const map = new Map<string, RepData[]>();
    for (const rep of sessionAllReps) {
      const key = getSetKey(rep.lift, rep.set_index);
      const existing = map.get(key);
      if (existing) {
        existing.push(rep);
      } else {
        map.set(key, [rep]);
      }
    }
    return map;
  }, [getSetKey, sessionAllReps]);

  useEffect(() => {
    const sessionId = currentSession?.session_id;
    if (!settings.enable_video_recording || !sessionId) {
      setFormVideoCountsBySet({});
      return;
    }

    void VideoRecordingService.getFormVideosForSession(sessionId)
      .then((videos) => {
        const counts: Record<string, number> = {};
        for (const video of videos) {
          if (!video.lift || video.set_index == null) continue;
          const key = getSetKey(video.lift, video.set_index);
          counts[key] = (counts[key] ?? 0) + 1;
        }
        setFormVideoCountsBySet(counts);
      })
      .catch((error) => {
        console.warn("[SessionScreen] Failed to load form videos:", error);
        setFormVideoCountsBySet({});
      });
  }, [
    currentSession?.session_id,
    getSetKey,
    settings.enable_video_recording,
    setHistory.length,
  ]);

  const selectedSet = useMemo(
    () =>
      setHistory.find(
        (setItem) =>
          setItem.set_index === selectedSetIndex &&
          setItem.lift === selectedSetLift &&
          setItem.session_id === selectedSetSessionId,
      ) ?? null,
    [selectedSetIndex, selectedSetLift, selectedSetSessionId, setHistory],
  );

  const timeAllocationSummary = useMemo(() => {
    const completedSets = setHistory.filter(
      (setItem) =>
        setItem.start_timestamp && (setItem.end_timestamp || setItem.timestamp),
    );
    if (completedSets.length === 0) return null;

    const setDurations = completedSets
      .map((setItem) => {
        const start = new Date(setItem.start_timestamp!).getTime();
        const end = new Date(
          setItem.end_timestamp ?? setItem.timestamp,
        ).getTime();
        return end > start ? (end - start) / 1000 : null;
      })
      .filter((duration): duration is number => duration != null);
    const restDurations = completedSets
      .map((setItem) => setItem.rest_duration_s)
      .filter(
        (duration): duration is number => duration != null && duration >= 0,
      );
    const averageSetS =
      setDurations.length > 0
        ? setDurations.reduce((sum, duration) => sum + duration, 0) /
          setDurations.length
        : null;
    const averageRestS =
      restDurations.length > 0
        ? restDurations.reduce((sum, duration) => sum + duration, 0) /
          restDurations.length
        : null;
    const nextSetStartAt =
      restStartTime && averageRestS != null
        ? new Date(restStartTime + averageRestS * 1000).toISOString()
        : null;

    return {
      averageSetS,
      averageRestS,
      nextSetStartAt,
    };
  }, [restStartTime, setHistory]);

  useEffect(() => {
    if (targetWeight !== null) {
      setInputTargetWeight(targetWeight.toString());
    } else {
      setInputTargetWeight("");
    }
  }, [targetWeight]);

  useEffect(() => {
    setInputLoad(formatLoadKg(currentLoad));
  }, [currentLoad]);

  const handleTargetWeightChange = (text: string) => {
    setInputTargetWeight(text);
    setTargetWeight(parseLoadKgInput(text));
  };

  const applyUserSelectedLoad = useCallback((requestedLoad: number) => {
    updateLoad(resolveUserSelectedSessionLoad(requestedLoad));
  }, [updateLoad]);

  const adjustLoad = (amount: number) => {
    applyUserSelectedLoad(currentLoad + amount);
  };

  const commitLoadInput = (text: string) => {
    if (!text.trim()) {
      setInputLoad(formatLoadKg(currentLoad));
      return;
    }

    const val = parseLoadKgInput(text);
    if (val == null) {
      setInputLoad(formatLoadKg(currentLoad));
      return;
    }

    applyUserSelectedLoad(val);
  };

  const handleToggleDropSetMode = () => {
    const nextMode = !isDropSetMode;
    setIsDropSetMode(nextMode);
    if (nextMode) setIsAmrapMode(false);
    setCurrentSetType((nextMode ? "drop" : "normal") as SetType);
  };

  const handleToggleAmrapMode = () => {
    const nextMode = !isAmrapMode;
    setIsAmrapMode(nextMode);
    if (nextMode) setIsDropSetMode(false);
    setCurrentSetType((nextMode ? "amrap" : "normal") as SetType);
  };

  const openRepDetail = async (setItem: SetData) => {
    setSelectedSetSessionId(setItem.session_id);
    setSelectedSetIndex(setItem.set_index);
    setSelectedSetLift(setItem.lift);
    setDetailSet(setItem);
    setSelectedSetReps(null);
    setDetailFormVideos([]);

    try {
      const [reps, videos] = await Promise.all([
        DatabaseService.getRepsForSet(
          setItem.session_id,
          setItem.lift,
          setItem.set_index,
        ),
        VideoRecordingService.getFormVideosForSet(
          setItem.session_id,
          setItem.lift,
          setItem.set_index,
        ),
      ]);
      setSelectedSetReps(reps);
      setDetailFormVideos(videos);
      setHistoricalSessionReps(
        setItem.session_id !== currentSession?.session_id
          ? {
              sessionId: setItem.session_id,
              reps,
            }
          : null,
      );
    } catch (error) {
      console.error("Failed to fetch set reps:", error);
      setSelectedSetReps(null);
      setDetailFormVideos([]);
      setHistoricalSessionReps(null);
    }

    setRepDetailVisible(true);
  };

  const refreshFormVideoCounts = useCallback(async () => {
    const sessionId = currentSession?.session_id;
    if (!settings.enable_video_recording || !sessionId) {
      setFormVideoCountsBySet({});
      return;
    }

    try {
      const videos =
        await VideoRecordingService.getFormVideosForSession(sessionId);
      const counts: Record<string, number> = {};
      for (const video of videos) {
        if (!video.lift || video.set_index == null) continue;
        const key = getSetKey(video.lift, video.set_index);
        counts[key] = (counts[key] ?? 0) + 1;
      }
      setFormVideoCountsBySet(counts);
    } catch (error) {
      console.warn("[SessionScreen] Failed to load form videos:", error);
      setFormVideoCountsBySet({});
    }
  }, [currentSession?.session_id, getSetKey, settings.enable_video_recording]);

  const handleOpenFormVideo = async (video: FormVideoRecord) => {
    try {
      const canOpen = await Linking.canOpenURL(video.local_uri);
      if (!canOpen) {
        Alert.alert("再生できません", "この動画URIを開けませんでした。");
        return;
      }
      await Linking.openURL(video.local_uri);
    } catch (error) {
      console.warn("[SessionScreen] Failed to open form video:", error);
      Alert.alert("再生エラー", "フォーム動画を開けませんでした。");
    }
  };

  const handleShareFormVideo = async (video: FormVideoRecord) => {
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("共有できません", "この端末では共有シートを開けません。");
        return;
      }
      const reps = (selectedSetReps ?? []).filter(
        (rep) => rep.lift === video.lift && rep.set_index === video.set_index,
      );
      const startMs = Date.parse(video.started_at);
      const reviewPackage = {
        schema: "repvelocoach.form-review.v1",
        review_id: `review_${video.id}`,
        created_at: new Date().toISOString(),
        video: {
          video_id: video.id,
          capture_id: video.capture_id ?? null,
          integrity_status: video.integrity_status ?? "legacy_unknown",
          duration_s: video.duration_s,
          file_size_bytes: video.file_size_bytes ?? null,
          file_hash: video.file_hash ?? null,
        },
        set: {
          session_id: video.session_id,
          lift: video.lift,
          set_index: video.set_index ?? null,
          load_kg: video.load_kg ?? null,
          started_at: video.started_at,
          ended_at: video.ended_at,
        },
        reps: reps.map((rep) => ({
          rep_index: rep.rep_index,
          mean_velocity: rep.mean_velocity,
          peak_velocity: rep.peak_velocity,
          rom_cm: rep.rom_cm,
          mean_power_w: rep.mean_power_w ?? null,
          heart_rate: rep.hr_bpm ?? null,
          offset_s:
            Number.isFinite(startMs) && rep.timestamp
              ? Math.max(0, (Date.parse(rep.timestamp) - startMs) / 1000)
              : null,
        })),
        user_question: "フォームとVBTの整合を確認してください。",
        app_build: Constants.nativeBuildVersion ?? "unknown",
      };
      // The user explicitly chooses this share. The manifest contains no local URI,
      // token, thumbnail, or video bytes; the system sheet owns the selected file.
      await Share.share({
        url: video.local_uri,
        title: `${video.lift} Set ${video.set_index ?? "-"} 監督レビュー`,
        message: JSON.stringify(reviewPackage, null, 2),
      });
    } catch (error) {
      console.warn("[SessionScreen] Failed to share form video:", error);
      Alert.alert("共有エラー", "フォーム動画の共有に失敗しました。");
    }
  };

  const handleTrimFormVideo = (video: FormVideoRecord) => {
    const currentTrim = parseFormVideoTrim(video.notes);
    const defaultValue =
      currentTrim != null
        ? `${currentTrim.trimStartS},${currentTrim.trimEndS}`
        : "3,2";

    Alert.prompt(
      "前後を切り出し",
      "元動画は残したまま、前後をカットした新しい動画を作ります。例: 3,2",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "作成",
          onPress: (value?: string) => {
            void (async () => {
              const parsed = parseTrimInput(value ?? "");
              if (!parsed || (parsed.trimStartS <= 0 && parsed.trimEndS <= 0)) {
                Alert.alert(
                  "入力エラー",
                  "前,後 の秒数で入力してください。例: 3,2",
                );
                return;
              }

              try {
                const trimmed = await VideoRecordingService.trimFormVideoRecord(
                  video,
                  parsed.trimStartS,
                  parsed.trimEndS,
                );
                setDetailFormVideos((current) => [trimmed, ...current]);
                await refreshFormVideoCounts();
                Alert.alert(
                  "作成完了",
                  "トリム済み動画を同じセットのFORM VIDEOSへ追加しました。",
                );
              } catch (error) {
                console.warn(
                  "[SessionScreen] Failed to trim form video:",
                  error,
                );
                Alert.alert(
                  "トリム失敗",
                  "動画の切り出しに失敗しました。元動画はそのまま残っています。",
                );
              }
            })();
          },
        },
      ],
      "plain-text",
      defaultValue,
    );
  };

  const handleDeleteFormVideo = (video: FormVideoRecord) => {
    Alert.alert(
      "動画の紐付け解除",
      "この動画をセット詳細から外します。動画ファイル本体は端末に残します。",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "解除",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await VideoRecordingService.deleteFormVideoRecord(video.id);
                setDetailFormVideos((current) =>
                  current.filter((item) => item.id !== video.id),
                );
                await refreshFormVideoCounts();
              } catch (error) {
                console.warn(
                  "[SessionScreen] Failed to delete form video metadata:",
                  error,
                );
                Alert.alert("解除失敗", "動画の紐付け解除に失敗しました。");
              }
            })();
          },
        },
      ],
    );
  };

  const showTooltip = (
    type: "MEAN_VELOCITY" | "PEAK_VELOCITY" | "VELOCITY_LOSS" | "ROM",
    currentValue?: number,
  ) => {
    const glossary = VELOCITY_GLOSSARY[type];
    let currentStatus: "good" | "warning" | "danger" | undefined;
    let currentValueStr: string | undefined;

    if (currentValue !== undefined) {
      currentValueStr = `${currentValue.toFixed(2)} ${type === "VELOCITY_LOSS" ? "%" : "m/s"}`;

      if (type === "MEAN_VELOCITY" || type === "PEAK_VELOCITY") {
        if (currentValue >= 1.0) currentStatus = "good";
        else if (currentValue >= 0.75) currentStatus = "warning";
        else currentStatus = "danger";
      } else if (type === "VELOCITY_LOSS") {
        if (currentValue <= 20) currentStatus = "good";
        else if (currentValue <= 30) currentStatus = "warning";
        else currentStatus = "danger";
      }
    }

    setTooltipData({
      term: glossary.term,
      definition: glossary.definition,
      targetRange: glossary.targetRange,
      currentStatus,
      currentValue: currentValueStr,
    });
    setTooltipVisible(true);
  };

  const handleLoadChange = (text: string) => {
    const val = parseFloat(text);
    if (isNaN(val)) return;
    applyUserSelectedLoad(val);
  };

  const handleVelocityLossThresholdChange = async (threshold: number) => {
    if (!currentExercise) return;
    const normalized = normalizeVelocityLossThreshold(threshold);
    const updatedExercise = {
      ...currentExercise,
      velocity_loss_threshold: normalized,
    };
    setCurrentExercise(updatedExercise);
    await ExerciseService.updateExercise(currentExercise.id, {
      velocity_loss_threshold: normalized,
    });
  };

  const handleApplySupervisorVlRecommendation = async () => {
    if (supervisorRecommendedVl == null) return;
    await handleVelocityLossThresholdChange(supervisorRecommendedVl);
  };

  const handleApplySupervisorRow = useCallback(async (row: SupervisorProgramRowV8) => {
    const target = normalizePlanMatchName(row.exercise_id);
    const display = normalizePlanMatchName(row.display_name);
    const exercise =
      availableExercises.find(
        (item) =>
          normalizePlanMatchName(item.id) === target ||
          normalizePlanMatchName(item.name) === target,
      ) ??
      availableExercises.find((item) => {
        const itemName = normalizePlanMatchName(item.name);
        return itemName === display || itemName.includes(target);
      });

    if (!exercise) {
      Alert.alert(
        "監督メニューの種目が未登録です",
        `${row.display_name}を種目マスタへ追加してから選択してください。`,
      );
      return;
    }

    setCurrentExercise(exercise);
    void SessionRecoveryService.saveLastExercise(exercise);
    setShowExerciseModal(false);
    setIsWarmupMode(false);
    setIsDropSetMode(false);
    setCurrentSetType("normal");
    if (row.load_kg != null && row.load_kg > 0) {
      applyUserSelectedLoad(row.load_kg);
    }
    if (row.reps != null && row.reps > 0) {
      updateReps(row.reps);
    }
    setPlannedSetCount(row.sets != null && row.sets > 0 ? row.sets : null);
    setPlannedRpe(row.rpe_target);

    const recommendedVl = row.vl_cap ?? row.vl_target;
    if (
      row.profile_mode !== "collect" &&
      recommendedVl != null &&
      Number.isFinite(recommendedVl)
    ) {
      const normalizedVl = normalizeVelocityLossThreshold(recommendedVl);
      const updatedExercise = {
        ...exercise,
        velocity_loss_threshold: normalizedVl,
      };
      setCurrentExercise(updatedExercise);
      await ExerciseService.updateExercise(exercise.id, {
        velocity_loss_threshold: normalizedVl,
      });
    }
  }, [
    applyUserSelectedLoad,
    availableExercises,
    setCurrentExercise,
    setCurrentSetType,
    setPlannedRpe,
    setPlannedSetCount,
    updateReps,
  ]);

  useEffect(() => {
    const token = quickLaunchToken?.trim();
    if (
      autoOpen !== "1" ||
      !token ||
      !supervisorRowId ||
      !supervisorWeekDay ||
      quickLaunchAppliedTokenRef.current === token ||
      supervisorProgramPlanState == null ||
      availableExercises.length === 0
    ) {
      return;
    }

    quickLaunchAppliedTokenRef.current = token;
    if (isSessionActive) {
      Alert.alert(
        "セッション中のため変更しません",
        "進行中のセッションを完了してから、ホームの監督メニューを選んでください。",
      );
      return;
    }
    if (!appliedSupervisorPlan) {
      Alert.alert(
        "監督メニューを適用できません",
        "適用済みの監督メニューがありません。",
      );
      return;
    }

    const location = parseProgramLocation(supervisorWeekDay);
    const row = location
      ? getSupervisorRowsForDay(appliedSupervisorPlan, location.week, `Day${location.day}`).find(
          (candidate) => candidate.row_id === supervisorRowId,
        )
      : null;
    if (!row) {
      Alert.alert(
        "監督メニュー行が見つかりません",
        "ホームを更新して、もう一度当日の行を選んでください。",
      );
      return;
    }

    const target = normalizePlanMatchName(row.exercise_id);
    const display = normalizePlanMatchName(row.display_name);
    const exercise = availableExercises.find(
      (item) =>
        normalizePlanMatchName(item.id) === target ||
        normalizePlanMatchName(item.name) === target ||
        normalizePlanMatchName(item.name) === display,
    );
    if (!exercise) {
      Alert.alert(
        "監督メニューの種目が未登録です",
        `${row.display_name}を種目マスタへ追加してから選択してください。`,
      );
      return;
    }

    readinessWeekDayTouchedRef.current = true;
    setReadinessWeekDay(supervisorWeekDay);
    setReadinessMainLift(inferMainLiftFromSupervisorRow(row));
    setProgramLocationHint(
      supervisorProgramPlanExecutable
        ? "ホームの監督メニューから設定"
        : `期限注意: ${supervisorProgramPlanStaleReason ?? "監督メニューが古い可能性があります"}`,
    );
    void handleApplySupervisorRow(row);
  }, [
    autoOpen,
    appliedSupervisorPlan,
    availableExercises,
    handleApplySupervisorRow,
    isSessionActive,
    quickLaunchToken,
    supervisorProgramPlanExecutable,
    supervisorProgramPlanState,
    supervisorProgramPlanStaleReason,
    supervisorRowId,
    supervisorWeekDay,
  ]);

  const handleExerciseSelect = (exercise: Exercise) => {
    setCurrentExercise(exercise);
    void SessionRecoveryService.saveLastExercise(exercise);
    setShowExerciseModal(false);
  };

  const handleExclude = async (repId: string, reason: string) => {
    await handleExcludeRep(repId, reason);
    if (detailSet) {
      DatabaseService.getRepsForSet(
        detailSet.session_id,
        detailSet.lift,
        detailSet.set_index,
      ).then(setSelectedSetReps);
    } else if (currentSession?.session_id && shouldLoadSessionReps) {
      DatabaseService.getRepsForSession(currentSession.session_id).then(
        setSessionAllReps,
      );
    }
  };

  const handleMarkSetupRep = async (repId: string) => {
    await handleExclude(repId, "setup_reaction");
  };

  const handleAddMissedRep = async (velocity?: number, load?: number) => {
    if (!currentSession?.session_id || !selectedSet) return;

    try {
      const targetSetReps =
        selectedSetReps ??
        repsBySetKey.get(getSetKey(selectedSet.lift, selectedSet.set_index)) ??
        [];
      const manualVelocity =
        typeof velocity === "number" && Number.isFinite(velocity)
          ? velocity
          : null;
      const manualLoad =
        typeof load === "number" && Number.isFinite(load) && load > 0
          ? load
          : selectedSet.load_kg;

      const newRep: RepData = {
        id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        session_id: currentSession.session_id,
        lift: selectedSet.lift,
        set_index: selectedSet.set_index,
        rep_index: targetSetReps.length + 1,
        load_kg: manualLoad,
        device_type: "manual",
        mean_velocity: manualVelocity,
        peak_velocity: null,
        rom_cm: null,
        rep_duration_ms: null,
        mean_power_w: null,
        timestamp: new Date().toISOString(),
        is_valid_rep: manualVelocity !== null,
        set_type: selectedSet.set_type,
        notes: manualVelocity !== null ? "手動追加（速度入力）" : "手動追加",
      };

      await DatabaseService.insertRep(newRep);
      await DatabaseService.recalculateAndUpdateSet(
        currentSession.session_id,
        selectedSet.lift,
        selectedSet.set_index,
      );
      const metrics = await DatabaseService.recalculateSetMetrics(
        currentSession.session_id,
        selectedSet.lift,
        selectedSet.set_index,
      );
      if (metrics) {
        updateSetHistory(selectedSet.set_index, selectedSet.lift, metrics);
      }
      setSelectedSetReps(
        await DatabaseService.getRepsForSet(
          currentSession.session_id,
          selectedSet.lift,
          selectedSet.set_index,
        ),
      );
      if (shouldLoadSessionReps) {
        await refreshSessionAllReps();
      }

      Alert.alert("成功", "レップを追加しました");
    } catch (error) {
      console.error("Failed to add rep:", error);
      Alert.alert("エラー", "レップの追加に失敗しました");
    }
  };

  const handleEditSetLoad = (setItem: SetData) => {
    setEditingSet(setItem);
  };

  const handleDeleteSet = (setItem: SetData) => {
    Alert.alert(
      "セットを削除",
      `${setItem.lift} / Set ${setItem.set_index} を削除しますか？関連するrepも削除されます。`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除",
          style: "destructive",
          onPress: async () => {
            try {
              await DatabaseService.deleteSet(
                setItem.session_id,
                setItem.set_index,
                setItem.lift,
              );
              removeSetFromHistory(setItem.set_index, setItem.lift);
              setSessionAllReps((current) =>
                current.filter(
                  (rep) =>
                    !(
                      rep.session_id === setItem.session_id &&
                      rep.set_index === setItem.set_index &&
                      rep.lift === setItem.lift
                    ),
                ),
              );
              if (
                detailSet?.session_id === setItem.session_id &&
                detailSet.set_index === setItem.set_index &&
                detailSet.lift === setItem.lift
              ) {
                setRepDetailVisible(false);
                setDetailSet(null);
                setSelectedSetReps(null);
              }
              if (
                editingSet?.session_id === setItem.session_id &&
                editingSet.set_index === setItem.set_index &&
                editingSet.lift === setItem.lift
              ) {
                setEditingSet(null);
              }
            } catch (error) {
              console.error("Failed to delete set:", error);
              Alert.alert("削除失敗", "セットの削除に失敗しました。");
            }
          },
        },
      ],
    );
  };

  const handleSaveSetEdits = async (values: {
    loadKg: number;
    lift: string;
    rpe?: number;
    notes: string;
    gearJson?: string | null;
  }) => {
    if (!currentSession?.session_id || !editingSet) return;

    try {
      const oldLift = editingSet.lift;
      const newLift = values.lift;

      await DatabaseService.updateSetEditableFields(
        currentSession.session_id,
        editingSet.set_index,
        editingSet.lift,
        {
          load_kg: values.loadKg,
          lift: newLift,
          rpe: values.rpe,
          notes: values.notes,
          gear_json: values.gearJson,
        },
      );

      // 種目名が変更された場合は、古い種目名でメトリクスを再計算してから新しい種目名で更新
      const metrics = await DatabaseService.recalculateSetMetrics(
        currentSession.session_id,
        oldLift,
        editingSet.set_index,
      );

      // 種目名が変更された場合は、新しい種目名で履歴を更新
      updateSetHistory(editingSet.set_index, oldLift, {
        lift: newLift,
        load_kg: values.loadKg,
        rpe: values.rpe,
        notes: values.notes,
        ...(values.gearJson !== undefined
          ? { gear_json: values.gearJson }
          : {}),
        ...(metrics ?? {}),
      });

      if (values.gearJson !== undefined) {
        const key = newLift.trim().toLowerCase();
        if (key) {
          setGearByLift((current) => ({
            ...current,
            [key]: values.gearJson!,
          }));
        }
      }

      setSelectedSetReps(
        await DatabaseService.getRepsForSet(
          currentSession.session_id,
          newLift,
          editingSet.set_index,
        ),
      );
      if (shouldLoadSessionReps) {
        await refreshSessionAllReps();
      }
      setEditingSet(null);
    } catch (error) {
      console.error("Failed to update set fields:", error);
      Alert.alert("保存失敗", "セット情報の更新に失敗しました。");
    }
  };

  // セッション開始処理
  const handleStartSession = async () => {
    if (!isConnected) {
      Alert.alert(
        "センサー未接続",
        "BLEセンサーを接続してからセッションを開始してください。",
      );
      return;
    }
    // UUID風のセッションIDを生成
    const startedAt = new Date().toISOString();
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    startSession(sessionId);
    publishBreathForgeSchedule("started", sessionId);
    // DBにセッションレコードを作成
    try {
      await DatabaseService.insertSession({
        session_id: sessionId,
        date: getJstTrainingDayId(startedAt),
        total_volume: 0,
        total_sets: 0,
        lifts: [],
        start_timestamp: startedAt,
        notes: buildSessionNotesWithReadiness(
          null,
          "",
          buildSessionReadinessPayload(),
        ),
      });
    } catch (e) {
      console.error("セッション作成失敗:", e);
    }
    void LiveShareService.sendEvent("session_started", {
      session_id: sessionId,
      date: getJstTrainingDayId(startedAt),
      start_timestamp: startedAt,
      current_lift: currentLift,
      current_load_kg: currentLoad,
    });
  };

  const handleConnectSimulator = async () => {
    const connected = await BLEService.connectSimulator();
    setConnectionStatus(connected);
  };

  const handleReconnectSensor = async () => {
    if (isReconnectingSensor) return;

    setIsReconnectingSensor(true);
    try {
      const connected = await BLEService.reconnect();
      // A BLE link alone is not enough for VBT. Reinstall the characteristic
      // monitor before reporting reconnect success, otherwise the UI can say
      // connected while all subsequent reps are silently lost.
      const monitoring = connected && (await BLEService.startNotifications());
      setConnectionStatus(Boolean(monitoring));
      if (!monitoring) {
        Alert.alert(
          "センサー再接続失敗",
          connected
            ? "接続は戻りましたが、VBTデータ受信を再開できませんでした。再接続してください。"
            : "センサーの電源と距離を確認してから、もう一度お試しください。",
        );
      }
    } finally {
      setIsReconnectingSensor(false);
    }
  };

  const handleSimulatedRep = () => {
    setConnectionStatus(true);
    BLEService.emitSimulatedRep({
      mean_velocity: 0.48,
      peak_velocity: 0.57,
      rom_cm: currentExercise?.category === "bench" ? 34 : 55,
      rep_duration_ms: 840,
    });
  };

  const handleRunSimulatedSet = async () => {
    if (!isSessionActive) {
      Alert.alert("セッション未開始", "先にセッションを開始してください。");
      return;
    }

    if (isPaused) {
      Alert.alert(
        "一時停止中",
        "次のセットを開始してからSIM SETを実行してください。",
      );
      return;
    }

    setIsSimulatingSet(true);
    try {
      setConnectionStatus(true);
      const baseVelocity =
        currentExercise?.category === "bench"
          ? 0.42
          : currentExercise?.category === "deadlift"
            ? 0.36
            : 0.48;
      await BLEService.runSimulatedSet({
        reps: Math.max(1, currentReps || 3),
        baseVelocity,
        velocityDropPerRep: 0.035,
        romCm: currentExercise?.category === "bench" ? 34 : 55,
        loadKg: currentLoad > 0 ? currentLoad : undefined,
      });

      setTimeout(() => {
        void finishSet();
        if (shouldLoadSessionReps) {
          void refreshSessionAllReps();
        }
      }, 1200);
    } finally {
      setIsSimulatingSet(false);
    }
  };

  const handleFinishSet = async () => {
    if (!isSessionActive) {
      Alert.alert("セッション未開始", "まずセッションを開始してください。");
      return;
    }

    await finishSet();
    if (shouldLoadSessionReps) {
      await refreshSessionAllReps();
    }
  };

  const handleOpenFormVideoRecorder = async () => {
    if (!currentSession?.session_id || !currentRecordingLift) {
      Alert.alert(
        "録画できません",
        "セッションを開始し、種目を選択してからフォーム動画を撮影してください。",
      );
      return;
    }

    try {
      await CrashReportService.saveVBTScreenContext({
        reason: "form_video_overlay_open_attempt",
        session_id: currentSession?.session_id ?? null,
        is_session_active: isSessionActive,
        is_paused: isPaused,
        pause_reason: pauseReason ?? null,
        is_connected: isConnected,
        sensor_input_muted: sensorInputMuted,
        current_lift: currentLift,
        current_exercise_name: currentExercise?.name ?? null,
        current_load: currentLoad,
        current_reps: currentReps,
        current_set_index: currentSetIndex,
        completed_set_count: setHistory.length,
        current_rep_count: repHistory.length,
        current_heart_rate: currentHeartRate,
        live_data: liveData,
        latest_completed_set:
          setHistory.length > 0 ? setHistory[setHistory.length - 1] : null,
        settings_snapshot: {
          lightweight_mode: Boolean(settings.enable_session_lightweight_mode),
          session_history: Boolean(settings.session_display_session_history),
          velocity_chart: Boolean(settings.session_display_velocity_chart),
          recent_history: Boolean(settings.session_display_recent_history),
          same_load_history: Boolean(
            settings.session_display_same_load_history,
          ),
          form_video: Boolean(settings.enable_video_recording),
        },
      });
    } catch (error) {
      console.warn(
        "[SessionScreen] Failed to save form video crash context:",
        error,
      );
    }

    if (settings.enable_form_video_ble_safe_mode) {
      sensorInputMutedBeforeVideoRef.current = sensorInputMuted;
      pauseBeforeVideoRef.current = { paused: isPaused, reason: pauseReason };
      setSensorInputMuted(true);
      setPaused(true, "manual");
    }

    setFormVideoOverlayVisible(true);
  };

  const handleCloseFormVideoRecorder = useCallback(() => {
    setFormVideoOverlayVisible(false);
    if (settings.enable_form_video_ble_safe_mode) {
      const previousMuted = sensorInputMutedBeforeVideoRef.current;
      const previousPause = pauseBeforeVideoRef.current;
      sensorInputMutedBeforeVideoRef.current = null;
      pauseBeforeVideoRef.current = null;
      setSensorInputMuted(previousMuted ?? false);
      if (previousPause && !previousPause.paused) {
        setPaused(false, previousPause.reason ?? undefined);
      }
    }
  }, [setPaused, setSensorInputMuted, settings.enable_form_video_ble_safe_mode]);

  const handleFormVideoOverlaySaved = useCallback(
    (record: FormVideoRecord) => {
      if (!record.lift || record.set_index == null) return;
      const key = getSetKey(record.lift, record.set_index);
      setFormVideoCountsBySet((previous) => ({
        ...previous,
        [key]: (previous[key] ?? 0) + 1,
      }));
    },
    [getSetKey],
  );

  const handleToggleSensorInputMuted = () => {
    setSensorInputMuted(!sensorInputMuted);
  };

  const handleSaveSessionNote = async () => {
    if (!currentSession?.session_id) return;
    try {
      const latestDbSession = await DatabaseService.getSession(
        currentSession.session_id,
      );
      const bodyWithLatestMarkers = mergeSessionBodyWithLatestMarkers(
        sessionNote,
        latestDbSession?.notes,
      );
      const notesWithReadiness = buildSessionNotesWithReadiness(
        null,
        bodyWithLatestMarkers,
        buildSessionReadinessPayload(),
      );
      await DatabaseService.updateSessionNotes(
        currentSession.session_id,
        notesWithReadiness,
      );
      setSessionNote(removeSessionSystemMarkers(notesWithReadiness));
      setEditingSessionNote(false);
      Alert.alert("保存完了", "セッションノートを保存しました");
    } catch (error) {
      console.error("Failed to save session note:", error);
      Alert.alert("エラー", "セッションノートの保存に失敗しました");
    }
  };

  const buildCurrentTrainingDayContext = useCallback(async (): Promise<{
    trainingDay: TrainingDayAggregate | null;
    daySets: SetData[];
    plannedRowsSummary: ReturnType<typeof summarizePlannedRowsForSets>;
  }> => {
    const anchorTimestamp =
      currentSession?.start_timestamp ??
      currentSession?.date ??
      new Date().toISOString();
    const currentTrainingDayId = getJstTrainingDayId(anchorTimestamp);
    const sessions = await DatabaseService.getSessions();
    const daySessions = sessions.filter(
      (session) =>
        getJstTrainingDayId(session.start_timestamp ?? session.date) ===
        currentTrainingDayId,
    );
    const daySetsByKey = new Map<string, SetData>();
    for (const session of daySessions) {
      const rows = await DatabaseService.getSetsForSession(session.session_id);
      for (const row of rows) {
        daySetsByKey.set(getTrendSetKey(row), row);
      }
    }
    for (const row of setHistory) {
      daySetsByKey.set(getTrendSetKey(row), row);
    }

    const daySets = [...daySetsByKey.values()];
    const sessionsWithReadiness: SessionData[] = daySessions.map((session) => ({
      ...session,
      readiness: parseSessionReadinessMarker(session.notes) ?? session.readiness ?? null,
    }));
    const trainingDay =
      buildTrainingDayAggregates(sessionsWithReadiness, daySets, {
        timezone: "Asia/Tokyo",
        accessorySetLimit: 6,
        blockedCandidateNames: [
          "追加プル種目",
          "追加肩腕種目",
          "計画外高RPE補助",
        ],
      }).find((row) => row.training_day_id === currentTrainingDayId) ?? null;

    return {
      trainingDay,
      daySets,
      plannedRowsSummary: summarizePlannedRowsForSets(
        appliedSupervisorRowsForToday,
        daySets,
        sessionDecision.plannedRowId ?? appliedCurrentSupervisorRow?.row_id ?? null,
      ),
    };
  }, [
    appliedCurrentSupervisorRow?.row_id,
    appliedSupervisorRowsForToday,
    currentSession?.date,
    currentSession?.start_timestamp,
    sessionDecision.plannedRowId,
    setHistory,
  ]);

  const recordChappyConsultation = useCallback(
    async (
      packetType: "full_context" | "latest_set",
      consultationId: string,
      promptSnapshot: string,
    ) => {
      if (!currentSession?.session_id) {
        throw new Error("相談履歴を保存するセッションがありません。");
      }
      const latestDbSession = await DatabaseService.getSession(
        currentSession.session_id,
      );
      const baseNotes =
        latestDbSession?.notes != null
          ? removeSessionReadinessMarkers(latestDbSession.notes)
          : currentSession.notes != null
            ? removeSessionReadinessMarkers(currentSession.notes)
            : sessionNote;
      const notesWithMarker = appendAiConsultationMarkerToNotes(baseNotes, {
        id: consultationId,
        created_at: new Date().toISOString(),
        packet_type: packetType,
        prompt_snapshot: promptSnapshot.slice(0, 20000),
      });
      const notesWithReadiness = buildSessionNotesWithReadiness(
        null,
        notesWithMarker,
        buildSessionReadinessPayload(),
      );
      await DatabaseService.updateSessionNotes(
        currentSession.session_id,
        notesWithReadiness,
      );
    },
    [
      buildSessionReadinessPayload,
      currentSession?.notes,
      currentSession?.session_id,
      sessionNote,
    ],
  );

  const handleCopyTrainingContext = async () => {
    try {
      const now = new Date();
      const activeLift = currentLift || currentExercise?.name || "Unknown";
      const readiness = buildSessionReadinessPayload();
      const supervisorPlanGuard = evaluateSupervisorPlanGuard(readiness);
      const roleResolution = resolveCurrentLiftDayRole(
        activeLift,
        readiness.main_lift,
        readiness.day_role,
      );
      const packetDayRole = roleResolution.requiredOptional;
      const dbSessionSets = currentSession?.session_id
        ? await DatabaseService.getSetsForSession(currentSession.session_id)
        : [];
      const packetSets = buildAIPacketSetList({
        storeSets: setHistory,
        dbSets: dbSessionSets,
        activeLift,
      });
      const latestCompletedSet = getLatestAIPacketSet(packetSets);
      const fixedObservation = buildFixedObservationSnapshot(
        latestCompletedSet,
        recentExerciseHistory,
      );
      const accessoryAndRom = buildAccessoryAndRomSnapshot(
        latestCompletedSet,
        recentExerciseHistory,
        currentExercise,
      );
      const packetAccessoryRMTarget = buildAccessoryRMTargetContext({
        lift: latestCompletedSet?.lift ?? activeLift,
        currentLoadKg: latestCompletedSet?.load_kg ?? currentLoad,
        currentReps: latestCompletedSet?.reps ?? currentReps,
        currentE1RMKg: latestCompletedSet?.e1rm ?? null,
        exercise: currentExercise,
        historySets: recentExerciseHistory,
        currentSet: latestCompletedSet,
      });
      const decisionWorkingSetsLast =
        sessionDecision.workingSets[sessionDecision.workingSets.length - 1] ??
        null;
      const latestSetWasAlreadyInDecisionWorkingSets =
        latestCompletedSet != null &&
        decisionWorkingSetsLast != null &&
        isSameSetTrendRow(decisionWorkingSetsLast, latestCompletedSet);
      const packetWorkingSets = ensureLatestSetInTrendRows(
        sessionDecision.workingSets,
        latestCompletedSet,
        sessionDecision.bestWorkingAV,
        sessionDecision.baselineROM,
      );
      const workingSetsLast =
        packetWorkingSets[packetWorkingSets.length - 1] ?? null;
      const latestSetIncludedInWorkingSets =
        latestCompletedSet != null &&
        workingSetsLast != null &&
        isSameSetTrendRow(workingSetsLast, latestCompletedSet);
      const latestSetReps =
        currentSession?.session_id && latestCompletedSet
          ? await getAIPacketRepsForSet(
              currentSession.session_id,
              latestCompletedSet,
            )
          : [];
      const currentSetRepsSource =
        repHistory.length > 0
          ? "current_unsaved_rep_history"
          : latestSetReps.length > 0
            ? "db_latest_completed_set"
            : latestCompletedSet
              ? "db_pending_or_no_rep_rows"
              : "none";
      const currentLoadMatchesLatest =
        latestCompletedSet == null ||
        isSameRecordedLoadKg(latestCompletedSet.load_kg ?? 0, currentLoad);
      const packetConsistencyWarnings = [
        latestCompletedSet == null ? "latest_completed_set_not_found" : null,
        latestCompletedSet != null && !latestSetIncludedInWorkingSets
          ? "latest_set_missing_from_working_sets"
          : null,
        latestCompletedSet != null && !latestSetWasAlreadyInDecisionWorkingSets
          ? "decision_working_sets_were_stale_before_packet_merge"
          : null,
        !currentLoadMatchesLatest
          ? "current_load_differs_from_latest_set"
          : null,
        latestCompletedSet != null &&
        repHistory.length === 0 &&
        latestSetReps.length === 0
          ? "latest_rep_details_not_loaded_yet"
          : null,
      ].filter((warning): warning is string => warning != null);
      const sessionDurationSeconds = sessionStartTime
        ? (Date.now() - sessionStartTime) / 1000
        : null;
      const currentSetReps = (
        repHistory.length > 0 ? repHistory : latestSetReps
      )
        .map(
          (rep) =>
            `| ${rep.rep_index} | ${formatNumber(rep.mean_velocity)} | ${formatNumber(rep.peak_velocity)} | ${formatNumber(rep.rom_cm, 1, " cm")} | ${rep.hr_bpm ?? "-"} | ${rep.is_excluded ? "除外" : rep.is_failed ? "失敗" : rep.is_valid_rep ? "有効" : "無効"} |`,
        )
        .join("\n");
      const workingRows = packetWorkingSets
        .map(
          (set) =>
            `| ${set.set} | ${formatNumber(set.load, 1)} | ${set.reps} | ${formatNumber(set.av)} | ${formatNumber(set.avChangePct, 1, "%")} | ${formatVLTrendTriplet(set)} | ${formatNumber(set.rom, 1, " cm")} | ${formatNumber(set.romDiff, 1, " cm")} | ${formatNumber(set.e1rm, 1)} | ${formatNumber(set.avgHR, 0)} | ${formatNumber(set.peakHR, 0)} | ${formatNullableSeconds(set.hrTo120)} | ${formatNullableSeconds(set.rest)} |`,
        )
        .join("\n");
      const sameLoadRows = sameLoadRecentHistory
        .slice(0, 8)
        .map(
          (set) =>
            `| ${set.timestamp.split("T")[0]} | ${set.lift} | ${formatNumber(set.load_kg, 2, " kg")} | ${set.reps} | ${formatNumber(set.avg_velocity)} | ${formatVelocityLossTriplet(set)} | ${formatNumber(set.avg_rom_cm, 1, " cm")} | ${formatNumber(set.e1rm, 1, " kg")} |`,
        )
        .join("\n");
      const accessoryTargetRows = packetAccessoryRMTarget.enabled
        ? packetAccessoryRMTarget.conversionTable
            .map(
              (row) =>
                `| ${row.reps} | ${formatAccessoryTargetLoad(row.targetLoadKg)} | ${formatNumber(row.targetE1RMKg, 1, "kg")} | ${formatNumber(row.currentLoadE1RMKg, 1, "kg")} | ${row.currentLoadHitsTarget == null ? "-" : row.currentLoadHitsTarget ? "yes" : "no"} |`,
            )
            .join("\n")
        : "";
      const consultationHistoryId = buildConsultationId({
        sessionId: currentSession?.session_id ?? "missing-session",
        packetType: "full_context",
        latestSet: latestCompletedSet,
        contentRevision: {
          set_count: packetSets.length,
          planned_row_id: sessionDecision.plannedRowId,
          plan_checksum: readiness.supervisor_plan_checksum ?? null,
          current_load: currentLoad,
          current_reps: currentReps,
        },
      });
      const trainingDayContext = await buildCurrentTrainingDayContext();
      const plannedRowsForToday = appliedSupervisorRowsForToday;
      const currentPlannedRow =
        plannedRowsForToday.find((row) => row.row_id === sessionDecision.plannedRowId) ??
        appliedCurrentSupervisorRow ??
        null;
      const plannedRowsSummary = trainingDayContext.plannedRowsSummary;
      const completedPlannedRows = plannedRowsSummary.completedRows.map(
        (summary) => ({
          ...summary.row,
          completed_sets: summary.completed_sets,
          planned_sets: summary.planned_sets,
        }),
      );
      const remainingPlannedRows = plannedRowsSummary.remainingRows.map(
        (summary) => ({
          ...summary.row,
          completed_sets: summary.completed_sets,
          planned_sets: summary.planned_sets,
          remaining_sets: summary.remaining_sets,
        }),
      );
      const appDecisionJson = {
        consultation: {
          chappy_consultation_history_id: consultationHistoryId,
          coach_role: "チャッピーコーチ",
          supervisor_role: "監督",
          adopted_result: "pending_user_review",
        },
        session: {
          lift: currentLift || currentExercise?.name || null,
          gear: formatBig3GearSummary(
            latestCompletedSet?.gear_json ?? resolveCurrentGearJson(currentLift),
          ),
          phase: settings.target_training_phase,
          week: currentProgramWeek,
          weekDay: readiness.week_day,
          mainLift: readiness.main_lift,
          dayRole: readiness.day_role,
          requiredOptional: packetDayRole,
          role_resolution_source: roleResolution.roleResolutionSource,
          goal: nextSetPurpose,
          currentHR: currentHeartRate,
          currentLoad,
          currentSet: currentSetIndex,
        },
        readiness: {
          ...readiness,
          required_optional: packetDayRole,
          role_resolution_source: roleResolution.roleResolutionSource,
        },
        supervisor_plan: {
          version: readiness.supervisor_plan_version ?? null,
          updated_at: readiness.supervisor_plan_updated_at ?? null,
          source: readiness.supervisor_plan_source ?? null,
          checksum: readiness.supervisor_plan_checksum ?? null,
          planned_row_id: sessionDecision.plannedRowId ?? readiness.planned_row_id ?? null,
          is_stale: readiness.supervisor_plan_is_stale ?? true,
          stale_reason: readiness.supervisor_plan_stale_reason ?? null,
          effective_from: readiness.supervisor_plan_effective_from ?? null,
          valid_until: readiness.supervisor_plan_valid_until ?? null,
          executable: readiness.supervisor_plan_executable ?? false,
          latest_guard: supervisorPlanGuard,
        },
        supervisor_program_plan: {
          plan_id: appliedSupervisorPlan?.plan_id ?? null,
          version: appliedSupervisorPlan?.version ?? null,
          updated_at: appliedSupervisorPlan?.updated_at ?? null,
          effective_from: appliedSupervisorPlan?.effective_from ?? null,
          valid_until: appliedSupervisorPlan?.valid_until ?? null,
          checksum: appliedSupervisorPlan?.checksum ?? null,
          is_stale: supervisorProgramPlanExecutionState.is_stale,
          stale_reason: supervisorProgramPlanStaleReason,
          executable: supervisorProgramPlanExecutable,
          week: currentProgramWeek,
          day: `Day${currentProgramDay}`,
          all_planned_rows: plannedRowsForToday,
          current_row: currentPlannedRow,
          completed_rows: completedPlannedRows,
          remaining_rows: remainingPlannedRows,
          planned_rows_completed: completedPlannedRows.length,
          planned_rows_remaining: remainingPlannedRows.length,
          app_warning:
            !supervisorProgramPlanExecutable
              ? "stale plan: warning only. logging and manual changes stay available; heavy/unplanned increases require user or Chappy confirmation"
              : null,
        },
        daily_context: {
          training_day_id: trainingDayContext.trainingDay?.training_day_id ?? null,
          total_session_sets:
            trainingDayContext.trainingDay?.total_sets ?? trainingDayContext.daySets.length,
          accessory_sets_after_main:
            trainingDayContext.trainingDay?.accessory_sets ?? null,
          total_volume_kg: trainingDayContext.trainingDay?.total_volume_kg ?? null,
          accessory_sets_remaining:
            trainingDayContext.trainingDay?.accessory_sets_remaining ?? null,
          session_stop_recommended:
            trainingDayContext.trainingDay?.session_stop_recommended ?? false,
        },
        packetConsistency: {
          latestSetId: latestCompletedSet
            ? getAIPacketSetId(latestCompletedSet)
            : null,
          latestSetLift: latestCompletedSet?.lift ?? null,
          latestSetLoad: latestCompletedSet?.load_kg ?? null,
          latestSetIndex: latestCompletedSet?.set_index ?? null,
          workingSetsLastSetId:
            workingSetsLast && latestCompletedSet
              ? `${getCanonicalExerciseName(latestCompletedSet.lift)}#${workingSetsLast.set}@${workingSetsLast.load}`
              : null,
          workingSetsLastLoad: workingSetsLast?.load ?? null,
          latestRepSource: currentSetRepsSource,
          latestSetWasAlreadyInDecisionWorkingSets,
          latestSetIncludedInWorkingSets,
          currentLoadMatchesLatest,
          warnings: packetConsistencyWarnings,
          supervisor_plan_warning:
            supervisorPlanGuard.status === "applied"
              ? null
              : (supervisorPlanGuard.message ?? "監督メニュー未適用/期限外"),
          role_conflict: roleResolution.roleConflict,
        },
        targets: {
          topSingleVelocityRange: targetVelocityRange,
          mvt: currentExercise?.mvt ?? lvpProfile?.mvt ?? null,
          maxVL: vbtProtocol.backoffVelocityLoss.max,
          romPriority:
            nextSetPurpose === "form_consistency" ||
            nextSetPurpose === "lvp_building"
              ? "high"
              : "medium",
        },
        appDecision: {
          recommendedNextLoad: sessionDecision.recommendedNextLoad,
          recommendedNextReps: sessionDecision.recommendedNextReps,
          recommendedRestMin: sessionDecision.recommendedRestMin,
          waitUntilHRBelow: sessionDecision.waitUntilHRBelow,
          candidate_source: sessionDecision.candidateSource,
          planned_row_id: sessionDecision.plannedRowId,
          rounding_increment_kg: sessionDecision.roundingIncrementKg,
          fatigueStatus: sessionDecision.fatigueStatus,
          formStatus: sessionDecision.formStatus,
          hrRecoveryStatus: sessionDecision.hrRecoveryStatus,
          prStatus: sessionDecision.prStatus,
          confidence: sessionDecision.confidence,
          session_termination_level:
            sessionDecision.sessionTerminationLabel,
          session_termination_code:
            sessionDecision.sessionTerminationLevel,
          exercise_termination:
            sessionDecision.exerciseTerminationLabel,
          exercise_termination_code:
            sessionDecision.exerciseTerminationLevel,
          allow_light_full_body_accessory:
            sessionDecision.allowLightFullBodyAccessory,
          should_suggest_additional_load:
            sessionDecision.shouldSuggestAdditionalLoad,
          reasons: sessionDecision.reasonBullets,
          passCriteria: sessionDecision.passCriteria,
          stopCriteria: sessionDecision.stopCriteria,
          nextSetQualityGoal: sessionDecision.nextSetQualityGoal,
          vlJudgementMetric: "vlLast",
        },
        velocityLoss: {
          vlJudgementMetric: "vlLast",
          description:
            "vl/vlAvgは最速repから平均速度、vlLastは最速repから最終rep、vlMinは最速repから最遅repの低下率",
        },
        fixedObservation,
        accessoryAndRom,
        accessory_rm_target: packetAccessoryRMTarget,
        summary: {
          allSetAvgAV: sessionDecision.allSetAvgAV,
          workingSetAvgAV: sessionDecision.workingSetAvgAV,
          recent3WorkingSetAvgAV: sessionDecision.recent3WorkingSetAvgAV,
          bestWorkingAV: sessionDecision.bestWorkingAV,
          sameLoadAVDropPct: sessionDecision.sameLoadAVDropPct,
          baselineROM: sessionDecision.baselineROM,
          latestROM: sessionDecision.latestROM,
          romDiff: sessionDecision.romDiff,
          avgHrTo120All: sessionDecision.avgHrTo120All,
          avgHrTo120Working: sessionDecision.avgHrTo120Working,
          hrDataReliability: sessionDecision.hrDataReliability,
          rom_change_pct: sessionDecision.romChangePct,
          rom_measurement_suspect: sessionDecision.romMeasurementSuspect,
          rom_excluded_decision_text: sessionDecision.romExcludedDecisionText,
        },
        heavy_exposure_single: sessionDecision.heavyExposureSingle,
        workingSets: packetWorkingSets,
        latestCompletedSet: latestCompletedSet
          ? {
              id: getAIPacketSetId(latestCompletedSet),
              lift: latestCompletedSet.lift,
              canonicalLift: getCanonicalExerciseName(latestCompletedSet.lift),
              set: latestCompletedSet.set_index,
              load: latestCompletedSet.load_kg,
              reps: latestCompletedSet.reps,
              av: latestCompletedSet.avg_velocity ?? null,
              vlAvg:
                latestCompletedSet.velocity_loss_avg ??
                latestCompletedSet.velocity_loss ??
                null,
              vlLast: latestCompletedSet.velocity_loss_last ?? null,
              vlMin: latestCompletedSet.velocity_loss_min ?? null,
              gear: formatBig3GearSummary(latestCompletedSet.gear_json),
              timestamp:
                latestCompletedSet.end_timestamp ??
                latestCompletedSet.timestamp,
            }
          : null,
        trendFlags: sessionDecision.trendFlags,
      };

      const context = [
        "# VBT相談パケット v3",
        `- 出力日時: ${formatDateTimeWithSeconds(now)}`,
        `- セッション時間: ${sessionDurationSeconds != null ? formatDurationSeconds(sessionDurationSeconds) : "-"}`,
        `- チャッピー相談履歴ID: ${consultationHistoryId}`,
        "",
        "## 1. 今すぐ判断してほしいこと",
        `- 現在種目: ${currentLift || currentExercise?.name || "未選択"}`,
        `- 使用ギア: ${formatBig3GearSummary(resolveCurrentGearJson(currentLift))}`,
        `- 現在重量: ${formatNumber(currentLoad, 2, " kg")}`,
        `- 最新完了セット: ${latestCompletedSet ? `${latestCompletedSet.lift} Set ${latestCompletedSet.set_index} / ${formatNumber(latestCompletedSet.load_kg, 2, " kg")} × ${latestCompletedSet.reps}` : "-"}`,
        `- AI反映チェック: ${latestSetIncludedInWorkingSets ? "最新セットはworkingSetsに含まれています" : "警告: 最新セットがworkingSets末尾と一致していません"}`,
        `- 最新rep参照元: ${currentSetRepsSource}`,
        `- 役割解決: ${packetDayRole} / ${roleResolution.roleResolutionSource}`,
        packetConsistencyWarnings.length > 0
          ? `- 整合性警告: ${packetConsistencyWarnings.join(" / ")}`
          : "- 整合性警告: なし",
        `- 次セット候補: ${sessionDecision.recommendedNextLoad != null ? `${formatLoadKg(sessionDecision.recommendedNextLoad)}kg × ${sessionDecision.recommendedNextReps ?? currentReps}` : "-"}`,
        `- 次セット品質目標: ${sessionDecision.nextSetQualityGoal?.summary ?? "完了セット後に表示"}`,
        `- 候補根拠: ${sessionDecision.candidateSource} / planned_row_id=${sessionDecision.plannedRowId ?? "-"} / ${sessionDecision.roundingIncrementKg}kg刻み`,
        `- 種目終了判定: ${sessionDecision.exerciseTerminationLabel}`,
        `- セッション終了判定: ${sessionDecision.sessionTerminationLabel}`,
        `- 今日の目的: ${nextSetPurposeLabel}`,
        "- 迷っていること:",
        "  - 重量を維持するか",
        "  - 落とすか",
        "  - 休憩を伸ばすか",
        "  - 種目を終了するか",
        "",
        "## 2. 今日の目的・メニュー",
        `- 期分け: ${settings.target_training_phase}`,
        `- ブロック週: Week ${currentProgramWeek}`,
        `- Week-Day: ${readiness.week_day ?? "-"}`,
        `- 適用中監督メニュー: ${appliedSupervisorPlan?.version ?? "未適用"} / checksum ${appliedSupervisorPlan?.checksum ?? "-"}`,
        `- 監督メニュー状態: ${supervisorProgramPlanExecutable ? "active/executable" : "stale/not executable"} / reason ${supervisorProgramPlanStaleReason ?? "-"} / effective ${appliedSupervisorPlan?.effective_from ?? "-"} / valid_until ${appliedSupervisorPlan?.valid_until ?? "-"} / planned rows ${plannedRowsForToday.length}`,
        `- 予定行完了/残り: ${completedPlannedRows.length} / ${remainingPlannedRows.length}`,
        `- JST同日合計: ${trainingDayContext.trainingDay?.total_sets ?? trainingDayContext.daySets.length} sets / 補助 ${trainingDayContext.trainingDay?.accessory_sets ?? "-"} sets / volume ${formatNumber(trainingDayContext.trainingDay?.total_volume_kg, 1, "kg")}`,
        `- 主種目: ${readiness.main_lift ?? "-"} / 現在種目の扱い: ${currentDayRoleLabel}`,
        `- 減量中: ${readiness.dieting == null ? "-" : readiness.dieting ? "yes" : "no"}`,
        `- 睡眠: ${readiness.sleep_quality ?? "-"}`,
        `- 痛み: ${readiness.pain_area ?? "-"} / ${readiness.pain_score ?? "-"} /10`,
        `- 前回回復: ${readiness.recovery_status ?? "-"} / 筋肉痛 ${readiness.recovery_soreness_score ?? "-"}/10 / 残る筋群 ${(readiness.recovery_muscles ?? []).join(", ") || "-"}`,
        `- 今日の狙い: ${blockWeekPlan.focus}`,
        `- 予定重量/回数/セット: ${formatNumber(currentLoad, 2, " kg")} × ${currentReps} / ${plannedSetText}`,
        `- 予定RPE: ${plannedRpeText}`,
        `- 目標速度帯: ${targetVelocityRange ? `${targetVelocityRange[0]}〜${targetVelocityRange[1]} m/s` : topSingleTargetText}`,
        `- 許容VL: ${vbtProtocol.backoffVelocityLoss.min}〜${vbtProtocol.backoffVelocityLoss.max}%`,
        `- ROM重視度: ${nextSetPurpose === "form_consistency" || nextSetPurpose === "lvp_building" ? "高" : "中"}`,
        "",
        "## 3. アプリ側の暫定判定",
        `- 推奨次重量: ${sessionDecision.recommendedNextLoad != null ? `${formatLoadKg(sessionDecision.recommendedNextLoad)} kg` : "-"}`,
        `- 推奨休憩: HR${sessionDecision.waitUntilHRBelow ?? "-"}以下 / ${sessionDecision.recommendedRestMin ?? "-"}分目安`,
        `- ROM測定疑い: ${sessionDecision.romMeasurementSuspect ? "yes" : "no"}${sessionDecision.romExcludedDecisionText ? ` / ${sessionDecision.romExcludedDecisionText}` : ""}`,
        sessionDecision.heavyExposureSingle
          ? `- Heavy exposure single: ${sessionDecision.heavyExposureSingle.loadKg}kg / ${sessionDecision.heavyExposureSingle.status ?? "available"} / ${sessionDecision.heavyExposureSingle.block_reason ?? sessionDecision.heavyExposureSingle.rpeTarget}`
          : "- Heavy exposure single: 対象外",
        `- 疲労判定: ${getDecisionLabel(sessionDecision.fatigueStatus)}`,
        `- フォーム判定: ${getDecisionLabel(sessionDecision.formStatus)}`,
        `- HR回復判定: ${getDecisionLabel(sessionDecision.hrRecoveryStatus)}`,
        `- PR判定: ${getDecisionLabel(sessionDecision.prStatus)}`,
        `- 判定信頼度: ${sessionDecision.confidence}`,
        `- 種目終了判定: ${sessionDecision.exerciseTerminationLabel}`,
        `- セッション終了判定: ${sessionDecision.sessionTerminationLabel}`,
        `- 理由: ${sessionDecision.reasonBullets.join(" / ")}`,
        `- 合格ライン: ${sessionDecision.passCriteria.join(" / ")}`,
        `- 終了条件: ${sessionDecision.stopCriteria.join(" / ")}`,
        "",
        "## 4. 作業セットのみの要約",
        "| set | load | reps | AV | AV変化 | VL avg/last/min | ROM | ROM差 | e1RM | avgHR | peakHR | HR→120 | rest |",
        "|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
        workingRows || "| - | - | - | - | - | - | - | - | - | - | - | - | - |",
        "",
        "## 5. 直近セットの詳細",
        "| rep | mean v | peak v | ROM | HR | status |",
        "|---:|---:|---:|---:|---:|---|",
        currentSetReps || "| - | - | - | - | - | - |",
        "",
        "## 6. 今日のトレンド",
        `- 全セット平均AV: ${formatNumber(sessionDecision.allSetAvgAV)} m/s`,
        `- 作業セット平均AV: ${formatNumber(sessionDecision.workingSetAvgAV)} m/s`,
        `- 直近3作業セット平均AV: ${formatNumber(sessionDecision.recent3WorkingSetAvgAV)} m/s`,
        `- 同重量AV推移: ${sessionDecision.sameLoadTrendText}`,
        `- ROM推移: ${sessionDecision.romTrendText}`,
        `- HR→120推移: ${sessionDecision.hrTo120TrendText}`,
        `- HR→120平均 全体: ${formatNullableSeconds(sessionDecision.avgHrTo120All)}`,
        `- HR→120平均 作業セット: ${formatNullableSeconds(sessionDecision.avgHrTo120Working)}`,
        "- HR→130/135平均: 未計測（現在は120到達時間のみ保存）",
        `- e1RM推移: ${sessionDecision.e1rmTrendText}`,
        `- 現在HR: ${currentHeartRate ?? "-"} bpm`,
        `- データ欠損/注意点: HR信頼度 ${sessionDecision.hrDataReliability}`,
        fixedObservation
          ? `- 固定観測ラダー: ${fixedObservation.stepLoad}kg / ${fixedObservation.recommendation} / baseline ${formatNumber(fixedObservation.sameLoadBaselineAV)} m/s / 差 ${formatNumber(fixedObservation.velocityDropPct, 1, "%")}`
          : "- 固定観測ラダー: 対象外またはbaseline収集中",
        accessoryAndRom?.romMeasurementWarning
          ? `- ROM警告: ${accessoryAndRom.romMeasurementWarning} / 基準 ${formatNumber(accessoryAndRom.romBaseline, 1, " cm")} / 差 ${formatNumber(accessoryAndRom.romChangePct, 1, "%")}`
          : "- ROM警告: なし",
        accessoryAndRom?.isAccessory
          ? `- 補助種目PR候補: e1RM ${accessoryAndRom.e1rmPR ? "yes" : "no"} / 同重量rep ${accessoryAndRom.sameLoadRepPR ? "yes" : "no"} / 同重量volume ${accessoryAndRom.sameLoadVolumePR ? "yes" : "no"}`
          : "- 補助種目PR候補: 対象外",
        packetAccessoryRMTarget.enabled
          ? `- 補助RM目標: 5〜15rep / 目標e1RM ${formatNumber(packetAccessoryRMTarget.targetE1RMKg, 1, "kg")} / ${packetAccessoryRMTarget.targetSource === "previous_best" ? "過去Best更新狙い" : "初回基準作成"}`
          : "- 補助RM目標: 対象外",
        "",
        "## 7. PR判定用情報",
        `- 同種目履歴: ${recentExerciseHistory.length}件`,
        `- 同重量履歴: ${sameLoadRecentHistory.length}件`,
        `- 今日が初回ベースラインか: ${sessionDecision.prStatus === "baseline" ? "yes" : "no"}`,
        `- PR判定から除外すべきセット: ${sessionDecision.prStatus === "excluded" ? "ROM/ウォームアップ/条件不一致の可能性あり" : "-"}`,
        "- ROM条件を満たしたセットのみでPR判定するか: yes",
        "",
        "## 8. 直近同重量履歴",
        "| date | lift | load | reps | AV | VL avg/last/min | ROM | e1RM |",
        "|---|---|---:|---:|---:|---:|---:|---:|",
        sameLoadRows || "| - | - | - | - | - | - | - | - |",
        "",
        "## 9. 補助種目 5〜15rep換算表",
        "| reps | 目標重量 | 目標e1RM | 現在重量ならe1RM | 現在重量で達成 |",
        "|---:|---:|---:|---:|---|",
        accessoryTargetRows || "| - | - | - | - | - |",
        "",
        "## 10. AI用JSON",
        "```json",
        JSON.stringify(appDecisionJson, null, 2),
        "```",
        "",
        "## 11. ChatGPTへの依頼",
        "下の実測データだけを根拠に、疲労度、次セット重量、休憩時間、今日の狙いから外れていないか、PR扱いするかを実用的に判断してください。断定しすぎず、理由と条件つきで提案してください。",
      ].join("\n");

      let consultationSaved = true;
      try {
        await recordChappyConsultation(
          "full_context",
          consultationHistoryId,
          context,
        );
      } catch (error) {
        consultationSaved = false;
        console.warn(
          "[SessionScreen] Chappy packet copied but consultation was not saved:",
          error,
        );
      }
      await Clipboard.setStringAsync(context);
      const openResult = await openChatGPT();
      const unsavedWarning = consultationSaved
        ? ""
        : "\n注意: コピーは完了しましたが、相談履歴は保存できませんでした。";
      Alert.alert(
        openResult === "none" ? "コピーしました" : "コピーしてGPTを開きました",
        openResult === "app"
          ? `ChatGPTアプリを開きました。入力欄へ貼り付けて送信してください。${unsavedWarning}`
          : openResult === "web"
            ? `ChatGPT Webを開きました。入力欄へ貼り付けて送信してください。${unsavedWarning}`
            : `VBT相談パケット v3 をコピーしました。${unsavedWarning}`,
      );
    } catch (error) {
      console.error("[SessionScreen] Failed to copy training context:", error);
      Alert.alert(
        "コピー失敗",
        "トレーニング状況のコピーに失敗しました。セッションは保存されたままです。",
      );
    }
  };

  const handleCopyLatestSetSupervisorPacket = async () => {
    try {
      const activeLift = currentLift || currentExercise?.name || "Unknown";
      const readiness = buildSessionReadinessPayload();
      const supervisorPlanGuard = evaluateSupervisorPlanGuard(readiness);
      const roleResolution = resolveCurrentLiftDayRole(
        activeLift,
        readiness.main_lift,
        readiness.day_role,
      );
      const packetDayRole = roleResolution.requiredOptional;
      const dbSessionSets = currentSession?.session_id
        ? await DatabaseService.getSetsForSession(currentSession.session_id)
        : [];
      const packetSets = buildAIPacketSetList({
        storeSets: setHistory,
        dbSets: dbSessionSets,
        activeLift,
      });
      const latestSet = getLatestAIPacketSet(packetSets);
      if (!latestSet) {
        Alert.alert("監督パケットなし", "完了セットがまだありません。");
        return;
      }
      const fixedObservation = buildFixedObservationSnapshot(
        latestSet,
        recentExerciseHistory,
      );
      const accessoryAndRom = buildAccessoryAndRomSnapshot(
        latestSet,
        recentExerciseHistory,
        currentExercise,
      );
      const packetAccessoryRMTarget = buildAccessoryRMTargetContext({
        lift: latestSet.lift,
        currentLoadKg: latestSet.load_kg,
        currentReps: latestSet.reps,
        currentE1RMKg: latestSet.e1rm ?? null,
        exercise: currentExercise,
        historySets: recentExerciseHistory,
        currentSet: latestSet,
      });
      const accessoryTargetRows = packetAccessoryRMTarget.enabled
        ? packetAccessoryRMTarget.conversionTable
            .map(
              (row) =>
                `| ${row.reps} | ${formatAccessoryTargetLoad(row.targetLoadKg)} | ${formatNumber(row.targetE1RMKg, 1, "kg")} | ${formatNumber(row.currentLoadE1RMKg, 1, "kg")} | ${row.currentLoadHitsTarget == null ? "-" : row.currentLoadHitsTarget ? "yes" : "no"} |`,
            )
            .join("\n")
        : "";

      const reps = currentSession?.session_id
        ? await getAIPacketRepsForSet(currentSession.session_id, latestSet)
        : [];
      const validReps = reps.filter(
        (rep) => !rep.is_excluded && !rep.is_failed && rep.is_valid_rep,
      );
      const firstRep = validReps[0] ?? null;
      const lastRep = validReps[validReps.length - 1] ?? null;
      const rpeState = normalizeRpe(latestSet.rpe);
      const consultationHistoryId = buildConsultationId({
        sessionId: currentSession?.session_id ?? latestSet.session_id,
        packetType: "latest_set",
        latestSet,
        contentRevision: {
          planned_row_id: sessionDecision.plannedRowId,
          plan_checksum: readiness.supervisor_plan_checksum ?? null,
        },
      });
      const trainingDayContext = await buildCurrentTrainingDayContext();
      const supervisorJson = {
        consultation: {
          chappy_consultation_history_id: consultationHistoryId,
          coach_role: "チャッピーコーチ",
          supervisor_role: "監督",
          adopted_result: "pending_user_review",
        },
        supervisor_plan: {
          version: readiness.supervisor_plan_version ?? null,
          updated_at: readiness.supervisor_plan_updated_at ?? null,
          source: readiness.supervisor_plan_source ?? null,
          checksum: readiness.supervisor_plan_checksum ?? null,
          planned_row_id: sessionDecision.plannedRowId ?? readiness.planned_row_id ?? null,
          is_stale: readiness.supervisor_plan_is_stale ?? true,
          stale_reason: readiness.supervisor_plan_stale_reason ?? null,
          effective_from: readiness.supervisor_plan_effective_from ?? null,
          valid_until: readiness.supervisor_plan_valid_until ?? null,
          executable: readiness.supervisor_plan_executable ?? false,
          latest_guard: supervisorPlanGuard,
          warning:
            supervisorPlanGuard.status === "applied"
              ? null
              : (supervisorPlanGuard.message ?? "監督メニュー未適用/期限外"),
        },
        daily_context: {
          training_day_id: trainingDayContext.trainingDay?.training_day_id ?? null,
          total_session_sets:
            trainingDayContext.trainingDay?.total_sets ?? trainingDayContext.daySets.length,
          accessory_sets_after_main:
            trainingDayContext.trainingDay?.accessory_sets ?? null,
          session_stop_recommended:
            trainingDayContext.trainingDay?.session_stop_recommended ?? false,
        },
        termination: {
          session_termination_level: sessionDecision.sessionTerminationLevel,
          session_termination_label: sessionDecision.sessionTerminationLabel,
          exercise_termination_level: sessionDecision.exerciseTerminationLevel,
          exercise_termination_label: sessionDecision.exerciseTerminationLabel,
          allow_light_full_body_accessory:
            sessionDecision.allowLightFullBodyAccessory,
          should_suggest_additional_load:
            sessionDecision.shouldSuggestAdditionalLoad,
        },
        date: getJstTrainingDayId(),
        session_id: currentSession?.session_id ?? latestSet.session_id,
        week_day: readiness.week_day ?? `Week${currentProgramWeek}`,
        main_lift: readiness.main_lift,
        day_role: readiness.day_role,
        required_optional: packetDayRole,
        role_resolution_source: roleResolution.roleResolutionSource,
        role_conflict: roleResolution.roleConflict,
        lift: latestSet.lift,
        canonical_lift: getCanonicalExerciseName(latestSet.lift),
        planned: {
          load_kg: currentLoad,
          reps: currentReps,
          sets: plannedSetCount,
          rpe: plannedRpe,
          candidate_source: sessionDecision.candidateSource,
          planned_row_id: sessionDecision.plannedRowId,
          rounding_increment_kg: sessionDecision.roundingIncrementKg,
        },
        next_set_candidate: {
          load_kg: sessionDecision.recommendedNextLoad,
          reps: sessionDecision.recommendedNextReps ?? currentReps,
          candidate_source: sessionDecision.candidateSource,
          planned_row_id: sessionDecision.plannedRowId,
          rounding_increment_kg: sessionDecision.roundingIncrementKg,
          rest_min: sessionDecision.recommendedRestMin,
          wait_until_hr_below: sessionDecision.waitUntilHRBelow,
          quality_goal: sessionDecision.nextSetQualityGoal,
        },
        rom_decision: {
          rom_measurement_suspect: sessionDecision.romMeasurementSuspect,
          rom_change_pct: sessionDecision.romChangePct,
          rom_excluded_decision_text: sessionDecision.romExcludedDecisionText,
        },
        heavy_exposure_single: sessionDecision.heavyExposureSingle,
        actual: {
          load_kg: latestSet.load_kg,
          reps: latestSet.reps,
          set_index: latestSet.set_index,
          gear: formatBig3GearSummary(latestSet.gear_json),
          completed_at: latestSet.end_timestamp ?? latestSet.timestamp,
        },
        velocity: {
          first_rep_mps: firstRep?.mean_velocity ?? null,
          last_rep_mps: lastRep?.mean_velocity ?? null,
          avg_mps: latestSet.avg_velocity ?? null,
          vl_avg_pct:
            latestSet.velocity_loss_avg ?? latestSet.velocity_loss ?? null,
          vl_last_pct: latestSet.velocity_loss_last ?? null,
          vl_min_pct: latestSet.velocity_loss_min ?? null,
        },
        rpe: rpeState.value,
        rpe_status: rpeState.status,
        planned_rpe: plannedRpe ?? null,
        readiness: {
          ...readiness,
          required_optional: packetDayRole,
          role_resolution_source: roleResolution.roleResolutionSource,
        },
        fixedObservation,
        accessoryAndRom,
        accessory_rm_target: packetAccessoryRMTarget,
        notes: latestSet.notes ?? null,
      };
      const packet = [
        "# One-Set Supervisor Packet",
        `出力日時: ${formatDateTimeWithSeconds(new Date())}`,
        `チャッピー相談履歴ID: ${consultationHistoryId}`,
        `Week-Day: ${readiness.week_day ?? `Week${currentProgramWeek}`}`,
        `主種目: ${readiness.main_lift ?? "-"} / 現在種目の扱い: ${currentDayRoleLabel}`,
        `役割解決: ${packetDayRole} / ${roleResolution.roleResolutionSource}`,
        `種目終了判定: ${sessionDecision.exerciseTerminationLabel}`,
        `セッション終了判定: ${sessionDecision.sessionTerminationLabel}`,
        `JST同日合計: ${trainingDayContext.trainingDay?.total_sets ?? trainingDayContext.daySets.length} sets / 補助 ${trainingDayContext.trainingDay?.accessory_sets ?? "-"} sets`,
        `種目: ${latestSet.lift}`,
        `使用ギア: ${formatBig3GearSummary(latestSet.gear_json)}`,
        `予定: ${formatNumber(currentLoad, 2, "kg")} x ${currentReps} / ${plannedSetText} / ${plannedRpeText}`,
        `次セット候補: ${sessionDecision.recommendedNextLoad != null ? `${formatLoadKg(sessionDecision.recommendedNextLoad)}kg x ${sessionDecision.recommendedNextReps ?? currentReps}` : "-"} / ${sessionDecision.candidateSource} / ${sessionDecision.roundingIncrementKg}kg刻み`,
        `次セット品質目標: ${sessionDecision.nextSetQualityGoal?.summary ?? "完了セット後に表示"}`,
        `推奨休憩: HR${sessionDecision.waitUntilHRBelow ?? "-"}以下 / ${sessionDecision.recommendedRestMin ?? "-"}分`,
        `実施: ${formatNumber(latestSet.load_kg, 2, "kg")} x ${latestSet.reps} / Set ${latestSet.set_index}`,
        `初速: ${formatNumber(firstRep?.mean_velocity)} m/s`,
        `終速: ${formatNumber(lastRep?.mean_velocity)} m/s`,
        `VL_avg: ${formatNumber(latestSet.velocity_loss_avg ?? latestSet.velocity_loss, 1, "%")}`,
        `VL_last: ${formatNumber(latestSet.velocity_loss_last, 1, "%")}`,
        `RPE: ${rpeState.status === "unknown" ? "unknown" : rpeState.value}`,
        `痛み: ${readiness.pain_area ?? "-"} / ${readiness.pain_score ?? "-"} /10`,
        `減量/睡眠: ${readiness.dieting == null ? "-" : readiness.dieting ? "減量中" : "通常"} / ${readiness.sleep_quality ?? "-"}`,
        `前回回復: ${readiness.recovery_status ?? "-"} / 筋肉痛 ${readiness.recovery_soreness_score ?? "-"}/10 / 残る筋群 ${(readiness.recovery_muscles ?? []).join(", ") || "-"}`,
        fixedObservation
          ? `固定観測: ${fixedObservation.stepLoad}kg / ${fixedObservation.recommendation} / 差 ${formatNumber(fixedObservation.velocityDropPct, 1, "%")}`
          : "固定観測: 対象外",
        accessoryAndRom?.romMeasurementWarning
          ? `ROM警告: ${accessoryAndRom.romMeasurementWarning} / 差 ${formatNumber(accessoryAndRom.romChangePct, 1, "%")}`
          : "ROM警告: なし",
        `ROM測定疑い: ${sessionDecision.romMeasurementSuspect ? "yes" : "no"}${sessionDecision.romExcludedDecisionText ? ` / ${sessionDecision.romExcludedDecisionText}` : ""}`,
        sessionDecision.heavyExposureSingle
          ? `Heavy exposure single: ${sessionDecision.heavyExposureSingle.loadKg}kg / ${sessionDecision.heavyExposureSingle.status ?? "available"} / ${sessionDecision.heavyExposureSingle.block_reason ?? sessionDecision.heavyExposureSingle.rpeTarget}`
          : "Heavy exposure single: 対象外",
        accessoryAndRom?.isAccessory
          ? `補助PR候補: e1RM ${accessoryAndRom.e1rmPR ? "yes" : "no"} / rep ${accessoryAndRom.sameLoadRepPR ? "yes" : "no"} / volume ${accessoryAndRom.sameLoadVolumePR ? "yes" : "no"}`
          : "補助PR候補: 対象外",
        packetAccessoryRMTarget.enabled
          ? `補助RM目標: 5〜15rep / 目標e1RM ${formatNumber(packetAccessoryRMTarget.targetE1RMKg, 1, "kg")} / ${packetAccessoryRMTarget.targetSource === "previous_best" ? "過去Best更新狙い" : "初回基準作成"}`
          : "補助RM目標: 対象外",
        `メモ: ${latestSet.notes ?? "-"}`,
        "",
        "## 補助種目 5〜15rep換算表",
        "| reps | 目標重量 | 目標e1RM | 現在重量ならe1RM | 現在重量で達成 |",
        "|---:|---:|---:|---:|---|",
        accessoryTargetRows || "| - | - | - | - | - |",
        "",
        "```json",
        JSON.stringify(supervisorJson, null, 2),
        "```",
      ].join("\n");

      let consultationSaved = true;
      try {
        await recordChappyConsultation(
          "latest_set",
          consultationHistoryId,
          packet,
        );
      } catch (error) {
        consultationSaved = false;
        console.warn(
          "[SessionScreen] Latest-set packet copied but consultation was not saved:",
          error,
        );
      }
      await Clipboard.setStringAsync(packet);
      const openResult = await openChatGPT();
      const unsavedWarning = consultationSaved
        ? ""
        : "\n注意: コピーは完了しましたが、相談履歴は保存できませんでした。";
      Alert.alert(
        openResult === "none"
          ? "コピーしました"
          : "監督パケットをコピーしました",
        openResult === "none"
          ? `最新1セット分の監督パケットをコピーしました。${unsavedWarning}`
          : `ChatGPTへ貼り付けて監督に相談してください。${unsavedWarning}`,
      );
    } catch (error) {
      console.error("[SessionScreen] Failed to copy supervisor packet:", error);
      Alert.alert("コピー失敗", "監督パケットのコピーに失敗しました。");
    }
  };

  const handleCopyFreezeDiagnostic = async () => {
    try {
      const recovery = await SessionRecoveryService.getActiveSession();
      const dbSets = currentSession?.session_id
        ? await DatabaseService.getSetsForSession(currentSession.session_id)
        : [];
      const dbReps = currentSession?.session_id
        ? await DatabaseService.getRepsForSession(currentSession.session_id)
        : [];
      const lastSets = (dbSets.length > 0 ? dbSets : setHistory)
        .slice(-10)
        .map(
          (set) =>
            `| ${set.set_index} | ${set.lift} | ${formatNumber(set.load_kg, 2, " kg")} | ${set.reps} | ${formatNumber(set.avg_velocity)} | ${formatVelocityLossTriplet(set)} | ${formatNumber(set.avg_power_w, 0, " W")} | ${set.start_timestamp ?? "-"} | ${set.end_timestamp ?? set.timestamp ?? "-"} |`,
        )
        .join("\n");
      const currentReps = repHistory
        .map(
          (rep) =>
            `| ${formatClockTimeWithSeconds(rep.timestamp) ?? "-"} | ${rep.rep_index} | ${formatNumber(rep.mean_velocity)} | ${formatNumber(rep.peak_velocity)} | ${formatNumber(rep.rom_cm, 1, " cm")} | ${formatNumber(getDisplayPower(rep.mean_power_w, rep.mean_velocity, rep.load_kg), 0, " W")} | ${rep.hr_bpm ?? "-"} |`,
        )
        .join("\n");
      const report = [
        "# RepVeloCoach 固まり調査用診断レポート",
        "",
        "このままCodexへ貼ってください。6セット目付近で固まった直後、または再起動直後の状態確認用です。",
        "",
        "## 端末内状態",
        `- 出力日時: ${formatDateTimeWithSeconds(new Date())}`,
        `- 現在セッションID: ${currentSession?.session_id ?? "なし"}`,
        `- セッションActive: ${isSessionActive ? "yes" : "no"}`,
        `- Pause状態: ${isPaused ? `yes (${pauseReason ?? "-"})` : "no"}`,
        `- 現在種目: ${currentLift ?? currentExercise?.name ?? "-"}`,
        `- 現在重量: ${formatNumber(currentLoad, 2, " kg")}`,
        `- 現在セット番号: ${currentSetIndex}`,
        `- 完了セット数(store): ${setHistory.length}`,
        `- 完了セット数(DB): ${dbSets.length}`,
        `- セッションrep数(DB): ${dbReps.length}`,
        `- 未保存/現在セットrep数(store): ${repHistory.length}`,
        `- 軽量モード: ${settings.enable_session_lightweight_mode ? "ON" : "OFF"}`,
        `- セッション履歴表示: ${settings.session_display_session_history ? "ON" : "OFF"}`,
        `- 速度チャート表示: ${settings.session_display_velocity_chart ? "ON" : "OFF"}`,
        `- 直近履歴表示: ${settings.session_display_recent_history ? "ON" : "OFF"}`,
        `- 同重量履歴表示: ${settings.session_display_same_load_history ? "ON" : "OFF"}`,
        `- センサー接続: ${isConnected ? "接続中" : "未接続"}`,
        `- センサー入力: ${sensorInputMuted ? "OFF" : "ON"}`,
        `- 現在心拍: ${currentHeartRate ?? "-"} bpm`,
        `- sessionAllReps state件数: ${sessionAllReps.length}`,
        `- recentExerciseHistory件数: ${recentExerciseHistory.length}`,
        "",
        "## 復旧スナップショット",
        recovery
          ? [
              `- saved_at: ${recovery.saved_at}`,
              `- session_id: ${recovery.session_id}`,
              `- current_lift: ${recovery.current_lift ?? "-"}`,
              `- current_load: ${recovery.current_load}`,
              `- current_set_index: ${recovery.current_set_index}`,
              `- completed_set_count: ${recovery.completed_set_count}`,
              `- last_completed_set_at: ${recovery.last_completed_set_at ?? "-"}`,
            ].join("\n")
          : "- なし",
        "",
        "## 直近完了セット",
        "| set | lift | load | reps | AV | VL avg/last/min | power | start | end |",
        "|---:|---|---:|---:|---:|---|---:|---|---|",
        lastSets || "| - | - | - | - | - | - | - | - | - |",
        "",
        "## 現在セットの未完了rep",
        "| time | rep | mean v | peak v | ROM | power | HR |",
        "|---|---:|---:|---:|---:|---:|---:|",
        currentReps || "| - | - | - | - | - | - | - |",
        "",
        "## Codexに見てほしい観点",
        "- 6セット目付近で store の setHistory / sessionAllReps / DB再読込が重くなっていないか。",
        "- 軽量モードONでも重い場合、SessionScreenの再描画範囲とZustand selector分割が必要か。",
        "- 復旧スナップショットとDBセット数がズレていないか。",
        "- 未完了repが残っている場合、固まる直前に保存キューが詰まっていないか。",
      ].join("\n");

      await Clipboard.setStringAsync(report);
      Alert.alert(
        "診断をコピーしました",
        "固まり調査用レポートをコピーしました。Codexにそのまま貼ってください。",
      );
    } catch (error) {
      console.error("[SessionScreen] Failed to copy freeze diagnostic:", error);
      Alert.alert("診断コピー失敗", "診断レポートの作成に失敗しました。");
    }
  };

  const getVBTScreenCrashReport = async (): Promise<string | null> => {
    const snapshot =
      previousVbtCrashContext ??
      (await CrashReportService.getLastVBTScreenContext());
    if (!snapshot) {
      Alert.alert(
        "クラッシュ記録なし",
        "前回のVBT接続クラッシュ疑いスナップショットは見つかりませんでした。現在の診断コピーを使ってください。",
      );
      return null;
    }

    return CrashReportService.buildVBTCrashMarkdown(snapshot);
  };

  const handleShareVBTScreenCrashReport = async () => {
    try {
      const report = await getVBTScreenCrashReport();
      if (!report) {
        return;
      }

      await Clipboard.setStringAsync(report);

      const file = await CrashReportService.writeVBTCrashReportFile(report);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(file.uri, {
          mimeType: "text/markdown",
          UTI: "net.daringfireball.markdown",
          dialogTitle: "GmailでCodexへクラッシュ状況を共有",
        });
      }

      Alert.alert(
        canShare
          ? "クラッシュ報告を共有しました"
          : "クラッシュ報告をコピーしました",
        canShare
          ? "共有先でGmailを選ぶと、Codexへ貼りやすいクラッシュ状況レポートを送れます。本文もクリップボードにコピー済みです。記録はクリアするまで残します。"
          : "共有シートが使えないため、本文をクリップボードにコピーしました。",
      );
    } catch (error) {
      console.error("[SessionScreen] Failed to share VBT crash report:", error);
      Alert.alert(
        "共有失敗",
        "クラッシュ報告の作成に失敗しました。現在の診断コピーを試してください。",
      );
    }
  };

  const handleShareVBTScreenCrashReportText = async () => {
    try {
      const report = await getVBTScreenCrashReport();
      if (!report) {
        return;
      }

      await Clipboard.setStringAsync(report);
      await Share.share({
        title: "RepVeloCoach VBT crash report",
        message: report,
      });
      Alert.alert(
        "本文共有を開きました",
        "Gmailを選ぶと本文として送れます。記録はクリアするまで残します。",
      );
    } catch (error) {
      console.error(
        "[SessionScreen] Failed to share VBT crash report text:",
        error,
      );
      Alert.alert(
        "本文共有失敗",
        "クラッシュ報告本文の共有に失敗しました。現在の診断コピーを試してください。",
      );
    }
  };

  const handleUploadVBTScreenCrashReportToDrive = async () => {
    try {
      const result =
        await CrashReportService.submitLastVBTScreenContextToGoogleDrive(
          settings,
          undefined,
          { force: true },
        );

      if (result.status === "disabled") {
        Alert.alert(
          "Drive診断OFF",
          "設定 > 共有 でDrive診断送信をONにしてください。",
        );
        return;
      }
      if (result.status === "missing_url") {
        Alert.alert(
          "URL未設定",
          "設定 > 共有 にGoogle Apps Script URLを入力してください。",
        );
        return;
      }

      Alert.alert(
        result.failed > 0 ? "Drive送信をキュー保存しました" : "Drive送信完了",
        `送信: ${result.uploaded} / 失敗: ${result.failed} / キュー: ${result.queued}${
          result.last_error ? `\n${result.last_error}` : ""
        }`,
      );
    } catch (error) {
      console.error(
        "[SessionScreen] Failed to upload VBT crash report:",
        error,
      );
      Alert.alert(
        "Drive送信失敗",
        "クラッシュ報告をDriveへ送信できませんでした。",
      );
    }
  };

  const isMeasuring = isSessionActive && !isPaused;

  // セッション終了 & DBへの集計保存
  const handleFinishSession = async () => {
    if (setHistory.length === 0) {
      Alert.alert(
        "セッション終了",
        "セットが記録されていません。終了しますか？",
        [
          { text: "キャンセル", style: "cancel" },
          {
            text: "終了",
            style: "destructive",
            onPress: () => {
              void ImprovementFeedbackService.flushAtSessionEnd(
                currentSession?.session_id,
              );
              void SessionRecoveryService.clearActiveSession();
              if (currentSession?.session_id) {
                publishBreathForgeSchedule("completed", currentSession.session_id);
              }
              endSession();
              if (navigationState.canGoBack()) {
                router.back();
              } else {
                router.replace("/(tabs)");
              }
            },
          },
        ],
      );
      return;
    }

    // MVTの計算と提案（セッション終了時に行う）
    try {
      await calculateAndProposeMVT();
    } catch (e) {
      console.error("MVT提案計算に失敗（セッション終了は継続します）:", e);
    }

    // セッション集計をDBに更新
    if (currentSession?.session_id) {
      try {
        const latestDbSession = await DatabaseService.getSession(
          currentSession.session_id,
        );
        if (!latestDbSession) {
          throw new Error("Latest session row was not found before completion.");
        }
        const totalVolume = setHistory.reduce(
          (sum, s) => sum + s.load_kg * s.reps,
          0,
        );
        const durationMs = sessionStartTime ? Date.now() - sessionStartTime : 0;
        const durationMin = Math.round(durationMs / 60000);
        const avgHr =
          sessionHRPoints.length > 0
            ? sessionHRPoints.reduce((s, x) => s + x, 0) /
              sessionHRPoints.length
            : undefined;
        const completionReadiness = buildSessionReadinessPayload();
        const completionNotes = buildSessionNotesWithReadiness(
          latestDbSession.notes,
          currentSession.notes,
          completionReadiness,
        );

        await DatabaseService.updateSession({
          session_id: currentSession.session_id,
          date: getJstTrainingDayId(
            currentSession.start_timestamp ?? currentSession.date,
          ),
          total_volume: totalVolume,
          total_sets: setHistory.length,
          duration_minutes: durationMin,
          duration_seconds: Math.round(durationMs / 1000),
          start_timestamp: currentSession.start_timestamp,
          end_timestamp: new Date().toISOString(),
          avg_hr: avgHr,
          notes: completionNotes,
        });
      } catch (e) {
        console.error("セッション集計の保存に失敗:", e);
      }
    }

    await SessionRecoveryService.clearActiveSession();
    void ImprovementFeedbackService.flushAtSessionEnd(currentSession?.session_id);
    if (currentSession?.session_id) {
      publishBreathForgeSchedule("completed", currentSession.session_id);
    }
    endSession();
    const missingRpeCount = setHistory.filter((set) => set.rpe == null).length;
    const missingPainReview =
      buildSessionReadinessPayload().pain_reviewed !== true;
    const completenessWarning = [
      ...(missingRpeCount ? [`RPE未入力 ${missingRpeCount}セット`] : []),
      ...(missingPainReview ? ["痛みレビュー未入力"] : []),
    ].join(" / ");
    Alert.alert(
      "セッション完了",
      `${setHistory.length}セットを保存しました。${completenessWarning ? `\n注意: ${completenessWarning}` : ""}`,
      [
        {
          text: "OK",
          onPress: () =>
            navigationState.canGoBack()
              ? router.back()
              : router.replace("/(tabs)"),
        },
      ],
    );
  };

  const handleAcceptMVT = async () => {
    if (!currentLift || proposedMVT === null) return;
    try {
      const existingLvp = await DatabaseService.getLVPProfile(currentLift);
      if (existingLvp) {
        await DatabaseService.saveLVPProfile({
          ...existingLvp,
          mvt: proposedMVT,
          last_updated: new Date().toISOString(),
        });
      }

      if (currentExercise?.id) {
        await ExerciseService.updateExercise(currentExercise.id, {
          mvt: proposedMVT,
        });
      }

      Alert.alert(
        "MVT更新",
        `${currentLift}の限界速度を ${proposedMVT}m/s に更新しました。`,
      );
      setProposedMVT(null); // バナーを閉じる
    } catch (e) {
      console.error("MVT更新失敗:", e);
    }
  };

  return (
    <View
      style={[styles.screenFrame, isMeasuring && styles.screenFrameRecording]}
    >
      {isMeasuring ? (
        // フォーカスモード：セット記録中のシンプルUI
        <View style={styles.focusModeContainer}>
          <View
            style={[
              styles.focusModeHeader,
              { paddingTop: (insets.top || 0) + 12 },
            ]}
          >
            <TouchableOpacity
              onPress={() => setPaused(true, "manual")}
              style={styles.focusModeBackButton}
            >
              <Text style={styles.focusModeBackButtonText}>⏸</Text>
            </TouchableOpacity>
            <Text style={styles.focusModeTitle}>SET {currentSetIndex}</Text>
            <TouchableOpacity
              onPress={handleToggleSensorInputMuted}
              style={[
                styles.focusModeSensorButton,
                sensorInputMuted && styles.sensorMuteButtonActive,
              ]}
            >
              <Text
                style={[
                  styles.focusModeSensorButtonText,
                  sensorInputMuted && styles.sensorMuteButtonTextActive,
                ]}
              >
                {sensorInputMuted ? "入力OFF" : "ラック"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleFinishSet}
              style={styles.focusModeCompleteButton}
            >
              <Text style={styles.focusModeCompleteButtonText}>完了</Text>
            </TouchableOpacity>
          </View>

          {settings.session_display_focus_simulator &&
            !(settings.session_display_focus_vl && isCompactFocusLayout) && (
            <View style={styles.focusModeSimulatorPanel}>
              <View>
                <Text style={styles.focusModeSimulatorTitle}>VBT SIM</Text>
                <Text style={styles.focusModeSimulatorMeta}>
                  {isSimulatingSet ? "RUNNING" : "READY"}
                </Text>
              </View>
              <View style={styles.focusModeSimulatorActions}>
                <TouchableOpacity
                  style={styles.focusModeSimulatorButton}
                  onPress={() => void handleConnectSimulator()}
                >
                  <Text style={styles.focusModeSimulatorButtonText}>
                    CONNECT
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.focusModeSimulatorButton}
                  onPress={handleSimulatedRep}
                >
                  <Text style={styles.focusModeSimulatorButtonText}>REP</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.focusModeSimulatorButton,
                    isSimulatingSet && styles.focusModeSimulatorButtonDisabled,
                  ]}
                  onPress={() => void handleRunSimulatedSet()}
                  disabled={isSimulatingSet}
                >
                  <Text style={styles.focusModeSimulatorButtonText}>SET</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {sensorInputMuted && (
            <View style={styles.sensorMutedBanner}>
              <Text style={styles.sensorMutedTitle}>センサー入力OFF</Text>
              <Text style={styles.sensorMutedBody}>
                ラック位置調整中の数値は記録しません。再開するときは入力ONに戻してください。
              </Text>
            </View>
          )}

          {settings.session_display_focus_info_grid &&
            !(settings.session_display_focus_vl && isCompactFocusLayout) && (
            <View style={styles.focusModeInfoGrid}>
              <View style={styles.focusModeInfoCellWide}>
                <Text style={styles.focusModeInfoLabel}>EXERCISE</Text>
                <Text style={styles.focusModeInfoValue} numberOfLines={1}>
                  {currentLift || currentExercise?.name || "未選択"}
                </Text>
              </View>
              <View style={styles.focusModeInfoCell}>
                <Text style={styles.focusModeInfoLabel}>LOAD</Text>
                <Text style={styles.focusModeInfoValue}>
                  {formatLoadKg(currentLoad)} kg
                </Text>
              </View>
              <View style={styles.focusModeInfoCell}>
                <Text style={styles.focusModeInfoLabel}>POWER</Text>
                <Text style={styles.focusModeInfoValue}>{focusPowerText}</Text>
              </View>
              <View style={styles.focusModeInfoCell}>
                <Text style={styles.focusModeInfoLabel}>BEST AV</Text>
                <Text style={styles.focusModeInfoValue}>
                  {sameLoadFastestText}
                </Text>
                <Text style={styles.focusModeInfoMeta} numberOfLines={1}>
                  {sameLoadFastestDeltaText
                    ? `now ${sameLoadFastestDeltaText}`
                    : sameLoadFastestMeta}
                </Text>
              </View>
            </View>
          )}

          {settings.session_display_focus_vl ? (
            <View
              style={[
                styles.focusModeVlPrimary,
                effectiveLiveVelocityLossThreshold === 0 &&
                  !individualProfileCollecting &&
                  styles.focusModeVlPrimaryOff,
                focusVelocityLossState.decision?.status === "watch" &&
                  styles.focusModeVlPrimaryWatch,
                focusVelocityLossState.decision?.status === "stop" &&
                  styles.focusModeVlPrimaryStop,
              ]}
            >
              <Text style={styles.focusModeVlPrimaryLabel}>
                {individualProfileCollecting ? "PROFILE COLLECT" : "LIVE VBT"}
              </Text>
              <Text
                style={styles.focusModeVlExerciseName}
                numberOfLines={1}
              >
                {currentLift || currentExercise?.name || "未選択"}
              </Text>
              <View style={styles.focusModeVlRepHeroRow}>
                <View style={styles.focusModeVlRepHeroMetric}>
                  <Text style={styles.focusModeVlRepHeroLabel}>VL_last</Text>
                  <Text
                    style={[
                      styles.focusModeVlPrimaryValue,
                      focusVelocityLossState.decision?.status === "watch" &&
                        styles.focusModeVlPrimaryValueWatch,
                      focusVelocityLossState.decision?.status === "stop" &&
                        styles.focusModeVlPrimaryValueStop,
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                  >
                    {individualProfileCollecting
                      ? liveIndividualSetTarget.currentVelocityLossLastPct != null
                        ? `${liveIndividualSetTarget.currentVelocityLossLastPct.toFixed(1)}%`
                        : "—"
                      : effectiveLiveVelocityLossThreshold === 0
                        ? "OFF"
                        : focusVelocityLossState.decision
                          ? `${focusVelocityLossState.decision.velocityLoss.toFixed(1)}%`
                          : "—"}
                  </Text>
                  <Text style={styles.focusModeVlPrimaryStatus}>
                    {individualProfileCollecting
                      ? liveIndividualSetTarget.nextObservationPointPct != null
                        ? `次の観測 ${liveIndividualSetTarget.nextObservationPointPct.toFixed(0)}%`
                        : "観測点を通過"
                      : effectiveLiveVelocityLossThreshold === 0
                        ? "VL警告OFF"
                        : focusVelocityLossState.decision?.status === "stop"
                          ? "VLカット"
                          : focusVelocityLossState.decision?.status === "watch"
                            ? `残り ${Math.max(0, effectiveLiveVelocityLossThreshold - focusVelocityLossState.decision.velocityLoss).toFixed(1)}%`
                            : focusVelocityLossState.decision
                              ? `余裕 ${Math.max(0, effectiveLiveVelocityLossThreshold - focusVelocityLossState.decision.velocityLoss).toFixed(1)}%`
                              : "2 REPから計算"}
                  </Text>
                </View>
                <View style={styles.focusModeVlRepHeroDivider} />
                <View style={styles.focusModeVlRepHeroMetric}>
                  <Text style={styles.focusModeVlRepHeroLabel}>REPS</Text>
                  <Text
                    style={styles.focusModeRepPrimaryValue}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.72}
                  >
                    {focusVelocityLossState.repCount}
                  </Text>
                  <Text style={styles.focusModeVlPrimaryStatus}>
                    {individualProfileCollecting
                      ? "個人基準を観測中"
                      : velocityLossRepPRTarget.targetReps != null
                        ? `PR目標 ${velocityLossRepPRTarget.targetReps}`
                        : "有効REP"}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.focusModeVlRepPrBand,
                  velocityLossRepPRTarget.status === "achieved" &&
                    styles.focusModeVlRepPrBandAchieved,
                  velocityLossRepPRTarget.status === "threshold_exceeded" &&
                    styles.focusModeVlRepPrBandExceeded,
                ]}
              >
                <Text style={styles.focusModeVlRepPrLabel}>
                  {individualProfileCollecting
                    ? "INDIVIDUAL PROFILE"
                    : effectiveLiveVelocityLossThreshold > 0
                      ? `VL ${effectiveLiveVelocityLossThreshold.toFixed(0)}%以内 REP PR`
                      : "VL REP PR"}
                </Text>
                <Text
                  style={[
                    styles.focusModeVlRepPrValue,
                    velocityLossRepPRTarget.status === "achieved" &&
                      styles.focusModeVlRepPrValueAchieved,
                    velocityLossRepPRTarget.status === "threshold_exceeded" &&
                      styles.focusModeVlRepPrValueExceeded,
                  ]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                >
                  {individualProfileCollecting
                    ? `最終AV ${liveIndividualSetTarget.currentFinalVelocity?.toFixed(2) ?? "—"}`
                    : velocityLossRepPRMessage}
                </Text>
                <Text style={styles.focusModeVlRepPrMeta}>
                  {individualProfileCollecting
                    ? `ΔVL/REP ${liveProfilePatternText}`
                    : sameLoadRepPRHistoryLoading
                      ? `${formatLoadKg(currentLoad)}kgの履歴を読込中`
                      : velocityLossRepPRTarget.historicalBestReps != null
                        ? `過去最高 ${velocityLossRepPRTarget.historicalBestReps} REP → 目標 ${velocityLossRepPRTarget.targetReps} REP`
                        : `${formatLoadKg(currentLoad)}kgのVL内履歴なし`}
                </Text>
              </View>
              <View style={styles.focusModeVlCompactRow}>
                <Text style={styles.focusModeVlCompactText}>
                  LIMIT{" "}
                  {individualProfileCollecting
                    ? "OBSERVE"
                    : effectiveLiveVelocityLossThreshold === 0
                      ? "OFF"
                      : `${effectiveLiveVelocityLossThreshold.toFixed(0)}%`}
                </Text>
                <Text style={styles.focusModeVlCompactText}>
                  AV{" "}
                  {focusVelocityLossState.latestAverageVelocity != null
                    ? focusVelocityLossState.latestAverageVelocity.toFixed(2)
                    : "—"}
                </Text>
                <Text style={styles.focusModeVlCompactText}>
                  LOAD {formatLoadKg(currentLoad)}kg
                </Text>
                <Text style={styles.focusModeVlCompactText}>
                  VL_avg{" "}
                  {focusVelocityLossState.velocityLossAverage != null
                    ? `${focusVelocityLossState.velocityLossAverage.toFixed(1)}%`
                    : "—"}
                </Text>
                <Text style={styles.focusModeVlCompactText}>
                  VL_min{" "}
                  {focusVelocityLossState.velocityLossMinimum != null
                    ? `${focusVelocityLossState.velocityLossMinimum.toFixed(1)}%`
                    : "—"}
                </Text>
                {settings.session_display_focus_heart_rate &&
                currentHeartRate != null ? (
                  <Text style={styles.focusModeVlCompactText}>
                    HR {Math.round(currentHeartRate)}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : settings.session_display_focus_velocity ? (
            <View style={styles.focusModeVelocityArea}>
              {liveData?.mean_velocity ? (
                <>
                  <Text style={styles.focusModeVelocityValue}>
                    {liveData.mean_velocity.toFixed(2)}
                  </Text>
                  <Text style={styles.focusModeVelocityUnit}>m/s</Text>
                </>
              ) : (
                <Text style={styles.focusModeWaitingText}>レップ待機中...</Text>
              )}
            </View>
          ) : null}

          {!settings.session_display_focus_vl &&
            settings.session_display_focus_metrics && (
            <View
              style={[
                styles.focusModeMetricStrip,
                settings.session_display_focus_vl &&
                  styles.focusModeMetricStripWithVl,
              ]}
            >
              <View style={styles.focusModeMetricItem}>
                <Text style={styles.focusModeInfoLabel}>AVG V</Text>
                <Text style={styles.focusModeMetricValue}>
                  {focusVelocityText}
                </Text>
              </View>
              <View style={styles.focusModeMetricItem}>
                <Text style={styles.focusModeInfoLabel}>ROM</Text>
                <Text style={styles.focusModeMetricValue}>{focusRomText}</Text>
              </View>
              <View style={styles.focusModeMetricItem}>
                <Text style={styles.focusModeInfoLabel}>PEAK P</Text>
                <Text style={styles.focusModeMetricValue}>
                  {livePeakPower != null
                    ? `${Math.round(livePeakPower)} W`
                    : "-"}
                </Text>
              </View>
            </View>
          )}

          {/* レップカウンター */}
          {!settings.session_display_focus_vl &&
            settings.session_display_focus_rep_counter && (
            <View
              style={[
                styles.focusModeRepCounter,
                settings.session_display_focus_vl &&
                  styles.focusModeRepCounterWithVl,
              ]}
            >
              <Text
                style={[
                  styles.focusModeRepCount,
                  settings.session_display_focus_vl &&
                    styles.focusModeRepCountWithVl,
                ]}
              >
                {repHistory.length}
              </Text>
              <Text style={styles.focusModeRepLabel}>REPS</Text>
            </View>
          )}

          {/* ゾーンインジケーター */}
          {!settings.session_display_focus_vl &&
            settings.session_display_focus_zone &&
            liveData?.mean_velocity && (
            <View
              style={[
                styles.focusModeZoneIndicator,
                settings.session_display_focus_vl &&
                  styles.focusModeZoneIndicatorWithVl,
              ]}
            >
              {(() => {
                const zone = VBTGuideService.getZone(liveData.mean_velocity);
                return (
                  <View
                    style={[
                      styles.focusModeZoneBadge,
                      { borderColor: zone.color },
                    ]}
                  >
                    <Text
                      style={[styles.focusModeZoneEmoji, { color: zone.color }]}
                    >
                      {zone.emoji}
                    </Text>
                    <Text
                      style={[styles.focusModeZoneName, { color: zone.color }]}
                    >
                      {zone.name}
                    </Text>
                  </View>
                );
              })()}
            </View>
          )}

          {/* 心拍数表示 */}
          {!settings.session_display_focus_vl &&
            settings.session_display_focus_heart_rate &&
            currentHeartRate != null && (
              <View
                style={[
                  styles.focusModeHrDisplay,
                  settings.session_display_focus_vl &&
                    styles.focusModeHrDisplayWithVl,
                ]}
              >
                <Text style={styles.focusModeHrIcon}>❤️</Text>
                <Text style={styles.focusModeHrValue}>
                  {Math.round(currentHeartRate)}
                </Text>
              </View>
            )}

          {/* 重量表示 */}
          {!settings.session_display_focus_vl &&
            settings.session_display_focus_load && (
            <View
              style={[
                styles.focusModeLoadDisplay,
                settings.session_display_focus_vl &&
                  styles.focusModeLoadDisplayWithVl,
              ]}
            >
              <Text style={styles.focusModeLoadValue}>
                {formatLoadKg(currentLoad)}
              </Text>
              <Text style={styles.focusModeLoadUnit}>kg</Text>
            </View>
          )}
        </View>
      ) : showDashboard ? (
        // ダッシュボードモード
        <SessionDashboard
          currentExercise={currentExercise}
          currentLift={currentLift}
          currentLoad={currentLoad}
          currentReps={currentReps}
          currentSetIndex={currentSetIndex}
          plannedSetCount={plannedSetCount}
          plannedRpe={plannedRpe}
          setHistory={setHistory}
          currentHeartRate={currentHeartRate}
          restStartTime={restStartTime}
          isConnected={isConnected}
          videoEnabled={settings.enable_video_recording}
          isVideoActive={formVideoOverlayVisible}
          canReconnectSensor={Boolean(BLEService.getLastDeviceInfo().id)}
          isReconnectingSensor={isReconnectingSensor}
          sensorInputMuted={sensorInputMuted}
          decision={sessionDecision}
          useMetric={settings.use_metric}
          onResumeSession={() => {
            resumeSet();
          }}
          onUpdateLoad={(load) => {
            applyUserSelectedLoad(load);
          }}
          onToggleSensorMuted={() => {
            handleToggleSensorInputMuted();
          }}
          onOpenVideo={() => {
            void handleOpenFormVideoRecorder();
          }}
          onEditSet={(setRef) => {
            const targetSet = findSetByIdentity(setRef);
            if (targetSet) {
              setEditingSet(targetSet);
            }
          }}
          onOpenRepDetail={(setRef) => {
            const targetSet = findSetByIdentity(setRef);
            if (targetSet) {
              void openRepDetail(targetSet);
            }
          }}
          onConsultCoach={() => {
            void handleCopyTrainingContext();
          }}
          onOpenLegacyDetails={() => {
            setLegacyDetailsOpen(true);
          }}
          onEndSession={() => {
            void handleFinishSession();
          }}
          onGoToday={handleGoToday}
          onReconnectSensor={() => void handleReconnectSensor()}
        />
      ) : (
        // 通常モード
        <ScrollView style={styles.container}>
          <View style={[styles.header, { paddingTop: (insets.top || 0) + 12 }]}>
            <TouchableOpacity
              onPress={() =>
                navigationState.canGoBack()
                  ? router.back()
                  : router.replace("/(tabs)")
              }
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>← 戻る</Text>
            </TouchableOpacity>
            <Text style={styles.title}>セッション</Text>
            <TouchableOpacity
              style={styles.coachNavButton}
              onPress={() => void handleCopyTrainingContext()}
            >
              <Text style={styles.coachNavButtonText}>GPTを開く</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.supervisorProgramBanner}>
            <View>
              <Text style={styles.supervisorProgramLabel}>監督メニュー</Text>
              <Text style={styles.supervisorProgramValue}>
                {supervisorProgramPlanState?.applied?.version ?? "未適用"} / Week{currentProgramWeek}-Day{currentProgramDay}
              </Text>
              <Text style={styles.supervisorProgramMeta}>
                更新 {supervisorProgramPlanState?.applied?.updated_at ?? "-"}
              </Text>
            </View>
            <View
              style={[
                styles.supervisorProgramBadge,
                !supervisorProgramPlanExecutable
                  ? styles.supervisorProgramBadgeStale
                  : null,
              ]}
            >
              <Text style={styles.supervisorProgramBadgeText}>
                {supervisorProgramPlanExecutable ? "ACTIVE" : "STALE"}
              </Text>
            </View>
          </View>
          {!supervisorProgramPlanExecutable ? (
            <Text style={styles.supervisorProgramMeta}>
              警告のみ: {supervisorProgramPlanStaleReason ?? "監督メニューを確認してください"}。記録と手動変更は続行できます。
            </Text>
          ) : null}
          <View style={styles.terminationStatusStrip}>
            <View style={styles.terminationStatusItem}>
              <Text style={styles.terminationStatusLabel}>種目</Text>
              <Text style={styles.terminationStatusValue}>
                {sessionDecision.exerciseTerminationLabel}
              </Text>
            </View>
            <View style={styles.terminationStatusItem}>
              <Text style={styles.terminationStatusLabel}>セッション</Text>
              <Text style={styles.terminationStatusValue}>
                {sessionDecision.sessionTerminationLabel}
              </Text>
            </View>
          </View>
          {isSessionActive && isPaused && legacyDetailsOpen ? (
            <View style={styles.legacyDashboardReturnBanner}>
              <Text style={styles.legacyDashboardReturnText}>
                旧詳細を表示中です。新しいダッシュボードへ戻れます。
              </Text>
              <TouchableOpacity
                style={styles.legacyDashboardReturnButton}
                onPress={() => setLegacyDetailsOpen(false)}
              >
                <Text style={styles.legacyDashboardReturnButtonText}>
                  ダッシュボードへ戻る
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {previousVbtCrashContext ? (
            <View style={[styles.diagnosticBar, styles.diagnosticBarWarning]}>
              <View style={styles.diagnosticTextGroup}>
                <Text style={styles.diagnosticBarText}>
                  前回VBT接続クラッシュ疑い
                </Text>
                <Text style={styles.diagnosticBarSubText}>
                  Drive送信またはGmail共有でCodexへ状況を送れます
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.diagnosticButton, styles.diagnosticShareButton]}
                onPress={() => void handleUploadVBTScreenCrashReportToDrive()}
              >
                <Text style={styles.diagnosticShareButtonText}>Drive送信</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.diagnosticButton, styles.diagnosticShareButton]}
                onPress={() => void handleShareVBTScreenCrashReport()}
              >
                <Text style={styles.diagnosticShareButtonText}>添付共有</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.diagnosticButton, styles.diagnosticShareButton]}
                onPress={() => void handleShareVBTScreenCrashReportText()}
              >
                <Text style={styles.diagnosticShareButtonText}>本文共有</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.diagnosticButton}
                onPress={() => void handleCopyFreezeDiagnostic()}
              >
                <Text style={styles.diagnosticButtonText}>診断コピー</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {/* Connection Status */}
          {settings.session_display_status && (
            <View style={styles.statusCard}>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: isConnected
                        ? GarageTheme.success
                        : GarageTheme.danger,
                    },
                  ]}
                />
                <Text style={styles.statusText}>
                  {isConnected ? "センサー接続中" : "センサー未接続"}
                </Text>
              </View>
              {!isConnected && BLEService.getLastDeviceInfo().id && (
                <TouchableOpacity
                  style={styles.reconnectSensorButton}
                  onPress={() => void handleReconnectSensor()}
                  disabled={isReconnectingSensor}
                >
                  <Text style={styles.reconnectSensorButtonText}>
                    {isReconnectingSensor ? "再接続中..." : "センサーを再接続"}
                  </Text>
                </TouchableOpacity>
              )}
              {currentHeartRate != null && (
                <View style={styles.hrBadge}>
                  <Text style={styles.hrValue}>
                    {Math.round(currentHeartRate)}
                  </Text>
                  <Text style={styles.hrUnit}>bpm</Text>
                  {(() => {
                    const peakHr =
                      setHistory.length > 0 &&
                      setHistory[setHistory.length - 1].peak_hr
                        ? setHistory[setHistory.length - 1].peak_hr!
                        : getPeakHeartRate(sessionHRPoints);

                    if (peakHr > 0) {
                      const signal = calculateRecoverySignal(
                        currentHeartRate,
                        peakHr,
                      );
                      return (
                        <View
                          style={[
                            styles.signalDot,
                            { backgroundColor: signal.color },
                          ]}
                        >
                          <Text style={styles.signalLabel}>{signal.label}</Text>
                        </View>
                      );
                    }
                    return null;
                  })()}
                </View>
              )}
            </View>
          )}

          {settings.session_display_simulator && (
            <View style={styles.simulatorCard}>
              <View>
                <Text style={styles.simulatorTitle}>VBT SIM</Text>
                <Text style={styles.simulatorMeta}>
                  {isSimulatingSet ? "RUNNING" : "READY"}
                </Text>
              </View>
              <View style={styles.simulatorActions}>
                <TouchableOpacity
                  style={styles.simulatorButton}
                  onPress={() => void handleConnectSimulator()}
                >
                  <Text style={styles.simulatorButtonText}>CONNECT</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.simulatorButton}
                  onPress={handleSimulatedRep}
                >
                  <Text style={styles.simulatorButtonText}>REP</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.simulatorButton,
                    isSimulatingSet && styles.simulatorButtonDisabled,
                  ]}
                  onPress={() => void handleRunSimulatedSet()}
                  disabled={isSimulatingSet}
                >
                  <Text style={styles.simulatorButtonText}>SET</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Exercise Selection */}
          {settings.session_display_exercise_picker && (
            <View style={styles.exerciseCard}>
              <Text style={styles.exerciseLabel}>Exercise</Text>
              {currentExercise ? (
                <TouchableOpacity
                  style={styles.exerciseSelector}
                  onPress={() => setShowExerciseModal(true)}
                >
                  <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseName}>
                      {currentExercise.name}
                    </Text>
                    <Text style={styles.exerciseCategory}>
                      {getExerciseCategoryLabel(currentExercise.category)}
                    </Text>
                  </View>
                  <Text style={styles.exerciseChange}>Change</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.exerciseSelectButton}
                  onPress={() => setShowExerciseModal(true)}
                >
                  <Text style={styles.exerciseSelectButtonText}>
                    Select Exercise
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={styles.supervisorRecommendationCard}>
            <View style={styles.supervisorRecommendationHeader}>
              <View style={styles.supervisorRecommendationCopy}>
                <Text style={styles.supervisorRecommendationKicker}>
                  監督メニューから入力
                </Text>
                <Text style={styles.supervisorRecommendationTitle}>
                  種目・重量・rep・VLを一括設定
                </Text>
                <Text style={styles.supervisorRecommendationMeta}>
                  {appliedSupervisorPlan?.version ??
                    supervisorProgramPlanState?.staged?.version ??
                    "未適用"}{" "}
                  / W{currentProgramWeek}-D{currentProgramDay}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.supervisorRecommendationAction}
                onPress={() => router.replace("/(tabs)/import")}
                accessibilityLabel="監督メニューの取得と適用を開く"
              >
                <Text style={styles.supervisorRecommendationActionText}>
                  メニュー管理
                </Text>
              </TouchableOpacity>
            </View>
            {supervisorRecommendationRows.length > 0 ? (
              <>
                <Text style={styles.supervisorRecommendationMeta}>
                  タップした行の種目・重量・rep・セット数・RPE・VLを反映します。
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.supervisorRecommendationList}
                >
                  {supervisorRecommendationRows.map((row) => {
                    const rowExercise = availableExercises.find(
                      (item) =>
                        normalizePlanMatchName(item.id) ===
                          normalizePlanMatchName(row.exercise_id) ||
                        normalizePlanMatchName(item.name) ===
                          normalizePlanMatchName(row.exercise_id),
                    );
                    const recommendedVl = row.vl_cap ?? row.vl_target;
                    const isCurrent =
                      rowExercise?.id === currentExercise?.id &&
                      (row.load_kg == null ||
                        isSameRecordedLoadKg(row.load_kg, currentLoad));
                    return (
                      <TouchableOpacity
                        key={row.row_id}
                        style={[
                          styles.supervisorRecommendationItem,
                          isCurrent &&
                            styles.supervisorRecommendationItemActive,
                        ]}
                        onPress={() => {
                          void handleApplySupervisorRow(row);
                        }}
                        accessibilityLabel={
                          row.display_name + "を監督メニュー推奨で設定"
                        }
                      >
                        <Text
                          style={styles.supervisorRecommendationExercise}
                          numberOfLines={1}
                        >
                          {row.display_name}
                        </Text>
                        <Text style={styles.supervisorRecommendationLoad}>
                          {row.load_kg != null
                            ? String(formatLoadKg(row.load_kg)) + "kg"
                            : "重量任意"}
                          {row.reps != null ? " × " + row.reps : ""}
                          {row.sets != null ? " / " + row.sets + "set" : ""}
                        </Text>
                        <Text style={styles.supervisorRecommendationDetail}>
                          {"VL " +
                            (recommendedVl != null
                              ? String(recommendedVl) + "%"
                              : "任意") +
                            " / RPE " +
                            (row.rpe_target ?? "任意")}
                        </Text>
                        {!rowExercise ? (
                          <Text style={styles.supervisorRecommendationMissing}>
                            種目未登録
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            ) : (
              <View style={styles.supervisorRecommendationEmpty}>
                <Text style={styles.supervisorRecommendationEmptyTitle}>
                  {supervisorProgramPlanExecutable ? "推奨行なし" : "監督メニューを使う準備"}
                </Text>
                <Text style={styles.supervisorRecommendationMeta}>
                  {supervisorRecommendationEmptyMessage}
                </Text>
                <TouchableOpacity
                  style={styles.supervisorRecommendationOpenButton}
                  onPress={() => router.replace("/(tabs)/import")}
                >
                  <Text style={styles.supervisorRecommendationOpenButtonText}>
                    取得・差分確認・適用へ
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {accessoryRMTarget.enabled && (
            <View style={styles.accessoryTargetCard}>
              <View style={styles.accessoryTargetHeader}>
                <View>
                  <Text style={styles.accessoryTargetEyebrow}>
                    ACCESSORY RM TARGET
                  </Text>
                  <Text style={styles.accessoryTargetTitle}>
                    5〜15rep 換算表
                  </Text>
                </View>
                <Text style={styles.accessoryTargetBadge}>
                  {accessoryRMTarget.targetSource === "previous_best"
                    ? "更新狙い"
                    : "初回基準"}
                </Text>
              </View>
              <View style={styles.accessoryTargetGrid}>
                <View style={styles.accessoryTargetMetric}>
                  <Text style={styles.accessoryTargetLabel}>今回e1RM</Text>
                  <Text style={styles.accessoryTargetValue}>
                    {formatNumber(accessoryRMTarget.currentE1RMKg, 1, "kg")}
                  </Text>
                </View>
                <View style={styles.accessoryTargetMetric}>
                  <Text style={styles.accessoryTargetLabel}>過去Best</Text>
                  <Text style={styles.accessoryTargetValue}>
                    {formatNumber(
                      accessoryRMTarget.previousBestE1RMKg,
                      1,
                      "kg",
                    )}
                  </Text>
                </View>
                <View style={styles.accessoryTargetMetric}>
                  <Text style={styles.accessoryTargetLabel}>目標e1RM</Text>
                  <Text style={styles.accessoryTargetValue}>
                    {formatNumber(accessoryRMTarget.targetE1RMKg, 1, "kg")}
                  </Text>
                </View>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.accessoryTargetTable}
              >
                {accessoryRMTarget.conversionTable.map((row) => (
                  <View
                    key={`accessory-rm-${row.reps}`}
                    style={styles.accessoryTargetCell}
                  >
                    <Text style={styles.accessoryTargetRep}>{row.reps}rep</Text>
                    <Text style={styles.accessoryTargetLoad}>
                      {formatAccessoryTargetLoad(row.targetLoadKg)}
                    </Text>
                    <Text style={styles.accessoryTargetCellMeta}>
                      e1RM {formatNumber(row.targetE1RMKg, 1, "kg")}
                    </Text>
                  </View>
                ))}
              </ScrollView>
              <Text style={styles.accessoryTargetNote}>
                各補助種目1セットだけRM換算セットマックス狙い。RPE9.5以上・痛み・ROM15%以上急変・主役リフトに響く疲労で終了。
              </Text>
            </View>
          )}

          <View style={styles.readinessCard}>
            <View style={styles.readinessHeader}>
              <View>
                <Text style={styles.readinessKicker}>SUPERVISOR CONTEXT</Text>
                <Text style={styles.readinessTitle}>監督チェック</Text>
              </View>
              <Text style={styles.readinessRoleBadge}>
                {currentDayRoleLabel}
              </Text>
            </View>
            <View style={styles.readinessGrid}>
              <View style={styles.readinessField}>
                <Text style={styles.readinessLabel}>Week-Day</Text>
                <TouchableOpacity
                  style={styles.readinessSelect}
                  onPress={() => setWeekDayPickerVisible(true)}
                >
                  <Text style={styles.readinessSelectText}>
                    {readinessWeekDay || "Week-Dayを選択"}
                  </Text>
                  <Text style={styles.readinessSelectArrow}>▼</Text>
                </TouchableOpacity>
                <Text style={styles.readinessHintSmall}>
                  {programLocationHint}
                </Text>
              </View>
              <View style={styles.readinessField}>
                <Text style={styles.readinessLabel}>痛み 0-10</Text>
                <TextInput
                  style={styles.readinessInput}
                  value={readinessPainScore}
                  onChangeText={(value) => {
                    setReadinessPainScore(value);
                    setReadinessPainReviewedAt(new Date().toISOString());
                  }}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={GarageTheme.textSubtle}
                />
              </View>
            </View>
            <View style={styles.readinessField}>
              <Text style={styles.readinessLabel}>痛みの場所</Text>
              <TextInput
                style={styles.readinessInput}
                value={readinessPainArea}
                onChangeText={(value) => {
                  setReadinessPainArea(value);
                  setReadinessPainReviewedAt(new Date().toISOString());
                }}
                placeholder="例: 左肩 / 腰 / なし"
                placeholderTextColor={GarageTheme.textSubtle}
              />
            </View>
            <View style={styles.readinessChipRow}>
              <TouchableOpacity
                style={[
                  styles.readinessChip,
                  readinessPainReviewedAt != null &&
                    styles.readinessChipActive,
                ]}
                onPress={() =>
                  setReadinessPainReviewedAt(
                    readinessPainReviewedAt == null
                      ? new Date().toISOString()
                      : null,
                  )
                }
                accessibilityLabel="痛みレビュー確認済みを切り替える"
              >
                <Text
                  style={[
                    styles.readinessChipText,
                    readinessPainReviewedAt != null &&
                      styles.readinessChipTextActive,
                  ]}
                >
                  {readinessPainReviewedAt != null
                    ? "痛み確認済み"
                    : "痛み未確認"}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.readinessGrid}>
              <View style={styles.readinessField}>
                <Text style={styles.readinessLabel}>前回からの回復</Text>
                <View style={styles.readinessChipRow}>
                  {RECOVERY_STATUS_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.readinessChip,
                        readinessRecoveryStatus === option.value &&
                          styles.readinessChipActive,
                      ]}
                      onPress={() => setReadinessRecoveryStatus(option.value)}
                    >
                      <Text
                        style={[
                          styles.readinessChipText,
                          readinessRecoveryStatus === option.value &&
                            styles.readinessChipTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.readinessField}>
                <Text style={styles.readinessLabel}>前回の筋肉痛 0-10</Text>
                <TextInput
                  style={styles.readinessInput}
                  value={readinessRecoverySorenessScore}
                  onChangeText={setReadinessRecoverySorenessScore}
                  keyboardType="number-pad"
                  placeholder="0"
                  placeholderTextColor={GarageTheme.textSubtle}
                />
              </View>
            </View>
            <Text style={styles.readinessLabel}>残る筋群（複数可）</Text>
            <View style={styles.readinessChipRow}>
              {RECOVERY_MUSCLE_OPTIONS.map((option) => {
                const selected = readinessRecoveryMuscles.includes(option.value);
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.readinessChip,
                      selected && styles.readinessChipActive,
                    ]}
                    onPress={() =>
                      setReadinessRecoveryMuscles((current) =>
                        selected
                          ? current.filter((muscle) => muscle !== option.value)
                          : [...current, option.value],
                      )
                    }
                  >
                    <Text
                      style={[
                        styles.readinessChipText,
                        selected && styles.readinessChipTextActive,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.readinessLabel}>主種目</Text>
            <View style={styles.readinessChipRow}>
              {MAIN_LIFT_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.readinessChip,
                    readinessMainLift === option.value &&
                      styles.readinessChipActive,
                  ]}
                  onPress={() =>
                    setReadinessMainLift(
                      readinessMainLift === option.value ? null : option.value,
                    )
                  }
                >
                  <Text
                    style={[
                      styles.readinessChipText,
                      readinessMainLift === option.value &&
                        styles.readinessChipTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.readinessLabel}>睡眠</Text>
            <View style={styles.readinessChipRow}>
              {SLEEP_QUALITY_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.readinessChip,
                    readinessSleepQuality === option.value &&
                      styles.readinessChipActive,
                  ]}
                  onPress={() => setReadinessSleepQuality(option.value)}
                >
                  <Text
                    style={[
                      styles.readinessChipText,
                      readinessSleepQuality === option.value &&
                        styles.readinessChipTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.readinessLabel}>減量中</Text>
            <View style={styles.readinessChipRow}>
              {[
                { label: "未入力", value: null },
                { label: "通常", value: false },
                { label: "減量中", value: true },
              ].map((option) => (
                <TouchableOpacity
                  key={option.label}
                  style={[
                    styles.readinessChip,
                    readinessDieting === option.value &&
                      styles.readinessChipActive,
                  ]}
                  onPress={() => setReadinessDieting(option.value)}
                >
                  <Text
                    style={[
                      styles.readinessChipText,
                      readinessDieting === option.value &&
                        styles.readinessChipTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.readinessHint}>
              セッション開始時に保存し、AI相談・Codex Exportへ渡します。
            </Text>
            <TouchableOpacity
              style={styles.breathForgeWarmupButton}
              onPress={() => void handleOpenBreathForgeWarmup()}
              accessibilityLabel="BREATHFORGEで競技前ウォームアップを開く"
            >
              <Text style={styles.breathForgeWarmupButtonText}>
                BREATHFORGEで呼吸ウォームアップ
              </Text>
              <Text style={styles.breathForgeWarmupButtonHint}>
                通常負荷の約80%・30呼吸×2・休憩2分
              </Text>
            </TouchableOpacity>
          </View>

          <Modal
            visible={weekDayPickerVisible}
            transparent
            animationType="fade"
            onRequestClose={() => setWeekDayPickerVisible(false)}
          >
            <TouchableOpacity
              style={styles.modalBackdrop}
              activeOpacity={1}
              onPress={() => setWeekDayPickerVisible(false)}
            >
              <View style={styles.weekDayPickerCard}>
                <Text style={styles.weekDayPickerTitle}>Week-Dayを選択</Text>
                <View style={styles.weekDayPickerGrid}>
                  {WEEK_DAY_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.weekDayOption,
                        readinessWeekDay === option.value &&
                          styles.weekDayOptionActive,
                      ]}
                      onPress={() => {
                        readinessWeekDayTouchedRef.current = true;
                        setReadinessWeekDay(option.value);
                        setProgramLocationHint("手動選択");
                        publishBreathForgeSchedule(
                          "selected",
                          breathForgeSelectionID(option.value),
                          option.value,
                        );
                        setWeekDayPickerVisible(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.weekDayOptionText,
                          readinessWeekDay === option.value &&
                            styles.weekDayOptionTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.weekDayCancelButton}
                  onPress={() => setWeekDayPickerVisible(false)}
                >
                  <Text style={styles.weekDayCancelText}>閉じる</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Modal>

          {/* VL Threshold Quick Setting */}
          {settings.session_display_vl_settings && currentExercise && (
            <View style={styles.vlSettingsCard}>
              <View style={styles.vlSettingsHeader}>
                <View>
                  <Text style={styles.vlSettingsTitle}>VL閾値</Text>
                  <Text style={styles.vlSettingsMeta}>
                    推奨 {vbtProtocol.backoffVelocityLoss.min}〜
                    {vbtProtocol.backoffVelocityLoss.max}% /{" "}
                    {vbtProtocol.phaseLabel}
                  </Text>
                </View>
                <View style={styles.vlToggleRow}>
                  <Text style={styles.vlToggleLabel}>オン</Text>
                  <TouchableOpacity
                    style={[
                      styles.vlToggleButton,
                      settings.enable_vl_warning
                        ? styles.vlToggleButtonOn
                        : styles.vlToggleOff,
                    ]}
                    onPress={() =>
                      updateSettings({
                        enable_vl_warning: !settings.enable_vl_warning,
                      })
                    }
                  >
                    <View
                      style={[
                        styles.vlToggleKnob,
                        settings.enable_vl_warning
                          ? styles.vlToggleKnobOn
                          : styles.vlToggleKnobOff,
                      ]}
                    />
                  </TouchableOpacity>
                </View>
              </View>
              {settings.enable_vl_warning && (
                <VelocityLossThresholdPicker
                  value={
                    currentExercise.velocity_loss_threshold ??
                    settings.velocity_loss_threshold
                  }
                  recommendedValue={supervisorRecommendedVl}
                  onChange={(threshold) => {
                    void handleVelocityLossThresholdChange(threshold);
                  }}
                  onApplyRecommended={() => {
                    void handleApplySupervisorVlRecommendation();
                  }}
                  compact
                />
              )}
            </View>
          )}

          <View style={styles.vlSettingsCard}>
            <View style={styles.vlSettingsHeader}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={styles.vlSettingsTitle}>フォーム動画</Text>
                <Text style={styles.vlSettingsMeta}>
                  {previousVbtCrashContext?.reason ===
                  "form_video_overlay_open_attempt"
                    ? "前回クラッシュ疑いのため一時停止中"
                    : settings.enable_video_recording
                      ? "セッション画面に録画ボタンを表示中"
                      : "セッション画面から録画ボタンを出す"}
                </Text>
              </View>
              <View style={styles.vlToggleRow}>
                <Text style={styles.vlToggleLabel}>オン</Text>
                <TouchableOpacity
                  style={[
                    styles.vlToggleButton,
                    settings.enable_video_recording
                      ? styles.vlToggleButtonOn
                      : styles.vlToggleOff,
                  ]}
                  onPress={() => {
                    void handleToggleFormVideoRecording();
                  }}
                >
                  <View
                    style={[
                      styles.vlToggleKnob,
                      settings.enable_video_recording
                        ? styles.vlToggleKnobOn
                        : styles.vlToggleKnobOff,
                    ]}
                  />
                </TouchableOpacity>
              </View>
            </View>
            <Text style={styles.liveHintText}>
              {settings.enable_video_recording
                ? formRecordingAvailable
                  ? settings.enable_form_video_ble_safe_mode
                    ? "下の操作ボタンに「フォーム録画」が出ています。録画中はVBT入力を一時停止します。"
                    : "下の操作ボタンに「フォーム録画」が出ています。"
                  : "セッション開始と種目選択後に「フォーム録画」が出ます。"
                : "ONにすると、下の操作ボタンに「フォーム録画」を表示します。"}
            </Text>
          </View>

          {showAdviceDisplay &&
            settings.session_display_protocol &&
            currentExercise && (
              <View style={styles.protocolCard}>
                <View style={styles.protocolHeader}>
                  <Text style={styles.protocolKicker}>PL VBT PROTOCOL</Text>
                  <Text style={styles.protocolPhase}>
                    {vbtProtocol.phaseLabel}
                  </Text>
                </View>
                <Text style={styles.protocolTitle}>
                  トップシングルで当日の状態を見て、バックオフはVLで止める
                </Text>
                <View style={styles.protocolGrid}>
                  <View style={styles.protocolMetric}>
                    <Text style={styles.protocolMetricLabel}>
                      トップシングル
                    </Text>
                    <Text style={styles.protocolMetricValue}>
                      {topSingleTargetText}
                    </Text>
                  </View>
                  <View style={styles.protocolMetric}>
                    <Text style={styles.protocolMetricLabel}>バックオフVL</Text>
                    <Text style={styles.protocolMetricValue}>
                      {vbtProtocol.backoffVelocityLoss.min}〜
                      {vbtProtocol.backoffVelocityLoss.max}%
                    </Text>
                  </View>
                </View>
                <View style={styles.protocolDivider} />
                <View style={styles.protocolGrid}>
                  <View style={styles.protocolMetric}>
                    <Text style={styles.protocolMetricLabel}>
                      {currentProgramLocation?.value ??
                        `Week${blockWeekPlan.week}`}
                    </Text>
                    <Text style={styles.protocolMetricValue}>
                      {blockWeekPlan.phaseLabel}
                    </Text>
                  </View>
                  <View style={styles.protocolMetric}>
                    <Text style={styles.protocolMetricLabel}>今日の狙い</Text>
                    <Text style={styles.protocolMetricValue}>
                      {blockWeekPlan.focus}
                    </Text>
                  </View>
                </View>
                <Text style={styles.protocolBody}>{vbtProtocol.guidance}</Text>
                <Text style={styles.protocolBody}>{blockWeekPlan.note}</Text>
              </View>
            )}

          {showAdviceDisplay &&
            settings.session_display_lvp_build &&
            currentExercise &&
            isBig3(currentExercise.category) && (
              <View style={styles.protocolCard}>
                <View style={styles.protocolHeader}>
                  <Text style={styles.protocolKicker}>LVP BUILD</Text>
                  <Text style={styles.protocolPhase}>{lvpStatusText}</Text>
                </View>
                <Text style={styles.protocolTitle}>
                  速度基準はウォームアップ中のAVとROMで作る
                </Text>
                <View style={styles.lvpChecklist}>
                  {LVP_CHECKPOINTS.map((checkpoint) => (
                    <View
                      key={checkpoint.percentRange}
                      style={styles.lvpCheckpoint}
                    >
                      <Text style={styles.lvpCheckpointRange}>
                        {checkpoint.percentRange}
                      </Text>
                      <Text style={styles.lvpCheckpointText}>
                        {checkpoint.reps} / {checkpoint.label}
                        {checkpoint.required ? "" : "（任意）"}
                      </Text>
                    </View>
                  ))}
                </View>
                <Text style={styles.protocolBody}>
                  タッチ&ゴーとポーズ、スモウとコンベンショナルなどは別の基準として扱います。
                </Text>
              </View>
            )}

          {/* Training Cue & Focus Note */}
          {settings.session_display_training_notes &&
            currentExercise &&
            (currentExercise.training_cue || currentExercise.focus_note) && (
              <View style={styles.trainingNotesCard}>
                {currentExercise.training_cue && (
                  <View style={styles.noteSection}>
                    <Text style={styles.noteLabel}>トレーニングキュー</Text>
                    <Text style={styles.noteText}>
                      {currentExercise.training_cue}
                    </Text>
                  </View>
                )}
                {currentExercise.focus_note && (
                  <View style={styles.noteSection}>
                    <Text style={styles.noteLabel}>フォーカスノート</Text>
                    <Text style={styles.noteText}>
                      {currentExercise.focus_note}
                    </Text>
                  </View>
                )}
              </View>
            )}

          {/* Session Note */}
          {settings.session_display_session_note && isSessionActive && (
            <View style={styles.sessionNoteCard}>
              <View style={styles.sessionNoteHeader}>
                <Text style={styles.sessionNoteLabel}>
                  今日のトレーニングメモ
                </Text>
                <TouchableOpacity
                  onPress={() => setEditingSessionNote(!editingSessionNote)}
                  style={styles.sessionNoteEditButton}
                >
                  <Text style={styles.sessionNoteEditText}>
                    {editingSessionNote ? "閉じる" : "編集"}
                  </Text>
                </TouchableOpacity>
              </View>
              {editingSessionNote ? (
                <View style={styles.sessionNoteEditContainer}>
                  <TextInput
                    style={styles.sessionNoteInput}
                    value={sessionNote}
                    onChangeText={setSessionNote}
                    placeholder="今日のトレーニングのメモを入力..."
                    placeholderTextColor={GarageTheme.textSubtle}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                  <TouchableOpacity
                    style={styles.sessionNoteSaveButton}
                    onPress={handleSaveSessionNote}
                  >
                    <Text style={styles.sessionNoteSaveButtonText}>保存</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.sessionNoteText}>
                  {sessionNote || "メモはまだありません"}
                </Text>
              )}
            </View>
          )}

          {/* セッション開始バナー */}
          {settings.session_display_session_banner &&
            (!isSessionActive ? (
              <View style={styles.sessionStartBanner}>
                <View style={styles.sessionStartBannerContent}>
                  <View style={styles.sessionStartBadge}>
                    <Text style={styles.sessionStartBadgeIcon}>⚡</Text>
                  </View>
                  <View style={styles.sessionStartTextContainer}>
                    <Text style={styles.sessionStartTitle}>
                      セッションを開始してください
                    </Text>
                    <Text style={styles.sessionStartSubtitle}>
                      BLEセンサー接続済み
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.button, styles.startSessionButton]}
                  onPress={handleStartSession}
                >
                  <Text style={styles.buttonText}>セッション開始</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.sessionActiveBanner}>
                <View style={styles.sessionActiveBannerLeft}>
                  <View
                    style={[
                      styles.sessionActiveIndicator,
                      isPaused && styles.sessionActiveIndicatorPaused,
                    ]}
                  >
                    <View
                      style={[
                        styles.sessionActiveIndicatorDot,
                        isPaused && styles.sessionActiveIndicatorDotPaused,
                      ]}
                    />
                  </View>
                  <View style={styles.sessionActiveTextContainer}>
                    <Text style={styles.sessionActiveTitle}>
                      {isPaused
                        ? `SET ${Math.max(1, currentSetIndex - 1)} PAUSED`
                        : sensorInputMuted
                          ? `SET ${currentSetIndex} SENSOR MUTED`
                          : `SET ${currentSetIndex} RECORDING`}
                    </Text>
                    <Text style={styles.sessionActiveSubtitle}>
                      {isPaused
                        ? "一時停止中"
                        : sensorInputMuted
                          ? "ラック調整中・入力無視"
                          : "レコーディング中"}
                    </Text>
                  </View>
                </View>
                <View style={styles.sessionActiveActions}>
                  <TouchableOpacity
                    style={[
                      styles.sensorMuteButton,
                      sensorInputMuted && styles.sensorMuteButtonActive,
                    ]}
                    onPress={handleToggleSensorInputMuted}
                  >
                    <Text
                      style={[
                        styles.sensorMuteButtonText,
                        sensorInputMuted && styles.sensorMuteButtonTextActive,
                      ]}
                    >
                      {sensorInputMuted ? "入力ON" : "入力OFF"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.pauseBtn,
                      isPaused && styles.pausedBtnActive,
                    ]}
                    onPress={() => {
                      if (isPaused) {
                        // 再開時：履歴を保持するため resumeSet を使用
                        resumeSet();
                      } else {
                        // 一時停止時はsetPausedを使用
                        setPaused(true, "manual");
                      }
                    }}
                  >
                    <View style={styles.pauseBtnContent}>
                      <Text style={styles.pauseBtnIcon}>
                        {isPaused ? "▶" : "⏸"}
                      </Text>
                      <Text style={styles.pauseBtnText}>
                        {isPaused ? "再開" : "一時停止"}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

          {/* CNS Battery & VBT Intelligence Summary */}
          {showAdviceDisplay &&
            settings.session_display_intelligence &&
            isSessionActive && (
              <View style={styles.intelligenceRow}>
                <View style={styles.cnsBatteryContainer}>
                  <Text style={styles.cnsLabel}>CNS BATTERY™</Text>
                  <View style={styles.batteryGageBg}>
                    <View
                      style={[
                        styles.batteryGageFill,
                        {
                          width: `${cnsBattery}%`,
                          backgroundColor:
                            cnsBattery > 70
                              ? GarageTheme.success
                              : cnsBattery > 40
                                ? GarageTheme.warning
                                : GarageTheme.danger,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.cnsValue}>{cnsBattery}%</Text>
                </View>

                {displayedEstimated1RM !== null && (
                  <View style={styles.intelligenceBadge}>
                    <Text style={styles.intelligenceLabel}>
                      本日予想1RM（参考）
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "baseline",
                        gap: 4,
                      }}
                    >
                      <Text style={styles.intelligenceValue}>
                        {displayedEstimated1RM}
                      </Text>
                      <Text style={styles.unitSmall}>kg</Text>
                    </View>
                    {displayedEstimated1RMConfidence && (
                      <View
                        style={[
                          styles.confidenceIndicator,
                          {
                            backgroundColor:
                              displayedEstimated1RMConfidence === "high"
                                ? GarageTheme.success
                                : displayedEstimated1RMConfidence === "medium"
                                  ? GarageTheme.warning
                                  : GarageTheme.danger,
                          },
                        ]}
                      >
                        <Text style={styles.confidenceText}>
                          {displayedEstimated1RMConfidence === "high"
                            ? "High"
                            : displayedEstimated1RMConfidence === "medium"
                              ? "Med"
                              : "Low"}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

          {showAdviceDisplay &&
            settings.session_display_attempt_guide &&
            isSessionActive &&
            attemptPlan &&
            isBig3(currentExercise?.category) && (
              <View style={styles.vbtDecisionCard}>
                <View style={styles.vbtDecisionHeader}>
                  <Text style={styles.protocolKicker}>ATTEMPT GUIDE</Text>
                  <Text style={styles.protocolPhase}>e1RM参考</Text>
                </View>
                <View style={styles.attemptGrid}>
                  <View style={styles.attemptCell}>
                    <Text style={styles.protocolMetricLabel}>第1</Text>
                    <Text style={styles.attemptValue}>
                      {formatLoadKg(attemptPlan.opener)}kg
                    </Text>
                  </View>
                  <View style={styles.attemptCell}>
                    <Text style={styles.protocolMetricLabel}>第2</Text>
                    <Text style={styles.attemptValue}>
                      {formatLoadKg(attemptPlan.second)}kg
                    </Text>
                  </View>
                  <View style={styles.attemptCell}>
                    <Text style={styles.protocolMetricLabel}>第3</Text>
                    <Text style={styles.attemptValue}>
                      {formatLoadKg(attemptPlan.thirdLow)}〜
                      {formatLoadKg(attemptPlan.thirdHigh)}kg
                    </Text>
                  </View>
                </View>
                <Text style={styles.protocolBody}>
                  第1は確実に成功する重量。{attemptPlan.note}
                </Text>
              </View>
            )}

          {showAdviceDisplay &&
            settings.session_display_suggestions &&
            isSessionActive &&
            individualProfileMode !== "standard" && (
              <View style={styles.vbtDecisionCard}>
                <View style={styles.vbtDecisionHeader}>
                  <Text style={styles.protocolKicker}>SET PROFILE</Text>
                  <Text style={styles.protocolPhase}>
                    {individualProfileCollecting ? "COLLECT" : "CONFIRM"}
                  </Text>
                </View>
                <View style={styles.attemptGrid}>
                  <View style={styles.attemptCell}>
                    <Text style={styles.protocolMetricLabel}>VL</Text>
                    <Text style={styles.attemptValue}>
                      {individualProfileCollecting
                        ? "観測"
                        : liveIndividualSetTarget.targetVelocityLossPct != null
                          ? `${liveIndividualSetTarget.targetVelocityLossPct.toFixed(0)}%`
                          : "—"}
                    </Text>
                  </View>
                  <View style={styles.attemptCell}>
                    <Text style={styles.protocolMetricLabel}>最終AV</Text>
                    <Text style={styles.attemptValue}>
                      {liveIndividualSetTarget.currentFinalVelocity?.toFixed(2) ??
                        "—"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.protocolBody}>
                  {individualProfileCollecting
                    ? `観測点: ${liveIndividualSetTarget.nextObservationPointPct != null ? `次 ${liveIndividualSetTarget.nextObservationPointPct.toFixed(0)}%` : "10 / 15 / 20 / 25 / 30%を通過"}。単独の高VLでは止めず、RPE ${liveIndividualSetTarget.plannedRpe ?? "任意"}・痛み・失敗を優先。`
                    : `目標VL ${liveIndividualSetTarget.targetVelocityLossPct?.toFixed(0) ?? "—"}% / 上限 ${liveIndividualSetTarget.capVelocityLossPct?.toFixed(0) ?? "—"}% / 最終AV ${liveIndividualSetTarget.targetFinalVelocity?.toFixed(2) ?? "—"}`}
                </Text>
                <Text style={styles.liveHintText}>
                  実測 ΔVL/REP: {liveProfilePatternText}
                </Text>
                {!individualProfileCollecting && (
                  <Text style={styles.liveHintText}>
                    個人基準 ΔVL/REP: {expectedProfilePatternText}
                  </Text>
                )}
              </View>
            )}

          {showAdviceDisplay &&
            settings.session_display_suggestions &&
            isSessionActive && (
              <View style={styles.vbtDecisionCard}>
                <View style={styles.vbtDecisionHeader}>
                  <Text style={styles.protocolKicker}>MUSCLE LOAD</Text>
                  <Text style={styles.protocolPhase}>仮説値</Text>
                </View>
                <View style={styles.attemptGrid}>
                  <View style={styles.attemptCell}>
                    <Text style={styles.protocolMetricLabel}>次の1 SET</Text>
                    <Text style={styles.attemptValue}>
                      {currentSetMuscleLoadRows[0]
                        ? `${MUSCLE_GROUP_LABELS[currentSetMuscleLoadRows[0][0]]} +${currentSetMuscleLoadRows[0][1].toFixed(1)}`
                        : "ウォームアップ"}
                    </Text>
                  </View>
                  <View style={styles.attemptCell}>
                    <Text style={styles.protocolMetricLabel}>今日の累積</Text>
                    <Text style={styles.attemptValue}>
                      {sessionMuscleLoadRows[0]
                        ? `${MUSCLE_GROUP_LABELS[sessionMuscleLoadRows[0][0]]} ${sessionMuscleLoadRows[0][1].toFixed(0)}`
                        : "まだなし"}
                    </Text>
                  </View>
                  <View style={styles.attemptCell}>
                    <Text style={styles.protocolMetricLabel}>24h後</Text>
                    <Text style={styles.attemptValue}>
                      {nextDayRecoveryRows[0]
                        ? `${MUSCLE_GROUP_LABELS[nextDayRecoveryRows[0].muscle]} ${nextDayRecoveryRows[0].remainingLoadScore.toFixed(0)}`
                        : "—"}
                    </Text>
                  </View>
                </View>
                <View style={styles.attemptGrid}>
                  <View style={styles.attemptCell}>
                    <Text style={styles.protocolMetricLabel}>48h後</Text>
                    <Text style={styles.attemptValue}>
                      {twoDayRecoveryRows[0]
                        ? `${MUSCLE_GROUP_LABELS[twoDayRecoveryRows[0].muscle]} ${twoDayRecoveryRows[0].remainingLoadScore.toFixed(0)}`
                        : "—"}
                    </Text>
                  </View>
                  <View style={styles.attemptCell}>
                    <Text style={styles.protocolMetricLabel}>72h後</Text>
                    <Text style={styles.attemptValue}>
                      {threeDayRecoveryRows[0]
                        ? `${MUSCLE_GROUP_LABELS[threeDayRecoveryRows[0].muscle]} ${threeDayRecoveryRows[0].remainingLoadScore.toFixed(0)}`
                        : "—"}
                    </Text>
                  </View>
                  <View style={styles.attemptCell}>
                    <Text style={styles.protocolMetricLabel}>個人化</Text>
                    <Text style={styles.attemptValue}>3件から</Text>
                  </View>
                </View>
                <Text style={styles.protocolBody}>
                  {sessionMuscleLoadRows.length > 0
                    ? `累積: ${sessionMuscleLoadRows
                        .slice(0, 3)
                        .map(
                          ([muscle, score]) =>
                            `${MUSCLE_GROUP_LABELS[muscle]} ${score.toFixed(0)}`,
                        )
                        .join(" / ")}。これは医学的な筋損傷予測ではなく、局所トレーニング負荷の初期仮説です。`
                    : "メインセット後に、筋群別の局所トレーニング負荷と24/48/72hの回復仮説を表示します。"}
                </Text>
                <Text style={styles.liveHintText}>
                  次回の「前回からの回復」と筋肉痛入力を3件集めてから、監督が各筋群の回復仮説を個別更新します。
                </Text>
              </View>
            )}

          {showAdviceDisplay &&
            settings.session_display_suggestions &&
            isSessionActive &&
            setHistory.length > 0 && (
              <View
                style={[
                  styles.vbtDecisionCard,
                  sessionDecision.trendFlags.romDrop ||
                  sessionDecision.trendFlags.hrHigh
                    ? styles.vbtDecisionDanger
                    : sessionDecision.fatigueStatus === "watch" ||
                        sessionDecision.trendFlags.sameLoadAVDrop
                      ? styles.vbtDecisionWarn
                      : styles.vbtDecisionPositive,
                ]}
              >
                <View style={styles.vbtDecisionHeader}>
                  <Text style={styles.protocolKicker}>NEXT SET DECISION</Text>
                  <Text style={styles.protocolPhase}>
                    {getDecisionLabel(sessionDecision.formStatus)} /{" "}
                    {getDecisionLabel(sessionDecision.fatigueStatus)}
                  </Text>
                </View>

                <View style={styles.purposeChipRow}>
                  {NEXT_SET_PURPOSE_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.purposeChip,
                        nextSetPurpose === option.value &&
                          styles.purposeChipActive,
                      ]}
                      onPress={() => setNextSetPurpose(option.value)}
                    >
                      <Text
                        style={[
                          styles.purposeChipText,
                          nextSetPurpose === option.value &&
                            styles.purposeChipTextActive,
                        ]}
                      >
                        {option.shortLabel}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.nextSetSummaryRow}>
                  <View style={styles.nextSetSummaryCell}>
                    <Text style={styles.protocolMetricLabel}>次セット</Text>
                    <Text style={styles.attemptValue}>
                      {sessionDecision.recommendedNextLoad != null
                        ? `${formatLoadKg(sessionDecision.recommendedNextLoad)}kg × ${sessionDecision.recommendedNextReps ?? currentReps}`
                        : "-"}
                    </Text>
                  </View>
                  <View style={styles.nextSetSummaryCell}>
                    <Text style={styles.protocolMetricLabel}>休憩</Text>
                    <Text style={styles.attemptValue}>
                      HR
                      {sessionDecision.waitUntilHRBelow ?? "-"}以下
                    </Text>
                  </View>
                  <View style={styles.nextSetSummaryCell}>
                    <Text style={styles.protocolMetricLabel}>ROM差</Text>
                    <Text style={styles.attemptValue}>
                      {formatNumber(sessionDecision.romDiff, 1, "cm")}
                    </Text>
                  </View>
                </View>

                <Text style={styles.protocolBody}>
                  目的: {nextSetPurposeLabel} / 作業AV{" "}
                  {formatNumber(sessionDecision.workingSetAvgAV)} / 直近3{" "}
                  {formatNumber(sessionDecision.recent3WorkingSetAvgAV)}
                </Text>
                {sessionDecision.nextSetQualityGoal ? (
                  <Text style={styles.liveHintText}>
                    品質目標: {sessionDecision.nextSetQualityGoal.summary}
                  </Text>
                ) : null}
                {sessionDecision.reasonBullets.slice(0, 3).map((reason) => (
                  <Text key={reason} style={styles.liveHintText}>
                    ・{reason}
                  </Text>
                ))}
                <Text style={styles.liveHintText}>
                  合格: {sessionDecision.passCriteria.join(" / ")}
                </Text>
                <Text style={styles.liveHintText}>
                  終了条件: {sessionDecision.stopCriteria.join(" / ")}
                </Text>
              </View>
            )}

          {/* Adaptive Load Suggestion */}
          {showAdviceDisplay &&
            settings.session_display_suggestions &&
            isSessionActive &&
            supervisorProgramPlanExecutable &&
            suggestedLoad !== null &&
            suggestedLoad !== currentLoad && (
              <TouchableOpacity
                style={styles.suggestionBanner}
                onPress={() => handleLoadChange(suggestedLoad.toString())}
              >
                <View style={styles.suggestionContent}>
                  <Text style={styles.suggestionText}>
                    推奨重量:{" "}
                    <Text style={styles.suggestionWeight}>
                      {formatLoadKg(suggestedLoad)}kg
                    </Text>{" "}
                    に変更しますか？
                  </Text>
                </View>
                <Text style={styles.applyText}>適用する</Text>
              </TouchableOpacity>
            )}

          {showAdviceDisplay &&
            settings.session_display_suggestions &&
            !isSessionActive &&
            currentLift && (
              <TouchableOpacity
                style={styles.optimizeMvtButton}
                onPress={() => void calculateAndProposeMVT()}
              >
                <Text style={styles.optimizeMvtButtonText}>
                  履歴から V@1RM を最適化
                </Text>
              </TouchableOpacity>
            )}

          {/* MVT Proposal Banner */}
          {showAdviceDisplay &&
            settings.session_display_suggestions &&
            !isSessionActive &&
            proposedMVT !== null &&
            currentLift && (
              <View
                style={[
                  styles.suggestionBanner,
                  {
                    backgroundColor: GarageTheme.surface,
                    borderLeftColor: GarageTheme.accentSoft,
                  },
                ]}
              >
                <View style={styles.suggestionContent}>
                  <View>
                    <Text style={styles.suggestionText}>
                      {currentLift}の新しい限界速度(MVT)候補:
                    </Text>
                    <Text
                      style={[
                        styles.suggestionWeight,
                        { color: GarageTheme.accentSoft, fontSize: 16 },
                      ]}
                    >
                      {proposedMVT} m/s
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <TouchableOpacity onPress={() => setProposedMVT(null)}>
                    <Text
                      style={[
                        styles.applyText,
                        { color: GarageTheme.textMuted },
                      ]}
                    >
                      無視
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleAcceptMVT}>
                    <Text
                      style={[
                        styles.applyText,
                        { color: GarageTheme.accentSoft, fontSize: 14 },
                      ]}
                    >
                      更新する
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

          {/* Rest Timer Banner */}
          {settings.session_display_rest_timer &&
            isSessionActive &&
            isPaused &&
            pauseReason === "rest" && (
              <View style={styles.restBanner}>
                <View style={styles.restHeader}>
                  <Text style={styles.restLabel}>RESTING...</Text>
                  <RestTimer
                    startTime={restStartTime || 0}
                    hr={currentHeartRate}
                    peakHr={
                      setHistory.length > 0
                        ? setHistory[setHistory.length - 1].peak_hr
                        : null
                    }
                  />
                </View>
                <TouchableOpacity
                  style={styles.startNextSetButton}
                  onPress={startSet}
                >
                  <Text style={styles.startNextSetText}>次のセットを開始</Text>
                </TouchableOpacity>
              </View>
            )}

          {/* Target Weight Input (Big 3 Only) */}
          {settings.session_display_target_weight &&
            isBig3(currentExercise?.category) &&
            isSessionActive && (
              <View style={styles.targetWeightCard}>
                <Text style={styles.targetWeightLabel}>
                  今日の目標重量 (Top Set)
                </Text>
                <View style={styles.targetInputRow}>
                  <TextInput
                    style={styles.targetInput}
                    value={inputTargetWeight}
                    onChangeText={handleTargetWeightChange}
                    placeholder="最高重量を入力"
                    placeholderTextColor="#666"
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    selectTextOnFocus
                  />
                  <Text style={styles.unitText}>kg</Text>
                </View>
              </View>
            )}

          {/* Warmup Guide */}
          {showAdviceDisplay &&
            settings.session_display_warmup_guide &&
            isBig3(currentExercise?.category) &&
            targetWeight &&
            isSessionActive &&
            settings.enable_warmup_recommendations && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>WARMUP GUIDE</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.warmupScroll}
                >
                  {calculateWarmupSteps(targetWeight).map((step, idx) => {
                    const isCurrent = isSameRecordedLoadKg(
                      currentLoad,
                      step.load_kg,
                    );
                    return (
                      <TouchableOpacity
                        key={idx}
                        style={[
                          styles.warmupStep,
                          isCurrent && styles.warmupStepActive,
                        ]}
                        onPress={() =>
                          handleLoadChange(formatLoadKgTwoDecimals(step.load_kg))
                        }
                      >
                        <Text
                          style={[
                            styles.warmupStepLabel,
                            isCurrent && styles.warmupStepLabelActive,
                          ]}
                        >
                          {step.label}
                        </Text>
                        <Text
                          style={[
                            styles.warmupWeight,
                            isCurrent && styles.warmupWeightActive,
                          ]}
                        >
                          {formatLoadKg(step.load_kg)}kg
                        </Text>
                        <Text
                          style={[
                            styles.warmupReps,
                            isCurrent && styles.warmupRepsActive,
                          ]}
                        >
                          {step.reps > 0 ? `${step.reps} reps` : "Main"}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

          {showAdviceDisplay &&
            settings.session_display_readiness &&
            isSessionActive &&
            readinessDecision && (
              <View
                style={[
                  styles.vbtDecisionCard,
                  readinessDecision.decision.label === "excellent" &&
                    styles.vbtDecisionPositive,
                  readinessDecision.decision.label === "down" &&
                    styles.vbtDecisionWarn,
                  readinessDecision.decision.label === "fatigued" &&
                    styles.vbtDecisionDanger,
                ]}
              >
                <View style={styles.vbtDecisionHeader}>
                  <Text style={styles.protocolKicker}>WARMUP READINESS</Text>
                  <Text style={styles.protocolPhase}>
                    基準比{" "}
                    {readinessDecision.decision.deltaVelocity >= 0 ? "+" : ""}
                    {readinessDecision.decision.deltaVelocity.toFixed(2)} m/s
                  </Text>
                </View>
                <Text style={styles.protocolTitle}>
                  {readinessDecision.decision.message}
                </Text>
                <Text style={styles.protocolBody}>
                  同程度の重量 {readinessDecision.sampleCount}セットの中央値{" "}
                  {readinessDecision.baselineVelocity.toFixed(2)} m/s
                  と比較しています。
                </Text>
              </View>
            )}

          {/* Set Configuration */}
          {settings.session_display_set_config && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>SET CONFIGURATION</Text>
              <Big3GearSelector
                lift={currentLift}
                value={currentGear}
                onChange={handleGearChange}
              />
              <View style={styles.loadControlContainer}>
                <Text style={styles.loadControlLabel}>Load (kg)</Text>
                <View style={styles.loadControlWrapper}>
                  <View style={styles.loadAdjustRow}>
                    <TouchableOpacity
                      style={styles.adjustBtn}
                      onPress={() => adjustLoad(-5)}
                    >
                      <Text style={styles.adjustBtnText}>-5</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.adjustBtn}
                      onPress={() => adjustLoad(-1)}
                    >
                      <Text style={styles.adjustBtnText}>-1</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.adjustBtn}
                      onPress={() => adjustLoad(-0.5)}
                    >
                      <Text style={styles.adjustBtnText}>-0.5</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.loadDisplayValue}>
                    <Text style={styles.loadDisplayValueText}>
                      {formatLoadKg(currentLoad)}
                    </Text>
                  </View>
                  <View style={styles.loadAdjustRow}>
                    <TouchableOpacity
                      style={styles.adjustBtn}
                      onPress={() => adjustLoad(0.5)}
                    >
                      <Text style={styles.adjustBtnText}>+0.5</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.adjustBtn}
                      onPress={() => adjustLoad(1)}
                    >
                      <Text style={styles.adjustBtnText}>+1</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.adjustBtn}
                      onPress={() => adjustLoad(5)}
                    >
                      <Text style={styles.adjustBtnText}>+5</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.loadInputRow}>
                  <TextInput
                    style={styles.loadInput}
                    value={inputLoad}
                    onChangeText={setInputLoad}
                    onEndEditing={(event) =>
                      commitLoadInput(event.nativeEvent.text)
                    }
                    onBlur={() => commitLoadInput(inputLoad)}
                    keyboardType="decimal-pad"
                    placeholder="重量を入力"
                    placeholderTextColor={GarageTheme.textSubtle}
                    returnKeyType="done"
                    selectTextOnFocus
                  />
                  <Text style={styles.unitText}>kg</Text>
                </View>
              </View>
            </View>
          )}

          {/* Live データ表示 */}
          {settings.session_display_live_data && (
            <View style={styles.dataCard}>
              <Text style={styles.dataTitle}>Live Data</Text>
              {liveData ? (
                <>
                  {/* 速度ゾーンバッジ */}
                  {(() => {
                    const zone = VBTGuideService.getZone(
                      liveData.mean_velocity,
                    );
                    return (
                      <View
                        style={[styles.zoneBadge, { borderColor: zone.color }]}
                      >
                        <Text
                          style={[
                            styles.zoneTag,
                            { color: zone.color, borderColor: zone.color },
                          ]}
                        >
                          {zone.emoji}
                        </Text>
                        <Text style={[styles.zoneName, { color: zone.color }]}>
                          {zone.name}
                        </Text>
                      </View>
                    );
                  })()}
                  <TouchableOpacity
                    style={styles.dataRow}
                    onPress={() =>
                      showTooltip("MEAN_VELOCITY", liveData.mean_velocity)
                    }
                  >
                    <Text style={styles.dataLabel}>Mean Velocity</Text>
                    <Text
                      style={[
                        styles.dataValue,
                        {
                          color: VBTGuideService.getZone(liveData.mean_velocity)
                            .color,
                        },
                      ]}
                    >
                      {liveData.mean_velocity.toFixed(2)} m/s
                    </Text>
                    <Text style={styles.helpIcon}>❓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dataRow}
                    onPress={() =>
                      showTooltip("PEAK_VELOCITY", liveData.peak_velocity)
                    }
                  >
                    <Text style={styles.dataLabel}>Peak Velocity</Text>
                    <Text style={styles.dataValue}>
                      {liveData.peak_velocity.toFixed(2)} m/s
                    </Text>
                    <Text style={styles.helpIcon}>❓</Text>
                  </TouchableOpacity>
                  <View style={styles.dataRow}>
                    <Text style={styles.dataLabel}>Mean Power</Text>
                    <Text style={styles.dataValue}>
                      {liveMeanPower != null
                        ? `${Math.round(liveMeanPower)} W`
                        : "-"}
                    </Text>
                  </View>
                  <View style={styles.dataRow}>
                    <Text style={styles.dataLabel}>Peak Power</Text>
                    <Text style={styles.dataValue}>
                      {livePeakPower != null
                        ? `${Math.round(livePeakPower)} W`
                        : "-"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.dataRow}
                    onPress={() => showTooltip("ROM", liveData.rom_cm)}
                  >
                    <Text style={styles.dataLabel}>ROM</Text>
                    <Text style={styles.dataValue}>
                      {liveData.rom_cm.toFixed(0)} cm
                    </Text>
                    <Text style={styles.helpIcon}>❓</Text>
                  </TouchableOpacity>
                  {romConsistencyMessage && (
                    <Text style={styles.liveHintText}>
                      {romConsistencyMessage}
                    </Text>
                  )}
                </>
              ) : (
                <>
                  <Text style={styles.noDataText}>
                    {sensorInputMuted
                      ? "SENSOR INPUT MUTED"
                      : "REP INPUT WAITING"}
                  </Text>
                  <View style={styles.dataRow}>
                    <Text style={styles.dataLabel}>Mean Power</Text>
                    <Text style={styles.dataValue}>-</Text>
                  </View>
                  <View style={styles.dataRow}>
                    <Text style={styles.dataLabel}>Peak Power</Text>
                    <Text style={styles.dataValue}>-</Text>
                  </View>
                </>
              )}
            </View>
          )}

          {/* レップ毎の平均速度推移グラフ */}
          {settings.session_display_velocity_chart &&
            isSessionActive &&
            repHistory &&
            repHistory.length > 0 && (
              <RepVelocityChart
                reps={repHistory}
                setIndex={currentSetIndex}
                lift={currentLift ?? undefined}
              />
            )}

          {showAdviceDisplay &&
            settings.session_display_vl_decision &&
            isSessionActive &&
            liveVelocityLossDecision && (
              <View
                style={[
                  styles.vbtDecisionCard,
                  liveVelocityLossDecision.status === "watch" &&
                    styles.vbtDecisionWarn,
                  liveVelocityLossDecision.status === "stop" &&
                    styles.vbtDecisionDanger,
                ]}
              >
                <View style={styles.vbtDecisionHeader}>
                  <Text style={styles.protocolKicker}>VELOCITY LOSS</Text>
                  <Text style={styles.protocolPhase}>
                    {liveVelocityLossDecision.velocityLoss.toFixed(1)} /{" "}
                    {liveVelocityLossDecision.threshold}%
                  </Text>
                </View>
                <Text style={styles.protocolTitle}>
                  {liveVelocityLossDecision.message}
                </Text>
                <Text style={styles.protocolBody}>
                  {liveVelocityLossDecision.nextSetMessage}
                </Text>
              </View>
            )}

          {/* Action Buttons */}
          {settings.session_display_action_buttons && (
            <View style={styles.buttonContainer}>
              {formRecordingAvailable && (
                <TouchableOpacity
                  style={[styles.button, styles.formVideoButton]}
                  onPress={() => void handleOpenFormVideoRecorder()}
                >
                  <Text style={styles.buttonText}>フォーム録画</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.warmupButton, styles.improvementFeedbackButton]}
                onPress={() => setImprovementFeedbackVisible(true)}
              >
                <Text style={styles.warmupButtonText}>
                  気づき{queuedFeedbackCount > 0 ? ` ${queuedFeedbackCount}` : ""}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.warmupButton,
                  isWarmupMode && styles.warmupButtonActive,
                ]}
                onPress={() => {
                  const newMode = !isWarmupMode;
                  setIsWarmupMode(newMode);
                  setWarmupMode(newMode);
                }}
              >
                <Text style={styles.warmupButtonText}>
                  {isWarmupMode ? "ウォームアップON" : "ウォームアップ"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.warmupButton,
                  isDropSetMode && styles.dropSetButtonActive,
                ]}
                onPress={handleToggleDropSetMode}
              >
                <Text style={styles.warmupButtonText}>
                  {isDropSetMode ? "DROP SET ON" : "DROP SET"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.warmupButton,
                  isAmrapMode && styles.amrapButtonActive,
                ]}
                onPress={handleToggleAmrapMode}
                accessibilityLabel="次のセットをAMRAPとして記録"
              >
                <Text style={styles.warmupButtonText}>
                  {isAmrapMode ? "AMRAP ON" : "AMRAP"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.recordButton]}
                onPress={handleFinishSet}
              >
                <Text style={styles.buttonText}>SET COMPLETE</Text>
              </TouchableOpacity>
              {setHistory.length > 0 && (
                <TouchableOpacity
                  style={[styles.button, styles.supervisorButton]}
                  onPress={() => void handleCopyLatestSetSupervisorPacket()}
                >
                  <Text style={styles.buttonText}>監督へ1セット相談</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* 直近同重量の速度履歴 */}
          {settings.session_display_same_load_history &&
            sameLoadRecentHistory.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  直近同重量 {formatLoadKg(currentLoad)}kg の速度履歴
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.recentHistoryScroll}
                  contentContainerStyle={styles.recentHistoryContent}
                >
                  {sameLoadRecentHistory.map((set) => {
                    const zone = set.avg_velocity
                      ? VBTGuideService.getZone(set.avg_velocity)
                      : null;
                    return (
                      <TouchableOpacity
                        key={`same-${set.session_id}-${set.set_index}`}
                        style={[
                          styles.recentHistoryCard,
                          { borderColor: zone?.color ?? GarageTheme.border },
                        ]}
                        onPress={() => openRepDetail(set)}
                      >
                        <Text style={styles.recentHistoryDate}>
                          {new Date(set.timestamp).toLocaleDateString("ja-JP", {
                            month: "short",
                            day: "numeric",
                          })}
                        </Text>
                        <View style={styles.recentHistoryStats}>
                          <View style={styles.recentHistoryStat}>
                            <Text style={styles.recentHistoryStatLabel}>
                              回数
                            </Text>
                            <Text style={styles.recentHistoryStatValue}>
                              {set.reps}
                            </Text>
                          </View>
                          {set.avg_velocity ? (
                            <View style={styles.recentHistoryStat}>
                              <Text style={styles.recentHistoryStatLabel}>
                                平均速度
                              </Text>
                              <Text style={styles.recentHistoryStatValue}>
                                {set.avg_velocity.toFixed(2)}
                              </Text>
                            </View>
                          ) : null}
                          {set.velocity_loss != null ? (
                            <View style={styles.recentHistoryStat}>
                              <Text style={styles.recentHistoryStatLabel}>
                                VL avg/last/min
                              </Text>
                              <Text style={styles.recentHistoryStatValue}>
                                {formatVelocityLossTriplet(set)}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

          {/* 最近の種目履歴 */}
          {settings.session_display_recent_history &&
            recentExerciseHistory.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>最近の{currentLift}履歴</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.recentHistoryScroll}
                  contentContainerStyle={styles.recentHistoryContent}
                >
                  {recentExerciseHistory.map((set) => {
                    const zone = set.avg_velocity
                      ? VBTGuideService.getZone(set.avg_velocity)
                      : null;
                    return (
                      <TouchableOpacity
                        key={`${set.session_id}-${set.set_index}`}
                        style={[
                          styles.recentHistoryCard,
                          { borderColor: zone?.color ?? GarageTheme.border },
                        ]}
                        onPress={() => openRepDetail(set)}
                      >
                        <Text style={styles.recentHistoryDate}>
                          {new Date(set.timestamp).toLocaleDateString("ja-JP", {
                            month: "short",
                            day: "numeric",
                          })}
                        </Text>
                        <View style={styles.recentHistoryStats}>
                          <View style={styles.recentHistoryStat}>
                            <Text style={styles.recentHistoryStatLabel}>
                              重量
                            </Text>
                            <Text style={styles.recentHistoryStatValue}>
                              {formatLoadKg(set.load_kg)}
                            </Text>
                          </View>
                          <View style={styles.recentHistoryStat}>
                            <Text style={styles.recentHistoryStatLabel}>
                              回数
                            </Text>
                            <Text style={styles.recentHistoryStatValue}>
                              {set.reps}
                            </Text>
                          </View>
                          {set.avg_velocity && (
                            <View style={styles.recentHistoryStat}>
                              <Text style={styles.recentHistoryStatLabel}>
                                速度
                              </Text>
                              <Text style={styles.recentHistoryStatValue}>
                                {set.avg_velocity.toFixed(2)}
                              </Text>
                            </View>
                          )}
                        </View>
                        {set.e1rm && (
                          <Text style={styles.recentHistoryE1RM}>
                            e1RM: {formatLoadKg(set.e1rm)}
                          </Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

          {/* セッション履歴 */}
          {settings.session_display_session_history &&
            setHistory.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>SESSION HISTORY</Text>
                {hiddenSetHistoryCount > 0 && (
                  <Text style={styles.liveHintText}>
                    軽量モード: 最新 {visibleSetHistory.length}/
                    {setHistory.length} セットだけ表示中
                  </Text>
                )}
                {timeAllocationSummary ? (
                  <Text style={styles.liveHintText}>
                    時間割: セット平均{" "}
                    {timeAllocationSummary.averageSetS != null
                      ? formatDurationSeconds(timeAllocationSummary.averageSetS)
                      : "-"}{" "}
                    / 休憩平均{" "}
                    {timeAllocationSummary.averageRestS != null
                      ? formatDurationSeconds(
                          timeAllocationSummary.averageRestS,
                        )
                      : "-"}
                    {timeAllocationSummary.nextSetStartAt
                      ? ` / 次セット目安 ${formatClockTime(timeAllocationSummary.nextSetStartAt) ?? "-"}`
                      : ""}
                  </Text>
                ) : null}
                {visibleSetHistory.map((set, idx) => {
                  const zone = set.avg_velocity
                    ? VBTGuideService.getZone(set.avg_velocity)
                    : null;
                  const setReps =
                    repsBySetKey.get(getSetKey(set.lift, set.set_index)) ?? [];
                  const trackedReps = setReps.filter(
                    (rep) =>
                      !rep.is_excluded && !rep.is_failed && rep.is_valid_rep,
                  );
                  const repPowerValues = trackedReps
                    .map((rep) =>
                      getDisplayPower(
                        rep.mean_power_w,
                        rep.mean_velocity,
                        rep.load_kg || set.load_kg,
                      ),
                    )
                    .filter(
                      (power): power is number => power != null && power > 0,
                    );
                  const storedSetAvgPower =
                    set.avg_power_w != null && set.avg_power_w > 0
                      ? set.avg_power_w
                      : null;
                  const avgPower =
                    repPowerValues.length > 0
                      ? repPowerValues.reduce((sum, power) => sum + power, 0) /
                        repPowerValues.length
                      : (storedSetAvgPower ??
                        (set.avg_velocity != null
                          ? VBTLogic.calculatePower(
                              set.load_kg,
                              set.avg_velocity,
                            )
                          : null));
                  const velocityLossForJudgement =
                    getVelocityLossForJudgement(set);
                  const estimatedRPE =
                    velocityLossForJudgement != null
                      ? estimateRPEFromVelocityLoss(
                          velocityLossForJudgement,
                          set.reps,
                        )
                      : null;
                  const trendSets = getSetTrendWindow(setHistory, set);

                  return (
                    <View
                      key={`${set.lift}_${set.set_index}_${idx}`}
                      style={styles.setCard}
                    >
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          void openRepDetail(set);
                        }}
                      >
                        <View style={styles.setHeader}>
                          <Text style={styles.setExerciseName}>{set.lift}</Text>
                          <Text style={styles.setNumberText}>
                            Set {set.set_index}
                          </Text>
                        </View>
                        <View style={styles.setMetaRow}>
                          <Text style={styles.setLoad}>
                            {formatLoadKg(set.load_kg)} kg × {set.reps}
                          </Text>
                          <View style={styles.setMetaRight}>
                            <SetTrendMiniChart
                              sets={trendSets}
                              currentSet={set}
                            />
                            {zone ? (
                              <Text
                                style={[
                                  styles.setZoneTag,
                                  {
                                    color: zone.color,
                                    borderColor: zone.color,
                                  },
                                ]}
                              >
                                {zone.emoji}
                              </Text>
                            ) : null}
                          </View>
                        </View>
                        <View style={styles.setRowDetail}>
                          {settings.enable_video_recording &&
                            formVideoCountsBySet[
                              getSetKey(set.lift, set.set_index)
                            ] > 0 && (
                              <Text style={styles.setMetricChipText}>
                                動画{" "}
                                {
                                  formVideoCountsBySet[
                                    getSetKey(set.lift, set.set_index)
                                  ]
                                }
                              </Text>
                            )}
                          <Text
                            style={[
                              styles.setVelocity,
                              zone ? { color: zone.color } : {},
                            ]}
                          >
                            Avg Vel {set.avg_velocity?.toFixed(2) ?? "-"} m/s
                          </Text>
                          <Text style={styles.setMetricChipText}>
                            Power{" "}
                            {avgPower != null
                              ? `${Math.round(avgPower)} W`
                              : "-"}
                          </Text>
                          <Text style={styles.setMetricChipText}>
                            VL avg/last/min{" "}
                            {set.velocity_loss != null
                              ? formatVelocityLossTriplet(set)
                              : "-"}
                          </Text>
                          <Text style={styles.setMetricChipText}>
                            心拍{" "}
                            {set.avg_hr != null
                              ? `${Math.round(set.avg_hr)} bpm`
                              : "-"}
                          </Text>
                          <Text style={styles.setMetricChipText}>
                            HR→120{" "}
                            {set.hr_recovery_to_120_s != null
                              ? formatDurationSeconds(set.hr_recovery_to_120_s)
                              : "-"}
                          </Text>
                          <Text style={styles.setMetricChipText}>
                            終了{" "}
                            {formatClockTime(
                              set.end_timestamp ?? set.timestamp,
                            ) ?? "-"}
                          </Text>
                          <Text style={styles.setMetricChipText}>
                            推定RPE{" "}
                            {estimatedRPE ? estimatedRPE.rpe.toFixed(1) : "-"}
                          </Text>
                          {set.gear_json != null ? (
                            <Text style={styles.setMetricChipText}>
                              ギア {formatBig3GearSummary(set.gear_json)}
                            </Text>
                          ) : null}
                        </View>
                        <SetVelocityMiniChart reps={trackedReps} />
                      </TouchableOpacity>
                      <View style={styles.setCardActions}>
                        <TouchableOpacity
                          style={styles.setActionButton}
                          onPress={() => {
                            void openRepDetail(set);
                          }}
                        >
                          <Text style={styles.setActionButtonText}>詳細</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.setActionButton}
                          onPress={() => handleEditSetLoad(set)}
                        >
                          <Text style={styles.setActionButtonText}>編集</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.setActionButton,
                            styles.setDeleteActionButton,
                          ]}
                          onPress={() => handleDeleteSet(set)}
                        >
                          <Text
                            style={[
                              styles.setActionButtonText,
                              styles.setDeleteActionButtonText,
                            ]}
                          >
                            削除
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

          {/* End Session */}
          {settings.session_display_end_session && (
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.finishButton]}
                onPress={handleFinishSession}
              >
                <Text style={styles.buttonText}>SESSION END</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      )}

      {/* モーダル - フォーカスモード時も表示 */}
      <ExerciseSelectModal
        visible={showExerciseModal}
        onClose={() => setShowExerciseModal(false)}
        onSelect={handleExerciseSelect}
        currentExerciseId={currentExercise?.id}
      />

      <PRNotification
        visible={showPRModal}
        prRecord={prRecord}
        onClose={() => setShowPRModal(false)}
      />

      <RepDetailModal
        visible={repDetailVisible}
        reps={selectedSetReps ?? historicalSessionReps?.reps ?? sessionAllReps}
        setIndex={selectedSetIndex}
        lift={selectedSetLift}
        loadKg={detailSet?.load_kg ?? selectedSet?.load_kg}
        setStartedAt={detailSet?.start_timestamp}
        setEndedAt={detailSet?.end_timestamp}
        setCompletedAt={detailSet?.timestamp}
        restDurationS={detailSet?.rest_duration_s}
        formVideos={detailFormVideos}
        onClose={() => {
          setRepDetailVisible(false);
          setSelectedSetReps(null);
          setDetailFormVideos([]);
        }}
        onOpenVideo={handleOpenFormVideo}
        onShareVideo={handleShareFormVideo}
        onTrimVideo={handleTrimFormVideo}
        onDeleteVideo={handleDeleteFormVideo}
        onEditSetLoad={
          selectedSet && !historicalSessionReps
            ? () => handleEditSetLoad(selectedSet)
            : undefined
        }
        onExcludeRep={!historicalSessionReps ? handleExclude : undefined}
        onMarkFailedRep={
          !historicalSessionReps ? handleMarkFailedRep : undefined
        }
        onMarkSetupRep={!historicalSessionReps ? handleMarkSetupRep : undefined}
        onAddMissedRep={!historicalSessionReps ? handleAddMissedRep : undefined}
      />

      <SetEditModal
        visible={Boolean(editingSet)}
        setItem={editingSet}
        onClose={() => setEditingSet(null)}
        onSave={handleSaveSetEdits}
      />

      <ManualRepModal
        visible={showManualRepModal}
        onClose={() => setShowManualRepModal(false)}
        onAddRep={(velocity, load) => {
          void handleAddMissedRep(velocity, load);
          setShowManualRepModal(false);
        }}
        currentLoad={currentLoad}
      />

      {formVideoOverlayVisible ? (
        <Suspense fallback={null}>
          <LazyFormVideoOverlay
            visible={formVideoOverlayVisible}
            sessionId={currentSession?.session_id ?? ""}
            lift={currentRecordingLift}
            setIndex={currentSetIndex}
            loadKg={currentLoad}
            autoStopToken={setHistory.length}
            onClose={handleCloseFormVideoRecorder}
            onSaved={handleFormVideoOverlaySaved}
          />
        </Suspense>
      ) : null}

      <ImprovementFeedbackSheet
        visible={improvementFeedbackVisible}
        sessionId={currentSession?.session_id}
        lift={currentRecordingLift}
        loadKg={currentLoad}
        sensorConnected={isConnected}
        onClose={() => setImprovementFeedbackVisible(false)}
        onSaved={() => {
          void ImprovementFeedbackService.listQueued().then((items) => {
            setQueuedFeedbackCount(items.filter((item) => item.status === "queued").length);
          });
        }}
      />

      {!isMeasuring && tooltipData && (
        <VelocityTooltip
          visible={tooltipVisible}
          onClose={() => setTooltipVisible(false)}
          term={tooltipData.term}
          definition={tooltipData.definition}
          targetRange={tooltipData.targetRange}
          currentStatus={tooltipData.currentStatus}
          currentValue={tooltipData.currentValue}
        />
      )}
    </View>
  );
}

/**
 * セット履歴ミニ速度チャート
 */
function SetVelocityMiniChart({ reps }: { reps: RepData[] }) {
  if (reps.length === 0) {
    return null;
  }

  const maxVelocity = Math.max(
    ...reps.map((rep) => rep.mean_velocity ?? 0),
    0.4,
  );

  return (
    <View style={styles.setMiniChart}>
      {reps.map((rep) => {
        const velocity = rep.mean_velocity ?? 0;
        const height = Math.max(8, Math.round((velocity / maxVelocity) * 28));
        return (
          <View
            key={`${rep.lift}_${rep.set_index}_${rep.rep_index}_${rep.id ?? "rep"}`}
            style={[
              styles.setMiniBar,
              { height },
              (rep.is_excluded || rep.is_failed) && styles.setMiniBarMuted,
            ]}
          />
        );
      })}
    </View>
  );
}

const getTrendSetKey = (set: SetData) =>
  `${set.lift}_${set.set_index}_${set.timestamp ?? set.end_timestamp ?? ""}`;

const getSetTimeMs = (set: SetData) =>
  new Date(set.end_timestamp ?? set.timestamp ?? 0).getTime();

const getAIPacketSetId = (set: SetData) =>
  `${getCanonicalExerciseName(set.lift)}#${set.set_index}@${formatLoadKg(
    set.load_kg,
  )}/${set.end_timestamp ?? set.timestamp ?? "no-time"}`;

function buildAIPacketSetList({
  storeSets,
  dbSets,
  activeLift,
}: {
  storeSets: SetData[];
  dbSets: SetData[];
  activeLift: string;
}) {
  const activeCanonical = getCanonicalExerciseName(activeLift);
  const merged = new Map<string, SetData>();

  for (const set of [...dbSets, ...storeSets]) {
    if (set.reps <= 0) continue;
    if (getCanonicalExerciseName(set.lift) !== activeCanonical) continue;
    merged.set(getAIPacketSetId(set), set);
  }

  return [...merged.values()].sort((a, b) => getSetTimeMs(a) - getSetTimeMs(b));
}

function getLatestAIPacketSet(sets: SetData[]) {
  return sets.length > 0 ? sets[sets.length - 1] : null;
}

async function getAIPacketRepsForSet(sessionId: string, set: SetData) {
  const directReps = await DatabaseService.getRepsForSet(
    sessionId,
    set.lift,
    set.set_index,
  );
  if (directReps.length > 0) return directReps;

  const canonicalLift = getCanonicalExerciseName(set.lift);
  if (canonicalLift === set.lift) return directReps;

  return DatabaseService.getRepsForSet(sessionId, canonicalLift, set.set_index);
}

function isSameSetTrendRow(row: SetTrendRow, set: SetData) {
  return (
    row.set === set.set_index &&
    isSameRecordedLoadKg(row.load, set.load_kg) &&
    row.reps === set.reps
  );
}

function setToTrendRow(
  set: SetData,
  bestWorkingAV: number | null,
  baselineROM: number | null,
): SetTrendRow {
  const avChangePct =
    set.avg_velocity != null && bestWorkingAV != null && bestWorkingAV > 0
      ? ((set.avg_velocity - bestWorkingAV) / bestWorkingAV) * 100
      : null;
  const romDiff =
    set.avg_rom_cm != null && baselineROM != null
      ? set.avg_rom_cm - baselineROM
      : null;

  return {
    set: set.set_index,
    load: set.load_kg,
    reps: set.reps,
    av: set.avg_velocity ?? null,
    avChangePct,
    vl: set.velocity_loss_avg ?? set.velocity_loss ?? null,
    vlAvg: set.velocity_loss_avg ?? set.velocity_loss ?? null,
    vlLast: set.velocity_loss_last ?? null,
    vlMin: set.velocity_loss_min ?? null,
    vlJudgementMetric: "vlLast",
    rom: set.avg_rom_cm ?? null,
    romDiff,
    e1rm: set.e1rm ?? null,
    avgHR: set.avg_hr ?? null,
    peakHR: set.peak_hr ?? null,
    hrTo120:
      set.hr_recovery_to_120_s != null && set.hr_recovery_to_120_s > 0
        ? set.hr_recovery_to_120_s
        : null,
    rest: set.rest_duration_s ?? null,
  };
}

function ensureLatestSetInTrendRows(
  rows: SetTrendRow[],
  latestSet: SetData | null,
  bestWorkingAV: number | null,
  baselineROM: number | null,
) {
  if (!latestSet) return rows;
  const withoutLatest = rows.filter(
    (row) => !isSameSetTrendRow(row, latestSet),
  );
  return [
    ...withoutLatest,
    setToTrendRow(latestSet, bestWorkingAV, baselineROM),
  ];
}

function getFixedObservationLoads(lift: string) {
  const canonical = getCanonicalExerciseName(lift).toLowerCase();
  if (canonical.includes("squat")) return [20, 70, 100, 120];
  if (canonical.includes("bench")) return [20, 60, 80, 90];
  if (canonical.includes("deadlift")) return [70, 120, 140, 150];
  return [];
}

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
    : sorted[midpoint];
}

function buildFixedObservationSnapshot(
  latestSet: SetData | null,
  recentHistory: SetData[],
) {
  if (!latestSet?.avg_velocity) return null;

  const ladder = getFixedObservationLoads(latestSet.lift);
  const stepLoad = ladder.find((load) =>
    isSameRecordedLoadKg(load, latestSet.load_kg),
  );
  if (stepLoad == null) return null;

  const canonical = getCanonicalExerciseName(latestSet.lift);
  const sameLoadBaseline = average(
    recentHistory
      .filter(
        (set) =>
          getCanonicalExerciseName(set.lift) === canonical &&
          isSameRecordedLoadKg(set.load_kg, latestSet.load_kg) &&
          set.avg_velocity != null &&
          set.avg_velocity > 0,
      )
      .map((set) => set.avg_velocity as number),
  );
  const velocityDropPct =
    sameLoadBaseline != null && sameLoadBaseline > 0
      ? ((latestSet.avg_velocity - sameLoadBaseline) / sameLoadBaseline) * 100
      : null;
  const recommendation =
    velocityDropPct == null
      ? "baseline_collect_only"
      : velocityDropPct <= -5
        ? "skip_upper_step_and_reduce_main_load"
        : velocityDropPct <= -3
          ? "fatigue_suspected"
          : "acceptable";

  return {
    ladder,
    stepLoad,
    latestAV: latestSet.avg_velocity,
    sameLoadBaselineAV: sameLoadBaseline,
    velocityDropPct,
    recommendation,
  };
}

function buildAccessoryAndRomSnapshot(
  latestSet: SetData | null,
  recentHistory: SetData[],
  currentExercise?: Exercise | null,
) {
  if (!latestSet) return null;
  const canonical = getCanonicalExerciseName(latestSet.lift);
  const isAccessory = currentExercise
    ? !isBig3Exercise(currentExercise)
    : true;
  const sameLiftHistory = recentHistory.filter(
    (set) => getCanonicalExerciseName(set.lift) === canonical,
  );
  const baselineHistory = isAccessory
    ? sameLiftHistory.filter((set) => isAccessoryRmRepRange(set.reps))
    : sameLiftHistory;
  const sameLoadHistory = baselineHistory.filter((set) =>
    isSameRecordedLoadKg(set.load_kg, latestSet.load_kg),
  );
  const previousBestE1RM = Math.max(
    ...baselineHistory
      .map((set) => set.e1rm ?? null)
      .filter((value): value is number => value != null && value > 0),
    0,
  );
  const previousBestSameLoadReps = Math.max(
    ...sameLoadHistory.map((set) => set.reps ?? 0),
    0,
  );
  const previousBestSameLoadVolume = Math.max(
    ...sameLoadHistory.map((set) => (set.load_kg || 0) * (set.reps || 0)),
    0,
  );
  const romBaseline = median(
    sameLiftHistory
      .map((set) => set.avg_rom_cm ?? null)
      .filter((value): value is number => value != null && value > 0),
  );
  const romChangePct =
    latestSet.avg_rom_cm != null && romBaseline != null && romBaseline > 0
      ? ((latestSet.avg_rom_cm - romBaseline) / romBaseline) * 100
      : null;
  return {
    isAccessory,
    e1rmPR:
      (!isAccessory || isAccessoryRmRepRange(latestSet.reps)) &&
      latestSet.e1rm != null &&
      previousBestE1RM > 0 &&
      latestSet.e1rm > previousBestE1RM,
    sameLoadRepPR:
      (!isAccessory || isAccessoryRmRepRange(latestSet.reps)) &&
      previousBestSameLoadReps > 0 && latestSet.reps > previousBestSameLoadReps,
    sameLoadVolumePR:
      (!isAccessory || isAccessoryRmRepRange(latestSet.reps)) &&
      previousBestSameLoadVolume > 0 &&
      latestSet.load_kg * latestSet.reps > previousBestSameLoadVolume,
    previousBestE1RM: previousBestE1RM || null,
    previousBestSameLoadReps: previousBestSameLoadReps || null,
    previousBestSameLoadVolume: previousBestSameLoadVolume || null,
    romBaseline,
    romChangePct,
    romMeasurementWarning:
      romChangePct != null && Math.abs(romChangePct) >= 15
        ? "measurement_position_may_have_changed"
        : null,
  };
}

function getSetTrendWindow(allSets: SetData[], currentSet: SetData) {
  const sameLiftSets = allSets
    .filter(
      (set) =>
        set.lift === currentSet.lift &&
        typeof set.avg_velocity === "number" &&
        set.avg_velocity > 0,
    )
    .sort(
      (a, b) =>
        new Date(a.timestamp ?? a.end_timestamp ?? 0).getTime() -
        new Date(b.timestamp ?? b.end_timestamp ?? 0).getTime(),
    );

  const currentKey = getTrendSetKey(currentSet);
  const currentIndex = sameLiftSets.findIndex(
    (set) => getTrendSetKey(set) === currentKey,
  );
  const endIndex =
    currentIndex >= 0 ? currentIndex + 1 : Math.min(sameLiftSets.length, 6);
  return sameLiftSets.slice(Math.max(0, endIndex - 6), endIndex);
}

/**
 * セット履歴カード用の同一種目AV推移ミニグラフ
 */
function SetTrendMiniChart({
  sets,
  currentSet,
}: {
  sets: SetData[];
  currentSet: SetData;
}) {
  if (sets.length <= 1) {
    return null;
  }

  const velocities = sets
    .map((set) => set.avg_velocity ?? 0)
    .filter((value) => value > 0);
  const maxVelocity = Math.max(...velocities, 0.4);
  const minVelocity = Math.min(...velocities, maxVelocity);
  const range = Math.max(0.05, maxVelocity - minVelocity);
  const currentKey = getTrendSetKey(currentSet);

  return (
    <View style={styles.setTrendMiniChart}>
      {sets.map((set) => {
        const velocity = set.avg_velocity ?? minVelocity;
        const height = Math.max(
          6,
          Math.round(((velocity - minVelocity) / range) * 18) + 6,
        );
        const isCurrent = getTrendSetKey(set) === currentKey;
        return (
          <View
            key={getTrendSetKey(set)}
            style={[
              styles.setTrendMiniBar,
              { height },
              isCurrent && styles.setTrendMiniBarActive,
            ]}
          />
        );
      })}
    </View>
  );
}

/**
 * レストタイマーコンポーネント
 */
function RestTimer({
  startTime,
  hr,
  peakHr,
}: {
  startTime: number;
  hr: number | null;
  peakHr: number | null | undefined;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const isReady = hr && peakHr ? hr < 120 || hr < peakHr * 0.8 : false;

  return (
    <View style={styles.timerRow}>
      <Text style={styles.timerText}>{formatTime(elapsed)}</Text>
      {hr != null ? (
        <View style={styles.timerHrBadge}>
          <Text style={styles.timerHrLabel}>心拍</Text>
          <Text style={styles.timerHrText}>{Math.round(hr)}</Text>
        </View>
      ) : null}
      {isReady && (
        <View style={styles.readyBadge}>
          <Text style={styles.readyText}>READY</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screenFrame: {
    flex: 1,
    backgroundColor: GarageTheme.background,
  },
  screenFrameRecording: {
    borderWidth: 2,
    borderColor: "#ef4444",
    shadowColor: "#ef4444",
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 5,
  },
  container: {
    flex: 1,
    backgroundColor: GarageTheme.background,
  },
  header: {
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: GarageTheme.borderStrong,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: GarageTheme.accent,
    fontSize: 24,
    fontWeight: "500",
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: GarageTheme.textStrong,
    letterSpacing: 0,
  },
  setNumber: {
    fontSize: 16,
    color: GarageTheme.textMuted,
  },
  statusCard: {
    margin: 16,
    padding: 14,
    backgroundColor: GarageTheme.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: GarageTheme.borderStrong,
    shadowColor: GarageTheme.accent,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  reconnectSensorButton: {
    alignSelf: "flex-start",
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GarageTheme.accent,
    backgroundColor: GarageTheme.panel,
  },
  reconnectSensorButtonText: {
    color: GarageTheme.accent,
    fontSize: 12,
    fontWeight: "700",
  },
  simulatorCard: {
    marginHorizontal: 16,
    marginTop: -6,
    marginBottom: 16,
    padding: 12,
    backgroundColor: GarageTheme.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  simulatorTitle: {
    color: GarageTheme.textStrong,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0,
  },
  simulatorMeta: {
    color: GarageTheme.textSubtle,
    fontSize: 10,
    fontWeight: "500",
    marginTop: 2,
  },
  simulatorActions: {
    flexDirection: "row",
    gap: 8,
  },
  simulatorButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    backgroundColor: GarageTheme.panel,
    minWidth: 54,
    alignItems: "center",
  },
  simulatorButtonDisabled: {
    opacity: 0.5,
  },
  simulatorButtonText: {
    color: GarageTheme.accentSoft,
    fontSize: 11,
    fontWeight: "600",
  },
  hrBadge: {
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GarageTheme.panel,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 4,
  },
  hrValue: { fontSize: 16, fontWeight: "bold", color: GarageTheme.danger },
  hrUnit: { fontSize: 10, color: GarageTheme.textMuted },
  signalDot: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginLeft: 4,
  },
  signalLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#f7f8f8",
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: GarageTheme.textStrong,
    fontWeight: "500",
    letterSpacing: 0,
  },
  exerciseCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: GarageTheme.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: GarageTheme.border,
    shadowColor: GarageTheme.textStrong,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  supervisorRecommendationCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    backgroundColor: GarageTheme.accentSoft + "12",
    borderColor: GarageTheme.accentSoft + "55",
    borderRadius: 10,
    borderWidth: 1,
  },
  supervisorRecommendationHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
    marginBottom: 10,
  },
  supervisorRecommendationCopy: {
    flex: 1,
  },
  supervisorRecommendationAction: {
    borderColor: GarageTheme.accentSoft,
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  supervisorRecommendationActionText: {
    color: GarageTheme.accentSoft,
    fontSize: 11,
    fontWeight: "800",
  },
  supervisorRecommendationKicker: {
    color: GarageTheme.accentSoft,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  supervisorRecommendationTitle: {
    color: GarageTheme.textStrong,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 3,
  },
  supervisorRecommendationMeta: {
    color: GarageTheme.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  supervisorRecommendationBadge: {
    color: GarageTheme.accentSoft,
    fontSize: 12,
    fontWeight: "800",
  },
  supervisorRecommendationList: {
    gap: 8,
    paddingRight: 8,
  },
  supervisorRecommendationItem: {
    backgroundColor: GarageTheme.surface,
    borderColor: GarageTheme.border,
    borderRadius: 8,
    borderWidth: 1,
    minHeight: 86,
    padding: 10,
    width: 188,
  },
  supervisorRecommendationItemActive: {
    borderColor: GarageTheme.accent,
    borderWidth: 2,
  },
  supervisorRecommendationExercise: {
    color: GarageTheme.textStrong,
    fontSize: 13,
    fontWeight: "800",
  },
  supervisorRecommendationLoad: {
    color: GarageTheme.accentSoft,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 7,
  },
  supervisorRecommendationDetail: {
    color: GarageTheme.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  supervisorRecommendationMissing: {
    color: GarageTheme.warning,
    fontSize: 10,
    marginTop: 4,
  },
  supervisorRecommendationEmpty: {
    borderTopColor: GarageTheme.border,
    borderTopWidth: 1,
    marginTop: 10,
    paddingTop: 12,
  },
  supervisorRecommendationEmptyTitle: {
    color: GarageTheme.textStrong,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 4,
  },
  supervisorRecommendationOpenButton: {
    alignSelf: "flex-start",
    backgroundColor: GarageTheme.accent,
    borderRadius: 6,
    marginTop: 10,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  supervisorRecommendationOpenButtonText: {
    color: GarageTheme.textStrong,
    fontSize: 12,
    fontWeight: "800",
  },
  exerciseLabel: {
    fontSize: 10,
    color: GarageTheme.textSubtle,
    marginBottom: 10,
    letterSpacing: 0,
    fontWeight: "600",
  },
  exerciseSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: "bold",
    color: GarageTheme.textStrong,
  },
  exerciseCategory: {
    fontSize: 14,
    color: GarageTheme.textMuted,
    marginTop: 2,
  },
  trainingNotesCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    backgroundColor: GarageTheme.accentSoft + "15",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: GarageTheme.accentSoft + "40",
  },
  noteSection: {
    marginBottom: 8,
  },
  noteLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: GarageTheme.accentSoft,
    textTransform: "uppercase",
    letterSpacing: 0,
    marginBottom: 4,
  },
  noteText: {
    fontSize: 13,
    color: GarageTheme.textStrong,
    lineHeight: 18,
  },
  sessionNoteCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    backgroundColor: GarageTheme.surfaceAlt,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: GarageTheme.border,
  },
  sessionNoteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sessionNoteLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: GarageTheme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  sessionNoteEditButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sessionNoteEditText: {
    fontSize: 12,
    color: GarageTheme.accent,
    fontWeight: "600",
  },
  sessionNoteEditContainer: {
    gap: 8,
  },
  sessionNoteInput: {
    backgroundColor: GarageTheme.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: GarageTheme.textStrong,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    minHeight: 80,
  },
  sessionNoteSaveButton: {
    backgroundColor: GarageTheme.success,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  sessionNoteSaveButtonText: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: "bold",
  },
  sessionNoteText: {
    fontSize: 13,
    color: GarageTheme.textStrong,
    lineHeight: 18,
  },
  exerciseChange: {
    color: GarageTheme.accent,
    fontSize: 14,
    fontWeight: "bold",
  },
  exerciseSelectButton: {
    padding: 12,
    backgroundColor: GarageTheme.border,
    borderRadius: 8,
    alignItems: "center",
  },
  exerciseSelectButtonText: {
    color: GarageTheme.accent,
    fontSize: 16,
  },
  accessoryTargetCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#16131f",
    borderWidth: 2,
    borderColor: "#6f4cff",
  },
  accessoryTargetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  accessoryTargetEyebrow: {
    color: "#b7a8ff",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0,
    marginBottom: 4,
  },
  accessoryTargetTitle: {
    color: GarageTheme.textStrong,
    fontSize: 18,
    fontWeight: "600",
  },
  accessoryTargetBadge: {
    color: "#130f20",
    backgroundColor: "#b7a8ff",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: "600",
  },
  accessoryTargetGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  accessoryTargetMetric: {
    flex: 1,
    minHeight: 62,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#221b35",
    borderWidth: 1,
    borderColor: "#3d3165",
  },
  accessoryTargetLabel: {
    color: "#a395d8",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 5,
  },
  accessoryTargetValue: {
    color: GarageTheme.textStrong,
    fontSize: 16,
    fontWeight: "600",
  },
  accessoryTargetTable: {
    gap: 8,
    paddingRight: 8,
  },
  accessoryTargetCell: {
    width: 86,
    padding: 9,
    borderRadius: 10,
    backgroundColor: "#0f0d16",
    borderWidth: 1,
    borderColor: "#3d3165",
  },
  accessoryTargetRep: {
    color: "#b7a8ff",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
  },
  accessoryTargetLoad: {
    color: GarageTheme.textStrong,
    fontSize: 15,
    fontWeight: "600",
  },
  accessoryTargetCellMeta: {
    color: GarageTheme.textMuted,
    fontSize: 9,
    fontWeight: "500",
    marginTop: 4,
  },
  accessoryTargetNote: {
    color: "#c6bddf",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
    fontWeight: "500",
  },
  section: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: GarageTheme.textStrong,
    marginBottom: 12,
  },
  recentHistoryScroll: {
    marginTop: 8,
  },
  recentHistoryContent: {
    paddingRight: 16,
    gap: 12,
  },
  recentHistoryCard: {
    backgroundColor: GarageTheme.surface,
    borderRadius: 12,
    borderWidth: 2,
    padding: 14,
    minWidth: 140,
    shadowColor: GarageTheme.textStrong,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  recentHistoryDate: {
    fontSize: 12,
    color: GarageTheme.textMuted,
    fontWeight: "500",
    marginBottom: 10,
    letterSpacing: 0,
  },
  recentHistoryStats: {
    gap: 8,
  },
  recentHistoryStat: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: GarageTheme.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  recentHistoryStatLabel: {
    fontSize: 10,
    color: GarageTheme.textSubtle,
    fontWeight: "500",
    letterSpacing: 0,
  },
  recentHistoryStatValue: {
    fontSize: 14,
    color: GarageTheme.textStrong,
    fontWeight: "600",
  },
  recentHistoryE1RM: {
    fontSize: 12,
    color: GarageTheme.accent,
    fontWeight: "600",
    marginTop: 10,
    letterSpacing: 0,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: GarageTheme.surfaceAlt,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 16,
    color: GarageTheme.textStrong,
  },
  loadControlContainer: {
    backgroundColor: GarageTheme.surfaceAlt,
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  loadControlLabel: {
    fontSize: 14,
    color: GarageTheme.textMuted,
    marginBottom: 12,
    textAlign: "center",
  },
  loadControlWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  loadAdjustRow: {
    flexDirection: "row",
    gap: 8,
  },
  adjustBtn: {
    backgroundColor: GarageTheme.border,
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  adjustBtnText: {
    color: GarageTheme.textStrong,
    fontSize: 16,
    fontWeight: "bold",
  },
  loadDisplayValue: {
    minWidth: 80,
    alignItems: "center",
  },
  loadDisplayValueText: {
    color: GarageTheme.success,
    fontSize: 32,
    fontWeight: "bold",
  },
  loadInputRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadInput: {
    minWidth: 120,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    backgroundColor: GarageTheme.background,
    color: GarageTheme.textStrong,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "500",
  },
  readinessCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: GarageTheme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  readinessHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
    gap: 12,
  },
  readinessKicker: {
    color: GarageTheme.textSubtle,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0,
    marginBottom: 4,
  },
  readinessTitle: {
    color: GarageTheme.textStrong,
    fontSize: 18,
    fontWeight: "600",
  },
  readinessRoleBadge: {
    color: GarageTheme.info,
    fontSize: 12,
    fontWeight: "600",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: GarageTheme.info + "18",
    overflow: "hidden",
  },
  readinessGrid: {
    flexDirection: "row",
    gap: 10,
  },
  readinessField: {
    flex: 1,
    marginBottom: 12,
  },
  readinessLabel: {
    color: GarageTheme.textMuted,
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 7,
  },
  readinessInput: {
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    backgroundColor: GarageTheme.background,
    color: GarageTheme.textStrong,
    fontSize: 15,
    fontWeight: "500",
  },
  readinessSelect: {
    minHeight: 42,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    backgroundColor: GarageTheme.background,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  readinessSelectText: {
    color: GarageTheme.textStrong,
    fontSize: 15,
    fontWeight: "600",
  },
  readinessSelectArrow: {
    color: GarageTheme.info,
    fontSize: 11,
    fontWeight: "600",
  },
  readinessHintSmall: {
    marginTop: 6,
    color: GarageTheme.textSubtle,
    fontSize: 10,
    lineHeight: 14,
  },
  modalBackdrop: {
    flex: 1,
    padding: 20,
    backgroundColor: "rgba(0, 0, 0, 0.68)",
    justifyContent: "center",
  },
  weekDayPickerCard: {
    padding: 18,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    backgroundColor: GarageTheme.surface,
  },
  weekDayPickerTitle: {
    color: GarageTheme.textStrong,
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 14,
  },
  weekDayPickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  weekDayOption: {
    width: "23%",
    minHeight: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    backgroundColor: GarageTheme.background,
    alignItems: "center",
    justifyContent: "center",
  },
  weekDayOptionActive: {
    borderColor: GarageTheme.info,
    backgroundColor: GarageTheme.info + "25",
  },
  weekDayOptionText: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  weekDayOptionTextActive: {
    color: GarageTheme.textStrong,
  },
  weekDayCancelButton: {
    marginTop: 16,
    minHeight: 42,
    borderRadius: 12,
    backgroundColor: GarageTheme.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  weekDayCancelText: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: "600",
  },
  readinessChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  readinessChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    backgroundColor: GarageTheme.surfaceAlt,
  },
  readinessChipActive: {
    borderColor: GarageTheme.info,
    backgroundColor: GarageTheme.info + "25",
  },
  readinessChipText: {
    color: GarageTheme.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  readinessChipTextActive: {
    color: GarageTheme.textStrong,
  },
  readinessHint: {
    color: GarageTheme.textSubtle,
    fontSize: 12,
    lineHeight: 17,
  },
  breathForgeWarmupButton: {
    marginTop: 14,
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GarageTheme.info,
    backgroundColor: GarageTheme.info + "18",
    justifyContent: "center",
  },
  breathForgeWarmupButtonText: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: "700",
  },
  breathForgeWarmupButtonHint: {
    marginTop: 3,
    color: GarageTheme.textMuted,
    fontSize: 11,
  },
  dataCard: {
    margin: 16,
    padding: 18,
    backgroundColor: GarageTheme.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: GarageTheme.success,
    minHeight: 120,
    justifyContent: "center",
    shadowColor: GarageTheme.success,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  dataTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: GarageTheme.success,
    marginBottom: 12,
    textAlign: "left",
    letterSpacing: 0,
  },
  dataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: GarageTheme.border,
    alignItems: "center",
  },
  dataLabel: {
    fontSize: 11,
    color: GarageTheme.textMuted,
    flex: 1,
    letterSpacing: 0,
    fontWeight: "500",
  },
  dataValue: {
    fontSize: 20,
    fontWeight: "600",
    color: GarageTheme.textStrong,
  },
  helpIcon: {
    fontSize: 12,
    color: GarageTheme.textSubtle,
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: GarageTheme.chip,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    textAlign: "center",
    minWidth: 18,
  },
  noDataText: {
    color: GarageTheme.textSubtle,
    textAlign: "center",
    fontSize: 13,
    letterSpacing: 0,
  },
  buttonContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  button: {
    padding: 18,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: GarageTheme.textStrong,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  recordButton: {
    backgroundColor: GarageTheme.success,
    borderWidth: 2,
    borderColor: GarageTheme.success + "60",
  },
  formVideoButton: {
    backgroundColor: GarageTheme.danger,
    borderWidth: 2,
    borderColor: GarageTheme.danger + "60",
  },
  improvementFeedbackButton: {
    borderWidth: 1,
    borderColor: GarageTheme.accent,
  },
  supervisorButton: {
    backgroundColor: GarageTheme.info,
    borderWidth: 2,
    borderColor: GarageTheme.info + "60",
  },
  finishButton: {
    backgroundColor: GarageTheme.warning,
    borderWidth: 2,
    borderColor: GarageTheme.warning + "60",
  },
  buttonText: {
    color: GarageTheme.textStrong,
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: 0,
  },
  warmupButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: GarageTheme.surfaceAlt,
    borderWidth: 2,
    borderColor: GarageTheme.borderStrong,
    marginRight: 10,
  },
  warmupButtonActive: {
    backgroundColor: GarageTheme.accentSoft,
    borderColor: GarageTheme.accentSoft,
    shadowColor: GarageTheme.accentSoft,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  dropSetButtonActive: {
    backgroundColor: "rgba(245,158,11,0.18)",
    borderColor: GarageTheme.warning,
    shadowColor: GarageTheme.warning,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  amrapButtonActive: {
    backgroundColor: "rgba(34,197,94,0.18)",
    borderColor: GarageTheme.success,
    shadowColor: GarageTheme.success,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  warmupButtonText: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0,
  },
  setCard: {
    backgroundColor: GarageTheme.surfaceAlt,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: GarageTheme.border,
    shadowColor: GarageTheme.textStrong,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  setHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  setExerciseName: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    color: GarageTheme.textStrong,
    marginRight: 8,
    letterSpacing: 0,
  },
  setMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  setMetaRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  setNumberText: {
    fontSize: 14,
    fontWeight: "600",
    color: GarageTheme.textMuted,
    letterSpacing: 0,
  },
  setLoad: {
    fontSize: 16,
    color: GarageTheme.accent,
    fontWeight: "500",
  },
  setRowDetail: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  setMetricChipText: {
    fontSize: 11,
    color: GarageTheme.textMuted,
    fontWeight: "500",
    letterSpacing: 0,
    backgroundColor: GarageTheme.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  setMiniChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    marginTop: 12,
    minHeight: 32,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: GarageTheme.border,
  },
  setMiniBar: {
    width: 12,
    borderRadius: 4,
    backgroundColor: GarageTheme.accent,
  },
  setMiniBarMuted: {
    opacity: 0.3,
    backgroundColor: GarageTheme.textSubtle,
  },
  setTrendMiniChart: {
    height: 28,
    minWidth: 48,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: GarageTheme.background,
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  setTrendMiniBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: GarageTheme.textMuted,
  },
  setTrendMiniBarActive: {
    backgroundColor: GarageTheme.accent,
  },
  setCardActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: GarageTheme.border,
  },
  setActionButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: GarageTheme.borderStrong,
    backgroundColor: GarageTheme.chip,
  },
  setDeleteActionButton: {
    borderColor: "#ef4444",
    backgroundColor: "rgba(255, 77, 79, 0.08)",
  },
  setActionButtonText: {
    color: GarageTheme.textStrong,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0,
  },
  setDeleteActionButtonText: {
    color: "#ef4444",
  },
  setVelocity: {
    fontSize: 14,
    color: GarageTheme.success,
    fontWeight: "500",
  },
  setVelocityLoss: {
    fontSize: 13,
    color: GarageTheme.warning,
    fontWeight: "500",
  },
  // セッション開始/アクティブバナー
  sessionStartBanner: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 18,
    backgroundColor: GarageTheme.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: GarageTheme.accentSoft + "60",
    shadowColor: GarageTheme.accentSoft,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  startSessionButton: {
    backgroundColor: GarageTheme.accentSoft,
    width: "100%",
    shadowColor: GarageTheme.accentSoft,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sessionActiveBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    backgroundColor: GarageTheme.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: GarageTheme.success + "40",
    shadowColor: GarageTheme.success,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  sessionActiveActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sensorMuteButton: {
    backgroundColor: GarageTheme.surfaceAlt,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: GarageTheme.borderStrong,
  },
  sensorMuteButtonActive: {
    backgroundColor: GarageTheme.danger,
    borderColor: GarageTheme.danger,
  },
  sensorMuteButtonText: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0,
  },
  sensorMuteButtonTextActive: {
    color: GarageTheme.textStrong,
  },
  pauseBtn: {
    backgroundColor: GarageTheme.panel,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: GarageTheme.borderStrong,
    shadowColor: GarageTheme.textStrong,
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  pausedBtnActive: {
    backgroundColor: GarageTheme.warning,
    borderColor: GarageTheme.warning,
    shadowColor: GarageTheme.warning,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pauseBtnContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pauseBtnIcon: {
    color: GarageTheme.textStrong,
    fontSize: 16,
    fontWeight: "500",
  },
  pauseBtnText: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0,
  },
  // レストバナー
  restBanner: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 18,
    backgroundColor: GarageTheme.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: GarageTheme.info + "40",
    shadowColor: GarageTheme.info,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  restHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  restLabel: {
    fontSize: 13,
    color: GarageTheme.info,
    fontWeight: "600",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  timerText: {
    fontSize: 32,
    fontWeight: "600",
    color: GarageTheme.textStrong,
    fontVariant: ["tabular-nums"],
    letterSpacing: 0,
  },
  timerHrBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: GarageTheme.danger + "15",
    borderWidth: 2,
    borderColor: GarageTheme.danger + "40",
  },
  timerHrLabel: {
    color: GarageTheme.danger,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  timerHrText: {
    color: GarageTheme.danger,
    fontSize: 18,
    fontWeight: "600",
  },
  readyBadge: {
    backgroundColor: GarageTheme.success,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: GarageTheme.success,
  },
  readyText: {
    color: GarageTheme.textStrong,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0,
  },
  startNextSetButton: {
    backgroundColor: GarageTheme.success,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
    shadowColor: GarageTheme.success,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  startNextSetText: {
    color: GarageTheme.textStrong,
    fontSize: 17,
    fontWeight: "600",
    letterSpacing: 0,
  },
  // 速度ゾーンバッジ
  zoneBadge: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    borderWidth: 2,
    marginBottom: 12,
    backgroundColor: GarageTheme.background,
    gap: 8,
  },
  zoneTag: {
    fontSize: 12,
    fontWeight: "600",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  zoneName: { fontSize: 16, fontWeight: "bold" },
  // ChatGPT用コンテキストコピー（ヘッダー）
  coachNavButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: GarageTheme.panel,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GarageTheme.accent,
  },
  coachNavButtonText: {
    color: GarageTheme.accent,
    fontSize: 14,
    fontWeight: "500",
    letterSpacing: 0,
  },
  supervisorProgramBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    backgroundColor: GarageTheme.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  supervisorProgramLabel: {
    color: GarageTheme.accentSoft,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0,
  },
  supervisorProgramValue: {
    color: GarageTheme.textStrong,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  supervisorProgramMeta: {
    color: GarageTheme.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  supervisorProgramBadge: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GarageTheme.success,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  supervisorProgramBadgeStale: {
    borderColor: GarageTheme.warning,
  },
  supervisorProgramBadgeText: {
    color: GarageTheme.textStrong,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0,
  },
  terminationStatusStrip: {
    marginHorizontal: 16,
    marginBottom: 12,
    flexDirection: "row",
    gap: 8,
  },
  terminationStatusItem: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    backgroundColor: GarageTheme.panel,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: "center",
  },
  terminationStatusLabel: {
    color: GarageTheme.textSubtle,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0,
  },
  terminationStatusValue: {
    color: GarageTheme.textStrong,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3,
  },
  legacyDashboardReturnBanner: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    backgroundColor: GarageTheme.surface,
    gap: 10,
  },
  legacyDashboardReturnText: {
    color: GarageTheme.text,
    fontSize: 13,
    lineHeight: 18,
  },
  legacyDashboardReturnButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GarageTheme.accent,
    backgroundColor: GarageTheme.panel,
  },
  legacyDashboardReturnButtonText: {
    color: GarageTheme.accent,
    fontSize: 13,
    fontWeight: "600",
  },
  diagnosticBar: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    backgroundColor: GarageTheme.surfaceAlt,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  diagnosticBarWarning: {
    borderColor: GarageTheme.warning,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
  },
  diagnosticTextGroup: {
    flex: 1,
    gap: 3,
  },
  diagnosticBarText: {
    color: GarageTheme.textSubtle,
    fontSize: 12,
    fontWeight: "500",
  },
  diagnosticBarSubText: {
    color: GarageTheme.warning,
    fontSize: 11,
    fontWeight: "500",
    lineHeight: 15,
    flex: 1,
  },
  diagnosticButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GarageTheme.warning,
    backgroundColor: GarageTheme.panel,
  },
  diagnosticShareButton: {
    borderColor: GarageTheme.accent,
    backgroundColor: "rgba(59, 130, 246, 0.14)",
  },
  diagnosticButtonText: {
    color: GarageTheme.warning,
    fontSize: 12,
    fontWeight: "600",
  },
  diagnosticShareButtonText: {
    color: GarageTheme.accent,
    fontSize: 12,
    fontWeight: "600",
  },
  // Target Weight & Warmup UI
  targetWeightCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: GarageTheme.surfaceAlt,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: GarageTheme.border,
  },
  targetWeightLabel: {
    fontSize: 13,
    color: GarageTheme.accent,
    fontWeight: "bold",
    marginBottom: 10,
    letterSpacing: 0,
  },
  targetInputRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  targetInput: {
    flex: 1,
    backgroundColor: GarageTheme.background,
    borderRadius: 8,
    padding: 12,
    color: GarageTheme.textStrong,
    fontSize: 18,
    fontWeight: "bold",
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  unitText: { color: GarageTheme.textMuted, fontSize: 16 },
  warmupScroll: { marginTop: 4, paddingBottom: 8 },
  warmupStep: {
    backgroundColor: GarageTheme.surfaceAlt,
    borderRadius: 10,
    padding: 12,
    marginRight: 10,
    minWidth: 85,
    alignItems: "center",
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  warmupStepActive: {
    backgroundColor: GarageTheme.background,
    borderColor: GarageTheme.accent,
    borderWidth: 2,
  },
  warmupStepLabel: {
    fontSize: 10,
    color: GarageTheme.textMuted,
    marginBottom: 4,
  },
  warmupStepLabelActive: { color: GarageTheme.accent, fontWeight: "bold" },
  warmupWeight: {
    fontSize: 16,
    fontWeight: "bold",
    color: GarageTheme.textStrong,
  },
  warmupWeightActive: { color: GarageTheme.accent },
  warmupReps: { fontSize: 10, color: GarageTheme.textSubtle, marginTop: 2 },
  warmupRepsActive: { color: GarageTheme.textMuted },
  // VBT Intelligence & CNS Battery UI
  intelligenceRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  cnsBatteryContainer: {
    flex: 1,
    backgroundColor: GarageTheme.surfaceAlt,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  cnsLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: GarageTheme.textMuted,
    marginBottom: 6,
  },
  batteryGageBg: {
    width: "100%",
    height: 8,
    backgroundColor: GarageTheme.border,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 4,
  },
  batteryGageFill: {
    height: "100%",
    borderRadius: 4,
  },
  cnsValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: GarageTheme.textStrong,
  },
  intelligenceBadge: {
    width: 100,
    backgroundColor: GarageTheme.panel,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
  },
  intelligenceLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: GarageTheme.accentSoft,
    marginBottom: 4,
    textAlign: "center",
  },
  intelligenceValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: GarageTheme.textStrong,
  },
  unitSmall: {
    fontSize: 10,
    color: GarageTheme.textMuted,
  },
  confidenceIndicator: {
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 9,
    color: GarageTheme.textStrong,
    fontWeight: "bold",
  },
  // Adaptive Load Suggestion
  optimizeMvtButton: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GarageTheme.accentSoft,
    backgroundColor: GarageTheme.surface,
    alignItems: "center",
  },
  optimizeMvtButtonText: {
    color: GarageTheme.accentSoft,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0,
  },
  suggestionBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    backgroundColor: GarageTheme.panel,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: GarageTheme.accent,
  },
  suggestionContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  suggestionEmoji: { fontSize: 18 },
  suggestionText: { color: GarageTheme.textStrong, fontSize: 14 },
  suggestionWeight: { fontWeight: "bold", color: GarageTheme.accentSoft },
  applyText: {
    color: GarageTheme.accent,
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 0,
  },
  setHR: {
    fontSize: 13,
    color: GarageTheme.danger,
    marginTop: 2,
    fontWeight: "bold",
  },
  setZoneTag: {
    fontSize: 11,
    fontWeight: "600",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
  },
  // Premium dashboard control styles
  sessionStartBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  sessionStartBadge: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: GarageTheme.accentSoft + "20",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: GarageTheme.accentSoft,
  },
  sessionStartBadgeIcon: {
    fontSize: 20,
  },
  sessionStartTextContainer: {
    flex: 1,
  },
  sessionStartTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: GarageTheme.textStrong,
    letterSpacing: 0,
    marginBottom: 4,
  },
  sessionStartSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    color: GarageTheme.success,
    letterSpacing: 0,
  },
  sessionActiveBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  sessionActiveIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: GarageTheme.success + "30",
    borderWidth: 2,
    borderColor: GarageTheme.success,
    alignItems: "center",
    justifyContent: "center",
  },
  sessionActiveIndicatorPaused: {
    backgroundColor: GarageTheme.warning + "30",
    borderColor: GarageTheme.warning,
  },
  sessionActiveIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GarageTheme.success,
  },
  sessionActiveIndicatorDotPaused: {
    backgroundColor: GarageTheme.warning,
  },
  sessionActiveTextContainer: {
    flex: 1,
  },
  sessionActiveTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: GarageTheme.textStrong,
    letterSpacing: 0,
    marginBottom: 2,
  },
  sessionActiveSubtitle: {
    fontSize: 11,
    fontWeight: "500",
    color: GarageTheme.textMuted,
    letterSpacing: 0,
    textTransform: "uppercase",
  },
  // VL設定カード
  vlSettingsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    backgroundColor: GarageTheme.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: GarageTheme.border,
  },
  vlSettingsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  vlSettingsTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: GarageTheme.textMuted,
    letterSpacing: 0,
  },
  vlSettingsMeta: {
    marginTop: 4,
    fontSize: 11,
    color: GarageTheme.accent,
    fontWeight: "500",
  },
  vlToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  vlToggleLabel: {
    fontSize: 13,
    color: GarageTheme.textStrong,
    fontWeight: "600",
  },
  vlToggleButton: {
    width: 48,
    height: 26,
    borderRadius: 12,
    backgroundColor: GarageTheme.border,
    padding: 2,
  },
  vlToggleButtonOn: {
    backgroundColor: GarageTheme.accent,
  },
  vlToggleOff: {
    backgroundColor: GarageTheme.surface,
  },
  vlToggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: GarageTheme.textStrong,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  vlToggleKnobOn: {
    alignSelf: "flex-end",
    backgroundColor: GarageTheme.background,
  },
  vlToggleKnobOff: {
    alignSelf: "flex-start",
    backgroundColor: GarageTheme.textMuted,
  },
  vlThresholdButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  vlThresholdButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: GarageTheme.background,
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  vlThresholdButtonSelected: {
    backgroundColor: GarageTheme.accent + "20",
    borderColor: GarageTheme.accent,
  },
  vlThresholdButtonUnselected: {
    backgroundColor: GarageTheme.surface,
    borderColor: GarageTheme.border,
  },
  vlThresholdButtonText: {
    fontSize: 12,
    color: GarageTheme.textMuted,
    fontWeight: "500",
  },
  vlThresholdButtonTextSelected: {
    color: GarageTheme.accent,
  },
  vlThresholdButtonTextUnselected: {
    color: GarageTheme.textMuted,
  },
  protocolCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    backgroundColor: GarageTheme.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    gap: 10,
  },
  protocolHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  protocolKicker: {
    fontSize: 11,
    fontWeight: "600",
    color: GarageTheme.textMuted,
    letterSpacing: 0,
  },
  protocolPhase: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "600",
    color: GarageTheme.accent,
    textAlign: "right",
  },
  protocolTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: GarageTheme.textStrong,
    lineHeight: 22,
  },
  protocolGrid: {
    flexDirection: "row",
    gap: 10,
  },
  protocolDivider: {
    height: 1,
    backgroundColor: GarageTheme.border,
  },
  protocolMetric: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  protocolMetricLabel: {
    fontSize: 11,
    color: GarageTheme.textMuted,
    fontWeight: "500",
    marginBottom: 4,
  },
  protocolMetricValue: {
    fontSize: 14,
    color: GarageTheme.textStrong,
    fontWeight: "600",
  },
  protocolBody: {
    fontSize: 12,
    lineHeight: 18,
    color: GarageTheme.textMuted,
    fontWeight: "600",
  },
  lvpChecklist: {
    gap: 8,
  },
  lvpCheckpoint: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: GarageTheme.border,
  },
  lvpCheckpointRange: {
    width: 74,
    fontSize: 13,
    color: GarageTheme.textStrong,
    fontWeight: "600",
  },
  lvpCheckpointText: {
    flex: 1,
    fontSize: 12,
    color: GarageTheme.textMuted,
    fontWeight: "600",
    textAlign: "right",
  },
  vbtDecisionCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: GarageTheme.surfaceAlt,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    gap: 8,
  },
  vbtDecisionPositive: {
    borderColor: GarageTheme.success,
  },
  vbtDecisionWarn: {
    borderColor: GarageTheme.warning,
  },
  vbtDecisionDanger: {
    borderColor: GarageTheme.danger,
  },
  vbtDecisionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  attemptGrid: {
    flexDirection: "row",
    gap: 8,
  },
  attemptCell: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  attemptValue: {
    fontSize: 14,
    lineHeight: 18,
    color: GarageTheme.textStrong,
    fontWeight: "600",
  },
  purposeChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  purposeChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  purposeChipActive: {
    backgroundColor: GarageTheme.accent,
    borderColor: GarageTheme.accent,
  },
  purposeChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: GarageTheme.textMuted,
  },
  purposeChipTextActive: {
    color: "#f7f8f8",
  },
  nextSetSummaryRow: {
    flexDirection: "row",
    gap: 8,
  },
  nextSetSummaryCell: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  liveHintText: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: GarageTheme.textMuted,
    fontWeight: "600",
  },
  // フォーカスモードスタイル
  focusModeContainer: {
    flex: 1,
    backgroundColor: GarageTheme.background,
  },
  focusModeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: GarageTheme.borderStrong,
  },
  focusModeBackButton: {
    padding: 12,
  },
  focusModeBackButtonText: {
    fontSize: 28,
    color: GarageTheme.textStrong,
  },
  focusModeTitle: {
    fontSize: 24,
    fontWeight: "600",
    color: GarageTheme.textStrong,
    letterSpacing: 0,
  },
  focusModeSensorButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    backgroundColor: GarageTheme.surface,
  },
  focusModeSensorButtonText: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0,
  },
  focusModeCompleteButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: GarageTheme.success,
    borderRadius: 12,
  },
  focusModeCompleteButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: GarageTheme.textStrong,
    letterSpacing: 0,
  },
  focusModeSimulatorPanel: {
    marginTop: 12,
    marginLeft: 16,
    marginRight: 150,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    backgroundColor: GarageTheme.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sensorMutedBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GarageTheme.danger,
    backgroundColor: "rgba(255, 77, 79, 0.14)",
  },
  sensorMutedTitle: {
    color: GarageTheme.textStrong,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0,
    marginBottom: 3,
  },
  sensorMutedBody: {
    color: GarageTheme.text,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600",
  },
  focusModeSimulatorTitle: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0,
    color: GarageTheme.textStrong,
  },
  focusModeSimulatorMeta: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0,
    color: GarageTheme.textMuted,
  },
  focusModeSimulatorActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  focusModeSimulatorButton: {
    minWidth: 54,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GarageTheme.accent,
    backgroundColor: GarageTheme.chip,
  },
  focusModeSimulatorButtonDisabled: {
    opacity: 0.45,
  },
  focusModeSimulatorButtonText: {
    color: GarageTheme.accent,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0,
  },
  focusModeInfoGrid: {
    marginTop: 10,
    marginHorizontal: 16,
    flexDirection: "row",
    gap: 8,
  },
  focusModeInfoCell: {
    flex: 1,
    minHeight: 58,
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  focusModeInfoCellWide: {
    flex: 1.35,
    minHeight: 58,
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  focusModeInfoLabel: {
    color: GarageTheme.textMuted,
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 0,
    marginBottom: 4,
  },
  focusModeInfoValue: {
    color: GarageTheme.textStrong,
    fontSize: 15,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  focusModeInfoMeta: {
    color: GarageTheme.textSubtle,
    fontSize: 9,
    fontWeight: "600",
    marginTop: 2,
  },
  focusModeVelocityArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  focusModeVlPrimary: {
    flex: 1,
    minHeight: 0,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: GarageTheme.success,
    backgroundColor: GarageTheme.surface,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  focusModeVlPrimaryWatch: {
    borderColor: GarageTheme.warning,
  },
  focusModeVlPrimaryOff: {
    borderColor: GarageTheme.borderStrong,
  },
  focusModeVlPrimaryStop: {
    borderColor: GarageTheme.danger,
    backgroundColor: "rgba(255, 77, 79, 0.12)",
  },
  focusModeVlPrimaryLabel: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0,
  },
  focusModeVlExerciseName: {
    alignSelf: "stretch",
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    textAlign: "center",
  },
  focusModeVlRepHeroRow: {
    alignSelf: "stretch",
    minHeight: 156,
    flexDirection: "row",
    alignItems: "stretch",
    marginTop: 8,
  },
  focusModeVlRepHeroMetric: {
    flex: 1,
    minWidth: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  focusModeVlRepHeroDivider: {
    width: 1,
    marginVertical: 12,
    backgroundColor: GarageTheme.borderStrong,
  },
  focusModeVlRepHeroLabel: {
    color: GarageTheme.textMuted,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0,
  },
  focusModeVlPrimaryValue: {
    color: GarageTheme.success,
    fontSize: 60,
    fontWeight: "700",
    lineHeight: 68,
    fontVariant: ["tabular-nums"],
  },
  focusModeRepPrimaryValue: {
    color: GarageTheme.accent,
    fontSize: 68,
    fontWeight: "700",
    lineHeight: 72,
    fontVariant: ["tabular-nums"],
  },
  focusModeVlPrimaryValueWatch: {
    color: GarageTheme.warning,
  },
  focusModeVlPrimaryValueStop: {
    color: GarageTheme.danger,
  },
  focusModeVlWaitingValue: {
    color: GarageTheme.textStrong,
    fontSize: 48,
    fontWeight: "700",
    lineHeight: 60,
    fontVariant: ["tabular-nums"],
  },
  focusModeVlPrimaryCaption: {
    color: GarageTheme.textStrong,
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 0,
  },
  focusModeVlPrimaryStatus: {
    color: GarageTheme.textMuted,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
    letterSpacing: 0,
  },
  focusModeVlRepPrBand: {
    alignSelf: "stretch",
    minHeight: 92,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: GarageTheme.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  focusModeVlRepPrBandAchieved: {
    borderColor: GarageTheme.success,
    backgroundColor: "rgba(35, 196, 131, 0.08)",
  },
  focusModeVlRepPrBandExceeded: {
    borderColor: GarageTheme.danger,
    backgroundColor: "rgba(255, 77, 79, 0.08)",
  },
  focusModeVlRepPrLabel: {
    color: GarageTheme.textMuted,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0,
  },
  focusModeVlRepPrValue: {
    alignSelf: "stretch",
    color: GarageTheme.textStrong,
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 30,
    textAlign: "center",
    letterSpacing: 0,
  },
  focusModeVlRepPrValueAchieved: {
    color: GarageTheme.success,
  },
  focusModeVlRepPrValueExceeded: {
    color: GarageTheme.danger,
  },
  focusModeVlRepPrMeta: {
    color: GarageTheme.textMuted,
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 16,
    textAlign: "center",
    letterSpacing: 0,
  },
  focusModeVlSummaryGrid: {
    alignSelf: "stretch",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  focusModeVlSummaryItem: {
    width: "48%",
    minHeight: 42,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: GarageTheme.panel,
    justifyContent: "center",
  },
  focusModeVlSummaryItemWide: {
    width: "100%",
    minHeight: 42,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: GarageTheme.panel,
    justifyContent: "center",
  },
  focusModeVlSummaryLabel: {
    color: GarageTheme.textMuted,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0,
  },
  focusModeVlSummaryValue: {
    color: GarageTheme.textStrong,
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  focusModeVlCompactRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginTop: 8,
  },
  focusModeVlCompactText: {
    color: GarageTheme.textMuted,
    fontSize: 13,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  focusModeVelocityValue: {
    fontSize: 120,
    fontWeight: "600",
    color: GarageTheme.success,
    letterSpacing: 0,
    fontVariant: ["tabular-nums"],
  },
  focusModeVelocityUnit: {
    fontSize: 32,
    fontWeight: "500",
    color: GarageTheme.textMuted,
    letterSpacing: 0,
  },
  focusModeWaitingText: {
    fontSize: 24,
    fontWeight: "500",
    color: GarageTheme.textMuted,
    letterSpacing: 0,
  },
  focusModeMetricStrip: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 22,
    flexDirection: "row",
    gap: 8,
  },
  focusModeMetricStripWithVl: {
    position: "relative",
    left: undefined,
    right: undefined,
    bottom: undefined,
    marginHorizontal: 16,
    marginTop: 8,
  },
  focusModeMetricItem: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    backgroundColor: GarageTheme.panel,
  },
  focusModeMetricValue: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  focusModeRepCounter: {
    position: "absolute",
    top: 100,
    right: 30,
    alignItems: "center",
  },
  focusModeRepCounterWithVl: {
    position: "relative",
    top: undefined,
    right: undefined,
    alignSelf: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },
  focusModeRepCount: {
    fontSize: 72,
    fontWeight: "600",
    color: GarageTheme.accent,
    fontVariant: ["tabular-nums"],
  },
  focusModeRepCountWithVl: {
    fontSize: 40,
    lineHeight: 44,
  },
  focusModeRepLabel: {
    fontSize: 16,
    fontWeight: "500",
    color: GarageTheme.textMuted,
    letterSpacing: 0,
  },
  focusModeZoneIndicator: {
    position: "absolute",
    bottom: 180,
    alignSelf: "center",
  },
  focusModeZoneIndicatorWithVl: {
    position: "relative",
    bottom: undefined,
    marginTop: 6,
  },
  focusModeZoneBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: GarageTheme.surface,
    borderWidth: 3,
  },
  focusModeZoneEmoji: {
    fontSize: 28,
  },
  focusModeZoneName: {
    fontSize: 18,
    fontWeight: "600",
  },
  focusModeVlBox: {
    position: "absolute",
    bottom: 92,
    alignSelf: "center",
    minWidth: 220,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: GarageTheme.surfaceAlt,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    alignItems: "center",
    gap: 4,
  },
  focusModeVlBoxStop: {
    borderColor: GarageTheme.danger,
  },
  focusModeVlLabel: {
    fontSize: 26,
    fontWeight: "600",
    color: GarageTheme.textStrong,
  },
  focusModeVlText: {
    fontSize: 13,
    fontWeight: "600",
    color: GarageTheme.textMuted,
  },
  focusModeHrDisplay: {
    position: "absolute",
    bottom: 120,
    left: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  focusModeHrDisplayWithVl: {
    position: "relative",
    bottom: undefined,
    left: undefined,
    alignSelf: "center",
    marginTop: 6,
  },
  focusModeHrIcon: {
    fontSize: 24,
  },
  focusModeHrValue: {
    fontSize: 32,
    fontWeight: "600",
    color: GarageTheme.danger,
    fontVariant: ["tabular-nums"],
  },
  focusModeLoadDisplay: {
    position: "absolute",
    bottom: 120,
    right: 30,
    alignItems: "flex-end",
  },
  focusModeLoadDisplayWithVl: {
    position: "relative",
    bottom: undefined,
    right: undefined,
    alignSelf: "center",
    marginTop: 6,
  },
  focusModeLoadValue: {
    fontSize: 48,
    fontWeight: "600",
    color: GarageTheme.textStrong,
    fontVariant: ["tabular-nums"],
  },
  focusModeLoadUnit: {
    fontSize: 20,
    fontWeight: "500",
    color: GarageTheme.textMuted,
  },
});
