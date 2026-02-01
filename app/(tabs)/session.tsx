/**
 * VBT Session Screen
 * 速度ベストレーニングセッション画面
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import BLEService from '@/src/services/BLEService';
import DatabaseService from '@/src/services/DatabaseService';
import type { OVRData } from '@/src/types/index';

export default function SessionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const [isConnected, setIsConnected] = useState(false);
  const [liveData, setLiveData] = useState<OVRData | null>(null);
  const [loadKg, setLoadKg] = useState('');
  const [reps, setReps] = useState('5');
  const [setHistory, setSetHistory] = useState<Array<{
    setNumber: number;
    loadKg: number;
    avgVelocity: number;
    peakVelocity: number;
    reps: number;
  }>>([]);
  const [currentSetNumber, setCurrentSetNumber] = useState(1);
  const [isRecording, setIsRecording] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  useEffect(() => {
    // BLEコールバック設定
    BLEService.setCallbacks({
      onDataReceived: (data: OVRData) => {
        setLiveData(data);
        addDebugLog(`データ受信: ${data.mean_velocity.toFixed(2)} m/s`);
      },
      onConnectionStatusChanged: (connected) => {
        setIsConnected(connected);
        if (!connected) {
          setIsRecording(false);
        }
      },
      onError: (error) => {
        addDebugLog(`エラー: ${error}`);
      },
      onDebugInfo: (info: string) => {
        addDebugLog(info);
      },
    });

    // 接続状態チェック
    BLEService.isConnected().then(setIsConnected);
  }, []);

  const addDebugLog = (log: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [`[${timestamp}] ${log}`, ...prev].slice(0, 10));
  };

  const startRecording = async () => {
    if (!isConnected) {
      Alert.alert('エラー', 'BLEデバイスに接続してください');
      return;
    }

    addDebugLog('計測開始...');
    setIsRecording(true);
    setLiveData(null);

    // 通知監視を開始
    const started = await BLEService.startNotifications();
    if (!started) {
      addDebugLog('通知開始失敗');
      Alert.alert('エラー', 'データ受信を開始できませんでした');
      setIsRecording(false);
    } else {
      addDebugLog('通知監視開始成功');
    }
  };

  const stopRecording = () => {
    if (!liveData) {
      Alert.alert('エラー', 'データが受信されていません');
      return;
    }
    setIsRecording(false);

    const load = parseFloat(loadKg) || 0;
    const repCount = parseInt(reps) || 5;

    // セットを記録
    const newSet = {
      setNumber: currentSetNumber,
      loadKg: load,
      avgVelocity: liveData.mean_velocity,
      peakVelocity: liveData.peak_velocity,
      reps: repCount,
    };

    setSetHistory([...setHistory, newSet]);
    setCurrentSetNumber(currentSetNumber + 1);
    setLiveData(null);

    Alert.alert(
      'セット記録完了',
      `速度: ${liveData.mean_velocity.toFixed(2)} m/s`,
      [
        { text: 'OK', onPress: () => {} },
      ]
    );
  };

  const finishSession = async () => {
    if (setHistory.length === 0) {
      Alert.alert('確認', '記録されたセットがありません。終了しますか？', [
        { text: 'キャンセル', style: 'cancel' },
        { text: '終了', style: 'destructive', onPress: () => router.back() },
      ]);
      return;
    }

    try {
      // TODO: DatabaseServiceでセッションを保存
      Alert.alert('セッション完了', `${setHistory.length}セットを記録しました`, [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      Alert.alert('エラー', 'セッションの保存に失敗しました');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.title}>VBTセッション</Text>
        <Text style={styles.setNumber}>セット {currentSetNumber}</Text>
      </View>

      {/* 接続ステータス */}
      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isConnected ? '#4CAF50' : '#F44336' },
            ]}
          />
          <Text style={styles.statusText}>
            {isConnected ? 'BLE接続済み' : 'BLE未接続'}
          </Text>
        </View>
      </View>

      {/* 設定エリア */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>セット設定</Text>
        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>負荷 (kg)</Text>
          <TextInput
            style={styles.input}
            value={loadKg}
            onChangeText={setLoadKg}
            placeholder="0"
            keyboardType="numeric"
          />
        </View>
        <View style={styles.inputRow}>
          <Text style={styles.inputLabel}>回数</Text>
          <TextInput
            style={styles.input}
            value={reps}
            onChangeText={setReps}
            placeholder="5"
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* ライブデータ表示 */}
      {liveData && (
        <View style={styles.dataCard}>
          <Text style={styles.dataTitle}>ライブデータ</Text>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>平均速度</Text>
            <Text style={styles.dataValue}>
              {liveData.mean_velocity.toFixed(2)} m/s
            </Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>ピーク速度</Text>
            <Text style={styles.dataValue}>
              {liveData.peak_velocity.toFixed(2)} m/s
            </Text>
          </View>
          <View style={styles.dataRow}>
            <Text style={styles.dataLabel}>ROM</Text>
            <Text style={styles.dataValue}>{liveData.rom_cm.toFixed(0)} cm</Text>
          </View>
        </View>
      )}

      {/* デバッグログ */}
      {debugLogs.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>デバッグログ</Text>
            <TouchableOpacity onPress={() => setDebugLogs([])}>
              <Text style={styles.clearButton}>クリア</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.debugLogContainer}>
            {debugLogs.map((log, index) => (
              <Text key={index} style={styles.debugLogText}>{log}</Text>
            ))}
          </View>
        </View>
      )}

      {/* 録音ボタン */}
      <View style={styles.buttonContainer}>
        {!isRecording ? (
          <TouchableOpacity
            style={[styles.button, styles.recordButton]}
            onPress={startRecording}
          >
            <Text style={styles.buttonText}>計測開始</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.stopButton]}
            onPress={stopRecording}
          >
            <Text style={styles.buttonText}>計測停止</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* セット履歴 */}
      {setHistory.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>本日のセット</Text>
          {setHistory.map((set) => (
            <View key={set.setNumber} style={styles.setCard}>
              <View style={styles.setHeader}>
                <Text style={styles.setNumberText}>セット {set.setNumber}</Text>
                <Text style={styles.setLoad}>{set.loadKg} kg × {set.reps}</Text>
              </View>
              <Text style={styles.setVelocity}>
                平均速度: {set.avgVelocity.toFixed(2)} m/s
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* セッション終了ボタン */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.finishButton]}
          onPress={finishSession}
        >
          <Text style={styles.buttonText}>セッション終了</Text>
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
  stopButton: {
    backgroundColor: '#F44336',
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clearButton: {
    color: '#2196F3',
    fontSize: 14,
  },
  debugLogContainer: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    maxHeight: 200,
  },
  debugLogText: {
    fontSize: 11,
    color: '#999',
    fontFamily: 'monospace',
    marginBottom: 2,
  },
});
