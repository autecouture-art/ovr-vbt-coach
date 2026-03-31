import type { Exercise } from "@/src/types/index";

export type ExerciseSelectionGroupId =
  | "all"
  | "big3"
  | "bench_family"
  | "squat_family"
  | "hinge_family"
  | "upper_push"
  | "upper_pull"
  | "lower_body"
  | "arms_core";

type ExerciseSeed = Exercise & {
  aliases?: string[];
};

const DEFAULT_MICRO_STEPS = [0.5, 1, 2.5, 5];

export const EXERCISE_CATEGORY_LABELS: Record<Exercise["category"], string> = {
  squat: "スクワット系",
  bench: "ベンチ系",
  deadlift: "デッドリフト系",
  press: "プレス系",
  pull: "プル系",
  row: "ロウ系",
  vertical_pull: "懸垂・ラット系",
  single_leg: "片脚系",
  quad: "大腿四頭筋",
  hamstring: "ハムストリング",
  adductor: "内転筋",
  glute: "臀部",
  triceps: "上腕三頭筋",
  biceps: "上腕二頭筋",
  core: "体幹",
  accessory: "補助種目",
};

export const EXERCISE_SELECTION_GROUPS: Array<{
  id: ExerciseSelectionGroupId;
  label: string;
}> = [
  { id: "all", label: "すべて" },
  { id: "big3", label: "BIG3" },
  { id: "bench_family", label: "ベンチ系" },
  { id: "squat_family", label: "スクワット系" },
  { id: "hinge_family", label: "デッド・ヒンジ" },
  { id: "upper_push", label: "上半身プッシュ" },
  { id: "upper_pull", label: "上半身プル" },
  { id: "lower_body", label: "下半身補助" },
  { id: "arms_core", label: "腕・体幹" },
];

