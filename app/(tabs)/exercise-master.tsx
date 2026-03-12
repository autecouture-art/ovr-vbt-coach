import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Alert,
    SafeAreaView,
    Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import ExerciseService from '@/src/services/ExerciseService';
import {
    getExerciseCategoryLabel,
    getLocalizedExerciseName,
    matchesExerciseQuery,
} from '@/src/utils/exerciseLocalization';
import type { Exercise } from '@/src/types/index';
import { IconSymbol } from '@/components/ui/icon-symbol';

export default function ExerciseMasterScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [exercises, setExercises] = useState<Exercise[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // 編集/追加モーダル用
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
    const [editName, setEditName] = useState('');
    const [editCategory, setEditCategory] = useState<Exercise['category']>('accessory');
    const [editMinRom, setEditMinRom] = useState('10.0');
    const [editMode, setEditMode] = useState<Exercise['rep_detection_mode']>('standard');

    const categories = [
        { id: 'all', name: 'すべて' },
        { id: 'squat', name: 'スクワット' },
        { id: 'bench', name: 'ベンチ' },
        { id: 'deadlift', name: 'デッドリフト' },
        { id: 'press', name: 'プレス' },
        { id: 'pull', name: 'プル' },
        { id: 'accessory', name: '補助' },
    ];

    useEffect(() => {
        loadExercises();
    }, []);

    const loadExercises = async () => {
        const all = await ExerciseService.getAllExercises();
        setExercises(all);
    };

    const filteredExercises = exercises.filter(exercise => {
        const matchesCategory = selectedCategory === 'all' || exercise.category === selectedCategory;
        const matchesSearch = matchesExerciseQuery(exercise.name, searchQuery);
        return matchesCategory && matchesSearch;
    });

    const handleOpenAdd = () => {
        setEditingExercise(null);
        setEditName('');
        setEditCategory('accessory');
        setEditMinRom('10.0');
        setEditMode('standard');
        setIsModalVisible(true);
    };

    const handleOpenEdit = (exercise: Exercise) => {
        setEditingExercise(exercise);
        setEditName(exercise.name);
        setEditCategory(exercise.category);
        setEditMinRom(exercise.min_rom_threshold?.toString() || '10.0');
        setEditMode(exercise.rep_detection_mode || 'standard');
        setIsModalVisible(true);
    };

    const handleSave = async () => {
        if (!editName.trim()) {
            Alert.alert('エラー', '種目名を入力してください');
            return;
        }

        const payload = {
            name: editName.trim(),
            category: editCategory,
            min_rom_threshold: parseFloat(editMinRom) || 10.0,
            rep_detection_mode: editMode,
            has_lvp: true, // デフォルトでLVP有効
        };

        try {
            if (editingExercise) {
                await ExerciseService.updateExercise(editingExercise.id, payload);
                Alert.alert('更新完了', `${getLocalizedExerciseName(editName)}を更新しました`);
            } else {
                await ExerciseService.addExercise(payload);
                Alert.alert('追加完了', `${getLocalizedExerciseName(editName)}を追加しました`);
            }
            setIsModalVisible(false);
            loadExercises();
        } catch (error) {
            console.error('Save error:', error);
            Alert.alert('エラー', '保存中にエラーが発生しました');
        }
    };

    const handleDelete = async (id: string, name: string) => {
        Alert.alert(
            '種目を削除',
            `${getLocalizedExerciseName(name)} を削除しますか？\n(過去のデータには影響しません)`,
            [
                { text: 'キャンセル', style: 'cancel' },
                {
                    text: '削除', style: 'destructive',
                    onPress: async () => {
                        await ExerciseService.deleteExercise(id);
                        loadExercises();
                    }
                },
            ]
        );
    };

    return (
        <View style={styles.safeArea}>
            <View style={[styles.header, { paddingTop: (insets.top || 0) + 8 }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <IconSymbol name="chevron.left" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.title}>種目マスター管理</Text>
                <TouchableOpacity onPress={handleOpenAdd} style={styles.addButtonIcon}>
                    <IconSymbol name="plus" size={24} color="#2196F3" />
                </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="種目を検索..."
                    placeholderTextColor="#666"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
                {categories.map((cat) => (
                    <TouchableOpacity
                        key={cat.id}
                        style={[styles.categoryChip, selectedCategory === cat.id && styles.categoryChipActive]}
                        onPress={() => setSelectedCategory(cat.id)}
                    >
                        <Text style={[styles.categoryChipText, selectedCategory === cat.id && styles.categoryChipTextActive]}>
                            {cat.name}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <ScrollView style={styles.exerciseList}>
                {filteredExercises.map((exercise) => (
                    <View key={exercise.id} style={styles.exerciseItem}>
                        <View style={styles.exerciseInfo}>
                            <Text style={styles.exerciseName}>{getLocalizedExerciseName(exercise.name)}</Text>
                            <View style={styles.exerciseMeta}>
                                <Text style={styles.exerciseCategory}>
                                    {getExerciseCategoryLabel(exercise.category)}
                                </Text>
                                <Text style={styles.exerciseRom}>ROM: {exercise.min_rom_threshold || 10}cm</Text>
                                <Text style={styles.exerciseMode}>
                                    {exercise.rep_detection_mode === 'standard' ? '標準' :
                                        exercise.rep_detection_mode === 'tempo' ? 'テンポ' :
                                            exercise.rep_detection_mode === 'pause' ? 'ポーズ' : '短ROM'}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.exerciseActions}>
                            <TouchableOpacity onPress={() => handleOpenEdit(exercise)} style={styles.actionButton}>
                                <IconSymbol name="pencil" size={20} color="#2196F3" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDelete(exercise.id, exercise.name)} style={styles.actionButton}>
                                <IconSymbol name="trash.fill" size={20} color="#F44336" />
                            </TouchableOpacity>
                        </View>
                    </View>
                ))}
                <View style={{ height: 100 }} />
            </ScrollView>

            {/* 編集/追加モーダル */}
            <Modal visible={isModalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{editingExercise ? '種目を編集' : '種目登録'}</Text>
                            <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                                <IconSymbol name="xmark" size={24} color="#999" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalForm}>
                            <Text style={styles.fieldLabel}>種目名</Text>
                            <TextInput
                                style={styles.modalInput}
                                value={editName}
                                onChangeText={setEditName}
                                placeholder="例: ベンチプレス"
                                placeholderTextColor="#666"
                            />

                            <Text style={styles.fieldLabel}>カテゴリ</Text>
                            <View style={styles.categoryGrid}>
                                {categories.filter(c => c.id !== 'all').map(cat => (
                                    <TouchableOpacity
                                        key={cat.id}
                                        style={[styles.catGridItem, editCategory === cat.id && styles.catGridItemActive]}
                                        onPress={() => setEditCategory(cat.id as any)}
                                    >
                                        <Text style={[styles.catGridText, editCategory === cat.id && styles.catGridTextActive]}>
                                            {cat.name}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.fieldLabel}>最小ROM (cm)</Text>
                            <TextInput
                                style={styles.modalInput}
                                value={editMinRom}
                                onChangeText={setEditMinRom}
                                keyboardType="numeric"
                                placeholder="10.0"
                                placeholderTextColor="#666"
                            />

                            <Text style={styles.fieldLabel}>検知モード</Text>
                            <View style={styles.modeContainer}>
                                {(['standard', 'tempo', 'pause', 'short_rom'] as const).map(m => (
                                    <TouchableOpacity
                                        key={m}
                                        style={[styles.modeBtn, editMode === m && styles.modeBtnActive]}
                                        onPress={() => setEditMode(m)}
                                    >
                                        <Text style={[styles.modeBtnText, editMode === m && styles.modeBtnTextActive]}>
                                            {m === 'standard' ? '標準' : m === 'tempo' ? 'テンポ' : m === 'pause' ? 'ポーズ' : '短ROM'}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                                <Text style={styles.saveButtonText}>保存する</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#1a1a1a' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#333'
    },
    backButton: { padding: 8 },
    title: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
    addButtonIcon: { padding: 8 },
    searchContainer: { padding: 16 },
    searchInput: {
        backgroundColor: '#2a2a2a',
        borderRadius: 12,
        padding: 12,
        fontSize: 16,
        color: '#fff'
    },
    categoryScroll: { paddingHorizontal: 16, marginBottom: 12, height: 44 },
    categoryChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#2a2a2a',
        marginRight: 8
    },
    categoryChipActive: { backgroundColor: '#2196F3' },
    categoryChipText: { fontSize: 13, color: '#999' },
    categoryChipTextActive: { color: '#fff', fontWeight: 'bold' },
    exerciseList: { flex: 1, padding: 16 },
    exerciseItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2a2a2a',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12
    },
    exerciseInfo: { flex: 1 },
    exerciseName: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 4 },
    exerciseMeta: { flexDirection: 'row', gap: 12 },
    exerciseCategory: { fontSize: 12, color: '#999' },
    exerciseRom: { fontSize: 12, color: '#666' },
    exerciseMode: { fontSize: 12, color: '#2196F3' },
    exerciseActions: { flexDirection: 'row', gap: 16 },
    actionButton: { padding: 8 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    modalContent: {
        backgroundColor: '#1a1a1a',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '85%',
        padding: 24
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24
    },
    modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#fff' },
    modalForm: { flex: 1 },
    fieldLabel: { color: '#fff', fontSize: 14, fontWeight: '600', marginTop: 16, marginBottom: 8 },
    modalInput: {
        backgroundColor: '#2a2a2a',
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
        color: '#fff'
    },
    categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    catGridItem: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#2a2a2a'
    },
    catGridItemActive: { backgroundColor: '#2196F3' },
    catGridText: { color: '#999', fontSize: 13 },
    catGridTextActive: { color: '#fff', fontWeight: 'bold' },
    modeContainer: { flexDirection: 'row', gap: 8 },
    modeBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#2a2a2a' },
    modeBtnActive: { backgroundColor: '#1565C0' },
    modeBtnText: { color: '#999', fontSize: 13 },
    modeBtnTextActive: { color: '#fff', fontWeight: 'bold' },
    saveButton: {
        backgroundColor: '#2196F3',
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 32,
        marginBottom: 40
    },
    saveButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});
