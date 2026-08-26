import type { Exercise } from "@/src/types/index";
import { formatLoadKgTwoDecimals } from "../utils/LoadPrecision";

export type ExerciseSelectionGroupId =
  | "all"
  | "bench"
  | "squat"
  | "deadlift"
  | "chest"
  | "shoulders"
  | "back"
  | "quads"
  | "posterior_chain"
  | "adductors"
  | "arms"
  | "core"
  | "other";

type ExerciseSeed = Exercise & {
  aliases?: string[];
};

const DEFAULT_MICRO_STEPS = [0.5, 1, 2.5, 5];

export const EXERCISE_CATEGORY_LABELS: Record<Exercise["category"], string> = {
  squat: "スクワット系",
  bench: "ベンチプレス系",
  deadlift: "デッドリフト系",
  press: "ベンチ補助（肩プレス）",
  pull: "プル系",
  row: "ロウ系",
  vertical_pull: "懸垂・ラット系",
  single_leg: "スクワット補助（片脚）",
  quad: "スクワット補助（四頭）",
  hamstring: "デッド補助（ハム）",
  adductor: "スクワット/デッド補助（内転）",
  glute: "デッド補助（臀部）",
  triceps: "ベンチ補助（三頭）",
  biceps: "上腕二頭筋",
  core: "体幹",
  accessory: "補助種目",
};

export const EXERCISE_SELECTION_GROUPS: {
  id: ExerciseSelectionGroupId;
  label: string;
}[] = [
  { id: "all", label: "すべて" },
  { id: "bench", label: "ベンチ系" },
  { id: "squat", label: "スクワット系" },
  { id: "deadlift", label: "デッド系" },
  { id: "chest", label: "胸" },
  { id: "shoulders", label: "肩" },
  { id: "back", label: "背中" },
  { id: "quads", label: "脚前" },
  { id: "posterior_chain", label: "ハム・臀部" },
  { id: "adductors", label: "内転筋" },
  { id: "arms", label: "腕" },
  { id: "core", label: "体幹" },
  { id: "other", label: "その他" },
];

export const EXERCISE_EDIT_GROUPS = EXERCISE_SELECTION_GROUPS.filter(
  (group) => group.id !== "all",
) as {
  id: Exclude<ExerciseSelectionGroupId, "all">;
  label: string;
}[];

export const DEFAULT_CATEGORY_BY_SELECTION_GROUP: Record<
  Exclude<ExerciseSelectionGroupId, "all">,
  Exercise["category"]
> = {
  bench: "bench",
  squat: "squat",
  deadlift: "deadlift",
  chest: "bench",
  shoulders: "press",
  back: "row",
  quads: "quad",
  posterior_chain: "hamstring",
  adductors: "adductor",
  arms: "triceps",
  core: "core",
  other: "accessory",
};

export const PRIMARY_SELECTION_GROUP_BY_CATEGORY: Record<
  Exercise["category"],
  Exclude<ExerciseSelectionGroupId, "all">
> = {
  squat: "squat",
  bench: "bench",
  deadlift: "deadlift",
  press: "shoulders",
  pull: "back",
  row: "back",
  vertical_pull: "back",
  single_leg: "quads",
  quad: "quads",
  hamstring: "posterior_chain",
  adductor: "adductors",
  glute: "posterior_chain",
  triceps: "arms",
  biceps: "arms",
  core: "core",
  accessory: "other",
};

export function getDefaultCategoryForSelectionGroup(
  groupId: ExerciseSelectionGroupId,
): Exercise["category"] {
  if (groupId === "all") return "accessory";
  return DEFAULT_CATEGORY_BY_SELECTION_GROUP[groupId];
}

export function getPrimarySelectionGroupForCategory(
  category: Exercise["category"],
): Exclude<ExerciseSelectionGroupId, "all"> {
  return PRIMARY_SELECTION_GROUP_BY_CATEGORY[category] ?? "other";
}

