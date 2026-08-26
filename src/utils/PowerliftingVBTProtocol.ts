import { calculateVelocityLossMetrics } from "./VBTCalculations";
import type { AppSettings, Exercise, RepData } from "@/src/types/index";

export type PowerliftingPhase = AppSettings["target_training_phase"];
type MainLiftCategory = "squat" | "bench" | "deadlift";

interface ProtocolRange {
  min: number;
  max: number;
}

export interface PowerliftingProtocol {
  phase: PowerliftingPhase;
  phaseLabel: string;
  phaseIntent: string;
  topSingleMvtMargin: ProtocolRange;
  backoffVelocityLoss: ProtocolRange;
  speedVelocityLoss: ProtocolRange;
  guidance: string;
}

export interface ReadinessDecision {
  deltaVelocity: number;
  label: "excellent" | "normal" | "down" | "fatigued";
  loadAdjustmentPercent: number;
  volumeAdjustment: "increase_optional" | "keep" | "reduce" | "minimum";
  message: string;
}

export interface LiveVelocityLossDecision {
  velocityLoss: number;
  threshold: number;
  status: "fresh" | "watch" | "stop";
  message: string;
  nextSetMessage: string;
}

export interface FocusVelocityLossState {
  repCount: number;
  latestAverageVelocity: number | null;
  velocityLossAverage: number | null;
  velocityLossMinimum: number | null;
  decision: LiveVelocityLossDecision | null;
}

export interface LvpCheckpoint {
  label: string;
  percentRange: string;
  reps: string;
  required: boolean;
}

export interface BlockWeekPlan {
  week: number;
  phase: PowerliftingPhase;
  phaseLabel: string;
  focus: string;
  topSingle: string;
  backoff: string;
  note: string;
}

export interface AttemptPlan {
  opener: number;
  second: number;
  thirdLow: number;
  thirdHigh: number;
  note: string;
}

export const POWERLIFTING_PHASES: {
  value: PowerliftingPhase;
  label: string;
  description: string;
}[] = [
  {
    value: "hypertrophy",
    label: "蓄積期",
    description: "フォーム固定、技術量、LVP作成。VLは中程度まで許容。",
  },
  {
    value: "strength",
    label: "強度化期",
    description: "重いシングルで当日の状態を見て、バックオフは疲労を制限。",
  },
  {
    value: "peaking",
    label: "ピーキング",
    description: "試合形式の重いシングルを成功率高く。VLは低く保つ。",
  },
  {
    value: "power",
    label: "スピード",
    description: "速さと軌道の確認。失速前に止める。",
  },
];

export const LVP_CHECKPOINTS: LvpCheckpoint[] = [
  { label: "軽め", percentRange: "40〜50%", reps: "2〜3回", required: true },
  { label: "中量", percentRange: "60〜65%", reps: "1〜2回", required: true },
  { label: "重め", percentRange: "70〜75%", reps: "1回", required: true },
  { label: "高強度", percentRange: "80〜85%", reps: "1回", required: true },
  { label: "ピーク時", percentRange: "90%前後", reps: "1回", required: false },
];

function categoryToMainLift(category?: string): MainLiftCategory | "other" {
  if (category === "squat" || category === "bench" || category === "deadlift") {
    return category;
  }
  return "other";
}

function range(min: number, max: number): ProtocolRange {
  return { min, max };
}

export function getPowerliftingProtocol(
  category: Exercise["category"] | string | undefined,
  phase: PowerliftingPhase,
): PowerliftingProtocol {
  const lift = categoryToMainLift(category);
  const phaseMeta =
    POWERLIFTING_PHASES.find((item) => item.value === phase) ??
    POWERLIFTING_PHASES[1];

  const topSingleByPhase: Record<PowerliftingPhase, ProtocolRange> = {
    hypertrophy: range(0.12, 0.18),
    strength: range(0.07, 0.12),
    peaking: range(0.02, 0.08),
    power: range(0.12, 0.2),
  };

  const speedLossByPhase: Record<PowerliftingPhase, ProtocolRange> = {
    hypertrophy: range(5, 10),
    strength: range(5, 10),
    peaking: range(0, 5),
    power: range(5, 10),
  };

  const backoffByLift: Record<
    MainLiftCategory | "other",
    Record<PowerliftingPhase, ProtocolRange>
  > = {
    squat: {
      hypertrophy: range(15, 25),
      strength: range(10, 20),
      peaking: range(5, 10),
      power: range(5, 10),
    },
    bench: {
      hypertrophy: range(20, 35),
      strength: range(15, 25),
      peaking: range(5, 10),
      power: range(5, 15),
    },
    deadlift: {
      hypertrophy: range(8, 15),
      strength: range(5, 10),
      peaking: range(0, 10),
      power: range(5, 10),
    },
    other: {
      hypertrophy: range(15, 25),
      strength: range(10, 20),
      peaking: range(5, 10),
      power: range(5, 15),
    },
  };

  const backoffVelocityLoss = backoffByLift[lift][phase];

  return {
    phase,
    phaseLabel: phaseMeta.label,
    phaseIntent: phaseMeta.description,
    topSingleMvtMargin: topSingleByPhase[phase],
    backoffVelocityLoss,
    speedVelocityLoss: speedLossByPhase[phase],
    guidance: getProtocolGuidance(lift, phase, backoffVelocityLoss),
  };
}