const DEFAULT_EXERCISE_SEEDS: ExerciseSeed[] = [
  {
    id: "squat",
    name: "スクワット",
    category: "squat",
    subcategory: "competition_squat",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 24,
    rep_detection_mode: "standard",
    target_pause_ms: 0,
    rom_range_min_cm: 36,
    rom_range_max_cm: 60,
    description: "標準的なバックスクワット。ROM推定の基準種目。",
    mvt: 0.3,
    aliases: ["squat", "back squat"],
  },
  {
    id: "front_squat",
    name: "フロントスクワット",
    category: "squat",
    subcategory: "front_squat",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 22,
    rep_detection_mode: "standard",
    rom_range_min_cm: 34,
    rom_range_max_cm: 58,
    description: "上体が立ちやすい前担ぎスクワット。",
    mvt: 0.32,
    aliases: ["front squat"],
  },
  {
    id: "ssb_support_squat",
    name: "SSBサポートスクワット",
    category: "squat",
    subcategory: "ssb_support_squat",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 20,
    rep_detection_mode: "standard",
    rom_range_min_cm: 28,
    rom_range_max_cm: 52,
    description: "サポート付きSSBスクワット。短めROMにも対応。",
    aliases: ["sbb support squat", "support squat"],
  },
  {
    id: "ssb_adductor_squat",
    name: "SSBアダクタースクワット",
    category: "squat",
    subcategory: "ssb_adductor_squat",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 18,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 24,
    rom_range_max_cm: 46,
    description: "内転筋寄りのスタンスを取るSSBスクワット。",
    aliases: ["ssb adductor squat", "ssb adductor  squat"],
  },
  {
    id: "bench_press",
    name: "ベンチプレス",
    category: "bench",
    subcategory: "competition_bench",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 12,
    rep_detection_mode: "standard",
    rom_range_min_cm: 16,
    rom_range_max_cm: 34,
    description: "標準的なベンチプレス。GLM相談・1RM推定の中心。",
    mvt: 0.15,
    aliases: ["bench press", "bench"],
  },
  {
    id: "larsen_bench_press",
    name: "ラーセンベンチプレス",
    category: "bench",
    subcategory: "larsen_bench",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 12,
    rep_detection_mode: "standard",
    rom_range_min_cm: 16,
    rom_range_max_cm: 32,
    description: "脚の反力を使わないベンチバリエーション。",
    mvt: 0.15,
    aliases: ["larsen bench press", "larsen bench"],
  },
  {
    id: "larsen_bottom_pulse_bench_press",
    name: "ラーセンボトムパルスベンチプレス",
    category: "bench",
    subcategory: "pulse_bench",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 10,
    rep_detection_mode: "pause",
    target_pause_ms: 250,
    rom_range_min_cm: 14,
    rom_range_max_cm: 30,
    description:
      "ボトムでパルスを入れるベンチ。誤検知防止のため pause モード。",
    aliases: ["larsen bottom pulse bench", "bottom pulse bench"],
  },
  {
    id: "larsen_tempo_bench_press",
    name: "ラーセン4-2-0テンポベンチプレス",
    category: "bench",
    subcategory: "tempo_bench",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 10,
    rep_detection_mode: "tempo",
    target_pause_ms: 400,
    rom_range_min_cm: 14,
    rom_range_max_cm: 30,
    description: "4-2-0 テンポのラーセンベンチ。",
    aliases: ["larsen 4/2/0 tempo bench", "tempo bench", "4/2/0 tempo bench"],
  },
  {
    id: "incline_bench_press",
    name: "インクラインベンチプレス",
    category: "bench",
    subcategory: "incline_bench",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 12,
    rep_detection_mode: "standard",
    rom_range_min_cm: 14,
    rom_range_max_cm: 30,
    description: "上胸寄りのベンチプレス。",
    aliases: ["incline bench", "incline bench press"],
  },
  {
    id: "deadlift",
    name: "デッドリフト",
    category: "deadlift",
    subcategory: "conventional_deadlift",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 20,
    rep_detection_mode: "standard",
    rom_range_min_cm: 28,
    rom_range_max_cm: 48,
    description: "標準的なコンベンショナルデッドリフト。",
    mvt: 0.3,
    aliases: ["deadlift", "conventional deadlift"],
  },
  {
    id: "sumo_deadlift",
    name: "相撲デッドリフト",
    category: "deadlift",
    subcategory: "sumo_deadlift",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 18,
    rep_detection_mode: "standard",
    rom_range_min_cm: 24,
    rom_range_max_cm: 42,
    description: "スタンスが広い相撲デッド。",
    mvt: 0.28,
    aliases: ["sumo deadlift", "sumo"],
  },
  {
    id: "adductor_focused_wide_deadlift",
    name: "アダクターフォーカスワイドデッドリフト",
    category: "deadlift",
    subcategory: "wide_deadlift",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 18,
    rep_detection_mode: "standard",
    rom_range_min_cm: 22,
    rom_range_max_cm: 40,
    description: "内転筋寄りのワイドスタンスデッド。",
    aliases: ["adductor-focused wide dea", "wide deadlift"],
  },
  {
    id: "romanian_deadlift",
    name: "ルーマニアンデッドリフト",
    category: "deadlift",
    subcategory: "romanian_deadlift",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 18,
    rep_detection_mode: "tempo",
    rom_range_min_cm: 20,
    rom_range_max_cm: 38,
    description: "ヒップヒンジを強く使うRDL。",
    aliases: ["rdl", "romanian deadlift"],
  },
  {
    id: "shoulder_press",
    name: "ショルダープレス",
    category: "press",
    subcategory: "shoulder_press",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 14,
    rep_detection_mode: "standard",
    rom_range_min_cm: 18,
    rom_range_max_cm: 36,
    description: "立位または座位のショルダープレス。",
    mvt: 0.2,
    aliases: ["shoulder press", "overhead press", "ohp"],
  },
  {
    id: "landmine_shoulder_press",
    name: "ランドマインショルダープレス",
    category: "press",
    subcategory: "landmine_press",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 12,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 16,
    rom_range_max_cm: 32,
    description: "斜め軌道のプレス。",
    aliases: ["landmune shoulder press", "landmine shoulder press"],
  },
  {
    id: "seal_row",
    name: "シールロウ",
    category: "row",
    subcategory: "seal_row",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 12,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 14,
    rom_range_max_cm: 28,
    description: "胸支持の水平ロウ。",
    aliases: ["seal row"],
  },
  {
    id: "barbell_row",
    name: "バーベルロウ",
    category: "row",
    subcategory: "barbell_row",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 14,
    rep_detection_mode: "standard",
    rom_range_min_cm: 18,
    rom_range_max_cm: 34,
    description: "フリーウェイトの水平プル。",
    aliases: ["barbell row", "row"],
  },
  {
    id: "chinning",
    name: "チンニング",
    category: "vertical_pull",
    subcategory: "chin_up",
    has_lvp: true,
    min_rom_threshold: 16,
    rep_detection_mode: "standard",
    rom_range_min_cm: 18,
    rom_range_max_cm: 38,
    description: "自重または加重の懸垂。",
    aliases: ["chinning", "chin up", "pull-up", "pull up"],
  },
  {
    id: "lat_pulldown",
    name: "ラットプルダウン",
    category: "vertical_pull",
    subcategory: "lat_pulldown",
    has_lvp: true,
    min_rom_threshold: 16,
    rep_detection_mode: "standard",
    rom_range_min_cm: 18,
    rom_range_max_cm: 36,
    description: "縦引きマシン種目。",
    aliases: ["lat pulldown", "lat pull down"],
  },
  {
    id: "dips",
    name: "ディップス",
    category: "triceps",
    subcategory: "dips",
    has_lvp: true,
    min_rom_threshold: 12,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 14,
    rom_range_max_cm: 30,
    description: "胸・三頭狙いの自重プレス。",
    aliases: ["dips", "dip"],
  },
  {
    id: "cable_press_down",
    name: "ケーブルプレスダウン",
    category: "triceps",
    subcategory: "press_down",
    has_lvp: false,
    min_rom_threshold: 8,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 10,
    rom_range_max_cm: 24,
    description: "三頭狙いのケーブル種目。",
    aliases: ["cable press down", "press down", "pressdown"],
  },
  {
    id: "arm_curl",
    name: "アームカール",
    category: "biceps",
    subcategory: "curl",
    has_lvp: false,
    min_rom_threshold: 8,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 10,
    rom_range_max_cm: 22,
    description: "二頭筋の補助種目。",
    aliases: ["bicep curl", "curl", "arm curl"],
  },
  {
    id: "leg_extension_delta",
    name: "レッグエクステンション DELTA",
    category: "quad",
    subcategory: "leg_extension",
    has_lvp: false,
    min_rom_threshold: 10,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 12,
    rom_range_max_cm: 26,
    description: "四頭筋メインのマシン種目。",
    aliases: ["leg extension delta", "leg extension"],
  },
  {
    id: "leg_curl_delta",
    name: "レッグカール DELTA",
    category: "hamstring",
    subcategory: "leg_curl",
    has_lvp: false,
    min_rom_threshold: 10,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 12,
    rom_range_max_cm: 24,
    description: "ハムストリングのマシン種目。",
    aliases: ["leg curl delta", "leg curl"],
  },
  {
    id: "adductor_delta",
    name: "アダクター DELTA",
    category: "adductor",
    subcategory: "adductor_machine",
    has_lvp: false,
    min_rom_threshold: 8,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 10,
    rom_range_max_cm: 22,
    description: "内転筋のマシン種目。",
    aliases: ["adductor delta new", "adductor delta", "adductor"],
  },
  {
    id: "hip_thrust",
    name: "ヒップスラスト",
    category: "glute",
    subcategory: "hip_thrust",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 12,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 14,
    rom_range_max_cm: 28,
    description: "臀部主導のヒップエクステンション。",
    aliases: ["hip thrust"],
  },
  {
    id: "bulgarian_split_squat",
    name: "ブルガリアンスクワット",
    category: "single_leg",
    subcategory: "bulgarian_split_squat",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 18,
    rep_detection_mode: "standard",
    rom_range_min_cm: 22,
    rom_range_max_cm: 40,
    description: "片脚の安定性と脚力強化に。",
    aliases: ["bulgarian squat", "bulgarian split squat"],
  },
];

