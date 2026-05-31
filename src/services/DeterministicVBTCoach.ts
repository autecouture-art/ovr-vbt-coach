import type { AppSettings, Exercise, SetData, SetType } from '../types/index';
import {
  getLiveVelocityLossDecision,
  getPowerliftingProtocol,
  getReadinessDecision,
  getTopSingleTargetText,
  type PowerliftingProtocol,
} from '../utils/PowerliftingVBTProtocol';
import {
  getVelocityLossForJudgement,
  getVelocityLossSafety,
} from '../utils/VBTCalculations';

export type VBTCoachAction =
  | 'collect_data'
  | 'continue'
  | 'watch'
  | 'stop_set'
  | 'reduce_load'
  | 'hold_load'
  | 'top_single_complete';

export type VBTCoachConfidence = 'low' | 'medium' | 'high';

export interface DeterministicVBTCoachInput {
  setHistory: SetData[];
  exercise?: Pick<
    Exercise,
    | 'name'
    | 'category'
    | 'mvt'
    | 'velocity_loss_threshold'
    | 'min_rom_threshold'
    | 'rom_range_min_cm'
    | 'rom_range_max_cm'
  > | null;
  phase?: AppSettings['target_training_phase'];
  baselineVelocity?: number | null;
}

export interface DeterministicVBTCoachDecision {
  action: VBTCoachAction;
  confidence: VBTCoachConfidence;
  severity: 'info' | 'warning' | 'success' | 'alert';
  message: string;
  suggestedAction?: string;
  reasons: string[];
  protocol: PowerliftingProtocol;
  setPurpose: SetType | 'unknown';
  velocityLossThreshold: number;
  topSingleTargetText: string;
  loadAdjustmentPercent: number;
}

const DEFAULT_PHASE: AppSettings['target_training_phase'] = 'strength';
const WATCH_MARGIN_PERCENT = 3;

const isFinitePositive = (value: number | null | undefined): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

const latestSetWithLoad = (sets: SetData[]) =>
  [...sets].reverse().find((set) => set.load_kg > 0) ?? null;

const inferSetPurpose = (set: SetData | null): SetType | 'unknown' => {
  if (!set) return 'unknown';
  if (set.set_type && set.set_type !== 'normal') return set.set_type;
  if (set.reps === 1) return 'top_single';
  return set.set_type ?? 'normal';
};

const confidenceForSet = (
  set: SetData | null,
  hasMvt: boolean,
): VBTCoachConfidence => {
  if (!set || !isFinitePositive(set.avg_velocity)) return 'low';
  const velocityLoss = getVelocityLossForJudgement(set);
  if (!hasMvt) return velocityLoss != null ? 'medium' : 'low';
  if (velocityLoss != null) return 'high';
  return 'medium';
};

const getRomThreshold = (
  exercise: DeterministicVBTCoachInput['exercise'],
): number | null =>
  exercise?.rom_range_min_cm ??
  exercise?.min_rom_threshold ??
  null;

const isShortRomSet = (
  set: SetData | null,
  exercise: DeterministicVBTCoachInput['exercise'],
) => {
  const threshold = getRomThreshold(exercise);
  if (!set || !isFinitePositive(set.avg_rom_cm) || !isFinitePositive(threshold)) {
    return false;
  }
  return set.avg_rom_cm < threshold;
};

