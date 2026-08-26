import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const repoRoot = process.cwd();
const outputDir = path.join(repoRoot, "outputs", "exercise-category-edit");
const outputPath = path.join(
  outputDir,
  "repvelocoach_actual_app_exercises_edit.xlsx",
);

const catalogPath = path.join(repoRoot, "src", "constants", "exerciseCatalog.ts");
const catalog = await fs.readFile(catalogPath, "utf8");

function extractBalanced(source, startNeedle, openChar, closeChar, fromAfterEquals = false) {
  const start = source.indexOf(startNeedle);
  if (start < 0) throw new Error(`Missing ${startNeedle}`);
  const searchStart = fromAfterEquals ? source.indexOf("=", start) : start;
  const open = source.indexOf(openChar, searchStart);
  let depth = 0;
  let inString = null;
  let escaped = false;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === inString) {
        inString = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = ch;
      continue;
    }
    if (ch === openChar) depth += 1;
    if (ch === closeChar) depth -= 1;
    if (depth === 0) return source.slice(open, i + 1);
  }
  throw new Error(`Unclosed ${startNeedle}`);
}

const seedsText = extractBalanced(
  catalog,
  "const DEFAULT_EXERCISE_SEEDS",
  "[",
  "]",
  true,
);
const categoryLabelsText = extractBalanced(
  catalog,
  "EXERCISE_CATEGORY_LABELS",
  "{",
  "}",
);
const selectionGroupsText = extractBalanced(
  catalog,
  "EXERCISE_SELECTION_GROUPS",
  "[",
  "]",
  true,
);

const DEFAULT_MICRO_STEPS = [0.5, 1, 2.5, 5];
const seeds = Function(
  "DEFAULT_MICRO_STEPS",
  `"use strict"; return (${seedsText});`,
)(DEFAULT_MICRO_STEPS);
const categoryLabels = Function(
  `"use strict"; return (${categoryLabelsText});`,
)();
const selectionGroups = Function(
  `"use strict"; return (${selectionGroupsText});`,
)();

const categoryIds = Object.keys(categoryLabels);
const categoryLabelById = categoryLabels;
const groupIds = selectionGroups.filter((group) => group.id !== "all").map((g) => g.id);
const groupLabelById = Object.fromEntries(selectionGroups.map((g) => [g.id, g.label]));

