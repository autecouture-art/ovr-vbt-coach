export const BIG3_GEAR_KINDS = [
  "belt",
  "wrist_wraps",
  "regular_knee_sleeves",
  "pro_knee_sleeves",
  "elbow_sleeves",
  "thumbless_grip",
  "power_grips",
  "wrist_straps",
  "figure_8_straps",
  "hook_grip",
  // Legacy values remain parseable for records created by the previous catalog.
  "knee_sleeves",
  "knee_wraps",
  "lifting_straps",
  "deadlift_suit",
  "squat_suit",
  "bench_shirt",
  // General training equipment is available for every exercise. Keeping it in
  // the same serialized shape preserves existing BIG3 records and exports.
  "lifting_shoes",
  "flat_shoes",
  "chalk",
  "gloves",
] as const;

export type Big3GearKind = (typeof BIG3_GEAR_KINDS)[number];
export type Big3CompetitionLift = "SQ" | "BP" | "DL";

export const BIG3_GEAR_OPTIONS_BY_LIFT: Record<
  Big3CompetitionLift,
  Big3GearKind[]
> = {
  SQ: ["belt", "wrist_wraps", "regular_knee_sleeves", "pro_knee_sleeves"],
  BP: ["belt", "wrist_wraps", "elbow_sleeves", "thumbless_grip"],
  DL: ["belt", "power_grips", "wrist_straps", "figure_8_straps", "hook_grip"],
};

export const GENERAL_GEAR_OPTIONS: Big3GearKind[] = [
  "belt",
  "wrist_wraps",
  "elbow_sleeves",
  "regular_knee_sleeves",
  "pro_knee_sleeves",
  "power_grips",
  "wrist_straps",
  "figure_8_straps",
  "hook_grip",
  "lifting_straps",
  "lifting_shoes",
  "flat_shoes",
  "chalk",
  "gloves",
];

/** Serializable gear recorded against one set or lift. */
export type Big3GearSelection = {
  gear: Big3GearKind[];
  other?: string;
};

export const BIG3_GEAR_LABELS: Record<Big3GearKind, string> = {
  belt: "ベルト",
  wrist_wraps: "リストラップ",
  regular_knee_sleeves: "通常ニースリーブ",
  pro_knee_sleeves: "プロ系ニースリーブ",
  elbow_sleeves: "エルボースリーブ",
  thumbless_grip: "サムレスグリップ",
  power_grips: "パワーグリップ",
  wrist_straps: "リストストラップ",
  figure_8_straps: "エイトストラップ",
  hook_grip: "フックグリップ",
  knee_sleeves: "ニースリーブ",
  knee_wraps: "ニーラップ",
  lifting_straps: "ストラップ",
  deadlift_suit: "デッドリフトスーツ",
  squat_suit: "スクワットスーツ",
  bench_shirt: "ベンチシャツ",
  lifting_shoes: "リフティングシューズ",
  flat_shoes: "フラットシューズ",
  chalk: "チョーク",
  gloves: "グローブ",
};

const GEAR_KIND_SET = new Set<string>(BIG3_GEAR_KINDS);

function normalizedName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Returns a BIG3 code only for explicit competition-lift canonical names. */
export function getCompetitionBig3Lift(
  lift: string | null | undefined,
): Big3CompetitionLift | null {
  if (!lift) return null;

  switch (normalizedName(lift)) {
    case "low bar squat":
    case "squat":
      return "SQ";
    case "bench press":
      return "BP";
    case "deadlift":
    case "conventional deadlift":
    case "sumo deadlift":
      return "DL";
    default:
      return null;
  }
}

function normalizeOther(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized || undefined;
}

/** Removes invalid entries, deduplicates, and uses a stable canonical order. */
export function normalizeBig3GearSelection(input: {
  gear?: unknown;
  other?: unknown;
}): Big3GearSelection {
  const selected = new Set(
    Array.isArray(input.gear)
      ? input.gear.filter(
          (gear): gear is Big3GearKind =>
            typeof gear === "string" && GEAR_KIND_SET.has(gear),
        )
      : [],
  );
  const other = normalizeOther(input.other);

  return {
    gear: BIG3_GEAR_KINDS.filter((gear) => selected.has(gear)),
    ...(other ? { other } : {}),
  };
}

/** Serializes a normalized selection with deterministic key and gear ordering. */
export function serializeBig3GearSelection(input: {
  gear?: unknown;
  other?: unknown;
}): string {
  return JSON.stringify(normalizeBig3GearSelection(input));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Parses current records and small legacy shapes safely. Missing or malformed
 * values return null, while an explicit empty selection returns { gear: [] }.
 */
export function parseBig3GearSelection(
  value: unknown,
): Big3GearSelection | null {
  if (value === null || value === undefined || value === "") return null;

  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }

  if (Array.isArray(parsed))
    return normalizeBig3GearSelection({ gear: parsed });
  if (!isRecord(parsed)) return null;

  const gear = parsed.gear ?? parsed.gears ?? parsed.selectedGear;
  const other = parsed.other ?? parsed.otherGear ?? parsed.notes;
  if (gear === undefined && other === undefined) return null;

  return normalizeBig3GearSelection({ gear, other });
}

/** Produces a concise Japanese summary without conflating no record and no gear. */
export function formatBig3GearSummary(value: unknown): string {
  const selection = parseBig3GearSelection(value);
  if (!selection) return "未記録";

  const labels = selection.gear.map((gear) => BIG3_GEAR_LABELS[gear]);
  if (selection.other) labels.push(`その他: ${selection.other}`);
  return labels.length ? labels.join("・") : "ギアなし";
}