const DEFAULT_EXERCISE_SEEDS: ExerciseSeed[] = [
  {
    id: "low_bar_squat",
    name: "Low Bar Squat",
    category: "squat",
    subcategory: "low_bar_squat",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 24,
    rep_detection_mode: "standard",
    target_pause_ms: 0,
    rom_range_min_cm: 36,
    rom_range_max_cm: 62,
    description:
      "競技スクワットの標準。Squat / Back Squat / 日本語表記の履歴はここへ統合する。",
    mvt: 0.3,
    aliases: [
      "Squat",
      "squt",
      "Back Squat",
      "back squat",
      "backsquat",
      "スクワット",
      "バックスクワット",
      "ローバースクワット",
      "ローバー",
      "low bar",
      "lowbar squat",
      "low ber squat",
      "low ber squad",
      "lowbar",
      "Pause Squat",
      "Paused Squat",
      "Porse squat",
      "Porse Squat",
    ],
  },
  {
    id: "high_bar_squat",
    name: "High Bar Squat",
    category: "squat",
    subcategory: "high_bar_squat",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 24,
    rep_detection_mode: "standard",
    target_pause_ms: 0,
    rom_range_min_cm: 36,
    rom_range_max_cm: 62,
    description:
      "ハイバーポジションのスクワット。ローバーと履歴を分けたい時に使用。",
    mvt: 0.3,
    aliases: ["ハイバースクワット", "ハイバー", "high bar", "highbar squat"],
  },
  {
    id: "front_squat",
    name: "Front Squat",
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
    aliases: ["フロントスクワット"],
  },
  {
    id: "ssb_support_squat",
    name: "SSB Support Squat",
    category: "squat",
    subcategory: "ssb_support_squat",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 20,
    rep_detection_mode: "standard",
    rom_range_min_cm: 28,
    rom_range_max_cm: 52,
    description: "サポート付きSSBスクワット。短めROMにも対応。",
    aliases: ["SSBサポートスクワット", "sbb support squat", "support squat"],
  },
  {
    id: "ssb_adductor_squat",
    name: "SSB Adductor Squat",
    category: "squat",
    subcategory: "ssb_adductor_squat",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 18,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 24,
    rom_range_max_cm: 46,
    description: "内転筋寄りのスタンスを取るSSBスクワット。",
    aliases: ["SSBアダクタースクワット", "ssb adductor  squat"],
  },
  {
    id: "box_squat",
    name: "Box Squat",
    category: "squat",
    subcategory: "box_squat",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 18,
    rep_detection_mode: "pause",
    target_pause_ms: 250,
    rom_range_min_cm: 28,
    rom_range_max_cm: 52,
    description: "ボックスへ一度止めるスクワットバリエーション。",
    aliases: ["ボックススクワット"],
  },
  {
    id: "pendulum_squat",
    name: "Pendulum Squat",
    category: "quad",
    subcategory: "pendulum_squat",
    has_lvp: false,
    machine_weight_steps: [1, 2.5, 5],
    min_rom_threshold: 10,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 10,
    rom_range_max_cm: 30,
    description: "四頭筋寄りのマシンスクワット。",
    aliases: ["ペンデュラムスクワット"],
  },
  {
    id: "bench_press",
    name: "Bench Press",
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
    aliases: [
      "ベンチプレス",
      "ベンチ",
      "ノーマルベンチ",
      "コンペベンチ",
      "bench",
      "Speed Bench Press",
      "speed bench",
      "speed bench press",
      "スピードベンチ",
      "スピードベンチプレス",
    ],
  },
  {
    id: "larsen_bench_press",
    name: "Larsen Bench Press",
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
    aliases: ["ラーセンベンチプレス", "ラーセンベンチ", "larsen bench"],
  },
  {
    id: "larsen_narrow_bench",
    name: "Larsen Narrow Bench",
    category: "bench",
    subcategory: "larsen_narrow_bench",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 12,
    rep_detection_mode: "standard",
    rom_range_min_cm: 14,
    rom_range_max_cm: 30,
    description:
      "脚の反力を抜いたナロー気味ベンチ。Close Grip Bench Pressとは別種目として扱う。",
    mvt: 0.15,
    aliases: [
      "ラーセンナローベンチ",
      "ラーセンナローベンチプレス",
      "larsen narrow bench press",
      "larsen close grip bench",
    ],
  },
  {
    id: "close_grip_bench_press",
    name: "Close Grip Bench Press",
    category: "bench",
    subcategory: "close_grip_bench",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 12,
    rep_detection_mode: "standard",
    rom_range_min_cm: 16,
    rom_range_max_cm: 34,
    description:
      "手幅を狭くしたベンチプレス。ナローベンチの履歴を英語名へ統合する。",
    mvt: 0.15,
    aliases: [
      "ナローベンチプレス",
      "ナローベンチ",
      "narrow bench",
      "close grip bench",
      "close-grip bench",
      "cgbp",
    ],
  },
  {
    id: "larsen_bottom_pulse_bench_press",
    name: "Larsen Bottom Pulse Bench Press",
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
    aliases: [
      "ラーセンボトムパルスベンチプレス",
      "larsen bottom pulse bench",
      "bottom pulse bench",
    ],
  },
  {
    id: "larsen_tempo_bench_press",
    name: "Larsen 4-2-0 Tempo Bench Press",
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
    aliases: [
      "ラーセン4-2-0テンポベンチプレス",
      "テンポベンチプレス",
      "Tempo Bench Press",
      "larsen 4/2/0 tempo bench",
      "tempo bench",
      "4/2/0 tempo bench",
    ],
  },
  {
    id: "incline_bench_press",
    name: "Incline Bench Press",
    category: "bench",
    subcategory: "incline_bench",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 12,
    rep_detection_mode: "standard",
    rom_range_min_cm: 14,
    rom_range_max_cm: 30,
    description: "上胸寄りのベンチプレス。",
    aliases: ["インクラインベンチプレス", "incline bench"],
  },
  {
    id: "deadlift",
    name: "Deadlift",
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
    aliases: ["デッドリフト", "conventional deadlift"],
  },
  {
    id: "sumo_deadlift",
    name: "Sumo Deadlift",
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
    aliases: [
      "相撲デッドリフト",
      "sumo",
      "Tempo Sumo Deadlift",
      "1/2/5 Tempo SumoDeadlift",
      "Pause Sumo Deadlift",
      "Paused Sumo Deadlift",
      "Porse deadlift sumo",
      "Porse Deadlift Sumo",
    ],
  },
  {
    id: "deficit_sumo_deadlift",
    name: "Deficit Sumo Deadlift",
    category: "deadlift",
    subcategory: "deficit_sumo_deadlift",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 18,
    rep_detection_mode: "standard",
    rom_range_min_cm: 24,
    rom_range_max_cm: 48,
    description: "台差を付けた相撲デッド。通常のSumoとは履歴を分ける。",
    aliases: ["デフィシットスモウデッドリフト"],
  },
  {
    id: "sumo_stiff_legged_deadlift",
    name: "Sumo Stiff-Legged Deadlift",
    category: "deadlift",
    subcategory: "stiff_legged_deadlift",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 18,
    rep_detection_mode: "tempo",
    rom_range_min_cm: 20,
    rom_range_max_cm: 42,
    description: "膝を伸ばし気味に行う相撲デッド系ヒンジ。",
    aliases: [
      "Sumo Stiff Legged Deadlift",
      "スモウスティッフレッグデッドリフト",
    ],
  },
  {
    id: "adductor_focused_wide_deadlift",
    name: "Adductor-Focused Wide Deadlift",
    category: "deadlift",
    subcategory: "wide_deadlift",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 18,
    rep_detection_mode: "standard",
    rom_range_min_cm: 22,
    rom_range_max_cm: 40,
    description: "内転筋寄りのワイドスタンスデッド。",
    aliases: [
      "アダクターフォーカスワイドデッドリフト",
      "adductor-focused wide dea",
      "wide deadlift",
    ],
  },
  {
    id: "romanian_deadlift",
    name: "Romanian Deadlift",
    category: "deadlift",
    subcategory: "romanian_deadlift",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 18,
    rep_detection_mode: "tempo",
    rom_range_min_cm: 20,
    rom_range_max_cm: 38,
    description: "ヒップヒンジを強く使うRDL。",
    aliases: ["ルーマニアンデッドリフト", "rdl"],
  },
  {
    id: "shoulder_press",
    name: "Shoulder Press",
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
    aliases: ["ショルダープレス", "overhead press", "ohp"],
  },
  {
    id: "landmine_shoulder_press",
    name: "Landmine Shoulder Press",
    category: "press",
    subcategory: "landmine_press",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 12,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 16,
    rom_range_max_cm: 32,
    description: "斜め軌道のプレス。",
    aliases: ["ランドマインショルダープレス", "landmune shoulder press"],
  },
  {
    id: "cable_face_pull",
    name: "Cable Face Pull",
    category: "press",
    subcategory: "rear_delt_face_pull",
    has_lvp: false,
    machine_weight_steps: [1, 2.5, 5],
    min_rom_threshold: 8,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 10,
    rom_range_max_cm: 28,
    description: "リアデルタ・外旋系の肩補助種目。",
    aliases: ["ケーブルフェイスプル", "face pull", "cable facepull"],
  },
  {
    id: "cable_upright_row",
    name: "Cable Upright Row",
    category: "press",
    subcategory: "upright_row",
    has_lvp: false,
    machine_weight_steps: [1, 2.5, 5],
    min_rom_threshold: 8,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 10,
    rom_range_max_cm: 30,
    description: "三角筋狙いのケーブルアップライトロウ。",
    aliases: [
      "ケーブルアップライトロウ",
      "cable up right row",
      "cable upright row",
      "upright row",
    ],
  },
  {
    id: "cable_side_raise",
    name: "Cable Side Raise",
    category: "press",
    subcategory: "side_raise",
    has_lvp: false,
    machine_weight_steps: [1, 2.5, 5],
    min_rom_threshold: 8,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 10,
    rom_range_max_cm: 28,
    description: "三角筋中部狙いのケーブルサイドレイズ。",
    aliases: ["ケーブルサイドレイズ", "side raise", "cable lateral raise"],
  },
  {
    id: "dumbbell_shrug",
    name: "Dumbbell Shrug",
    category: "press",
    subcategory: "shrug",
    has_lvp: false,
    machine_weight_steps: [1, 2.5, 5],
    min_rom_threshold: 8,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 8,
    rom_range_max_cm: 18,
    description: "僧帽筋狙いのシュラッグ。肩グループで扱う。",
    aliases: ["ダンベルシュラッグ", "shrug", "DB Shrug"],
  },
  {
    id: "seal_row",
    name: "Seal Row",
    category: "row",
    subcategory: "seal_row",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 12,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 14,
    rom_range_max_cm: 28,
    description: "胸支持の水平ロウ。",
    aliases: ["シールロウ"],
  },
  {
    id: "t_bar_row",
    name: "T-Bar Row",
    category: "row",
    subcategory: "t_bar_row",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 12,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 14,
    rom_range_max_cm: 30,
    description: "Tバー系の水平ロウ。Tバーロウ表記を統合する。",
    aliases: ["Tバーロウ", "T bar row", "T-Bar Row", "tbar row"],
  },
  {
    id: "barbell_row",
    name: "Barbell Row",
    category: "row",
    subcategory: "barbell_row",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 14,
    rep_detection_mode: "standard",
    rom_range_min_cm: 18,
    rom_range_max_cm: 34,
    description: "フリーウェイトの水平プル。",
    aliases: ["バーベルロウ", "row"],
  },
  {
    id: "one_hand_row",
    name: "One-Arm Row",
    category: "row",
    subcategory: "one_arm_row",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 12,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 14,
    rom_range_max_cm: 32,
    description: "片手で行うロウ種目。",
    aliases: ["One Hand row", "One Hand Row", "ワンハンドロウ", "one arm row"],
  },
  {
    id: "chinning",
    name: "Chinning",
    category: "vertical_pull",
    subcategory: "chin_up",
    has_lvp: true,
    min_rom_threshold: 16,
    rep_detection_mode: "standard",
    rom_range_min_cm: 18,
    rom_range_max_cm: 38,
    description: "自重または加重の懸垂。",
    aliases: ["チンニング", "懸垂", "chin up", "pull-up", "pull up"],
  },
  {
    id: "lat_pulldown",
    name: "Lat Pulldown",
    category: "vertical_pull",
    subcategory: "lat_pulldown",
    has_lvp: true,
    min_rom_threshold: 16,
    rep_detection_mode: "standard",
    rom_range_min_cm: 18,
    rom_range_max_cm: 36,
    description: "縦引きマシン種目。",
    aliases: [
      "ラットプルダウン",
      "lat pull down",
      "Lat pull down delta.co",
      "Lat pull mag grip narrow reverse",
      "REVERSE FRONT LAT PULLDOWN",
      "Lat Pull or Row",
      "Lat pull or Face Pull",
    ],
  },
  {
    id: "dips",
    name: "Dips",
    category: "triceps",
    subcategory: "dips",
    has_lvp: true,
    min_rom_threshold: 12,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 14,
    rom_range_max_cm: 30,
    description: "胸・三頭狙いの自重プレス。",
    aliases: ["ディップス", "dip"],
  },
  {
    id: "cable_press_down",
    name: "Cable Pressdown",
    category: "triceps",
    subcategory: "press_down",
    has_lvp: false,
    min_rom_threshold: 8,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 10,
    rom_range_max_cm: 24,
    description: "三頭狙いのケーブル種目。",
    aliases: ["ケーブルプレスダウン", "cable press down", "press down"],
  },
  {
    id: "cable_french_press",
    name: "Cable French Press",
    category: "triceps",
    subcategory: "triceps_extension",
    has_lvp: false,
    machine_weight_steps: [1, 2.5, 5],
    min_rom_threshold: 8,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 10,
    rom_range_max_cm: 28,
    description: "三頭長頭狙いのケーブルエクステンション。",
    aliases: [
      "トライセプスエクステンション",
      "Triceps Extension",
      "Cable Triceps Extension",
      "french press",
    ],
  },
  {
    id: "arm_curl",
    name: "Arm Curl",
    category: "biceps",
    subcategory: "curl",
    has_lvp: false,
    min_rom_threshold: 8,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 10,
    rom_range_max_cm: 22,
    description: "二頭筋の補助種目。",
    aliases: [
      "アームカール",
      "bicep curl",
      "curl",
      "Cable arm Curl",
      "Cable arm curl wide",
      "cable arm curl",
    ],
  },
  {
    id: "leg_extension_delta",
    name: "Leg Extension DELTA",
    category: "quad",
    subcategory: "leg_extension",
    has_lvp: false,
    min_rom_threshold: 10,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 12,
    rom_range_max_cm: 26,
    description: "四頭筋メインのマシン種目。",
    aliases: ["レッグエクステンション DELTA", "leg extension"],
  },
  {
    id: "leg_curl_delta",
    name: "Leg Curl DELTA",
    category: "hamstring",
    subcategory: "leg_curl",
    has_lvp: false,
    min_rom_threshold: 10,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 12,
    rom_range_max_cm: 24,
    description: "ハムストリングのマシン種目。",
    aliases: ["レッグカール DELTA", "leg curl"],
  },
  {
    id: "adductor_delta",
    name: "Adductor DELTA",
    category: "adductor",
    subcategory: "adductor_machine",
    has_lvp: false,
    min_rom_threshold: 8,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 10,
    rom_range_max_cm: 22,
    description: "内転筋のマシン種目。",
    aliases: ["アダクター DELTA", "adductor delta new", "adductor"],
  },
  {
    id: "hip_thrust",
    name: "Hip Thrust",
    category: "glute",
    subcategory: "hip_thrust",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 12,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 14,
    rom_range_max_cm: 28,
    description: "臀部主導のヒップエクステンション。",
    aliases: ["ヒップスラスト"],
  },
  {
    id: "bulgarian_split_squat",
    name: "Bulgarian Split Squat",
    category: "single_leg",
    subcategory: "bulgarian_split_squat",
    has_lvp: true,
    machine_weight_steps: DEFAULT_MICRO_STEPS,
    min_rom_threshold: 18,
    rep_detection_mode: "standard",
    rom_range_min_cm: 22,
    rom_range_max_cm: 40,
    description: "片脚の安定性と脚力強化に。",
    aliases: ["ブルガリアンスクワット", "bulgarian squat"],
  },
  {
    id: "pec_fly",
    name: "Pec Fly",
    category: "bench",
    subcategory: "chest_fly",
    has_lvp: false,
    machine_weight_steps: [1, 2.5, 5],
    min_rom_threshold: 8,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 12,
    rom_range_max_cm: 36,
    description: "胸狙いのフライ。Short-Range Pec Flyもここへ統合する。",
    aliases: [
      "ペックフライ",
      "pec deck",
      "Pec Deck Fly",
      "Short-Range Pec Fly",
    ],
  },
  {
    id: "reverse_pec_deck_fly",
    name: "Reverse Pec Deck Fly",
    category: "press",
    subcategory: "rear_delt_fly",
    has_lvp: false,
    machine_weight_steps: [1, 2.5, 5],
    min_rom_threshold: 8,
    rep_detection_mode: "short_rom",
    rom_range_min_cm: 12,
    rom_range_max_cm: 28,
    description: "リアデルト狙いのリバースペックデック。",
    aliases: ["リバースペックデック", "Rear Delt Fly", "rear delt fly"],
  },
];