function normalizeName(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeKey(value) {
  return normalizeName(value).toLowerCase().replace(/[^a-z0-9ぁ-んァ-ヶ一-龯]+/g, "");
}

function inferCategory(name, fallback = "accessory") {
  const key = normalizeKey(name);
  let category = fallback;
  let subcategory = "";
  if (/(reverse|reardelt|リア|後部)/.test(key) && /(fly|フライ|pecdeck)/.test(key)) {
    category = "press";
    subcategory = "rear_delt_fly";
  } else if (/(pecfly|pecdeck|chestfly|chest.*fly|ペック|胸.*フライ)/.test(key)) {
    category = "bench";
    subcategory = "chest_fly";
  } else if (/(bench|ベンチ|larsen|ラーセン|incline|インクライン|ナロー)/.test(key)) {
    category = "bench";
    subcategory = /(closegrip|narrow|ナロー)/.test(key) ? "close_grip_bench" : "bench_variant";
  } else if (/(squat|スクワット|ssb|frontsquat|フロント|ローバー|ハイバー)/.test(key)) {
    category = "squat";
    subcategory = /ローバー|lowbar/.test(key)
      ? "low_bar_squat"
      : /ハイバー|highbar/.test(key)
        ? "high_bar_squat"
        : "squat_variant";
  } else if (/(deadlift|デッド|rdl|ルーマニアン|hinge)/.test(key)) {
    category = "deadlift";
    subcategory = "hinge_variant";
  } else if (/(facepull|フェイスプル|uprightrow|upright|アップライト)/.test(key)) {
    category = "press";
    subcategory = /facepull|フェイスプル/.test(key) ? "rear_delt_face_pull" : "upright_row";
  } else if (/(landmine|shoulderpress|ショルダー|ohp|overheadpress|press$|sideraise|sideraise|サイドレイズ|shrug|シュラッグ)/.test(key)) {
    category = "press";
    subcategory = /(sideraise|sideraise|サイドレイズ)/.test(key)
      ? "side_raise"
      : /(shrug|シュラッグ)/.test(key)
        ? "shrug"
        : "press_variant";
  } else if (/(sealrow|row|ロウ|ロー|tバー|tbar|tバーロウ)/.test(key)) {
    category = "row";
    subcategory = "row_variant";
  } else if (/(chinning|chin|pullup|pull-up|latpulldown|latpull|ラットプル|懸垂)/.test(key)) {
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
  } else if (/(dip|dips|pressdown|プレスダウン|tricep|トライセプ|frenchpress|extension|エクステンション)/.test(key)) {
    category = "triceps";
    subcategory = /(frenchpress|extension|エクステンション)/.test(key)
      ? "triceps_extension"
      : "triceps_variant";
  } else if (/(curl|アームカール|bicep)/.test(key)) {
    category = "biceps";
    subcategory = "biceps_variant";
  } else if (/(pallof|plank|crunch|ab|core|体幹)/.test(key)) {
    category = "core";
    subcategory = "core_variant";
  }
  return { category, subcategory };
}

function primaryGroupForCategory(category) {
  const map = {
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
  return map[category] ?? "other";
}

const seedByKey = new Map();
for (const seed of seeds) {
  seedByKey.set(normalizeKey(seed.name), seed);
  for (const alias of seed.aliases ?? []) {
    seedByKey.set(normalizeKey(alias), seed);
  }
}

const rowsByKey = new Map();
function upsertName(name, source, type, occurrences = 1) {
  const displayName = normalizeName(name);
  if (!displayName) return;
  if (/^\d+(\.\d+)?$/.test(displayName)) return;
  if (/^(BP|SQ|DL)\s+\d/i.test(displayName)) return;
  if (displayName.length > 80) return;
  const key = normalizeKey(displayName);
  if (!key) return;
  const seed = seedByKey.get(key);
  const inferred = seed
    ? { category: seed.category, subcategory: seed.subcategory ?? "" }
    : inferCategory(displayName);
  const canonical = seed?.name ?? displayName;
  const rowType = seed?.name === displayName ? "標準親種目" : seed ? "別名/履歴名" : type;
  const current = rowsByKey.get(key);
  if (current) {
    current.sources.add(source);
    current.types.add(rowType);
    current.occurrences += occurrences;
    return;
  }
  rowsByKey.set(key, {
    displayName,
    rowType,
    canonicalId: seed?.id ?? "",
    canonicalName: canonical,
    category: inferred.category,
    categoryLabel: categoryLabelById[inferred.category] ?? inferred.category,
    editGroup: primaryGroupForCategory(inferred.category),
    editGroupLabel: groupLabelById[primaryGroupForCategory(inferred.category)] ?? "",
    subcategory: inferred.subcategory ?? "",
    hasLvp: seed?.has_lvp ?? true,
    repDetectionMode: seed?.rep_detection_mode ?? "standard",
    mvt: seed?.mvt ?? "",
    sources: new Set([source]),
    types: new Set([rowType]),
    occurrences,
    aliases: seed?.aliases?.join(", ") ?? "",
  });
}

for (const seed of seeds) {
  upsertName(seed.name, "DEFAULT_EXERCISE_SEEDS", "標準親種目");
  for (const alias of seed.aliases ?? []) {
    upsertName(alias, `alias:${seed.name}`, "別名/履歴名");
  }
}

const VIDEO_OBSERVED_APP_EXERCISES_20260618 = [
  "1/2/5 Tempo SumoDeadlift",
  "Adductor-Focused Wide Deadlift",
  "Deadlift",
  "Deficit Sumo Deadlift",
  "Porse deadlift sumo",
  "Romanian Deadlift",
  "Sumo Deadlift",
  "Adductor DELTA",
  "Box Squat",
  "High Bar Squat",
  "Leg Extension DELTA",
  "Low Bar Squat",
  "Pendulum Squat",
  "Porse squat",
  "SSB Support Squat",
  "Sumo Stiff-Legged Deadlift",
  "tempo squat",
  "Arm Curl",
  "Cable arm curl wide",
  "Lat pull down delta.co",
  "Lat pull mag grip narrow reverse",
  "Lat Pulldown",
  "One Hand row",
  "REVERSE FRONT LAT PULLDOWN",
  "Seal Row",
  "Bench Press",
  "Cable French Press",
  "Cable Pressdown",
  "Cable Upright Row",
  "Close Grip Bench Press",
  "Landmine Shoulder Press",
  "Larsen 4-2-0 Tempo Bench Press",
  "Larsen Bench Press",
  "Larsen Bottom Pulse Bench Press",
  "Larsen Narrow Bench",
  "Cable arm Curl",
  "Cable Side Raise",
  "Pec Fly",
  "Reverse Pec Deck Fly",
  "Short-Range Pec Fly",
  "ダンベルシュラッグ",
  "トライセプスエクステンション",
  "Cable Face Pull",
];

for (const name of VIDEO_OBSERVED_APP_EXERCISES_20260618) {
  upsertName(name, "ScreenRecording_06-18-2026 種目管理", "実機動画確認");
}

async function listFiles(dir, extensions, result = []) {
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return result;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!["node_modules", ".git", "ios", "android", "build", "dist"].includes(entry.name)) {
        await listFiles(full, extensions, result);
      }
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      result.push(full);
    }
  }
  return result;
}

