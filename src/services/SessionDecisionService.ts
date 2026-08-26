import type { SetData } from "../types/index";
import { normalizeLoadKg } from "../utils/LoadPrecision";
import {
  getVelocityLossAvg,
  getVelocityLossForJudgement,
  getVelocityLossSafety,
} from "../utils/VBTCalculations";
import {
  applyHeavyExposureSupervisorBlock,
  type HeavyExposureSingle,
  type MainLiftCode,
  type StickyPainState,
} from "../utils/SupervisorPlanGuards";

export type NextSetPurpose =
  | "menu_completion"
  | "form_consistency"
  | "lvp_building"
  | "hypertrophy_volume";

export type DecisionStatus = "good" | "watch" | "moderate_to_high" | "high";

export type PRStatus =
  | "baseline"
  | "candidate_pr"
  | "confirmed_pr"
  | "excluded";

export type SessionTerminationLevel =
  | "main_done_light_accessory_ok"
  | "planned_accessory_only"
  | "session_complete";

export type ExerciseTerminationLevel =
  | "continue_current_exercise"
  | "current_exercise_complete"
  | "main_lift_complete"
  | "session_complete";

export interface SessionDecisionInput {
  sets: SetData[];
  currentLoad: number;
  currentHeartRate: number | null;
  purpose: NextSetPurpose;
  targetVelocityRange?: [number, number] | null;
  configuredVelocityLossThresholdPct?: number | null;
  individualProfileMode?: "standard" | "collect" | "confirm" | null;
  mainLift?: "SQ" | "BP" | "DL" | null;
  plannedNextSet?: {
    loadKg: number;
    reps: number;
    remainingSets?: number | null;
    rpe?: number | null;
    rowId?: string | null;
    source?:
      | "applied_supervisor_row"
      | "fallback_planned_row"
      | "fallback_planned_session"
      | "fallback_fixed_ladder";
  } | null;
  supervisorPlanGuard?: {
    painState?: StickyPainState | null;
    blockedHeavyExposureLoadsKg?: Partial<Record<MainLiftCode, number[]>>;
    planVersion?: string | null;
    planExecutable?: boolean | null;
    staleReason?: string | null;
  } | null;
  plannedSessionContext?: {
    plannedRowsTotal?: number | null;
    plannedRowsCompleted?: number | null;
    plannedRowsRemaining?: number | null;
    currentRowRemainingSets?: number | null;
    totalSessionSets?: number | null;
    accessorySetsAfterMain?: number | null;
    remainingMinutes?: number | null;
    latestPainScore?: number | null;
    latestRpe?: number | null;
    latestVlLast?: number | null;
  } | null;
}

export interface NextSetQualityGoal {
  targetVlLastPct: number | null;
  hardCapVlLastPct: number | null;
  minimumRomCm: number | null;
  previousVlLastPct: number | null;
  summary: string;
}

export interface SetTrendRow {
  set: number;
  load: number;
  reps: number;
  av: number | null;
  avChangePct: number | null;
  vl: number | null;
  vlAvg: number | null;
  vlLast: number | null;
  vlMin: number | null;
  vlJudgementMetric: "vlLast";
  rom: number | null;
  romDiff: number | null;
  e1rm: number | null;
  avgHR: number | null;
  peakHR: number | null;
  hrTo120: number | null;
  rest: number | null;
}

