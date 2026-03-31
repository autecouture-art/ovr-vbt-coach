/**
 * Exercise Service
 * 種目マスターデータの管理と ROM 推定
 */

import DatabaseService from "@/src/services/DatabaseService";
import type { Exercise } from "@/src/types/index";
import {
  DEFAULT_EXERCISES,
  inferExercisePreset,
  mergeExerciseWithPreset,
  roundToHalfKg,
} from "@/src/constants/exerciseCatalog";

const DEFAULT_MIN_ROM_THRESHOLD = 10;

const toStableExerciseId = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9ぁ-んァ-ヶ一-龯]+/g, "_")
    .replace(/^_+|_+$/g, "") || `exercise_${Date.now()}`;

const nearlyEqual = (a?: number | null, b?: number | null) => {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) < 0.05;
};

class ExerciseService {
  private exercises: Exercise[] = [];
  private initialized = false;
  private initializePromise: Promise<void> | null = null;

  async initialize(force: boolean = false): Promise<void> {
    if (this.initialized && !force) return;
    if (this.initializePromise && !force) {
      await this.initializePromise;
      return;
    }

    this.initializePromise = (async () => {
      await DatabaseService.initialize();
      await this.syncCatalog();
      this.exercises = await DatabaseService.getExercises();
      this.initialized = true;
    })();

    try {
      await this.initializePromise;
    } finally {
      this.initializePromise = null;
    }
  }

  async getAllExercises(): Promise<Exercise[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    return [...this.exercises].sort((a, b) =>
      a.name.localeCompare(b.name, "ja"),
    );
  }