export const DEFAULT_EXERCISES: Exercise[] = DEFAULT_EXERCISE_SEEDS.map(
  ({ aliases: _aliases, ...exercise }) => exercise,
);

const normalizeExerciseCatalogName = (name: string) =>
  name.trim().toLowerCase().replace(/\s+/g, " ");

const DEFAULT_EXERCISE_IDS = new Set(
  DEFAULT_EXERCISES.map((exercise) => exercise.id),
);
const DEFAULT_EXERCISE_NAMES = new Set(
  DEFAULT_EXERCISES.map((exercise) =>
    normalizeExerciseCatalogName(exercise.name),
  ),
);

export function isDefaultExerciseCatalogItem(
  exercise: Pick<Exercise, "id" | "name">,
): boolean {
  return (
    DEFAULT_EXERCISE_IDS.has(exercise.id) ||
    DEFAULT_EXERCISE_NAMES.has(normalizeExerciseCatalogName(exercise.name))
  );
}

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
  return formatLoadKgTwoDecimals(value);
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

export function getCanonicalExerciseSeed(name: string): Exercise | null {
  const seed = seedByAlias.get(normalizeKey(name));
  if (!seed) return null;
  const { aliases: _aliases, ...exercise } = seed;
  return exercise;
}

export function getCanonicalExerciseName(name: string): string {
  return getCanonicalExerciseSeed(name)?.name ?? name;
}