export interface SessionDecision {
  allSetAvgAV: number | null;
  workingSetAvgAV: number | null;
  recent3WorkingSetAvgAV: number | null;
  bestWorkingAV: number | null;
  sameLoadAVDropPct: number | null;
  baselineROM: number | null;
  latestROM: number | null;
  romDiff: number | null;
  avgHrTo120All: number | null;
  avgHrTo120Working: number | null;
  hrDataReliability: "good" | "partial" | "missing";
  fatigueStatus: DecisionStatus;
  formStatus: "good" | "rom_drop_detected" | "watch" | "unknown";
  hrRecoveryStatus: DecisionStatus | "unknown";
  prStatus: PRStatus;
  confidence: "high" | "medium" | "low";
  recommendedNextLoad: number | null;
  recommendedNextReps: number | null;
  recommendedRestMin: number | null;
  waitUntilHRBelow: number | null;
  candidateSource:
    | "applied_supervisor_row"
    | "stale_supervisor_plan_blocked"
    | "fallback_planned_row"
    | "fallback_planned_session"
    | "fallback_fixed_ladder"
    | "fallback_algorithmic_candidate"
    | "planned_rows_complete_no_candidate"
    | "planned_rows_remaining_no_current_candidate";
  plannedRowId: string | null;
  sessionTerminationLevel: SessionTerminationLevel;
  sessionTerminationLabel: string;
  exerciseTerminationLevel: ExerciseTerminationLevel;
  exerciseTerminationLabel: string;
  allowLightFullBodyAccessory: boolean;
  shouldSuggestAdditionalLoad: boolean;
  roundingIncrementKg: number;
  romMeasurementSuspect: boolean;
  romChangePct: number | null;
  romExcludedDecisionText: string | null;
  heavyExposureSingle: HeavyExposureSingle | null;
  nextSetQualityGoal: NextSetQualityGoal | null;
  reasonBullets: string[];
  passCriteria: string[];
  stopCriteria: string[];
  trendFlags: {
    sameLoadAVDrop: boolean;
    romDrop: boolean;
    hrHigh: boolean;
    hrRecoveryDelayed: boolean;
    vlHigh: boolean;
    vlMinHigh: boolean;
    speedWorkVl10Stop: boolean;
    e1RMDrop: boolean;
    possibleTechniqueFatigue: boolean;
  };
  workingSets: SetTrendRow[];
  sameLoadTrendText: string;
  romTrendText: string;
  hrTo120TrendText: string;
  e1rmTrendText: string;
}

const average = (values: (number | null | undefined)[]): number | null => {
  const valid = values.filter(
    (value): value is number => value != null && Number.isFinite(value),
  );
  if (valid.length === 0) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
};

const pctDrop = (
  current: number | null,
  baseline: number | null,
): number | null => {
  if (current == null || baseline == null || baseline <= 0) return null;
  return ((current - baseline) / baseline) * 100;
};

const formatNumber = (
  value: number | null | undefined,
  digits: number = 2,
  suffix: string = "",
) =>
  value == null || !Number.isFinite(value)
    ? "-"
    : `${value.toFixed(digits)}${suffix}`;

const secondsToClock = (seconds: number | null | undefined) => {
  if (seconds == null || !Number.isFinite(seconds)) return "-";
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  return `${minutes}:${(safeSeconds % 60).toString().padStart(2, "0")}`;
};

const isWorkingSet = (set: SetData, maxLoad: number) => {
  if (set.is_warmup) return false;
  if (set.reps <= 0 || set.load_kg <= 0) return false;
  if (set.set_type === "top_single" || set.set_type === "backoff") return true;
  return maxLoad > 0 ? set.load_kg >= maxLoad * 0.8 : true;
};

const isSpeedWorkSet = (set: SetData) => {
  const lift = set.lift.toLowerCase();
  if (lift.includes("bench")) {
    return set.reps <= 3 && set.load_kg >= 60 && set.load_kg <= 65;
  }
  if (lift.includes("squat")) {
    return set.reps <= 2 && set.load_kg >= 90 && set.load_kg <= 100;
  }
  if (lift.includes("deadlift")) {
    return set.reps <= 2 && set.load_kg >= 110 && set.load_kg <= 120;
  }
  return false;
};

const roundToIncrement = (value: number, increment: number) => {
  if (!Number.isFinite(value) || increment <= 0) return value;
  return Math.round(value / increment) * increment;
};

const getRoundingIncrementKg = (mainLift?: "SQ" | "BP" | "DL" | null) =>
  mainLift === "SQ" || mainLift === "BP" || mainLift === "DL" ? 2.5 : 0.5;

