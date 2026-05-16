/**
 * History Screen
 * Calendar view of training sessions
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import DatabaseService from '../services/DatabaseService';
import { SessionData, SetData } from '../types/index';
import { format, parseISO } from 'date-fns';
import { formatSessionLabel } from '../utils/session';
import { GarageTheme } from '../constants/garageTheme';

interface HistoryScreenProps {
  navigation: any;
}

type HistorySession = SessionData & {
  lifts: string[];
  derivedTotalSets: number;
  derivedTotalVolume: number;
  sets: SetData[];
};

const HistoryScreen: React.FC<HistoryScreenProps> = ({ navigation }) => {
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const isFocused = useIsFocused();

  const enrichSession = useCallback(async (session: SessionData): Promise<HistorySession> => {
    const sets = await DatabaseService.getSetsForSession(session.session_id);
    const lifts = Array.from(new Set(sets.map((set) => set.lift).filter(Boolean)));
    const derivedTotalSets = sets.length || session.total_sets || 0;
    const derivedTotalVolume =
      sets.reduce((sum, set) => sum + set.load_kg * set.reps, 0) || session.total_volume || 0;

    return {
      ...session,
      lifts,
      derivedTotalSets,
      derivedTotalVolume,
      sets,
    };
  }, []);

  const loadSessions = useCallback(async () => {
    try {
      const allSessions = await DatabaseService.getSessions();
      const enriched = await Promise.all(allSessions.map(enrichSession));
      setSessions(enriched);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  }, [enrichSession]);

  useEffect(() => {
    if (isFocused) {
      void loadSessions();
    }
  }, [isFocused, loadSessions]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  };

  const handleSessionPress = async (session: HistorySession) => {
    navigation.navigate('SessionDetail', { session, sets: session.sets });
  };

  const handleHistoryCoachPress = () => {
    const totalSets = sessions.reduce((sum, session) => sum + session.derivedTotalSets, 0);
    const totalVolume = sessions.reduce((sum, session) => sum + session.derivedTotalVolume, 0);
    navigation.navigate('CoachChat', {
      source: 'history',
      message: '最近のトレーニング履歴を要約して',
      totalSets,
      totalVolume: Math.round(totalVolume),
      currentExercise: sessions[0]?.lifts?.[0] ?? '',
    });
  };

  const handleSessionCoachPress = (session: HistorySession) => {
    navigation.navigate('CoachChat', {
      source: 'history-session',
      sessionId: session.session_id,
      currentExercise: session.lifts[0] ?? '',
      totalSets: session.derivedTotalSets,
      totalVolume: Math.round(session.derivedTotalVolume),
      message: 'このセッションを振り返って改善点を教えて',
    });
  };

  const formatDate = (dateStr: string, sessionId?: string): string => {
    try {
      const date = parseISO(dateStr);
      const formatted = format(date, 'yyyy/MM/dd (E)');
      return sessionId ? formatSessionLabel(sessionId, formatted) : formatted;
    } catch {
      return dateStr;
    }
  };

  const groupedSessions = useMemo(() => {
    const grouped = new Map<string, HistorySession[]>();

    sessions.forEach((session) => {
      try {
        const date = parseISO(session.date);
        const monthKey = format(date, 'yyyy年MM月');

        if (!grouped.has(monthKey)) {
          grouped.set(monthKey, []);
        }
        grouped.get(monthKey)?.push(session);
      } catch {
        // ignore invalid date
      }
    });

    return grouped;
  }, [sessions]);

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={GarageTheme.accent} />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>RUN LOG / HISTORY</Text>
          <Text style={styles.title}>セッション履歴</Text>
          <Text style={styles.subtitle}>セッション詳細とコーチ分析をここから確認</Text>
        </View>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerExerciseButton}
            onPress={() => navigation.navigate('ExerciseHistory')}
          >
            <Text style={styles.headerExerciseButtonText}>種目別</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerCoachButton} onPress={handleHistoryCoachPress}>
            <Text style={styles.headerCoachButtonText}>SUMMARY</Text>
          </TouchableOpacity>
        </View>
      </View>

      {sessions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>まだトレーニング記録がありません</Text>
          <Text style={styles.emptySubtext}>セッションを開始して記録を始めましょう</Text>
        </View>
      ) : (
        Array.from(groupedSessions.entries()).map(([month, monthSessions]) => (
          <View key={month} style={styles.monthGroup}>
            <Text style={styles.monthHeader}>{month}</Text>

            {monthSessions.map((session) => (
              <TouchableOpacity
                key={session.session_id}
                style={styles.sessionCard}
                onPress={() => handleSessionPress(session)}
              >
                <View style={styles.sessionHeader}>
                  <Text style={styles.sessionDate}>{formatDate(session.date, session.session_id)}</Text>
                  {session.duration_minutes ? (
                    <Text style={styles.sessionDuration}>{session.duration_minutes}分</Text>
                  ) : null}
                </View>

                <Text style={styles.liftText} numberOfLines={2}>
                  {session.lifts.length > 0 ? session.lifts.join(' / ') : '種目情報なし'}
                </Text>

                <View style={styles.sessionStats}>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{session.derivedTotalSets}</Text>
                    <Text style={styles.statLabel}>セット</Text>
                  </View>

                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>
                      {Math.round(session.derivedTotalVolume).toLocaleString()}
                    </Text>
                    <Text style={styles.statLabel}>kg</Text>
                  </View>

                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{session.lifts.length}</Text>
                    <Text style={styles.statLabel}>種目</Text>
                  </View>
                </View>

                {session.notes ? (
                  <Text style={styles.sessionNotes} numberOfLines={2}>
                    {session.notes}
                  </Text>
                ) : null}

                <View style={styles.cardActions}>
                  <Text style={styles.detailLink}>DETAIL</Text>
                  <TouchableOpacity
                    style={styles.sessionCoachButton}
                    onPress={() => handleSessionCoachPress(session)}
                  >
                    <Text style={styles.sessionCoachButtonText}>COACH</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ))
      )}

      {sessions.length > 0 ? (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>TELEMETRY SUMMARY</Text>
          <View style={styles.summaryStats}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{sessions.length}</Text>
              <Text style={styles.summaryLabel}>総セッション</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {sessions.reduce((sum, s) => sum + s.derivedTotalSets, 0)}
              </Text>
              <Text style={styles.summaryLabel}>総セット数</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {Math.round(
                  sessions.reduce((sum, s) => sum + s.derivedTotalVolume, 0),
                ).toLocaleString()}
              </Text>
              <Text style={styles.summaryLabel}>総ボリューム(kg)</Text>
            </View>
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GarageTheme.background,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: GarageTheme.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: GarageTheme.accent,
    letterSpacing: 2,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: GarageTheme.textStrong,
    letterSpacing: 0.4,
  },
  subtitle: {
    fontSize: 12,
    color: GarageTheme.textMuted,
    marginTop: 6,
    lineHeight: 18,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerExerciseButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: GarageTheme.accent,
    borderWidth: 1,
    borderColor: GarageTheme.accent,
  },
  headerExerciseButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  headerCoachButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: GarageTheme.panel,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
  },
  headerCoachButtonText: {
    color: GarageTheme.accentSoft,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: GarageTheme.textMuted,
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: GarageTheme.textSubtle,
    textAlign: 'center',
  },
  monthGroup: {
    marginTop: 8,
  },
  monthHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: GarageTheme.accent,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: GarageTheme.surfaceAlt,
    letterSpacing: 1.8,
  },
  sessionCard: {
    backgroundColor: GarageTheme.surface,
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    borderLeftWidth: 4,
    borderLeftColor: GarageTheme.accent,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sessionDate: {
    fontSize: 16,
    fontWeight: '600',
    color: GarageTheme.textStrong,
  },
  sessionDuration: {
    fontSize: 12,
    color: GarageTheme.textMuted,
  },
  liftText: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  sessionStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: GarageTheme.accent,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: GarageTheme.textMuted,
  },
  sessionNotes: {
    fontSize: 12,
    color: GarageTheme.textMuted,
    fontStyle: 'italic',
    marginTop: 8,
  },
  cardActions: {
    marginTop: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  detailLink: {
    fontSize: 12,
    color: GarageTheme.info,
    fontWeight: '700',
    letterSpacing: 1,
  },
  sessionCoachButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
  },
  sessionCoachButtonText: {
    color: GarageTheme.accentSoft,
    fontSize: 12,
    fontWeight: '700',
  },
  summaryCard: {
    margin: 16,
    padding: 20,
    backgroundColor: GarageTheme.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: GarageTheme.textStrong,
    marginBottom: 16,
    textAlign: 'center',
  },
  summaryStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: GarageTheme.success,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: GarageTheme.textMuted,
    textAlign: 'center',
  },
});

export default HistoryScreen;
