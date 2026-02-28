/**
 * Monitor Screen
 * Real-time VBT monitoring during workout
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import BLEService from '../services/BLEService';
import DatabaseService from '../services/DatabaseService';
import VBTCalculations from '../utils/VBTCalculations';
import { useTrainingStore } from '../store/trainingStore';
import { RepVeloData, RepData } from '../types/index';

interface MonitorScreenProps {
  navigation: any;
}

const MonitorScreen: React.FC<MonitorScreenProps> = ({ navigation }) => {
  const { currentSession, currentExercise, currentLoad, settings } = useTrainingStore();

  const [currentSet, setCurrentSet] = useState(1);
  const [currentRep, setCurrentRep] = useState(0);
  const [liveData, setLiveData] = useState<RepVeloData | null>(null);
  const [repData, setRepData] = useState<RepData[]>([]);
  const [velocityLoss, setVelocityLoss] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  // stale closureバグを防ぐためuseRefで最新の値を保持
  const isRecordingRef = useRef(false);

  useEffect(() => {
    setupBLECallbacks();
    return () => {
      BLEService.stopNotifications();
    };
  }, []);

  useEffect(() => {
    if (repData.length > 0) {
      const vl = VBTCalculations.calculateVelocityLoss(repData);
      setVelocityLoss(vl);
    }
  }, [repData]);

  const setupBLECallbacks = () => {
    BLEService.setCallbacks({
      onDataReceived: (data: RepVeloData) => {
        setLiveData(data);
        // useRefで最新値を参照してstale closureバグを回避
        if (isRecordingRef.current) {
          handleNewRep(data);
        }
      },
      onError: (error) => {
        Alert.alert('BLEエラー', error);
      },
    });
  };

  const handleNewRep = (data: RepVeloData) => {
    const sessionId = currentSession?.session_id || 'offline';
    const liftName = currentExercise?.name || 'Unknown';
    const loadKg = currentLoad || 0;

    const newRep: RepData = {
      session_id: sessionId,
      lift: liftName,
      set_index: currentSet,
      rep_index: currentRep + 1,
      load_kg: loadKg,
      device_type: 'VBT',
      mean_velocity: data.mean_velocity,
      peak_velocity: data.peak_velocity,
      rom_cm: data.rom_cm,
      mean_power_w: data.mean_power_w || null,
      rep_duration_ms: data.rep_duration_ms,
      is_valid_rep: true,
      set_type: 'normal',
      timestamp: new Date().toISOString(),
    };

    setRepData((prev) => [...prev, newRep]);
    setCurrentRep((prev) => prev + 1);
  };

  const handleStartRecording = async () => {
    try {
      const connected = await BLEService.isConnected();
      if (!connected) {
        Alert.alert('エラー', 'BLEデバイスに接続してください');
        return;
      }

      await BLEService.startNotifications();
      isRecordingRef.current = true;  // refも更新
      setIsRecording(true);
      setRepData([]);
      setCurrentRep(0);
    } catch (error) {
      Alert.alert('エラー', '記録の開始に失敗しました');
    }
  };

  const handleStopRecording = () => {
    isRecordingRef.current = false;  // refも更新
    setIsRecording(false);
  };

  const handleFinishSet = async () => {
    if (repData.length === 0) {
      Alert.alert('エラー', 'まずレップを記録してください');
      return;
    }

    try {
      // Save reps to database
      for (const rep of repData) {
        await DatabaseService.insertRep(rep);
      }

      Alert.alert('成功', `セット ${currentSet} を保存しました`);

      // Move to next set
      setCurrentSet((prev) => prev + 1);
      setRepData([]);
      setCurrentRep(0);
      setVelocityLoss(null);
      setIsRecording(false);
    } catch (error) {
      Alert.alert('エラー', 'セットの保存に失敗しました');
    }
  };

  const getVelocityColor = (velocity: number | null): string => {
    if (!velocity) return '#999';
    if (velocity >= 1.0) return '#FFD700'; // Power
    if (velocity >= 0.75) return '#FF8C00'; // Strength-Speed
    if (velocity >= 0.5) return '#32CD32'; // Hypertrophy
    return '#DC143C'; // Strength
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.title}>VBT モニター</Text>
      </View>

      <View style={styles.setInfo}>
        <Text style={styles.setLabel}>セット {currentSet}</Text>
        <Text style={styles.repLabel}>レップ {currentRep}</Text>
      </View>

      {liveData && (
        <View style={styles.velocityDisplay}>
          <Text style={styles.velocityLabel}>Mean Velocity</Text>
          <Text
            style={[
              styles.velocityValue,
              { color: getVelocityColor(liveData.mean_velocity) },
            ]}
          >
            {liveData.mean_velocity.toFixed(2)} m/s
          </Text>
          <Text style={styles.peakLabel}>
            Peak Velocity: {liveData.peak_velocity.toFixed(2)} m/s
          </Text>
          <View style={styles.subStats}>
            <View style={styles.subStatItem}>
              <Text style={styles.subStatLabel}>ROM</Text>
              <Text style={styles.subStatValue}>{liveData.rom_cm.toFixed(1)} cm</Text>
            </View>
            <View style={styles.subStatItem}>
              <Text style={styles.subStatLabel}>Power</Text>
              <Text style={styles.subStatValue}>{liveData.mean_power_w?.toFixed(0) || '0'} W</Text>
            </View>
          </View>
        </View>
      )}

      {velocityLoss !== null && (
        <View style={styles.vlCard}>
          <Text style={styles.vlLabel}>Velocity Loss</Text>
          <Text
            style={[
              styles.vlValue,
              { color: velocityLoss > settings.velocity_loss_threshold ? '#F44336' : '#4CAF50' },
            ]}
          >
            {velocityLoss.toFixed(1)}%
          </Text>
          {velocityLoss > settings.velocity_loss_threshold && (
            <Text style={styles.vlWarning}>
              閾値({settings.velocity_loss_threshold}%)超過 — セットを終了することをお勧めします
            </Text>
          )}
        </View>
      )}

      <View style={styles.buttonContainer}>
        {!isRecording ? (
          <TouchableOpacity
            style={[styles.button, styles.startButton]}
            onPress={handleStartRecording}
          >
            <Text style={styles.buttonText}>記録開始</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.stopButton]}
            onPress={handleStopRecording}
          >
            <Text style={styles.buttonText}>記録停止</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.button, styles.finishButton]}
          onPress={handleFinishSet}
          disabled={repData.length === 0}
        >
          <Text style={styles.buttonText}>セット完了</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.repList}>
        <Text style={styles.repListTitle}>レップ履歴</Text>
        {repData.length === 0 ? (
          <Text style={styles.emptyText}>まだレップがありません</Text>
        ) : (
          repData.map((rep, index) => (
            <View key={index} style={styles.repItem}>
              <Text style={styles.repNumber}>Rep {index + 1}</Text>
              <Text style={styles.repVelocity}>
                {rep.mean_velocity?.toFixed(2)} m/s
              </Text>
            </View>
          ))
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
  setInfo: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#2a2a2a',
    margin: 16,
    borderRadius: 12,
  },
  setLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  repLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
  },
  velocityDisplay: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    margin: 16,
    borderRadius: 12,
  },
  velocityLabel: {
    fontSize: 16,
    color: '#999',
    marginBottom: 8,
  },
  velocityValue: {
    fontSize: 64,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  peakLabel: {
    fontSize: 16,
    color: '#ddd',
    marginVertical: 4,
  },
  subStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#444',
    paddingTop: 16,
  },
  subStatItem: {
    alignItems: 'center',
  },
  subStatLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  subStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  vlCard: {
    padding: 16,
    backgroundColor: '#2a2a2a',
    margin: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  vlLabel: {
    fontSize: 16,
    color: '#999',
    marginBottom: 8,
  },
  vlValue: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  vlWarning: {
    fontSize: 14,
    color: '#F44336',
    textAlign: 'center',
  },
  buttonContainer: {
    padding: 16,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  startButton: {
    backgroundColor: '#4CAF50',
  },
  stopButton: {
    backgroundColor: '#F44336',
  },
  finishButton: {
    backgroundColor: '#2196F3',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  repList: {
    padding: 16,
  },
  repListTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 24,
  },
  repItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    marginBottom: 8,
  },
  repNumber: {
    fontSize: 16,
    color: '#fff',
  },
  repVelocity: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
});

export default MonitorScreen;
