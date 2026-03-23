/**
 * Exercise Select Modal
 * 種目選択モーダル
 */

import React, { useEffect, useMemo, useState } from 'react';
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
import { GarageTheme } from '@/src/constants/garageTheme';
import {
  EXERCISE_SELECTION_GROUPS,
  formatLoadKg,
  getExerciseCategoryLabel,
  getExerciseSelectionGroup,
  inferExercisePreset,
  matchesExerciseSelectionGroup,
  type ExerciseSelectionGroupId,
} from '@/src/constants/exerciseCatalog';
import type { Exercise } from '../types/index';

interface ExerciseSelectModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
  currentExerciseId?: string;
}

const MODE_LABELS: Record<NonNullable<Exercise['rep_detection_mode']>, string> = {
  standard: '標準',
  tempo: 'テンポ',
  pause: 'ポーズ',
  short_rom: '短ROM',
};

export function ExerciseSelectModal({
  visible,
  onClose,
  onSelect,
  currentExerciseId,
}: ExerciseSelectModalProps) {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<ExerciseSelectionGroupId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddMode, setIsAddMode] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');

  useEffect(() => {
    if (visible) {
      void loadExercises();
    }
  }, [visible]);

  const loadExercises = async () => {
    const all = await ExerciseService.getAllExercises();
    setExercises(all);
  };

  const filteredExercises = useMemo(
    () =>
      exercises.filter((exercise) => {
        const matchesGroup = matchesExerciseSelectionGroup(exercise, selectedGroup);
        const searchLower = searchQuery.toLowerCase().trim();
        const matchesSearch = !searchLower ||
          exercise.name.toLowerCase().includes(searchLower) ||
          (exercise.description && exercise.description.toLowerCase().includes(searchLower));
        return matchesGroup && matchesSearch;
      }),
    [exercises, searchQuery, selectedGroup],
  );

  const groupedExercises = useMemo(() => {
    const grouped = new Map<string, Exercise[]>();
    for (const exercise of filteredExercises) {
      const key = getExerciseSelectionGroup(exercise);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)?.push(exercise);
    }
    return grouped;
  }, [filteredExercises]);

  const presetPreview = useMemo(() => {
    if (!newExerciseName.trim()) return null;
    return inferExercisePreset(newExerciseName.trim());
  }, [newExerciseName]);

  const handleSelect = (exercise: Exercise) => {
    onSelect(exercise);
    onClose();
  };

  const handleAddExercise = async () => {
    if (!newExerciseName.trim()) {
      Alert.alert('エラー', '種目名を入力してください');
      return;
    }

    try {
      const preset = inferExercisePreset(newExerciseName.trim());
      const newExercise = await ExerciseService.addExercise({
        name: newExerciseName.trim(),
        category: preset.category ?? 'accessory',
        subcategory: preset.subcategory,
        has_lvp: preset.has_lvp ?? true,
        machine_weight_steps: preset.machine_weight_steps,
        min_rom_threshold: preset.min_rom_threshold,
        rep_detection_mode: preset.rep_detection_mode,
        target_pause_ms: preset.target_pause_ms,
        rom_range_min_cm: preset.rom_range_min_cm,
        rom_range_max_cm: preset.rom_range_max_cm,
        rom_data_points: 0,
        description: preset.description,
        mvt: preset.mvt,
      });

      setNewExerciseName('');
      setIsAddMode(false);
      setSearchQuery(''); // 検索をリセット
      await loadExercises();

      // 新しい種目を選択状態にする
      onSelect(newExercise);
      onClose();

      Alert.alert('追加完了', `${newExercise.name} を選択しました`);
    } catch (error) {
      console.error('Failed to add exercise:', error);
      Alert.alert('エラー', '種目の追加に失敗しました');
    }
  };

  const renderExerciseCard = (exercise: Exercise) => {
    const isSelected = currentExerciseId === exercise.id;
    const romRange =
      exercise.rom_range_min_cm != null && exercise.rom_range_max_cm != null
        ? `${formatLoadKg(exercise.rom_range_min_cm)}-${formatLoadKg(exercise.rom_range_max_cm)}cm`
        : exercise.min_rom_threshold != null
          ? `最小ROM ${formatLoadKg(exercise.min_rom_threshold)}cm`
          : 'ROM未推定';

    return (
      <TouchableOpacity
        key={exercise.id}
        style={[styles.exerciseItem, isSelected && styles.exerciseItemSelected]}
        onPress={() => handleSelect(exercise)}
      >
        <View style={styles.exerciseItemLeft}>
          <View style={styles.exerciseTitleRow}>
            <Text style={styles.exerciseName}>{exercise.name}</Text>
            {exercise.has_lvp ? (
              <View style={styles.lvpBadge}>
                <Text style={styles.lvpBadgeText}>LVP</Text>
              </View>
            ) : null}
          </View>
          <View style={styles.exerciseMetaRow}>
            <Text style={styles.exerciseCategory}>{getExerciseCategoryLabel(exercise.category)}</Text>
            <Text style={styles.exerciseMetaDot}>•</Text>
            <Text style={styles.exerciseMeta}>{MODE_LABELS[exercise.rep_detection_mode ?? 'standard']}</Text>
          </View>
          <Text style={styles.exerciseRom}>{romRange}</Text>
          {exercise.description ? <Text style={styles.exerciseDescription}>{exercise.description}</Text> : null}
        </View>
        {isSelected ? <Text style={styles.checkmark}>✓</Text> : null}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>EXERCISE GARAGE</Text>
              <Text style={styles.title}>種目を選択</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="種目名で検索"
              placeholderTextColor={GarageTheme.textSubtle}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
            {EXERCISE_SELECTION_GROUPS.map((group) => (
              <TouchableOpacity
                key={group.id}
                style={[styles.categoryChip, selectedGroup === group.id && styles.categoryChipActive]}
                onPress={() => setSelectedGroup(group.id)}
              >
                <Text style={[styles.categoryChipText, selectedGroup === group.id && styles.categoryChipTextActive]}>
                  {group.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView style={styles.exerciseList} contentContainerStyle={styles.exerciseListContent}>
            {isAddMode ? (
              <View style={styles.addForm}>
                <Text style={styles.addFormTitle}>新しい種目を追加</Text>
                <TextInput
                  style={styles.nameInput}
                  placeholder="例: ポーズベンチプレス"
                  placeholderTextColor={GarageTheme.textSubtle}
                  value={newExerciseName}
                  onChangeText={setNewExerciseName}
                  autoFocus
                />

                {presetPreview ? (
                  <View style={styles.previewCard}>
                    <Text style={styles.previewTitle}>推定設定</Text>
                    <View style={styles.previewRow}>
                      <Text style={styles.previewLabel}>カテゴリ:</Text>
                      <Text style={styles.previewMain}>{getExerciseCategoryLabel(presetPreview.category)}</Text>
                    </View>
                    <View style={styles.previewRow}>
                      <Text style={styles.previewLabel}>検出モード:</Text>
                      <Text style={styles.previewMeta}>{MODE_LABELS[presetPreview.rep_detection_mode ?? 'standard']}</Text>
                    </View>
                    <View style={styles.previewRow}>
                      <Text style={styles.previewLabel}>最小ROM:</Text>
                      <Text style={styles.previewMeta}>{formatLoadKg(presetPreview.min_rom_threshold ?? 10)}cm</Text>
                    </View>
                    <View style={styles.previewRow}>
                      <Text style={styles.previewLabel}>ROM範囲:</Text>
                      <Text style={styles.previewMeta}>
                        {formatLoadKg(presetPreview.rom_range_min_cm)}-{formatLoadKg(presetPreview.rom_range_max_cm)}cm
                      </Text>
                    </View>
                    {presetPreview.has_lvp && (
                      <View style={styles.lvpIndicator}>
                        <Text style={styles.lvpIndicatorText}>LVP対応</Text>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.previewCard}>
                    <Text style={styles.previewPlaceholder}>種目名を入力すると推定設定が表示されます</Text>
                  </View>
                )}

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
                  <TouchableOpacity style={[styles.addFormButton, styles.confirmButton]} onPress={handleAddExercise}>
                    <Text style={styles.addFormButtonText}>追加</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                {Array.from(groupedExercises.entries()).map(([groupId, groupExercises]) => {
                  const groupLabel = EXERCISE_SELECTION_GROUPS.find((group) => group.id === groupId)?.label ?? groupId;
                  return (
                    <View key={groupId} style={styles.groupSection}>
                      <Text style={styles.groupTitle}>{groupLabel}</Text>
                      {groupExercises.map(renderExerciseCard)}
                    </View>
                  );
                })}

                {filteredExercises.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>条件に合う種目がありません</Text>
                    <Text style={styles.emptyStateSubText}>検索ワードを変えるか、新しい種目を追加してください</Text>
                  </View>
                ) : null}

                <TouchableOpacity style={styles.addExerciseButton} onPress={() => setIsAddMode(true)}>
                  <Text style={styles.addExerciseButtonText}>+ 種目を追加</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: GarageTheme.background,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: '86%',
    borderTopWidth: 1,
    borderColor: GarageTheme.borderStrong,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: GarageTheme.border,
  },
  eyebrow: {
    color: GarageTheme.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: GarageTheme.text,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GarageTheme.chip,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
  },
  closeButtonText: {
    fontSize: 18,
    color: GarageTheme.textStrong,
  },
  searchContainer: {
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  searchInput: {
    backgroundColor: GarageTheme.chip,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: GarageTheme.textStrong,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
  },
  categoryScroll: {
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  categoryChip: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: GarageTheme.chip,
    marginRight: 10,
    borderWidth: 1.5,
    borderColor: GarageTheme.borderStrong,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
  categoryChipActive: {
    backgroundColor: GarageTheme.accent,
    borderColor: GarageTheme.accent,
    shadowColor: '#ff6a2a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  categoryChipText: {
    fontSize: 14,
    color: GarageTheme.textMuted,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  categoryChipTextActive: {
    color: '#fff4ec',
    fontWeight: '800',
  },
  exerciseList: {
    flex: 1,
  },
  exerciseListContent: {
    padding: 18,
    paddingTop: 10,
    paddingBottom: 28,
  },
  groupSection: {
    marginBottom: 18,
  },
  groupTitle: {
    color: GarageTheme.accentSoft,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 12,
    marginTop: 8,
  },
  exerciseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: GarageTheme.surface,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: GarageTheme.borderStrong,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  exerciseItemSelected: {
    backgroundColor: '#4b2416',
    borderColor: GarageTheme.accent,
    borderWidth: 2,
    shadowColor: '#ff6a2a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 4,
  },
  exerciseItemLeft: {
    flex: 1,
  },
  exerciseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  exerciseName: {
    fontSize: 17,
    fontWeight: '700',
    color: GarageTheme.textStrong,
    flexShrink: 1,
    letterSpacing: 0.3,
  },
  exerciseMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  exerciseCategory: {
    color: GarageTheme.info,
    fontSize: 13,
    fontWeight: '700',
  },
  exerciseMetaDot: {
    color: GarageTheme.textSubtle,
    fontSize: 13,
  },
  exerciseMeta: {
    color: GarageTheme.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  exerciseRom: {
    color: GarageTheme.accentSoft,
    fontSize: 13,
    marginTop: 10,
    fontWeight: '700',
  },
  exerciseDescription: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    marginTop: 6,
    lineHeight: 17,
  },
  lvpBadge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#1d3020',
    borderWidth: 1,
    borderColor: GarageTheme.success,
  },
  lvpBadgeText: {
    color: GarageTheme.success,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  checkmark: {
    backgroundColor: GarageTheme.accent,
    color: '#fff4ec',
    fontSize: 16,
    fontWeight: '800',
    width: 28,
    height: 28,
    borderRadius: 14,
    textAlign: 'center',
    lineHeight: 28,
    marginLeft: 12,
    shadowColor: '#ff6a2a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 3,
  },
  addExerciseButton: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GarageTheme.accent,
    backgroundColor: '#4b2416',
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 6,
  },
  addExerciseButtonText: {
    color: GarageTheme.textStrong,
    fontSize: 15,
    fontWeight: '800',
  },
  addForm: {
    backgroundColor: GarageTheme.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    padding: 16,
  },
  addFormTitle: {
    color: GarageTheme.textStrong,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 12,
  },
  nameInput: {
    backgroundColor: GarageTheme.chip,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: GarageTheme.textStrong,
    fontSize: 15,
  },
  previewCard: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: GarageTheme.chip,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
  },
  previewTitle: {
    color: GarageTheme.textMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  previewLabel: {
    color: GarageTheme.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  previewMain: {
    color: GarageTheme.textStrong,
    fontSize: 15,
    fontWeight: '800',
  },
  previewMeta: {
    color: GarageTheme.accentSoft,
    fontSize: 13,
    fontWeight: '700',
  },
  previewPlaceholder: {
    color: GarageTheme.textMuted,
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 8,
  },
  lvpIndicator: {
    marginTop: 8,
    backgroundColor: '#1d3020',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: GarageTheme.success,
  },
  lvpIndicatorText: {
    color: GarageTheme.success,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  addFormButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  addFormButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: GarageTheme.chip,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
  },
  confirmButton: {
    backgroundColor: '#4b2416',
    borderWidth: 1,
    borderColor: GarageTheme.accent,
  },
  addFormButtonText: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: '800',
  },
  emptyState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    color: GarageTheme.textStrong,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyStateSubText: {
    color: GarageTheme.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
});