export function getCanonicalExerciseMigrationPairs(): {
  from: string;
  to: string;
}[] {
  const pairs: { from: string; to: string }[] = [];

  for (const seed of DEFAULT_EXERCISE_SEEDS) {
    for (const alias of seed.aliases ?? []) {
      if (normalizeKey(alias) === normalizeKey(seed.name)) continue;
      pairs.push({ from: alias, to: seed.name });
    }
  }

  return pairs;
}

export function isBig3Exercise(
  exercise: Pick<Exercise, "id" | "category" | "subcategory">,
): boolean {
  return (
    exercise.id === "squat" ||
    exercise.id === "low_bar_squat" ||
    exercise.id === "bench_press" ||
    exercise.id === "deadlift" ||
    exercise.subcategory === "low_bar_squat" ||
    exercise.subcategory === "competition_squat" ||
    exercise.subcategory === "competition_bench" ||
    exercise.subcategory === "conventional_deadlift"
  );
}

export function getExerciseSelectionGroup(
  exercise: Exercise,
): ExerciseSelectionGroupId {
  const groups = getExerciseSelectionGroups(exercise);
  const primaryGroup = groups.find((group) =>
    ["bench", "squat", "deadlift"].includes(group),
  );
  if (primaryGroup) return primaryGroup;

  return groups[0] ?? "other";
}