export const DEFAULT_EXERCISES: Exercise[] = DEFAULT_EXERCISE_SEEDS.map(
  ({ aliases: _aliases, ...exercise }) => exercise,
);

const normalizeKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/ovr_velocity_/g, "")
    .replace(/delta/g, "delta")
    .replace(/[\s_\-\/]+/g, "")
    .replace(/[()]/g, "")
    .trim();

const CATEGORY_DEFAULTS: Record<Exercise["category"], Partial<Exercise>> = {
  squat: {
    has_lvp: true,
    min_rom_threshold: 22,
    rep_detection_mode: "standard",
    rom_range_min_cm: 32,
    rom_range_max_cm: 58,
    mvt: 0.3,
  },
  bench: {
    has_lvp: true,
    min_rom_threshold: 12,
    rep_detection_mode: "standard",
    rom_range_min_cm: 16,
    rom_range_max_cm: 32,
    mvt: 0.15,
  },
  deadlift: {
    has_lvp: true,
    min_rom_threshold: 18,
    rep_detection_mode: "standard",
    rom_range_min_cm: 24,
    rom_range_max_cm: 44,
    mvt: 0.28,
  },
  press: {
    has_lvp: true,
    min_rom_threshold: 14,
    rep_detection_mode: "standard",
    rom_range_min_cm: 18,
    rom_range_max_cm: 34,
    mvt: 0.2,
  },
  pull: {
    has_lvp: true,
    min_rom_threshold: 16,
    rep_detection_mode: "standard",
    rom_range_min_cm: 18,
    rom_range_max_cm: 38,
  },
  row: {
    has_lvp: true,
    min_rom_threshold: 12,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 14,
    rom_range_max_cm: 30,
  },
  vertical_pull: {
    has_lvp: true,
    min_rom_threshold: 16,
    rep_detection_mode: "standard",
    rom_range_min_cm: 18,
    rom_range_max_cm: 36,
  },
  single_leg: {
    has_lvp: true,
    min_rom_threshold: 18,
    rep_detection_mode: "standard",
    rom_range_min_cm: 22,
    rom_range_max_cm: 40,
  },
  quad: {
    has_lvp: false,
    min_rom_threshold: 10,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 12,
    rom_range_max_cm: 26,
  },
  hamstring: {
    has_lvp: false,
    min_rom_threshold: 10,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 12,
    rom_range_max_cm: 24,
  },
  adductor: {
    has_lvp: false,
    min_rom_threshold: 8,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 10,
    rom_range_max_cm: 22,
  },
  glute: {
    has_lvp: true,
    min_rom_threshold: 12,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 14,
    rom_range_max_cm: 28,
  },
  triceps: {
    has_lvp: false,
    min_rom_threshold: 8,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 10,
    rom_range_max_cm: 24,
  },
  biceps: {
    has_lvp: false,
    min_rom_threshold: 8,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 10,
    rom_range_max_cm: 22,
  },
  core: {
    has_lvp: false,
    min_rom_threshold: 6,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 8,
    rom_range_max_cm: 18,
  },
  accessory: {
    has_lvp: false,
    min_rom_threshold: 10,
    rep_detection_mode: "standard",
    rom_range_min_cm: 12,
    rom_range_max_cm: 24,
  },
};

