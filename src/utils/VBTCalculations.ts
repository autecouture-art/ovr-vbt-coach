/**
 * VBT Calculations Module
 * Core logic for Velocity-Based Training calculations
 */

import type { RepData, LVPData, VelocityZone, Exercise } from '../types/index';

/**
 * Calculate mean and standard deviation
 */
function calculateStats(values: number[]): { mean: number; std: number } {
  if (values.length === 0) return { mean: 0, std: 0 };

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const std = Math.sqrt(variance);

  return { mean, std };
}

/**
 * Filter outliers using ±2 standard deviations
 */
export function filterOutliers(reps: RepData[]): RepData[] {
  const velocities = reps
    .filter((rep) => rep.mean_velocity !== null)
    .map((rep) => rep.mean_velocity as number);

  if (velocities.length < 3) return reps; // Not enough data

  const { mean, std } = calculateStats(velocities);
  const lowerBound = mean - 2 * std;
  const upperBound = mean + 2 * std;

  return reps.map((rep) => {
    if (rep.mean_velocity === null) return rep;

    const isValid =
      rep.mean_velocity >= lowerBound && rep.mean_velocity <= upperBound;

    return {
      ...rep,
      is_valid_rep: isValid,
    };
  });
}

/**
 * Calculate Set Velocity Loss
 * Calculates velocity degradation from best rep to average velocity across entire set
 * This represents overall fatigue within the set
 * @param reps Array of rep data
 * @returns Velocity Loss percentage (0-100), or null if insufficient data
 *
 * Formula: VL = (best_velocity - avg_velocity) / best_velocity * 100
 */
export function calculateSetVelocityLoss(reps: RepData[]): number | null {
  const validReps = reps.filter((rep) => rep.is_valid_rep && rep.mean_velocity !== null);

  if (validReps.length < 2) return null;

  const velocities = validReps.map((rep) => rep.mean_velocity as number);
  const bestVelocity = Math.max(...velocities);
  const avgVelocity = velocities.reduce((sum, v) => sum + v, 0) / velocities.length;

  if (bestVelocity === 0) return null;

  const velocityLoss = ((bestVelocity - avgVelocity) / bestVelocity) * 100;
  return Math.round(velocityLoss * 100) / 100; // Round to 2 decimal places
}

/**
 * @deprecated Use calculateSetVelocityLoss for clarity
 * Calculate Velocity Loss (alias for backward compatibility)
 */
export function calculateVelocityLoss(reps: RepData[]): number | null {
  return calculateSetVelocityLoss(reps);
}

/**
 * Get velocity at 1RM from LVP data
 * MVT (measured minimum velocity threshold) takes priority over v1rm (theoretical value)
 * @param lvpData LVP profile data
 * @returns Velocity at 1RM (m/s)
 */
export function getVelocityAt1RM(lvpData: LVPData): number {
  // mvtが設定されている場合はmvtを優先（実際の測定値）、なければv1rm（理論値）
  return lvpData.mvt !== undefined && lvpData.mvt > 0 ? lvpData.mvt : lvpData.v1rm;
}

/**
 * Calculate 1RM using Epley formula with zero-rep guard
 * Returns null when reps <= 0 to prevent NaN propagation
 * @param load Load in kg
 * @param reps Number of reps
 * @returns Estimated 1RM in kg, or null if reps <= 0
 */
export function calculateE1RM(load: number, reps: number): number | null {
  if (reps <= 0 || load <= 0) return null;
  if (reps === 1) return load;
  // Epley Formula: 1RM = Weight * (1 + Reps/30)
  const e1rm = load * (1 + reps / 30);
  return Math.round(e1rm * 10) / 10; // Round to 1 decimal
}

/**
 * Estimate 1RM using Load-Velocity Profile
 * Formula: 1RM = (v1rm - intercept) / slope
 * Note: v1rmは理論上の1RM時の速度、mvtは実際に測定された限界速度
 * @deprecated Use getVelocityAt1RM for consistent velocity-at-1RM calculation
 */
export function estimate1RM(
  meanVelocity: number,
  loadKg: number,
  lvpData: LVPData
): number | null {
  try {
    // Linear regression: velocity = slope * load + intercept
    // Rearranged: load = (velocity - intercept) / slope

    // v1rm（理論上の1RM時の速度）を使用して1RMを計算
    // mvtが設定されている場合はmvtを優先（実際の測定値）
    const velocityAt1RM = getVelocityAt1RM(lvpData);
    const baseline1RM = (velocityAt1RM - lvpData.intercept) / lvpData.slope;

    return Math.round(baseline1RM * 10) / 10; // Round to 1 decimal place
  } catch (error) {
    console.error('Error calculating 1RM:', error);
    return null;
  }
}

