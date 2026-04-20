/**
 * Heart Rate Utilities
 * Calculates recovery signals based on heart rate data
 */

export type RecoverySignal = 'blue' | 'yellow' | 'red';

export interface RecoveryStatus {
  signal: RecoverySignal;
  percentage: number; // 現在心拍数のピークに対する割合
  label: string;
  description: string;
  color: string;
}

/**
 * 心拍数から回復シグナルを計算
 * @param currentHeartRate 現在の心拍数
 * @param peakHeartRate セット中のピーク心拍数
 * @returns 回復ステータス
 */
export function calculateRecoverySignal(
  currentHeartRate: number,
  peakHeartRate: number
): RecoveryStatus {
  if (!peakHeartRate || peakHeartRate === 0) {
    return {
      signal: 'blue',
      percentage: 0,
      label: '準備完了',
      description: '測定待ち',
      color: '#3B82F6',
    };
  }

  const percentage = (currentHeartRate / peakHeartRate) * 100;

  // ピークの60%以下 = 青（回復完了）
  if (percentage <= 60) {
    return {
      signal: 'blue',
      percentage,
      label: '回復完了',
      description: '次のセット準備OK',
      color: '#3B82F6',
    };
  }

  // ピークの60-80% = 黄（回復中）
  if (percentage <= 80) {
    return {
      signal: 'yellow',
      percentage,
      label: '回復中',
      description: 'あと少し休憩',
      color: '#F59E0B',
    };
  }

  // ピークの80%以上 = 赤（回復不足）
  return {
    signal: 'red',
    percentage,
    label: '回復不足',
    description: 'まだ休憩が必要',
    color: '#EF4444',
  };
}

/**
 * 複数の心拍数データポイントからピーク値を取得
 * @param heartRateData 心拍数配列
 * @returns ピーク心拍数
 */
export function getPeakHeartRate(heartRateData: number[]): number {
  if (!heartRateData || heartRateData.length === 0) {
    return 0;
  }
  return Math.max(...heartRateData);
}
