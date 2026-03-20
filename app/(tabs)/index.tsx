import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import BLEService from '@/src/services/BLEService';
import DatabaseService from '@/src/services/DatabaseService';
import { GarageTheme } from '@/src/constants/garageTheme';
import type { SessionData } from '@/src/types/index';
import type { Device } from 'react-native-ble-plx';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [isConnected, setIsConnected] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [recentSessions, setRecentSessions] = useState<SessionData[]>([]);
  const [foundDevice, setFoundDevice] = useState<Device | { name?: string | null; id?: string | null } | null>(null);
  const [discoveredDevices, setDiscoveredDevices] = useState<Device[]>([]);
  const [lastDeviceInfo, setLastDeviceInfo] = useState<{ id: string | null; name: string | null }>({
    id: null,
    name: null,
  });
  const isWeb = Platform.OS === 'web';

  useEffect(() => {
    BLEService.setCallbacks({
        onConnectionStatusChanged: (connected) => {
          setIsConnected(connected);
          const deviceInfo = BLEService.getLastDeviceInfo();
          setLastDeviceInfo(deviceInfo);
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
          setFoundDevice(device);
          setIsScanning(false);
          void connectToDevice(device);
        },
        onDevicesDiscovered: (devices: Device[]) => {
          setDiscoveredDevices(devices);
        },
      });
  }, []);

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    let cancelled = false;

    const hydrateDashboard = async () => {
      try {
        await DatabaseService.initialize();
        if (cancelled) {
          return;
        }

        await loadRecentSessions();
        if (cancelled) {
          return;
        }

        const deviceInfo = BLEService.getLastDeviceInfo();
        setLastDeviceInfo(deviceInfo);
        if (!isConnected && deviceInfo.id) {
          setFoundDevice({ name: deviceInfo.name, id: deviceInfo.id });
        }
      } catch (error) {
        console.error('Init error:', error);
      }
    };

    void hydrateDashboard();

    return () => {
      cancelled = true;
    };
  }, [isConnected, isFocused]);

  const ensureBleReady = async (): Promise<boolean> => {
    if (isWeb) return false;
    try {
      return await BLEService.initialize();
    } catch (error) {
      console.error('BLE init error:', error);
      return false;
    }
  };

  const loadRecentSessions = async () => {
    try {
      const sessions = await DatabaseService.getSessions();
      setRecentSessions(sessions.slice(0, 4));
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const connectToDevice = async (device: Device | { name?: string | null; id?: string | null }) => {
    try {
      const connected = await BLEService.connectToDevice(device as Device);
      if (connected) {
        await BLEService.startNotifications();
        Alert.alert('接続成功', `${device.name ?? 'RepVelo Device'} に接続しました`);
      }
    } catch {
      Alert.alert('接続エラー', 'デバイスへの接続に失敗しました');
    }
  };

  const handleConnectBLE = async () => {
    const bleReady = await ensureBleReady();
    if (!bleReady) {
      Alert.alert('BLEエラー', 'Bluetoothをオンにしてください');
      return;
    }

    setIsScanning(true);
    setFoundDevice(null);
    setDiscoveredDevices([]);
    try {
      await BLEService.scanForDevices();
    } catch {
      setIsScanning(false);
      Alert.alert('BLE接続エラー', 'デバイスのスキャンに失敗しました');
    }
  };

  const handleReconnect = async () => {
    const bleReady = await ensureBleReady();
    if (!bleReady) {
      Alert.alert('BLEエラー', 'Bluetoothをオンにしてください');
      return;
    }

    if (!lastDeviceInfo.id) {
      Alert.alert('エラー', '再接続するデバイスがありません');
      return;
    }

    setIsScanning(true);
    try {
      const reconnected = await BLEService.reconnect();
      setIsScanning(false);

      if (reconnected) {
        await BLEService.startNotifications();
        setFoundDevice({ name: lastDeviceInfo.name, id: lastDeviceInfo.id });
        Alert.alert('再接続成功', `${lastDeviceInfo.name ?? '前回のデバイス'} に再接続しました`);
      } else {
        Alert.alert('再接続失敗', 'デバイスが見つかりませんでした。スキャンしてください。');
      }
    } catch {
      setIsScanning(false);
      Alert.alert('再接続エラー', '再接続に失敗しました');
    }
  };

  const handleDisconnect = async () => {
    try {
      await BLEService.disconnectAndClear();
      setFoundDevice(null);
      setLastDeviceInfo({ id: null, name: null });
      Alert.alert('切断', 'デバイスを切断しました');
    } catch {
      Alert.alert('切断エラー', 'デバイスの切断に失敗しました');
    }
  };

  const statusCards = useMemo(
    () => [
      { label: 'LINK', value: isConnected ? 'LIVE' : isScanning ? 'SCAN' : 'STBY' },
      { label: 'MODE', value: isConnected ? 'READY' : 'IDLE' },
      { label: 'QUEUE', value: String(recentSessions.length) },
    ],
    [isConnected, isScanning, recentSessions.length],
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 36 }}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>COCKPIT / VBT DASHBOARD</Text>
        <Text style={styles.title}>RepVelo VBT Coach</Text>
        <Text style={styles.subtitle}>Race-engineered telemetry for velocity-based training.</Text>

        <View style={styles.metricsRow}>
          {statusCards.map((item) => (
            <View key={item.label} style={styles.metricCard}>
              <Text style={styles.metricLabel}>{item.label}</Text>
              <Text style={styles.metricValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      </View>

      {!isWeb && (
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelKicker}>LINK STATUS</Text>
            <View style={styles.statusInline}>
              <Text style={styles.statusTitle}>BLE接続状態</Text>
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isConnected ? GarageTheme.success : GarageTheme.danger },
                ]}
              />
              <Text style={[styles.statusValue, isConnected ? styles.statusOnline : styles.statusOffline]}>
                {isScanning ? 'スキャン中' : isConnected ? '接続済み' : '未接続'}
              </Text>
            </View>
            {(foundDevice?.name || lastDeviceInfo.name) && (
              <Text style={styles.deviceText}>Device: {foundDevice?.name ?? lastDeviceInfo.name}</Text>
            )}
          </View>

          {isScanning ? (
            <View style={styles.bleButton}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.bleButtonText}>スキャン中...</Text>
            </View>
          ) : isConnected ? (
            <TouchableOpacity style={styles.bleButton} onPress={handleDisconnect}>
              <Text style={styles.bleButtonText}>デバイスを切断</Text>
            </TouchableOpacity>
          ) : lastDeviceInfo.id ? (
            <>
              <TouchableOpacity style={styles.bleButton} onPress={handleReconnect}>
                <Text style={styles.bleButtonText}>前回デバイスへ再接続</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.bleButton, styles.bleButtonSecondary]} onPress={handleConnectBLE}>
                <Text style={styles.bleButtonText}>BLEデバイスに接続</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={styles.bleButton} onPress={handleConnectBLE}>
              <Text style={styles.bleButtonText}>BLEデバイスに接続</Text>
            </TouchableOpacity>
          )}

          {isScanning && discoveredDevices.length > 0 && (
            <View style={styles.deviceList}>
              {discoveredDevices.slice(0, 4).map((device) => (
                <TouchableOpacity
                  key={device.id}
                  style={styles.deviceRow}
                  onPress={() => {
                    setIsScanning(false);
                    setDiscoveredDevices([]);
                    void connectToDevice(device);
                  }}
                >
                  <Text style={styles.deviceRowName}>{device.name || '(名前なし)'}</Text>
                  <Text style={styles.deviceRowMeta}>{device.id}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>CONTROL TRACKS</Text>

        <TouchableOpacity style={[styles.trackCard, styles.trackPrimary]} onPress={() => router.navigate('/(tabs)/session')}>
          <View style={styles.trackHeader}>
            <Text style={styles.trackCode}>TRACK 01</Text>
            <Text style={styles.trackAction}>ENTER</Text>
          </View>
          <Text style={styles.trackTitle}>VBTセッション開始</Text>
          <Text style={styles.trackDescription}>ライブ計測でトレーニング進行を開始</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.trackCard, styles.trackSecondary]} onPress={() => router.navigate('/(tabs)/manual')}>
          <View style={styles.trackHeader}>
            <Text style={styles.trackCode}>TRACK 02</Text>
            <Text style={styles.trackAction}>EDIT</Text>
          </View>
          <Text style={styles.trackTitle}>手動入力</Text>
          <Text style={styles.trackDescription}>セットログを手早く入力</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.trackCard, styles.trackTertiary]} onPress={() => router.navigate('/(tabs)/graph')}>
          <View style={styles.trackHeader}>
            <Text style={styles.trackCode}>TRACK 03</Text>
            <Text style={styles.trackAction}>VIEW</Text>
          </View>
          <Text style={styles.trackTitle}>LVPグラフ</Text>
          <Text style={styles.trackDescription}>LVPと速度トレンドを確認</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>RECENT RUNS</Text>
        {recentSessions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>まだセッションがありません</Text>
          </View>
        ) : (
          recentSessions.map((session) => (
            <TouchableOpacity
              key={session.session_id}
              style={styles.sessionCard}
              onPress={() => router.push({ pathname: '/session-detail', params: { sessionId: session.session_id } })}
            >
              <Text style={styles.sessionDate}>{session.date}</Text>
              <Text style={styles.sessionMeta}>
                {session.total_sets} sets / {Math.round(session.total_volume)} kg
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
    backgroundColor: GarageTheme.background,
  },
  hero: {
    marginHorizontal: 16,
    paddingHorizontal: 18,
    paddingVertical: 22,
    borderRadius: 26,
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    shadowColor: GarageTheme.accent,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
  },
  eyebrow: {
    color: GarageTheme.accent,
    fontSize: 11,
    letterSpacing: 2.2,
    fontWeight: '700',
    marginBottom: 12,
  },
  title: {
    color: GarageTheme.textStrong,
    fontSize: 38,
    lineHeight: 40,
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: 0.6,
  },
  subtitle: {
    color: GarageTheme.textMuted,
    fontSize: 14,
    marginBottom: 18,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: GarageTheme.panel,
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  metricLabel: {
    color: GarageTheme.textMuted,
    fontSize: 10,
    letterSpacing: 1.6,
    fontWeight: '700',
    marginBottom: 6,
  },
  metricValue: {
    color: GarageTheme.textStrong,
    fontSize: 22,
    fontWeight: '800',
  },
  panel: {
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 22,
    padding: 16,
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  panelHeader: {
    marginBottom: 14,
  },
  panelKicker: {
    color: GarageTheme.accentSoft,
    fontSize: 10,
    letterSpacing: 1.8,
    fontWeight: '700',
    marginBottom: 10,
  },
  statusInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusTitle: {
    flex: 1,
    color: GarageTheme.textStrong,
    fontSize: 15,
    fontWeight: '600',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  statusValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusOnline: {
    color: GarageTheme.success,
  },
  statusOffline: {
    color: GarageTheme.danger,
  },
  deviceText: {
    marginTop: 8,
    color: GarageTheme.textMuted,
    fontSize: 12,
  },
  bleButton: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: GarageTheme.panel,
    borderWidth: 1,
    borderColor: GarageTheme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    gap: 10,
  },
  bleButtonSecondary: {
    backgroundColor: GarageTheme.surfaceAlt,
    borderColor: GarageTheme.border,
  },
  bleButtonText: {
    color: GarageTheme.textStrong,
    fontSize: 16,
    fontWeight: '700',
  },
  deviceList: {
    marginTop: 12,
    gap: 10,
  },
  deviceRow: {
    borderRadius: 12,
    backgroundColor: GarageTheme.surfaceAlt,
    padding: 12,
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  deviceRowName: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: '700',
  },
  deviceRowMeta: {
    color: GarageTheme.textSubtle,
    fontSize: 11,
    marginTop: 4,
  },
  section: {
    marginTop: 18,
    marginHorizontal: 16,
  },
  sectionTitle: {
    color: GarageTheme.textStrong,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 14,
    letterSpacing: 2,
  },
  trackCard: {
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1,
    marginBottom: 14,
  },
  trackPrimary: {
    backgroundColor: GarageTheme.panel,
    borderColor: GarageTheme.accent,
  },
  trackSecondary: {
    backgroundColor: GarageTheme.surface,
    borderColor: GarageTheme.accentSoft,
  },
  trackTertiary: {
    backgroundColor: GarageTheme.surfaceAlt,
    borderColor: GarageTheme.borderStrong,
  },
  trackHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  trackCode: {
    color: GarageTheme.accentSoft,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '700',
  },
  trackAction: {
    color: GarageTheme.textStrong,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '800',
  },
  trackTitle: {
    color: '#fff8f4',
    fontSize: 28,
    lineHeight: 30,
    fontWeight: '800',
    marginBottom: 6,
  },
  trackDescription: {
    color: '#d1b7a7',
    fontSize: 14,
  },
  emptyCard: {
    borderRadius: 18,
    backgroundColor: '#151112',
    padding: 18,
    borderWidth: 1,
    borderColor: '#302224',
  },
  emptyText: {
    color: '#b8a9a2',
    fontSize: 14,
  },
  sessionCard: {
    borderRadius: 16,
    backgroundColor: '#151112',
    borderWidth: 1,
    borderColor: '#302224',
    padding: 14,
    marginBottom: 10,
  },
  sessionDate: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  sessionMeta: {
    color: '#a59187',
    fontSize: 12,
  },
});
