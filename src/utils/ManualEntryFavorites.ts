import AsyncStorage from "@react-native-async-storage/async-storage";
import type { SetType } from "../types/index";

export const MANUAL_ENTRY_FAVORITES_KEY =
  "repvelocoach.manual_entry.favorite_presets.v1";

const DEFAULT_TIMESTAMP = "2026-08-05T00:00:00.000Z";
const MAX_FAVORITE_PRESETS = 18;

export interface ManualEntryFavoritePreset {
  id: string;
  exerciseName: string;
  loadKg: number;
  reps: number | null;
  setType: SetType;
  createdAt: string;
  lastUsedAt: string;
  useCount: number;
}

export const DEFAULT_MANUAL_ENTRY_FAVORITES: ManualEntryFavoritePreset[] = [
  {
    id: "default-chinning-bw-8-normal",
    exerciseName: "Chinning",
    loadKg: 0,
    reps: 8,
    setType: "normal",
    createdAt: DEFAULT_TIMESTAMP,
    lastUsedAt: DEFAULT_TIMESTAMP,
    useCount: 0,
  },
  {
    id: "default-chinning-plus10-5-normal",
    exerciseName: "Chinning",
    loadKg: 10,
    reps: 5,
    setType: "normal",
    createdAt: DEFAULT_TIMESTAMP,
    lastUsedAt: DEFAULT_TIMESTAMP,
    useCount: 0,
  },
  {
    id: "default-dips-bw-10-normal",
    exerciseName: "Dips",
    loadKg: 0,
    reps: 10,
    setType: "normal",
    createdAt: DEFAULT_TIMESTAMP,
    lastUsedAt: DEFAULT_TIMESTAMP,
    useCount: 0,
  },
];

const normalizeExerciseName = (value: string): string =>
  value.trim().replace(/\s+/g, " ");

const normalizeLoad = (value: number): number =>
  Number.isFinite(value) ? Math.round(value * 10) / 10 : 0;

const normalizeReps = (value?: number | null): number | null => {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return Math.round(value);
};

const idPart = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const buildManualEntryFavoriteId = (
  exerciseName: string,
  loadKg: number,
  reps?: number | null,
  setType: SetType = "normal",
): string => {
  const exercise = idPart(normalizeExerciseName(exerciseName)) || "exercise";
  const load = normalizeLoad(loadKg).toString().replace(".", "p");
  const repPart = normalizeReps(reps);
  return `${exercise}-${load}kg-${repPart ?? "any"}rep-${setType}`;
};

export const normalizeManualEntryFavoritePreset = (
  preset: Partial<ManualEntryFavoritePreset> & {
    exerciseName: string;
    loadKg: number;
  },
  nowIso = new Date().toISOString(),
): ManualEntryFavoritePreset => {
  const exerciseName = normalizeExerciseName(preset.exerciseName);
  const loadKg = normalizeLoad(preset.loadKg);
  const reps = normalizeReps(preset.reps);
  const setType = preset.setType ?? "normal";

  return {
    id:
      preset.id ??
      buildManualEntryFavoriteId(exerciseName, loadKg, reps, setType),
    exerciseName,
    loadKg,
    reps,
    setType,
    createdAt: preset.createdAt ?? nowIso,
    lastUsedAt: preset.lastUsedAt ?? nowIso,
    useCount: Math.max(0, Math.round(preset.useCount ?? 0)),
  };
};

export const sortManualEntryFavoritePresets = (
  presets: ManualEntryFavoritePreset[],
): ManualEntryFavoritePreset[] =>
  presets.slice().sort((a, b) => {
    if (b.useCount !== a.useCount) return b.useCount - a.useCount;
    const timeDiff =
      new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime();
    if (Number.isFinite(timeDiff) && timeDiff !== 0) return timeDiff;
    return a.exerciseName.localeCompare(b.exerciseName);
  });

export const upsertManualEntryFavoritePreset = (
  presets: ManualEntryFavoritePreset[],
  nextPreset: Partial<ManualEntryFavoritePreset> & {
    exerciseName: string;
    loadKg: number;
  },
  nowIso = new Date().toISOString(),
): ManualEntryFavoritePreset[] => {
  const normalized = normalizeManualEntryFavoritePreset(nextPreset, nowIso);
  const existingIndex = presets.findIndex(
    (preset) =>
      buildManualEntryFavoriteId(
        preset.exerciseName,
        preset.loadKg,
        preset.reps,
        preset.setType,
      ) === normalized.id || preset.id === normalized.id,
  );

  const next =
    existingIndex >= 0
      ? presets.map((preset, index) =>
          index === existingIndex
            ? {
                ...preset,
                ...normalized,
                id: preset.id,
                createdAt: preset.createdAt,
                lastUsedAt: nowIso,
                useCount: preset.useCount + 1,
              }
            : preset,
        )
      : [
          ...presets,
          {
            ...normalized,
            lastUsedAt: nowIso,
            useCount: Math.max(1, normalized.useCount),
          },
        ];

  return sortManualEntryFavoritePresets(next).slice(0, MAX_FAVORITE_PRESETS);
};

export const loadManualEntryFavoritePresets = async (): Promise<
  ManualEntryFavoritePreset[]
> => {
  const raw = await AsyncStorage.getItem(MANUAL_ENTRY_FAVORITES_KEY);
  if (!raw) return DEFAULT_MANUAL_ENTRY_FAVORITES;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_MANUAL_ENTRY_FAVORITES;
    const normalized = parsed
      .map((preset) => {
        if (!preset?.exerciseName || preset.loadKg == null) return null;
        return normalizeManualEntryFavoritePreset(preset);
      })
      .filter((preset): preset is ManualEntryFavoritePreset => preset != null);
    return sortManualEntryFavoritePresets(normalized).slice(
      0,
      MAX_FAVORITE_PRESETS,
    );
  } catch {
    return DEFAULT_MANUAL_ENTRY_FAVORITES;
  }
};

export const saveManualEntryFavoritePresets = async (
  presets: ManualEntryFavoritePreset[],
): Promise<void> => {
  await AsyncStorage.setItem(
    MANUAL_ENTRY_FAVORITES_KEY,
    JSON.stringify(sortManualEntryFavoritePresets(presets)),
  );
};

export const registerManualEntryFavoritePreset = async (
  presets: ManualEntryFavoritePreset[],
  nextPreset: Partial<ManualEntryFavoritePreset> & {
    exerciseName: string;
    loadKg: number;
  },
): Promise<ManualEntryFavoritePreset[]> => {
  const next = upsertManualEntryFavoritePreset(presets, nextPreset);
  await saveManualEntryFavoritePresets(next);
  return next;
};

export const touchManualEntryFavoritePreset = async (
  presets: ManualEntryFavoritePreset[],
  id: string,
  nowIso = new Date().toISOString(),
): Promise<ManualEntryFavoritePreset[]> => {
  const next = sortManualEntryFavoritePresets(
    presets.map((preset) =>
      preset.id === id
        ? {
            ...preset,
            lastUsedAt: nowIso,
            useCount: preset.useCount + 1,
          }
        : preset,
    ),
  );
  await saveManualEntryFavoritePresets(next);
  return next;
};

export const removeManualEntryFavoritePreset = async (
  presets: ManualEntryFavoritePreset[],
  id: string,
): Promise<ManualEntryFavoritePreset[]> => {
  const next = presets.filter((preset) => preset.id !== id);
  await saveManualEntryFavoritePresets(next);
  return next;
};
