import type { AppSettings, VelocityZone } from "../types/index";
import { getProtocolVelocityLossThreshold } from "../utils/PowerliftingVBTProtocol";
import { getDynamicVelocityZones } from "../utils/VelocityZones";

const VELOCITY_ZONES = {
  power: { min: 1.0, name: "POWER", emoji: "PWR", color: "#828fff" },
  strengthSpeed: {
    min: 0.75,
    name: "SPEED STRENGTH",
    emoji: "SPD",
    color: "#828fff",
  },
  hypertrophy: {
    min: 0.5,
    name: "HYPERTROPHY",
    emoji: "HYP",
    color: "#32CD32",
  },
  strength: { min: 0, name: "MAX STRENGTH", emoji: "MAX", color: "#DC143C" },
} as const;

export interface LoadSuggestion {
  suggestedLoad: number;
  reason: string;
  percentChange: number;
}

export class VBTGuideService {
  static getZone(
    velocity: number,
  ): (typeof VELOCITY_ZONES)[keyof typeof VELOCITY_ZONES] {
    if (velocity >= VELOCITY_ZONES.power.min) return VELOCITY_ZONES.power;
    if (velocity >= VELOCITY_ZONES.strengthSpeed.min) {
      return VELOCITY_ZONES.strengthSpeed;
    }
    if (velocity >= VELOCITY_ZONES.hypertrophy.min) {
      return VELOCITY_ZONES.hypertrophy;
    }
    return VELOCITY_ZONES.strength;
  }

  static async getDynamicZone(
    lift: string,
    velocity: number,
  ): Promise<VelocityZone> {
    try {
      const zones = await getDynamicVelocityZones(lift);
      for (const zone of zones) {
        if (velocity >= zone.min_velocity && velocity < zone.max_velocity) {
          return zone;
        }
      }
      return zones[zones.length - 1];
    } catch (error) {
      console.error("Failed to get dynamic zones, falling back to fixed:", error);
      const zone = this.getZone(velocity);
      const zoneNameMap: Record<
        string,
        "power" | "strength_speed" | "hypertrophy" | "strength"
      > = {
        POWER: "power",
        "SPEED STRENGTH": "strength_speed",
        HYPERTROPHY: "hypertrophy",
        "MAX STRENGTH": "strength",
      };
      return {
        name: zoneNameMap[zone.name] ?? "strength",
        min_velocity: 0,
        max_velocity: velocity,
        load_range: "",
        color: zone.color,
      };
    }
  }

  static getVlThresholdByExercise(
    category: string,
    phase: AppSettings["target_training_phase"] = "strength",
  ): number {
    if (category === "squat" || category === "bench" || category === "deadlift") {
      return getProtocolVelocityLossThreshold(category, phase);
    }

    switch (category?.toLowerCase()) {
      case "bench":
        return 10;
      case "deadlift":
        return 5;
      case "squat":
        return 20;
      case "press":
      case "pull":
      case "row":
      case "vertical_pull":
        return 15;
      default:
        return 20;
    }
  }

  static suggestNextLoad(
    avgVelocity: number,
    targetZone: keyof typeof VELOCITY_ZONES,
    currentLoad: number,
  ): LoadSuggestion {
    const target = VELOCITY_ZONES[targetZone] ?? VELOCITY_ZONES.strength;
    const targetVel = target.min + 0.1;

    if (avgVelocity < target.min) {
      const percentChange = Math.max(
        Math.round(((avgVelocity - targetVel) / targetVel) * 30),
        -10,
      );
      const newLoad =
        Math.round((currentLoad * (1 - Math.abs(percentChange) / 100)) / 2.5) *
        2.5;
      return {
        suggestedLoad: Math.max(newLoad, currentLoad * 0.9),
        reason: `現在の速度(${avgVelocity.toFixed(2)} m/s)は${target.name}ゾーンより遅いです`,
        percentChange: -Math.abs(percentChange),
      };
    }

    if (avgVelocity > targetVel + 0.15) {
      const percentChange = Math.min(
        Math.round(((avgVelocity - targetVel) / targetVel) * 20),
        10,
      );
      const newLoad =
        Math.round((currentLoad * (1 + percentChange / 100)) / 2.5) * 2.5;
      return {
        suggestedLoad: newLoad,
        reason: `現在の速度(${avgVelocity.toFixed(2)} m/s)は${target.name}ゾーンより速いです`,
        percentChange,
      };
    }

    return {
      suggestedLoad: currentLoad,
      reason: `現在の速度(${avgVelocity.toFixed(2)} m/s)は${target.name}ゾーン内です`,
      percentChange: 0,
    };
  }
}

export default VBTGuideService;
