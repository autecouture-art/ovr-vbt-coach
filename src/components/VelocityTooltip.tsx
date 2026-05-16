/**
 * Velocity Tooltip Component
 * 速度関連の用語を説明するツールチップ
 */

import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { GarageTheme } from '@/src/constants/garageTheme';

interface VelocityTooltipProps {
  visible: boolean;
  onClose: () => void;
  term: string;
  definition: string;
  targetRange?: string;
  currentStatus?: 'good' | 'warning' | 'danger';
  currentValue?: string;
}

export function VelocityTooltip({
  visible,
  onClose,
  term,
  definition,
  targetRange,
  currentStatus,
  currentValue,
}: VelocityTooltipProps) {
  const getStatusColor = () => {
    switch (currentStatus) {
      case 'good':
        return GarageTheme.success;
      case 'warning':
        return GarageTheme.warning;
      case 'danger':
        return GarageTheme.danger;
      default:
        return GarageTheme.info;
    }
  };

  const getStatusText = () => {
    switch (currentStatus) {
      case 'good':
        return '✅ 適正範囲内';
      case 'warning':
        return '⚠️ 注意';
      case 'danger':
        return '❌ 範囲外';
      default:
        return '';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.overlay} onPress={onClose} activeOpacity={1}>
        <View style={styles.tooltipContainer}>
          <View style={styles.tooltipHeader}>
            <Text style={styles.tooltipTitle}>{term}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tooltipContent}>
            <Text style={styles.tooltipDefinition}>{definition}</Text>

            {targetRange && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>目標範囲</Text>
                <Text style={styles.sectionValue}>{targetRange}</Text>
              </View>
            )}

            {currentValue && currentStatus && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>現在の値</Text>
                <View style={styles.statusRow}>
                  <Text style={styles.sectionValue}>{currentValue}</Text>
                  <Text style={[styles.statusText, { color: getStatusColor() }]}>
                    {getStatusText()}
                  </Text>
                </View>
              </View>
            )}
          </View>

          <TouchableOpacity style={styles.closeButtonBottom} onPress={onClose}>
            <Text style={styles.closeButtonBottomText}>閉じる</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// 用語の説明データ
export const VELOCITY_GLOSSARY = {
  MEAN_VELOCITY: {
    term: 'Mean Velocity（平均速度）',
    definition: '1回の挙上動作の平均速度です。セット全体の平均的な持ち上げ速度を示します。',
    targetRange: '0.75 - 1.0 m/s（筋肥大トレーニング）',
  },
  PEAK_VELOCITY: {
    term: 'Peak Velocity（ピーク速度）',
    definition: '1回の挙上動作で最も速い瞬間の速度です。',
    targetRange: '1.0 m/s以上（パワー系トレーニング）',
  },
  VELOCITY_LOSS: {
    term: 'Velocity Loss（速度低下率）',
    definition: 'セット内で速度がどれだけ低下したかをパーセントで示します。\n\nセットを続けてOKです！20%を超えたら終了推奨です。',
    targetRange: '0 - 20%（適正範囲）',
  },
  ROM: {
    term: 'ROM（可動域）',
    definition: '関節が動く範囲のことです。挙上動作の距離をセンチメートルで示します。',
    targetRange: '種目による可動域を確認してください',
  },
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  tooltipContainer: {
    backgroundColor: GarageTheme.surface,
    borderRadius: 20,
    padding: 20,
    maxWidth: 340,
    width: '100%',
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  tooltipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  tooltipTitle: {
    color: GarageTheme.textStrong,
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: GarageTheme.chip,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: GarageTheme.textStrong,
    fontSize: 16,
    fontWeight: '700',
  },
  tooltipContent: {
    marginBottom: 20,
  },
  tooltipDefinition: {
    color: GarageTheme.text,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
  },
  section: {
    backgroundColor: GarageTheme.panel,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  sectionLabel: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
  },
  sectionValue: {
    color: GarageTheme.textStrong,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '700',
  },
  closeButtonBottom: {
    backgroundColor: GarageTheme.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeButtonBottomText: {
    color: '#fff4ec',
    fontSize: 16,
    fontWeight: '700',
  },
});
