/**
 * History Screen
 * Calendar view of training sessions
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import DatabaseService from '@services/DatabaseService';
import { SessionData, SetData } from '@types/index';
import { format, parseISO } from 'date-fns';

interface HistoryScreenProps {
  navigation: any;
}

const HistoryScreen: React.FC<HistoryScreenProps> = ({ navigation }) => {
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      const allSessions = await DatabaseService.getSessions();
      setSessions(allSessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSessions();
    setRefreshing(false);
  };

  const handleSessionPress = async (session: SessionData) => {
    try {
      const sets = await DatabaseService.getSetsForSession(session.session_id);
      navigation.navigate('SessionDetail', { session, sets });
    } catch (error) {
      console.error('Failed to load session details:', error);
    }
  };

  const formatDate = (dateStr: string): string => {
    try {
      const date = parseISO(dateStr);
      return format(date, 'yyyy/MM/dd (E)');
    } catch {
      return dateStr;
    }
  };

  const groupSessionsByMonth = () => {
    const grouped = new Map<string, SessionData[]>();

    sessions.forEach((session) => {
      try {
        const date = parseISO(session.date);
        const monthKey = format(date, 'yyyy年MM月');

        if (!grouped.has(monthKey)) {
          grouped.set(monthKey, []);
        }
        grouped.get(monthKey)!.push(session);
      } catch {
        // Skip invalid dates
      }
    });

    return grouped;
  };

  const groupedSessions = groupSessionsByMonth();

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2196F3" />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>トレーニング履歴</Text>
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
                  <Text style={styles.sessionDate}>{formatDate(session.date)}</Text>
                  {session.duration_minutes && (
                    <Text style={styles.sessionDuration}>
                      {session.duration_minutes}分
                    </Text>
                  )}
                </View>

                <View style={styles.sessionStats}>
                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{session.total_sets}</Text>
                    <Text style={styles.statLabel}>セット</Text>
                  </View>

                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>
                      {Math.round(session.total_volume).toLocaleString()}
                    </Text>
                    <Text style={styles.statLabel}>kg</Text>
                  </View>

                  <View style={styles.statBox}>
                    <Text style={styles.statValue}>{session.lifts?.length || 0}</Text>
                    <Text style={styles.statLabel}>種目</Text>
                  </View>
                </View>

                {session.notes && (
                  <Text style={styles.sessionNotes} numberOfLines={2}>
                    {session.notes}
                  </Text>
                )}

                <View style={styles.arrowContainer}>
                  <Text style={styles.arrow}>→</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ))
      )}

      {sessions.length > 0 && (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>統計</Text>
          <View style={styles.summaryStats}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{sessions.length}</Text>
              <Text style={styles.summaryLabel}>総セッション</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {sessions.reduce((sum, s) => sum + s.total_sets, 0)}
              </Text>
              <Text style={styles.summaryLabel}>総セット数</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                {Math.round(
                  sessions.reduce((sum, s) => sum + s.total_volume, 0)
                ).toLocaleString()}
              </Text>
              <Text style={styles.summaryLabel}>総ボリューム(kg)</Text>
            </View>
          </View>
        </View>
      )}
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
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
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
  arrowContainer: {
    position: 'absolute',
    right: 16,
    top: '50%',
  },
  arrow: {
    fontSize: 20,
    color: '#666',
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
