/**
 * Troubleshooting Guide Component
 * トラブルシューティングガイド
 */

import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { GarageTheme } from '@/src/constants/garageTheme';

interface TroubleshootingItem {
  problem: string;
  solutions: string[];
}

const TROUBLESHOOTING_ITEMS: TroubleshootingItem[] = [
  {
    problem: 'センサーが見つかりません',
    solutions: [
      'センサーの電源が入っているか確認',
      'iPhoneのBluetoothがオンになっているか確認',
      'センサーをiPhoneの近く（1m以内）に移動',
      'センサーのボタンを長押ししてリセット',
    ],
  },
  {
    problem: '速度が表示されません',
    solutions: [
      '「記録開始」ボタンを押したか確認',
      'センサーが正しくバーに装着されているか確認',
      'フォームが安定しているか確認',
      'センサーのLEDが点灯しているか確認',
    ],
  },
  {
    problem: '接続が頻繁に切れます',
    solutions: [
      'センサーのバッテリー残量を確認',
      'iPhoneのBluetoothをオフにしてから再オン',
      'アプリを再起動',
      'センサーを再起動',
    ],
  },
  {
    problem: 'データが保存されません',
    solutions: [
      '「セット完了」ボタンを押したか確認',
      'インターネット接続を確認',
      'アプリのストレージ権限を確認',
      'アプリを再起動',
    ],
  },
];

interface TroubleshootingGuideProps {
  visible: boolean;
  onClose: () => void;
}

export function TroubleshootingGuide({ visible, onClose }: TroubleshootingGuideProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>トラブルシューティング</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            {TROUBLESHOOTING_ITEMS.map((item, index) => (
              <View key={index} style={styles.card}>
                <TouchableOpacity
                  style={styles.cardHeader}
                  onPress={() => setExpandedIndex(expandedIndex === index ? null : index)}
                >
                  <Text style={styles.problem}>{item.problem}</Text>
                  <Text style={styles.chevron}>{expandedIndex === index ? '▼' : '▶'}</Text>
                </TouchableOpacity>

                {expandedIndex === index && (
                  <View style={styles.solutions}>
                    {item.solutions.map((solution, solutionIndex) => (
                      <View key={solutionIndex} style={styles.solutionRow}>
                        <Text style={styles.solutionBullet}>•</Text>
                        <Text style={styles.solutionText}>{solution}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity style={styles.closeButtonBottom} onPress={onClose}>
            <Text style={styles.closeButtonBottomText}>閉じる</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: GarageTheme.background,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '80%',
    borderTopWidth: 1,
    borderColor: GarageTheme.borderStrong,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: GarageTheme.border,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: GarageTheme.textStrong,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: GarageTheme.chip,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: GarageTheme.textStrong,
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    padding: 18,
  },
  card: {
    backgroundColor: GarageTheme.surface,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  problem: {
    fontSize: 16,
    fontWeight: '600',
    color: GarageTheme.textStrong,
    flex: 1,
  },
  chevron: {
    fontSize: 12,
    color: GarageTheme.textMuted,
    marginLeft: 8,
  },
  solutions: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: GarageTheme.panel,
  },
  solutionRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  solutionBullet: {
    fontSize: 16,
    color: GarageTheme.accent,
    marginRight: 8,
  },
  solutionText: {
    fontSize: 14,
    color: GarageTheme.text,
    lineHeight: 20,
    flex: 1,
  },
  closeButtonBottom: {
    backgroundColor: GarageTheme.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    margin: 18,
    marginTop: 0,
  },
  closeButtonBottomText: {
    color: '#f7f8f8',
    fontSize: 16,
    fontWeight: '500',
  },
});
