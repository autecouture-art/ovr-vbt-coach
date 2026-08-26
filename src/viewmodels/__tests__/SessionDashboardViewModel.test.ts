/**
 * Tests for SessionDashboardViewModel
 */

import { describe, it, expect } from "vitest";
import {
  formatLiveData,
  formatDecisionData,
  formatSetList,
  formatDashboardData,
  formatSetCardLines,
  adjustLoad,
  adjustReps,
  formatVelocity,
  formatVelocityLoss,
  formatLoad,
  formatHeartRate,
  formatRestTime,
  getConnectionStatus,
  getHeartRateStatus,
  getVideoStatus,
} from "../SessionDashboardViewModel";
import type { SessionDecision } from "@/src/services/SessionDecisionService";
import { GarageTheme } from "../../constants/garageTheme";

describe("SessionDashboardViewModel", () => {
  describe("formatLiveData", () => {
    it("should format live data correctly", () => {
      const input = {
        currentLoad: 100.0,
        currentReps: 5,
        plannedSetCount: 3,
        plannedRpe: 8.0,
        setHistory: [
          {
            session_id: "test",
            lift: "SQ",
            set_index: 1,
            load_kg: 100.0,
            reps: 5,
            device_type: "VBT" as const,
            set_type: "normal" as const,
            avg_velocity: 0.55,
            velocity_loss: 15.5,
            velocity_loss_last: 15.5,
            avg_rom_cm: 45.0,
            timestamp: new Date().toISOString(),
          },
        ],
        currentHeartRate: 110,
        restStartTime: Date.now() - 60000, // 1 minute ago
        isConnected: true,
        isVideoRecording: false,
      };

      const result = formatLiveData(input);

      expect(result.currentLoad).toBe(100.0);
      expect(result.currentReps).toBe(5);
      expect(result.plannedSetCount).toBe(3);
      expect(result.plannedRpe).toBe(8.0);
      expect(result.latestSet.avgVelocity).toBe(0.55);
      expect(result.latestSet.velocityLossLast).toBe(15.5);
      expect(result.latestSet.rom).toBe(45.0);
      expect(result.currentHeartRate).toBe(110);
      expect(result.restDurationSeconds).toBeGreaterThanOrEqual(59);
      expect(result.restDurationSeconds).toBeLessThanOrEqual(61);
      expect(result.isConnected).toBe(true);
      expect(result.isVideoRecording).toBe(false);
    });

    it("should handle empty set history", () => {
      const input = {
        currentLoad: 100.0,
        currentReps: 5,
        plannedSetCount: 3,
        plannedRpe: 8.0,
        setHistory: [],
        currentHeartRate: null,
        restStartTime: null,
        isConnected: false,
        isVideoRecording: false,
      };

      const result = formatLiveData(input);

      expect(result.latestSet.avgVelocity).toBeNull();
      expect(result.latestSet.velocityLossLast).toBeNull();
      expect(result.latestSet.rom).toBeNull();
      expect(result.currentHeartRate).toBeNull();
      expect(result.restDurationSeconds).toBe(0);
    });
  });

  describe("formatDecisionData", () => {
    it("should format decision data correctly", () => {
      const decision: SessionDecision = {
        allSetAvgAV: 0.55,
        workingSetAvgAV: 0.52,
        recent3WorkingSetAvgAV: 0.51,
        bestWorkingAV: 0.60,
        sameLoadAVDropPct: 5.0,
        baselineROM: 45.0,
        latestROM: 44.0,
        romDiff: -1.0,
        avgHrTo120All: 45.0,
        avgHrTo120Working: 42.0,
        hrDataReliability: "good",
        fatigueStatus: "good",
        formStatus: "good",
        hrRecoveryStatus: "good",
        prStatus: "baseline",
        confidence: "high",
        recommendedNextLoad: 102.5,
        recommendedNextReps: 5,
        recommendedRestMin: 3,
        waitUntilHRBelow: 120,
        candidateSource: "applied_supervisor_row",
        plannedRowId: "row-123",
        sessionTerminationLevel: "planned_accessory_only",
        sessionTerminationLabel: "予定補助まで可",
        exerciseTerminationLevel: "continue_current_exercise",
        exerciseTerminationLabel: "現在種目継続",
        allowLightFullBodyAccessory: false,
        shouldSuggestAdditionalLoad: true,
        nextSetQualityGoal: null,
        roundingIncrementKg: 2.5,
        romMeasurementSuspect: false,
        romChangePct: -2.2,
        romExcludedDecisionText: null,
        heavyExposureSingle: null,
        reasonBullets: ["良好な速度低下", "ROM安定"],
        passCriteria: ["VL < 20%", "ROM変化 < 5%"],
        stopCriteria: ["VL > 30%", "ROM変化 > 10%"],
        trendFlags: {
          sameLoadAVDrop: false,
          romDrop: false,
          hrHigh: false,
          hrRecoveryDelayed: false,
          vlHigh: false,
          vlMinHigh: false,
          speedWorkVl10Stop: false,
          e1RMDrop: false,
          possibleTechniqueFatigue: false,
        },
        workingSets: [],
        sameLoadTrendText: "test",
        romTrendText: "test",
        hrTo120TrendText: "test",
        e1rmTrendText: "test",
      };

      const result = formatDecisionData(decision);

      expect(result.recommendedLoad).toBe(102.5);
      expect(result.recommendedReps).toBe(5);
      expect(result.candidateSource).toBe("applied_supervisor_row");
      expect(result.plannedRowId).toBe("row-123");
      expect(result.recommendedRestMin).toBe(3);
      expect(result.waitUntilHRBelow).toBe(120);
      expect(result.reasonBullets).toEqual(["良好な速度低下", "ROM安定"]);
      expect(result.passCriteria).toEqual(["VL < 20%", "ROM変化 < 5%"]);
      expect(result.stopCriteria).toEqual(["VL > 30%", "ROM変化 > 10%"]);
      expect(result.fatigueStatus).toBe("good");
      expect(result.formStatus).toBe("good");
      expect(result.hrRecoveryStatus).toBe("good");
    });

    it("should handle null decision", () => {
      const result = formatDecisionData(null);

      expect(result.recommendedLoad).toBeNull();
      expect(result.recommendedReps).toBeNull();
      expect(result.candidateSource).toBeNull();
      expect(result.plannedRowId).toBeNull();
      expect(result.reasonBullets).toEqual([]);
      expect(result.passCriteria).toEqual([]);
      expect(result.stopCriteria).toEqual([]);
    });

    it("should limit reason bullets to 3", () => {
      const decision: SessionDecision = {
        // ... minimal required fields
        allSetAvgAV: null,
        workingSetAvgAV: null,
        recent3WorkingSetAvgAV: null,
        bestWorkingAV: null,
        sameLoadAVDropPct: null,
        baselineROM: null,
        latestROM: null,
        romDiff: null,
        avgHrTo120All: null,
        avgHrTo120Working: null,
        hrDataReliability: "missing",
        fatigueStatus: "good",
        formStatus: "unknown",
        hrRecoveryStatus: "good",
        prStatus: "baseline",
        confidence: "low",
        recommendedNextLoad: null,
        recommendedNextReps: null,
        recommendedRestMin: null,
        waitUntilHRBelow: null,
        candidateSource: "fallback_algorithmic_candidate",
        plannedRowId: null,
        sessionTerminationLevel: "planned_accessory_only",
        sessionTerminationLabel: "予定補助まで可",
        exerciseTerminationLevel: "continue_current_exercise",
        exerciseTerminationLabel: "現在種目継続",
        allowLightFullBodyAccessory: false,
        shouldSuggestAdditionalLoad: false,
        nextSetQualityGoal: null,
        roundingIncrementKg: 2.5,
        romMeasurementSuspect: false,
        romChangePct: null,
        romExcludedDecisionText: null,
        heavyExposureSingle: null,
        reasonBullets: ["理由1", "理由2", "理由3", "理由4", "理由5"],
        passCriteria: [],
        stopCriteria: [],
        trendFlags: {
          sameLoadAVDrop: false,
          romDrop: false,
          hrHigh: false,
          hrRecoveryDelayed: false,
          vlHigh: false,
          vlMinHigh: false,
          speedWorkVl10Stop: false,
          e1RMDrop: false,
          possibleTechniqueFatigue: false,
        },
        workingSets: [],
        sameLoadTrendText: "test",
        romTrendText: "test",
        hrTo120TrendText: "test",
        e1rmTrendText: "test",
      };

      const result = formatDecisionData(decision);

      expect(result.reasonBullets).toHaveLength(3);
      expect(result.reasonBullets).toEqual(["理由1", "理由2", "理由3"]);
    });
  });

  describe("formatSetList", () => {
    it("should format set list correctly", () => {
      const setHistory = [
        {
          session_id: "test",
          lift: "SQ",
          set_index: 1,
          load_kg: 100.0,
          reps: 5,
          device_type: "VBT" as const,
          set_type: "normal" as const,
          avg_velocity: 0.55,
          velocity_loss: 15.5,
          avg_rom_cm: 45.0,
          timestamp: new Date().toISOString(),
        },
        {
          session_id: "test",
          lift: "SQ",
          set_index: 2,
          load_kg: 102.5,
          reps: 5,
          device_type: "VBT" as const,
          set_type: "normal" as const,
          avg_velocity: 0.52,
          velocity_loss: 18.0,
          avg_rom_cm: 44.0,
          timestamp: new Date().toISOString(),
        },
      ];

      const result = formatSetList(setHistory);

      expect(result).toHaveLength(2);
      expect(result[0].sessionId).toBe("test");
      expect(result[0].lift).toBe("SQ");
      expect(result[0].setIndex).toBe(1);
      expect(result[0].load).toBe(100.0);
      expect(result[0].reps).toBe(5);
      expect(result[0].avgVelocity).toBe(0.55);
      expect(result[0].velocityLoss).toBe(15.5);
      expect(result[0].rom).toBe(45.0);
      expect(result[0].isWarmup).toBe(false);

      expect(result[1].setIndex).toBe(2);
      expect(result[1].load).toBe(102.5);
    });

    it("should handle empty set history", () => {
      const result = formatSetList([]);
      expect(result).toEqual([]);
    });

    it("should preserve full identity for duplicate set indexes across lifts and sessions", () => {
      const setHistory = [
        {
          session_id: "session-a",
          lift: "Bench Press",
          set_index: 1,
          load_kg: 80,
          reps: 5,
          device_type: "VBT" as const,
          set_type: "normal" as const,
          avg_velocity: 0.5,
          velocity_loss: 10,
          avg_rom_cm: 20,
          timestamp: new Date().toISOString(),
        },
        {
          session_id: "session-a",
          lift: "Squat",
          set_index: 1,
          load_kg: 120,
          reps: 5,
          device_type: "VBT" as const,
          set_type: "normal" as const,
          avg_velocity: 0.4,
          velocity_loss: 12,
          avg_rom_cm: 30,
          timestamp: new Date().toISOString(),
        },
        {
          session_id: "session-b",
          lift: "Squat",
          set_index: 1,
          load_kg: 125,
          reps: 3,
          device_type: "VBT" as const,
          set_type: "normal" as const,
          avg_velocity: 0.35,
          velocity_loss: 14,
          avg_rom_cm: 29,
          timestamp: new Date().toISOString(),
        },
      ];

      const result = formatSetList(setHistory);

      expect(result.map((item) => `${item.sessionId}:${item.lift}:${item.setIndex}`)).toEqual([
        "session-a:Bench Press:1",
        "session-a:Squat:1",
        "session-b:Squat:1",
      ]);
    });

    it("should format compact set card lines without losing identity or placeholders", () => {
      expect(
        formatSetCardLines(
          {
            sessionId: "session-1",
            lift: "Tempo Bench Press With Very Long Name",
            setIndex: 6,
            load: 82.5,
            reps: 5,
            avgVelocity: 0.42,
            velocityLoss: 18.4,
            rom: 36.7,
            isWarmup: true,
          },
          true,
        ),
      ).toEqual({
        lift: "Tempo Bench Press With Very Long Name",
        setLabel: "#6",
        loadAndReps: "82.50 kg x 5",
        metrics: "AV 0.42  VL 18.4%  ROM 36.7",
      });

      expect(
        formatSetCardLines(
          {
            sessionId: "session-2",
            lift: "Squat",
            setIndex: 1,
            load: 100,
            reps: 3,
            avgVelocity: null,
            velocityLoss: null,
            rom: null,
            isWarmup: false,
          },
          true,
        ).metrics,
      ).toBe("AV --  VL --  ROM --");
    });
  });

  describe("formatDashboardData", () => {
    it("should format complete dashboard data", () => {
      const input = {
        currentLoad: 100.0,
        currentReps: 5,
        plannedSetCount: 3,
        plannedRpe: 8.0,
        setHistory: [
          {
            session_id: "test",
            lift: "SQ",
            set_index: 1,
            load_kg: 100.0,
            reps: 5,
            device_type: "VBT" as const,
            set_type: "normal" as const,
            avg_velocity: 0.55,
            velocity_loss: 15.5,
            velocity_loss_last: 15.5,
            avg_rom_cm: 45.0,
            timestamp: new Date().toISOString(),
          },
        ],
        currentHeartRate: 110,
        restStartTime: Date.now() - 60000,
        isConnected: true,
        isVideoRecording: false,
        decision: null,
      };

      const result = formatDashboardData(input);

      expect(result).toHaveProperty("live");
      expect(result).toHaveProperty("decision");
      expect(result).toHaveProperty("sets");
      expect(result.live.currentLoad).toBe(100.0);
      expect(result.sets).toHaveLength(1);
    });
  });

  describe("adjustLoad", () => {
    it("should increase load by 2.5kg", () => {
      expect(adjustLoad(100.0, "up")).toBe(102.5);
    });

    it("should decrease load by 2.5kg", () => {
      expect(adjustLoad(100.0, "down")).toBe(97.5);
    });

    it("should not decrease below 0", () => {
      expect(adjustLoad(2.0, "down")).toBe(0);
    });

    it("should handle decimal correctly", () => {
      expect(adjustLoad(101.5, "up")).toBe(104.0);
    });
  });

  describe("adjustReps", () => {
    it("should increase reps by 1", () => {
      expect(adjustReps(5, "up")).toBe(6);
    });

    it("should decrease reps by 1", () => {
      expect(adjustReps(5, "down")).toBe(4);
    });

    it("should not decrease below 1", () => {
      expect(adjustReps(1, "down")).toBe(1);
    });
  });

  describe("formatVelocity", () => {
    it("should format velocity correctly", () => {
      expect(formatVelocity(0.55)).toBe("0.55");
      expect(formatVelocity(1.0)).toBe("1.00");
    });

    it("should handle null", () => {
      expect(formatVelocity(null)).toBe("--");
      expect(formatVelocity(undefined)).toBe("--");
    });
  });

  describe("formatVelocityLoss", () => {
    it("should format velocity loss correctly", () => {
      expect(formatVelocityLoss(15.5)).toBe("15.5%");
      expect(formatVelocityLoss(20.0)).toBe("20.0%");
    });

    it("should handle null", () => {
      expect(formatVelocityLoss(null)).toBe("--");
    });
  });

  describe("formatLoad", () => {
    it("should format metric load correctly", () => {
      expect(formatLoad(100.0, true)).toBe("100.00 kg");
      expect(formatLoad(102.5, true)).toBe("102.50 kg");
    });

    it("should format imperial load correctly", () => {
      expect(formatLoad(100.0, false)).toContain("lbs");
      // 100 kg ≈ 220.5 lbs
      expect(formatLoad(100.0, false)).toBe("220.46 lbs");
    });
  });

  describe("formatHeartRate", () => {
    it("should format heart rate correctly", () => {
      expect(formatHeartRate(110)).toBe("110 bpm");
      expect(formatHeartRate(120)).toBe("120 bpm");
    });

    it("should handle null", () => {
      expect(formatHeartRate(null)).toBe("--");
    });
  });

  describe("formatRestTime", () => {
    it("should format rest time correctly", () => {
      expect(formatRestTime(0)).toBe("0:00");
      expect(formatRestTime(59)).toBe("0:59");
      expect(formatRestTime(60)).toBe("1:00");
      expect(formatRestTime(90)).toBe("1:30");
      expect(formatRestTime(369)).toBe("6:09");
    });
  });

  describe("getConnectionStatus", () => {
    it("should return connected status", () => {
      const result = getConnectionStatus(true);
      expect(result.text).toBe("接続中");
      expect(result.color).toBe(GarageTheme.success);
    });

    it("should return disconnected status", () => {
      const result = getConnectionStatus(false);
      expect(result.text).toBe("未接続");
      expect(result.color).toBe(GarageTheme.danger);
    });
  });

  describe("getHeartRateStatus", () => {
    it("should return high status for >= 120 bpm", () => {
      const result = getHeartRateStatus(120);
      expect(result.text).toBe("高");
      expect(result.color).toBe(GarageTheme.danger);
    });

    it("should return medium status for >= 100 bpm", () => {
      const result = getHeartRateStatus(110);
      expect(result.text).toBe("中");
      expect(result.color).toBe(GarageTheme.warning);
    });

    it("should return low status for < 100 bpm", () => {
      const result = getHeartRateStatus(90);
      expect(result.text).toBe("低");
      expect(result.color).toBe(GarageTheme.success);
    });

    it("should return unknown for null", () => {
      const result = getHeartRateStatus(null);
      expect(result.text).toBe("--");
      expect(result.color).toBe(GarageTheme.textMuted);
    });
  });

  describe("getVideoStatus", () => {
    it("should return recording status", () => {
      const result = getVideoStatus(true);
      expect(result.text).toBe("録画中");
      expect(result.color).toBe(GarageTheme.danger);
    });

    it("should return stopped status", () => {
      const result = getVideoStatus(false);
      expect(result.text).toBe("停止");
      expect(result.color).toBe(GarageTheme.textMuted);
    });
  });
});
