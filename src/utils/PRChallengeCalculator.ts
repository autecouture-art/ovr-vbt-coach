/**
 * PR Challenge Calculator
 * Calculates required velocity to achieve target weight PR
 */

import type { LVPData } from '../types/index';

export interface PRChallengeRequest {
  targetWeight: number; // 目標重量 (e.g., 110kg)
  currentWeight?: number; // 現在扱える重量 (optional)
  currentVelocity?: number; // 現在重量での速度 (optional)
  lvp: LVPData; // Load-Velocity Profile
}

export interface PRChallengeResult {
  targetWeight: number;
  predictedVelocityAtTarget: number; // 目標重量での予想速度
  isAchievable: boolean; // 達成可能か
  mvt: number; // Minimum Velocity Threshold
  currentWeight?: number;
  currentVelocity?: number;
  requiredVelocityAtCurrentWeight?: number; // 現在重量で必要な速度
  velocityGap?: number; // 速度のギャップ
  confidence: 'high' | 'medium' | 'low';
  advice: string; // アドバイス
  recommendation: string; // 推奨アクション
}

export interface PRChallengeProgress {
  currentWeight: number;
  currentVelocity: number;
  predictedVelocityAtTarget: number;
  progressToGoal: number; // 0-100%
  readyForPR: boolean;
}

/**
 * Calculate PR challenge feasibility and requirements
 */
export function calculatePRChallenge(request: PRChallengeRequest): PRChallengeResult {
  const { targetWeight, currentWeight, currentVelocity, lvp } = request;
  const mvt = lvp.mvt || 0.15; // Default MVT

  // 目標重量での予想速度を計算
  // velocity = slope * load + intercept
  const predictedVelocityAtTarget = lvp.slope * targetWeight + lvp.intercept;

  // 目標重量が達成可能か（MVT以上の速度があるか）
  const isAchievable = predictedVelocityAtTarget > mvt;

  // 信頼度の判定
  let confidence: 'high' | 'medium' | 'low';
  if (lvp.r_squared >= 0.95 && lvp.sample_count >= 10) {
    confidence = 'high';
  } else if (lvp.r_squared >= 0.85 && lvp.sample_count >= 5) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // 現在の重量と速度が指定されている場合の分析
  if (currentWeight && currentVelocity) {
    // 現在重量での予想速度をLVPから計算
    const expectedVelocityAtCurrent = lvp.slope * currentWeight + lvp.intercept;

    // 現在の速度が期待より速いか遅いか（調子の判定）
    const velocityDiff = currentVelocity - expectedVelocityAtCurrent;

    // 目標達成に必要な現在重量での速度を逆算
    // targetWeightでの速度 = mvt + margin (0.02 m/s)
    const targetVelocityAtWeight = mvt + 0.02;
    // slope * currentWeight + required_intercept = targetVelocityAtWeight
    // required_intercept = targetVelocityAtWeight - slope * currentWeight
    // これは目標達成に必要なintercept
    // currentWeightでの必要速度を計算するには、目標重量での速度を求める式を使う
    // v_target = mvt + 0.02 (目標重量での速度)
    // v_current = v_target + slope * (currentWeight - targetWeight)
    const requiredVelocityAtCurrentWeight = targetVelocityAtWeight + lvp.slope * (currentWeight - targetWeight);

    const velocityGap = currentVelocity - requiredVelocityAtCurrentWeight;
    const readyForPR = velocityGap >= 0;

    return {
      targetWeight,
      predictedVelocityAtTarget,
      isAchievable,
      mvt,
      currentWeight,
      currentVelocity,
      requiredVelocityAtCurrentWeight,
      velocityGap,
      confidence,
      advice: generateAdvice({
        targetWeight,
        currentWeight,
        currentVelocity,
        predictedVelocityAtTarget,
        requiredVelocityAtCurrentWeight,
        velocityGap,
        readyForPR,
        mvt,
      }),
      recommendation: generateRecommendation({
        readyForPR,
        confidence,
        velocityGap,
        isAchievable,
      }),
    };
  }

  // 現在のパフォーマンスデータがない場合
  return {
    targetWeight,
    predictedVelocityAtTarget,
    isAchievable,
    mvt,
    confidence,
    advice: generateGeneralAdvice({
      targetWeight,
      predictedVelocityAtTarget,
      isAchievable,
      mvt,
      confidence,
    }),
    recommendation: isAchievable
      ? 'まずは軽い重量でウォームアップし、徐々に重量を上げて今日の調子を確認しましょう'
      : '現在のLVPプロファイルでは目標達成は困難です。まずは基礎的な筋力アップを目指しましょう',
  };
}

