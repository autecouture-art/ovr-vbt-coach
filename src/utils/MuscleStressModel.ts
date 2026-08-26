import type { Exercise, SetData } from "@/src/types/index";

/**
 * A non-medical estimate of local training load and expected recovery demand.
 * It is deliberately expressed as a model prior, not muscle damage or an
 * injury prediction. Personal feedback can gradually replace these priors.
 */
export type MuscleGroup =
  | "chest"
  | "triceps"
  | "biceps"
  | "front_delts"
  | "rear_delts"
  | "upper_back"
  | "lats"
  | "spinal_erectors"
  | "quadriceps"
  | "adductors"
  | "hamstrings"
  | "glutes"
  | "calves"
  | "forearms"
  | "core";

export type MuscleStressConfidence =
  | "prior"
  | "collecting"
  | "provisional"
  | "personalized";

export type MuscleAllocation = Partial<Record<MuscleGroup, number>>;

export type MuscleStressProfile = {
  /** Initial values are priors until the athlete has enough comparable feedback. */
  recoveryHoursByMuscle?: Partial<Record<MuscleGroup, number>>;
  capacityByMuscle?: Partial<Record<MuscleGroup, number>>;
  allocationOverridesByLift?: Record<string, MuscleAllocation>;
  sampleCountByMuscle?: Partial<Record<MuscleGroup, number>>;
};

export type SetMuscleStressInput = Pick<
  SetData,
  | "lift"
  | "load_kg"
  | "reps"
  | "rpe"
  | "e1rm"
  | "velocity_loss_last"
  | "velocity_loss_min"
  | "is_warmup"
> & {
  category?: Exercise["category"] | null;
  maxSequentialVelocityLossPct?: number | null;
};

export type SetMuscleStressEstimate = {
  included: boolean;
  reason: "warmup" | "no_reps" | "estimated";
  lift: string;
  effectiveReps: number;
  relativeLoad: number | null;
  effortMultiplier: number;
  fatigueMultiplier: number;
  allocation: MuscleAllocation;
  stimulusByMuscle: Partial<Record<MuscleGroup, number>>;
  fatigueByMuscle: Partial<Record<MuscleGroup, number>>;
};

export type MuscleRecoveryProjection = {
  muscle: MuscleGroup;
  currentLoadScore: number;
  recoveryHours: number;
  remainingLoadScore: number;
};

export type MuscleStressSummary = {
  fatigueByMuscle: Partial<Record<MuscleGroup, number>>;
  stimulusByMuscle: Partial<Record<MuscleGroup, number>>;
  currentLoadScoreByMuscle: Partial<Record<MuscleGroup, number>>;
  confidenceByMuscle: Partial<Record<MuscleGroup, MuscleStressConfidence>>;
  recovery: Record<24 | 48 | 72, MuscleRecoveryProjection[]>;
};

export type MuscleRecoveryFeedback = {
  muscle: MuscleGroup;
  /** 0 = none, 10 = very high perceived local residual fatigue/soreness. */
  sorenessScore: number;
  /** Optional same-load checks. Negative velocity or positive RPE imply more residual demand. */
  sameLoadVelocityChangePct?: number | null;
  sameLoadRpeChange?: number | null;
  romChangePct?: number | null;
};

export type MuscleStressProfileUpdate = {
  profile: MuscleStressProfile;
  updatedMuscles: MuscleGroup[];
  deferredMuscles: MuscleGroup[];
};

const ALL_MUSCLES: MuscleGroup[] = [
  "chest",
  "triceps",
  "biceps",
  "front_delts",
  "rear_delts",
  "upper_back",
  "lats",
  "spinal_erectors",
  "quadriceps",
  "adductors",
  "hamstrings",
  "glutes",
  "calves",
  "forearms",
  "core",
];