function walkJson(value, file, counts) {
  if (Array.isArray(value)) {
    for (const item of value) walkJson(item, file, counts);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value)) {
    if (
      ["種目", "exercise", "lift", "currentLift", "current_lift", "main_lift", "name"].includes(key) &&
      typeof item === "string"
    ) {
      counts.set(item, (counts.get(item) ?? 0) + 1);
      upsertName(item, path.relative(repoRoot, file), "メニュー/JSON参照");
    }
    walkJson(item, file, counts);
  }
}

const jsonFiles = await listFiles(path.join(repoRoot, "docs"), [".json"]);
const menuCounts = new Map();
for (const file of jsonFiles) {
  const json = JSON.parse(await fs.readFile(file, "utf8"));
  walkJson(json, file, menuCounts);
}

const sourceFiles = await listFiles(path.join(repoRoot, "src"), [".ts", ".tsx"]);
for (const file of sourceFiles) {
  const text = await fs.readFile(file, "utf8");
  const patterns = [
    /lift:\s*["']([^"'\n]{2,80})["']/g,
    /currentLift:\s*["']([^"'\n]{2,80})["']/g,
    /["']([A-Z][A-Za-z]*(?:\s+[A-Za-z0-9]+){0,5})["']\s*:/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = match[1];
      if (/(Press|Squat|Deadlift|Row|Chin|Curl|Dips|Fly|Pec|Pull|Extension|Adductor|Thrust|Lunge|Bench)/i.test(value)) {
        upsertName(value, path.relative(repoRoot, file), "コード参照");
      }
    }
  }
}

const rows = Array.from(rowsByKey.values()).sort((a, b) => {
  const groupCompare = a.editGroup.localeCompare(b.editGroup);
  if (groupCompare !== 0) return groupCompare;
  const typeOrder = { "標準親種目": 0, "別名/履歴名": 1, "メニュー/JSON参照": 2, "コード参照": 3 };
  const ta = Math.min(...Array.from(a.types).map((type) => typeOrder[type] ?? 9));
  const tb = Math.min(...Array.from(b.types).map((type) => typeOrder[type] ?? 9));
  if (ta !== tb) return ta - tb;
  return a.displayName.localeCompare(b.displayName, "ja");
});