export function getProtocolVelocityLossThreshold(
  category: Exercise["category"] | string | undefined,
  phase: PowerliftingPhase,
): number {
  const protocol = getPowerliftingProtocol(category, phase);
  return protocol.backoffVelocityLoss.max;
}

export function resolveVelocityLossThreshold(
  exerciseThreshold: number | null | undefined,
  settingsThreshold: number | null | undefined,
  protocolThreshold: number,
): number {
  const firstValid = [exerciseThreshold, settingsThreshold, protocolThreshold].find(
    (threshold): threshold is number =>
      typeof threshold === "number" && Number.isFinite(threshold) && threshold >= 0,
  );
  return firstValid ?? protocolThreshold;
}

export function getPhaseForBlockWeek(week: number): PowerliftingPhase {
  const normalizedWeek = Math.min(12, Math.max(1, Math.round(week)));
  if (normalizedWeek <= 4) return "hypertrophy";
  if (normalizedWeek <= 8) return "strength";
  if (normalizedWeek <= 11) return "peaking";
  return "peaking";
}

export function getBlockWeekPlan(
  week: number,
  category: Exercise["category"] | string | undefined,
): BlockWeekPlan {
  const normalizedWeek = Math.min(12, Math.max(1, Math.round(week)));
  const phase = getPhaseForBlockWeek(normalizedWeek);
  const protocol = getPowerliftingProtocol(category, phase);

  if (normalizedWeek <= 4) {
    return {
      week: normalizedWeek,
      phase,
      phaseLabel: protocol.phaseLabel,
      focus: "フォーム固定、技術量、LVP作成",
      topSingle: "RPE6〜7 / MVT +0.12〜0.18",
      backoff: `VL ${protocol.backoffVelocityLoss.min}〜${protocol.backoffVelocityLoss.max}%`,
      note: "ウォームアップ中にAVとROMを残し、自分専用の速度基準を増やします。",
    };
  }

  if (normalizedWeek <= 8) {
    return {
      week: normalizedWeek,
      phase,
      phaseLabel: protocol.phaseLabel,
      focus: "競技フォームで重い重量に慣れる",
      topSingle: "RPE7〜8 / MVT +0.07〜0.12",
      backoff: `VL ${protocol.backoffVelocityLoss.min}〜${protocol.backoffVelocityLoss.max}%`,
      note: "70〜85%付近の速度が普段より遅い日は重量とセット数を落とします。",
    };
  }

  if (normalizedWeek <= 11) {
    return {
      week: normalizedWeek,
      phase,
      phaseLabel: protocol.phaseLabel,
      focus: "試合形式の重いシングルを成功率高く",
      topSingle: "RPE8〜9 / MVT +0.02〜0.08",
      backoff: `VL ${protocol.backoffVelocityLoss.min}〜${protocol.backoffVelocityLoss.max}%`,
      note: "失敗試技は作らず、同じ軌道で速く成功させることを優先します。",
    };
  }

  return {
    week: normalizedWeek,
    phase,
    phaseLabel: "テーパー",
    focus: "ボリュームを落として高強度を維持",
    topSingle: "オープナー確認後は軽め",
    backoff: "VLほぼゼロ",
    note: "試合週は疲労を抜き、速度確認と成功率を最優先にします。",
  };
}

export function getTopSingleTargetText(
  mvt: number | undefined | null,
  protocol: PowerliftingProtocol,
): string {
  if (!mvt || mvt <= 0) {
    return `個人MVT +${protocol.topSingleMvtMargin.min.toFixed(2)}〜+${protocol.topSingleMvtMargin.max.toFixed(2)} m/s`;
  }

  const min = mvt + protocol.topSingleMvtMargin.min;
  const max = mvt + protocol.topSingleMvtMargin.max;
  return `${min.toFixed(2)}〜${max.toFixed(2)} m/s`;
}

export function getLiveVelocityLossDecision(
  fastestVelocity: number,
  currentVelocity: number,
  threshold: number,
): LiveVelocityLossDecision | null {
  if (fastestVelocity <= 0 || currentVelocity <= 0 || threshold <= 0) {
    return null;
  }

  const velocityLoss =
    ((fastestVelocity - currentVelocity) / fastestVelocity) * 100;
  return getLiveVelocityLossDecisionFromLoss(
    Math.round(velocityLoss * 10) / 10,
    threshold,
  );
}

