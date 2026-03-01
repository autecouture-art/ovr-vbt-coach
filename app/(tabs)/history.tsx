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
                s.lifts?.includes(lift) || false
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
                <Text style={styles.title}>📖 トレーニング履歴</Text>
                <TouchableOpacity style={styles.filterButton} onPress={() => setShowFilterModal(true)}>
                    <Text style={styles.filterButtonText}>⚙️ フィルター</Text>
                </TouchableOpacity>
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
                        <Text style={styles.countText}>{filteredSessions.length}件のセッション</Text>
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
                                                                    <Text style={styles.liftTagText}>{lift}</Text>
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
                            <Text style={styles.filterModalTitle}>⚙️ フィルター設定</Text>
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
                                            {lift}
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
    container: { flex: 1, backgroundColor: '#1a1a1a' },
    loadingContainer: { flex: 1, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: '#999', marginTop: 12 },
    header: {
        padding: 16, flexDirection: 'row',
        alignItems: 'center', justifyContent: 'space-between',
        borderBottomWidth: 1, borderBottomColor: '#333',
    },
    title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
    filterButton: {
        paddingHorizontal: 12, paddingVertical: 6,
        backgroundColor: '#2a2a2a', borderRadius: 8,
        borderWidth: 1, borderColor: '#444',
    },
    filterButtonText: { color: '#ccc', fontSize: 13 },
    tabBar: {
        flexDirection: 'row', marginHorizontal: 16, marginTop: 12,
        backgroundColor: '#2a2a2a', borderRadius: 10, padding: 4,
    },
    tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 7 },
    tabActive: { backgroundColor: '#2196F3' },
    tabText: { color: '#999', fontSize: 14, fontWeight: '600' },
    tabTextActive: { color: '#fff' },
    searchBar: {
        flexDirection: 'row', alignItems: 'center',
        marginHorizontal: 16, marginTop: 10, marginBottom: 4,
        backgroundColor: '#2a2a2a', borderRadius: 10, paddingHorizontal: 14,
    },
    searchInput: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 10 },
    clearSearch: { color: '#999', fontSize: 16, padding: 4 },
    activeFilters: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, gap: 8, marginBottom: 4 },
    filterTag: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#1565C0', borderRadius: 12,
        paddingHorizontal: 10, paddingVertical: 4,
    },
    filterTagText: { color: '#90CAF9', fontSize: 12 },
    filterTagClose: { color: '#90CAF9', fontSize: 12 },
    countText: { color: '#666', fontSize: 12, marginLeft: 16, marginBottom: 4, marginTop: 4 },
    section: { padding: 16 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff', marginBottom: 12 },
    weekRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
    weekLabel: { width: 80, fontSize: 11, color: '#999' },
    weekBarTrack: { flex: 1, height: 16, backgroundColor: '#2a2a2a', borderRadius: 4, overflow: 'hidden' },
    weekBarFill: { height: '100%', backgroundColor: '#2196F3', borderRadius: 4, minWidth: 4 },
    weekValue: { width: 52, fontSize: 12, color: '#2196F3', textAlign: 'right' },
    unitLabel: { fontSize: 11, color: '#555', textAlign: 'right', marginTop: 4 },
    summaryGrid: {
        flexDirection: 'row', marginTop: 20, gap: 8,
    },
    summaryCard: {
        flex: 1, backgroundColor: '#2a2a2a',
        borderRadius: 10, padding: 14, alignItems: 'center',
    },
    summaryValue: { fontSize: 22, fontWeight: 'bold', color: '#2196F3', marginBottom: 4 },
    summaryLabel: { fontSize: 11, color: '#999', textAlign: 'center' },
    emptyContainer: { padding: 60, alignItems: 'center' },
    emptyEmoji: { fontSize: 40, marginBottom: 12 },
    emptyText: { fontSize: 16, color: '#999', marginBottom: 8 },
    emptySubText: { fontSize: 13, color: '#666', textAlign: 'center' },
    monthHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 10,
        backgroundColor: '#121212',
    },
    monthTitle: { fontSize: 15, fontWeight: 'bold', color: '#aaa' },
    monthCount: { fontSize: 12, color: '#666' },
    sessionCard: {
        flexDirection: 'row', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: '#1e1e1e',
        backgroundColor: '#1a1a1a',
    },
    sessionLeft: { flex: 1 },
    sessionDate: { fontSize: 15, fontWeight: '600', color: '#fff', marginBottom: 4 },
    sessionNotes: { fontSize: 12, color: '#999', marginBottom: 4 },
    liftTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
    liftTag: { backgroundColor: '#1e2a3a', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    liftTagText: { color: '#64B5F6', fontSize: 11 },
    sessionRight: { alignItems: 'flex-end', justifyContent: 'center' },
    sessionVolume: { fontSize: 20, fontWeight: 'bold', color: '#4CAF50' },
    sessionVolumeUnit: { fontSize: 11, color: '#4CAF50', marginBottom: 4 },
    sessionSets: { fontSize: 12, color: '#999' },
    cardCopyBtn: {
        backgroundColor: '#333',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#444',
        marginBottom: 8,
    },
    cardCopyBtnText: { color: '#2196F3', fontSize: 10, fontWeight: 'bold' },
    // フィルターモーダル
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
    filterModal: {
        backgroundColor: '#1e1e2e',
        borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: 24, paddingBottom: 40,
    },
    filterModalHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 20,
    },
    filterModalTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
    modalClose: { color: '#999', fontSize: 20 },
    filterLabel: { fontSize: 13, color: '#999', marginBottom: 8, marginTop: 16 },
    filterOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    filterOption: {
        paddingHorizontal: 14, paddingVertical: 7,
        backgroundColor: '#2a2a3a', borderRadius: 20,
        borderWidth: 1, borderColor: '#3a3a4a',
    },
    filterOptionActive: { backgroundColor: '#1565C0', borderColor: '#2196F3' },
    filterOptionText: { color: '#999', fontSize: 13 },
    filterOptionTextActive: { color: '#fff', fontWeight: '600' },
    filterApplyButton: {
        backgroundColor: '#2196F3', padding: 14,
        borderRadius: 12, alignItems: 'center', marginTop: 24,
    },
    filterApplyText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    filterResetButton: { padding: 14, alignItems: 'center', marginTop: 8 },
    filterResetText: { color: '#F44336', fontSize: 14 },
});