const seedByAlias = new Map<string, ExerciseSeed>();
for (const seed of DEFAULT_EXERCISE_SEEDS) {
  seedByAlias.set(normalizeKey(seed.name), seed);
  for (const alias of seed.aliases ?? []) {
    seedByAlias.set(normalizeKey(alias), seed);
  }
}

export function roundToHalfKg(value: number): number {
  return Math.round(value * 2) / 2;
}

export function formatLoadKg(value: number): string {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

export function getExerciseCategoryLabel(
  category: Exercise["category"] | string | undefined,
): string {
  if (!category) return "未分類";
  return (
    EXERCISE_CATEGORY_LABELS[category as Exercise["category"]] ??
    String(category)
  );
}

export function getExerciseSelectionGroup(
  exercise: Exercise,
): ExerciseSelectionGroupId {
  if (["squat", "bench", "deadlift"].includes(exercise.category)) {
    if (exercise.category === "bench") return "bench_family";
    if (exercise.category === "squat") return "squat_family";
    return "hinge_family";
  }

  switch (exercise.category) {
    case "press":
      return "upper_push";
    case "pull":
    case "row":
    case "vertical_pull":
      return "upper_pull";
    case "single_leg":
    case "quad":
    case "hamstring":
    case "adductor":
    case "glute":
      return "lower_body";
    case "triceps":
    case "biceps":
    case "core":
    case "accessory":
    default:
      return "arms_core";
  }
}

export function matchesExerciseSelectionGroup(
  exercise: Exercise,
  groupId: ExerciseSelectionGroupId,
): boolean {
  if (groupId === "all") return true;
  if (groupId === "big3")
    return ["squat", "bench", "deadlift"].includes(exercise.category);
  return getExerciseSelectionGroup(exercise) === groupId;
}

export function getExerciseSelectionGroupLabel(exercise: Exercise): string {
  const group = EXERCISE_SELECTION_GROUPS.find(
    (item) => item.id === getExerciseSelectionGroup(exercise),
  );
  return group?.label ?? "その他";
}

export function inferExercisePreset(
  name: string,
  fallbackCategory: Exercise["category"] = "accessory",
): Partial<Exercise> {
  const key = normalizeKey(name);
  const matchedSeed = seedByAlias.get(key);
  if (matchedSeed) {
    const { aliases: _aliases, ...exercise } = matchedSeed;
    return exercise;
  }

  let category = fallbackCategory;
  let subcategory: string | undefined;

  if (/(bench|ベンチ|larsen|ラーセン|incline|インクライン)/.test(key)) {
    category = "bench";
    subcategory = "bench_variant";
  } else if (/(squat|スクワット|ssb|frontsquat|フロント)/.test(key)) {
    category = "squat";
    subcategory = "squat_variant";
  } else if (/(deadlift|デッド|rdl|ルーマニアン|hinge)/.test(key)) {
    category = "deadlift";
    subcategory = "hinge_variant";
  } else if (
    /(landmine|shoulderpress|ショルダー|ohp|overheadpress|press$)/.test(key)
  ) {
    category = "press";
    subcategory = "press_variant";
  } else if (/(sealrow|row|ロウ)/.test(key)) {
    category = "row";
    subcategory = "row_variant";
  } else if (
    /(chinning|chin|pullup|pull-up|latpulldown|ラットプル|懸垂)/.test(key)
  ) {
    category = "vertical_pull";
    subcategory = "vertical_pull_variant";
  } else if (/(adductor|内転)/.test(key)) {
    category = "adductor";
    subcategory = "adductor_variant";
  } else if (/(legextension|レッグエクステ)/.test(key)) {
    category = "quad";
    subcategory = "leg_extension";
  } else if (/(legcurl|レッグカール)/.test(key)) {
    category = "hamstring";
    subcategory = "leg_curl";
  } else if (/(hipthrust|ヒップスラスト|glute)/.test(key)) {
    category = "glute";
    subcategory = "glute_variant";
  } else if (/(bulgarian|lunge|ブルガリアン|ランジ)/.test(key)) {
    category = "single_leg";
    subcategory = "single_leg_variant";
  } else if (/(dip|dips|pressdown|プレスダウン|tricep|トライセプ)/.test(key)) {
    category = "triceps";
    subcategory = "triceps_variant";
  } else if (/(curl|アームカール|bicep)/.test(key)) {
    category = "biceps";
    subcategory = "biceps_variant";
  } else if (/(plank|crunch|ab|core|体幹)/.test(key)) {
    category = "core";
    subcategory = "core_variant";
  }

  const defaults = CATEGORY_DEFAULTS[category];
  const mode = /(pause|ポーズ|pulse|bottom|pin)/.test(key)
    ? "pause"
    : /(tempo|402|420|slow|テンポ)/.test(key)
      ? "tempo"
      : defaults.rep_detection_mode;

  return {
    id: `exercise_${Date.now()}`,
    name,
    category,
    subcategory,
    has_lvp: defaults.has_lvp ?? true,
    machine_weight_steps: defaults.has_lvp ? DEFAULT_MICRO_STEPS : undefined,
    min_rom_threshold: defaults.min_rom_threshold,
    rep_detection_mode: mode,
    target_pause_ms: mode === "pause" ? 300 : 0,
    rom_range_min_cm: defaults.rom_range_min_cm,
    rom_range_max_cm: defaults.rom_range_max_cm,
    description: `${getExerciseCategoryLabel(category)}に分類された自動推定種目。`,
    mvt: defaults.mvt,
    ignore_first_rep_as_setup: false,
  };
}

export function mergeExerciseWithPreset(exercise: Exercise): Exercise {
  const preset = inferExercisePreset(exercise.name, exercise.category);
  return {
    ...preset,
    ...exercise,
    category: exercise.category || preset.category || "accessory",
    subcategory: exercise.subcategory ?? preset.subcategory,
    has_lvp: exercise.has_lvp ?? preset.has_lvp ?? true,
    machine_weight_steps:
      exercise.machine_weight_steps ?? preset.machine_weight_steps,
    min_rom_threshold: exercise.min_rom_threshold ?? preset.min_rom_threshold,
    rep_detection_mode:
      exercise.rep_detection_mode ?? preset.rep_detection_mode,
    target_pause_ms: exercise.target_pause_ms ?? preset.target_pause_ms,
    rom_range_min_cm: exercise.rom_range_min_cm ?? preset.rom_range_min_cm,
    rom_range_max_cm: exercise.rom_range_max_cm ?? preset.rom_range_max_cm,
    description: exercise.description ?? preset.description,
    mvt: exercise.mvt ?? preset.mvt,
    ignore_first_rep_as_setup:
      exercise.ignore_first_rep_as_setup ??
      preset.ignore_first_rep_as_setup ??
      false,
  };
}
