/**
 * Home Screen
 * VBTトレーニングのメインダッシュボード
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';
import BLEService from '@/src/services/BLEService';
import type { SessionData } from '@/src/types/index';
import type { Device } from 'react-native-ble-plx';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [isConnected, setIsConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [recentSessions, setRecentSessions] = useState<SessionData[]>([]);
  const [foundDevice, setFoundDevice] = useState<any>(null);
  const [discoveredDevices, setDiscoveredDevices] = useState<Device[]>([]);
  const [isMockMode, setIsMockMode] = useState(false);
  const [lastDeviceInfo, setLastDeviceInfo] = useState<{ id: string | null, name: string | null }>({ id: null, name: null });
  const isConnectingRef = useRef(false);
  const discoveredSignatureRef = useRef('');
  const lastNavigateAtRef = useRef(0);
  const bleReadyRef = useRef(false);
  const isWeb = Platform.OS === 'web';
  const canUseSimulatorMock = __DEV__ && Platform.OS === 'ios';
  const dashboardStatus = isWeb ? 'WEB' : isScanning ? 'SCAN' : isConnected ? (isMockMode ? 'SIM' : 'LIVE') : 'STBY';
  const systemMode = isConnected ? (isMockMode ? 'SIM' : 'ARMED') : lastDeviceInfo.id ? 'HOT' : 'IDLE';

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = () => {
    BLEService.setCallbacks({
      onConnectionStatusChanged: (connected) => {
        setIsConnected(connected);
        setIsScanning(false);
        const deviceInfo = BLEService.getLastDeviceInfo();
        setLastDeviceInfo(deviceInfo);
        setIsMockMode(BLEService.isMockModeEnabled());
        if (connected) {
          setFoundDevice({ name: deviceInfo.name, id: deviceInfo.id });
        } else {
          setFoundDevice(null);
        }
      },
      onError: (error) => {
        console.error('BLE Error:', error);
      },
      onDeviceFound: (device: Device) => {
        if (isConnected || isConnectingRef.current) return;
        setFoundDevice(device);
        setIsScanning(false);
        void connectToDevice(device);
      },
      onDevicesDiscovered: (devices: Device[]) => {
        const signature = devices
          .map((d) => d.id)
          .sort()
          .join(',');
        if (signature === discoveredSignatureRef.current) return;
        discoveredSignatureRef.current = signature;
        setDiscoveredDevices([...devices]);
      },
      onScanStateChanged: (scanning) => {
        setIsScanning(scanning);
      },
    });
  };

  const ensureBleReady = async () => {
    if (isWeb) return false;
    if (bleReadyRef.current) return true;

    try {
      const bleInitialized = await BLEService.initialize();
      if (!bleInitialized) {
        Alert.alert('BLEエラー', 'Bluetoothをオンにしてください');
        return false;
      }
      bleReadyRef.current = true;
      return true;
    } catch (error) {
      console.error('BLE init error:', error);
      Alert.alert('BLEエラー', 'Bluetoothの初期化に失敗しました');
      return false;
    }
  };

  const connectToDevice = async (device: any) => {
    if (isConnectingRef.current) return;
    isConnectingRef.current = true;
    try {
      const connected = await BLEService.connectToDevice(device);
      if (connected) {
        await BLEService.startNotifications();
        Alert.alert('接続成功', `${device.name}に接続しました`);
      }
    } catch (error) {
      Alert.alert('接続エラー', 'デバイスへの接続に失敗しました');
    } finally {
      isConnectingRef.current = false;
    }
  };

  const handleConnectBLE = async () => {
    setIsScanning(true);
    BLEService.enableMockMode(false);
    setIsMockMode(false);
    setFoundDevice(null);
    setDiscoveredDevices([]);
    discoveredSignatureRef.current = '';
    try {
      const ready = await ensureBleReady();
      if (!ready) {
        setIsScanning(false);
        return;
      }
      await BLEService.scanForDevices();
    } catch (error) {
      setIsScanning(false);
      Alert.alert('BLE接続エラー', 'デバイスのスキャンに失敗しました');
    }
  };

  const handleConnectSimulatorMock = async () => {
    if (!canUseSimulatorMock) return;

    setIsScanning(true);
    BLEService.enableMockMode(true);
    setIsMockMode(true);
    setFoundDevice(null);
    setDiscoveredDevices([]);
    discoveredSignatureRef.current = '';

    try {
      const ready = await ensureBleReady();
      if (!ready) {
        setIsScanning(false);
        return;
      }
      await BLEService.scanForDevices();
    } catch (error) {
      setIsScanning(false);
      Alert.alert('シミュレータ接続エラー', '疑似VBTデバイスの起動に失敗しました');
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
      Alert.alert('一時切断', 'デバイスを切断しました。前回の接続情報は保持されます。');
    } catch (error) {
      Alert.alert('切断エラー', 'デバイスの切断に失敗しました');
    }
  };

  const handleReconnect = async () => {
    if (!lastDeviceInfo.id) {
      Alert.alert('エラー', '再接続するデバイスがありません');
      return;
    }

    const shouldUseMockReconnect =
      canUseSimulatorMock &&
      (BLEService.isMockModeEnabled() || lastDeviceInfo.id.startsWith('sim-'));

    setIsScanning(true);
    BLEService.enableMockMode(shouldUseMockReconnect);
    setIsMockMode(shouldUseMockReconnect);
    try {
      const ready = await ensureBleReady();
      if (!ready) {
        setIsScanning(false);
        return;
      }
      const reconnected = await BLEService.reconnect();
      setIsScanning(false);

      if (reconnected) {
        await BLEService.startNotifications();
        setFoundDevice({ name: lastDeviceInfo.name, id: lastDeviceInfo.id });
        Alert.alert('再接続成功', `${lastDeviceInfo.name}に再接続しました`);
      } else {
        Alert.alert('再接続失敗', 'デバイスが見つかりませんでした。スキャンしてください。');
      }
    } catch (error) {
      setIsScanning(false);
      Alert.alert('再接続エラー', '再接続に失敗しました');
    }
  };

  const handleFullDisconnect = async () => {
    try {
      await BLEService.disconnectAndClear();
      BLEService.enableMockMode(false);
      setFoundDevice(null);
      setIsMockMode(false);
      setLastDeviceInfo({ id: null, name: null });
      Alert.alert('登録解除', 'デバイスを切断し、再接続用の記録も削除しました。');
    } catch (error) {
      Alert.alert('切断エラー', 'デバイスの切断に失敗しました');
    }
  };

  const navigateSafely = (path: string) => {
    const now = Date.now();
    if (now - lastNavigateAtRef.current < 600) return;
    lastNavigateAtRef.current = now;
    router.push(path as any);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      nestedScrollEnabled
    >
      <View style={[styles.header, { paddingTop: (insets.top || 0) + 12 }]}>
        <Text style={styles.eyebrow}>PIT GARAGE / VBT DASHBOARD</Text>
        <Text style={styles.title}>RepVelo VBT Coach</Text>
        <Text style={styles.subtitle}>Velocity-Based Training for race-day lifting</Text>
        <View style={styles.heroStats}>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatLabel}>LINK</Text>
            <Text style={styles.heroStatValue}>{dashboardStatus}</Text>
          </View>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatLabel}>MODE</Text>
            <Text style={styles.heroStatValue}>{systemMode}</Text>
          </View>
          <View style={styles.heroStatCard}>
            <Text style={styles.heroStatLabel}>QUEUE</Text>
            <Text style={styles.heroStatValue}>{recentSessions.length}</Text>
          </View>
        </View>
      </View>

      {/* BLE接続ステータス（Web環境では非表示） */}
      {!isWeb && (
        <>
          <View style={styles.statusCard}>
            <Text style={styles.panelTag}>LINK STATUS</Text>
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
              <>
                {canUseSimulatorMock && (
                  <TouchableOpacity
                    style={[styles.button, styles.mockButton]}
                    onPress={handleConnectSimulatorMock}
                  >
                    <Text style={styles.buttonText}>シミュレーターVBT接続</Text>
                  </TouchableOpacity>
                )}
                {/* 前回のデバイスがある場合は再接続ボタンを表示 */}
                {lastDeviceInfo.id && !foundDevice && (
                  <TouchableOpacity
                    style={[styles.button, styles.reconnectButton]}
                    onPress={handleReconnect}
                  >
                    <Text style={styles.buttonText}>
                      再接続: {lastDeviceInfo.name || '前回のデバイス'}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.button} onPress={handleConnectBLE}>
                  <Text style={styles.buttonText}>BLEデバイスに接続</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.connectedButtonsRow}>
                <TouchableOpacity
                  style={[styles.button, styles.halfButton, styles.secondaryButton]}
                  onPress={handleDisconnect}
                >
                  <Text style={styles.buttonText}>一時切断</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.halfButton, styles.disconnectButton]}
                  onPress={handleFullDisconnect}
                >
                  <Text style={styles.buttonText}>登録解除</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          {isConnected && (
            <Text style={styles.buttonHelpText}>
              一時切断は前回デバイスを記憶します。登録解除は再接続情報も消去します。
            </Text>
          )}
        </>
      )}

      {/* 接続済みデバイス情報 */}
      {isConnected && foundDevice && (
        <View style={styles.deviceInfoCard}>
          <Text style={styles.deviceInfoLabel}>接続中のデバイス</Text>
          {isMockMode && (
            <View style={styles.deviceInfoMockBadge}>
              <Text style={styles.deviceInfoMockBadgeText}>SIMULATOR FEED</Text>
            </View>
          )}
          <Text style={styles.deviceInfoName}>{foundDevice.name}</Text>
          <Text style={styles.deviceInfoId}>{foundDevice.id}</Text>
        </View>
      )}

      {/* 開発時のみ：発見したデバイス一覧（デバッグ用） */}
      {__DEV__ && isScanning && discoveredDevices.length > 0 && (
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

      {/* デバイス選択（スキャン完了後・開発・本番共通） */}
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
          onPress={() => navigateSafely('/(tabs)/session')}
        >
          <Text style={styles.menuButtonBadge}>TRACK 01</Text>
          <Text style={styles.menuButtonText}>VBTセッション開始</Text>
          <Text style={styles.menuButtonSub}>速度ベースの本番走行を開始</Text>
          <Text style={styles.menuButtonArrow}>ENTER</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuButton, styles.manualButton]}
          onPress={() => navigateSafely('/(tabs)/manual')}
        >
          <Text style={styles.menuButtonBadge}>TRACK 02</Text>
          <Text style={styles.menuButtonText}>手動入力</Text>
          <Text style={styles.menuButtonSub}>ピット記録を素早く入力</Text>
          <Text style={styles.menuButtonArrow}>EDIT</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuButton, styles.graphButton]}
          onPress={() => navigateSafely('/(tabs)/graph')}
        >
          <Text style={styles.menuButtonBadge}>TRACK 03</Text>
          <Text style={styles.menuButtonText}>LVPグラフ</Text>
          <Text style={styles.menuButtonSub}>テレメトリーと負荷プロファイル</Text>
          <Text style={styles.menuButtonArrow}>VIEW</Text>
        </TouchableOpacity>
      </View>

      {/* 最近のセッション */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>最近のセッション</Text>
        {recentSessions.length === 0 ? (
          <Text style={styles.emptyText}>起動安定化のため、最近のセッション表示を一時停止しています</Text>
        ) : (
          recentSessions.map((session) => (
            <TouchableOpacity
              key={session.session_id}
              style={styles.sessionCard}
              onPress={() => navigateSafely(`/(tabs)/session/${session.session_id}`)}
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
    backgroundColor: '#090909',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  header: {
    padding: 24,
    margin: 16,
    marginBottom: 12,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: '#3a2020',
    borderRadius: 22,
    backgroundColor: '#120d0d',
    shadowColor: '#ff4d00',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  eyebrow: {
    color: '#ff7a18',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 12,
  },
  title: {
    fontSize: 34,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    color: '#d7c0b5',
    marginBottom: 18,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  heroStatCard: {
    flex: 1,
    backgroundColor: '#1c1515',
    borderWidth: 1,
    borderColor: '#3b2a2a',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  heroStatLabel: {
    color: '#8f7b74',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  heroStatValue: {
    color: '#fff3ec',
    fontSize: 18,
    fontWeight: '900',
  },
  statusCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#151010',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#362424',
  },
  panelTag: {
    color: '#ff6b35',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 10,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 16,
    color: '#f5e7e0',
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
    fontWeight: '700',
  },
  deviceName: {
    fontSize: 14,
    color: '#ffb088',
    marginTop: 8,
  },
  buttonContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  button: {
    backgroundColor: '#2d1d1d',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#533030',
  },
  disconnectButton: {
    backgroundColor: '#691f1f',
    borderColor: '#b53a3a',
  },
  reconnectButton: {
    backgroundColor: '#1e3a5f',
    marginBottom: 8,
    borderColor: '#4f88c5',
  },
  mockButton: {
    backgroundColor: '#2e234d',
    marginBottom: 8,
    borderColor: '#8f74ff',
  },
  secondaryButton: {
    backgroundColor: '#5a3810',
    borderColor: '#ff9800',
  },
  connectedButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  halfButton: {
    flex: 1,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  buttonHelpText: {
    color: '#777',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  section: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff2e8',
    marginBottom: 12,
  },
  menuButton: {
    padding: 18,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sessionButton: {
    backgroundColor: '#2b0f0f',
    borderColor: '#ff5a36',
  },
  manualButton: {
    backgroundColor: '#2b170f',
    borderColor: '#ff9800',
  },
  graphButton: {
    backgroundColor: '#151525',
    borderColor: '#8e7bff',
  },
  menuButtonBadge: {
    color: '#c6a995',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginBottom: 8,
  },
  menuButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  menuButtonSub: {
    color: 'rgba(255,244,236,0.72)',
    fontSize: 14,
    marginTop: 6,
    maxWidth: '78%',
  },
  menuButtonArrow: {
    position: 'absolute',
    right: 16,
    top: 16,
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.6,
  },
  emptyText: {
    fontSize: 14,
    color: '#8d7b75',
    textAlign: 'center',
    paddingVertical: 24,
  },
  sessionCard: {
    backgroundColor: '#151010',
    padding: 16,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#322020',
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
    backgroundColor: '#151010',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#3a2424',
  },
  deviceCardName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ff8d5b',
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
  deviceInfoCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#0f1712',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2f7d50',
  },
  deviceInfoLabel: {
    fontSize: 12,
    color: '#4CAF50',
    marginBottom: 4,
  },
  deviceInfoMockBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#4b3c93',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  deviceInfoMockBadgeText: {
    color: '#efe8ff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  deviceInfoName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  deviceInfoId: {
    fontSize: 12,
    color: '#666',
  },
});
