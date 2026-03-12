/**
 * Exercise Select Modal
 * 種目選択モーダル
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import ExerciseService from '@/src/services/ExerciseService';
import {
  getExerciseCategoryLabel,
  getLocalizedExerciseName,
  matchesExerciseQuery,
} from '@/src/utils/exerciseLocalization';
import type { Exercise } from '../types/index';

interface ExerciseSelectModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
  currentExerciseId?: string;
}

export function ExerciseSelectModal({
  visible,
  onClose,
  onSelect,
  currentExerciseId,
}: ExerciseSelectModalProps) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<Exercise['category'] | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddMode, setIsAddMode] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');

  // 編集モード
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [editMinRom, setEditMinRom] = useState('');
  const [editMode, setEditMode] = useState<Exercise['rep_detection_mode']>('standard');
  const [editPause, setEditPause] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const categories: Array<{ id: Exercise['category']; name: string }> = [
    { id: 'squat', name: 'スクワット' },
    { id: 'bench', name: 'ベンチ' },
    { id: 'deadlift', name: 'デッドリフト' },
    { id: 'press', name: 'プレス' },
    { id: 'pull', name: 'プル' },
    { id: 'accessory', name: '補助' },
  ];

  useEffect(() => {
    if (visible) {
      loadExercises();
      setSearchQuery('');
      setIsAddMode(false);
      setEditingExercise(null);
      setNewExerciseName('');
    }
  }, [visible]);

  const loadExercises = async () => {
    const all = await ExerciseService.getAllExercises();
    setExercises(all);
  };

  useEffect(() => {
    if (!visible) return;

    if (!currentExerciseId) {
      return;
    }

    const current = exercises.find(exercise => exercise.id === currentExerciseId);
    if (current) {
      setSelectedCategory(current.category);
    }
  }, [currentExerciseId, exercises, visible]);

  const categorySummaries = categories.map(category => ({
    ...category,
    count: exercises.filter(exercise => exercise.category === category.id).length,
  }));

  const filteredExercises = exercises.filter(exercise => {
    const query = searchQuery.trim();
    const matchesSearch = !query || matchesExerciseQuery(exercise.name, query);
    const matchesCategory = selectedCategory ? exercise.category === selectedCategory : true;

    if (!query && !selectedCategory) {
      return false;
    }

    return matchesSearch && matchesCategory;
  });

  const handleSelect = (exercise: Exercise) => {
    onSelect(exercise);
    onClose();
  };

  const handleAddExercise = async () => {
    if (!newExerciseName.trim()) {
      Alert.alert('エラー', '種目名を入力してください');
      return;
    }

    if (!selectedCategory) {
      Alert.alert('カテゴリーを選択', '新しい種目を追加する前にカテゴリーを選択してください');
      return;
    }

    try {
      const newExercise = await ExerciseService.addExercise({
        name: newExerciseName.trim(),
        category: selectedCategory,
        has_lvp: selectedCategory !== 'accessory',
      });

      setNewExerciseName('');
      setIsAddMode(false);
      await loadExercises();
      Alert.alert('追加完了', `${getLocalizedExerciseName(newExercise.name)}を追加しました`);
    } catch (error) {
      console.error('Add exercise error:', error);
      Alert.alert('エラー', '種目の追加に失敗しました。');
    }
  };

  const handleEditExercise = (exercise: Exercise) => {
    setEditingExercise(exercise);
    setEditMinRom(exercise.min_rom_threshold?.toString() || '10.0');
    setEditMode(exercise.rep_detection_mode || 'standard');
    setEditPause(exercise.target_pause_ms?.toString() || '0');
    setEditDescription(exercise.description || '');
  };

  const handleSaveEdit = async () => {
    if (!editingExercise) return;

    try {
      await ExerciseService.updateExercise(editingExercise.id, {
        min_rom_threshold: parseFloat(editMinRom) || 10.0,
        rep_detection_mode: editMode,
        target_pause_ms: parseInt(editPause) || 0,
        description: editDescription.trim(),
      });

      setEditingExercise(null);
      await loadExercises();
      Alert.alert('更新完了', `${getLocalizedExerciseName(editingExercise.name)}の設定を更新しました`);
    } catch (error) {
      console.error('Update exercise error:', error);
      Alert.alert('エラー', '種目の更新に失敗しました。');
    }
  };

  const handleDeleteExercise = async (id: string, name: string) => {
    Alert.alert(
      '種目を削除',
      `${getLocalizedExerciseName(name)} を削除しますか？`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除', style: 'destructive',
          onPress: async () => {
            await ExerciseService.deleteExercise(id);
            await loadExercises();
          }
        },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>種目を選択</Text>
              <Text style={styles.subtitle}>1. カテゴリーを選択してから 2. 種目を選びます</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="種目を検索..."
              placeholderTextColor="#666"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <Text style={styles.searchHint}>
              {selectedCategory
                ? `${categories.find(cat => cat.id === selectedCategory)?.name} から選択中`
                : '先にカテゴリーを選ぶと一覧が絞られます'}
            </Text>
          </View>

          {/* Category Filter */}
          <View style={styles.categorySection}>
            <Text style={styles.categorySectionTitle}>カテゴリー</Text>
            <View style={styles.categoryGrid}>
              {categorySummaries.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  selectedCategory === cat.id && styles.categoryChipActive,
                ]}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <Text style={[
                  styles.categoryChipText,
                  selectedCategory === cat.id && styles.categoryChipTextActive,
                ]}>
                  {cat.name}
                </Text>
                <Text style={[
                  styles.categoryChipCount,
                  selectedCategory === cat.id && styles.categoryChipCountActive,
                ]}>
                  {cat.count}種目
                </Text>
              </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Exercise List */}
          <ScrollView style={styles.exerciseList}>
            {isAddMode ? (
              <View style={styles.addForm}>
                <Text style={styles.addFormTitle}>新しい種目を追加</Text>
                <TextInput
                  style={styles.nameInput}
                  placeholder="種目名（例：インクラインベンチプレス）"
                  placeholderTextColor="#666"
                  value={newExerciseName}
                  onChangeText={setNewExerciseName}
                  autoFocus
                />
                <View style={styles.addFormButtons}>
                  <TouchableOpacity
                    style={[styles.addFormButton, styles.cancelButton]}
                    onPress={() => {
                      setIsAddMode(false);
                      setNewExerciseName('');
                    }}
                  >
                    <Text style={styles.addFormButtonText}>キャンセル</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.addFormButton, styles.confirmButton]}
                    onPress={handleAddExercise}
                  >
                    <Text style={styles.addFormButtonText}>追加</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : editingExercise ? (
              <View style={styles.editForm}>
                <Text style={styles.addFormTitle}>{getLocalizedExerciseName(editingExercise.name)} の設定</Text>

                <Text style={styles.fieldLabel}>最小ROM (cm)</Text>
                <Text style={styles.fieldDesc}>これより短い動きを無視します（ハーフ・ポーズ対策）</Text>
                <TextInput
                  style={styles.nameInput}
                  value={editMinRom}
                  onChangeText={setEditMinRom}
                  keyboardType="numeric"
                  placeholder="10.0"
                />

                <Text style={styles.fieldLabel}>検知モード</Text>
                <View style={styles.modeContainer}>
                  {(['standard', 'tempo', 'pause', 'short_rom'] as const).map(m => (
                    <TouchableOpacity
                      key={m}
                      style={[styles.modeButton, editMode === m && styles.modeButtonActive]}
                      onPress={() => setEditMode(m)}
                    >
                      <Text style={[styles.modeButtonText, editMode === m && styles.modeButtonTextActive]}>
                        {m === 'standard' ? '標準' : m === 'tempo' ? 'テンポ' : m === 'pause' ? 'ポーズ' : '短ROM'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {editMode === 'pause' && (
                  <>
                    <Text style={styles.fieldLabel}>目標静止時間 (ms)</Text>
                    <TextInput
                      style={styles.nameInput}
                      value={editPause}
                      onChangeText={setEditPause}
                      keyboardType="numeric"
                      placeholder="500"
                    />
                  </>
                )}

                <Text style={styles.fieldLabel}>説明文 (AI分析用)</Text>
                <TextInput
                  style={[styles.nameInput, styles.descriptionInput]}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  placeholder="フォームの意識や注意点など（例: 膝を割って深くしゃがむ）"
                  placeholderTextColor="#666"
                  multiline
                />

                <View style={styles.addFormButtons}>
                  <TouchableOpacity
                    style={[styles.addFormButton, styles.cancelButton]}
                    onPress={() => setEditingExercise(null)}
                  >
                    <Text style={styles.addFormButtonText}>キャンセル</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.addFormButton, styles.confirmButton]}
                    onPress={handleSaveEdit}
                  >
                    <Text style={styles.addFormButtonText}>保存</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={styles.deleteLink}
                  onPress={() => handleDeleteExercise(editingExercise.id, editingExercise.name)}
                >
                  <Text style={styles.deleteLinkText}>この種目を削除</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {!selectedCategory && !searchQuery.trim() && filteredExercises.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateTitle}>カテゴリーを先に選択してください</Text>
                    <Text style={styles.emptyStateText}>
                      種目の候補を絞ってから選ぶ構成に変更しました。必要なら上の検索欄から直接検索もできます。
                    </Text>
                  </View>
                ) : null}

                {filteredExercises.map((exercise) => (
                  <View
                    key={exercise.id}
                    style={[
                      styles.exerciseItem,
                      currentExerciseId === exercise.id && styles.exerciseItemSelected,
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.exerciseItemLeft}
                      onPress={() => handleSelect(exercise)}
                    >
                      <Text style={styles.exerciseName}>{getLocalizedExerciseName(exercise.name)}</Text>
                      <View style={styles.exerciseMeta}>
                        <Text style={styles.exerciseCategory}>
                          {getExerciseCategoryLabel(exercise.category)}
                        </Text>
                        <Text style={styles.exerciseConfig}>
                          ROM: {exercise.min_rom_threshold || 10}cm
                        </Text>
                        {exercise.has_lvp && (
                          <View style={styles.lvpBadge}>
                            <Text style={styles.lvpBadgeText}>LVP</Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                    <View style={styles.itemRight}>
                      {currentExerciseId === exercise.id && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                      <TouchableOpacity
                        onPress={() => handleEditExercise(exercise)}
                        style={styles.settingsButton}
                      >
                        <Text style={styles.settingsIcon}>⚙️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}

                {/* Add Exercise Button */}
                <TouchableOpacity
                  style={styles.addExerciseButton}
                  onPress={() => setIsAddMode(true)}
                >
                  <Text style={styles.addExerciseButtonText}>+ {selectedCategory ? 'このカテゴリーに種目を追加' : '種目を追加'}</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    color: '#999',
    fontSize: 12,
    marginTop: 4,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#999',
  },
  searchContainer: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  searchInput: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
  },
  searchHint: {
    color: '#888',
    fontSize: 12,
    marginTop: 8,
  },
  categorySection: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  categorySectionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  categoryChip: {
    width: '31%',
    marginHorizontal: '1.1%',
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#353535',
  },
  categoryChipActive: {
    backgroundColor: '#2196F3',
    borderColor: '#64B5F6',
  },
  categoryChipText: {
    fontSize: 14,
    color: '#ddd',
    fontWeight: '700',
  },
  categoryChipTextActive: {
    color: '#fff',
  },
  categoryChipCount: {
    marginTop: 4,
    fontSize: 11,
    color: '#888',
  },
  categoryChipCountActive: {
    color: '#eaf6ff',
  },
  exerciseList: {
    padding: 16,
  },
  emptyState: {
    backgroundColor: '#222',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  emptyStateTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyStateText: {
    color: '#aaa',
    fontSize: 13,
    lineHeight: 18,
  },
  exerciseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    marginBottom: 8,
  },
  exerciseItemSelected: {
    backgroundColor: '#2a3a2a',
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  exerciseItemLeft: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  exerciseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  exerciseCategory: {
    fontSize: 12,
    color: '#999',
  },
  lvpBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  lvpBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  checkmark: {
    fontSize: 24,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  addExerciseButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2196F3',
    borderStyle: 'dashed',
  },
  addExerciseButtonText: {
    fontSize: 16,
    color: '#2196F3',
    fontWeight: '600',
  },
  addForm: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
  },
  addFormTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  nameInput: {
    backgroundColor: '#3a3a3a',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#fff',
    marginBottom: 16,
  },
  descriptionInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  addFormButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  addFormButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#444',
  },
  confirmButton: {
    backgroundColor: '#2196F3',
  },
  addFormButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  editForm: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
  },
  fieldLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 4,
  },
  fieldDesc: {
    color: '#999',
    fontSize: 11,
    marginBottom: 8,
  },
  modeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  modeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#3a3a3a',
    borderWidth: 1,
    borderColor: '#444',
  },
  modeButtonActive: {
    backgroundColor: '#1565C0',
    borderColor: '#2196F3',
  },
  modeButtonText: {
    color: '#ccc',
    fontSize: 12,
  },
  modeButtonTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  exerciseConfig: {
    fontSize: 11,
    color: '#666',
    marginLeft: 4,
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingsButton: {
    padding: 8,
  },
  settingsIcon: {
    fontSize: 20,
  },
  deleteLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  deleteLinkText: {
    color: '#F44336',
    fontSize: 13,
  },
});