/**
 * Calculate progress toward PR goal based on current performance
 */
export function calculatePRProgress(
  currentWeight: number,
  currentVelocity: number,
  targetWeight: number,
  lvp: LVPData
): PRChallengeProgress {
  const mvt = lvp.mvt || 0.15;

  // 現在のパフォーマンスから目標重量での予想速度を計算
  const expectedVelocityAtCurrent = lvp.slope * currentWeight + lvp.intercept;
  const velocityDiff = currentVelocity - expectedVelocityAtCurrent; // 調子

  // 調子を考慮した目標重量での予想速度
  const predictedVelocityAtTarget = (lvp.slope * targetWeight + lvp.intercept) + velocityDiff;

  // 目標達成に必要な速度（MVT + 余裕）
  const requiredVelocity = mvt + 0.02;

  // 達成可能か
  const readyForPR = predictedVelocityAtTarget >= requiredVelocity;

  // 進捗パーセンテージ
  const progressToGoal = Math.min(
    100,
    Math.max(0, ((predictedVelocityAtTarget - mvt) / (requiredVelocity - mvt)) * 100)
  );

  return {
    currentWeight,
    currentVelocity,
    predictedVelocityAtTarget,
    progressToGoal: Math.round(progressToGoal),
    readyForPR,
  };
}

/**
 * Generate personalized advice based on challenge data
 */
function generateAdvice(data: {
  targetWeight: number;
  currentWeight: number;
  currentVelocity: number;
  predictedVelocityAtTarget: number;
  requiredVelocityAtCurrentWeight: number;
  velocityGap: number;
  readyForPR: boolean;
  mvt: number;
}): string {
  if (data.readyForPR) {
    return `${data.currentWeight}kgで${data.currentVelocity.toFixed(2)}m/s出ています。` +
           `この調子なら${data.targetWeight}kgのPR達成可能です！` +
           `目標重量での予想速度は${data.predictedVelocityAtTarget.toFixed(2)}m/sで、` +
           `限界速度(${data.mvt.toFixed(2)}m/s)を上回る見込みです。`;
  } else {
    return `${data.currentWeight}kgで${data.currentVelocity.toFixed(2)}m/s出ていますが、` +
           `PR達成には${data.requiredVelocityAtCurrentWeight.toFixed(2)}m/sが必要です。` +
           `あと${Math.abs(data.velocityGap).toFixed(2)}m/s速くする必要があります。` +
           `目標重量での予想速度は${data.predictedVelocityAtTarget.toFixed(2)}m/sで、` +
           `限界速度(${data.mvt.toFixed(2)}m/s)に届きません。`;
  }
}

/**
 * Generate general advice without current performance data
 */
function generateGeneralAdvice(data: {
  targetWeight: number;
  predictedVelocityAtTarget: number;
  isAchievable: boolean;
  mvt: number;
  confidence: string;
}): string {
  if (data.isAchievable) {
    return `${data.targetWeight}kgでの予想速度は${data.predictedVelocityAtTarget.toFixed(2)}m/sで、` +
           `限界速度(${data.mvt.toFixed(2)}m/s)を上回る見込みです。` +
           `信頼度${data.confidence}で達成可能と推定されます。` +
           `当日の調子を確認してから挑戦しましょう。`;
  } else {
    return `${data.targetWeight}kgでの予想速度は${data.predictedVelocityAtTarget.toFixed(2)}m/sで、` +
           `限界速度(${data.mvt.toFixed(2)}m/s)を下回る見込みです。` +
           `現在のプロファイルでは達成困難です。` +
           `まずは lighter weights で速度を向上させるトレーニングを続けましょう。`;
  }
}

/**
 * Generate actionable recommendation
 */
function generateRecommendation(data: {
  readyForPR: boolean;
  confidence: string;
  velocityGap?: number;
  isAchievable: boolean;
}): string {
  if (data.readyForPR && data.confidence === 'high') {
    return '✅ 準備万端！挑戦するなら今日がおすすめです。';
  } else if (data.readyForPR && data.confidence === 'medium') {
    return '⚡ 調子は良いです。万全の準備で挑戦しましょう。';
  } else if (!data.readyForPR && data.velocityGap && data.velocityGap > -0.05) {
    return '🔄 あと少しです。ウォームアップを丁寧に行い、もう一度速度を確認しましょう。';
  } else if (!data.readyForPR) {
    return '💪 今日は基礎トレーニングに集中しましょう。PR挑戦はまたの機会に。';
  } else {
    return 'ℹ️ ウォームアップで今日の調子を確認してから決めましょう。';
  }
}