const getHeavyExposureSingle = (mainLift?: "SQ" | "BP" | "DL" | null) => {
  if (!mainLift) return null;
  const loadByLift: Record<"SQ" | "BP" | "DL", number> = {
    SQ: 130,
    BP: 95,
    DL: 150,
  };
  return {
    lift: mainLift,
    loadKg: loadByLift[mainLift],
    purpose: "MAX挑戦ではなく重さ慣れと試技セットアップ",
    rpeTarget: "RPE8前後",
    rule: "失敗なし。追加単発なし。Green/Yellow/Redで反復メインを維持/2.5-5kg減/終了へ分岐",
  } satisfies HeavyExposureSingle;
};

const sessionTerminationLabel: Record<SessionTerminationLevel, string> = {
  main_done_light_accessory_ok: "主役終了・軽補助可",
  planned_accessory_only: "予定補助まで可",
  session_complete: "セッション完全終了",
};

const exerciseTerminationLabel: Record<ExerciseTerminationLevel, string> = {
  continue_current_exercise: "現在種目継続",
  current_exercise_complete: "現在種目終了",
  main_lift_complete: "主役終了",
  session_complete: "セッション終了",
};

const trendText = (
  values: (number | null | undefined)[],
  digits: number = 2,
  suffix: string = "",
) =>
  values
    .map((value) => formatNumber(value, digits, suffix))
    .filter((value) => value !== "-")
    .join(" → ") || "-";