await fs.mkdir(outputDir, { recursive: true });

const workbook = Workbook.create();
const main = workbook.worksheets.add("実アプリ種目編集");
const parent = workbook.worksheets.add("親種目一覧");
const options = workbook.worksheets.add("選択肢");
const notes = workbook.worksheets.add("使い方");

function setValues(sheet, address, values) {
  sheet.getRange(address).values = values;
}

setValues(notes, "A1:D10", [
  ["RepVeloCoach 実アプリ種目カテゴリ編集表", "", "", ""],
  ["対象", "このビルドに入る標準種目、別名、メニューJSON、コード内プリセット/リフト参照を全て表示名単位で抽出", "", ""],
  ["編集方法", "E列 現在カテゴリ / G列 表示グループ / I列 サブカテゴリ / P列 変更メモを編集", "", ""],
  ["重要", "実機でアプリ内から新規追加したカスタム種目は、このMac側でDBエクスポートを受け取らない限り完全取得できません。", "", ""],
  ["次の実装案", "このExcelを反映するインポート処理、またはアプリ内「種目マスターを書き出し」ボタンを追加可能", "", ""],
  ["抽出件数", rows.length, "", ""],
  ["標準親種目数", seeds.length, "", ""],
  ["カテゴリ数", categoryIds.length, "", ""],
  ["表示グループ数", groupIds.length, "", ""],
  ["出力ファイル", outputPath, "", ""],
]);

const headers = [
  "表示名/実際に出る名前",
  "行種別",
  "正規化先ID",
  "正規化先/親種目名",
  "現在カテゴリ",
  "カテゴリ表示名",
  "表示グループ",
  "表示グループ名",
  "サブカテゴリ",
  "LVP",
  "検出モード",
  "MVT",
  "出典",
  "出現回数",
  "親種目の別名一覧",
  "変更メモ",
];
setValues(main, `A1:P${rows.length + 1}`, [
  headers,
  ...rows.map((row) => [
    row.displayName,
    Array.from(row.types).join(" / "),
    row.canonicalId,
    row.canonicalName,
    row.category,
    row.categoryLabel,
    row.editGroup,
    row.editGroupLabel,
    row.subcategory,
    row.hasLvp ? "TRUE" : "FALSE",
    row.repDetectionMode,
    row.mvt,
    Array.from(row.sources).join(" / "),
    row.occurrences,
    row.aliases,
    "",
  ]),
]);

setValues(parent, `A1:N${seeds.length + 1}`, [
  [
    "ID",
    "親種目名",
    "現在カテゴリ",
    "カテゴリ表示名",
    "表示グループ",
    "表示グループ名",
    "サブカテゴリ",
    "LVP",
    "検出モード",
    "MVT",
    "最小ROM",
    "ROM範囲",
    "別名",
    "説明",
  ],
  ...seeds.map((seed) => {
    const group = primaryGroupForCategory(seed.category);
    return [
      seed.id,
      seed.name,
      seed.category,
      categoryLabelById[seed.category] ?? seed.category,
      group,
      groupLabelById[group] ?? "",
      seed.subcategory ?? "",
      seed.has_lvp ? "TRUE" : "FALSE",
      seed.rep_detection_mode ?? "standard",
      seed.mvt ?? "",
      seed.min_rom_threshold ?? "",
      `${seed.rom_range_min_cm ?? ""}-${seed.rom_range_max_cm ?? ""}`,
      (seed.aliases ?? []).join(", "),
      seed.description ?? "",
    ];
  }),
]);

setValues(options, `A1:B${categoryIds.length + 1}`, [
  ["category_id", "label"],
  ...categoryIds.map((id) => [id, categoryLabelById[id]]),
]);
setValues(options, `D1:E${groupIds.length + 1}`, [
  ["group_id", "label"],
  ...groupIds.map((id) => [id, groupLabelById[id]]),
]);
setValues(options, "G1:G6", [
  ["rep_detection_mode"],
  ["standard"],
  ["short_rom"],
  ["pause"],
  ["tempo"],
  ["machine"],
]);

