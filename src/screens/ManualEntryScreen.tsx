/**
 * Manual Entry Screen
 * For logging workouts without VBT sensor
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import DatabaseService from '@services/DatabaseService';
import VBTCalculations from '@utils/VBTCalculations';
import { SetData, RepData, SetType } from '@types/index';

interface ManualEntryScreenProps {
  navigation: any;
}

const ManualEntryScreen: React.FC<ManualEntryScreenProps> = ({ navigation }) => {
  const [sessionId] = useState(new Date().toISOString().split('T')[0]);
  const [lift, setLift] = useState('Bench Press');
  const [setIndex, setSetIndex] = useState(1);
  const [loadKg, setLoadKg] = useState('');
  const [reps, setReps] = useState('');
  const [rpe, setRpe] = useState('');
  const [setType, setSetType] = useState<SetType>('normal');
  const [notes, setNotes] = useState('');
  const [savedSets, setSavedSets] = useState<SetData[]>([]);

  const exercises = [
    'Bench Press',
    'Squat',
    'Deadlift',
    'Overhead Press',
    'Barbell Row',
    'Pull-up',
    'Dip',
  ];

  const setTypes: { value: SetType; label: string }[] = [
    { value: 'normal', label: '通常' },
    { value: 'amrap', label: 'AMRAP' },
    { value: 'drop', label: 'ドロップ' },
    { value: 'superset_A', label: 'スーパーA' },
    { value: 'superset_B', label: 'スーパーB' },
  ];

  const handleSaveSet = async () => {
    const loadValue = parseFloat(loadKg);
    const repsValue = parseInt(reps);
    const rpeValue = rpe ? parseFloat(rpe) : undefined;

    // Validation
    if (!loadKg || !reps) {
      Alert.alert('エラー', '負荷とレップ数を入力してください');
      return;
    }

    if (isNaN(loadValue) || loadValue <= 0) {
      Alert.alert('エラー', '有効な負荷を入力してください');
      return;
    }

    if (isNaN(repsValue) || repsValue <= 0) {
      Alert.alert('エラー', '有効なレップ数を入力してください');
      return;
    }

    if (rpeValue && (rpeValue < 1 || rpeValue > 10)) {
      Alert.alert('エラー', 'RPEは1-10の範囲で入力してください');
      return;
    }

    try {
      // Calculate e1RM
      const e1rm = VBTCalculations.estimate1RMFromReps(loadValue, repsValue, rpeValue);

      // Create set data
      const setData: SetData = {
        session_id: sessionId,
        lift,
        set_index: setIndex,
        load_kg: loadValue,
        reps: repsValue,
        device_type: 'manual',
        set_type: setType,
        avg_velocity: null,
        velocity_loss: null,
        rpe: rpeValue,
        e1rm,
        timestamp: new Date().toISOString(),
        notes: notes || undefined,
      };

      // Save to database
      await DatabaseService.insertSet(setData);

      // Create rep records (for consistency)
      for (let i = 1; i <= repsValue; i++) {
        const repData: RepData = {
          session_id: sessionId,
          lift,
          set_index: setIndex,
          rep_index: i,
          load_kg: loadValue,
          device_type: 'manual',
          mean_velocity: null,
          peak_velocity: null,
          rom_cm: null,
          rep_duration_ms: null,
          is_valid_rep: true,
          rpe_set: rpeValue,
          set_type: setType,
          timestamp: new Date().toISOString(),
        };
        await DatabaseService.insertRep(repData);
      }

      // Add to saved sets
      setSavedSets([...savedSets, setData]);

      // Clear form
      setLoadKg('');
      setReps('');
      setRpe('');
      setNotes('');
      setSetIndex(setIndex + 1);

      Alert.alert('成功', `セット ${setIndex} を保存しました`);
    } catch (error) {
      console.error('Failed to save set:', error);
      Alert.alert('エラー', 'セットの保存に失敗しました');
    }
  };

  const handleFinishSession = () => {
    if (savedSets.length === 0) {
      Alert.alert('エラー', 'まずセットを記録してください');
      return;
    }

    Alert.alert(
      'セッション完了',
      `${savedSets.length}セットを記録しました`,
      [
        {
          text: 'OK',
          onPress: () => navigation.navigate('Home'),
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.title}>手動入力</Text>
      </View>

      <View style={styles.form}>
        {/* Exercise Selection */}
        <Text style={styles.label}>種目</Text>
        <View style={styles.exerciseGrid}>
          {exercises.map((ex) => (
            <TouchableOpacity
              key={ex}
              style={[
                styles.exerciseButton,
                lift === ex && styles.exerciseButtonActive,
              ]}
              onPress={() => setLift(ex)}
            >
              <Text
                style={[
                  styles.exerciseButtonText,
                  lift === ex && styles.exerciseButtonTextActive,
                ]}
              >
                {ex}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Set Type */}
        <Text style={styles.label}>セットタイプ</Text>
        <View style={styles.setTypeContainer}>
          {setTypes.map((type) => (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.setTypeButton,
                setType === type.value && styles.setTypeButtonActive,
              ]}
              onPress={() => setSetType(type.value)}
            >
              <Text
                style={[
                  styles.setTypeButtonText,
                  setType === type.value && styles.setTypeButtonTextActive,
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Load */}
        <Text style={styles.label}>負荷 (kg)</Text>
        <TextInput
          style={styles.input}
          value={loadKg}
          onChangeText={setLoadKg}
          keyboardType="decimal-pad"
          placeholder="80.0"
          placeholderTextColor="#666"
        />

        {/* Reps */}
        <Text style={styles.label}>レップ数</Text>
        <TextInput
          style={styles.input}
          value={reps}
          onChangeText={setReps}
          keyboardType="number-pad"
          placeholder="10"
          placeholderTextColor="#666"
        />

        {/* RPE */}
        <Text style={styles.label}>RPE (1-10, オプション)</Text>
        <TextInput
          style={styles.input}
          value={rpe}
          onChangeText={setRpe}
          keyboardType="decimal-pad"
          placeholder="8.0"
          placeholderTextColor="#666"
        />

        {/* Notes */}
        <Text style={styles.label}>メモ (オプション)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="セットに関するメモ..."
          placeholderTextColor="#666"
          multiline
          numberOfLines={3}
        />

        {/* Buttons */}
        <TouchableOpacity style={styles.saveButton} onPress={handleSaveSet}>
          <Text style={styles.saveButtonText}>セット {setIndex} を保存</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.finishButton, savedSets.length === 0 && styles.buttonDisabled]}
          onPress={handleFinishSession}
          disabled={savedSets.length === 0}
        >
          <Text style={styles.finishButtonText}>セッション完了</Text>
        </TouchableOpacity>
      </View>

      {/* Saved Sets Summary */}
      {savedSets.length > 0 && (
        <View style={styles.summaryContainer}>
          <Text style={styles.summaryTitle}>記録済みセット</Text>
          {savedSets.map((set, index) => (
            <View key={index} style={styles.summaryItem}>
              <Text style={styles.summaryText}>
                セット {set.set_index}: {set.load_kg} kg × {set.reps} reps
              </Text>
              {set.e1rm && (
                <Text style={styles.summaryE1rm}>e1RM: {set.e1rm.toFixed(1)} kg</Text>
              )}
            </View>
          ))}
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
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    color: '#2196F3',
    fontSize: 16,
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  form: {
    padding: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  exerciseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  exerciseButton: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  exerciseButtonActive: {
    backgroundColor: '#2196F3',
  },
  exerciseButtonText: {
    color: '#999',
    fontSize: 14,
  },
  exerciseButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  setTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  setTypeButton: {
    backgroundColor: '#2a2a2a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  setTypeButtonActive: {
    backgroundColor: '#FF9800',
  },
  setTypeButtonText: {
    color: '#999',
    fontSize: 14,
  },
  setTypeButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#2a2a2a',
    color: '#fff',
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#444',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  finishButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  finishButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  buttonDisabled: {
    backgroundColor: '#444',
    opacity: 0.5,
  },
  summaryContainer: {
    margin: 16,
    padding: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14,
    color: '#fff',
  },
  summaryE1rm: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
});

export default ManualEntryScreen;
