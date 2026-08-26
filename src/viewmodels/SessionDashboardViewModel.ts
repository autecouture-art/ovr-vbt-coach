/**
 * SessionDashboardViewModel
 * Pure functions for formatting session data for the dashboard UI
 */

import type { SetData } from "@/src/types/index";
import type { SessionDecision } from "@/src/services/SessionDecisionService";
import { GarageTheme } from "../constants/garageTheme";

// ========================================
// Types
// ========================================

export interface LiveData {
  currentLoad: number;
  currentReps: number;
  plannedSetCount: number | null;
  plannedRpe: number | null;
  latestSet: {
    avgVelocity: number | null;
    velocityLossLast: number | null;
    rom: number | null;
  };
  currentHeartRate: number | null;
  restDurationSeconds: number;
  isConnected: boolean;
  isVideoRecording: boolean;
}

export interface DecisionData {
  recommendedLoad: number | null;
  recommendedReps: number | null;
  candidateSource: string | null;
  plannedRowId: string | null;
  recommendedRestMin: number | null;
  waitUntilHRBelow: number | null;
  reasonBullets: string[];
  passCriteria: string[];
  stopCriteria: string[];
  fatigueStatus: string;
  formStatus: string;
  hrRecoveryStatus: string;
}

export interface SetListItem {
  sessionId: string;
  lift: string;
  setIndex: number;
  load: number;
  reps: number;
  avgVelocity: number | null;
  velocityLoss: number | null;
  rom: number | null;
  isWarmup: boolean;
}

export interface DashboardData {
  live: LiveData;
  decision: DecisionData;
  sets: SetListItem[];
}

// ========================================
// Pure Functions
// ========================================

/**
 * Format live data for the LIVE tab
 */
export function formatLiveData(input: {
  currentLoad: number;
  currentReps: number;
  plannedSetCount: number | null;
  plannedRpe: number | null;
  setHistory: SetData[];
  currentHeartRate: number | null;
  restStartTime: number | null;
  isConnected: boolean;
  isVideoRecording: boolean;
}): LiveData {
  const latestSet = input.setHistory[input.setHistory.length - 1] || null;

  return {
    currentLoad: input.currentLoad,
    currentReps: input.currentReps,
    plannedSetCount: input.plannedSetCount,
    plannedRpe: input.plannedRpe,
    latestSet: {
      avgVelocity: latestSet?.avg_velocity || null,
      velocityLossLast: latestSet?.velocity_loss_last || null,
      rom: latestSet?.avg_rom_cm || null,
    },
    currentHeartRate: input.currentHeartRate,
    restDurationSeconds: input.restStartTime
      ? Math.floor((Date.now() - input.restStartTime) / 1000)
      : 0,
    isConnected: input.isConnected,
    isVideoRecording: input.isVideoRecording,
  };
}

/**
 * Format decision data for the DECISION tab
 */
export function formatDecisionData(decision: SessionDecision | null): DecisionData {
  if (!decision) {
    return {
      recommendedLoad: null,
      recommendedReps: null,
      candidateSource: null,
      plannedRowId: null,
      recommendedRestMin: null,
      waitUntilHRBelow: null,
      reasonBullets: [],
      passCriteria: [],
      stopCriteria: [],
      fatigueStatus: "unknown",
      formStatus: "unknown",
      hrRecoveryStatus: "unknown",
    };
  }

  return {
    recommendedLoad: decision.recommendedNextLoad,
    recommendedReps: decision.recommendedNextReps,
    candidateSource: decision.candidateSource,
    plannedRowId: decision.plannedRowId,
    recommendedRestMin: decision.recommendedRestMin,
    waitUntilHRBelow: decision.waitUntilHRBelow,
    reasonBullets: decision.reasonBullets.slice(0, 3),
    passCriteria: decision.passCriteria,
    stopCriteria: decision.stopCriteria,
    fatigueStatus: decision.fatigueStatus,
    formStatus: decision.formStatus,
    hrRecoveryStatus:
      decision.hrRecoveryStatus === "unknown" ? "unknown" : decision.hrRecoveryStatus,
  };
}

/**
 * Format set list for the SETS tab
 */
