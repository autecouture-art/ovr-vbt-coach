import type { SetData } from "../types/index";
import { roundToHalfKg } from "../constants/exerciseCatalog";
import {
  getVelocityLossAvg,
  getVelocityLossForJudgement,
  getVelocityLossSafety,
} from "../utils/VBTCalculations";

export type NextSetPurpose =
  | "menu_completion"
  | "form_consistency"
  | "lvp_building"
  | "hypertrophy_volume";

export type DecisionStatus =
  | "good"
  | "watch"
  | "moderate_to_high"
  | "high";

export type PRStatus = "baseline" | "candidate_pr" | "confirmed_pr" | "excluded";

export interface SessionDecisionInput {
  sets: SetData[];
  currentLoad: number;
  currentHeartRate: number | null;
  purpose: NextSetPurpose;
  targetVelocityRange?: [number, number] | null;
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
  recommendedRestMin: number | null;
  waitUntilHRBelow: number | null;
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

const pctDrop = (current: number | null, baseline: number | null): number | null => {
  if (current == null || baseline == null || baseline <= 0) return null;
  return ((current - baseline) / baseline) * 100;
};

const formatNumber = (
  value: number | null | undefined,
  digits: number = 2,
  suffix: string = "",
) => (value == null || !Number.isFinite(value) ? "-" : `${value.toFixed(digits)}${suffix}`);

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
    const sets = input.sets.filter((set) => set.reps > 0);
    const maxLoad = sets.reduce(
      (max, set) => Math.max(max, set.load_kg || 0),
      0,
    );
    const workingSets = sets.filter((set) => isWorkingSet(set, maxLoad));
    const latestWorkingSet = workingSets[workingSets.length - 1] ?? null;
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
      const loadKey = roundToHalfKg(set.load_kg);
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
      if (drop != null && (sameLoadAVDropPct == null || drop < sameLoadAVDropPct)) {
        sameLoadAVDropPct = drop;
        sameLoadTrendText = `${formatNumber(loadSets[0]?.load_kg, 1, "kg")}: ${trendText(
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

    const validAllHrTo120 = sets
      .map((set) => set.hr_recovery_to_120_s)
      .filter((value): value is number => value != null && value > 0);
    const validWorkingHrTo120 = workingSets
      .map((set) => set.hr_recovery_to_120_s)
      .filter((value): value is number => value != null && value > 0);
    const avgHrTo120All = average(validAllHrTo120);
    const avgHrTo120Working = average(validWorkingHrTo120);
    const hrDataReliability =
      validWorkingHrTo120.length >= Math.max(2, Math.ceil(workingSets.length / 2))
        ? "good"
        : validAllHrTo120.length > 0
          ? "partial"
          : "missing";

    const sameLoadAVDrop = sameLoadAVDropPct != null && sameLoadAVDropPct <= -5;
    const romDrop = romDiff != null && romDiff <= -2;
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
    const possibleTechniqueFatigue = romDrop && (sameLoadAVDrop || hrHigh || hrRecoveryDelayed);

    let recommendedNextLoad: number | null = input.currentLoad || latestWorkingSet?.load_kg || null;
    let waitUntilHRBelow: number | null = null;
    let recommendedRestMin: number | null = null;
    const reasonBullets: string[] = [];

    if (sameLoadAVDrop) {
      reasonBullets.push(`同重量AVが最高値から${formatNumber(sameLoadAVDropPct, 1, "%")}低下`);
    }
    if (romDrop) {
      reasonBullets.push(
        `ROMが基準${formatNumber(baselineROM, 1, "cm")}から${formatNumber(romDiff, 1, "cm")}低下`,
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
    if (vlHigh) {
      reasonBullets.push("VL_last 15%以上のセットあり");
    }
    if (vlMinHigh) {
      reasonBullets.push("VL_min 25%以上: セット内に大きな失速repあり");
    }

    const qualityPriority =
      input.purpose === "form_consistency" || input.purpose === "lvp_building";
    if (romDrop || possibleTechniqueFatigue) {
      const dropRatio = hrHigh || qualityPriority ? 0.93 : 0.95;
      recommendedNextLoad = recommendedNextLoad
        ? roundToHalfKg(recommendedNextLoad * dropRatio)
        : null;
      waitUntilHRBelow = qualityPriority ? 135 : 140;
      recommendedRestMin = hrHigh || hrRecoveryDelayed ? 4 : 3;
    } else if (sameLoadAVDrop || vlHigh) {
      recommendedNextLoad = recommendedNextLoad
        ? roundToHalfKg(recommendedNextLoad * 0.95)
        : null;
      waitUntilHRBelow = 135;
      recommendedRestMin = 3;
    } else {
      waitUntilHRBelow = input.purpose === "hypertrophy_volume" ? 140 : 135;
      recommendedRestMin = 2;
    }

    const fatigueStatus: DecisionStatus =
      hrHigh || hrRecoveryDelayed || (sameLoadAVDrop && vlHigh) || vlMinHigh
        ? "moderate_to_high"
        : sameLoadAVDrop || vlHigh
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
          : sameLoadAVDrop || vlHigh
            ? "candidate_pr"
            : "confirmed_pr";
    const confidence =
      workingSets.length >= 3 && hrDataReliability !== "missing"
        ? "high"
        : workingSets.length >= 2
          ? "medium"
          : "low";

    const passCriteria = [
      baselineROM != null ? `ROM ${formatNumber(Math.max(0, baselineROM - 0.5), 1, "cm")}以上` : "ROMを前セット以上",
      "VL_last 10%以内",
      input.targetVelocityRange
        ? `AV ${formatNumber(input.targetVelocityRange[0])}〜${formatNumber(input.targetVelocityRange[1])} m/s`
        : "AVを急落させない",
    ];
    const stopCriteria = [
      baselineROM != null ? `ROM ${formatNumber(baselineROM - 1.5, 1, "cm")}以下なら終了/種目変更` : "ROMが明確に浅くなったら終了/種目変更",
      "HR 145以上なら休憩延長",
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
      recommendedRestMin,
      waitUntilHRBelow,
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
      romTrendText: trendText(workingSets.map((set) => set.avg_rom_cm), 1, "cm"),
      hrTo120TrendText: trendText(
        workingSets.map((set) => set.hr_recovery_to_120_s),
        0,
        "s",
      ),
      e1rmTrendText: trendText(workingSets.map((set) => set.e1rm), 1, "kg"),
    };
  }
}

export default SessionDecisionService;
