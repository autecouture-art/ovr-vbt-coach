/**
 * Manual Input Screen
 * 手動入力画面
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import DatabaseService from '@/src/services/DatabaseService';

interface ManualSet {
  exercise: string;
  loadKg: string;
  reps: string;
  avgVelocity: string;
  rpe: string;
}

export default function ManualInputScreen() {
  const router = useRouter();
  const [exercise, setExercise] = useState('ベンチプレス');
  const [sets, setSets] = useState<ManualSet[]>([{
    exercise: 'ベンチプレス',
    loadKg: '',
    reps: '',
    avgVelocity: '',
    rpe: '',
  }]);

  const exercises = ['ベンチプレス', 'スクワット', 'デッドリフト', 'オーバーヘッドプレス', 'バーベルロー'];

  const addSet = () => {
    setSets([...sets, {
      exercise,
      loadKg: '',
      reps: '',
      avgVelocity: '',
      rpe: '',
    }]);
  };

  const updateSet = (index: number, field: keyof ManualSet, value: string) => {
    const newSets = [...sets];
    newSets[index][field] = value;
    setSets(newSets);
  };

  const removeSet = (index: number) => {
    if (sets.length <= 1) {
      Alert.alert('エラー', '最低1セットは必要です');
      return;
    }
    const newSets = sets.filter((_, i) => i !== index);
    setSets(newSets);
  };

  const saveSession = async () => {
    // バリデーション
    for (let i = 0; i < sets.length; i++) {
      const set = sets[i];
      if (!set.loadKg || !set.reps) {
        Alert.alert('エラー', `${i + 1}セット目: 負荷と回数を入力してください`);
        return;
      }
    }

    try {
      // TODO: DatabaseServiceで保存
      Alert.alert('保存完了', `${sets.length}セットを記録しました`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('エラー', '保存に失敗しました');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.title}>手動入力</Text>
        <View style={styles.placeholder} />
      </View>

      {/* 種目選択 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>種目</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.exerciseScroll}>
          {exercises.map((ex) => (
            <TouchableOpacity
              key={ex}
              style={[
                styles.exerciseButton,
                exercise === ex && styles.exerciseButtonActive,
              ]}
              onPress={() => setExercise(ex)}
            >
              <Text
                style={[
                  styles.exerciseButtonText,
                  exercise === ex && styles.exerciseButtonTextActive,
                ]}
              >
                {ex}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* セット入力 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>セット</Text>
          <TouchableOpacity onPress={addSet} style={styles.addButton}>
            <Text style={styles.addButtonText}>+ セット追加</Text>
          </TouchableOpacity>
        </View>

        {sets.map((set, index) => (
          <View key={index} style={styles.setCard}>
            <View style={styles.setCardHeader}>
              <Text style={styles.setNumber}>セット {index + 1}</Text>
              {sets.length > 1 && (
                <TouchableOpacity onPress={() => removeSet(index)}>
                  <Text style={styles.removeButton}>削除</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.inputGrid}>
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>負荷 (kg)</Text>
                <TextInput
                  style={styles.input}
                  value={set.loadKg}
                  onChangeText={(value) => updateSet(index, 'loadKg', value)}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>回数</Text>
                <TextInput
                  style={styles.input}
                  value={set.reps}
                  onChangeText={(value) => updateSet(index, 'reps', value)}
                  placeholder="5"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>平均速度</Text>
                <TextInput
                  style={styles.input}
                  value={set.avgVelocity}
                  onChangeText={(value) => updateSet(index, 'avgVelocity', value)}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>RPE</Text>
                <TextInput
                  style={styles.input}
                  value={set.rpe}
                  onChangeText={(value) => updateSet(index, 'rpe', value)}
                  placeholder="10"
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* 保存ボタン */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.saveButton} onPress={saveSession}>
          <Text style={styles.buttonText}>保存して終了</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

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
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#2196F3',
    fontSize: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  placeholder: {
    width: 50,
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  addButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#2196F3',
    borderRadius: 6,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  exerciseScroll: {
    flexDirection: 'row',
  },
  exerciseButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    marginRight: 8,
  },
  exerciseButtonActive: {
    backgroundColor: '#FF9800',
  },
  exerciseButtonText: {
    color: '#999',
    fontSize: 14,
  },
  exerciseButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  setCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  setCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  setNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  removeButton: {
    color: '#F44336',
    fontSize: 14,
  },
  inputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  inputWrapper: {
    width: '48%',
    marginHorizontal: '1%',
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#3a3a3a',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
  },
  buttonContainer: {
    padding: 16,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