  async getExerciseById(id: string): Promise<Exercise | null> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.exercises.find((exercise) => exercise.id === id) || null;
  }

  async getExercisesByCategory(category: string): Promise<Exercise[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.exercises.filter((exercise) => exercise.category === category);
  }

  async addExercise(exercise: Omit<Exercise, "id">): Promise<Exercise> {
    if (!this.initialized) {
      await this.initialize();
    }

    const preset = inferExercisePreset(exercise.name, exercise.category);
    const newExercise: Exercise = {
      ...preset,
      ...exercise,
      id: toStableExerciseId(exercise.name),
      min_rom_threshold:
        exercise.min_rom_threshold ??
        preset.min_rom_threshold ??
        DEFAULT_MIN_ROM_THRESHOLD,
      machine_weight_steps:
        exercise.machine_weight_steps ?? preset.machine_weight_steps,
      rom_range_min_cm: exercise.rom_range_min_cm ?? preset.rom_range_min_cm,
      rom_range_max_cm: exercise.rom_range_max_cm ?? preset.rom_range_max_cm,
      rom_data_points: exercise.rom_data_points ?? 0,
      mvt: exercise.mvt ?? preset.mvt,
      ignore_first_rep_as_setup:
        exercise.ignore_first_rep_as_setup ??
        preset.ignore_first_rep_as_setup ??
        false,
    };

    await DatabaseService.saveExercise(newExercise);
    await this.refresh();
    return newExercise;
  }

  async updateExercise(
    id: string,
    updates: Partial<Exercise>,
  ): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    const current = this.exercises.find((exercise) => exercise.id === id);
    if (!current) return false;

    const next = mergeExerciseWithPreset({ ...current, ...updates });
    await DatabaseService.saveExercise(next);
    await this.refresh();
    return true;
  }

  async deleteExercise(id: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    const exists = this.exercises.some((exercise) => exercise.id === id);
    if (!exists) return false;

    await DatabaseService.deleteExercise(id);
    await this.refresh();
    return true;
  }

  async resetToDefaults(): Promise<void> {
    await DatabaseService.initialize();
    const current = await DatabaseService.getExercises();
    for (const exercise of current) {
      await DatabaseService.deleteExercise(exercise.id);
    }
    this.initialized = false;
    await this.initialize(true);
  }

  async inferRomRangeForLift(lift: string): Promise<Exercise | null> {
    if (!this.initialized && !this.initializePromise) {
      await this.initialize();
    }

    const exercise =
      this.exercises.find((item) => item.name === lift) ||
      (await DatabaseService.getExercises()).find((item) => item.name === lift);
    if (!exercise) return null;

    return this.applyRomInference(exercise, true);
  }

  private async syncCatalog(): Promise<void> {
    const current = await DatabaseService.getExercises();
    const byId = new Map(current.map((exercise) => [exercise.id, exercise]));
    const byName = new Map(
      current.map((exercise) => [exercise.name, exercise]),
    );

    for (const defaultExercise of DEFAULT_EXERCISES) {
      const existing =
        byId.get(defaultExercise.id) || byName.get(defaultExercise.name);
      const merged = mergeExerciseWithPreset(
        existing ? { ...defaultExercise, ...existing } : defaultExercise,
      );
      const nextExercise: Exercise = existing
        ? {
            ...merged,
            id: existing.id,
            name:
              existing.name === defaultExercise.name
                ? existing.name
                : defaultExercise.name,
            has_lvp: existing.has_lvp ?? merged.has_lvp,
            machine_weight_steps:
              existing.machine_weight_steps ?? merged.machine_weight_steps,
            min_rom_threshold:
              existing.min_rom_threshold &&
              existing.min_rom_threshold !== DEFAULT_MIN_ROM_THRESHOLD
                ? existing.min_rom_threshold
                : merged.min_rom_threshold,
            rep_detection_mode:
              existing.rep_detection_mode ?? merged.rep_detection_mode,
            target_pause_ms: existing.target_pause_ms ?? merged.target_pause_ms,
            description: existing.description ?? merged.description,
            mvt: existing.mvt ?? merged.mvt,
            ignore_first_rep_as_setup:
              existing.ignore_first_rep_as_setup ??
              merged.ignore_first_rep_as_setup ??
              false,
            subcategory: existing.subcategory ?? merged.subcategory,
            rom_range_min_cm:
              existing.rom_range_min_cm ?? merged.rom_range_min_cm,
            rom_range_max_cm:
              existing.rom_range_max_cm ?? merged.rom_range_max_cm,
            rom_data_points: existing.rom_data_points ?? merged.rom_data_points,
          }
        : merged;

      await DatabaseService.saveExercise(nextExercise);
      await this.applyRomInference(nextExercise, false);
    }
  }

  private async applyRomInference(
    exercise: Exercise,
    refreshAfterSave: boolean,
  ): Promise<Exercise> {
    const stats = await DatabaseService.getExerciseRomStats(exercise.name);
    if (!stats || stats.count < 4) {
      return exercise;
    }

    const romRangeMin = roundToHalfKg(Math.max(5, stats.p10));
    const romRangeMax = roundToHalfKg(Math.max(romRangeMin + 2, stats.p90));
    const inferredThreshold = roundToHalfKg(Math.max(5, stats.p25 * 0.7));

    const next: Exercise = {
      ...exercise,
      min_rom_threshold: inferredThreshold,
      rom_range_min_cm: romRangeMin,
      rom_range_max_cm: romRangeMax,
      rom_data_points: stats.count,
    };

    const changed =
      !nearlyEqual(exercise.min_rom_threshold, next.min_rom_threshold) ||
      !nearlyEqual(exercise.rom_range_min_cm, next.rom_range_min_cm) ||
      !nearlyEqual(exercise.rom_range_max_cm, next.rom_range_max_cm) ||
      exercise.rom_data_points !== next.rom_data_points;

    if (!changed) {
      return exercise;
    }

    await DatabaseService.saveExercise(next);
    if (refreshAfterSave) {
      await this.refresh();
    }
    return next;
  }

  private async refresh(): Promise<void> {
    this.exercises = await DatabaseService.getExercises();
  }
}

export default new ExerciseService();
