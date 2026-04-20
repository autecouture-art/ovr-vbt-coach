/**
 * AICoachService
 * VBTデータをもとにAIコーチングアドバイスを生成するサービス
 * 将来的にはLLM APIを呼び出す基盤として設計
 */

import type { SetData, AppSettings, VelocityZone } from '../types/index';
import { getDynamicVelocityZones } from '../utils/VelocityZones';

// 速度ゾーンの定義
const VELOCITY_ZONES = {
    power: { min: 1.0, name: 'POWER', emoji: 'PWR', color: '#FFD700' },
    strengthSpeed: { min: 0.75, name: 'SPEED STRENGTH', emoji: 'SPD', color: '#FF8C00' },
    hypertrophy: { min: 0.5, name: 'HYPERTROPHY', emoji: 'HYP', color: '#32CD32' },
    strength: { min: 0, name: 'MAX STRENGTH', emoji: 'MAX', color: '#DC143C' },
} as const;

export interface CoachingAdvice {
    message: string;           // メインアドバイス（日本語）
    emoji: string;             // アドバイスの感情を表すアイコン
    severity: 'info' | 'warning' | 'success' | 'alert';
    suggestedAction?: string;  // 具体的な行動提案
}

export interface LoadSuggestion {
    suggestedLoad: number;     // 推奨重量 (kg)
    reason: string;            // 理由
    percentChange: number;     // 変化率 (正=増加、負=減少)
}

export class AICoachService {
    /**
     * 速度ゾーンを返す（固定ゾーン・同期版）
     */
    static getZone(velocity: number): typeof VELOCITY_ZONES[keyof typeof VELOCITY_ZONES] {
        if (velocity >= VELOCITY_ZONES.power.min) return VELOCITY_ZONES.power;
        if (velocity >= VELOCITY_ZONES.strengthSpeed.min) return VELOCITY_ZONES.strengthSpeed;
        if (velocity >= VELOCITY_ZONES.hypertrophy.min) return VELOCITY_ZONES.hypertrophy;
        return VELOCITY_ZONES.strength;
    }

    /**
     * 動的速度ゾーンを取得（種目別履歴ベース・非同期版）
     */
    static async getDynamicZone(lift: string, velocity: number): Promise<VelocityZone> {
        try {
            const zones = await getDynamicVelocityZones(lift);
            for (const zone of zones) {
                if (velocity >= zone.min_velocity && velocity < zone.max_velocity) {
                    return zone;
                }
            }
            // 該当するゾーンが見つからない場合は最も遅いゾーンを返す
            return zones[zones.length - 1];
        } catch (error) {
            console.error('Failed to get dynamic zones, falling back to fixed:', error);
            // フォールバック: 固定ゾーンを返す
            return {
                name: this.getZone(velocity).name.toLowerCase(),
                min_velocity: 0,
                max_velocity: velocity,
                load_range: '',
                color: this.getZone(velocity).color,
            };
        }
    }

    /**
     * 種目別の最新VL閾値を取得（2024-2025論文に基づく）
     */
    static getVlThresholdByExercise(category: string): number {
        switch (category?.toLowerCase()) {
            case 'bench':
                return 10;
            case 'deadlift':
                return 5;
            case 'squat':
                return 20;
            case 'press':
            case 'pull':
            case 'row':
            case 'vertical_pull':
                return 15;
            default:
                return 20; // 補助種目等はデフォルト20%
        }
    }