export function getExerciseSelectionGroups(
  exercise: Pick<Exercise, "category">,
): ExerciseSelectionGroupId[] {
  const groups = new Set<ExerciseSelectionGroupId>();

  if (
    exercise.category === "bench" ||
    exercise.category === "press" ||
    exercise.category === "triceps"
  ) {
    groups.add("bench");
  }

  if (
    exercise.category === "squat" ||
    exercise.category === "quad" ||
    exercise.category === "single_leg" ||
    exercise.category === "adductor"
  ) {
    groups.add("squat");
  }

  if (
    exercise.category === "deadlift" ||
    exercise.category === "hamstring" ||
    exercise.category === "glute" ||
    exercise.category === "adductor"
  ) {
    groups.add("deadlift");
  }

  switch (exercise.category) {
    case "bench":
      groups.add("chest");
      break;
    case "squat":
      groups.add("quads");
      break;
    case "deadlift":
      groups.add("posterior_chain");
      break;
    case "press":
      groups.add("shoulders");
      break;
    case "pull":
    case "row":
    case "vertical_pull":
      groups.add("back");
      break;
    case "single_leg":
    case "quad":
      groups.add("quads");
      break;
    case "adductor":
      groups.add("adductors");
      break;
    case "hamstring":
    case "glute":
      groups.add("posterior_chain");
      break;
    case "triceps":
    case "biceps":
      groups.add("arms");
      break;
    case "core":
      groups.add("core");
      break;
    case "accessory":
    default:
      groups.add("other");
      break;
  }

  return Array.from(groups);
}