export class SessionDecisionService {
  static analyze(input: SessionDecisionInput): SessionDecision {
    const individualProfileCollecting = input.individualProfileMode === "collect";
    const sets = input.sets.filter((set) => set.reps > 0);
    const maxLoad = sets.reduce(
      (max, set) => Math.max(max, set.load_kg || 0),
      0,
    );
    const workingSets = sets.filter((set) => isWorkingSet(set, maxLoad));
    const latestWorkingSet = workingSets[workingSets.length - 1] ?? null;
    const latestCompletedSet = sets[sets.length - 1] ?? null;
    const allSetAvgAV = average(sets.map((set) => set.avg_velocity));
    const workingSetAvgAV = average(workingSets.map((set) => set.avg_velocity));
    const recent3WorkingSetAvgAV = average(
      workingSets.slice(-3).map((set) => set.avg_velocity),
    );
    const bestWorkingAV =
      workingSets
        .map((set) => set.avg_velocity)
        .filter((value): value is number => value != null && value > 0)
        .sort((a, b) => b - a)[0] ?? null;

    const groupedByLoad = new Map<number, SetData[]>();
    for (const set of workingSets) {
      const loadKey = normalizeLoadKg(set.load_kg);
      groupedByLoad.set(loadKey, [...(groupedByLoad.get(loadKey) ?? []), set]);
    }
    let sameLoadAVDropPct: number | null = null;
    let sameLoadTrendText = "-";
    for (const loadSets of groupedByLoad.values()) {
      if (loadSets.length < 2) continue;
      const best = Math.max(
        ...loadSets
          .map((set) => set.avg_velocity)
          .filter((value): value is number => value != null && value > 0),
      );
      const latest = loadSets[loadSets.length - 1]?.avg_velocity ?? null;
      const drop = pctDrop(latest, best);
      if (
        drop != null &&
        (sameLoadAVDropPct == null || drop < sameLoadAVDropPct)
      ) {
        sameLoadAVDropPct = drop;
        sameLoadTrendText = `${formatNumber(loadSets[0]?.load_kg, 2, "kg")}: ${trendText(
          loadSets.map((set) => set.avg_velocity),
        )}`;
      }
    }

    const baselineROM =
      workingSets
        .map((set) => set.avg_rom_cm)
        .filter((value): value is number => value != null && value > 0)
        .sort((a, b) => b - a)[0] ?? null;
    const latestROM = latestWorkingSet?.avg_rom_cm ?? null;
    const romDiff =
      latestROM != null && baselineROM != null ? latestROM - baselineROM : null;
    const romChangePct =
      latestROM != null && baselineROM != null && baselineROM > 0
        ? ((latestROM - baselineROM) / baselineROM) * 100
        : null;

    const validAllHrTo120 = sets
      .map((set) => set.hr_recovery_to_120_s)
      .filter((value): value is number => value != null && value > 0);
    const validWorkingHrTo120 = workingSets
      .map((set) => set.hr_recovery_to_120_s)
      .filter((value): value is number => value != null && value > 0);
    const avgHrTo120All = average(validAllHrTo120);
    const avgHrTo120Working = average(validWorkingHrTo120);
    const hrDataReliability =
      validWorkingHrTo120.length >=
      Math.max(2, Math.ceil(workingSets.length / 2))
        ? "good"
        : validAllHrTo120.length > 0
          ? "partial"
          : "missing";

    const sameLoadAVDrop = sameLoadAVDropPct != null && sameLoadAVDropPct <= -5;
    const romDrop = romDiff != null && romDiff <= -2;
    const romMeasurementSuspect =
      romChangePct != null && Math.abs(romChangePct) >= 15;
    const hrHigh = (input.currentHeartRate ?? 0) >= 145;
    const hrRecoveryDelayed =
      avgHrTo120Working != null && avgHrTo120Working >= 180;
    const vlHigh = workingSets.some((set) => {
      const vlLast = getVelocityLossForJudgement(set);
      return vlLast != null && vlLast >= 15;
    });
    const vlMinHigh = workingSets.some((set) => {
      const vlMin = getVelocityLossSafety(set);
      return vlMin != null && vlMin >= 25;
    });
    const speedWorkVl10Stop = workingSets.some((set) => {
      const vlLast = getVelocityLossForJudgement(set);
      return isSpeedWorkSet(set) && vlLast != null && vlLast > 10;
    });
    const vlHighForDecision = individualProfileCollecting ? false : vlHigh;
    const vlMinHighForDecision = individualProfileCollecting ? false : vlMinHigh;
    const speedWorkVl10StopForDecision = individualProfileCollecting
      ? false
      : speedWorkVl10Stop;
    const bestE1RM =
      workingSets
        .map((set) => set.e1rm)
        .filter((value): value is number => value != null && value > 0)
        .sort((a, b) => b - a)[0] ?? null;
    const latestE1RM = latestWorkingSet?.e1rm ?? null;
    const e1RMDrop =
      latestE1RM != null &&
      bestE1RM != null &&
      bestE1RM > 0 &&
      ((latestE1RM - bestE1RM) / bestE1RM) * 100 <= -3;
    const companionPerformanceIssue =
      sameLoadAVDrop || vlHighForDecision || vlMinHighForDecision ||
      (!individualProfileCollecting && e1RMDrop);
    const romCanDriveLoadDrop =
      romDrop && !romMeasurementSuspect && companionPerformanceIssue;
    const possibleTechniqueFatigue = romCanDriveLoadDrop;

    const roundingIncrementKg = getRoundingIncrementKg(input.mainLift);
    const supervisorPlanExecutionBlocked =
      input.supervisorPlanGuard?.planExecutable === false;
    const plannedCandidate =
      !supervisorPlanExecutionBlocked &&
      input.plannedNextSet &&
      input.plannedNextSet.loadKg > 0
        ? {
            ...input.plannedNextSet,
            loadKg: roundToIncrement(
              input.plannedNextSet.loadKg,
              roundingIncrementKg,
            ),
          }
        : null;
    let recommendedNextLoad: number | null =
      plannedCandidate?.loadKg ??
      input.currentLoad ??
      latestWorkingSet?.load_kg ??
      null;
    let recommendedNextReps: number | null =
      plannedCandidate?.reps ?? latestWorkingSet?.reps ?? null;
    let candidateSource: SessionDecision["candidateSource"] = plannedCandidate
      ? (plannedCandidate.source ?? "fallback_planned_row")
      : "fallback_algorithmic_candidate";
    const plannedRowId = plannedCandidate?.rowId ?? null;
    let waitUntilHRBelow: number | null = null;
    let recommendedRestMin: number | null = null;
    const reasonBullets: string[] = [];
    const stalePlanReason =
      input.supervisorPlanGuard?.staleReason ?? "監督メニューが実行可能状態ではありません";

    if (sameLoadAVDrop) {
      reasonBullets.push(
        `同重量AVが最高値から${formatNumber(sameLoadAVDropPct, 1, "%")}低下`,
      );
    }
    if (romDrop) {
      reasonBullets.push(
        `ROMが基準${formatNumber(baselineROM, 1, "cm")}から${formatNumber(romDiff, 1, "cm")}低下`,
      );
    }
    if (romMeasurementSuspect) {
      reasonBullets.push(
        `ROM急変${formatNumber(romChangePct, 1, "%")}: 測定位置変更疑い。ROM単独では減量しない`,
      );
    }
    if (hrHigh) {
      reasonBullets.push(`現在HRが${input.currentHeartRate}bpmで高め`);
    }
    if (hrRecoveryDelayed) {
      reasonBullets.push(
        `作業セットHR→120平均が${secondsToClock(avgHrTo120Working)}で遅め`,
      );
    }
    if (vlHigh && !individualProfileCollecting) {
      reasonBullets.push("VL_last 15%以上のセットあり");
    }
    if (vlMinHigh && !individualProfileCollecting) {
      reasonBullets.push("VL_min 25%以上: セット内に大きな失速repあり");
    }
    if (speedWorkVl10Stop && !individualProfileCollecting) {
      reasonBullets.push(
        "スピード練習でVL_last 10%超: 目的達成、停止または減量推奨",
      );
    }
    if (individualProfileCollecting) {
      reasonBullets.push(
        "個人プロファイル収集中: VLは停止条件ではなく、最終AV・rep間失速・ROM・RPEを採る観測値",
      );
    }

    const qualityPriority =
      input.purpose === "form_consistency" || input.purpose === "lvp_building";
    const plannedRowsTotal =
      input.plannedSessionContext?.plannedRowsTotal ?? null;
    const plannedRowsCompleted =
      input.plannedSessionContext?.plannedRowsCompleted ?? null;
    const plannedRowsRemaining =
      input.plannedSessionContext?.plannedRowsRemaining ?? null;
    const currentRowRemainingSets =
      input.plannedSessionContext?.currentRowRemainingSets ?? null;
    const accessorySetsAfterMain =
      input.plannedSessionContext?.accessorySetsAfterMain ?? 0;
    const latestPainScore =
      input.plannedSessionContext?.latestPainScore ?? null;
    const latestRpe = input.plannedSessionContext?.latestRpe ?? null;
    const latestVlLast =
      input.plannedSessionContext?.latestVlLast ??
      (latestWorkingSet != null
        ? getVelocityLossForJudgement(latestWorkingSet)
        : null);
    const hardCapVlLastPct =
      input.configuredVelocityLossThresholdPct != null &&
      Number.isFinite(input.configuredVelocityLossThresholdPct) &&
      input.configuredVelocityLossThresholdPct > 0
        ? input.configuredVelocityLossThresholdPct
        : 15;
    const minimumRomCm =
      baselineROM != null ? Math.max(0, baselineROM - 0.5) : null;
    const plannedRowsAreKnown = plannedRowsTotal != null && plannedRowsTotal > 0;
    const allPlannedRowsCompleted =
      plannedRowsAreKnown && (plannedRowsRemaining ?? 0) <= 0;
    const currentPlannedRowCompleted =
      currentRowRemainingSets != null && currentRowRemainingSets <= 0;
    const lightAccessoryAllowed =
      !sameLoadAVDrop &&
      !romCanDriveLoadDrop &&
      !hrHigh &&
      !hrRecoveryDelayed &&
      !vlHighForDecision &&
      !vlMinHighForDecision &&
      (latestPainScore == null || latestPainScore === 0) &&
      (latestRpe == null || latestRpe <= 7) &&
      (latestVlLast == null || latestVlLast <= 15) &&
      (input.plannedSessionContext?.remainingMinutes == null ||
        input.plannedSessionContext.remainingMinutes >= 15);
    let sessionTerminationLevelValue: SessionTerminationLevel =
      "planned_accessory_only";
    let exerciseTerminationLevelValue: ExerciseTerminationLevel =
      "continue_current_exercise";

    if (
      (latestPainScore != null && latestPainScore > 0) ||
      (latestRpe != null && latestRpe > 8.5) ||
      vlMinHighForDecision ||
      speedWorkVl10StopForDecision ||
      (plannedRowsAreKnown && allPlannedRowsCompleted && !lightAccessoryAllowed)
    ) {
      sessionTerminationLevelValue = "session_complete";
      exerciseTerminationLevelValue = "session_complete";
    } else if (plannedRowsAreKnown && allPlannedRowsCompleted) {
      sessionTerminationLevelValue = "main_done_light_accessory_ok";
      exerciseTerminationLevelValue = "main_lift_complete";
    } else if (currentPlannedRowCompleted || accessorySetsAfterMain > 0) {
      sessionTerminationLevelValue = "planned_accessory_only";
      exerciseTerminationLevelValue = currentPlannedRowCompleted
        ? "current_exercise_complete"
        : "continue_current_exercise";
    }

    if (supervisorPlanExecutionBlocked) {
      candidateSource = "stale_supervisor_plan_blocked";
      recommendedNextLoad =
        input.currentLoad > 0
          ? roundToIncrement(input.currentLoad, roundingIncrementKg)
          : latestWorkingSet?.load_kg != null
            ? roundToIncrement(latestWorkingSet.load_kg, roundingIncrementKg)
            : null;
      recommendedNextReps = latestWorkingSet?.reps ?? plannedCandidate?.reps ?? null;
      waitUntilHRBelow = hrHigh || hrRecoveryDelayed ? 135 : null;
      recommendedRestMin = hrHigh || hrRecoveryDelayed ? 5 : null;
      reasonBullets.push(
        `監督メニューstale: ${stalePlanReason}。自動増量とheavy exposureは停止`,
      );
    } else if (allPlannedRowsCompleted) {
      candidateSource = "planned_rows_complete_no_candidate";
      recommendedNextLoad = null;
      recommendedNextReps = null;
      waitUntilHRBelow = hrHigh || hrRecoveryDelayed ? 135 : null;
      recommendedRestMin = hrHigh || hrRecoveryDelayed ? 5 : null;
      reasonBullets.push(
        `監督メニューの当日予定行は完了 (${plannedRowsCompleted ?? plannedRowsTotal}/${plannedRowsTotal})。追加重量候補は出さない`,
      );
    } else if (plannedRowsAreKnown && currentPlannedRowCompleted && !plannedCandidate) {
      candidateSource = "planned_rows_remaining_no_current_candidate";
      recommendedNextLoad = null;
      recommendedNextReps = null;
      waitUntilHRBelow = hrHigh || hrRecoveryDelayed ? 135 : null;
      recommendedRestMin = hrHigh || hrRecoveryDelayed ? 5 : null;
      reasonBullets.push(
        "現在の予定行は完了。残りは監督メニュー内の予定補助だけ",
      );
    } else if (plannedCandidate) {
      reasonBullets.push(
        `予定行優先: ${formatNumber(plannedCandidate.loadKg, 2, "kg")} x ${plannedCandidate.reps}`,
      );
      waitUntilHRBelow = hrHigh ? 135 : qualityPriority ? 135 : 140;
      recommendedRestMin = hrHigh || hrRecoveryDelayed ? 5 : 2;
    } else if (romCanDriveLoadDrop || possibleTechniqueFatigue) {
      const dropRatio = hrHigh || qualityPriority ? 0.93 : 0.95;
      recommendedNextLoad = recommendedNextLoad
        ? roundToIncrement(recommendedNextLoad * dropRatio, roundingIncrementKg)
        : null;
      waitUntilHRBelow = qualityPriority ? 135 : 140;
      recommendedRestMin = hrHigh || hrRecoveryDelayed ? 4 : 3;
    } else if (sameLoadAVDrop || vlHighForDecision) {
      recommendedNextLoad = recommendedNextLoad
        ? roundToIncrement(recommendedNextLoad * 0.95, roundingIncrementKg)
        : null;
      waitUntilHRBelow = 135;
      recommendedRestMin = 3;
    } else if (hrHigh || hrRecoveryDelayed) {
      waitUntilHRBelow = 135;
      recommendedRestMin = 5;
    } else {
      waitUntilHRBelow = input.purpose === "hypertrophy_volume" ? 140 : 135;
      recommendedRestMin = 2;
    }

    const shouldSuggestAdditionalLoad =
      sessionTerminationLevelValue !== "session_complete" &&
      !allPlannedRowsCompleted &&
      recommendedNextLoad != null;

    const fatigueStatus: DecisionStatus =
      hrHigh || hrRecoveryDelayed || (sameLoadAVDrop && vlHighForDecision) || vlMinHighForDecision
        ? "moderate_to_high"
        : sameLoadAVDrop || vlHighForDecision
          ? "watch"
          : "good";
    const formStatus = romDrop
      ? "rom_drop_detected"
      : baselineROM == null
        ? "unknown"
        : "good";
    const hrRecoveryStatus =
      hrDataReliability === "missing"
        ? "unknown"
        : hrHigh || hrRecoveryDelayed
          ? "moderate_to_high"
          : "good";
    const prStatus: PRStatus =
      workingSets.length < 2
        ? "baseline"
        : romDrop || latestWorkingSet?.is_warmup
          ? "excluded"
          : sameLoadAVDrop || vlHighForDecision
            ? "candidate_pr"
            : "confirmed_pr";
    const confidence =
      workingSets.length >= 3 && hrDataReliability !== "missing"
        ? "high"
        : workingSets.length >= 2
          ? "medium"
          : "low";

    const passCriteria = individualProfileCollecting
      ? [
          baselineROM != null
            ? `ROM ${formatNumber(Math.max(0, baselineROM - 0.5), 1, "cm")}以上`
            : "ROMを前セット以上",
          "VL_last・最終AV・rep間失速を記録",
          "AMRAPはRPE 9〜9.5以内、失敗なし",
        ]
      : [
          baselineROM != null
            ? `ROM ${formatNumber(Math.max(0, baselineROM - 0.5), 1, "cm")}以上`
            : "ROMを前セット以上",
          "VL_last 10%以内",
          latestWorkingSet?.set_type === "top_single" && input.targetVelocityRange
            ? `AV ${formatNumber(input.targetVelocityRange[0])}〜${formatNumber(input.targetVelocityRange[1])} m/s`
            : "AVを急落させない",
        ];
    const stopCriteria = individualProfileCollecting
      ? [
          "痛み、失敗、予定RPE上限で終了",
          "1 REPで急失速かつROM低下なら測定/フォームを確認",
          "単独のVL高値は停止根拠にせず記録する",
        ]
      : [
          baselineROM != null
            ? `ROM ${formatNumber(baselineROM - 1.5, 1, "cm")}以下なら終了/種目変更`
            : "ROMが明確に浅くなったら終了/種目変更",
          "HR 145以上なら休憩延長",
          "スピード練習でVL_last 10%超なら、そのスピード種目は停止または減量",
          "VL_last 20%超、またはVL_min 30%超なら重量を下げる/種目終了候補",
          "同重量AVがさらに5%以上落ちたら重量を下げる",
        ];

    return {
      allSetAvgAV,
      workingSetAvgAV,
      recent3WorkingSetAvgAV,
      bestWorkingAV,
      sameLoadAVDropPct,
      baselineROM,
      latestROM,
      romDiff,
      avgHrTo120All,
      avgHrTo120Working,
      hrDataReliability,
      fatigueStatus,
      formStatus,
      hrRecoveryStatus,
      prStatus,
      confidence,
      recommendedNextLoad,
      recommendedNextReps,
      recommendedRestMin,
      waitUntilHRBelow,
      candidateSource,
      plannedRowId,
      sessionTerminationLevel: sessionTerminationLevelValue,
      sessionTerminationLabel:
        sessionTerminationLabel[sessionTerminationLevelValue],
      exerciseTerminationLevel: exerciseTerminationLevelValue,
      exerciseTerminationLabel:
        exerciseTerminationLabel[exerciseTerminationLevelValue],
      allowLightFullBodyAccessory:
        sessionTerminationLevelValue === "main_done_light_accessory_ok",
      shouldSuggestAdditionalLoad,
      roundingIncrementKg,
      romMeasurementSuspect,
      romChangePct,
      romExcludedDecisionText: romMeasurementSuspect
        ? "ROM急変15%以上のため測定位置変更疑い。AV/VL/RPE/痛み等の追加悪化なしではROMを減量根拠から除外"
        : null,
      heavyExposureSingle: (() => {
        const guarded = applyHeavyExposureSupervisorBlock({
          heavyExposureSingle: getHeavyExposureSingle(input.mainLift),
          painState: input.supervisorPlanGuard?.painState ?? null,
          blockedLoadsKg:
            input.supervisorPlanGuard?.blockedHeavyExposureLoadsKg ?? undefined,
          planVersion: input.supervisorPlanGuard?.planVersion ?? null,
        });
        if (!supervisorPlanExecutionBlocked || !guarded) return guarded;
        return {
          ...guarded,
          status: "blocked_by_supervisor_plan" as const,
          blocked_by_supervisor_plan: true,
          block_reason: `監督メニューstale: ${stalePlanReason}。heavy exposureは提案しない`,
        };
      })(),
      nextSetQualityGoal:
        latestCompletedSet == null
          ? null
          : {
              targetVlLastPct: individualProfileCollecting ? null : 10,
              hardCapVlLastPct: individualProfileCollecting ? null : hardCapVlLastPct,
              minimumRomCm,
              previousVlLastPct: getVelocityLossForJudgement(latestCompletedSet),
              summary: [
                `推奨 ${formatNumber(recommendedNextLoad, 2, "kg")} x ${recommendedNextReps ?? latestCompletedSet.reps}`,
                individualProfileCollecting
                  ? "VL_last・最終AV・rep間失速を記録（一般VLカットなし）"
                  : getVelocityLossForJudgement(latestCompletedSet) != null
                    ? `VL_last 前回${formatNumber(getVelocityLossForJudgement(latestCompletedSet), 1, "%")} → 次回10%前後（上限${formatNumber(hardCapVlLastPct, 0, "%")}）`
                    : `VL_last 次回10%前後（上限${formatNumber(hardCapVlLastPct, 0, "%")}）`,
                minimumRomCm != null
                  ? `ROM ${formatNumber(minimumRomCm, 1, "cm")}以上`
                  : "ROMは前セットを下回らない",
              ].join(" / "),
            },
      reasonBullets:
        reasonBullets.length > 0
          ? reasonBullets
          : ["作業セットの速度・ROM・HRに大きな崩れは未検出"],
      passCriteria,
      stopCriteria,
      trendFlags: {
        sameLoadAVDrop,
        romDrop,
        hrHigh,
        hrRecoveryDelayed,
        vlHigh,
        vlMinHigh,
        speedWorkVl10Stop,
        e1RMDrop,
        possibleTechniqueFatigue,
      },
      workingSets: workingSets.map((set) => {
        const avChangePct = pctDrop(set.avg_velocity ?? null, bestWorkingAV);
        return {
          set: set.set_index,
          load: set.load_kg,
          reps: set.reps,
          av: set.avg_velocity ?? null,
          avChangePct,
          vl: getVelocityLossAvg(set),
          vlAvg: getVelocityLossAvg(set),
          vlLast: getVelocityLossForJudgement(set),
          vlMin: getVelocityLossSafety(set),
          vlJudgementMetric: "vlLast",
          rom: set.avg_rom_cm ?? null,
          romDiff:
            set.avg_rom_cm != null && baselineROM != null
              ? set.avg_rom_cm - baselineROM
              : null,
          e1rm: set.e1rm ?? null,
          avgHR: set.avg_hr ?? null,
          peakHR: set.peak_hr ?? null,
          hrTo120:
            set.hr_recovery_to_120_s != null && set.hr_recovery_to_120_s > 0
              ? set.hr_recovery_to_120_s
              : null,
          rest: set.rest_duration_s ?? null,
        };
      }),
      sameLoadTrendText,
      romTrendText: trendText(
        workingSets.map((set) => set.avg_rom_cm),
        1,
        "cm",
      ),
      hrTo120TrendText: trendText(
        workingSets.map((set) => set.hr_recovery_to_120_s),
        0,
        "s",
      ),
      e1rmTrendText: trendText(
        workingSets.map((set) => set.e1rm),
        1,
        "kg",
      ),
    };
  }
}

export default SessionDecisionService;
