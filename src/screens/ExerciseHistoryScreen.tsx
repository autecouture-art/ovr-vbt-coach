/**
 * Exercise History Screen
 * Shows exercise-specific history with trends and stats
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import DatabaseService from '../services/DatabaseService';
import { ExerciseTrendChart } from '../components/ExerciseTrendChart';
import { GarageTheme } from '../constants/garageTheme';
import type { ExerciseHistoryEntry, ExerciseStats } from '../types/index';
import { format, parseISO } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';

interface ExerciseHistoryScreenProps {
  navigation: any;
}

interface TrainedExercise {
  lift: string;
  session_count: number;
  last_trained: string;
}

const ExerciseHistoryScreen: React.FC<ExerciseHistoryScreenProps> = ({ navigation }) => {
  const [trainedExercises, setTrainedExercises] = useState<TrainedExercise[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
  const [exerciseStats, setExerciseStats] = useState<ExerciseStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTrainedExercises = useCallback(async () => {
    try {
      const exercises = await DatabaseService.getTrainedExercises();
      setTrainedExercises(exercises);
      setSelectedExercise((current) => current ?? exercises[0]?.lift ?? null);
    } catch (error) {
      console.error('Failed to load trained exercises:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadExerciseStats = useCallback(async (lift: string) => {
    try {
      const stats = await DatabaseService.getExerciseStats(lift);
      setExerciseStats(stats);
    } catch (error) {
      console.error('Failed to load exercise stats:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTrainedExercises();
    }, [loadTrainedExercises]),
  );

  useEffect(() => {
    if (selectedExercise) {
      void loadExerciseStats(selectedExercise);
    }
  }, [loadExerciseStats, selectedExercise]);

  const handleExercisePress = (lift: string) => {
    setSelectedExercise(lift);
  };

  const handleSessionPress = (entry: ExerciseHistoryEntry) => {
    navigation.navigate('SessionDetail', {
      session_id: entry.session_id,
    });
  };

  const formatLastTrained = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff === 0) return '今日';
      if (daysDiff === 1) return '昨日';
      if (daysDiff < 7) return `${daysDiff}日前`;
      return format(date, 'M月d日');
    } catch {
      return '';
    }
  };

  const getChangeIndicator = (current: number, previous?: number) => {
    if (previous === undefined) return null;
    const diff = current - previous;
    if (diff > 0) return { text: `+${diff.toFixed(1)}`, color: GarageTheme.success };
    if (diff < 0) return { text: `${diff.toFixed(1)}`, color: '#ef4444' };
    return { text: '±0', color: GarageTheme.textMuted };
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={GarageTheme.accent} />
        <Text style={styles.loadingText}>読み込み中...</Text>
      </View>
    );
  }

  if (trainedExercises.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>種目別履歴</Text>
          <Text style={styles.subtitle}>種目を選択してトレンドを確認</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>まだトレーニング記録がありません</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>種目別履歴</Text>
        <Text style={styles.subtitle}>種目を選択してトレンドを確認</Text>
      </View>

      <View style={styles.content}>
        {/* Exercise List */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.exerciseListScroll}>
          <View style={styles.exerciseList}>
            {trainedExercises.map((exercise) => (
              <TouchableOpacity
                key={exercise.lift}
                style={[
                  styles.exerciseChip,
                  selectedExercise === exercise.lift && styles.exerciseChipActive,
                ]}
                onPress={() => handleExercisePress(exercise.lift)}
              >
                <Text
                  style={[
                    styles.exerciseChipText,
                    selectedExercise === exercise.lift && styles.exerciseChipTextActive,
                  ]}
                >
                  {exercise.lift}
                </Text>
                <Text
                  style={[
                    styles.exerciseChipSubtext,
                    selectedExercise === exercise.lift && styles.exerciseChipSubtextActive,
                  ]}
                >
                  {exercise.session_count}回 · {formatLastTrained(exercise.last_trained)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Selected Exercise Details */}
        {selectedExercise && exerciseStats && (
          <ScrollView style={styles.detailsContainer} showsVerticalScrollIndicator={false}>
            {/* Stats Cards */}
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{exerciseStats.best_1rm.toFixed(1)}</Text>
                <Text style={styles.statLabel}>Best 1RM (kg)</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{exerciseStats.avg_max_load.toFixed(1)}</Text>
                <Text style={styles.statLabel}>平均MAX重量</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>{exerciseStats.avg_volume.toFixed(0)}</Text>
                <Text style={styles.statLabel}>平均ボリューム</Text>
              </View>
            </View>

            {/* Trend Charts */}
            <View style={styles.chartsSection}>
              <Text style={styles.sectionTitle}>トレンドグラフ</Text>
              <ExerciseTrendChart history={exerciseStats.recent_sessions} />
            </View>

            {/* Recent Sessions */}
            <View style={styles.sessionsSection}>
              <Text style={styles.sectionTitle}>最近のセッション</Text>
              {exerciseStats.recent_sessions.map((entry, index) => {
                const previousEntry = exerciseStats.recent_sessions[index + 1];
                const loadChange = getChangeIndicator(entry.max_load, previousEntry?.max_load);
                const volumeChange = getChangeIndicator(
                  entry.total_volume,
                  previousEntry?.total_volume,
                );

                return (
                  <TouchableOpacity
                    key={entry.session_id}
                    style={styles.sessionCard}
                    onPress={() => handleSessionPress(entry)}
                  >
                    <View style={styles.sessionHeader}>
                      <Text style={styles.sessionDate}>
                        {format(parseISO(entry.date), 'yyyy/MM/dd (E)')}
                      </Text>
                      <Text style={styles.sessionSetCount}>{entry.total_sets}セット</Text>
                    </View>

                    <View style={styles.sessionSets}>
                      {entry.sets.slice(0, 5).map((set, i) => (
                        <Text key={i} style={styles.setSummary}>
                          {set.load_kg}×{set.reps}
                          {set.avg_velocity ? ` (${set.avg_velocity.toFixed(2)}m/s)` : ''}
                        </Text>
                      ))}
                      {entry.sets.length > 5 && (
                        <Text style={styles.setSummary}>+ 他{entry.sets.length - 5}セット</Text>
                      )}
                    </View>

                    <View style={styles.sessionStats}>
                      <View style={styles.sessionStat}>
                        <Text style={styles.sessionStatLabel}>MAX重量</Text>
                        <Text style={styles.sessionStatValue}>
                          {entry.max_load}kg
                          {loadChange && (
                            <Text style={{ color: loadChange.color }}> ({loadChange.text})</Text>
                          )}
                        </Text>
                      </View>
                      <View style={styles.sessionStat}>
                        <Text style={styles.sessionStatLabel}>ボリューム</Text>
                        <Text style={styles.sessionStatValue}>
                          {entry.total_volume.toFixed(0)}kg
                          {volumeChange && (
                            <Text style={{ color: volumeChange.color }}> ({volumeChange.text})</Text>
                          )}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GarageTheme.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: GarageTheme.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: GarageTheme.textMuted,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: GarageTheme.border,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: GarageTheme.textStrong,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: GarageTheme.textMuted,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: GarageTheme.textMuted,
  },
  content: {
    flex: 1,
  },
  exerciseListScroll: {
    maxHeight: 100,
    borderBottomWidth: 1,
    borderBottomColor: GarageTheme.border,
  },
  exerciseList: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  exerciseChip: {
    backgroundColor: GarageTheme.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 120,
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  exerciseChipActive: {
    backgroundColor: GarageTheme.accent,
    borderColor: GarageTheme.accent,
  },
  exerciseChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: GarageTheme.textStrong,
    marginBottom: 2,
  },
  exerciseChipTextActive: {
    color: '#ffffff',
  },
  exerciseChipSubtext: {
    fontSize: 11,
    color: GarageTheme.textMuted,
  },
  exerciseChipSubtextActive: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  detailsContainer: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: GarageTheme.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: GarageTheme.accent,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: GarageTheme.textMuted,
    textAlign: 'center',
  },
  chartsSection: {
    padding: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: GarageTheme.textStrong,
    marginBottom: 12,
  },
  sessionsSection: {
    padding: 12,
  },
  sessionCard: {
    backgroundColor: GarageTheme.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionDate: {
    fontSize: 14,
    fontWeight: '600',
    color: GarageTheme.textStrong,
  },
  sessionSetCount: {
    fontSize: 12,
    color: GarageTheme.textMuted,
  },
  sessionSets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
    gap: 8,
  },
  setSummary: {
    fontSize: 12,
    color: GarageTheme.textStrong,
    backgroundColor: GarageTheme.panel,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sessionStats: {
    flexDirection: 'row',
    gap: 16,
  },
  sessionStat: {
    flex: 1,
  },
  sessionStatLabel: {
    fontSize: 11,
    color: GarageTheme.textMuted,
    marginBottom: 2,
  },
  sessionStatValue: {
    fontSize: 13,
    fontWeight: '600',
    color: GarageTheme.textStrong,
  },
});

export default ExerciseHistoryScreen;