export class DeterministicVBTCoach {
  static evaluate(input: DeterministicVBTCoachInput): DeterministicVBTCoachDecision {
    const phase = input.phase ?? DEFAULT_PHASE;
    const category = input.exercise?.category;
    const protocol = getPowerliftingProtocol(category, phase);
    const lastSet = latestSetWithLoad(input.setHistory);
    const setPurpose = inferSetPurpose(lastSet);
    const mvt = input.exercise?.mvt;
    const hasMvt = isFinitePositive(mvt);
    const threshold =
      input.exercise?.velocity_loss_threshold ??
      protocol.backoffVelocityLoss.max;
    const topSingleTargetText = getTopSingleTargetText(mvt, protocol);
    const baseDecision = {
      protocol,
      setPurpose,
      velocityLossThreshold: threshold,
      topSingleTargetText,
      loadAdjustmentPercent: 0,
    };
    const shortRom = isShortRomSet(lastSet, input.exercise);
    const romThreshold = getRomThreshold(input.exercise);

    if (!lastSet || !isFinitePositive(lastSet.avg_velocity)) {
      return {
        ...baseDecision,
        action: 'collect_data',
        confidence: 'low',
        severity: 'info',
        message: 'VBT判定用の平均速度を記録中です。',
        suggestedAction: 'まず同じフォームで平均速度とROMを残します。',
        reasons: ['missing_average_velocity'],
      };
    }

    if (shortRom) {
      return {
        ...baseDecision,
        action: 'hold_load',
        confidence: 'low',
        severity: 'warning',
        message: `ROMが短めです (${lastSet.avg_rom_cm?.toFixed(1)} cm)。`,
        suggestedAction: `速度判断より先に可動域を揃えます。目安は${romThreshold?.toFixed(1)} cm以上です。`,
        reasons: ['short_rom_quality_gate'],
      };
    }

    const readiness = isFinitePositive(input.baselineVelocity)
      ? getReadinessDecision(lastSet.avg_velocity - input.baselineVelocity)
      : null;

    if (setPurpose === 'top_single') {
      return this.evaluateTopSingle({
        lastSet,
        mvt: hasMvt ? mvt : null,
        protocol,
        threshold,
        topSingleTargetText,
        readiness,
      });
    }

    return this.evaluateBackoff({
      lastSet,
      protocol,
      threshold,
      topSingleTargetText,
      readiness,
      setPurpose,
      hasMvt,
    });
  }

  private static evaluateTopSingle({
    lastSet,
    mvt,
    protocol,
    threshold,
    topSingleTargetText,
    readiness,
  }: {
    lastSet: SetData;
    mvt: number | null;
    protocol: PowerliftingProtocol;
    threshold: number;
    topSingleTargetText: string;
    readiness: ReturnType<typeof getReadinessDecision> | null;
  }): DeterministicVBTCoachDecision {
    const velocity = lastSet.avg_velocity ?? 0;
    const reasons = ['top_single'];
    const loadAdjustmentPercent = readiness?.loadAdjustmentPercent ?? 0;

    if (!mvt) {
      return {
        action: 'hold_load',
        confidence: confidenceForSet(lastSet, false),
        severity: 'info',
        message: `トップシングルを記録しました。目標は${topSingleTargetText}です。`,
        suggestedAction: '個人MVTが未確定なので、失敗せず成功した最遅シングルを蓄積します。',
        reasons: [...reasons, 'missing_mvt'],
        protocol,
        setPurpose: 'top_single',
        velocityLossThreshold: threshold,
        topSingleTargetText,
        loadAdjustmentPercent,
      };
    }

    const targetMin = mvt + protocol.topSingleMvtMargin.min;
    const targetMax = mvt + protocol.topSingleMvtMargin.max;

    if (velocity < targetMin) {
      return {
        action: 'reduce_load',
        confidence: confidenceForSet(lastSet, true),
        severity: 'warning',
        message: `トップシングルが目標下限より遅いです (${velocity.toFixed(2)} m/s)。`,
        suggestedAction: '今日は重量を2.5〜5%落とし、バックオフも短めにします。',
        reasons: [...reasons, 'below_top_single_target'],
        protocol,
        setPurpose: 'top_single',
        velocityLossThreshold: threshold,
        topSingleTargetText,
        loadAdjustmentPercent: Math.min(loadAdjustmentPercent, -2.5),
      };
    }

    if (velocity <= targetMax) {
      return {
        action: 'top_single_complete',
        confidence: confidenceForSet(lastSet, true),
        severity: 'success',
        message: `トップシングルは目標範囲内です (${velocity.toFixed(2)} m/s)。`,
        suggestedAction: `バックオフはVL ${protocol.backoffVelocityLoss.min}〜${protocol.backoffVelocityLoss.max}%以内で止めます。`,
        reasons: [...reasons, 'inside_top_single_target'],
        protocol,
        setPurpose: 'top_single',
        velocityLossThreshold: threshold,
        topSingleTargetText,
        loadAdjustmentPercent,
      };
    }

    return {
      action: 'continue',
      confidence: confidenceForSet(lastSet, true),
      severity: 'success',
      message: `トップシングルは目標より速いです (${velocity.toFixed(2)} m/s)。`,
      suggestedAction: '予定通り進めます。余裕が明確なら次のシングルを小さく上げてもよいです。',
      reasons: [...reasons, 'above_top_single_target'],
      protocol,
      setPurpose: 'top_single',
      velocityLossThreshold: threshold,
      topSingleTargetText,
      loadAdjustmentPercent: Math.max(loadAdjustmentPercent, 0),
    };
  }

