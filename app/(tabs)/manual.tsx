import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import DatabaseService from '@/src/services/DatabaseService';
import AICoachService from '@/src/services/AICoachService';
import ExerciseService from '@/src/services/ExerciseService';
import { ExerciseSelectModal } from '@/src/components/ExerciseSelectModal';
import { useManualDraftStore } from '@/src/store/manualDraftStore';
import { getLocalizedExerciseName } from '@/src/utils/exerciseLocalization';
import type { SetData, Exercise } from '@/src/types/index';

interface ManualSet {
  exercise: string;
  loadKg: string;
  reps: string;
  rpe: string;
}

export default function ManualInputScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const consumeDraft = useManualDraftStore(state => state.consumeDraft);
  const [exercise, setExercise] = useState('ベンチプレス');
  const [saving, setSaving] = useState(false);
  const [masterExercises, setMasterExercises] = useState<Exercise[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingSetIndex, setEditingSetIndex] = useState<number | null>(null);
  const [draftSourceLabel, setDraftSourceLabel] = useState<string | null>(null);

  const [sets, setSets] = useState<ManualSet[]>([{
    exercise: 'ベンチプレス',
    loadKg: '',
    reps: '',
    rpe: '',
  }]);

  useEffect(() => {
    loadExercises();
  }, []);

  useFocusEffect(
    useCallback(() => {
      const draft = consumeDraft();
      if (!draft || draft.sets.length === 0) {
        return;
      }

      setSets(draft.sets);
      setExercise(draft.sets[0].exercise);
      setDraftSourceLabel(draft.sourceLabel);
    }, [consumeDraft])
  );

  const loadExercises = async () => {
    const all = await ExerciseService.getAllExercises();
    setMasterExercises(all);
    // デフォルトの種目がマスタにあるか確認
    if (all.length > 0 && !all.find(e => e.name === exercise)) {
      setExercise(all[0].name);
      setSets([{ exercise: all[0].name, loadKg: '', reps: '', rpe: '' }]);
    }
  };

  // クイック選択用の主要種目（Big 3 + α）
  const quickExercises = masterExercises.filter(e =>
    ['squat', 'bench', 'deadlift', 'press', 'pull'].includes(e.category)
  ).slice(0, 8);

  const addSet = () => {
    setSets([...sets, { exercise, loadKg: '', reps: '', rpe: '' }]);
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
    setSets(sets.filter((_, i) => i !== index));
  };

  const applyExerciseToAll = (exerciseName: string) => {
    setExercise(exerciseName);
    setSets(current => current.map(set => ({ ...set, exercise: exerciseName })));
  };

  const updateSetExercise = (index: number, exerciseName: string) => {
    setSets(current => current.map((set, setIndex) => (
      setIndex === index ? { ...set, exercise: exerciseName } : set
    )));
  };

  const openExercisePicker = (index: number | null = null) => {
    setEditingSetIndex(index);
    setIsModalVisible(true);
  };

  const closeExercisePicker = () => {
    setEditingSetIndex(null);
    setIsModalVisible(false);
  };

  const saveSession = async () => {
    for (let i = 0; i < sets.length; i++) {
      if (!sets[i].loadKg || !sets[i].reps) {
        Alert.alert('エラー', `${i + 1}セット目: 負荷と回数を入力してください`);
        return;
      }
    }

    setSaving(true);
    try {
      // UUID風のセッションID
      const sessionId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const today = new Date().toISOString().split('T')[0];

      // セットデータを構築
      const setDataList: SetData[] = sets.map((s, idx) => ({
        session_id: sessionId,
        lift: s.exercise,
        set_index: idx + 1,
        load_kg: parseFloat(s.loadKg) || 0,
        reps: parseInt(s.reps) || 0,
        device_type: 'manual',
        set_type: 'normal',
        avg_velocity: null,
        velocity_loss: null,
        rpe: s.rpe ? parseFloat(s.rpe) : undefined,
        timestamp: new Date().toISOString(),
      }));

      const totalVolume = setDataList.reduce((sum, s) => sum + s.load_kg * s.reps, 0);

      // DBにセッションを保存
      await DatabaseService.insertSession({
        session_id: sessionId,
        date: today,
        total_volume: totalVolume,
        total_sets: setDataList.length,
        lifts: [...new Set(setDataList.map(s => s.lift))],
      });

      // 各セットを保存
      for (const setData of setDataList) {
        await DatabaseService.insertSet(setData);
      }

      // AIサマリーを生成して表示
      const summary = AICoachService.generateSessionSummary(setDataList);
      Alert.alert(
        '✅ 手動入力完了',
        `${sets.length}セットを記録しました。\n\n${summary}`,
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error) {
      console.error('手動入力の保存失敗:', error);
      Alert.alert('エラー', '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

    return (
    <ScrollView style={styles.container}>
      <View style={[styles.header, { paddingTop: (insets.top || 0) + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← 戻る</Text>
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.headerEyebrow}>PIT ENTRY</Text>
          <Text style={styles.title}>手動入力</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      {/* 種目選択 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.panelEyebrow}>LOAD PRESET</Text>
            <Text style={styles.sectionTitle}>種目一括変更</Text>
            <Text style={styles.sectionHint}>クイック選択は全セットへ反映します。個別変更は各セットカードから行えます。</Text>
          </View>
        </View>
        {draftSourceLabel && (
          <View style={styles.draftBanner}>
            <Text style={styles.draftBannerText}>{draftSourceLabel} から下書きを読み込みました</Text>
          </View>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.exerciseScroll}>
          {quickExercises.map((ex) => (
            <TouchableOpacity
              key={ex.id}
              style={[styles.exerciseButton, exercise === ex.name && styles.exerciseButtonActive]}
              onPress={() => {
                applyExerciseToAll(ex.name);
              }}
            >
              <Text style={[styles.exerciseButtonText, exercise === ex.name && styles.exerciseButtonTextActive]}>
                {getLocalizedExerciseName(ex.name)}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.exerciseButton, styles.moreButton]}
            onPress={() => openExercisePicker(null)}
          >
            <Text style={styles.moreButtonText}>すべて見る...</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ExerciseSelectModal
        visible={isModalVisible}
        onClose={closeExercisePicker}
        onSelect={(ex) => {
          if (editingSetIndex === null) {
            applyExerciseToAll(ex.name);
          } else {
            updateSetExercise(editingSetIndex, ex.name);
          }
          closeExercisePicker();
        }}
      />

      {/* セット入力 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.panelEyebrow}>RUN SHEET</Text>
            <Text style={styles.sectionTitle}>セット</Text>
          </View>
          <TouchableOpacity onPress={addSet} style={styles.addButton}>
            <Text style={styles.addButtonText}>+ セット追加</Text>
          </TouchableOpacity>
        </View>

        {sets.map((set, index) => {
          // 速度が入力されている場合はゾーンを表示
          const vel = NaN; // 平均速度項目は削除済み
          const zone = null;

          return (
            <View key={index} style={styles.setCard}>
              <View style={styles.setCardHeader}>
                <View>
                  <Text style={styles.setNumber}>セット {index + 1}</Text>
                  <TouchableOpacity style={styles.setExerciseButton} onPress={() => openExercisePicker(index)}>
                    <Text style={styles.setExerciseButtonText}>{getLocalizedExerciseName(set.exercise)}</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.setCardActions}>
                  <TouchableOpacity style={styles.changeExerciseLink} onPress={() => openExercisePicker(index)}>
                    <Text style={styles.changeExerciseLinkText}>種目変更</Text>
                  </TouchableOpacity>
                  {sets.length > 1 && (
                    <TouchableOpacity onPress={() => removeSet(index)}>
                      <Text style={styles.removeButton}>削除</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <View style={styles.inputGrid}>
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>負荷 (kg)</Text>
                  <TextInput
                    style={styles.input}
                    value={set.loadKg}
                    onChangeText={(value) => updateSet(index, 'loadKg', value)}
                    placeholder="0"
                    placeholderTextColor="#666"
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>回数</Text>
                  <TextInput
                    style={styles.input}
                    value={set.reps}
                    onChangeText={(value) => updateSet(index, 'reps', value)}
                    placeholder="5"
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>RPE (1-10)</Text>
                  <TextInput
                    style={styles.input}
                    value={set.rpe}
                    onChangeText={(value) => updateSet(index, 'rpe', value)}
                    placeholder="8"
                    placeholderTextColor="#666"
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              {/* 入力済みの場合は概算ボリュームを表示 */}
              {set.loadKg && set.reps && (
                <Text style={styles.volumeText}>
                  ボリューム: {(parseFloat(set.loadKg) * parseInt(set.reps)).toFixed(0)} kg
                </Text>
              )}
            </View>
          );
        })}
      </View>

      {/* 保存ボタン */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.saveButton} onPress={saveSession} disabled={saving}>
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>💾 保存して終了</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080808' },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#341810',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#090909',
  },
  backButton: { padding: 8 },
  backButtonText: { color: '#ffb347', fontSize: 15, fontWeight: '700', letterSpacing: 0.6 },
  headerCopy: { alignItems: 'center', gap: 4 },
  headerEyebrow: { color: '#ff6a2a', fontSize: 10, fontWeight: '800', letterSpacing: 2 },
  title: { fontSize: 22, fontWeight: '800', color: '#fff5ee' },
  placeholder: { width: 50 },
  section: { padding: 16 },
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  panelEyebrow: { fontSize: 10, color: '#ff6a2a', fontWeight: '800', letterSpacing: 2, marginBottom: 6 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#fff5ee' },
  sectionHint: { fontSize: 12, color: '#b7a69b', marginTop: 4, maxWidth: 300, lineHeight: 17 },
  addButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#ff5a1f',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#ff7a44',
  },
  addButtonText: { color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 0.6 },
  draftBanner: {
    backgroundColor: '#2a1612',
    borderWidth: 1,
    borderColor: '#5a2b1c',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    marginBottom: 12,
  },
  draftBannerText: { color: '#ffd5af', fontSize: 13, fontWeight: '700' },
  exerciseScroll: { flexDirection: 'row' },
  exerciseButton: {
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#141414', borderRadius: 999, marginRight: 8, borderWidth: 1, borderColor: '#3b2218',
  },
  exerciseButtonActive: { backgroundColor: '#ff5a1f', borderColor: '#ff7a44' },
  exerciseButtonText: { color: '#b8a79b', fontSize: 13, fontWeight: '700' },
  exerciseButtonTextActive: { color: '#fff', fontWeight: '800' },
  moreButton: {
    backgroundColor: '#201713',
    borderWidth: 1,
    borderColor: '#5a2b1c',
  },
  moreButtonText: {
    color: '#ffb347',
    fontSize: 13,
    fontWeight: '800',
  },
  setCard: {
    backgroundColor: '#111111',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#432117',
    shadowColor: '#ff5a1f',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  setCardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  setCardActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  setNumber: { fontSize: 16, fontWeight: '800', color: '#fff5ee' },
  setExerciseButton: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#241813',
    borderRadius: 999,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#5a2b1c',
  },
  setExerciseButtonText: {
    color: '#ffcf96',
    fontSize: 13,
    fontWeight: '800',
  },
  changeExerciseLink: {
    paddingVertical: 4,
  },
  changeExerciseLinkText: {
    color: '#ffb347',
    fontSize: 12,
    fontWeight: '800',
  },
  zoneTag: { fontSize: 14, fontWeight: '600' },
  removeButton: { color: '#ff7a44', fontSize: 14, fontWeight: '700' },
  inputGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  inputWrapper: { width: '48%', marginHorizontal: '1%', marginBottom: 12 },
  inputLabel: { fontSize: 12, color: '#b8a79b', marginBottom: 4, fontWeight: '700' },
  input: {
    backgroundColor: '#181818',
    borderRadius: 12,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#3f2117',
  },
  volumeText: { fontSize: 13, color: '#ffb347', textAlign: 'right', marginTop: 4, fontWeight: '700' },
  buttonContainer: { padding: 16, paddingBottom: 40 },
  saveButton: {
    backgroundColor: '#ff5a1f', padding: 16, borderRadius: 18,
    alignItems: 'center', minHeight: 56, justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ff7a44',
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
});
