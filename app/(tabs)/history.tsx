/**
 * History Screen
 * トレーニング履歴の閲覧・検索・フィルター・削除機能
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    TextInput,
    Alert,
    ActivityIndicator,
    Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useRouter, useFocusEffect } from 'expo-router';
import { format, parseISO, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { ja } from 'date-fns/locale';
import DatabaseService from '@/src/services/DatabaseService';
import AICoachService from '@/src/services/AICoachService';
import { formatSessionForAI } from '@/src/utils/formatDataForAI';
import { getLocalizedExerciseName } from '@/src/utils/exerciseLocalization';
import type { SessionData } from '@/src/types/index';

type FilterPeriod = 'all' | 'week' | 'month' | '3months';
type SortOrder = 'newest' | 'oldest' | 'volume';

const LIFT_FILTERS = ['すべて', 'ベンチプレス', 'スクワット', 'デッドリフト', 'オーバーヘッドプレス', 'バーベルロー'];

export default function HistoryScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const [sessions, setSessions] = useState<SessionData[]>([]);
    const [filteredSessions, setFilteredSessions] = useState<SessionData[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [weeklyStats, setWeeklyStats] = useState<{ week: string; volume: number; sets: number }[]>([]);

    // フィルター・検索
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLift, setSelectedLift] = useState('すべて');
    const [period, setPeriod] = useState<FilterPeriod>('all');
    const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
    const [showFilterModal, setShowFilterModal] = useState(false);

    // タブ切替（カレンダー/リスト/統計）
    const [activeTab, setActiveTab] = useState<'list' | 'stats'>('list');

    // 画面フォーカス時に再読み込み
    useFocusEffect(useCallback(() => {
        loadAll();
    }, []));

    const loadAll = async () => {
        try {
            const [allSessions, stats] = await Promise.all([
                DatabaseService.getSessions(),
                DatabaseService.getWeeklyStats(),
            ]);
            setSessions(allSessions);
            setWeeklyStats(stats);
            applyFilters(allSessions, searchQuery, selectedLift, period, sortOrder);
        } catch (error) {
            console.error('履歴読み込み失敗:', error);
        } finally {
            setLoading(false);
        }
    };

    const applyFilters = (
        data: SessionData[],
        query: string,
        lift: string,
        p: FilterPeriod,
        sort: SortOrder
    ) => {
        let result = [...data];

        // 期間フィルター
        const now = new Date();
        if (p === 'week') {
            result = result.filter(s => {
                const d = parseISO(s.date);
                return isWithinInterval(d, { start: startOfWeek(now, { locale: ja }), end: now });
            });
        } else if (p === 'month') {
            const monthAgo = new Date(now); monthAgo.setMonth(monthAgo.getMonth() - 1);
            result = result.filter(s => parseISO(s.date) >= monthAgo);
        } else if (p === '3months') {
            const threeAgo = new Date(now); threeAgo.setMonth(threeAgo.getMonth() - 3);
            result = result.filter(s => parseISO(s.date) >= threeAgo);
        }

        // メモ検索
        if (query.trim()) {
            result = result.filter(s =>
                (s.notes || '').toLowerCase().includes(query.toLowerCase()) ||
                s.date.includes(query)
            );
        }

        // 種目フィルター
        if (lift !== 'すべて') {
            result = result.filter(s =>
                s.lifts?.some((sessionLift) => getLocalizedExerciseName(sessionLift) === lift) || false
            );
        }

        // ソート
        if (sort === 'newest') result.sort((a, b) => b.date.localeCompare(a.date));
        else if (sort === 'oldest') result.sort((a, b) => a.date.localeCompare(b.date));
        else if (sort === 'volume') result.sort((a, b) => (b.total_volume || 0) - (a.total_volume || 0));

        setFilteredSessions(result);
    };

    // フィルター変更時に再適用
    useEffect(() => {
        applyFilters(sessions, searchQuery, selectedLift, period, sortOrder);
    }, [searchQuery, selectedLift, period, sortOrder]);

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadAll();
        setRefreshing(false);
    };

    const handleSessionPress = (session: SessionData) => {
        router.push({
            pathname: '/(tabs)/session-detail',
            params: { session_id: session.session_id },
        } as any);
    };

    const handleCopyToClipboard = async (session: SessionData) => {
        try {
            const [sets, reps] = await Promise.all([
                DatabaseService.getSetsForSession(session.session_id),
                DatabaseService.getRepsForSession(session.session_id),
            ]);
            const formattedText = formatSessionForAI(session, sets, reps);
            await Clipboard.setStringAsync(formattedText);
            Alert.alert('コピー完了', `${session.date}のデータをクリップボードにコピーしました。`);
        } catch (error) {
            console.error('コピー失敗:', error);
            Alert.alert('エラー', 'データのコピーに失敗しました');
        }
    };

    const handleDeleteSession = (session: SessionData) => {
        Alert.alert(
            '🗑️ セッションを削除',
            `${session.date}のセッションを削除しますか？\nこの操作は元に戻せません。`,
            [
                { text: 'キャンセル', style: 'cancel' },
                {
                    text: '削除', style: 'destructive',
                    onPress: async () => {
                        try {
                            await DatabaseService.deleteSession(session.session_id);
                            await loadAll();
                        } catch {
                            Alert.alert('エラー', '削除に失敗しました');
                        }
                    },
                },
            ]
        );
    };

    // セッションを月ごとにグループ化
    const groupByMonth = (data: SessionData[]) => {
        const groups: Record<string, SessionData[]> = {};
        data.forEach(s => {
            const month = s.date.slice(0, 7); // YYYY-MM
            if (!groups[month]) groups[month] = [];
            groups[month].push(s);
        });
        return groups;
    };

    // 週間統計の最大ボリュームを計算
    const maxWeekVolume = weeklyStats.length > 0
        ? Math.max(...weeklyStats.map(w => w.volume || 0))
        : 1;

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2196F3" />
                <Text style={styles.loadingText}>読み込み中...</Text>
            </View>
        );
    }

    const groupedSessions = groupByMonth(filteredSessions);

    return (
        <View style={styles.container}>
            {/* ヘッダー */}
            <View style={[styles.header, { paddingTop: (insets.top || 0) + 12 }]}>
                <View style={styles.headerCopy}>
                    <Text style={styles.headerEyebrow}>DATA GARAGE</Text>
                    <Text style={styles.title}>トレーニング履歴</Text>
                </View>
                <TouchableOpacity style={styles.filterButton} onPress={() => setShowFilterModal(true)}>
                    <Text style={styles.filterButtonText}>FILTER</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.heroStrip}>
                <View style={styles.heroCard}>
                    <Text style={styles.heroLabel}>LOGS</Text>
                    <Text style={styles.heroValue}>{sessions.length}</Text>
                </View>
                <View style={styles.heroCard}>
                    <Text style={styles.heroLabel}>LOAD</Text>
                    <Text style={styles.heroValue}>
                        {Math.round(sessions.reduce((sum, s) => sum + (s.total_volume || 0), 0) / 1000)}k
                    </Text>
                </View>
                <View style={styles.heroCard}>
                    <Text style={styles.heroLabel}>MODE</Text>
                    <Text style={styles.heroValue}>{activeTab === 'list' ? 'LIST' : 'STATS'}</Text>
                </View>
            </View>

            {/* タブ */}
            <View style={styles.tabBar}>
                {(['list', 'stats'] as const).map(tab => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tab, activeTab === tab && styles.tabActive]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                            {tab === 'list' ? '📋 一覧' : '📊 統計'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* 検索バー */}
            <View style={styles.searchBar}>
                <TextInput
                    style={styles.searchInput}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    placeholder="🔍 日付・メモで検索..."
                    placeholderTextColor="#666"
                />
                {searchQuery ? (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Text style={styles.clearSearch}>✕</Text>
                    </TouchableOpacity>
                ) : null}
            </View>

            {/* アクティブフィルター表示 */}
            {(period !== 'all' || selectedLift !== 'すべて') && (
                <View style={styles.activeFilters}>
                    {period !== 'all' && (
                        <View style={styles.filterTag}>
                            <Text style={styles.filterTagText}>
                                {period === 'week' ? '今週' : period === 'month' ? '1ヶ月' : '3ヶ月'}
                            </Text>
                            <TouchableOpacity onPress={() => setPeriod('all')}>
                                <Text style={styles.filterTagClose}> ✕</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                    {selectedLift !== 'すべて' && (
                        <View style={styles.filterTag}>
                            <Text style={styles.filterTagText}>{selectedLift}</Text>
                            <TouchableOpacity onPress={() => setSelectedLift('すべて')}>
                                <Text style={styles.filterTagClose}> ✕</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            )}

            <ScrollView
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#2196F3" />}
            >
                {/* 統計タブ */}
                {activeTab === 'stats' && (
                    <View style={styles.section}>
                        <Text style={styles.panelEyebrow}>TREND TELEMETRY</Text>
                        <Text style={styles.sectionTitle}>週間ボリューム（直近8週）</Text>
                        {weeklyStats.length === 0 ? (
                            <Text style={styles.emptyText}>データがありません</Text>
                        ) : (
                            weeklyStats.map((stat, idx) => {
                                const pct = (stat.volume / maxWeekVolume) * 100;
                                return (
                                    <View key={idx} style={styles.weekRow}>
                                        <Text style={styles.weekLabel}>{stat.week}</Text>
                                        <View style={styles.weekBarTrack}>
                                            <View style={[styles.weekBarFill, { width: `${pct}%` }]} />
                                        </View>
                                        <Text style={styles.weekValue}>{Math.round(stat.volume).toLocaleString()}</Text>
                                    </View>
                                );
                            })
                        )}
                        <Text style={styles.unitLabel}>単位: kg（総ボリューム）</Text>

                        {/* サマリーカード */}
                        <View style={styles.summaryGrid}>
                            <View style={styles.summaryCard}>
                                <Text style={styles.summaryValue}>{sessions.length}</Text>
                                <Text style={styles.summaryLabel}>総セッション</Text>
                            </View>
                            <View style={styles.summaryCard}>
                                <Text style={styles.summaryValue}>
                                    {Math.round(sessions.reduce((s, x) => s + (x.total_volume || 0), 0) / 1000)}k
                                </Text>
                                <Text style={styles.summaryLabel}>総ボリューム kg</Text>
                            </View>
                            <View style={styles.summaryCard}>
                                <Text style={styles.summaryValue}>
                                    {sessions.reduce((s, x) => s + (x.total_sets || 0), 0)}
                                </Text>
                                <Text style={styles.summaryLabel}>総セット数</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* リストタブ */}
                {activeTab === 'list' && (
                    <>
                        <Text style={[styles.panelEyebrow, styles.listEyebrow]}>SESSION LOGBOOK</Text>
                        <Text style={styles.countText}>{filteredSessions.length}件のセッション</Text>
                        <Text style={styles.listHintText}>タップで詳細、長押しで削除、AIコピーで相談用テキストを作成</Text>
                        {filteredSessions.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyEmoji}>📭</Text>
                                <Text style={styles.emptyText}>セッションが見つかりません</Text>
                                <Text style={styles.emptySubText}>フィルターを解除するか、トレーニングを記録してください</Text>
                            </View>
                        ) : (
                            Object.entries(groupedSessions).map(([month, monthSessions]) => (
                                <View key={month}>
                                    {/* 月ヘッダー */}
                                    <View style={styles.monthHeader}>
                                        <Text style={styles.monthTitle}>
                                            {month.replace('-', '年')}月
                                        </Text>
                                        <Text style={styles.monthCount}>{monthSessions.length}セッション</Text>
                                    </View>

                                    {monthSessions.map((session, idx) => {
                                        const vol = Math.round(session.total_volume || 0);
                                        const dateLabel = (() => {
                                            try {
                                                return format(parseISO(session.date), 'M/d (E)', { locale: ja });
                                            } catch { return session.date; }
                                        })();

                                        return (
                                            <TouchableOpacity
                                                key={idx}
                                                style={styles.sessionCard}
                                                onPress={() => handleSessionPress(session)}
                                                onLongPress={() => handleDeleteSession(session)}
                                                activeOpacity={0.7}
                                            >
                                                <View style={styles.sessionLeft}>
                                                    <Text style={styles.cardEyebrow}>RUN {String(idx + 1).padStart(2, '0')}</Text>
                                                    <Text style={styles.sessionDate}>{dateLabel}</Text>
                                                    {session.notes && (
                                                        <Text style={styles.sessionNotes} numberOfLines={1}>
                                                            📝 {session.notes}
                                                        </Text>
                                                    )}
                                                    {session.lifts && session.lifts.length > 0 && (
                                                        <View style={styles.liftTags}>
                                                            {session.lifts.slice(0, 3).map((lift, li) => (
                                                                <View key={li} style={styles.liftTag}>
                                                                    <Text style={styles.liftTagText}>{getLocalizedExerciseName(lift)}</Text>
                                                                </View>
                                                            ))}
                                                        </View>
                                                    )}
                                                </View>
                                                <View style={styles.sessionRight}>
                                                    <TouchableOpacity
                                                        style={styles.cardCopyBtn}
                                                        onPress={() => handleCopyToClipboard(session)}
                                                    >
                                                        <Text style={styles.cardCopyBtnText}>AIコピー</Text>
                                                    </TouchableOpacity>
                                                    <Text style={styles.sessionVolume}>{vol.toLocaleString()}</Text>
                                                    <Text style={styles.sessionVolumeUnit}>kg</Text>
                                                    <Text style={styles.sessionSets}>{session.total_sets}セット</Text>
                                                    <Text style={styles.sessionOpenHint}>詳細を見る →</Text>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            ))
                        )}
                    </>
                )}
            </ScrollView>

            {/* フィルターモーダル */}
            <Modal visible={showFilterModal} transparent animationType="slide" onRequestClose={() => setShowFilterModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.filterModal}>
                        <View style={styles.filterModalHeader}>
                            <View>
                                <Text style={styles.headerEyebrow}>CONTROL PANEL</Text>
                                <Text style={styles.filterModalTitle}>フィルター設定</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowFilterModal(false)}>
                                <Text style={styles.modalClose}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.filterLabel}>期間</Text>
                        <View style={styles.filterOptions}>
                            {(['all', 'week', 'month', '3months'] as FilterPeriod[]).map(p => (
                                <TouchableOpacity
                                    key={p}
                                    style={[styles.filterOption, period === p && styles.filterOptionActive]}
                                    onPress={() => setPeriod(p)}
                                >
                                    <Text style={[styles.filterOptionText, period === p && styles.filterOptionTextActive]}>
                                        {p === 'all' ? 'すべて' : p === 'week' ? '今週' : p === 'month' ? '1ヶ月' : '3ヶ月'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.filterLabel}>種目</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={styles.filterOptions}>
                                {LIFT_FILTERS.map(lift => (
                                    <TouchableOpacity
                                        key={lift}
                                        style={[styles.filterOption, selectedLift === lift && styles.filterOptionActive]}
                                        onPress={() => setSelectedLift(lift)}
                                    >
                                        <Text style={[styles.filterOptionText, selectedLift === lift && styles.filterOptionTextActive]}>
                                            {getLocalizedExerciseName(lift)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>

                        <Text style={styles.filterLabel}>並び順</Text>
                        <View style={styles.filterOptions}>
                            {(['newest', 'oldest', 'volume'] as SortOrder[]).map(s => (
                                <TouchableOpacity
                                    key={s}
                                    style={[styles.filterOption, sortOrder === s && styles.filterOptionActive]}
                                    onPress={() => setSortOrder(s)}
                                >
                                    <Text style={[styles.filterOptionText, sortOrder === s && styles.filterOptionTextActive]}>
                                        {s === 'newest' ? '新しい順' : s === 'oldest' ? '古い順' : 'ボリューム順'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity
                            style={styles.filterApplyButton}
                            onPress={() => {
                                applyFilters(sessions, searchQuery, selectedLift, period, sortOrder);
                                setShowFilterModal(false);
                            }}
                        >
                            <Text style={styles.filterApplyText}>適用する</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.filterResetButton}
                            onPress={() => {
                                setSearchQuery('');
                                setSelectedLift('すべて');
                                setPeriod('all');
                                setSortOrder('newest');
                                setShowFilterModal(false);
                            }}
                        >
                            <Text style={styles.filterResetText}>リセット</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#080808' },
    loadingContainer: { flex: 1, backgroundColor: '#080808', justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: '#b8a79b', marginTop: 12 },
    header: {
        paddingHorizontal: 16, paddingBottom: 16, flexDirection: 'row',
        alignItems: 'center', justifyContent: 'space-between',
        borderBottomWidth: 1, borderBottomColor: '#351911',
        backgroundColor: '#090909',
    },
    headerCopy: { gap: 4 },
    headerEyebrow: { color: '#ff6a2a', fontSize: 10, fontWeight: '800', letterSpacing: 2 },
    title: { fontSize: 22, fontWeight: '800', color: '#f5f1ec' },
    filterButton: {
        paddingHorizontal: 14, paddingVertical: 8,
        backgroundColor: '#141414', borderRadius: 999,
        borderWidth: 1, borderColor: '#5a2b1c',
    },
    filterButtonText: { color: '#ffb347', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
    heroStrip: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
    heroCard: {
        flex: 1,
        backgroundColor: '#111111',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#4b2116',
        paddingVertical: 14,
        paddingHorizontal: 12,
    },
    heroLabel: { color: '#9e7d68', fontSize: 10, fontWeight: '800', letterSpacing: 1.8, marginBottom: 6 },
    heroValue: { color: '#fff4eb', fontSize: 24, fontWeight: '800' },
    tabBar: {
        flexDirection: 'row', marginHorizontal: 16, marginTop: 6,
        backgroundColor: '#141414', borderRadius: 14, padding: 4, borderWidth: 1, borderColor: '#351911',
    },
    tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 7 },
    tabActive: { backgroundColor: '#ff5a1f' },
    tabText: { color: '#9f8c81', fontSize: 14, fontWeight: '700' },
    tabTextActive: { color: '#fff' },
    searchBar: {
        flexDirection: 'row', alignItems: 'center',
        marginHorizontal: 16, marginTop: 10, marginBottom: 4,
        backgroundColor: '#111111', borderRadius: 14, paddingHorizontal: 14, borderWidth: 1, borderColor: '#3d2016',
    },
    searchInput: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 12 },
    clearSearch: { color: '#b8a79b', fontSize: 16, padding: 4 },
    activeFilters: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8, marginBottom: 4 },
    filterTag: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#4f2014', borderRadius: 999,
        paddingHorizontal: 10, paddingVertical: 4,
    },
    filterTagText: { color: '#ffd3aa', fontSize: 12, fontWeight: '700' },
    filterTagClose: { color: '#ffd3aa', fontSize: 12 },
    panelEyebrow: { color: '#ff6a2a', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 8 },
    listEyebrow: { marginLeft: 16, marginTop: 10 },
    countText: { color: '#c4b3a8', fontSize: 12, marginLeft: 16, marginBottom: 4, marginTop: 4, fontWeight: '700' },
    listHintText: { color: '#8f7d71', fontSize: 12, marginLeft: 16, marginBottom: 8 },
    section: { padding: 16 },
    sectionTitle: { fontSize: 18, fontWeight: '800', color: '#fff', marginBottom: 12 },
    weekRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
    weekLabel: { width: 80, fontSize: 11, color: '#c5b7ad', fontWeight: '700' },
    weekBarTrack: { flex: 1, height: 16, backgroundColor: '#1a1a1a', borderRadius: 999, overflow: 'hidden', borderWidth: 1, borderColor: '#3c2015' },
    weekBarFill: { height: '100%', backgroundColor: '#ff5a1f', borderRadius: 999, minWidth: 4 },
    weekValue: { width: 52, fontSize: 12, color: '#ffb347', textAlign: 'right', fontWeight: '700' },
    unitLabel: { fontSize: 11, color: '#7d6b60', textAlign: 'right', marginTop: 4 },
    summaryGrid: {
        flexDirection: 'row', marginTop: 20, gap: 8,
    },
    summaryCard: {
        flex: 1, backgroundColor: '#111111',
        borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#432117',
    },
    summaryValue: { fontSize: 22, fontWeight: '800', color: '#fff4eb', marginBottom: 4 },
    summaryLabel: { fontSize: 11, color: '#b8a79b', textAlign: 'center' },
    emptyContainer: { padding: 60, alignItems: 'center' },
    emptyEmoji: { fontSize: 40, marginBottom: 12 },
    emptyText: { fontSize: 16, color: '#d7c6b9', marginBottom: 8, fontWeight: '700' },
    emptySubText: { fontSize: 13, color: '#8b786d', textAlign: 'center' },
    monthHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 10,
        backgroundColor: '#090909',
    },
    monthTitle: { fontSize: 15, fontWeight: '800', color: '#ffb347', letterSpacing: 0.5 },
    monthCount: { fontSize: 12, color: '#907e73' },
    sessionCard: {
        flexDirection: 'row', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 14,
        borderWidth: 1, borderColor: '#3b2015',
        backgroundColor: '#111111',
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 18,
    },
    sessionLeft: { flex: 1 },
    cardEyebrow: { color: '#ff6a2a', fontSize: 10, fontWeight: '800', letterSpacing: 1.8, marginBottom: 6 },
    sessionDate: { fontSize: 16, fontWeight: '800', color: '#fff7f0', marginBottom: 4 },
    sessionNotes: { fontSize: 12, color: '#c4b3a8', marginBottom: 4 },
    liftTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
    liftTag: { backgroundColor: '#2c1c16', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: '#5a2b1c' },
    liftTagText: { color: '#ffcf96', fontSize: 11, fontWeight: '700' },
    sessionRight: { alignItems: 'flex-end', justifyContent: 'center' },
    sessionVolume: { fontSize: 22, fontWeight: '800', color: '#fff7f0' },
    sessionVolumeUnit: { fontSize: 11, color: '#ffb347', marginBottom: 4, fontWeight: '700' },
    sessionSets: { fontSize: 12, color: '#baa89c' },
    sessionOpenHint: { fontSize: 12, color: '#ff6a2a', marginTop: 8, fontWeight: '800', letterSpacing: 0.6 },
    cardCopyBtn: {
        backgroundColor: '#2b1c15',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: '#5a2b1c',
        marginBottom: 8,
    },
    cardCopyBtnText: { color: '#ffb347', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
    // フィルターモーダル
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    filterModal: {
        backgroundColor: '#101010',
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: 24, paddingBottom: 40,
        borderTopWidth: 1,
        borderColor: '#4b2116',
    },
    filterModalHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 20,
    },
    filterModalTitle: { fontSize: 20, fontWeight: '800', color: '#fff6ef' },
    modalClose: { color: '#ffb347', fontSize: 20, fontWeight: '700' },
    filterLabel: { fontSize: 13, color: '#c0afa4', marginBottom: 8, marginTop: 16, fontWeight: '700' },
    filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    filterOption: {
        paddingHorizontal: 14, paddingVertical: 7,
        backgroundColor: '#171717', borderRadius: 999,
        borderWidth: 1, borderColor: '#3b2218',
    },
    filterOptionActive: { backgroundColor: '#ff5a1f', borderColor: '#ff5a1f' },
    filterOptionText: { color: '#a9968a', fontSize: 13, fontWeight: '700' },
    filterOptionTextActive: { color: '#fff', fontWeight: '600' },
    filterApplyButton: {
        backgroundColor: '#ff5a1f', padding: 14,
        borderRadius: 12, alignItems: 'center', marginTop: 24,
    },
    filterApplyText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
    filterResetButton: { padding: 14, alignItems: 'center', marginTop: 8 },
    filterResetText: { color: '#ffb347', fontSize: 14, fontWeight: '700' },
});
