import { getCanonicalExerciseName } from "../constants/exerciseCatalog";
import type { SetData } from "../types/index";
import { isSameRecordedLoadKg } from "./LoadPrecision";

export type VelocityLossRepPRStatus =
  | "disabled"
  | "baseline"
  | "chasing"
  | "achieved"
  | "threshold_exceeded";

export type VelocityLossRepPRTarget = {
  enabled: boolean;
  status: VelocityLossRepPRStatus;
  historicalBestReps: number | null;
  targetReps: number | null;
  liveRepCount: number;
  repsRemaining: number | null;
  eligibleHistoryCount: number;
  excludedHistoryCount: number;
};

type BuildVelocityLossRepPRTargetArgs = {
  lift: string;
  loadKg: number;
  velocityLossThreshold: number;
  liveRepCount: number;
  currentVelocityLoss: number | null;
  historySets: SetData[];
};

const isFiniteNonNegative = (
  value: number | null | undefined,
): value is number =>
  value != null && Number.isFinite(value) && value >= 0;

function resolveHistoricalVelocityLoss(set: SetData): number | null {
  if (set.reps === 1) return 0;
  if (isFiniteNonNegative(set.velocity_loss_last)) {
    return set.velocity_loss_last;
  }
  return isFiniteNonNegative(set.velocity_loss) ? set.velocity_loss : null;
}

function getSetIdentity(set: SetData) {
  return [
    set.session_id,
    getCanonicalExerciseName(set.lift),
    set.set_index,
    set.load_kg,
    set.reps,
    set.timestamp,
  ].join("|");
}

export function buildVelocityLossRepPRTarget({
  lift,
  loadKg,
  velocityLossThreshold,
  liveRepCount,
  currentVelocityLoss,
  historySets,
}: BuildVelocityLossRepPRTargetArgs): VelocityLossRepPRTarget {
  const safeLiveRepCount = Math.max(0, Math.round(liveRepCount || 0));
  if (
    !Number.isFinite(loadKg) ||
    loadKg <= 0 ||
    !Number.isFinite(velocityLossThreshold) ||
    velocityLossThreshold <= 0
  ) {
    return {
      enabled: false,
      status: "disabled",
      historicalBestReps: null,
      targetReps: null,
      liveRepCount: safeLiveRepCount,
      repsRemaining: null,
      eligibleHistoryCount: 0,
      excludedHistoryCount: 0,
    };
  }

  const canonicalLift = getCanonicalExerciseName(lift);
  const uniqueHistory = [
    ...new Map(historySets.map((set) => [getSetIdentity(set), set])).values(),
  ];
  const matchingHistory = uniqueHistory.filter(
    (set) =>
      getCanonicalExerciseName(set.lift) === canonicalLift &&
      isSameRecordedLoadKg(set.load_kg, loadKg) &&
      !set.is_warmup &&
      Number.isFinite(set.reps) &&
      set.reps > 0,
  );
  const eligibleHistory = matchingHistory.filter((set) => {
    const setVelocityLoss = resolveHistoricalVelocityLoss(set);
    return (
      setVelocityLoss != null &&
      setVelocityLoss <= velocityLossThreshold
    );
  });
  const historicalBestReps = Math.max(
    ...eligibleHistory.map((set) => Math.round(set.reps)),
    0,
  );
  const targetReps = historicalBestReps > 0 ? historicalBestReps + 1 : 1;
  const repsRemaining = Math.max(0, targetReps - safeLiveRepCount);
  const thresholdExceeded =
    currentVelocityLoss != null &&
    Number.isFinite(currentVelocityLoss) &&
    currentVelocityLoss > velocityLossThreshold;
  const achieved = safeLiveRepCount >= targetReps && !thresholdExceeded;

  return {
    enabled: true,
    status: thresholdExceeded
      ? "threshold_exceeded"
      : achieved
        ? "achieved"
        : historicalBestReps > 0
          ? "chasing"
          : "baseline",
    historicalBestReps: historicalBestReps || null,
    targetReps,
    liveRepCount: safeLiveRepCount,
    repsRemaining,
    eligibleHistoryCount: eligibleHistory.length,
    excludedHistoryCount: matchingHistory.length - eligibleHistory.length,
  };
}
