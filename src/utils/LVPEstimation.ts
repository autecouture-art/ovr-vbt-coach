import type { SetData } from "@/src/types/index";

export type PersonalVelocityEstimate = {
  value: number;
  source: "履歴MVT" | "保存MVT" | "種目MVT" | "LVP推定";
};

export const estimateHistoricalMvt = (
  sets: SetData[],
): PersonalVelocityEstimate | null => {
  const validSets = sets.filter(
    (set) =>
      !set.is_warmup &&
      set.load_kg > 0 &&
      typeof set.avg_velocity === "number" &&
      set.avg_velocity >= 0.08 &&
      set.avg_velocity <= 0.6,
  );
  if (validSets.length === 0) return null;

  const maxLoad = Math.max(...validSets.map((set) => set.load_kg));
  const heavySets = validSets.filter((set) => set.load_kg >= maxLoad * 0.9);
  if (heavySets.length === 0) return null;

  const slowestVelocity = Math.min(
    ...heavySets.map((set) => set.avg_velocity!),
  );

  return {
    value: Number(slowestVelocity.toFixed(2)),
    source: "履歴MVT",
  };
};
