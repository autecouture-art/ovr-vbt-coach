/**
 * RPE Calculator based on velocity loss and rep count
 * 速度低下に基づくRPE推定
 *
 * RPE Scale: 6-10 (not 1-10 as traditional RPE uses lower numbers for warmups)
 * - RPE 6: Light, could do 4+ more reps
 * - RPE 7: Moderate, could do 3 more reps
 * - RPE 8: Heavy, could do 2 more reps
 * - RPE 9: Very heavy, could do 1 more rep
 * - RPE 10: Maximum effort, no reps left
 */

export interface RPEEstimate {
  rpe: number;
  confidence: 'high' | 'medium' | 'low';
  repsInReserve: number;
  reason: string;
}

/**
 * Estimate RPE from velocity loss percentage and rep count
 *
 * @param velocityLossPercent - Velocity loss from first to last rep (0-100)
 * @param repCount - Number of reps performed
 * @param targetReps - Optional target reps for context
 * @returns RPE estimate with confidence
 */
export function estimateRPEFromVelocityLoss(
  velocityLossPercent: number,
  repCount: number,
  targetReps?: number
): RPEEstimate {
  // Guard: need at least 3 reps for reliable VL measurement
  if (repCount < 3) {
    return {
      rpe: 6 + Math.min(repCount, 4),
      confidence: 'low',
      repsInReserve: 4 - repCount,
      reason: 'レップ数が少ないため、推定の信頼性は低いです',
    };
  }

  // Guard: invalid velocity loss
  if (velocityLossPercent < 0 || velocityLossPercent > 100) {
    return {
      rpe: 6,
      confidence: 'low',
      repsInReserve: 4,
      reason: '速度低下データが無効です',
    };
  }

  // Research-based velocity loss to RPE mapping
  // Gonzalez-Badillo et al. (2017): VL% vs RPE relationship
  let rpe: number;
  let repsInReserve: number;
  let confidence: 'high' | 'medium' | 'low';

  if (velocityLossPercent < 5) {
    // Very little fatigue - still have plenty in reserve
    rpe = 6;
    repsInReserve = 4;
    confidence = repCount >= 5 ? 'high' : 'medium';
  } else if (velocityLossPercent < 10) {
    rpe = 7;
    repsInReserve = 3;
    confidence = repCount >= 5 ? 'high' : 'medium';
  } else if (velocityLossPercent < 15) {
    rpe = 7.5;
    repsInReserve = 2.5;
    confidence = 'high';
  } else if (velocityLossPercent < 20) {
    rpe = 8;
    repsInReserve = 2;
    confidence = 'high';
  } else if (velocityLossPercent < 25) {
    rpe = 8.5;
    repsInReserve = 1.5;
    confidence = 'high';
  } else if (velocityLossPercent < 30) {
    rpe = 9;
    repsInReserve = 1;
    confidence = 'high';
  } else if (velocityLossPercent < 40) {
    rpe = 9.5;
    repsInReserve = 0.5;
    confidence = 'high';
  } else {
    // Significant velocity loss - likely at failure
    rpe = 10;
    repsInReserve = 0;
    confidence = 'high';
  }

  // Adjust based on whether target reps were reached
  if (targetReps && repCount < targetReps) {
    // Failed to reach target reps - increase RPE
    const shortfallRatio = (targetReps - repCount) / targetReps;
    rpe = Math.min(10, rpe + shortfallRatio * 2);
    repsInReserve = Math.max(0, repsInReserve - shortfallRatio * 2);
    confidence = 'medium';
  }

  // Generate reason text
  const reason = generateRPEReason(velocityLossPercent, rpe, repCount);

  return {
    rpe: Math.round(rpe * 10) / 10,
    confidence,
    repsInReserve: Math.round(repsInReserve * 10) / 10,
    reason,
  };
}

/**
 * Estimate RPE from mean velocity using LVP
 * Alternative method when velocity loss is not available
 */
export function estimateRPEFromMeanVelocity(
  meanVelocity: number,
  exerciseMVT: number,
  repCount: number
): RPEEstimate {
  if (!exerciseMVT || exerciseMVT <= 0) {
    return {
      rpe: 7,
      confidence: 'low',
      repsInReserve: 2,
      reason: '種目のMVTが設定されていません',
    };
  }

  // Calculate how close to MVT (failure velocity)
  const velocityRatio = meanVelocity / exerciseMVT;

  let rpe: number;
  let repsInReserve: number;

  if (velocityRatio > 2.0) {
    // Very fast relative to MVT - light load
    rpe = 6;
    repsInReserve = 4;
  } else if (velocityRatio > 1.5) {
    rpe = 7;
    repsInReserve = 3;
  } else if (velocityRatio > 1.2) {
    rpe = 7.5;
    repsInReserve = 2.5;
  } else if (velocityRatio > 1.0) {
    rpe = 8;
    repsInReserve = 2;
  } else if (velocityRatio > 0.9) {
    rpe = 8.5;
    repsInReserve = 1.5;
  } else if (velocityRatio > 0.8) {
    rpe = 9;
    repsInReserve = 1;
  } else if (velocityRatio > 0.7) {
    rpe = 9.5;
    repsInReserve = 0.5;
  } else {
    // At or below MVT - at failure
    rpe = 10;
    repsInReserve = 0;
  }

  return {
    rpe: Math.round(rpe * 10) / 10,
    confidence: repCount >= 5 ? 'high' : 'medium',
    repsInReserve: Math.round(repsInReserve * 10) / 10,
    reason: `平均速度 ${meanVelocity.toFixed(2)} m/s (MVT: ${exerciseMVT.toFixed(2)} m/s)`,
  };
}

function generateRPEReason(velocityLoss: number, rpe: number, repCount: number): string {
  const vlText = `速度低下: ${velocityLoss.toFixed(1)}%`;

  if (rpe <= 6) {
    return `${vlText} - 軽め、余力あり`;
  } else if (rpe <= 7) {
    return `${vlText} - 中程度、あと3レップ可能`;
  } else if (rpe <= 8) {
    return `${vlText} - きつめ、あと2レップ可能`;
  } else if (rpe <= 9) {
    return `${vlText} - かなりきつい、あと1レップ可能`;
  } else if (rpe < 10) {
    return `${vlText} - ほぼ限界、ほぼ余力なし`;
  } else {
    return `${vlText} - 限界、失敗`;
  }
}

export default {
  estimateRPEFromVelocityLoss,
  estimateRPEFromMeanVelocity,
};
