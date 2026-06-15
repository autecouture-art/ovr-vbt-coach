/**
 * Glossary Screen
 * VBT用語集・ヘルプ画面
 */

import React from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { GarageTheme } from '@/src/constants/garageTheme';

interface GlossaryItem {
  term: string;
  definition: string;
  example?: string;
}

const GLOSSARY_ITEMS: GlossaryItem[] = [
  {
    term: 'VBT（Velocity-Based Training）',
    definition: '速度に基づいたトレーニング方法。持ち上げる速度から適切な負荷を判断します。',
    example: '0.8 m/sで持ち上げられる重量は筋肥大に適しています',
  },
  {
    term: 'Mean Velocity（平均速度）',
    definition: '1回の挙上動作の平均速度。',
    example: 'ベンチプレスで80kgを0.85 m/sで持ち上げました',
  },
  {
    term: 'Peak Velocity（ピーク速度）',
    definition: '1回の挙上動作で最も速い瞬間の速度。',
  },
  {
    term: 'Velocity Loss（速度低下率）',
    definition: 'セット内で速度がどれだけ低下したか。',
    example: '1回目が1.0 m/s、5回目が0.8 m/sなら低下率は20%です',
  },
  {
    term: 'ROM（Range of Motion）',
    definition: '関節が動く範囲。挙上動作の距離をセンチメートルで示します。',
  },
  {
    term: '1RM（One Repetition Max）',
    definition: '1回挙げられる最大の重量。',
  },
  {
    term: 'e1RM（Estimated 1RM）',
    definition: '速度データから推定される1RM。',
  },
  {
    term: 'CNS Battery',
    definition: '中枢神経系の疲労度を示す指標。100%に近いほど fresh です。',
  },
  {
    term: '速度ゾーン',
    definition: '速度によってトレーニングの効果が分類されます。\n\n• パワー（1.0 m/s以上）\n• 筋力-速度（0.75-1.0 m/s）\n• 筋肥大（0.5-0.75 m/s）\n• 最大筋力（0.5 m/s以下）',
  },
];

export default function GlossaryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 36 }}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← 戻る</Text>
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>用語集</Text>
          <Text style={styles.subtitle}>VBTで使う用語の説明</Text>
        </View>
        <TouchableOpacity
          onPress={() => router.replace('/(tabs)')}
          style={styles.homeButton}
        >
          <Text style={styles.homeButtonText}>ホーム</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {GLOSSARY_ITEMS.map((item, index) => (
          <View key={index} style={styles.card}>
            <Text style={styles.term}>{item.term}</Text>
            <Text style={styles.definition}>{item.definition}</Text>
            {item.example && (
              <View style={styles.exampleBox}>
                <Text style={styles.exampleLabel}>例</Text>
                <Text style={styles.exampleText}>{item.example}</Text>
              </View>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GarageTheme.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: GarageTheme.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: GarageTheme.accent,
    fontSize: 16,
    fontWeight: '500',
  },
  headerText: {
    flex: 1,
  },
  homeButton: {
    borderWidth: 1,
    borderColor: GarageTheme.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: GarageTheme.chip,
  },
  homeButtonText: {
    color: GarageTheme.text,
    fontSize: 13,
    fontWeight: '500',
  },
  title: {
    fontSize: 24,
    fontWeight: '500',
    color: GarageTheme.textStrong,
  },
  subtitle: {
    fontSize: 13,
    color: GarageTheme.textMuted,
    marginTop: 2,
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: GarageTheme.surface,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  term: {
    fontSize: 18,
    fontWeight: '500',
    color: GarageTheme.accent,
    marginBottom: 8,
  },
  definition: {
    fontSize: 15,
    color: GarageTheme.text,
    lineHeight: 22,
  },
  exampleBox: {
    backgroundColor: GarageTheme.panel,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    borderLeftWidth: 3,
    borderLeftColor: GarageTheme.info,
  },
  exampleLabel: {
    fontSize: 12,
    color: GarageTheme.info,
    fontWeight: '500',
    marginBottom: 6,
  },
  exampleText: {
    fontSize: 14,
    color: GarageTheme.textStrong,
    fontStyle: 'italic',
  },
});
