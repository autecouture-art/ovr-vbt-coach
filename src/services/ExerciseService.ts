/**
 * Exercise Service
 * 種目マスターデータの管理 (SQLite / DatabaseService 統合版)
 */

import DatabaseService from './DatabaseService';
import type { Exercise } from '../types/index';

// デフォルト種目リスト
const DEFAULT_EXERCISES: Omit<Exercise, 'id'>[] = [
  { name: 'スクワット', category: 'squat', has_lvp: true, min_rom_threshold: 15.0 },
  { name: 'ベンチプレス', category: 'bench', has_lvp: true, min_rom_threshold: 10.0 },
  { name: 'デッドリフト', category: 'deadlift', has_lvp: true, min_rom_threshold: 15.0 },
  { name: 'オーバーヘッドプレス', category: 'press', has_lvp: true, min_rom_threshold: 15.0 },
  { name: 'バーベルロウ', category: 'pull', has_lvp: true, min_rom_threshold: 15.0 },
  { name: 'ラットプルダウン', category: 'pull', has_lvp: true, min_rom_threshold: 15.0 },
  { name: 'レッグプレス', category: 'accessory', has_lvp: true, min_rom_threshold: 15.0 },
  { name: 'レッグカール', category: 'accessory', has_lvp: false, min_rom_threshold: 10.0 },
  { name: 'アームカール', category: 'accessory', has_lvp: false, min_rom_threshold: 10.0 },
  { name: 'トライセプスエクステンション', category: 'accessory', has_lvp: false, min_rom_threshold: 10.0 },
];

class ExerciseService {
  private initialized = false;

  /**
   * サービスの初期化
   * DBに種目がない場合にデフォルト値を投入する
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const existing = await DatabaseService.getExercises();
      if (existing.length === 0) {
        console.log('No exercises found in DB, seeding defaults...');
        for (const def of DEFAULT_EXERCISES) {
          await DatabaseService.saveExercise({
            ...def,
            id: `ex_${def.name.toLowerCase().replace(/\s+/g, '_')}`,
          } as Exercise);
        }
      }
      this.initialized = true;
    } catch (error) {
      console.error('ExerciseService initialize error:', error);
      this.initialized = true;
    }
  }

  /**
   * 全種目を取得
   */
  async getAllExercises(): Promise<Exercise[]> {
    if (!this.initialized) await this.initialize();
    return await DatabaseService.getExercises();
  }

  /**
   * IDで種目を取得
   */
  async getExerciseById(id: string): Promise<Exercise | null> {
    if (!this.initialized) await this.initialize();
    const all = await DatabaseService.getExercises();
    return all.find(e => e.id === id) || null;
  }

  /**
   * 種目を追加
   */
  async addExercise(exercise: Omit<Exercise, 'id'>): Promise<Exercise> {
    if (!this.initialized) await this.initialize();

    const newExercise: Exercise = {
      ...exercise,
      id: `exercise_${Date.now()}`,
      min_rom_threshold: exercise.min_rom_threshold ?? 10.0,
      rep_detection_mode: exercise.rep_detection_mode ?? 'standard',
      target_pause_ms: exercise.target_pause_ms ?? 0,
    };

    await DatabaseService.saveExercise(newExercise);
    return newExercise;
  }

  /**
   * 種目を更新
   */
  async updateExercise(id: string, updates: Partial<Exercise>): Promise<boolean> {
    if (!this.initialized) await this.initialize();

    const current = await this.getExerciseById(id);
    if (!current) return false;

    const updated = { ...current, ...updates };
    await DatabaseService.saveExercise(updated);
    return true;
  }

  /**
   * 種目を削除
   * 注: SQLiteからの物理削除メソッドはDatabaseServiceに未実装のため
   * 必要に応じて追加するか、そのままにする。一旦はDB側にDELETE文が必要。
   */
  async deleteExercise(id: string): Promise<boolean> {
    // 物理削除の必要があるが、DatabaseServiceにまだ無い。
    // 今回は整合性を保つためDatabaseServiceに deleteExercise を追加検討
    return false;
  }

  /**
   * デフォルト種目にリセット
   */
  async resetToDefaults(): Promise<void> {
    // 既存のを消す処理が必要（DatabaseService 拡張が必要）
  }
}

export default new ExerciseService();
