/**
 * VBT Logic Service
 * The "Brain" of the application - handles all VBT calculations and analytics
 */

import type { PRRecord, PRType } from '../types/index';

export class VBTLogic {
  static calculateVelocityLoss(targetVelocity: number, currentVelocity: number): number {
    if (targetVelocity <= 0) return 0;
    const loss = ((targetVelocity - currentVelocity) / targetVelocity) * 100;
    return Math.max(0, parseFloat(loss.toFixed(1)));
  }

  static calculateE1RM(load: number, reps: number): number | null {
    if (load <= 0 || reps <= 0) return null;
    if (reps === 1) return load;
    const e1rm = load * (1 + reps / 30);
    return Math.round(e1rm * 10) / 10;
  }

  static calculatePower(loadKg: number, velocity: number): number {
    const gravity = 9.81;
    return Math.round(loadKg * gravity * velocity);
  }

  static checkPR(
    currentVal: number,
    prRecords: PRRecord[],
    type: PRType,
    lift: string
  ): PRRecord | null {
    const existingPR = prRecords.find((pr) => pr.lift === lift && pr.type === type);
    if (!existingPR) return null;
    if (currentVal > existingPR.value) {
      const improvement = currentVal - existingPR.value;
      return {
        id: Date.now().toString(),
        type,
        lift,
        value: currentVal,
        date: new Date().toISOString(),
        previous_value: existingPR.value,
        improvement,
      };
    }
    return null;
  }

  static calculateReadiness(warmUpVelocity: number, historicalVelocity: number): number {
    if (historicalVelocity <= 0) return 0;
    const diff = ((warmUpVelocity - historicalVelocity) / historicalVelocity) * 100;
    return parseFloat(diff.toFixed(1));
  }
}
