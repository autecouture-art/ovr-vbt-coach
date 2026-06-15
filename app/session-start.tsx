/**
 * Session Start Screen
 * Dedicated screen showing today's performance potential before starting workout
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTrainingStore } from '@/src/store/trainingStore';
import { useSessionStartData } from '@/src/hooks/useSessionStartData';
import { ReadinessCard } from '@/src/components/ReadinessCard';
import { PRCard } from '@/src/components/PRCard';
import { E1RMCard } from '@/src/components/E1RMCard';
import { GarageTheme } from '@/src/constants/garageTheme';

export default function SessionStartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const currentExercise = useTrainingStore((state) => state.currentExercise);
  const currentLoad = useTrainingStore((state) => state.currentLoad);

  const { data, loading, error } = useSessionStartData(currentExercise, currentLoad);

  const handleStartSession = useCallback(() => {
    router.push('/(tabs)/session');
  }, [router]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  const handleHome = useCallback(() => {
    router.replace('/(tabs)');
  }, [router]);

  if (loading) {
    return (
      <View style={[styles.container, styles.centering]}>
        <ActivityIndicator size="large" color={GarageTheme.accent} />
        <Text style={styles.loadingText}>データを読み込んでいます...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, styles.centering]}>
        <Text style={styles.errorText}>エラーが発生しました</Text>
        <View style={styles.centerActionRow}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>戻る</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backButton} onPress={handleHome}>
            <Text style={styles.backButtonText}>ホーム</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!data || !currentExercise) {
    return (
      <View style={[styles.container, styles.centering]}>
        <Text style={styles.errorText}>種目を選択してください</Text>
        <View style={styles.centerActionRow}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>戻る</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backButton} onPress={handleHome}>
            <Text style={styles.backButtonText}>ホーム</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
          <Text style={styles.headerButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{currentExercise.name}</Text>
          <Text style={styles.headerSubtitle}>{data.currentLoad}kg</Text>
        </View>
        <TouchableOpacity style={styles.homeHeaderButton} onPress={handleHome}>
          <Text style={styles.homeHeaderButtonText}>ホーム</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Readiness Card */}
        <ReadinessCard
          predicted={data.dailyReadiness.predicted}
          trend={data.dailyReadiness.trend}
          confidence={data.dailyReadiness.confidence}
        />

        {/* PR Card */}
        <PRCard
          currentLoad={data.currentLoad}
          bestVelocity={data.bestVelocityAtLoad}
        />

        {/* E1RM Card */}
        <E1RMCard
          currentE1RM={data.currentE1RM}
          mvt={data.mvt}
        />

        {/* Historical Trend */}
        {data.historicalVelocityAtLoad.length > 0 && (
          <View style={styles.historyCard}>
            <Text style={styles.historyTitle}>最近のパフォーマンス</Text>
            {data.historicalVelocityAtLoad.map((record, index) => (
              <View key={index} style={styles.historyRow}>
                <Text style={styles.historyLoad}>{record.load}kg</Text>
                <Text style={styles.historyVelocity}>
                  {record.velocity.toFixed(2)} m/s
                </Text>
                <Text style={styles.historyDate}>
                  {new Date(record.date).toLocaleDateString('ja-JP', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Start Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.startButton}
          onPress={handleStartSession}
          activeOpacity={0.8}
        >
          <Text style={styles.startButtonText}>トレーニング開始</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: GarageTheme.background,
  },
  container: {
    flex: 1,
    backgroundColor: GarageTheme.background,
  },
  centering: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: GarageTheme.panel,
    borderBottomWidth: 1,
    borderBottomColor: GarageTheme.border,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonText: {
    fontSize: 24,
    color: GarageTheme.text,
    fontWeight: '500',
  },
  aiCoachButton: {
    fontSize: 24,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: GarageTheme.text,
  },
  homeHeaderButton: {
    minWidth: 58,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    backgroundColor: GarageTheme.chip,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  homeHeaderButtonText: {
    color: GarageTheme.text,
    fontSize: 13,
    fontWeight: '500',
  },
  headerSubtitle: {
    fontSize: 14,
    color: GarageTheme.textMuted,
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  historyCard: {
    backgroundColor: GarageTheme.panel,
    borderRadius: 8,
    padding: 20,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: '500',
    color: GarageTheme.text,
    marginBottom: 12,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: GarageTheme.border,
  },
  historyLoad: {
    fontSize: 16,
    fontWeight: '600',
    color: GarageTheme.text,
    flex: 1,
  },
  historyVelocity: {
    fontSize: 16,
    color: GarageTheme.accent,
    flex: 1,
    textAlign: 'center',
  },
  historyDate: {
    fontSize: 14,
    color: GarageTheme.textMuted,
    flex: 1,
    textAlign: 'right',
  },
  footer: {
    backgroundColor: GarageTheme.panel,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: GarageTheme.border,
  },
  startButton: {
    backgroundColor: GarageTheme.accent,
    borderRadius: 6,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#f7f8f8',
    fontSize: 18,
    fontWeight: '500',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: GarageTheme.textMuted,
  },
  errorText: {
    fontSize: 16,
    color: GarageTheme.accent,
    textAlign: 'center',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: GarageTheme.chip,
    borderColor: GarageTheme.border,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 6,
  },
  backButtonText: {
    color: GarageTheme.accentSoft,
    fontSize: 16,
    fontWeight: '500',
  },
});