const INITIAL_RECOVERY_HOURS: Record<MuscleGroup, number> = {
  chest: 30,
  triceps: 28,
  biceps: 24,
  front_delts: 30,
  rear_delts: 26,
  upper_back: 30,
  lats: 30,
  spinal_erectors: 42,
  quadriceps: 36,
  adductors: 42,
  hamstrings: 38,
  glutes: 36,
  calves: 24,
  forearms: 24,
  core: 28,
};

const INITIAL_CAPACITY: Record<MuscleGroup, number> = {
  chest: 12,
  triceps: 11,
  biceps: 10,
  front_delts: 10,
  rear_delts: 10,
  upper_back: 13,
  lats: 13,
  spinal_erectors: 12,
  quadriceps: 14,
  adductors: 11,
  hamstrings: 12,
  glutes: 14,
  calves: 12,
  forearms: 10,
  core: 12,
};

const CATEGORY_ALLOCATIONS: Record<Exercise["category"], MuscleAllocation> = {
  squat: {
    quadriceps: 0.32,
    glutes: 0.24,
    adductors: 0.18,
    spinal_erectors: 0.14,
    core: 0.12,
  },
  bench: {
    chest: 0.45,
    triceps: 0.25,
    front_delts: 0.15,
    upper_back: 0.1,
    core: 0.05,
  },
  deadlift: {
    spinal_erectors: 0.25,
    glutes: 0.25,
    hamstrings: 0.2,
    lats: 0.15,
    adductors: 0.1,
    forearms: 0.05,
  },
  press: {
    front_delts: 0.42,
    triceps: 0.3,
    chest: 0.12,
    upper_back: 0.1,
    core: 0.06,
  },
  pull: {
    lats: 0.4,
    biceps: 0.25,
    upper_back: 0.2,
    rear_delts: 0.1,
    forearms: 0.05,
  },
  row: {
    lats: 0.3,
    upper_back: 0.3,
    rear_delts: 0.15,
    biceps: 0.15,
    spinal_erectors: 0.1,
  },
  vertical_pull: {
    lats: 0.42,
    biceps: 0.23,
    upper_back: 0.2,
    rear_delts: 0.1,
    forearms: 0.05,
  },
  single_leg: {
    quadriceps: 0.31,
    glutes: 0.26,
    adductors: 0.17,
    hamstrings: 0.12,
    calves: 0.08,
    core: 0.06,
  },
  quad: {
    quadriceps: 0.75,
    glutes: 0.1,
    adductors: 0.07,
    calves: 0.04,
    core: 0.04,
  },
  hamstring: {
    hamstrings: 0.8,
    glutes: 0.1,
    calves: 0.05,
    spinal_erectors: 0.05,
  },
  adductor: { adductors: 0.78, glutes: 0.1, quadriceps: 0.07, core: 0.05 },
  glute: {
    glutes: 0.7,
    hamstrings: 0.15,
    spinal_erectors: 0.1,
    adductors: 0.05,
  },
  triceps: { triceps: 0.82, chest: 0.08, front_delts: 0.05, forearms: 0.05 },
  biceps: { biceps: 0.82, forearms: 0.12, upper_back: 0.06 },
  core: { core: 0.78, spinal_erectors: 0.22 },
  accessory: { core: 0.5, upper_back: 0.25, glutes: 0.25 },
};

