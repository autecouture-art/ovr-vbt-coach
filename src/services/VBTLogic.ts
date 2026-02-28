/**
 * VBT Logic Service
 * The "Brain" of the application - handles all VBT calculations and analytics
 */

import type { RepVeloData, PRRecord } from '../types/index';

export class VBTLogic {
  /**
   * Calculate Velocity Loss
   * @param targetVelocity Target velocity (m/s) or Velocity of first rep
   * @param currentVelocity Current rep velocity (m/s)
   * @returns Velocity Loss percentage (0-100)
   */
  static calculateVelocityLoss(targetVelocity: number, currentVelocity: number): number {
    if (targetVelocity <= 0) return 0;
    const loss = ((targetVelocity - currentVelocity) / targetVelocity) * 100;
    return Math.max(0, parseFloat(loss.toFixed(1)));
  }

  /**
   * Calculate Estimated 1RM (e1RM) using Epley Formula
   * @param load Load in kg
   * @param reps Number of reps
   * @returns Estimated 1RM in kg
   */
  static calculateE1RM(load: number, reps: number): number {
    if (reps === 1) return load;
    // Epley Formula: 1RM = Weight * (1 + Reps/30)
    const e1rm = load * (1 + reps / 30);
    return Math.round(e1rm * 10) / 10; // Round to 1 decimal
  }

  /**
   * Calculate Power (Watts)
   * Simplified physics model: Power = Force * Velocity
   * Force = Mass * Acceleration (gravity + bar acceleration)
   * Assumption: Mean Force ≈ Mass * gravity (for standard lifts)
   * @param loadKg Load in kg
   * @param velocity Mean velocity in m/s
   * @returns Mean Power in Watts
   */
  static calculatePower(loadKg: number, velocity: number): number {
    const gravity = 9.81;
    // P = F * v = (m * g) * v
    const power = loadKg * gravity * velocity;
    return Math.round(power);
  }

  /**
   * Check for Personal Record (PR)
   * @param currentVal Current value (load, velocity, power)
   * @param prRecords History of PR records
   * @param type PR Type ('1rm', 'volume', 'velocity', 'power')
   * @param lift Lift name
   * @returns PRRecord if new PR, null otherwise
   */
  static checkPR(
    currentVal: number,
    prRecords: PRRecord[],
    type: '1rm' | 'volume' | 'velocity' | 'power',
    lift: string
  ): PRRecord | null {
    const existingPR = prRecords.find(pr => pr.lift === lift && pr.type === type);
    
    if (!existingPR || currentVal > existingPR.value) {
      const improvement = existingPR ? currentVal - existingPR.value : 0;
      return {
        id: Date.now().toString(),
        type,
        lift,
        value: currentVal,
        date: new Date().toISOString(),
        previous_value: existingPR?.value,
        improvement,
      };
    }
    return null;
  }

  /**
   * Assessment of Readiness based on Velocity
   * @param warmUpVelocity Current velocity at warm-up weight
   * @param historicalVelocity Historical average velocity at same weight
   * @returns Readiness score (-10% to +10% typical range)
   */
  static calculateReadiness(warmUpVelocity: number, historicalVelocity: number): number {
    if (historicalVelocity <= 0) return 0;
    const diff = ((warmUpVelocity - historicalVelocity) / historicalVelocity) * 100;
    return parseFloat(diff.toFixed(1));
  }
}
