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
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
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

type HistoryViewMode = 'list' | 'calendar' | 'graph';
type GraphMetric = 'volume' | 'sets' | 'duration';

const HistoryScreen: React.FC<HistoryScreenProps> = ({ navigation }) => {
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<HistoryViewMode>('list');
  const [calendarMonth, setCalendarMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [graphMetric, setGraphMetric] = useState<GraphMetric>('volume');
  const [selectedGraphDateKey, setSelectedGraphDateKey] = useState<string | null>(null);
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

  const sessionsByDate = useMemo(() => {
    const grouped = new Map<string, HistorySession[]>();

    for (const session of sessions) {
      try {
        const dateKey = format(parseISO(session.date), 'yyyy-MM-dd');
        grouped.set(dateKey, [...(grouped.get(dateKey) ?? []), session]);
      } catch {
        // ignore invalid date
      }
    }

    return grouped;
  }, [sessions]);

  const selectedDateSessions = selectedDateKey
    ? sessionsByDate.get(selectedDateKey) ?? []
    : [];

  const monthDays = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 1 });

    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [calendarMonth]);

  const dailySummaries = useMemo(() => {
    const rows = Array.from(sessionsByDate.entries())
      .map(([dateKey, dateSessions]) => {
        const totalSets = dateSessions.reduce((sum, session) => sum + session.derivedTotalSets, 0);
        const totalVolume = dateSessions.reduce(
          (sum, session) => sum + session.derivedTotalVolume,
          0,
        );
        const totalDuration = dateSessions.reduce(
          (sum, session) => sum + (session.duration_minutes ?? 0),
          0,
        );
        const lifts = Array.from(new Set(dateSessions.flatMap((session) => session.lifts)));

        return {
          dateKey,
          totalSets,
          totalVolume,
          totalDuration,
          sessionCount: dateSessions.length,
          lifts,
        };
      })
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey));

    return rows.slice(-14);
  }, [sessionsByDate]);

  const graphMaxValue = useMemo(() => {
    const values = dailySummaries.map((summary) => {
      if (graphMetric === 'sets') return summary.totalSets;
      if (graphMetric === 'duration') return summary.totalDuration;
      return summary.totalVolume;
    });

    return Math.max(...values, 1);
  }, [dailySummaries, graphMetric]);

  const selectedGraphSummary =
    dailySummaries.find((summary) => summary.dateKey === selectedGraphDateKey) ??
    dailySummaries[dailySummaries.length - 1];

  const metricLabel = graphMetric === 'sets' ? 'セット' : graphMetric === 'duration' ? '分' : 'kg';

  const renderSessionCard = (session: HistorySession) => (
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
      </View>
    </TouchableOpacity>
  );

  const renderListView = () =>
    Array.from(groupedSessions.entries()).map(([month, monthSessions]) => (
      <View key={month} style={styles.monthGroup}>
        <Text style={styles.monthHeader}>{month}</Text>
        {monthSessions.map(renderSessionCard)}
      </View>
    ));

  const renderCalendarView = () => (
    <View style={styles.modeBody}>
      <View style={styles.calendarHeader}>
        <TouchableOpacity
          style={styles.calendarNavButton}
          onPress={() => setCalendarMonth((current) => subMonths(current, 1))}
        >
          <Text style={styles.calendarNavText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.calendarTitle}>{format(calendarMonth, 'yyyy年M月')}</Text>
        <TouchableOpacity
          style={styles.calendarNavButton}
          onPress={() => setCalendarMonth((current) => addMonths(current, 1))}
        >
          <Text style={styles.calendarNavText}>›</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.weekdayRow}>
        {['月', '火', '水', '木', '金', '土', '日'].map((weekday) => (
          <Text key={weekday} style={styles.weekdayText}>
            {weekday}
          </Text>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {monthDays.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const daySessions = sessionsByDate.get(dateKey) ?? [];
          const totalVolume = daySessions.reduce(
            (sum, session) => sum + session.derivedTotalVolume,
            0,
          );
          const isSelected = selectedDateKey === dateKey;
          const hasSessions = daySessions.length > 0;

          return (
            <TouchableOpacity
              key={dateKey}
              style={[
                styles.dayCell,
                !isSameMonth(day, calendarMonth) && styles.dayCellOutside,
                hasSessions && styles.dayCellActive,
                isSelected && styles.dayCellSelected,
              ]}
              onPress={() => setSelectedDateKey(dateKey)}
            >
              <Text
                style={[
                  styles.dayNumber,
                  !isSameMonth(day, calendarMonth) && styles.dayNumberOutside,
                  hasSessions && styles.dayNumberActive,
                ]}
              >
                {format(day, 'd')}
              </Text>
              {hasSessions ? (
                <>
                  <Text style={styles.daySessionCount}>{daySessions.length}回</Text>
                  <Text style={styles.dayVolume}>{Math.round(totalVolume / 1000)}k</Text>
                </>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.selectedDayPanel}>
        <Text style={styles.selectedDayTitle}>
          {selectedDateKey
            ? format(parseISO(selectedDateKey), 'yyyy/MM/dd')
            : '日付を選択'}
        </Text>
        {selectedDateSessions.length === 0 ? (
          <Text style={styles.selectedDayEmpty}>この日の記録はありません</Text>
        ) : (
          selectedDateSessions.map(renderSessionCard)
        )}
      </View>
    </View>
  );

  const renderGraphView = () => (
    <View style={styles.modeBody}>
      <View style={styles.graphHeader}>
        <View>
          <Text style={styles.graphTitle}>14日トレンド</Text>
          <Text style={styles.graphSubtitle}>日別のボリューム・セット・時間を切替表示</Text>
        </View>
        <View style={styles.metricTabs}>
          {[
            ['volume', 'kg'],
            ['sets', 'set'],
            ['duration', 'min'],
          ].map(([metric, label]) => (
            <TouchableOpacity
              key={metric}
              style={[
                styles.metricTab,
                graphMetric === metric && styles.metricTabActive,
              ]}
              onPress={() => setGraphMetric(metric as GraphMetric)}
            >
              <Text
                style={[
                  styles.metricTabText,
                  graphMetric === metric && styles.metricTabTextActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {dailySummaries.length === 0 ? (
        <Text style={styles.selectedDayEmpty}>グラフ化できる履歴がありません</Text>
      ) : (
        <>
          {selectedGraphSummary ? (
            <View style={styles.tooltipCard}>
              <Text style={styles.tooltipDate}>
                {format(parseISO(selectedGraphSummary.dateKey), 'yyyy/MM/dd')}
              </Text>
              <Text style={styles.tooltipMain}>
                {graphMetric === 'sets'
                  ? selectedGraphSummary.totalSets.toLocaleString()
                  : graphMetric === 'duration'
                    ? selectedGraphSummary.totalDuration.toLocaleString()
                    : Math.round(selectedGraphSummary.totalVolume).toLocaleString()}{' '}
                {metricLabel}
              </Text>
              <Text style={styles.tooltipSub}>
                {selectedGraphSummary.sessionCount}セッション /{' '}
                {selectedGraphSummary.lifts.slice(0, 3).join(' / ') || '種目なし'}
              </Text>
            </View>
          ) : null}

          <View style={styles.barChart}>
            {dailySummaries.map((summary) => {
              const value =
                graphMetric === 'sets'
                  ? summary.totalSets
                  : graphMetric === 'duration'
                    ? summary.totalDuration
                    : summary.totalVolume;
              const heightPercent = Math.max(10, Math.round((value / graphMaxValue) * 100));
              const isSelected = selectedGraphSummary?.dateKey === summary.dateKey;

              return (
                <TouchableOpacity
                  key={summary.dateKey}
                  style={styles.barColumn}
                  onPress={() => setSelectedGraphDateKey(summary.dateKey)}
                >
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        { height: `${heightPercent}%` },
                        isSelected && styles.barFillSelected,
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel}>{format(parseISO(summary.dateKey), 'M/d')}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
    </View>
  );

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
        </View>
      </View>

      <View style={styles.modeTabs}>
        {[
          ['list', 'リスト'],
          ['calendar', 'カレンダー'],
          ['graph', 'グラフ'],
        ].map(([mode, label]) => (
          <TouchableOpacity
            key={mode}
            style={[styles.modeTab, viewMode === mode && styles.modeTabActive]}
            onPress={() => setViewMode(mode as HistoryViewMode)}
          >
            <Text style={[styles.modeTabText, viewMode === mode && styles.modeTabTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {sessions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>まだトレーニング記録がありません</Text>
          <Text style={styles.emptySubtext}>セッションを開始して記録を始めましょう</Text>
        </View>
      ) : viewMode === 'calendar' ? (
        renderCalendarView()
      ) : viewMode === 'graph' ? (
        renderGraphView()
      ) : (
        renderListView()
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
  modeTabs: {
    flexDirection: 'row',
    margin: 16,
    padding: 4,
    borderRadius: 999,
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: GarageTheme.accent,
  },
  modeTabText: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  modeTabTextActive: {
    color: '#ffffff',
  },
  modeBody: {
    paddingBottom: 4,
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
  calendarHeader: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarNavButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
  },
  calendarNavText: {
    color: GarageTheme.textStrong,
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 30,
  },
  calendarTitle: {
    color: GarageTheme.textStrong,
    fontSize: 18,
    fontWeight: '800',
  },
  weekdayRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 6,
  },
  weekdayText: {
    flex: 1,
    color: GarageTheme.textMuted,
    fontSize: 11,
    fontWeight: '800',
    textAlign: 'center',
  },
  calendarGrid: {
    marginHorizontal: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: GarageTheme.border,
    backgroundColor: GarageTheme.surfaceAlt,
  },
  dayCell: {
    width: `${100 / 7}%`,
    minHeight: 70,
    padding: 6,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: GarageTheme.border,
    backgroundColor: GarageTheme.surface,
  },
  dayCellOutside: {
    opacity: 0.35,
  },
  dayCellActive: {
    backgroundColor: GarageTheme.panel,
  },
  dayCellSelected: {
    borderWidth: 2,
    borderColor: GarageTheme.accent,
  },
  dayNumber: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  dayNumberOutside: {
    color: GarageTheme.textSubtle,
  },
  dayNumberActive: {
    color: GarageTheme.textStrong,
  },
  daySessionCount: {
    marginTop: 8,
    color: GarageTheme.accent,
    fontSize: 11,
    fontWeight: '800',
  },
  dayVolume: {
    color: GarageTheme.textMuted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  selectedDayPanel: {
    marginTop: 16,
  },
  selectedDayTitle: {
    color: GarageTheme.textStrong,
    fontSize: 16,
    fontWeight: '800',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  selectedDayEmpty: {
    color: GarageTheme.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginHorizontal: 16,
    padding: 16,
    borderRadius: 14,
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  graphHeader: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  graphTitle: {
    color: GarageTheme.textStrong,
    fontSize: 18,
    fontWeight: '800',
  },
  graphSubtitle: {
    color: GarageTheme.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  metricTabs: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 999,
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  metricTab: {
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 999,
  },
  metricTabActive: {
    backgroundColor: GarageTheme.accent,
  },
  metricTabText: {
    color: GarageTheme.textMuted,
    fontSize: 11,
    fontWeight: '800',
  },
  metricTabTextActive: {
    color: '#ffffff',
  },
  tooltipCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
  },
  tooltipDate: {
    color: GarageTheme.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  tooltipMain: {
    color: GarageTheme.textStrong,
    fontSize: 24,
    fontWeight: '900',
    marginTop: 4,
  },
  tooltipSub: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  barChart: {
    height: 220,
    marginHorizontal: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    borderRadius: 18,
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  barTrack: {
    flex: 1,
    width: '100%',
    borderRadius: 999,
    justifyContent: 'flex-end',
    backgroundColor: GarageTheme.surfaceAlt,
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 999,
    backgroundColor: GarageTheme.accentSoft,
  },
  barFillSelected: {
    backgroundColor: GarageTheme.accent,
  },
  barLabel: {
    color: GarageTheme.textMuted,
    fontSize: 10,
    fontWeight: '700',
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
