/**
 * Exercise Service
 * 種目マスターデータの管理
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Exercise } from '../types/index';

const EXERCISES_KEY = '@repvelo_exercises';

// デフォルト種目リスト
const DEFAULT_EXERCISES: Exercise[] = [
  { id: 'squat', name: 'スクワット', category: 'squat', has_lvp: true },
  { id: 'bench_press', name: 'ベンチプレス', category: 'bench', has_lvp: true },
  { id: 'deadlift', name: 'デッドリフト', category: 'deadlift', has_lvp: true },
  { id: 'overhead_press', name: 'オーバーヘッドプレス', category: 'press', has_lvp: true },
  { id: 'barbell_row', name: 'バーベルロウ', category: 'pull', has_lvp: true },
  { id: 'lat_pulldown', name: 'ラットプルダウン', category: 'pull', has_lvp: true },
  { id: 'leg_press', name: 'レッグプレス', category: 'accessory', has_lvp: true },
  { id: 'leg_curl', name: 'レッグカール', category: 'accessory', has_lvp: false },
  { id: 'bicep_curl', name: 'アームカール', category: 'accessory', has_lvp: false },
  { id: 'tricep_extension', name: 'トライセプスエクステンション', category: 'accessory', has_lvp: false },
];

class ExerciseService {
  private exercises: Exercise[] = [];
  private initialized = false;

  /**
   * サービスの初期化
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const stored = await AsyncStorage.getItem(EXERCISES_KEY);
      if (stored) {
        this.exercises = JSON.parse(stored);
      } else {
        this.exercises = [...DEFAULT_EXERCISES];
        await this.save();
      }
      this.initialized = true;
    } catch (error) {
      console.error('ExerciseService initialize error:', error);
      this.exercises = [...DEFAULT_EXERCISES];
      this.initialized = true;
    }
  }

  /**
   * 全種目を取得
   */
  async getAllExercises(): Promise<Exercise[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    return [...this.exercises];
  }

  /**
   * IDで種目を取得
   */
  async getExerciseById(id: string): Promise<Exercise | null> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.exercises.find(e => e.id === id) || null;
  }

  /**
   * カテゴリで種目を取得
   */
  async getExercisesByCategory(category: string): Promise<Exercise[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.exercises.filter(e => e.category === category);
  }

  /**
   * 種目を追加
   */
  async addExercise(exercise: Omit<Exercise, 'id'>): Promise<Exercise> {
    if (!this.initialized) {
      await this.initialize();
    }

    const newExercise: Exercise = {
      ...exercise,
      id: `exercise_${Date.now()}`,
    };

    this.exercises.push(newExercise);
    await this.save();
    return newExercise;
  }

  /**
   * 種目を更新
   */
  async updateExercise(id: string, updates: Partial<Exercise>): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    const index = this.exercises.findIndex(e => e.id === id);
    if (index === -1) return false;

    this.exercises[index] = { ...this.exercises[index], ...updates };
    await this.save();
    return true;
  }

  /**
   * 種目を削除
   */
  async deleteExercise(id: string): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    const initialLength = this.exercises.length;
    this.exercises = this.exercises.filter(e => e.id !== id);

    if (this.exercises.length < initialLength) {
      await this.save();
      return true;
    }
    return false;
  }

  /**
   * 保存
   */
  private async save(): Promise<void> {
    try {
      await AsyncStorage.setItem(EXERCISES_KEY, JSON.stringify(this.exercises));
    } catch (error) {
      console.error('ExerciseService save error:', error);
    }
  }

  /**
   * デフォルト種目にリセット
   */
  async resetToDefaults(): Promise<void> {
    this.exercises = [...DEFAULT_EXERCISES];
    await this.save();
  }
}

// Export singleton instance
export default new ExerciseService();