export function formatSetList(setHistory: SetData[]): SetListItem[] {
  return setHistory.map((set) => ({
    sessionId: set.session_id,
    lift: set.lift,
    setIndex: set.set_index,
    load: set.load_kg,
    reps: set.reps,
    avgVelocity: set.avg_velocity,
    velocityLoss: set.velocity_loss,
    rom: set.avg_rom_cm ?? null,
    isWarmup: set.is_warmup || false,
  }));
}

export function formatSetCardLines(item: SetListItem, useMetric: boolean) {
  return {
    lift: item.lift,
    setLabel: `#${item.setIndex}`,
    loadAndReps: `${formatLoad(item.load, useMetric)} x ${item.reps}`,
    metrics: `AV ${formatVelocity(item.avgVelocity)}  VL ${formatVelocityLoss(item.velocityLoss)}  ROM ${
      item.rom == null ? "--" : item.rom.toFixed(1)
    }`,
  };
}

/**
 * Format complete dashboard data
 */
export function formatDashboardData(input: {
  currentLoad: number;
  currentReps: number;
  plannedSetCount: number | null;
  plannedRpe: number | null;
  setHistory: SetData[];
  currentHeartRate: number | null;
  restStartTime: number | null;
  isConnected: boolean;
  isVideoRecording: boolean;
  decision: SessionDecision | null;
}): DashboardData {
  return {
    live: formatLiveData(input),
    decision: formatDecisionData(input.decision),
    sets: formatSetList(input.setHistory),
  };
}

/**
 * Calculate adjusted load with +/- 2.5kg step
 */
export function adjustLoad(currentLoad: number, direction: "up" | "down"): number {
  const step = 2.5;
  if (direction === "up") {
    return Math.round((currentLoad + step) * 10) / 10;
  } else {
    return Math.max(0, Math.round((currentLoad - step) * 10) / 10);
  }
}

/**
 * Calculate adjusted reps with +/- 1 step
 */
export function adjustReps(currentReps: number, direction: "up" | "down"): number {
  const step = 1;
  if (direction === "up") {
    return currentReps + step;
  } else {
    return Math.max(1, currentReps - step);
  }
}

/**
 * Format velocity for display
 */
export function formatVelocity(velocity: number | null | undefined): string {
  if (velocity == null) {
    return "--";
  }
  return velocity.toFixed(2);
}

/**
 * Format velocity loss for display
 */
export function formatVelocityLoss(vl: number | null): string {
  if (vl === null || vl === undefined) {
    return "--";
  }
  return vl.toFixed(1) + "%";
}

/**
 * Format load for display
 */
export function formatLoad(load: number, useMetric: boolean): string {
  if (useMetric) {
    return load.toFixed(2) + " kg";
  } else {
    // Convert to lbs
    const lbs = load * 2.20462;
    return lbs.toFixed(2) + " lbs";
  }
}

/**
 * Format heart rate for display
 */
export function formatHeartRate(hr: number | null): string {
  if (hr === null || hr === undefined) {
    return "--";
  }
  return hr.toString() + " bpm";
}

/**
 * Format rest time for display
 */
export function formatRestTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Get connection status text and color
 */
export function getConnectionStatus(
  isConnected: boolean,
): { text: string; color: string } {
  if (isConnected) {
    return { text: "接続中", color: GarageTheme.success };
  }
  return { text: "未接続", color: GarageTheme.danger };
}

/**
 * Get heart rate status text and color
 */
export function getHeartRateStatus(hr: number | null): {
  text: string;
  color: string;
} {
  if (hr === null) {
    return { text: "--", color: GarageTheme.textMuted };
  }
  if (hr >= 120) {
    return { text: "高", color: GarageTheme.danger };
  }
  if (hr >= 100) {
    return { text: "中", color: GarageTheme.warning };
  }
  return { text: "低", color: GarageTheme.success };
}

/**
 * Get video status text and color
 */
export function getVideoStatus(isRecording: boolean): {
  text: string;
  color: string;
} {
  if (isRecording) {
    return { text: "録画中", color: GarageTheme.danger };
  }
  return { text: "停止", color: GarageTheme.textMuted };
}