/**
 * Estimate 1RM using Epley formula (for manual entry)
 * Formula: 1RM = weight * (1 + reps / 30)
 */
export function estimate1RMFromReps(weight: number, reps: number, rpe?: number): number {
  if (reps === 1) return weight;

  // Basic Epley formula
  let e1rm = weight * (1 + reps / 30);

  // Adjust based on RPE if provided
  if (rpe !== undefined && rpe >= 6 && rpe <= 10) {
    const rirEstimate = 10 - rpe; // Reps in reserve
    const totalReps = reps + rirEstimate;
    e1rm = weight * (1 + totalReps / 30);
  }

  return Math.round(e1rm * 10) / 10;
}

/**
 * Calculate Load-Velocity Profile from historical data
 * Returns slope and intercept for linear regression
 */
export function calculateLVP(
  dataPoints: Array<{ load: number; velocity: number }>,
  mvt: number = 0.2 // Default MVT if not provided
): LVPData | null {
  // Filter outliers using interquartile range (IQR) to make regression more robust
  if (dataPoints.length > 5) {
    const velocities = dataPoints.map(p => p.velocity).sort((a, b) => a - b);
    const q1 = velocities[Math.floor(velocities.length * 0.25)];
    const q3 = velocities[Math.floor(velocities.length * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    dataPoints = dataPoints.filter(p => p.velocity >= lowerBound && p.velocity <= upperBound);
  }

  if (dataPoints.length < 3) return null; // Need at least 3 valid points

  // Two-Point Method guard: Ensure sufficient load spread for accurate regression
  // If the load range is too narrow, the linear regression will be unreliable
  const loads = dataPoints.map(p => p.load);
  const minLoad = Math.min(...loads);
  const maxLoad = Math.max(...loads);
  const loadSpread = maxLoad - minLoad;

  // Minimum spread threshold: 20% of max load (e.g., at least 20kg spread for 100kg max)
  const minSpreadThreshold = maxLoad * 0.2;

  if (loadSpread <= minSpreadThreshold) {
    // Load spread is too narrow for reliable LVP regression
    return null;
  }

  const n = dataPoints.length;
  // Use weighted regression? For now, standard linear.
  const sumX = dataPoints.reduce((sum, p) => sum + p.load, 0);
  const sumY = dataPoints.reduce((sum, p) => sum + p.velocity, 0);
  const sumXY = dataPoints.reduce((sum, p) => sum + p.load * p.velocity, 0);
  const sumXX = dataPoints.reduce((sum, p) => sum + p.load * p.load, 0);

  // Linear regression: y = mx + b
  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared
  const meanY = sumY / n;
  const ssTotal = dataPoints.reduce((sum, p) => sum + Math.pow(p.velocity - meanY, 2), 0);
  const ssResidual = dataPoints.reduce(
    (sum, p) => sum + Math.pow(p.velocity - (slope * p.load + intercept), 2),
    0
  );
  const rSquared = 1 - ssResidual / ssTotal;

  // Find Vmax (velocity at minimal load)
  const vmax = slope * minLoad + intercept;

  // v1rm: 理論上の1RM時の速度（回帰式から算出）
  // mvt: 実際に測定された限界速度（引数で指定された値を使用）
  const v1rm = mvt;

  return {
    lift: '', // To be filled by caller
    vmax,
    v1rm,     // 理論上の1RM時の速度（回帰式の補正なし）
    mvt: v1rm,// 実際の測定値としてのMVT（引数で渡された値）
    slope,
    intercept,
    r_squared: Math.round(rSquared * 1000) / 1000,
    sample_count: n,
    last_updated: new Date().toISOString(),
  };
}

/**
 * Determine velocity zone based on mean velocity
 */
export function getVelocityZone(velocity: number): VelocityZone | null {
  const zones: VelocityZone[] = [
    {
      name: 'power',
      min_velocity: 1.0,
      max_velocity: 999,
      load_range: '<30% 1RM',
      color: '#FFD700', // Gold
    },
    {
      name: 'strength_speed',
      min_velocity: 0.75,
      max_velocity: 1.0,
      load_range: '30-60% 1RM',
      color: '#FF8C00', // Dark Orange
    },
    {
      name: 'hypertrophy',
      min_velocity: 0.5,
      max_velocity: 0.75,
      load_range: '60-80% 1RM',
      color: '#32CD32', // Lime Green
    },
    {
      name: 'strength',
      min_velocity: 0.0,
      max_velocity: 0.5,
      load_range: '>80% 1RM',
      color: '#DC143C', // Crimson
    },
  ];

  return zones.find((zone) => velocity >= zone.min_velocity && velocity < zone.max_velocity) || null;
}

/**
 * Calculate readiness (Delta V) from warm-up velocity
 * Positive delta = better than baseline
 * Negative delta = worse than baseline
 */
export function calculateReadiness(
  currentVelocity: number,
  baselineVelocity: number
): {
  deltaV: number;
  readinessLevel: 'excellent' | 'good' | 'normal' | 'fatigued';
  loadAdjustment: number;
} {
  const deltaV = currentVelocity - baselineVelocity;

  let readinessLevel: 'excellent' | 'good' | 'normal' | 'fatigued';
  let loadAdjustment: number;

  if (deltaV >= 0.05) {
    readinessLevel = 'excellent';
    loadAdjustment = 5; // +5%
  } else if (deltaV >= 0.0) {
    readinessLevel = 'good';
    loadAdjustment = 2.5; // +2.5%
  } else if (deltaV >= -0.05) {
    readinessLevel = 'normal';
    loadAdjustment = 0; // No change
  } else {
    readinessLevel = 'fatigued';
    loadAdjustment = -5; // -5%
  }

  return {
    deltaV: Math.round(deltaV * 1000) / 1000,
    readinessLevel,
    loadAdjustment,
  };
}

/**
 * Calculate recommended drop set load
 * Typically 15-25% reduction for hypertrophy
 */
export function calculateDropSetLoad(
  currentLoad: number,
  reductionPercent: number = 20
): number {
  const newLoad = currentLoad * (1 - reductionPercent / 100);

  // Round to nearest 2.5kg
  return Math.round(newLoad / 2.5) * 2.5;
}

/**
 * Calculate total volume for a session
 * Volume = load × reps
 */
export function calculateVolume(
  sets: Array<{ load_kg: number; reps: number }>
): number {
  return sets.reduce((total, set) => total + set.load_kg * set.reps, 0);
}

/**
 * Check if new PR (Personal Record) is achieved
 */
/**
 * CNS Fatigue Score calculation (CNS Battery™)
 * 推定される中枢神経系(CNS)の疲労度をスコア化 (0-100)
 * 基準: セッション開始時からの速度低下率に基づき算出
 */
export function calculateCNSFatigueScore(
  sessionSetHistory: any[]
): number {
  if (sessionSetHistory.length < 2) return 100;

  // 各セットの平均速度のトレンドを確認
  const velocities = sessionSetHistory
    .map(s => s.avg_velocity)
    .filter((v): v is number => v !== null);

  if (velocities.length < 2) return 100;

  const initialVel = velocities[0];
  const latestVel = velocities[velocities.length - 1];

  // 速度低下率を計算 (0-100%)
  const dropPercent = ((initialVel - latestVel) / initialVel) * 100;

  // 疲労スコアの算出 (例: 速度が20%低下したらスコア50、30%以上で危険域)
  // 論文知見: 10%低下までは正常範囲、20%以上は神経疲労を示唆
  let score = 100 - (dropPercent * 2);

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Intelligent 1RM Estimator (動的1RM予測)
 * その日の初動レップ（またはアップ）の速度から「本日予想1RM」を算出
 * mvtが設定されている場合はmvtを優先（実際の測定値）
 */
export function estimateCurrentDay1RM(
  load: number,
  velocity: number,
  lvpData: LVPData
): number {
  // 線形回帰式: load = (velocity - intercept) / slope
  // 本日の速度を LVP プロファイルに当てはめて、その日の調子を反映した 1RM を算出

  // mvtが設定されている場合はmvtを優先（実際の測定値）、なければv1rm（理論値）
  const velocityAt1RM = getVelocityAt1RM(lvpData);

  // 基準プロファイルでの 1RM
  const baseline1RM = (velocityAt1RM - lvpData.intercept) / lvpData.slope;

  // 現在の負荷における期待速度
  const expectedVelocity = (lvpData.slope * load) + lvpData.intercept;

  // 期待速度と実際の速度の差（Readiness）
  const velocityDiff = velocity - expectedVelocity;

  // 調子係数 (速度差 0.1 m/s = 約 5% の重量差)
  const readinessFactor = 1 + (velocityDiff * 0.5);

  const estimated1RM = baseline1RM * readinessFactor;

  return Math.round(estimated1RM * 10) / 10;
}

export function checkForPR(
  currentValue: number,
  previousBest: number | null,
  type: 'e1rm' | 'speed' | 'volume'
): { isPR: boolean; improvement: number } {
  if (previousBest === null) {
    return { isPR: true, improvement: currentValue };
  }

  const improvement = currentValue - previousBest;
  const isPR = improvement > 0;

  return {
    isPR,
    improvement: Math.round(improvement * 100) / 100,
  };
}

/**
 * 目安となる種目別ROM (cm)
 */
export function getExpectedROM(category: string): number {
  switch (category) {
    case 'squat': return 55;
    case 'bench': return 32;
    case 'deadlift': return 42;
    case 'press': return 34;
    case 'pull':
    case 'vertical_pull': return 36;
    case 'row': return 28;
    case 'single_leg': return 34;
    case 'quad': return 24;
    case 'hamstring': return 22;
    case 'adductor': return 20;
    case 'glute': return 26;
    case 'triceps':
    case 'biceps': return 20;
    case 'core': return 16;
    default: return 30;
  }
}

/**
 * 浅いROM（Short ROM）かどうかの判定
 */
export function isShortROM(rom_cm: number, exercise: Exercise): boolean {
  const expectedROM = getExpectedROM(exercise.category);
  // 期待されるROMの80%未満であれば短いと判定
  // マスタ設定のmin_romが極端に小さいノイズ除去用の場合は、期待値ベースにする
  const threshold = (exercise.min_rom_threshold && exercise.min_rom_threshold > 15)
    ? exercise.min_rom_threshold * 0.8
    : expectedROM * 0.8;

  return rom_cm < threshold;
}

/**
 * 高負荷レップの速度から新たなMVT(限界速度)を提案する
 * @param highLoadReps 0.05〜0.35m/s程度の有効な成功レップ群
 * @returns 安定していれば提案MVT値（number）、ばらつきが大きすぎるかデータ不足なら null
 */
export function proposeNewMVT(highLoadReps: RepData[]): number | null {
  if (highLoadReps.length < 3) return null; // データ不足

  // 速度昇順にソート（DB側でソート済みだが念のため）
  const velocities = highLoadReps.map(r => r.mean_velocity as number).sort((a, b) => a - b);

  // 外れ値を除外（IQRを使用）
  const q1 = velocities[Math.floor(velocities.length * 0.25)];
  const q3 = velocities[Math.floor(velocities.length * 0.75)];
  const iqr = q3 - q1;
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  const validVelocities = velocities.filter(v => v >= lowerBound && v <= upperBound);

  if (validVelocities.length < 3) return null;

  // ロバスト中央値を計算
  const mid = Math.floor(validVelocities.length / 2);
  const medianMVT = validVelocities.length % 2 !== 0
    ? validVelocities[mid]
    : (validVelocities[mid - 1] + validVelocities[mid]) / 2;

  // 変動幅（標準偏差）をチェック
  const { std } = calculateStats(validVelocities);

  // 標準偏差が 0.03 m/s 以内に収まっている場合のみ、「安定したMVT」とみなして提案
  if (std <= 0.03) {
    return Math.round(medianMVT * 100) / 100;
  }

  return null;
}

// Re-export new utility modules
export { estimate1RMFourPoint } from './OneRMCalculator';
export { estimateRPEFromVelocityLoss, estimateRPEFromMeanVelocity } from './RPECalculator';

export default {
  filterOutliers,
  calculateVelocityLoss,
  calculateSetVelocityLoss,
  estimate1RM,
  estimate1RMFromReps,
  calculateLVP,
  getVelocityZone,
  calculateReadiness,
  calculateDropSetLoad,
  calculateVolume,
  checkForPR,
  calculateCNSFatigueScore,
  estimateCurrentDay1RM,
  getExpectedROM,
  isShortROM,
  proposeNewMVT,
};