  private static evaluateBackoff({
    lastSet,
    protocol,
    threshold,
    topSingleTargetText,
    readiness,
    setPurpose,
    hasMvt,
  }: {
    lastSet: SetData;
    protocol: PowerliftingProtocol;
    threshold: number;
    topSingleTargetText: string;
    readiness: ReturnType<typeof getReadinessDecision> | null;
    setPurpose: SetType | 'unknown';
    hasMvt: boolean;
  }): DeterministicVBTCoachDecision {
    const velocityLoss = getVelocityLossForJudgement(lastSet);
    const velocityLossMin = getVelocityLossSafety(lastSet);
    const reasons = ['backoff_or_work_set'];
    const loadAdjustmentPercent = readiness?.loadAdjustmentPercent ?? 0;

    if (velocityLoss == null) {
      return {
        action: 'continue',
        confidence: confidenceForSet(lastSet, hasMvt),
        severity: 'info',
        message: `平均速度 ${lastSet.avg_velocity?.toFixed(2)} m/s を記録しました。`,
        suggestedAction: `次はVL_last ${threshold}%以内で止める準備をします。`,
        reasons: [...reasons, 'missing_velocity_loss'],
        protocol,
        setPurpose,
        velocityLossThreshold: threshold,
        topSingleTargetText,
        loadAdjustmentPercent,
      };
    }

    const vlDecision = getLiveVelocityLossDecision(
      100,
      Math.max(0, 100 - velocityLoss),
      threshold,
    );

    if (velocityLoss >= threshold) {
      return {
        action: 'stop_set',
        confidence: confidenceForSet(lastSet, hasMvt),
        severity: 'alert',
        message: `VL_last ${velocityLoss.toFixed(1)}% が上限 ${threshold}% に到達しました。`,
        suggestedAction: 'この種目の本セットは止めます。続けるなら2.5〜5%落として最小セットにします。',
        reasons: [
          ...reasons,
          'velocity_loss_last_exceeded',
          ...(velocityLossMin != null && velocityLossMin >= 30
            ? ['velocity_loss_min_safety_warning']
            : []),
        ],
        protocol,
        setPurpose,
        velocityLossThreshold: threshold,
        topSingleTargetText,
        loadAdjustmentPercent: Math.min(loadAdjustmentPercent, -2.5),
      };
    }

    if (vlDecision?.status === 'watch' || threshold - velocityLoss <= WATCH_MARGIN_PERCENT) {
      return {
        action: 'watch',
        confidence: confidenceForSet(lastSet, hasMvt),
        severity: 'warning',
        message: `VL_last上限まであと${Math.max(0, threshold - velocityLoss).toFixed(1)}%です。`,
        suggestedAction: '次レップで速度かROMが崩れたら止めます。',
        reasons: [...reasons, 'near_velocity_loss_limit'],
        protocol,
        setPurpose,
        velocityLossThreshold: threshold,
        topSingleTargetText,
        loadAdjustmentPercent,
      };
    }

    return {
      action: 'continue',
      confidence: confidenceForSet(lastSet, hasMvt),
      severity: 'success',
      message: `VL_last ${velocityLoss.toFixed(1)}% は上限 ${threshold}% 内です。`,
      suggestedAction: protocol.guidance,
      reasons: [...reasons, 'inside_velocity_loss_limit'],
      protocol,
      setPurpose,
      velocityLossThreshold: threshold,
      topSingleTargetText,
      loadAdjustmentPercent,
    };
  }
}

export default DeterministicVBTCoach;
