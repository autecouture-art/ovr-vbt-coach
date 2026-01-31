/**
 * VBT Calculations Module
 * Core logic for Velocity-Based Training calculations
 */

import type { RepData, LVPData, VelocityZone } from '../types/index';

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
 * Calculate Velocity Loss for a set
 * VL = (best_velocity - avg_velocity) / best_velocity * 100
 */
export function calculateVelocityLoss(reps: RepData[]): number | null {
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
 * Estimate 1RM using Load-Velocity Profile
 * Formula: 1RM = (v1rm - intercept) / slope
 */
export function estimate1RM(
  meanVelocity: number,
  loadKg: number,
  lvpData: LVPData
): number | null {
  try {
    // Linear regression: velocity = slope * load + intercept
    // Rearranged: load = (velocity - intercept) / slope

    // Use the velocity at 1RM (v1rm) to calculate estimated 1RM
    const estimated1RM = (lvpData.v1rm - lvpData.intercept) / lvpData.slope;

    // Also calculate based on current velocity
    const currentLoad1RM = (meanVelocity - lvpData.intercept) / lvpData.slope;

    // Scale based on the current performance
    const velocityRatio = meanVelocity / lvpData.v1rm;
    const adjusted1RM = currentLoad1RM * velocityRatio;

    return Math.round(adjusted1RM * 10) / 10; // Round to 1 decimal place
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
  dataPoints: Array<{ load: number; velocity: number }>
): LVPData | null {
  if (dataPoints.length < 3) return null; // Need at least 3 points

  const n = dataPoints.length;
  const sumX = dataPoints.reduce((sum, p) => sum + p.load, 0);
  const sumY = dataPoints.reduce((sum, p) => sum + p.velocity, 0);
  const sumXY = dataPoints.reduce((sum, p) => sum + p.load * p.velocity, 0);
  const sumXX = dataPoints.reduce((sum, p) => sum + p.load * p.load, 0);
  const sumYY = dataPoints.reduce((sum, p) => sum + p.velocity * p.velocity, 0);

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
  const minLoad = Math.min(...dataPoints.map((p) => p.load));
  const vmax = slope * minLoad + intercept;

  // Estimate v1rm (velocity at 1RM) - typically around 0.15-0.30 m/s
  // This should be refined with actual 1RM data
  const v1rm = 0.2; // Default estimate

  return {
    lift: '', // To be filled by caller
    vmax,
    v1rm,
    slope,
    intercept,
    r_squared: Math.round(rSquared * 1000) / 1000,
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

export default {
  filterOutliers,
  calculateVelocityLoss,
  estimate1RM,
  estimate1RMFromReps,
  calculateLVP,
  getVelocityZone,
  calculateReadiness,
  calculateDropSetLoad,
  calculateVolume,
  checkForPR,
};
