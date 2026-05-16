import type { RepVeloData } from "../types/index";

export interface SimulatedRepOptions {
  meanVelocity?: number;
  peakVelocity?: number;
  romCm?: number;
  repDurationMs?: number;
  loadKg?: number;
  timestamp?: number;
}

export interface SimulatedSetOptions {
  reps?: number;
  baseVelocity?: number;
  velocityDropPerRep?: number;
  romCm?: number;
  loadKg?: number;
}

export const createSimulatedRep = (
  options: SimulatedRepOptions = {},
): RepVeloData => {
  const meanVelocity = options.meanVelocity ?? 0.45;
  const peakVelocity =
    options.peakVelocity ?? Number((meanVelocity * 1.18).toFixed(2));
  const romCm = options.romCm ?? 55;
  const loadKg = options.loadKg ?? 100;
  const meanPower = Math.round(loadKg * 9.81 * meanVelocity);
  const peakPower = Math.round(meanPower * 1.18);

  return {
    mean_velocity: meanVelocity,
    peak_velocity: peakVelocity,
    rom_cm: romCm,
    rep_duration_ms: options.repDurationMs ?? 850,
    mean_power_w: meanPower,
    peak_power_w: peakPower,
    timestamp: options.timestamp ?? Date.now(),
    raw_peak_v: Math.round(peakVelocity * 100),
    raw_mean_v: Math.round(meanVelocity * 100),
    raw_rom: Math.round((romCm / 2.54) * 10),
    raw_mean_p: meanPower,
    raw_peak_p: peakPower,
  };
};

export const createSimulatedSet = (
  options: SimulatedSetOptions = {},
): RepVeloData[] => {
  const reps = Math.max(1, Math.min(options.reps ?? 5, 12));
  const baseVelocity = options.baseVelocity ?? 0.52;
  const drop = options.velocityDropPerRep ?? 0.04;
  const romCm = options.romCm ?? 55;

  return Array.from({ length: reps }, (_, index) => {
    const meanVelocity = Math.max(0.1, baseVelocity - drop * index);
    return createSimulatedRep({
      meanVelocity: Number(meanVelocity.toFixed(2)),
      peakVelocity: Number((meanVelocity * 1.18).toFixed(2)),
      romCm: Number((romCm + (index % 2 === 0 ? 0.8 : -0.6)).toFixed(1)),
      repDurationMs: 820 + index * 35,
      loadKg: options.loadKg,
    });
  });
};