    /**
     * セット履歴をもとにコーチングアドバイスを生成
     * @param setHistory  今セッションの全セット履歴
     * @param currentSet  現在のセット番号
     * @param exercise    現在の種目
     * @param settings    アプリ設定（閾値など）
     */
    static getCoachingAdvice(
        setHistory: SetData[],
        currentSet: number,
        exercise?: any,
        settings?: Partial<AppSettings>
    ): CoachingAdvice {
        // 最新論文に基づく種目別閾値を優先、設定があればそちらを使用
        const paperThreshold = this.getVlThresholdByExercise(exercise?.category);
        const vlThreshold = settings?.velocity_loss_threshold ?? paperThreshold;

        // セットが少ない場合
        if (setHistory.length < 2) {
            return {
                message: 'ウォームアップ完了！本セットを頑張りましょう。',
                emoji: 'INFO',
                severity: 'info',
            };
        }

        const recentSets = setHistory.slice(-3); // 直近3セット
        const avgVelocities = recentSets
            .map((s) => s.avg_velocity)
            .filter((v): v is number => v !== null && v !== undefined);

        if (avgVelocities.length < 2) {
            return {
                message: 'データを記録中です。次のセットも続けましょう！',
                emoji: 'DATA',
                severity: 'info',
            };
        }

        // 速度トレンドを計算（最初と最後）
        const firstVel = avgVelocities[0];
        const lastVel = avgVelocities[avgVelocities.length - 1];
        const velocityDrop = ((firstVel - lastVel) / firstVel) * 100;

        // 最後のセットのVelocity Loss
        const lastSet = setHistory[setHistory.length - 1];
        const lastVL = lastSet.velocity_loss ?? 0;

        // 急激な疲労
        if (velocityDrop > 20 || lastVL > vlThreshold * 1.5) {
            return {
                message: `疲労が蓄積しています。速度が${velocityDrop.toFixed(1)}%低下しました。`,
                emoji: 'ALERT',
                severity: 'alert',
                suggestedAction: '10〜15分の休憩を取るか、重量を10%下げることをお勧めします。',
            };
        }

        // Velocity Loss超過
        if (lastVL > vlThreshold) {
            return {
                message: `${exercise?.name || '種目'}のVL閾値(${vlThreshold}%)を超過しました。`,
                emoji: 'HOLD',
                severity: 'warning',
                suggestedAction: '休憩時間を延ばすか、次のセットの重量を5%下げてみてください。',
            };
        }

        // 速度が安定している場合
        if (Math.abs(velocityDrop) < 5) {
            return {
                message: `速度が安定しています（平均${lastVel.toFixed(2)} m/s）。`,
                emoji: 'READY',
                severity: 'success',
                suggestedAction: '次のセットは少し重量を上げることができます！',
            };
        }

        // 通常の疲労
        return {
            message: `セット${currentSet}完了。速度は${velocityDrop.toFixed(1)}%低下しています。`,
            emoji: 'LOAD',
            severity: 'info',
            suggestedAction: '適切な休憩（2〜3分）を取って次のセットに備えましょう。',
        };
    }

    /**
     * 次のセットの推奨重量を計算
     * @param avgVelocity  直前セットの平均速度
     * @param targetZone   目標速度ゾーン
     * @param currentLoad  現在の重量 (kg)
     */
    static suggestNextLoad(
        avgVelocity: number,
        targetZone: keyof typeof VELOCITY_ZONES,
        currentLoad: number,
    ): LoadSuggestion {
        const target = VELOCITY_ZONES[targetZone];
        const targetVel = target.min + 0.1; // ゾーン下限より少し余裕を持つ

        if (avgVelocity < target.min) {
            // 速すぎる → 重量を増やす
            const percentChange = Math.min(
                Math.round(((avgVelocity - targetVel) / targetVel) * -50),
                10
            );
            const newLoad = Math.round((currentLoad * (1 + percentChange / 100)) / 2.5) * 2.5;
            return {
                suggestedLoad: newLoad,
                reason: `現在の速度(${avgVelocity.toFixed(2)} m/s)は${target.name}ゾーンより速いです`,
                percentChange,
            };
        } else if (avgVelocity > targetVel + 0.15) {
            // 遅すぎる → 重量を減らす
            const percentChange = Math.max(
                Math.round(((avgVelocity - targetVel) / targetVel) * 30),
                -10
            );
            const newLoad = Math.round((currentLoad * (1 - Math.abs(percentChange) / 100)) / 2.5) * 2.5;
            return {
                suggestedLoad: Math.max(newLoad, currentLoad * 0.9),
                reason: `現在の速度(${avgVelocity.toFixed(2)} m/s)は${target.name}ゾーンより遅いです`,
                percentChange: -Math.abs(percentChange),
            };
        }

        // ゾーン内 → 維持
        return {
            suggestedLoad: currentLoad,
            reason: `現在の速度(${avgVelocity.toFixed(2)} m/s)は${target.name}ゾーン内です`,
            percentChange: 0,
        };
    }