export function matchesExerciseSelectionGroup(
  exercise: Exercise,
  groupId: ExerciseSelectionGroupId,
): boolean {
  if (groupId === "all") return true;
  return getExerciseSelectionGroups(exercise).includes(groupId);
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

  if (
    /(reverse|reardelt|リア|後部)/.test(key) &&
    /(fly|フライ|pecdeck)/.test(key)
  ) {
    category = "press";
    subcategory = "rear_delt_fly";
  } else if (
    /(pecfly|pecdeck|chestfly|chest.*fly|ペック|胸.*フライ)/.test(key)
  ) {
    category = "bench";
    subcategory = "chest_fly";
  } else if (
    /(bench|ベンチ|larsen|ラーセン|incline|インクライン|ナロー)/.test(key)
  ) {
    category = "bench";
    subcategory = /(closegrip|narrow|ナロー)/.test(key)
      ? "close_grip_bench"
      : "bench_variant";
  } else if (
    /(squat|スクワット|ssb|frontsquat|フロント|ローバー|ハイバー)/.test(key)
  ) {
    category = "squat";
    subcategory = /ローバー|lowbar/.test(key)
      ? "low_bar_squat"
      : /ハイバー|highbar/.test(key)
        ? "high_bar_squat"
        : "squat_variant";
  } else if (/(deadlift|デッド|rdl|ルーマニアン|hinge)/.test(key)) {
    category = "deadlift";
    subcategory = "hinge_variant";
  } else if (
    /(facepull|フェイスプル|uprightrow|upright|アップライト)/.test(key)
  ) {
    category = "press";
    subcategory = /facepull|フェイスプル/.test(key)
      ? "rear_delt_face_pull"
      : "upright_row";
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
    auto_start_rom_cm: exercise.auto_start_rom_cm ?? preset.auto_start_rom_cm,
  };
}
