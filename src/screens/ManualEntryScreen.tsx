/**
 * Manual Entry Screen
 * For logging workouts without VBT sensor
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DatabaseService from '../services/DatabaseService';
import VBTCalculations from '../utils/VBTCalculations';
import { SetData, RepData, SetType } from '../types/index';
import { createSessionId, formatSessionLabel } from '../utils/session';

interface ManualEntryScreenProps {
  navigation: any;
}

const ManualEntryScreen: React.FC<ManualEntryScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [sessionId] = useState(() => createSessionId());
  const [lift, setLift] = useState('Bench Press');
  const [setIndex, setSetIndex] = useState(1);
  const [loadKg, setLoadKg] = useState('');
  const [reps, setReps] = useState('');
  const [rpe, setRpe] = useState('');
  const [setType, setSetType] = useState<SetType>('normal');
  const [notes, setNotes] = useState('');
  const [savedSets, setSavedSets] = useState<SetData[]>([]);
  const [recentLiftSets, setRecentLiftSets] = useState<SetData[]>([]);

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

  const parsedLoadKg = loadKg ? parseFloat(loadKg) : null;
  const parsedReps = reps ? parseInt(reps, 10) : null;

  const sessionSummary = useMemo(() => {
    const totalVolume = savedSets.reduce((sum, set) => sum + set.load_kg * set.reps, 0);
    return {
      savedSetCount: savedSets.length,
      totalVolume,
      liftNames: Array.from(new Set(savedSets.map((set) => set.lift))),
    };
  }, [savedSets]);

  useEffect(() => {
    const loadRecentLiftSets = async () => {
      try {
        const sets = await DatabaseService.getRecentSetsForLift(lift, 3, sessionId);
        setRecentLiftSets(sets);
      } catch {
        setRecentLiftSets([]);
      }
    };

    void loadRecentLiftSets();
  }, [lift, sessionId]);

  const handleAskCoach = () => {
    navigation.navigate('CoachChat', {
      source: 'manual-entry',
      sessionId,
      message: savedSets.length > 0 ? 'このセッションを評価して' : 'このセット設定を評価して',
      currentExercise: lift,
      currentSet: setIndex,
      loadKg: parsedLoadKg ?? loadKg,
      reps: parsedReps ?? reps,
      totalSets: sessionSummary.savedSetCount,
      totalVolume: Math.round(sessionSummary.totalVolume),
      notes,
      savedSetCount: sessionSummary.savedSetCount,
    });
  };

  const handleRecentSetCoach = (set: SetData) => {
    navigation.navigate('CoachChat', {
      source: 'manual-entry-history',
      sessionId: set.session_id,
      message: '前回セットと比べて今回の設定をどう調整するべき？',
      currentExercise: set.lift,
      currentSet: set.set_index,
      loadKg: set.load_kg,
      reps: set.reps,
      totalSets: 1,
      notes: set.notes ?? '',
    });
  };

  const handleSaveSet = async () => {
    const loadValue = parsedLoadKg ?? NaN;
    const repsValue = parsedReps ?? NaN;
    const rpeValue = rpe ? parseFloat(rpe) : undefined;

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
      await DatabaseService.ensureSession(sessionId, notes);

      const e1rm = VBTCalculations.estimate1RMFromReps(loadValue, repsValue, rpeValue);

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

      await DatabaseService.insertSet(setData);

      for (let i = 1; i <= repsValue; i += 1) {
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

      await DatabaseService.syncSessionSummary(sessionId);

      setSavedSets((prev) => [...prev, setData]);
      setLoadKg('');
      setReps('');
      setRpe('');
      setNotes('');
      setSetIndex((prev) => prev + 1);

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

    Alert.alert('セッション完了', `${savedSets.length}セットを記録しました`, [
      {
        text: 'OK',
        onPress: () => navigation.navigate('Home'),
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }} onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← 戻る</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>手動入力</Text>
          <Text style={styles.subtitle}>{lift} / セット {setIndex}</Text>
        </View>
      </View>

      <View style={styles.form}>
        <TouchableOpacity style={styles.coachButton} onPress={handleAskCoach}>
          <Text style={styles.coachButtonText}>AIコーチに確認</Text>
          <Text style={styles.coachButtonSubtext}>
            {savedSets.length > 0 ? '保存済みセット込みで相談' : '入力前でも負荷設定を相談可能'}
          </Text>
        </TouchableOpacity>

        <View style={styles.recentCard}>
          <Text style={styles.recentTitle}>直近の同種目</Text>
          {recentLiftSets.length === 0 ? (
            <Text style={styles.recentEmpty}>まだ比較できる過去セットがありません</Text>
          ) : (
            recentLiftSets.map((set) => (
              <TouchableOpacity
                key={`${set.session_id}_${set.set_index}_${set.lift}`}
                style={styles.recentItem}
                onPress={() => handleRecentSetCoach(set)}
              >
                <View style={styles.recentItemCopy}>
                  <Text style={styles.recentItemDate}>{formatSessionLabel(set.session_id)}</Text>
                  <Text style={styles.recentItemMain}>{set.load_kg} kg x {set.reps} reps</Text>
                </View>
                <View style={styles.recentItemAction}>
                  <Text style={styles.recentItemMeta}>
                    {set.e1rm ? `e1RM ${set.e1rm.toFixed(1)}` : set.set_type}
                  </Text>
                  <Text style={styles.recentItemHint}>AI相談</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

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

        <Text style={styles.label}>負荷 (kg)</Text>
        <TextInput
          style={styles.input}
          value={loadKg}
          onChangeText={setLoadKg}
          keyboardType="decimal-pad"
          placeholder="80.0"
          placeholderTextColor="#666"
        />

        <Text style={styles.label}>レップ数</Text>
        <TextInput
          style={styles.input}
          value={reps}
          onChangeText={setReps}
          keyboardType="number-pad"
          placeholder="10"
          placeholderTextColor="#666"
        />

        <Text style={styles.label}>RPE (1-10, オプション)</Text>
        <TextInput
          style={styles.input}
          value={rpe}
          onChangeText={setRpe}
          keyboardType="decimal-pad"
          placeholder="8.5"
          placeholderTextColor="#666"
        />

        <Text style={styles.label}>メモ (オプション)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={notes}
          onChangeText={setNotes}
          placeholder="フォーム、疲労感、次回メモなど"
          placeholderTextColor="#666"
          multiline
        />

        <TouchableOpacity style={styles.saveButton} onPress={handleSaveSet}>
          <Text style={styles.saveButtonText}>セットを保存</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.finishButton, savedSets.length === 0 && styles.buttonDisabled]}
          onPress={handleFinishSession}
          disabled={savedSets.length === 0}
        >
          <Text style={styles.finishButtonText}>セッション完了</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>保存済みセット</Text>
        {savedSets.length === 0 ? (
          <Text style={styles.summaryEmpty}>まだ保存されたセットはありません</Text>
        ) : (
          <>
            <View style={styles.summaryOverview}>
              <Text style={styles.summaryOverviewText}>合計 {sessionSummary.savedSetCount} セット</Text>
              <Text style={styles.summaryOverviewText}>
                {Math.round(sessionSummary.totalVolume).toLocaleString()} kg
              </Text>
            </View>
            {savedSets.map((set) => (
              <View key={`${set.session_id}_${set.set_index}_${set.lift}`} style={styles.summaryItem}>
                <View>
                  <Text style={styles.summaryText}>{set.lift} / セット {set.set_index}</Text>
                  <Text style={styles.summaryMeta}>{set.load_kg} kg × {set.reps} reps</Text>
                </View>
                {set.e1rm ? (
                  <Text style={styles.summaryE1rm}>e1RM {set.e1rm.toFixed(1)}</Text>
                ) : null}
              </View>
            ))}
          </>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  subtitle: {
    fontSize: 13,
    color: '#999',
    marginTop: 2,
  },
  form: {
    padding: 16,
  },
  coachButton: {
    backgroundColor: '#1f1512',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ff6a2a',
    padding: 14,
    marginBottom: 8,
  },
  coachButtonText: {
    color: '#fff4ec',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  coachButtonSubtext: {
    color: '#d4a58f',
    fontSize: 12,
  },
  recentCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#2f2f2f',
  },
  recentTitle: {
    color: '#f1f1f1',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 10,
  },
  recentEmpty: {
    color: '#8a8a8a',
    fontSize: 13,
  },
  recentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#232323',
  },
  recentItemCopy: {
    flex: 1,
  },
  recentItemDate: {
    color: '#9ad0ff',
    fontSize: 12,
    marginBottom: 3,
  },
  recentItemMain: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  recentItemAction: {
    alignItems: 'flex-end',
    gap: 4,
  },
  recentItemMeta: {
    color: '#a9d6a1',
    fontSize: 12,
    fontWeight: '700',
  },
  recentItemHint: {
    color: '#ffb347',
    fontSize: 11,
    fontWeight: '700',
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
    marginTop: 0,
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
  summaryEmpty: {
    fontSize: 14,
    color: '#888',
  },
  summaryOverview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryOverviewText: {
    color: '#f0f0f0',
    fontSize: 14,
    fontWeight: '600',
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
  },
  summaryText: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 2,
  },
  summaryMeta: {
    fontSize: 12,
    color: '#999',
  },
  summaryE1rm: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '600',
  },
});

export default ManualEntryScreen;