    /**
     * セッション全体のサマリーを生成
     */
    static generateSessionSummary(setHistory: SetData[]): string {
        if (setHistory.length === 0) return 'セッションデータがありません。';

        const totalVolume = setHistory.reduce((sum, s) => sum + s.load_kg * s.reps, 0);
        const avgVel = setHistory
            .filter((s) => s.avg_velocity != null)
            .reduce((sum, s) => sum + (s.avg_velocity ?? 0), 0) / setHistory.length;
        const maxLoad = Math.max(...setHistory.map((s) => s.load_kg));
        const zone = this.getZone(avgVel);

        return `${zone.emoji} ${setHistory.length}セット完了！\n` +
            `平均速度: ${avgVel.toFixed(2)} m/s (${zone.name}ゾーン)\n` +
            `最大重量: ${maxLoad} kg | 総ボリューム: ${Math.round(totalVolume).toLocaleString()} kg`;
    }

    /**
     * Parse natural language query for PR challenge
     * Extracts target weight and optional current weight/velocity from text
     */
    static parsePRChallengeQuery(query: string): {
        targetWeight: number;
        currentWeight?: number;
        currentVelocity?: number;
        exercise?: string;
    } | null {
        const lowerQuery = query.toLowerCase();

        // Extract weight numbers (e.g., "110kg", "110キロ", "110 kg")
        const weightPattern = /(\d+(?:\.\d+)?)\s*(kg|キロ|ｋｇ)/gi;
        const weights = Array.from(query.matchAll(weightPattern));

        if (weights.length === 0) return null;

        const targetWeight = parseFloat(weights[0][1]);
        const currentWeight = weights.length > 1 ? parseFloat(weights[1][1]) : undefined;

        // Extract velocity if present (e.g., "0.35m/s", "0.35 m/s", "0.35")
        const velocityPattern = /(\d+(?:\.\d+)?)\s*(m\/s|meter|メートル)/gi;
        const velocities = Array.from(query.matchAll(velocityPattern));
        const currentVelocity = velocities.length > 0 ? parseFloat(velocities[0][1]) : undefined;

        // Extract exercise name (common exercises)
        const exercises = ['bench', 'squat', 'deadlift', 'ベンチ', 'スクワット', 'デッドリフト', 'ベンチプレス'];
        const exercise = exercises.find(ex => lowerQuery.includes(ex.toLowerCase()));

        return {
            targetWeight,
            currentWeight,
            currentVelocity,
            exercise: exercise ? query.substring(query.indexOf(exercise.charAt(0)), query.indexOf(exercise.charAt(0)) + 10) : undefined,
        };
    }

    /**
     * Generate PR challenge advice using calculator
     */
    static generatePRChallengeAdvice(
        targetWeight: number,
        currentWeight: number | undefined,
        currentVelocity: number | undefined,
        lvp: { slope: number; intercept: number; mvt?: number; r_squared: number; sample_count: number }
    ): CoachingAdvice {
        const { calculatePRChallenge } = require('../utils/PRChallengeCalculator');

        const result = calculatePRChallenge({
            targetWeight,
            currentWeight,
            currentVelocity,
            lvp: {
                slope: lvp.slope,
                intercept: lvp.intercept,
                vmax: 0,
                v1rm: lvp.mvt || 0.15,
                mvt: lvp.mvt,
                r_squared: lvp.r_squared,
                sample_count: lvp.sample_count,
                last_updated: new Date().toISOString(),
                lift: '',
            },
        });

        let emoji = '🤔';
        let severity: 'info' | 'warning' | 'success' | 'alert' = 'info';

        if (result.currentWeight && result.currentVelocity) {
            if (result.velocityGap && result.velocityGap >= 0) {
                emoji = '🚀';
                severity = 'success';
            } else if (result.velocityGap && result.velocityGap > -0.05) {
                emoji = '💪';
                severity = 'info';
            } else {
                emoji = '🎯';
                severity = 'warning';
            }
        } else if (result.isAchievable) {
            emoji = '⚡';
            severity = 'info';
        } else {
            emoji = '📊';
            severity = 'warning';
        }

        return {
            message: result.advice,
            emoji,
            severity,
            suggestedAction: result.recommendation,
        };
    }
}

export default AICoachService;
