/**
 * History Screen
 * Calendar view of training sessions
 */

import React, { useEffect, useMemo, useState } from 'react';
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

  useEffect(() => {
    void loadSessions();
  }, []);

  const enrichSession = async (session: SessionData): Promise<HistorySession> => {
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
  };

  const loadSessions = async () => {
    try {
      const allSessions = await DatabaseService.getSessions();
      const enriched = await Promise.all(allSessions.map(enrichSession));
      setSessions(enriched);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

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
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2196F3" />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>トレーニング履歴</Text>
          <Text style={styles.subtitle}>セッション詳細と AI 振り返りをここから確認</Text>
        </View>
        <TouchableOpacity style={styles.headerCoachButton} onPress={handleHistoryCoachPress}>
          <Text style={styles.headerCoachButtonText}>AI要約</Text>
        </TouchableOpacity>
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
                  <Text style={styles.detailLink}>詳細を見る →</Text>
                  <TouchableOpacity
                    style={styles.sessionCoachButton}
                    onPress={() => handleSessionCoachPress(session)}
                  >
                    <Text style={styles.sessionCoachButtonText}>AIコーチ</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ))
      )}

      {sessions.length > 0 ? (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>統計</Text>
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
    backgroundColor: '#1a1a1a',
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: 12,
    color: '#8d8d8d',
    marginTop: 4,
  },
  headerCoachButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#1f1512',
    borderWidth: 1,
    borderColor: '#ff6a2a',
  },
  headerCoachButtonText: {
    color: '#ffb347',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  monthGroup: {
    marginTop: 8,
  },
  monthHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#2a2a2a',
  },
  sessionCard: {
    backgroundColor: '#2a2a2a',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
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
    color: '#fff',
  },
  sessionDuration: {
    fontSize: 12,
    color: '#999',
  },
  liftText: {
    color: '#f1eee9',
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
    color: '#2196F3',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
  },
  sessionNotes: {
    fontSize: 12,
    color: '#999',
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
    fontSize: 13,
    color: '#9ad0ff',
    fontWeight: '600',
  },
  sessionCoachButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#1a1311',
    borderWidth: 1,
    borderColor: '#ff6a2a',
  },
  sessionCoachButtonText: {
    color: '#ffb347',
    fontSize: 12,
    fontWeight: '700',
  },
  summaryCard: {
    margin: 16,
    padding: 20,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
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
    color: '#4CAF50',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});

export default HistoryScreen;