for (const sheet of [main, parent, options, notes]) {
  sheet.getRange("A1:Z1").format = {
    fontWeight: "bold",
    fill: { color: "#171717" },
    fontColor: "#FFFFFF",
  };
}
main.getRange("A:P").format = { wrapText: true, verticalAlignment: "top" };
parent.getRange("A:N").format = { wrapText: true, verticalAlignment: "top" };
main.getRange("A1:P1").autoFilter = true;
parent.getRange("A1:N1").autoFilter = true;

const mainLastRow = Math.max(rows.length + 1, 2);
main.getRange(`E2:E${mainLastRow}`).dataValidation = {
  type: "list",
  formula1: `"${categoryIds.join(",")}"`,
  allowBlank: false,
};
main.getRange(`G2:G${mainLastRow}`).dataValidation = {
  type: "list",
  formula1: `"${groupIds.join(",")}"`,
  allowBlank: false,
};
main.getRange(`J2:J${mainLastRow}`).dataValidation = {
  type: "list",
  formula1: '"TRUE,FALSE"',
  allowBlank: false,
};
main.getRange(`K2:K${mainLastRow}`).dataValidation = {
  type: "list",
  formula1: '"standard,short_rom,pause,tempo,machine"',
  allowBlank: false,
};

parent.getRange(`C2:C${seeds.length + 1}`).dataValidation = {
  type: "list",
  formula1: `"${categoryIds.join(",")}"`,
  allowBlank: false,
};
parent.getRange(`E2:E${seeds.length + 1}`).dataValidation = {
  type: "list",
  formula1: `"${groupIds.join(",")}"`,
  allowBlank: false,
};

const widths = {
  A: 220,
  B: 150,
  C: 140,
  D: 220,
  E: 120,
  F: 170,
  G: 140,
  H: 150,
  I: 170,
  J: 70,
  K: 120,
  L: 70,
  M: 340,
  N: 80,
  O: 360,
  P: 260,
};
for (const [col, widthPx] of Object.entries(widths)) {
  main.getRange(`${col}:${col}`).columnWidthPx = widthPx;
}
for (const [col, widthPx] of Object.entries({
  A: 160,
  B: 220,
  C: 120,
  D: 170,
  E: 140,
  F: 150,
  G: 170,
  H: 70,
  I: 120,
  J: 70,
  K: 90,
  L: 110,
  M: 360,
  N: 360,
})) {
  parent.getRange(`${col}:${col}`).columnWidthPx = widthPx;
}
notes.getRange("A:A").columnWidthPx = 180;
notes.getRange("B:B").columnWidthPx = 760;

const inspect = await workbook.inspect({
  kind: "table",
  range: `実アプリ種目編集!A1:P${Math.min(18, mainLastRow)}`,
  include: "values",
  tableMaxRows: 18,
  tableMaxCols: 16,
});
console.log(inspect.ndjson);
const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula errors",
});
console.log(errors.ndjson);

await workbook.render({ sheetName: "実アプリ種目編集", range: "A1:P18", scale: 1 });
await workbook.render({ sheetName: "親種目一覧", range: "A1:N18", scale: 1 });
await workbook.render({ sheetName: "使い方", range: "A1:B10", scale: 1 });

const exported = await SpreadsheetFile.exportXlsx(workbook);
await exported.save(outputPath);

const loaded = await SpreadsheetFile.importXlsx(await FileBlob.load(outputPath));
const validation = await loaded.inspect({
  kind: "match",
  searchTerm: "スクワット|バックスクワット|テンポベンチプレス|Tバーロウ|Pec Fly|Reverse Pec Deck|ナロー|ブルガリアン",
  options: { useRegex: true, maxResults: 50 },
  summary: "required exercise names",
});
console.log(validation.ndjson);
console.log(JSON.stringify({ outputPath, rows: rows.length, seeds: seeds.length }, null, 2));
