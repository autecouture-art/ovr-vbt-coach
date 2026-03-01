/**
 * Session Detail Screen
 * セッション詳細・編集画面 (Expo Router)
 * - セット削除・メモ追加・セッション削除
 * - 速度ゾーン・e1RM・VL表示
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    TextInput,
    Modal,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import DatabaseService from '@/src/services/DatabaseService';
import AICoachService from '@/src/services/AICoachService';
import { formatSessionForAI } from '@/src/utils/formatDataForAI';
import type { SessionData, SetData, RepData } from '@/src/types/index';

export default function SessionDetailScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { session_id } = useLocalSearchParams<{ session_id: string }>();

    const [session, setSession] = useState<SessionData | null>(null);
    const [sets, setSets] = useState<SetData[]>([]);
    const [loading, setLoading] = useState(true);

    // 編集状態
    const [editingNotes, setEditingNotes] = useState(false);
    const [sessionNotes, setSessionNotes] = useState('');
    const [editingSet, setEditingSet] = useState<SetData | null>(null);
    const [editLoad, setEditLoad] = useState('');
    const [editRpe, setEditRpe] = useState('');
    const [editSetNotes, setEditSetNotes] = useState('');

    useEffect(() => {
        if (session_id) loadSessionDetail(session_id as string);
    }, [session_id]);

    const loadSessionDetail = async (id: string) => {
        try {
            const [sessionData, setsData] = await Promise.all([
                DatabaseService.getSession(id),
                DatabaseService.getSetsForSession(id),
            ]);
            setSession(sessionData);
            setSets(setsData);
            setSessionNotes(sessionData?.notes || '');
        } catch (error) {
            console.error('セッション詳細読み込み失敗:', error);
        } finally {
            setLoading(false);
        }
    };

    const reload = () => loadSessionDetail(session_id as string);

    // --- セッションのメモ保存 ---
    const saveSessionNotes = async () => {
        if (!session) return;
        try {
            await DatabaseService.updateSessionNotes(session.session_id, sessionNotes);
            setEditingNotes(false);
            await reload();
        } catch {
            Alert.alert('エラー', 'メモの保存に失敗しました');
        }
    };

    // --- セッション削除 ---
    const confirmDeleteSession = () => {
        Alert.alert(
            '🗑️ セッションを削除',
            'このセッションと全セットデータを削除しますか？\nこの操作は元に戻せません。',
            [
                { text: 'キャンセル', style: 'cancel' },
                {
                    text: '削除', style: 'destructive',
                    onPress: async () => {
                        try {
                            await DatabaseService.deleteSession(session!.session_id);
                            router.back();
                        } catch {
                            Alert.alert('エラー', '削除に失敗しました');
                        }
                    },
                },
            ]
        );
    };

    // --- セット削除 ---
    const confirmDeleteSet = (setData: SetData) => {
        Alert.alert(
            `Set ${setData.set_index} を削除`,
            `${setData.lift} ${setData.load_kg}kg × ${setData.reps}rep を削除しますか？`,
            [
                { text: 'キャンセル', style: 'cancel' },
                {
                    text: '削除', style: 'destructive',
                    onPress: async () => {
                        try {
                            await DatabaseService.deleteSet(session!.session_id, setData.set_index, setData.lift);
                            await DatabaseService.recalcSessionVolume(session!.session_id);
                            await reload();
                        } catch {
                            Alert.alert('エラー', 'セットの削除に失敗しました');
                        }
                    },
                },
            ]
        );
    };

    // --- セット編集を開く ---
    const openEditSet = (setData: SetData) => {
        setEditingSet(setData);
        setEditLoad(setData.load_kg.toString());
        setEditRpe(setData.rpe?.toString() || '');
        setEditSetNotes(setData.notes || '');
    };

    // --- セッションデータをAI用にコピー ---
    const handleCopyToClipboard = async () => {
        if (!session) return;
        try {
            const allReps = await DatabaseService.getRepsForSession(session.session_id);
            const formattedText = formatSessionForAI(session, sets, allReps);
            await Clipboard.setStringAsync(formattedText);
            Alert.alert('コピー完了', 'AI相談用のデータをクリップボードにコピーしました。ChatGPT等に貼り付けて相談してください。');
        } catch (error) {
            console.error('コピー失敗:', error);
            Alert.alert('エラー', 'データのコピーに失敗しました');
        }
    };

    const saveEditSet = async () => {
        if (!editingSet || !session) return;
        try {
            await DatabaseService.updateSet(session.session_id, editingSet.set_index, {
                load_kg: parseFloat(editLoad) || editingSet.load_kg,
                rpe: editRpe ? parseFloat(editRpe) : undefined,
                notes: editSetNotes,
            });
            await DatabaseService.recalcSessionVolume(session.session_id);
            setEditingSet(null);
            await reload();
        } catch {
            Alert.alert('エラー', '保存に失敗しました');
        }
    };

    // 速度ゾーン
    const getZone = (avgVel: number | null) => {
        if (!avgVel) return null;
        return AICoachService.getZone(avgVel);
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2196F3" />
                <Text style={styles.loadingText}>読み込み中...</Text>
            </View>
        );
    }

    if (!session) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorText}>セッションが見つかりません</Text>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Text style={styles.backButtonText}>← 戻る</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const totalVolume = Math.round(session.total_volume || 0);
    const avgVelAll = sets.length > 0
        ? sets.reduce((s, x) => s + (x.avg_velocity || 0), 0) / sets.length
        : null;
    const overallZone = getZone(avgVelAll);

    return (
        <View style={styles.container}>
            {/* ヘッダー */}
            <View style={[styles.header, { paddingTop: (insets.top || 0) + 12 }]}>
                <TouchableOpacity onPress={() => router.back()}>
                    <Text style={styles.backText}>← 履歴</Text>
                </TouchableOpacity>
                <Text style={styles.title}>セッション詳細</Text>
                <View style={styles.headerRight}>
                    <TouchableOpacity onPress={handleCopyToClipboard} style={styles.copyBtn}>
                        <Text style={styles.copyBtnText}>AI相談</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={confirmDeleteSession} style={styles.deleteBtn}>
                        <Text style={styles.deleteBtnText}>🗑️</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView>
                {/* セッション概要カード */}
                <View style={styles.summaryCard}>
                    <Text style={styles.sessionDate}>{session.date}</Text>
                    <View style={styles.summaryStats}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{session.total_sets}</Text>
                            <Text style={styles.statLabel}>セット</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{totalVolume.toLocaleString()}</Text>
                            <Text style={styles.statLabel}>kg ボリューム</Text>
                        </View>
                        {session.duration_minutes && (
                            <View style={styles.statItem}>
                                <Text style={styles.statValue}>{session.duration_minutes}</Text>
                                <Text style={styles.statLabel}>分</Text>
                            </View>
                        )}
                    </View>

                    {/* 平均速度ゾーン */}
                    {overallZone && avgVelAll && (
                        <View style={[styles.zoneCard, { borderColor: overallZone.color }]}>
                            <Text style={styles.zoneEmoji}>{overallZone.emoji}</Text>
                            <View>
                                <Text style={[styles.zoneName, { color: overallZone.color }]}>{overallZone.name}ゾーン</Text>
                                <Text style={styles.zoneVel}>平均速度: {avgVelAll.toFixed(2)} m/s</Text>
                            </View>
                        </View>
                    )}

                    {/* メモ表示・編集 */}
                    <View style={styles.notesSection}>
                        <View style={styles.notesSectionHeader}>
                            <Text style={styles.notesSectionTitle}>📝 メモ</Text>
                            <TouchableOpacity onPress={() => setEditingNotes(!editingNotes)}>
                                <Text style={styles.editLink}>{editingNotes ? 'キャンセル' : '編集'}</Text>
                            </TouchableOpacity>
                        </View>
                        {editingNotes ? (
                            <View>
                                <TextInput
                                    style={styles.notesInput}
                                    value={sessionNotes}
                                    onChangeText={setSessionNotes}
                                    placeholder="セッションのメモを入力..."
                                    placeholderTextColor="#666"
                                    multiline
                                    numberOfLines={3}
                                />
                                <TouchableOpacity style={styles.saveNotesBtn} onPress={saveSessionNotes}>
                                    <Text style={styles.saveNotesBtnText}>保存</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <Text style={styles.notesText}>
                                {session.notes || '（メモなし — タップして追加）'}
                            </Text>
                        )}
                    </View>
                </View>

                {/* セット一覧 */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>セット詳細</Text>
                    <Text style={styles.sectionHint}>長押しで削除 / タップで編集</Text>

                    {sets.length === 0 ? (
                        <Text style={styles.emptyText}>セットデータがありません</Text>
                    ) : (
                        sets.map((setData, idx) => {
                            const zone = getZone(setData.avg_velocity);
                            return (
                                <TouchableOpacity
                                    key={idx}
                                    style={[styles.setCard, zone && { borderLeftColor: zone.color }]}
                                    onPress={() => openEditSet(setData)}
                                    onLongPress={() => confirmDeleteSet(setData)}
                                    activeOpacity={0.7}
                                >
                                    <View style={styles.setHeader}>
                                        <Text style={styles.setNumber}>Set {setData.set_index}</Text>
                                        <Text style={styles.setLift}>{setData.lift}</Text>
                                        {zone && (
                                            <Text style={[styles.setZone, { color: zone.color }]}>
                                                {zone.emoji} {zone.name}
                                            </Text>
                                        )}
                                        <Text style={styles.editIcon}>✏️</Text>
                                    </View>

                                    <View style={styles.setStats}>
                                        <View style={styles.setStatItem}>
                                            <Text style={styles.setStatValue}>{setData.load_kg}</Text>
                                            <Text style={styles.setStatLabel}>kg</Text>
                                        </View>
                                        <View style={styles.setStatItem}>
                                            <Text style={styles.setStatValue}>{setData.reps}</Text>
                                            <Text style={styles.setStatLabel}>reps</Text>
                                        </View>
                                        <View style={styles.setStatItem}>
                                            <Text style={[styles.setStatValue, { color: zone?.color || '#fff' }]}>
                                                {setData.avg_velocity?.toFixed(2) || '-'}
                                            </Text>
                                            <Text style={styles.setStatLabel}>m/s 平均</Text>
                                        </View>
                                        {setData.velocity_loss !== null && setData.velocity_loss !== undefined && (
                                            <View style={styles.setStatItem}>
                                                <Text style={[styles.setStatValue, { color: setData.velocity_loss > 20 ? '#F44336' : '#4CAF50' }]}>
                                                    {setData.velocity_loss?.toFixed(1)}%
                                                </Text>
                                                <Text style={styles.setStatLabel}>VL</Text>
                                            </View>
                                        )}
                                        {setData.rpe && (
                                            <View style={styles.setStatItem}>
                                                <Text style={styles.setStatValue}>{setData.rpe}</Text>
                                                <Text style={styles.setStatLabel}>RPE</Text>
                                            </View>
                                        )}
                                    </View>

                                    {setData.e1rm && (
                                        <Text style={styles.e1rmText}>推定1RM: {setData.e1rm.toFixed(1)} kg</Text>
                                    )}
                                    {setData.notes ? (
                                        <Text style={styles.setNotesText}>📝 {setData.notes}</Text>
                                    ) : null}
                                </TouchableOpacity>
                            );
                        })
                    )}
                </View>
            </ScrollView>

            {/* セット編集モーダル */}
            <Modal
                visible={!!editingSet}
                transparent
                animationType="slide"
                onRequestClose={() => setEditingSet(null)}
            >
                <KeyboardAvoidingView
                    style={styles.modalOverlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <View style={styles.editModal}>
                        <View style={styles.editModalHeader}>
                            <Text style={styles.editModalTitle}>
                                ✏️ Set {editingSet?.set_index} 編集
                            </Text>
                            <TouchableOpacity onPress={() => setEditingSet(null)}>
                                <Text style={styles.modalClose}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.editLabel}>負荷 (kg)</Text>
                        <TextInput
                            style={styles.editInput}
                            value={editLoad}
                            onChangeText={setEditLoad}
                            keyboardType="numeric"
                            placeholder={editingSet?.load_kg.toString()}
                            placeholderTextColor="#666"
                        />

                        <Text style={styles.editLabel}>RPE</Text>
                        <TextInput
                            style={styles.editInput}
                            value={editRpe}
                            onChangeText={setEditRpe}
                            keyboardType="numeric"
                            placeholder="6-10"
                            placeholderTextColor="#666"
                        />

                        <Text style={styles.editLabel}>メモ</Text>
                        <TextInput
                            style={[styles.editInput, { height: 80 }]}
                            value={editSetNotes}
                            onChangeText={setEditSetNotes}
                            multiline
                            placeholder="このセットのメモ..."
                            placeholderTextColor="#666"
                        />

                        <TouchableOpacity style={styles.saveEditBtn} onPress={saveEditSet}>
                            <Text style={styles.saveEditBtnText}>💾 保存</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.deleteSetBtn}
                            onPress={() => { setEditingSet(null); if (editingSet) confirmDeleteSet(editingSet); }}
                        >
                            <Text style={styles.deleteSetBtnText}>🗑️ このセットを削除</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#1a1a1a' },
    loadingContainer: { flex: 1, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: '#999', marginTop: 12 },
    errorContainer: { flex: 1, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center', padding: 24 },
    errorText: { color: '#F44336', fontSize: 18, marginBottom: 24 },
    backButton: { padding: 12, backgroundColor: '#2196F3', borderRadius: 8 },
    backButtonText: { color: '#fff', fontSize: 16 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        padding: 16, borderBottomWidth: 1, borderBottomColor: '#333',
    },
    backText: { color: '#2196F3', fontSize: 16 },
    title: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    copyBtn: {
        backgroundColor: '#2196F3',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    copyBtnText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    deleteBtn: { padding: 6 },
    deleteBtnText: { fontSize: 22 },
    summaryCard: { margin: 16, padding: 20, backgroundColor: '#2a2a2a', borderRadius: 16 },
    sessionDate: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 16 },
    summaryStats: {
        flexDirection: 'row', justifyContent: 'space-around',
        marginBottom: 16, paddingBottom: 16,
        borderBottomWidth: 1, borderBottomColor: '#333',
    },
    statItem: { alignItems: 'center' },
    statValue: { fontSize: 24, fontWeight: 'bold', color: '#2196F3', marginBottom: 4 },
    statLabel: { fontSize: 11, color: '#999' },
    zoneCard: {
        flexDirection: 'row', alignItems: 'center',
        padding: 12, borderRadius: 10, borderWidth: 2,
        gap: 12, backgroundColor: '#1a1a1a', marginBottom: 16,
    },
    zoneEmoji: { fontSize: 26 },
    zoneName: { fontSize: 16, fontWeight: 'bold' },
    zoneVel: { fontSize: 13, color: '#999', marginTop: 2 },
    notesSection: { marginTop: 4 },
    notesSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    notesSectionTitle: { fontSize: 14, color: '#999', fontWeight: '600' },
    editLink: { color: '#2196F3', fontSize: 14 },
    notesText: { color: '#aaa', fontSize: 14, lineHeight: 20 },
    notesInput: {
        backgroundColor: '#1a1a1a', borderRadius: 8, padding: 12,
        color: '#fff', fontSize: 14, minHeight: 70,
        borderWidth: 1, borderColor: '#444',
    },
    saveNotesBtn: {
        backgroundColor: '#2196F3', padding: 10, borderRadius: 8,
        alignItems: 'center', marginTop: 8,
    },
    saveNotesBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    section: { paddingHorizontal: 16, paddingBottom: 40 },
    sectionTitle: { fontSize: 17, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
    sectionHint: { fontSize: 12, color: '#666', marginBottom: 12 },
    emptyText: { color: '#999', textAlign: 'center', paddingVertical: 24 },
    setCard: {
        backgroundColor: '#2a2a2a', padding: 14,
        borderRadius: 12, marginBottom: 10,
        borderLeftWidth: 4, borderLeftColor: '#2196F3',
    },
    setHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 6 },
    setNumber: { fontSize: 14, fontWeight: 'bold', color: '#fff' },
    setLift: { fontSize: 13, color: '#999', flex: 1 },
    setZone: { fontSize: 13, fontWeight: '600' },
    editIcon: { fontSize: 14 },
    setStats: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 6 },
    setStatItem: { alignItems: 'center' },
    setStatValue: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 2 },
    setStatLabel: { fontSize: 10, color: '#666' },
    e1rmText: { fontSize: 12, color: '#9C27B0', textAlign: 'right' },
    setNotesText: { fontSize: 12, color: '#999', marginTop: 6, fontStyle: 'italic' },
    // 編集モーダル
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    editModal: {
        backgroundColor: '#1e1e2e', borderTopLeftRadius: 20, borderTopRightRadius: 20,
        padding: 24, paddingBottom: 40,
    },
    editModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    editModalTitle: { fontSize: 17, fontWeight: 'bold', color: '#fff' },
    modalClose: { color: '#999', fontSize: 22 },
    editLabel: { fontSize: 13, color: '#999', marginBottom: 6, marginTop: 12 },
    editInput: {
        backgroundColor: '#2a2a3a', borderRadius: 8, padding: 12,
        color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#3a3a4a',
    },
    saveEditBtn: {
        backgroundColor: '#2196F3', padding: 14,
        borderRadius: 12, alignItems: 'center', marginTop: 20,
    },
    saveEditBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    deleteSetBtn: { padding: 14, alignItems: 'center', marginTop: 8 },
    deleteSetBtnText: { color: '#F44336', fontSize: 14 },
});