export function getLiveVelocityLossDecisionFromLoss(
  roundedVelocityLoss: number,
  threshold: number,
): LiveVelocityLossDecision | null {
  if (
    !Number.isFinite(roundedVelocityLoss) ||
    roundedVelocityLoss < 0 ||
    !Number.isFinite(threshold) ||
    threshold <= 0
  ) {
    return null;
  }

  const velocityLoss = roundedVelocityLoss;
  const remaining = Math.max(0, threshold - velocityLoss);

  if (velocityLoss >= threshold) {
    return {
      velocityLoss,
      threshold,
      status: "stop",
      message: "VL上限に到達。このセットは終了です。",
      nextSetMessage: "次セットは同重量で続けず、2.5〜5%落とすかセット数を削ります。",
    };
  }

  if (remaining <= 3) {
    return {
      velocityLoss,
      threshold,
      status: "watch",
      message: `あと${remaining.toFixed(1)}%でVL上限です。次のレップで止める準備をします。`,
      nextSetMessage: "フォームとROMが崩れたら速度に関係なく止めます。",
    };
  }

  return {
    velocityLoss,
    threshold,
    status: "fresh",
    message: `VL上限まで${remaining.toFixed(1)}%余裕があります。`,
    nextSetMessage: "速さを保てている間だけバックオフを続けます。",
  };
}

export function getFocusVelocityLossState(
  reps: RepData[],
  threshold: number,
): FocusVelocityLossState {
  const validReps = reps.filter(
    (rep) =>
      rep.is_valid_rep &&
      !rep.is_excluded &&
      !rep.is_failed &&
      rep.mean_velocity != null &&
      Number.isFinite(rep.mean_velocity) &&
      rep.mean_velocity > 0,
  );
  const repCount = validReps.length;
  const latestAverageVelocity =
    repCount > 0 ? (validReps[repCount - 1].mean_velocity ?? null) : null;

  if (repCount < 2 || latestAverageVelocity == null) {
    return {
      repCount,
      latestAverageVelocity,
      velocityLossAverage: null,
      velocityLossMinimum: null,
      decision: null,
    };
  }

  const velocityLossMetrics = calculateVelocityLossMetrics(reps);
  const velocityLossAverage = velocityLossMetrics.vlAvg;
  const velocityLossMinimum = velocityLossMetrics.vlMin;
  const velocityLossLast = velocityLossMetrics.vlLast;

  return {
    repCount,
    latestAverageVelocity,
    velocityLossAverage,
    velocityLossMinimum,
    decision:
      threshold > 0 && velocityLossLast != null
        ? getLiveVelocityLossDecisionFromLoss(velocityLossLast, threshold)
        : null,
  };
}

export function getReadinessDecision(deltaVelocity: number): ReadinessDecision {
  if (deltaVelocity >= 0.03) {
    return {
      deltaVelocity,
      label: "excellent",
      loadAdjustmentPercent: 2.5,
      volumeAdjustment: "increase_optional",
      message: "通常より速い日です。トップシングルは予定通り、余裕があれば小さく上げます。",
    };
  }

  if (deltaVelocity >= -0.03) {
    return {
      deltaVelocity,
      label: "normal",
      loadAdjustmentPercent: 0,
      volumeAdjustment: "keep",
      message: "通常範囲です。予定通り進めます。",
    };
  }

  if (deltaVelocity >= -0.08) {
    return {
      deltaVelocity,
      label: "down",
      loadAdjustmentPercent: -5,
      volumeAdjustment: "reduce",
      message: "少し遅い日です。重量を2.5〜5%下げ、バックオフを短めにします。",
    };
  }

  return {
    deltaVelocity,
    label: "fatigued",
    loadAdjustmentPercent: -7.5,
    volumeAdjustment: "minimum",
    message: "かなり遅い日です。トップシングルを軽くし、バックオフを最小限にします。",
  };
}

export function getAttemptPlan(estimatedOneRm: number): AttemptPlan | null {
  if (!Number.isFinite(estimatedOneRm) || estimatedOneRm <= 0) {
    return null;
  }

  const roundAttempt = (value: number) => Math.round(value / 2.5) * 2.5;
  return {
    opener: roundAttempt(estimatedOneRm * 0.9),
    second: roundAttempt(estimatedOneRm * 0.96),
    thirdLow: roundAttempt(estimatedOneRm),
    thirdHigh: roundAttempt(estimatedOneRm * 1.02),
    note: "第2試技がMVT付近まで遅い日は、第3試技を小さく刻みます。",
  };
}

function getProtocolGuidance(
  lift: MainLiftCategory | "other",
  phase: PowerliftingPhase,
  backoffVelocityLoss: ProtocolRange,
): string {
  if (phase === "peaking") {
    return "失敗試技を作らず、試合フォームの重いシングルを成功率高く積みます。";
  }

  if (lift === "deadlift") {
    return "デッドリフトは疲労コストが高いため、VLを低めにして粘りすぎない運用にします。";
  }

  if (lift === "bench" && phase === "hypertrophy") {
    return "ベンチは筋量ブロックではVLをやや高めに使えますが、競技フォームは崩さない範囲で止めます。";
  }

  return `バックオフはVL ${backoffVelocityLoss.min}〜${backoffVelocityLoss.max}%を上限に、フォームが崩れる前に止めます。`;
}
