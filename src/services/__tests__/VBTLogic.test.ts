/**
 * Unit Tests for VBTLogic
 * Ensures the "Brain" of the application is calculating correctly
 */

import { VBTLogic } from '../VBTLogic';

describe('VBTLogic', () => {
  describe('calculateVelocityLoss', () => {
    it('should calculate loss correctly', () => {
      // 1.0 -> 0.8 = 20% loss
      expect(VBTLogic.calculateVelocityLoss(1.0, 0.8)).toBe(20);
    });

    it('should return 0 if current velocity is higher (negative loss)', () => {
      // 1.0 -> 1.1 = -10% loss -> should be 0
      expect(VBTLogic.calculateVelocityLoss(1.0, 1.1)).toBe(0);
    });

    it('should handle 0 target velocity', () => {
      expect(VBTLogic.calculateVelocityLoss(0, 0.5)).toBe(0);
    });
  });

  describe('calculateE1RM (Epley)', () => {
    it('should return load for 1 rep', () => {
      expect(VBTLogic.calculateE1RM(100, 1)).toBe(100);
    });

    it('should calculate correct e1RM for 100kg x 10 reps', () => {
      // 100 * (1 + 10/30) = 100 * 1.333... = 133.3
      expect(VBTLogic.calculateE1RM(100, 10)).toBeCloseTo(133.3, 1);
    });
    
    it('should calculate correct e1RM for 60kg x 5 reps', () => {
        // 60 * (1 + 5/30) = 60 * 1.1666... = 70
        expect(VBTLogic.calculateE1RM(60, 5)).toBeCloseTo(70, 1);
      });
  });

  describe('calculatePower', () => {
    it('should calculate power correctly', () => {
      // 100kg * 9.81 * 1.0m/s = 981 Watts
      expect(VBTLogic.calculatePower(100, 1.0)).toBe(981);
    });

    it('should round result', () => {
      // 50kg * 9.81 * 0.5m/s = 245.25 -> 245
      expect(VBTLogic.calculatePower(50, 0.5)).toBe(245);
    });
  });

  describe('checkPR', () => {
    const mockRecords = [
      { id: '1', type: '1rm', lift: 'Bench Press', value: 100, date: '', improvement: 0 },
      { id: '2', type: 'velocity', lift: 'Bench Press', value: 0.5, load_kg: 100, date: '', improvement: 0 },
    ];

    it('should detect new PR', () => {
      const result = VBTLogic.checkPR(105, mockRecords as any, '1rm', 'Bench Press');
      expect(result).not.toBeNull();
      expect(result?.value).toBe(105);
      expect(result?.improvement).toBe(5);
    });

    it('should not return PR if value is lower', () => {
        const result = VBTLogic.checkPR(90, mockRecords as any, '1rm', 'Bench Press');
        expect(result).toBeNull();
    });

    it('should return PR if no previous record exists', () => {
        const result = VBTLogic.checkPR(100, [], '1rm', 'Squat');
        expect(result).not.toBeNull();
        expect(result?.previous_value).toBeUndefined();
    });
  });
});
