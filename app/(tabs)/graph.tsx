/**
 * LVP Graph Screen
 * 負荷-速度プロファイルグラフ画面
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LineChart } from 'react-native-chart-kit';
import DatabaseService from '@/src/services/DatabaseService';
import type { LVPData } from '@/src/types/index';

const { width } = Dimensions.get('window');

export default function GraphScreen() {
  const router = useRouter();
  const [selectedExercise, setSelectedExercise] = useState('ベンチプレス');
  const [lvpData, setLvpData] = useState<LVPData | null>(null);

  const exercises = ['ベンチプレス', 'スクワット', 'デッドリフト', 'オーバーヘッドプレス'];

  useEffect(() => {
    loadLVPData();
  }, [selectedExercise]);

  const loadLVPData = async () => {
    try {
      // TODO: DatabaseServiceからLVPデータを取得
      // const data = await DatabaseService.getLVPData(selectedExercise);
      // setLvpData(data);

      // デモデータ
      setLvpData({
        lift: selectedExercise,
        vmax: 1.5,
        v1rm: 0.15,
        slope: -0.0135,
        intercept: 1.65,
        r_squared: 0.95,
        last_updated: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to load LVP data:', error);
    }
  };

  // デモ用のグラフデータ生成
  const generateChartData = () => {
    if (!lvpData) return { labels: [], datasets: [{ data: [] }] };

    const loads = [20, 40, 60, 80, 100, 120];
    const labels = loads.map(l => l.toString());
    const velocities = loads.map(load => {
      return Math.max(0, lvpData.intercept + lvpData.slope * load);
    });

    return {
      labels,
      datasets: [{
        data: velocities,
        color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
        strokeWidth: 2,
      }],
    };
  };

  // 速度ゾーン
  const velocityZones = [
    { name: 'Power', minV: 1.0, maxV: 1.5, color: '#4CAF50' },
    { name: 'Strength-Speed', minV: 0.5, maxV: 1.0, color: '#2196F3' },
    { name: 'Hypertrophy', minV: 0.3, maxV: 0.5, color: '#FF9800' },
    { name: 'Strength', minV: 0.1, maxV: 0.3, color: '#9C27B0' },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.title}>LVPグラフ</Text>
        <View style={styles.placeholder} />
      </View>

      {/* 種目選択 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>種目</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.exerciseScroll}>
          {exercises.map((ex) => (
            <TouchableOpacity
              key={ex}
              style={[
                styles.exerciseButton,
                selectedExercise === ex && styles.exerciseButtonActive,
              ]}
              onPress={() => setSelectedExercise(ex)}
            >
              <Text
                style={[
                  styles.exerciseButtonText,
                  selectedExercise === ex && styles.exerciseButtonTextActive,
                ]}
              >
                {ex}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* LVP統計 */}
      {lvpData && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LVP統計</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Vmax</Text>
              <Text style={styles.statValue}>{lvpData.vmax.toFixed(2)} m/s</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>V1RM</Text>
              <Text style={styles.statValue}>{lvpData.v1rm.toFixed(2)} m/s</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>傾き</Text>
              <Text style={styles.statValue}>{lvpData.slope.toFixed(4)}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>R²</Text>
              <Text style={styles.statValue}>{lvpData.r_squared.toFixed(2)}</Text>
            </View>
          </View>
        </View>
      )}

      {/* グラフ */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>負荷-速度プロファイル</Text>
        <View style={styles.chartContainer}>
          {lvpData ? (
            <LineChart
              data={generateChartData()}
              width={width - 32}
              height={220}
              chartConfig={{
                backgroundColor: '#2a2a2a',
                backgroundGradientFrom: '#2a2a2a',
                backgroundGradientTo: '#2a2a2a',
                decimalPlaces: 2,
                color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(153, 153, 153, ${opacity})`,
                style: {
                  borderRadius: 16,
                },
                propsForDots: {
                  r: '4',
                  strokeWidth: '2',
                  stroke: '#2196F3',
                },
              }}
              bezier
              style={styles.chart}
              fromZero={false}
              segments={5}
              formatYLabel={(value) => `${value} m/s`}
              formatXLabel={(value) => `${value}kg`}
            />
          ) : (
            <View style={styles.noDataContainer}>
              <Text style={styles.noDataText}>データがありません</Text>
              <Text style={styles.noDataSubText}>
                トレーニングを開始してデータを収集してください
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* 速度ゾーン */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>速度ゾーン</Text>
        {velocityZones.map((zone) => (
          <View key={zone.name} style={styles.zoneCard}>
            <View style={[styles.zoneIndicator, { backgroundColor: zone.color }]} />
            <View style={styles.zoneInfo}>
              <Text style={styles.zoneName}>{zone.name}</Text>
              <Text style={styles.zoneRange}>
                {zone.minV} - {zone.maxV} m/s
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* 推定1RM */}
      {lvpData && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>推定1RM</Text>
          <View style={styles.onermCard}>
            <Text style={styles.onermValue}>
              {Math.abs(lvpData.intercept / lvpData.slope).toFixed(1)} kg
            </Text>
            <Text style={styles.onermLabel}>推定最大筋力 ({selectedExercise})</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#2196F3',
    fontSize: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 50,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  exerciseScroll: {
    flexDirection: 'row',
  },
  exerciseButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    marginRight: 8,
  },
  exerciseButtonActive: {
    backgroundColor: '#9C27B0',
  },
  exerciseButtonText: {
    color: '#999',
    fontSize: 14,
  },
  exerciseButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  statCard: {
    width: '48%',
    marginHorizontal: '1%',
    marginBottom: 8,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  chartContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  noDataContainer: {
    padding: 40,
    alignItems: 'center',
  },
  noDataText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 8,
  },
  noDataSubText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  zoneCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  zoneIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
    marginRight: 12,
  },
  zoneInfo: {
    flex: 1,
  },
  zoneName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  zoneRange: {
    fontSize: 14,
    color: '#999',
  },
  onermCard: {
    backgroundColor: '#9C27B0',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  onermValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  onermLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
});
