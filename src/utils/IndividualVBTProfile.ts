import type { RepData } from "@/src/types/index";

export type IndividualProfileMode = "standard" | "collect" | "confirm";

export type RepVelocityLossPoint = {
  repIndex: number;
  meanVelocity: number;
  fastestLossPct: number;
  previousRepLossPct: number | null;
};

export type RepVelocityLossPattern = {
  repCount: number;
  firstVelocity: number | null;
  fastestVelocity: number | null;
  finalVelocity: number | null;
  velocityLossLastPct: number | null;
  maxSequentialLossPct: number | null;
  points: RepVelocityLossPoint[];
};

export type IndividualVBTProfileSample = {
  finalVelocity: number | null;
  velocityLossLastPct: number | null;
  sequentialLossPatternPct: number[];
};

export type IndividualVBTProfile = {
  sampleCount: number;
  confidence: "collecting" | "provisional" | "ready";
  targetFinalVelocity: number | null;
  targetVelocityLossPct: number | null;
  expectedSequentialLossPatternPct: number[];
};

export type LiveSetProfileTarget = {
  mode: IndividualProfileMode;
  plannedLoadKg: number | null;
  plannedReps: number | null;
  plannedRpe: number | null;
  currentRepCount: number;
  currentVelocityLossLastPct: number | null;
  currentFinalVelocity: number | null;
  nextObservationPointPct: number | null;
  targetVelocityLossPct: number | null;
  capVelocityLossPct: number | null;
  targetFinalVelocity: number | null;
  expectedSequentialLossPatternPct: number[];
  observedSequentialLossPatternPct: number[];
  observationOnly: boolean;
};

const DEFAULT_OBSERVATION_POINTS = [10, 15, 20, 25, 30];

const median = (values: number[]): number | null => {
  const valid = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (valid.length === 0) return null;
  const middle = Math.floor(valid.length / 2);
  return valid.length % 2 === 0
    ? (valid[middle - 1] + valid[middle]) / 2
    : valid[middle];
};

const validVelocityReps = (reps: readonly RepData[]): RepData[] =>
  reps
    .filter(
      (rep) =>
        rep.is_valid_rep &&
        !rep.is_excluded &&
        !rep.is_failed &&
        !rep.is_short_rom &&
        rep.mean_velocity != null &&
        Number.isFinite(rep.mean_velocity) &&
        rep.mean_velocity > 0,
    )
    .slice()
    .sort((left, right) => left.rep_index - right.rep_index);

export function buildRepVelocityLossPattern(
  reps: readonly RepData[],
): RepVelocityLossPattern {
  const valid = validVelocityReps(reps);
  if (valid.length === 0) {
    return {
      repCount: 0,
      firstVelocity: null,
      fastestVelocity: null,
      finalVelocity: null,
      velocityLossLastPct: null,
      maxSequentialLossPct: null,
      points: [],
    };
  }

  const velocities = valid.map((rep) => rep.mean_velocity as number);
  const fastestVelocity = Math.max(...velocities);
  const points = valid.map((rep, index) => {
    const meanVelocity = rep.mean_velocity as number;
    const previousVelocity = index > 0 ? velocities[index - 1] : null;
    return {
      repIndex: rep.rep_index,
      meanVelocity,
      fastestLossPct: ((fastestVelocity - meanVelocity) / fastestVelocity) * 100,
      previousRepLossPct:
        previousVelocity != null && previousVelocity > 0
          ? ((previousVelocity - meanVelocity) / previousVelocity) * 100
          : null,
    };
  });
  const finalVelocity = velocities[velocities.length - 1];
  const sequentialLosses = points
    .map((point) => point.previousRepLossPct)
    .filter((value): value is number => value != null && value > 0);

  return {
    repCount: valid.length,
    firstVelocity: velocities[0],
    fastestVelocity,
    finalVelocity,
    velocityLossLastPct:
      valid.length > 1
        ? ((fastestVelocity - finalVelocity) / fastestVelocity) * 100
        : 0,
    maxSequentialLossPct: sequentialLosses.length > 0 ? Math.max(...sequentialLosses) : 0,
    points,
  };
}

export function buildIndividualVBTProfile(
  samples: readonly IndividualVBTProfileSample[],
): IndividualVBTProfile {
  const valid = samples.filter(
    (sample) =>
      sample.finalVelocity != null || sample.velocityLossLastPct != null,
  );
  const sampleCount = valid.length;
  const maxPatternLength = valid.reduce(
    (max, sample) => Math.max(max, sample.sequentialLossPatternPct.length),
    0,
  );
  const expectedSequentialLossPatternPct = Array.from(
    { length: maxPatternLength },
    (_, index) =>
      median(
        valid
          .map((sample) => sample.sequentialLossPatternPct[index])
          .filter((value): value is number => value != null),
      ) ?? 0,
  );

  return {
    sampleCount,
    confidence: sampleCount >= 3 ? "ready" : sampleCount >= 2 ? "provisional" : "collecting",
    targetFinalVelocity: median(
      valid
        .map((sample) => sample.finalVelocity)
        .filter((value): value is number => value != null),
    ),
    targetVelocityLossPct: median(
      valid
        .map((sample) => sample.velocityLossLastPct)
        .filter((value): value is number => value != null),
    ),
    expectedSequentialLossPatternPct,
  };
}

export function buildLiveSetProfileTarget(input: {
  mode?: IndividualProfileMode | null;
  plannedLoadKg?: number | null;
  plannedReps?: number | null;
  plannedRpe?: number | null;
  targetVelocityLossPct?: number | null;
  capVelocityLossPct?: number | null;
  targetFinalVelocity?: number | null;
  expectedSequentialLossPatternPct?: number[] | null;
  observationPointsPct?: number[] | null;
  reps: readonly RepData[];
}): LiveSetProfileTarget {
  const mode = input.mode ?? "standard";
  const pattern = buildRepVelocityLossPattern(input.reps);
  const points = (input.observationPointsPct?.length
    ? input.observationPointsPct
    : DEFAULT_OBSERVATION_POINTS
  )
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);
  const currentVelocityLossLastPct = pattern.velocityLossLastPct;
  const nextObservationPointPct =
    mode === "collect" && currentVelocityLossLastPct != null
      ? points.find((point) => point > currentVelocityLossLastPct + 0.05) ?? null
      : mode === "collect"
        ? points[0] ?? null
        : null;

  return {
    mode,
    plannedLoadKg: input.plannedLoadKg ?? null,
    plannedReps: input.plannedReps ?? null,
    plannedRpe: input.plannedRpe ?? null,
    currentRepCount: pattern.repCount,
    currentVelocityLossLastPct,
    currentFinalVelocity: pattern.finalVelocity,
    nextObservationPointPct,
    targetVelocityLossPct: input.targetVelocityLossPct ?? null,
    capVelocityLossPct: input.capVelocityLossPct ?? null,
    targetFinalVelocity: input.targetFinalVelocity ?? null,
    expectedSequentialLossPatternPct: input.expectedSequentialLossPatternPct ?? [],
    observedSequentialLossPatternPct: pattern.points
      .map((point) => point.previousRepLossPct)
      .filter((value): value is number => value != null),
    observationOnly: mode === "collect",
  };
}
