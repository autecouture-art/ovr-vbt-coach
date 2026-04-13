/**
 * OneRM Calculator - 4-Point Method
 * 1RM推定を4点法ベースで行い、信頼度を返す
 */

import type { SetData, RepData } from '../types/index';

export interface FourPointEstimate {
  estimated1RM: number;
  confidence: 'high' | 'medium' | 'low';
  rSquared: number;
  sampleCount: number;
  method: 'four_point' | 'historical_fallback' | 'insufficient_data';
  dataPoints: Array<{ load: number; velocity: number }>;
}

export interface VelocityAtLoad {
  load: number;
  meanVelocity: number;
  repCount: number;
}

/**
 * Extract velocity data points from current session
 * Groups reps by load and calculates average velocity
 */
function extractSessionVelocityPoints(
  sets: SetData[],
  allReps: RepData[]
): VelocityAtLoad[] {
  const loadMap = new Map<number, { velocities: number[]; totalReps: number }>();

  for (const set of sets) {
    const setReps = allReps.filter(
      r => r.session_id === set.session_id &&
           r.lift === set.lift &&
           r.set_index === set.set_index &&
           r.is_valid_rep &&
           !r.is_excluded &&
           !r.is_failed &&
           r.mean_velocity !== null
    );

    if (setReps.length === 0) continue;

    const existing = loadMap.get(set.load_kg) ?? { velocities: [], totalReps: 0 };
    const avgVel = setReps.reduce((sum, r) => sum + r.mean_velocity!, 0) / setReps.length;
    existing.velocities.push(avgVel);
    existing.totalReps += setReps.length;
    loadMap.set(set.load_kg, existing);
  }

  return Array.from(loadMap.entries()).map(([load, data]) => ({
    load,
    meanVelocity: data.velocities.reduce((a, b) => a + b, 0) / data.velocities.length,
    repCount: data.totalReps,
  })).sort((a, b) => a.load - b.load);
}

/**
 * Perform linear regression on load-velocity data
 */
function linearRegression(dataPoints: Array<{ load: number; velocity: number }>): {
  slope: number;
  intercept: number;
  rSquared: number;
} | null {
  const n = dataPoints.length;
  if (n < 2) return null;

  const sumX = dataPoints.reduce((sum, p) => sum + p.load, 0);
  const sumY = dataPoints.reduce((sum, p) => sum + p.velocity, 0);
  const sumXY = dataPoints.reduce((sum, p) => sum + p.load * p.velocity, 0);
  const sumXX = dataPoints.reduce((sum, p) => sum + p.load * p.load, 0);

  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return null;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  // Calculate R-squared
  const meanY = sumY / n;
  const ssTotal = dataPoints.reduce((sum, p) => sum + Math.pow(p.velocity - meanY, 2), 0);
  const ssResidual = dataPoints.reduce(
    (sum, p) => sum + Math.pow(p.velocity - (slope * p.load + intercept), 2),
    0
  );
  const rSquared = ssTotal > 0 ? 1 - ssResidual / ssTotal : 0;

  return { slope, intercept, rSquared };
}

/**
 * Estimate 1RM using 4-point method from current session
 * Falls back to historical data if insufficient points
 */
export async function estimate1RMFourPoint(
  lift: string,
  currentSets: SetData[],
  currentReps: RepData[],
  mvt: number = 0.15,
  historicalFallback?: () => Promise<Array<{ load: number; velocity: number }>>
): Promise<FourPointEstimate> {
  // Extract current session data points
  const sessionPoints = extractSessionVelocityPoints(currentSets, currentReps);

  // Need at least 2 different loads for any estimation
  if (sessionPoints.length < 2) {
    return {
      estimated1RM: 0,
      confidence: 'low',
      rSquared: 0,
      sampleCount: 0,
      method: 'insufficient_data',
      dataPoints: [],
    };
  }

  // Use 4-point method: take up to 4 evenly distributed loads
  let selectedPoints = sessionPoints;
  if (sessionPoints.length > 4) {
    // Select points to spread across load range
    const indices = [
      0,
      Math.floor(sessionPoints.length / 3),
      Math.floor(2 * sessionPoints.length / 3),
      sessionPoints.length - 1
    ];
    selectedPoints = indices.map(i => sessionPoints[i]);
  }

  // Convert VelocityAtLoad to { load: number; velocity: number } for regression
  const dataPoints = selectedPoints.map(p => ({
    load: p.load,
    velocity: p.meanVelocity
  }));

  const regression = linearRegression(dataPoints);
  if (!regression || regression.slope >= 0) {
    // Invalid regression (slope should be negative for LVP)
    return {
      estimated1RM: 0,
      confidence: 'low',
      rSquared: 0,
      sampleCount: dataPoints.length,
      method: 'insufficient_data',
      dataPoints: dataPoints,
    };
  }

  // Calculate 1RM using MVT: 1RM = (MVT - intercept) / slope
  const estimated1RM = Math.max(0, (mvt - regression.intercept) / regression.slope);

  // Determine confidence based on R² and sample count
  let confidence: 'high' | 'medium' | 'low';
  if (dataPoints.length >= 4 && regression.rSquared >= 0.95) {
    confidence = 'high';
  } else if (dataPoints.length >= 3 && regression.rSquared >= 0.85) {
    confidence = 'medium';
  } else {
    confidence = 'low';
  }

  // Try historical fallback if confidence is low
  if (confidence === 'low' && historicalFallback) {
    try {
      const historicalPoints = await historicalFallback();
      if (historicalPoints.length >= 3) {
        const combinedPoints = [...dataPoints, ...historicalPoints.slice(0, 4)];
        // Remove duplicates by load
        const uniquePoints = Array.from(
          new Map(combinedPoints.map(p => [p.load, p])).values()
        );

        if (uniquePoints.length >= 4) {
          const historicalRegression = linearRegression(uniquePoints);
          if (historicalRegression && historicalRegression.slope < 0) {
            const historicalEstimate = Math.max(0, (mvt - historicalRegression.intercept) / historicalRegression.slope);
            return {
              estimated1RM: Math.round(historicalEstimate * 10) / 10,
              confidence: historicalRegression.rSquared >= 0.9 ? 'medium' : 'low',
              rSquared: Math.round(historicalRegression.rSquared * 1000) / 1000,
              sampleCount: uniquePoints.length,
              method: 'historical_fallback',
              dataPoints: uniquePoints,
            };
          }
        }
      }
    } catch {
      // Historical fallback failed, continue with current session estimate
    }
  }

  return {
    estimated1RM: Math.round(estimated1RM * 10) / 10,
    confidence,
    rSquared: Math.round(regression.rSquared * 1000) / 1000,
    sampleCount: dataPoints.length,
    method: dataPoints.length >= 4 ? 'four_point' : 'historical_fallback',
    dataPoints: dataPoints,
  };
}

export default { estimate1RMFourPoint };