const CANONICAL_ALLOCATIONS: Record<string, MuscleAllocation> = {
  "low bar squat": {
    quadriceps: 0.3,
    glutes: 0.25,
    adductors: 0.18,
    spinal_erectors: 0.15,
    hamstrings: 0.07,
    core: 0.05,
  },
  "high bar squat": {
    quadriceps: 0.38,
    glutes: 0.22,
    adductors: 0.15,
    spinal_erectors: 0.1,
    hamstrings: 0.07,
    core: 0.08,
  },
  "bench press": {
    chest: 0.45,
    triceps: 0.25,
    front_delts: 0.15,
    upper_back: 0.1,
    core: 0.05,
  },
  deadlift: {
    spinal_erectors: 0.25,
    glutes: 0.25,
    hamstrings: 0.2,
    lats: 0.15,
    adductors: 0.1,
    forearms: 0.05,
  },
  "t-bar row": {
    lats: 0.3,
    upper_back: 0.3,
    rear_delts: 0.15,
    biceps: 0.15,
    spinal_erectors: 0.1,
  },
  "leg curl delta": {
    hamstrings: 0.85,
    calves: 0.05,
    glutes: 0.05,
    spinal_erectors: 0.05,
  },
  "bulgarian split squat": {
    quadriceps: 0.3,
    glutes: 0.27,
    adductors: 0.17,
    hamstrings: 0.12,
    calves: 0.08,
    core: 0.06,
  },
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const round = (value: number, decimals = 3): number => {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
};

const cleanLift = (lift: string): string =>
  lift.trim().toLowerCase().replace(/\s+/g, " ");

const normalizedAllocation = (
  allocation: MuscleAllocation,
): MuscleAllocation => {
  const entries = Object.entries(allocation).filter(
    ([muscle, value]) =>
      ALL_MUSCLES.includes(muscle as MuscleGroup) &&
      typeof value === "number" &&
      Number.isFinite(value) &&
      value > 0,
  ) as [MuscleGroup, number][];
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  if (total <= 0) return {};
  return Object.fromEntries(
    entries.map(([muscle, value]) => [muscle, value / total]),
  );
};

const valueFor = (
  values: Partial<Record<MuscleGroup, number>> | undefined,
  muscle: MuscleGroup,
  fallback: number,
): number => {
  const candidate = values?.[muscle];
  return typeof candidate === "number" &&
    Number.isFinite(candidate) &&
    candidate > 0
    ? candidate
    : fallback;
};

export function getMuscleAllocation(
  lift: string,
  category?: Exercise["category"] | null,
  profile?: MuscleStressProfile,
): MuscleAllocation {
  const normalizedLift = cleanLift(lift);
  const override = profile?.allocationOverridesByLift?.[normalizedLift];
  if (override) return normalizedAllocation(override);
  return normalizedAllocation(
    CANONICAL_ALLOCATIONS[normalizedLift] ??
      (category
        ? CATEGORY_ALLOCATIONS[category]
        : CATEGORY_ALLOCATIONS.accessory),
  );
}

export function getMuscleStressConfidence(
  sampleCount: number | null | undefined,
): MuscleStressConfidence {
  const count = Number.isFinite(sampleCount)
    ? Math.max(0, Math.floor(sampleCount as number))
    : 0;
  if (count === 0) return "prior";
  if (count < 3) return "collecting";
  if (count < 9) return "provisional";
  return "personalized";
}

export function estimateSetMuscleStress(
  input: SetMuscleStressInput,
  profile?: MuscleStressProfile,
): SetMuscleStressEstimate {
  if (input.is_warmup) {
    return {
      included: false,
      reason: "warmup",
      lift: input.lift,
      effectiveReps: 0,
      relativeLoad: null,
      effortMultiplier: 0,
      fatigueMultiplier: 0,
      allocation: {},
      stimulusByMuscle: {},
      fatigueByMuscle: {},
    };
  }
  const reps = Number.isFinite(input.reps) ? Math.max(0, input.reps) : 0;
  if (reps === 0) {
    return {
      included: false,
      reason: "no_reps",
      lift: input.lift,
      effectiveReps: 0,
      relativeLoad: null,
      effortMultiplier: 0,
      fatigueMultiplier: 0,
      allocation: {},
      stimulusByMuscle: {},
      fatigueByMuscle: {},
    };
  }

  const relativeLoad =
    input.e1rm != null && Number.isFinite(input.e1rm) && input.e1rm > 0
      ? clamp(input.load_kg / input.e1rm, 0.3, 1.2)
      : null;
  const loadMultiplier =
    relativeLoad == null ? 0.9 : clamp(0.45 + relativeLoad * 0.7, 0.65, 1.15);
  const rpe =
    input.rpe != null && Number.isFinite(input.rpe)
      ? clamp(input.rpe, 1, 10)
      : null;
  const effortMultiplier =
    rpe == null ? 0.9 : clamp(0.84 + (rpe - 6) * 0.08, 0.72, 1.16);
  const vlLast = clamp(input.velocity_loss_last ?? 0, 0, 50);
  const sequentialLoss = clamp(
    input.maxSequentialVelocityLossPct ?? input.velocity_loss_min ?? 0,
    0,
    50,
  );
  const fatigueMultiplier =
    1 +
    vlLast * 0.0035 +
    sequentialLoss * 0.002 +
    Math.max(0, (rpe ?? 7) - 8) * 0.06;
  const effectiveReps = reps * loadMultiplier * effortMultiplier;
  const allocation = getMuscleAllocation(input.lift, input.category, profile);
  const stimulusByMuscle: Partial<Record<MuscleGroup, number>> = {};
  const fatigueByMuscle: Partial<Record<MuscleGroup, number>> = {};
  for (const [muscle, share] of Object.entries(allocation) as [
    MuscleGroup,
    number,
  ][]) {
    const stimulus = effectiveReps * share;
    stimulusByMuscle[muscle] = round(stimulus);
    fatigueByMuscle[muscle] = round(stimulus * fatigueMultiplier);
  }

  return {
    included: true,
    reason: "estimated",
    lift: input.lift,
    effectiveReps: round(effectiveReps),
    relativeLoad: relativeLoad == null ? null : round(relativeLoad),
    effortMultiplier: round(effortMultiplier),
    fatigueMultiplier: round(fatigueMultiplier),
    allocation,
    stimulusByMuscle,
    fatigueByMuscle,
  };
}

export function projectMuscleRecovery(
  fatigueByMuscle: Partial<Record<MuscleGroup, number>>,
  hours: 24 | 48 | 72,
  profile?: MuscleStressProfile,
): MuscleRecoveryProjection[] {
  return ALL_MUSCLES.map((muscle) => {
    const fatigue = Math.max(0, fatigueByMuscle[muscle] ?? 0);
    const capacity = valueFor(
      profile?.capacityByMuscle,
      muscle,
      INITIAL_CAPACITY[muscle],
    );
    const recoveryHours = valueFor(
      profile?.recoveryHoursByMuscle,
      muscle,
      INITIAL_RECOVERY_HOURS[muscle],
    );
    const currentLoadScore = clamp((fatigue / capacity) * 100, 0, 100);
    return {
      muscle,
      currentLoadScore: round(currentLoadScore, 1),
      recoveryHours: round(recoveryHours, 1),
      remainingLoadScore: round(
        currentLoadScore * Math.exp(-hours / recoveryHours),
        1,
      ),
    };
  }).filter((projection) => projection.currentLoadScore > 0);
}

export function summarizeMuscleStress(
  sets: readonly SetMuscleStressInput[],
  profile?: MuscleStressProfile,
): MuscleStressSummary {
  const fatigueByMuscle: Partial<Record<MuscleGroup, number>> = {};
  const stimulusByMuscle: Partial<Record<MuscleGroup, number>> = {};
  for (const set of sets) {
    const estimate = estimateSetMuscleStress(set, profile);
    for (const muscle of ALL_MUSCLES) {
      fatigueByMuscle[muscle] = round(
        (fatigueByMuscle[muscle] ?? 0) +
          (estimate.fatigueByMuscle[muscle] ?? 0),
      );
      stimulusByMuscle[muscle] = round(
        (stimulusByMuscle[muscle] ?? 0) +
          (estimate.stimulusByMuscle[muscle] ?? 0),
      );
    }
  }
  const currentLoadScoreByMuscle: Partial<Record<MuscleGroup, number>> = {};
  const confidenceByMuscle: Partial<
    Record<MuscleGroup, MuscleStressConfidence>
  > = {};
  for (const muscle of ALL_MUSCLES) {
    if ((fatigueByMuscle[muscle] ?? 0) <= 0) continue;
    currentLoadScoreByMuscle[muscle] =
      projectMuscleRecovery(fatigueByMuscle, 24, profile).find(
        (projection) => projection.muscle === muscle,
      )?.currentLoadScore ?? 0;
    confidenceByMuscle[muscle] = getMuscleStressConfidence(
      profile?.sampleCountByMuscle?.[muscle],
    );
  }
  return {
    fatigueByMuscle,
    stimulusByMuscle,
    currentLoadScoreByMuscle,
    confidenceByMuscle,
    recovery: {
      24: projectMuscleRecovery(fatigueByMuscle, 24, profile),
      48: projectMuscleRecovery(fatigueByMuscle, 48, profile),
      72: projectMuscleRecovery(fatigueByMuscle, 72, profile),
    },
  };
}

/**
 * Updates only recovery priors after three or more feedback samples for a
 * muscle. This bounded update deliberately avoids claiming that EMG or one
 * session can identify an individual's true recovery curve.
 */
export function updateRecoveryProfileFromFeedback(input: {
  profile?: MuscleStressProfile;
  predictedCurrentLoadScoreByMuscle: Partial<Record<MuscleGroup, number>>;
  feedback: readonly MuscleRecoveryFeedback[];
}): MuscleStressProfileUpdate {
  const profile: MuscleStressProfile = {
    ...input.profile,
    recoveryHoursByMuscle: { ...input.profile?.recoveryHoursByMuscle },
    capacityByMuscle: { ...input.profile?.capacityByMuscle },
    sampleCountByMuscle: { ...input.profile?.sampleCountByMuscle },
    allocationOverridesByLift: input.profile?.allocationOverridesByLift,
  };
  const updatedMuscles: MuscleGroup[] = [];
  const deferredMuscles: MuscleGroup[] = [];
  for (const entry of input.feedback) {
    const muscle = entry.muscle;
    const priorCount = profile.sampleCountByMuscle?.[muscle] ?? 0;
    const sampleCount = priorCount + 1;
    profile.sampleCountByMuscle![muscle] = sampleCount;
    if (sampleCount < 3) {
      deferredMuscles.push(muscle);
      continue;
    }
    const predicted = clamp(
      input.predictedCurrentLoadScoreByMuscle[muscle] ?? 0,
      0,
      100,
    );
    const observed = clamp(
      entry.sorenessScore * 10 +
        Math.max(0, -(entry.sameLoadVelocityChangePct ?? 0)) * 1.5 +
        Math.max(0, entry.sameLoadRpeChange ?? 0) * 8 +
        Math.max(0, -(entry.romChangePct ?? 0)) * 0.8,
      0,
      100,
    );
    const residual = observed - predicted;
    const currentRecoveryHours = valueFor(
      profile.recoveryHoursByMuscle,
      muscle,
      INITIAL_RECOVERY_HOURS[muscle],
    );
    const currentCapacity = valueFor(
      profile.capacityByMuscle,
      muscle,
      INITIAL_CAPACITY[muscle],
    );
    const adjustment = clamp(residual / 100, -0.12, 0.12);
    profile.recoveryHoursByMuscle![muscle] = round(
      clamp(currentRecoveryHours * (1 + adjustment), 18, 96),
      1,
    );
    profile.capacityByMuscle![muscle] = round(
      clamp(currentCapacity * (1 - adjustment * 0.35), 5, 30),
      2,
    );
    updatedMuscles.push(muscle);
  }
  return { profile, updatedMuscles, deferredMuscles };
}
