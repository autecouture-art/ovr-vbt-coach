import type { Exercise, SetData } from "../types/index";
import { isBig3 } from "./WarmupLogic";
import {
  getCanonicalExerciseName,
  roundToHalfKg,
} from "../constants/exerciseCatalog";

export const ACCESSORY_RM_TARGET_REPS = Array.from(
  { length: 11 },
  (_, index) => index + 5,
);

export type AccessoryRMTargetRow = {
  reps: number;
  targetLoadKg: number | null;
  targetE1RMKg: number | null;
  currentLoadE1RMKg: number | null;
  currentLoadHitsTarget: boolean | null;
};

export type AccessoryRMTargetContext = {
  enabled: boolean;
  lift: string;
  canonicalLift: string;
  repRange: [number, number];
  currentLoadKg: number | null;
  currentReps: number | null;
  currentE1RMKg: number | null;
  previousBestE1RMKg: number | null;
  targetE1RMKg: number | null;
  targetSource: "previous_best" | "current_baseline" | "missing_load_or_reps";
  e1RMPR: boolean | null;
  sameLoadRepPR: boolean | null;
  sameLoadVolumePR: boolean | null;
  conversionTable: AccessoryRMTargetRow[];
  stopRules: string[];
  note: string;
};

type BuildAccessoryRMTargetContextArgs = {
  lift: string;
  currentLoadKg?: number | null;
  currentReps?: number | null;
  currentE1RMKg?: number | null;
  exercise?: Exercise | null;
  historySets?: SetData[];
  currentSet?: SetData | null;
};

const STOP_RULES = [
  "RPE 9.5以上なら補助PR狙い終了",
  "痛みが出たら終了",
  "ROMが15%以上急変したら測定位置確認を優先",
  "主役リフトに響く疲労が出るなら終了",
];

const isFinitePositive = (value: number | null | undefined): value is number =>
  value != null && Number.isFinite(value) && value > 0;

export function calculateAccessoryE1RM(
  loadKg: number | null | undefined,
  reps: number | null | undefined,
): number | null {
  if (!isFinitePositive(loadKg) || !isFinitePositive(reps)) return null;
  const e1rm = loadKg * (1 + reps / 30);
  return Math.round(e1rm * 10) / 10;
}

function roundUpToHalfKg(loadKg: number): number {
  return Math.ceil(loadKg * 2) / 2;
}

function getSetIdentity(set: SetData | null | undefined) {
  if (!set) return null;
  return [
    getCanonicalExerciseName(set.lift),
    set.session_id,
    set.set_index,
    set.load_kg,
    set.reps,
    set.timestamp ?? "",
    set.end_timestamp ?? "",
  ].join("|");
}

function sameCanonicalLift(set: SetData, canonicalLift: string) {
  return getCanonicalExerciseName(set.lift) === canonicalLift;
}

function buildConversionTable(
  targetE1RMKg: number | null,
  currentLoadKg: number | null,
): AccessoryRMTargetRow[] {
  return ACCESSORY_RM_TARGET_REPS.map((reps) => {
    if (!isFinitePositive(targetE1RMKg)) {
      return {
        reps,
        targetLoadKg: null,
        targetE1RMKg: null,
        currentLoadE1RMKg: isFinitePositive(currentLoadKg)
          ? calculateAccessoryE1RM(currentLoadKg, reps)
          : null,
        currentLoadHitsTarget: null,
      };
    }

    const rawTargetLoad = targetE1RMKg / (1 + reps / 30);
    const targetLoadKg = roundUpToHalfKg(rawTargetLoad);
    const targetE1RMFromLoad = calculateAccessoryE1RM(targetLoadKg, reps);
    const currentLoadE1RMKg = isFinitePositive(currentLoadKg)
      ? calculateAccessoryE1RM(currentLoadKg, reps)
      : null;

    return {
      reps,
      targetLoadKg,
      targetE1RMKg: targetE1RMFromLoad,
      currentLoadE1RMKg,
      currentLoadHitsTarget:
        currentLoadE1RMKg != null ? currentLoadE1RMKg >= targetE1RMKg : null,
    };
  });
}

export function buildAccessoryRMTargetContext({
  lift,
  currentLoadKg,
  currentReps,
  currentE1RMKg,
  exercise,
  historySets = [],
  currentSet = null,
}: BuildAccessoryRMTargetContextArgs): AccessoryRMTargetContext {
  const canonicalLift = getCanonicalExerciseName(lift);
  const enabled = exercise ? !isBig3(exercise.category) : true;
  const currentSetIdentity = getSetIdentity(currentSet);
  const sameLiftHistory = historySets.filter((set) => {
    if (!sameCanonicalLift(set, canonicalLift)) return false;
    if (currentSetIdentity && getSetIdentity(set) === currentSetIdentity) {
      return false;
    }
    return true;
  });
  const sameLoadHistory = sameLiftHistory.filter(
    (set) =>
      isFinitePositive(currentLoadKg) &&
      Math.abs(set.load_kg - currentLoadKg) < 0.26,
  );
  const normalizedCurrentE1RM =
    currentE1RMKg ??
    calculateAccessoryE1RM(currentLoadKg ?? null, currentReps ?? null);
  const previousBestE1RM = Math.max(
    ...sameLiftHistory
      .map((set) => set.e1rm ?? calculateAccessoryE1RM(set.load_kg, set.reps))
      .filter(isFinitePositive),
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
  const previousBestE1RMKg = previousBestE1RM || null;
  const targetE1RMKg =
    previousBestE1RMKg ??
    (normalizedCurrentE1RM != null ? normalizedCurrentE1RM : null);
  const targetSource = previousBestE1RMKg
    ? "previous_best"
    : targetE1RMKg
      ? "current_baseline"
      : "missing_load_or_reps";

  return {
    enabled,
    lift,
    canonicalLift,
    repRange: [5, 15],
    currentLoadKg: isFinitePositive(currentLoadKg) ? currentLoadKg : null,
    currentReps: isFinitePositive(currentReps) ? Math.round(currentReps) : null,
    currentE1RMKg: normalizedCurrentE1RM,
    previousBestE1RMKg,
    targetE1RMKg,
    targetSource,
    e1RMPR:
      normalizedCurrentE1RM != null && previousBestE1RMKg != null
        ? normalizedCurrentE1RM > previousBestE1RMKg
        : null,
    sameLoadRepPR:
      isFinitePositive(currentReps) && previousBestSameLoadReps > 0
        ? currentReps > previousBestSameLoadReps
        : null,
    sameLoadVolumePR:
      isFinitePositive(currentLoadKg) &&
      isFinitePositive(currentReps) &&
      previousBestSameLoadVolume > 0
        ? currentLoadKg * currentReps > previousBestSameLoadVolume
        : null,
    conversionTable: buildConversionTable(targetE1RMKg, currentLoadKg ?? null),
    stopRules: STOP_RULES,
    note:
      "アクセサリーは5〜15repの範囲で、毎回1セットだけRM換算セットマックスを狙う。主役リフトの質を落とさない範囲で実施。",
  };
}

export function formatAccessoryTargetLoad(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${roundToHalfKg(value).toFixed(value % 1 === 0 ? 0 : 1)}kg`;
}
