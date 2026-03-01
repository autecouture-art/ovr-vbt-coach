/**
 * VBT Session Screen
 * Refactored to use useSessionLogic and trainingStore
 * UI is now a "Dumb Component" driven by global state
 */

import React, { useState, useEffect } from 'react';
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
import { useTrainingStore } from '@/src/store/trainingStore';
import { useSessionLogic } from '@/src/hooks/useSessionLogic';
import { ExerciseSelectModal } from '@/src/components/ExerciseSelectModal';
import PRNotification from '@/src/components/PRNotification';
import DatabaseService from '@/src/services/DatabaseService';
import AICoachService from '@/src/services/AICoachService';
import type { Exercise, PRRecord } from '@/src/types/index';

export default function SessionScreen() {
  const router = useRouter();

  // PR検知時のモーダル状態
  const [prRecord, setPRRecord] = useState<PRRecord | null>(null);
  const [showPRModal, setShowPRModal] = useState(false);

  // Custom Hook for Logic（PR検知コールバックを渡す）
  const { finishSet } = useSessionLogic((pr: PRRecord) => {
    setPRRecord(pr);
    setShowPRModal(true);
  });

  // Global State
  const {
    currentSetIndex,
    isConnected,
    liveData,
    currentExercise,
    currentLoad,
    currentReps,
    setHistory,
    currentSession,
    isSessionActive,
    sessionStartTime,
    updateLoad,
    setCurrentExercise,
    startSession,
    endSession,
  } = useTrainingStore();

  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [inputLoad, setInputLoad] = useState('');

  // Sync input with store
  useEffect(() => {
    setInputLoad(currentLoad.toString());
  }, [currentLoad]);

  const handleLoadChange = (text: string) => {
    setInputLoad(text);
    const val = parseFloat(text);
    if (!isNaN(val)) updateLoad(val);
  };

  const handleExerciseSelect = (exercise: Exercise) => {
    setCurrentExercise(exercise);
  };

  // セッション開始処理
  const handleStartSession = async () => {
    if (!isConnected) {
      Alert.alert('センサー未接続', 'BLEセンサーを接続してからセッションを開始してください。');
      return;
    }
    // UUID風のセッションIDを生成
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    startSession(sessionId);
    // DBにセッションレコードを作成
    try {
      await DatabaseService.insertSession({
        session_id: sessionId,
        date: new Date().toISOString().split('T')[0],
        total_volume: 0,
        total_sets: 0,
        lifts: [],
      });
    } catch (e) {
      console.error('セッション作成失敗:', e);
    }
  };

  const handleFinishSet = () => {
    if (!isSessionActive) {
      Alert.alert('セッション未開始', 'まずセッションを開始してください。');
      return;
    }
    finishSet();
  };

  // セッション終了 & DBへの集計保存
  const handleFinishSession = async () => {
    if (setHistory.length === 0) {
      Alert.alert('セッション終了', 'セットが記録されていません。終了しますか？', [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '終了', style: 'destructive', onPress: () => {
            endSession();
            router.back();
          }
        },
      ]);
      return;
    }

    // セッション集計をDBに更新
    if (currentSession?.session_id) {
      try {
        const totalVolume = setHistory.reduce((sum, s) => sum + (s.load_kg * s.reps), 0);
        const durationMs = sessionStartTime ? Date.now() - sessionStartTime : 0;
        const durationMin = Math.round(durationMs / 60000);
        const lifts = [...new Set(setHistory.map(s => s.lift))];

        await DatabaseService.insertSession({
          session_id: currentSession.session_id + '_summary',
          date: new Date().toISOString().split('T')[0],
          total_volume: totalVolume,
          total_sets: setHistory.length,
          duration_minutes: durationMin,
          lifts,
        });
      } catch (e) {
        console.error('セッション集計の保存に失敗:', e);
      }
    }

    endSession();
    Alert.alert('セッション完了', `${setHistory.length}セットを保存しました。`, [
      { text: 'OK', onPress: () => router.back() }
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.title}>セッション</Text>
        {/* AIコーチボタン */}
        <TouchableOpacity
          style={styles.coachNavButton}
          onPress={() => router.push('/coach-chat' as any)}
        >
          <Text style={styles.coachNavButtonText}>🤖 AI</Text>
        </TouchableOpacity>
      </View>

      {/* Connection Status */}
      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isConnected ? '#4CAF50' : '#F44336' },
            ]}
          />
          <Text style={styles.statusText}>
            {isConnected ? 'センサー接続中' : 'センサー未接続'}
          </Text>
        </View>
      </View>

      {/* セッション開始バナー */}
      {!isSessionActive ? (
        <View style={styles.sessionStartBanner}>
          <Text style={styles.sessionStartText}>セッションを開始してください</Text>
          <TouchableOpacity
            style={[styles.button, styles.startSessionButton]}
            onPress={handleStartSession}
          >
            <Text style={styles.buttonText}>🏋️ セッション開始</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.sessionActiveBanner}>
          <Text style={styles.sessionActiveText}>
            ✅ セット {currentSetIndex} 記録中
          </Text>
        </View>
      )}

      {/* Exercise Selection */}
      <View style={styles.exerciseCard}>
        <Text style={styles.exerciseLabel}>Exercise</Text>
        {currentExercise ? (
          <TouchableOpacity
            style={styles.exerciseSelector}
            onPress={() => setShowExerciseModal(true)}
          >
            <View style={styles.exerciseInfo}>
              <Text style={styles.exerciseName}>{currentExercise.name}</Text>
              <Text style={styles.exerciseCategory}>
                {currentExercise.category}
              </Text>
            </View>
            <Text style={styles.exerciseChange}>Change</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.exerciseSelectButton}
            onPress={() => setShowExerciseModal(true)}
          >
            <Text style={styles.exerciseSelectButtonText}>Select Exercise</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Set Configuration */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Set Configuration</Text>
        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>Load (kg)</Text>
          <TextInput
            style={styles.input}
            value={inputLoad}
            onChangeText={handleLoadChange}
            placeholder="0"
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* Live データ表示 */}
      <View style={styles.dataCard}>
        <Text style={styles.dataTitle}>Live Data</Text>
        {liveData ? (
          <>
            {/* 速度ゾーンバッジ */}
            {(() => {
              const zone = AICoachService.getZone(liveData.mean_velocity);
              return (
                <View style={[styles.zoneBadge, { borderColor: zone.color }]}>
                  <Text style={styles.zoneEmoji}>{zone.emoji}</Text>
                  <Text style={[styles.zoneName, { color: zone.color }]}>{zone.name}ゾーン</Text>
                </View>
              );
            })()}
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Mean Velocity</Text>
              <Text style={[styles.dataValue, {
                color: AICoachService.getZone(liveData.mean_velocity).color
              }]}>
                {liveData.mean_velocity.toFixed(2)} m/s
              </Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Peak Velocity</Text>
              <Text style={styles.dataValue}>
                {liveData.peak_velocity.toFixed(2)} m/s
              </Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>ROM</Text>
              <Text style={styles.dataValue}>{liveData.rom_cm.toFixed(0)} cm</Text>
            </View>
          </>
        ) : (
          <Text style={styles.noDataText}>Waiting for rep...</Text>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.recordButton]}
          onPress={handleFinishSet}
        >
          <Text style={styles.buttonText}>Finish Set</Text>
        </TouchableOpacity>
      </View>

      {/* AIコーチアドバイスカード */}
      {setHistory.length > 0 && (() => {
        const advice = AICoachService.getCoachingAdvice(
          setHistory, currentSetIndex, undefined
        );
        const colorMap = {
          info: '#2196F3',
          success: '#4CAF50',
          warning: '#FF9800',
          alert: '#F44336',
        };
        return (
          <View style={[styles.coachCard, { borderColor: colorMap[advice.severity] }]}>
            <Text style={styles.coachEmoji}>{advice.emoji}</Text>
            <View style={styles.coachContent}>
              <Text style={[styles.coachMessage, { color: colorMap[advice.severity] }]}>
                {advice.message}
              </Text>
              {advice.suggestedAction && (
                <Text style={styles.coachAction}>{advice.suggestedAction}</Text>
              )}
            </View>
          </View>
        );
      })()}

      {/* セッション履歴 */}
      {setHistory.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Session History</Text>
          {setHistory.map((set, idx) => {
            const zone = set.avg_velocity ? AICoachService.getZone(set.avg_velocity) : null;
            return (
              <View key={idx} style={styles.setCard}>
                <View style={styles.setHeader}>
                  <Text style={styles.setNumberText}>Set {set.set_index}</Text>
                  <Text style={styles.setLoad}>{set.load_kg} kg × {set.reps}</Text>
                  {zone && <Text style={{ color: zone.color, fontSize: 14 }}>{zone.emoji}</Text>}
                </View>
                <Text style={[styles.setVelocity, zone ? { color: zone.color } : {}]}>
                  Avg Vel: {set.avg_velocity?.toFixed(2)} m/s
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* End Session */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.finishButton]}
          onPress={handleFinishSession}
        >
          <Text style={styles.buttonText}>End Session</Text>
        </TouchableOpacity>
      </View>

      {/* エクササイズ選択モーダル */}
      <ExerciseSelectModal
        visible={showExerciseModal}
        onClose={() => setShowExerciseModal(false)}
        onSelect={handleExerciseSelect}
        currentExerciseId={currentExercise?.id}
      />

      {/* PR達成通知モーダル */}
      <PRNotification
        visible={showPRModal}
        prRecord={prRecord}
        onClose={() => setShowPRModal(false)}
      />
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
  setNumber: {
    fontSize: 16,
    color: '#999',
  },
  statusCard: {
    margin: 16,
    padding: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#fff',
  },
  exerciseCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
  },
  exerciseLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
  },
  exerciseSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  exerciseCategory: {
    fontSize: 14,
    color: '#999',
    marginTop: 2,
  },
  exerciseChange: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: 'bold',
  },
  exerciseSelectButton: {
    padding: 12,
    backgroundColor: '#333',
    borderRadius: 8,
    alignItems: 'center',
  },
  exerciseSelectButtonText: {
    color: '#2196F3',
    fontSize: 16,
  },
  section: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 16,
    color: '#fff',
  },
  input: {
    fontSize: 16,
    color: '#fff',
    backgroundColor: '#3a3a3a',
    padding: 8,
    borderRadius: 4,
    minWidth: 80,
    textAlign: 'center',
  },
  dataCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#4CAF50',
    minHeight: 120,
    justifyContent: 'center',
  },
  dataTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 12,
    textAlign: 'center',
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  dataLabel: {
    fontSize: 16,
    color: '#999',
  },
  dataValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  noDataText: {
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  buttonContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  recordButton: {
    backgroundColor: '#4CAF50',
  },
  finishButton: {
    backgroundColor: '#FF9800',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  setCard: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  setHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  setNumberText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  setLoad: {
    fontSize: 14,
    color: '#2196F3',
  },
  setVelocity: {
    fontSize: 14,
    color: '#4CAF50',
  },
  // セッション開始/アクティブバナー
  sessionStartBanner: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    backgroundColor: '#1a2a1a',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#FF9800',
    alignItems: 'center',
  },
  sessionStartText: {
    fontSize: 16,
    color: '#FF9800',
    marginBottom: 12,
    fontWeight: '600',
  },
  startSessionButton: {
    backgroundColor: '#FF9800',
    width: '100%',
  },
  sessionActiveBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 12,
    backgroundColor: '#1a2a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4CAF50',
    alignItems: 'center',
  },
  sessionActiveText: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: '600',
  },
  // 速度ゾーンバッジ
  zoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 2,
    marginBottom: 12,
    backgroundColor: '#1a1a1a',
    gap: 8,
  },
  zoneEmoji: { fontSize: 22 },
  zoneName: { fontSize: 16, fontWeight: 'bold' },
  // AIコーチカード
  coachCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#1e1e2e',
    borderRadius: 12,
    borderWidth: 2,
    gap: 12,
  },
  coachEmoji: { fontSize: 28, lineHeight: 32 },
  coachContent: { flex: 1 },
  coachMessage: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  coachAction: { fontSize: 13, color: '#bbb', lineHeight: 18 },
  // AIコーチボタン（ヘッダー）
  coachNavButton: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: '#1565C0', borderRadius: 16,
    borderWidth: 1, borderColor: '#2196F3',
  },
  coachNavButtonText: { color: '#2196F3', fontSize: 14, fontWeight: '600' },
});



