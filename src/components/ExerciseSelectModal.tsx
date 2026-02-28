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
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddMode, setIsAddMode] = useState(false);
  const [newExerciseName, setNewExerciseName] = useState('');

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
    if (visible) {
      loadExercises();
    }
  }, [visible]);

  const loadExercises = async () => {
    const all = await ExerciseService.getAllExercises();
    setExercises(all);
  };

  const filteredExercises = exercises.filter(exercise => {
    const matchesCategory = selectedCategory === 'all' || exercise.category === selectedCategory;
    const matchesSearch = exercise.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
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

    const newExercise = await ExerciseService.addExercise({
      name: newExerciseName.trim(),
      category: (selectedCategory === 'all' ? 'accessory' : selectedCategory) as Exercise['category'],
      has_lvp: true,
    });

    setNewExerciseName('');
    setIsAddMode(false);
    await loadExercises();
    Alert.alert('追加完了', `${newExercise.name}を追加しました`);
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
            <Text style={styles.title}>種目を選択</Text>
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
          </View>

          {/* Category Filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
          >
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  selectedCategory === cat.id && styles.categoryChipActive,
                ]}
                onPress={() => setSelectedCategory(cat.id)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    selectedCategory === cat.id && styles.categoryChipTextActive,
                  ]}
                >
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

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
            ) : (
              <>
                {filteredExercises.map((exercise) => (
                  <TouchableOpacity
                    key={exercise.id}
                    style={[
                      styles.exerciseItem,
                      currentExerciseId === exercise.id && styles.exerciseItemSelected,
                    ]}
                    onPress={() => handleSelect(exercise)}
                  >
                    <View style={styles.exerciseItemLeft}>
                      <Text style={styles.exerciseName}>{exercise.name}</Text>
                      <View style={styles.exerciseMeta}>
                        <Text style={styles.exerciseCategory}>
                          {categories.find(c => c.id === exercise.category)?.name || exercise.category}
                        </Text>
                        {exercise.has_lvp && (
                          <View style={styles.lvpBadge}>
                            <Text style={styles.lvpBadgeText}>LVP</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    {currentExerciseId === exercise.id && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}

                {/* Add Exercise Button */}
                <TouchableOpacity
                  style={styles.addExerciseButton}
                  onPress={() => setIsAddMode(true)}
                >
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
  categoryScroll: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#2a2a2a',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: '#2196F3',
  },
  categoryChipText: {
    fontSize: 14,
    color: '#999',
  },
  categoryChipTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  exerciseList: {
    padding: 16,
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
});
