/**
 * Home Screen
 * VBTトレーニングのメインダッシュボード
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import BLEService from '@/src/services/BLEService';
import DatabaseService from '@/src/services/DatabaseService';
import type { SessionData } from '@/src/types/index';
import type { Device } from 'react-native-ble-plx';

export default function HomeScreen() {
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [recentSessions, setRecentSessions] = useState<SessionData[]>([]);
  const [foundDevice, setFoundDevice] = useState<any>(null);
  const [discoveredDevices, setDiscoveredDevices] = useState<Device[]>([]);

  useEffect(() => {
    initializeApp();
    loadRecentSessions();
  }, []);

  const initializeApp = async () => {
    try {
      await DatabaseService.initialize();

      // BLE初期化
      const bleInitialized = await BLEService.initialize();
      if (!bleInitialized) {
        Alert.alert('BLEエラー', 'Bluetoothをオンにしてください');
      }

      BLEService.setCallbacks({
        onConnectionStatusChanged: (connected) => {
          setIsConnected(connected);
          if (!connected) {
            setFoundDevice(null);
          }
        },
        onError: (error) => {
          console.error('BLE Error:', error);
        },
        onDeviceFound: (device: Device) => {
          console.log('OVR Device found:', device.name, device.id);
          setFoundDevice(device);
          setIsScanning(false);
          // 自動接続
          connectToDevice(device);
        },
        onDevicesDiscovered: (devices: Device[]) => {
          console.log('Discovered devices:', devices.length);
          setDiscoveredDevices(devices);
        },
      });
    } catch (error) {
      console.error('Init error:', error);
    }
  };

  const loadRecentSessions = async () => {
    try {
      const sessions = await DatabaseService.getSessions();
      setRecentSessions(sessions.slice(0, 5));
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const connectToDevice = async (device: any) => {
    try {
      const connected = await BLEService.connectToDevice(device);
      if (connected) {
        await BLEService.startNotifications();
        Alert.alert('接続成功', `${device.name}に接続しました`);
      }
    } catch (error) {
      Alert.alert('接続エラー', 'デバイスへの接続に失敗しました');
    }
  };

  const handleConnectBLE = async () => {
    setIsScanning(true);
    setFoundDevice(null);
    setDiscoveredDevices([]);
    try {
      await BLEService.scanForDevices();
    } catch (error) {
      setIsScanning(false);
      Alert.alert('BLE接続エラー', 'デバイスのスキャンに失敗しました');
    }
  };

  const handleSelectDevice = async (device: Device) => {
    setIsScanning(false);
    setDiscoveredDevices([]);
    await connectToDevice(device);
  };

  const handleDisconnect = async () => {
    try {
      await BLEService.disconnect();
      setFoundDevice(null);
      Alert.alert('切断', 'デバイスを切断しました');
    } catch (error) {
      Alert.alert('切断エラー', 'デバイスの切断に失敗しました');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>OVR VBT Coach</Text>
        <Text style={styles.subtitle}>Velocity-Based Training</Text>
      </View>

      {/* BLE接続ステータス */}
      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>BLE接続状態</Text>
          <View
            style={[
              styles.statusIndicator,
              { backgroundColor: isConnected ? '#4CAF50' : '#F44336' },
            ]}
          />
          <Text style={styles.statusText}>
            {isScanning ? 'スキャン中...' : isConnected ? '接続済み' : '未接続'}
          </Text>
        </View>
        {foundDevice && (
          <Text style={styles.deviceName}>デバイス: {foundDevice.name}</Text>
        )}
      </View>

      {/* BLE操作ボタン */}
      <View style={styles.buttonContainer}>
        {isScanning ? (
          <View style={styles.button}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.buttonText}>スキャン中...</Text>
          </View>
        ) : !isConnected ? (
          <TouchableOpacity style={styles.button} onPress={handleConnectBLE}>
            <Text style={styles.buttonText}>BLEデバイスに接続</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.disconnectButton]}
            onPress={handleDisconnect}
          >
            <Text style={styles.buttonText}>切断</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 発見したデバイス一覧（デバッグ用） */}
      {isScanning && discoveredDevices.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            発見したデバイス ({discoveredDevices.length})
          </Text>
          {discoveredDevices.map((device) => (
            <TouchableOpacity
              key={device.id}
              style={styles.deviceCard}
              onPress={() => handleSelectDevice(device)}
            >
              <Text style={styles.deviceCardName}>
                {device.name || '(名前なし)'}
              </Text>
              <Text style={styles.deviceCardId}>{device.id}</Text>
              <Text style={styles.deviceCardRssi}>RSSI: {device.rssi || 'N/A'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* スキャン完了でデバイスなし */}
      {!isScanning && discoveredDevices.length > 0 && !isConnected && !foundDevice && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>デバイスを選択してください</Text>
          {discoveredDevices.map((device) => (
            <TouchableOpacity
              key={device.id}
              style={styles.deviceCard}
              onPress={() => handleSelectDevice(device)}
            >
              <Text style={styles.deviceCardName}>
                {device.name || '(名前なし)'}
              </Text>
              <Text style={styles.deviceCardId}>{device.id}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* メインメニュー */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>トレーニング</Text>

        <TouchableOpacity
          style={[styles.menuButton, styles.sessionButton]}
          onPress={() => router.push('/(tabs)/session')}
        >
          <Text style={styles.menuButtonText}>VBTセッション開始</Text>
          <Text style={styles.menuButtonSub}>速度ベストレーニング</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuButton, styles.manualButton]}
          onPress={() => router.push('/(tabs)/manual')}
        >
          <Text style={styles.menuButtonText}>手動入力</Text>
          <Text style={styles.menuButtonSub}>データを手動で記録</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuButton, styles.graphButton]}
          onPress={() => router.push('/(tabs)/graph')}
        >
          <Text style={styles.menuButtonText}>LVPグラフ</Text>
          <Text style={styles.menuButtonSub}>負荷-速度プロファイル</Text>
        </TouchableOpacity>
      </View>

      {/* 最近のセッション */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>最近のセッション</Text>
        {recentSessions.length === 0 ? (
          <Text style={styles.emptyText}>まだセッションがありません</Text>
        ) : (
          recentSessions.map((session) => (
            <TouchableOpacity
              key={session.session_id}
              style={styles.sessionCard}
              onPress={() => router.push(`/(tabs)/session/${session.session_id}`)}
            >
              <Text style={styles.sessionDate}>{session.date}</Text>
              <Text style={styles.sessionInfo}>
                {session.total_sets} セット | {Math.round(session.total_volume)} kg
              </Text>
            </TouchableOpacity>
          ))
        )}
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
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#999',
  },
  statusCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 16,
    color: '#fff',
    flex: 1,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#fff',
  },
  deviceName: {
    fontSize: 14,
    color: '#4CAF50',
    marginTop: 8,
  },
  buttonContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  button: {
    backgroundColor: '#444',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  disconnectButton: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  menuButton: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  sessionButton: {
    backgroundColor: '#2196F3',
  },
  manualButton: {
    backgroundColor: '#FF9800',
  },
  graphButton: {
    backgroundColor: '#9C27B0',
  },
  menuButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  menuButtonSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 24,
  },
  sessionCard: {
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  sessionDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  sessionInfo: {
    fontSize: 14,
    color: '#999',
  },
  deviceCard: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#444',
  },
  deviceCardName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2196F3',
    marginBottom: 4,
  },
  deviceCardId: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  deviceCardRssi: {
    fontSize: 12,
    color: '#999',
  },
});
