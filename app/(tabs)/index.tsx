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
import { formatErrorMessage } from '@/src/utils/errorMessages';
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
      const error = formatErrorMessage('BLE_NOT_READY', 'センサー接続');
      Alert.alert('エラー', error);
      return;
    }

    setIsScanning(true);
    setFoundDevice(null);
    setDiscoveredDevices([]);
    try {
      await BLEService.scanForDevices();
    } catch {
      setIsScanning(false);
      const error = formatErrorMessage('BLE_SCAN_FAILED', 'センサー接続');
      Alert.alert('エラー', error);
    }
  };

  const handleReconnect = async () => {
    const bleReady = await ensureBleReady();
    if (!bleReady) {
      const error = formatErrorMessage('BLE_NOT_READY', 'センサー接続');
      Alert.alert('エラー', error);
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
        const error = formatErrorMessage('BLE_CONNECTION_FAILED', '再接続');
        Alert.alert('再接続失敗', error);
      }
    } catch {
      setIsScanning(false);
      const error = formatErrorMessage('BLE_CONNECTION_FAILED', '再接続');
      Alert.alert('エラー', error);
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

  const signalStrength = isConnected ? '100%' : isScanning ? '65%' : '0%';
  const dataRate = isConnected ? '120 Hz' : '--- Hz';
  const latency = isConnected ? '12 ms' : '--- ms';

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 36 }}>
      {/* HERO SECTION - High-Performance Cockpit */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroLeft}>
            <Text style={styles.eyebrow}>VBT TRAINING SYSTEM</Text>
            <Text style={styles.title}>RepVelo Coach</Text>
          </View>
          <View style={styles.heroRight}>
            <View style={styles.systemIndicator}>
              <View style={[styles.indicatorDot, isConnected && styles.indicatorDotActive]} />
              <Text style={styles.indicatorText}>{isConnected ? 'LIVE' : 'OFFLINE'}</Text>
            </View>
          </View>
        </View>
        <Text style={styles.subtitle}>Velocity-Based Training Platform</Text>

        <View style={styles.cockpitRow}>
          <View style={styles.telemetryCard}>
            <Text style={styles.telemetryLabel}>NETWORK</Text>
            <View style={styles.telemetryValueRow}>
              <Text style={styles.telemetryValue}>{isConnected ? 'ONLINE' : 'OFFLINE'}</Text>
              <View style={[styles.telemetryBar, { width: signalStrength }]} />
            </View>
          </View>

          <View style={styles.telemetryCard}>
            <Text style={styles.telemetryLabel}>RATE</Text>
            <Text style={styles.telemetryValue}>{dataRate}</Text>
          </View>

          <View style={styles.telemetryCard}>
            <Text style={styles.telemetryLabel}>PING</Text>
            <Text style={styles.telemetryValue}>{latency}</Text>
          </View>
        </View>
      </View>

      {/* TELEMETRY PANEL - Premium Connection Status */}
      {!isWeb && (
        <View style={styles.telemetryPanel}>
          <View style={styles.panelHeader}>
            <View style={styles.panelTitleRow}>
              <Text style={styles.panelKicker}>SENSOR LINK</Text>
              <View style={[styles.statusBadge, isConnected && styles.statusBadgeConnected]}>
                <View style={[styles.statusPulse, isConnected && styles.statusPulseActive]} />
                <Text style={styles.statusText}>{isScanning ? 'SCANNING' : isConnected ? 'CONNECTED' : 'OFFLINE'}</Text>
              </View>
            </View>
            {(foundDevice?.name || lastDeviceInfo.name) && (
              <View style={styles.deviceInfo}>
                <Text style={styles.deviceLabel}>DEVICE_ID</Text>
                <Text style={styles.deviceValue}>{foundDevice?.name ?? lastDeviceInfo.name ?? 'N/A'}</Text>
              </View>
            )}
          </View>

          {isScanning ? (
            <View style={styles.actionButton}>
              <ActivityIndicator color={GarageTheme.accent} />
              <Text style={styles.actionButtonText}>SCANNING...</Text>
            </View>
          ) : isConnected ? (
            <TouchableOpacity style={styles.actionButton} onPress={handleDisconnect}>
              <Text style={styles.actionButtonText}>DISCONNECT</Text>
            </TouchableOpacity>
          ) : lastDeviceInfo.id ? (
            <>
              <TouchableOpacity style={[styles.actionButton, styles.actionButtonPrimary]} onPress={handleReconnect}>
                <Text style={styles.actionButtonText}>RECONNECT</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, styles.actionButtonSecondary]} onPress={handleConnectBLE}>
                <Text style={styles.actionButtonText}>SCAN DEVICES</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity style={[styles.actionButton, styles.actionButtonPrimary]} onPress={handleConnectBLE}>
              <Text style={styles.actionButtonText}>SCAN DEVICES</Text>
            </TouchableOpacity>
          )}

          {isScanning && discoveredDevices.length > 0 && (
            <View style={styles.deviceGrid}>
              {discoveredDevices.slice(0, 4).map((device) => (
                <TouchableOpacity
                  key={device.id}
                  style={styles.deviceCard}
                  onPress={() => {
                    setIsScanning(false);
                    setDiscoveredDevices([]);
                    void connectToDevice(device);
                  }}
                >
                  <Text style={styles.deviceCardName}>{device.name || '(UNKNOWN)'}</Text>
                  <Text style={styles.deviceCardId}>{device.id.slice(-8)}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {/* PREMIUM ACTION CARDS - Tracks */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>TRAINING MODULES</Text>

        <TouchableOpacity style={[styles.premiumCard, styles.premiumCardPrimary]} onPress={() => router.navigate('/(tabs)/session')}>
          <View style={styles.premiumCardHeader}>
            <View style={styles.premiumCardLeft}>
              <Text style={styles.premiumCardCode}>MODULE_01</Text>
              <Text style={styles.premiumCardStatus}>SENSOR TRAINING</Text>
            </View>
            <View style={styles.premiumCardRight}>
              <Text style={styles.premiumCardArrow}>→</Text>
            </View>
          </View>
          <Text style={styles.premiumCardTitle}>Live Velocity Tracking</Text>
          <Text style={styles.premiumCardDesc}>Real-time speed measurement during training</Text>
          <View style={styles.premiumCardFooter}>
            <View style={styles.premiumCardTag}>
              <Text style={styles.premiumCardTagText}>RECOMMENDED</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.premiumCard, styles.premiumCardSecondary]} onPress={() => router.navigate('/(tabs)/manual')}>
          <View style={styles.premiumCardHeader}>
            <View style={styles.premiumCardLeft}>
              <Text style={styles.premiumCardCode}>MODULE_02</Text>
              <Text style={styles.premiumCardStatus}>MANUAL LOGGING</Text>
            </View>
            <View style={styles.premiumCardRight}>
              <Text style={styles.premiumCardArrow}>→</Text>
            </View>
          </View>
          <Text style={styles.premiumCardTitle}>Manual Entry Mode</Text>
          <Text style={styles.premiumCardDesc}>Record sets and reps manually</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.premiumCard, styles.premiumCardTertiary]} onPress={() => router.navigate('/(tabs)/graph')}>
          <View style={styles.premiumCardHeader}>
            <View style={styles.premiumCardLeft}>
              <Text style={styles.premiumCardCode}>MODULE_03</Text>
              <Text style={styles.premiumCardStatus}>ANALYTICS</Text>
            </View>
            <View style={styles.premiumCardRight}>
              <Text style={styles.premiumCardArrow}>→</Text>
            </View>
          </View>
          <Text style={styles.premiumCardTitle}>Performance Dashboard</Text>
          <Text style={styles.premiumCardDesc}>View progress trends and graphs</Text>
        </TouchableOpacity>
      </View>

      {/* RECENT ACTIVITY LIST - Refined Design */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>RECENT ACTIVITY</Text>
          <Text style={styles.sectionCount}>{String(recentSessions.length).padStart(2, '0')}</Text>
        </View>
        {recentSessions.length === 0 ? (
          <View style={styles.activityEmpty}>
            <Text style={styles.activityEmptyText}>NO SESSIONS RECORDED</Text>
          </View>
        ) : (
          recentSessions.map((session, index) => (
            <TouchableOpacity
              key={session.session_id}
              style={styles.activityCard}
              onPress={() => router.push({ pathname: '/session-detail', params: { sessionId: session.session_id } })}
            >
              <View style={styles.activityLeft}>
                <Text style={styles.activityIndex}>{String(index + 1).padStart(2, '0')}</Text>
                <View style={styles.activityDivider} />
                <View style={styles.activityContent}>
                  <Text style={styles.activityDate}>{session.date}</Text>
                  <Text style={styles.activityMeta}>
                    {session.total_sets} SETS × {Math.round(session.total_volume)} KG
                  </Text>
                </View>
              </View>
              <View style={styles.activityRight}>
                <Text style={styles.activityArrow}>›</Text>
              </View>
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
    paddingHorizontal: 20,
    paddingVertical: 24,
    borderRadius: 28,
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    shadowColor: GarageTheme.accent,
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  heroLeft: {
    flex: 1,
  },
  heroRight: {
    marginLeft: 12,
  },
  eyebrow: {
    color: GarageTheme.accentSoft,
    fontSize: 10,
    letterSpacing: 2.4,
    fontWeight: '700',
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  title: {
    color: GarageTheme.textStrong,
    fontSize: 36,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  subtitle: {
    color: GarageTheme.textMuted,
    fontSize: 13,
    marginBottom: 20,
    letterSpacing: 0.4,
  },
  systemIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GarageTheme.panel,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  indicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: GarageTheme.textSubtle,
    marginRight: 6,
  },
  indicatorDotActive: {
    backgroundColor: GarageTheme.success,
    shadowColor: GarageTheme.success,
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  indicatorText: {
    color: GarageTheme.textStrong,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  cockpitRow: {
    flexDirection: 'row',
    gap: 8,
  },
  telemetryCard: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: GarageTheme.panel,
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  telemetryLabel: {
    color: GarageTheme.textSubtle,
    fontSize: 9,
    letterSpacing: 1.8,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  telemetryValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  telemetryValue: {
    color: GarageTheme.textStrong,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  telemetryBar: {
    height: 4,
    backgroundColor: GarageTheme.accent,
    borderRadius: 2,
    minWidth: 20,
  },
  telemetryPanel: {
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 18,
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  panelHeader: {
    marginBottom: 16,
  },
  panelTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  panelKicker: {
    color: GarageTheme.accentSoft,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GarageTheme.chipAlt,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  statusBadgeConnected: {
    backgroundColor: 'rgba(110, 231, 168, 0.12)',
    borderColor: GarageTheme.success,
  },
  statusPulse: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: GarageTheme.textSubtle,
    marginRight: 6,
  },
  statusPulseActive: {
    backgroundColor: GarageTheme.success,
    shadowColor: GarageTheme.success,
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  statusText: {
    color: GarageTheme.textStrong,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  deviceInfo: {
    backgroundColor: GarageTheme.panel,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  deviceLabel: {
    color: GarageTheme.textSubtle,
    fontSize: 9,
    letterSpacing: 1.6,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  deviceValue: {
    color: GarageTheme.textStrong,
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  actionButton: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: GarageTheme.panel,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  actionButtonPrimary: {
    backgroundColor: GarageTheme.accent + '12',
    borderColor: GarageTheme.accent,
  },
  actionButtonSecondary: {
    backgroundColor: GarageTheme.surfaceAlt,
    borderColor: GarageTheme.borderStrong,
  },
  actionButtonIcon: {
    fontSize: 18,
    color: GarageTheme.textStrong,
  },
  actionButtonText: {
    color: GarageTheme.textStrong,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1,
  },
  deviceGrid: {
    marginTop: 14,
    gap: 10,
  },
  deviceCard: {
    borderRadius: 14,
    backgroundColor: GarageTheme.surfaceAlt,
    padding: 14,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  deviceCardName: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: '700',
  },
  deviceCardId: {
    color: GarageTheme.textSubtle,
    fontSize: 11,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  section: {
    marginTop: 20,
    marginHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    color: GarageTheme.textStrong,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.2,
    textTransform: 'uppercase',
  },
  sectionCount: {
    color: GarageTheme.accentSoft,
    fontSize: 14,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  premiumCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  premiumCardPrimary: {
    backgroundColor: GarageTheme.panel,
    borderColor: GarageTheme.accent,
    shadowColor: GarageTheme.accent,
    shadowOpacity: 0.2,
  },
  premiumCardSecondary: {
    backgroundColor: GarageTheme.surface,
    borderColor: GarageTheme.accentSoft,
  },
  premiumCardTertiary: {
    backgroundColor: GarageTheme.surfaceAlt,
    borderColor: GarageTheme.borderStrong,
  },
  premiumCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  premiumCardLeft: {
    flex: 1,
  },
  premiumCardRight: {
    marginLeft: 12,
  },
  premiumCardCode: {
    color: GarageTheme.accentSoft,
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  premiumCardStatus: {
    color: GarageTheme.textMuted,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  premiumCardArrow: {
    fontSize: 20,
    color: GarageTheme.accent,
    fontWeight: '300',
  },
  premiumCardTitle: {
    color: GarageTheme.textStrong,
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  premiumCardDesc: {
    color: GarageTheme.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  premiumCardFooter: {
    flexDirection: 'row',
    gap: 8,
  },
  premiumCardTag: {
    backgroundColor: GarageTheme.accent + '18',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: GarageTheme.accent + '40',
  },
  premiumCardTagText: {
    color: GarageTheme.accent,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  activityEmpty: {
    borderRadius: 20,
    backgroundColor: GarageTheme.surface,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  activityEmptyIcon: {
    fontSize: 40,
    color: GarageTheme.borderStrong,
    marginBottom: 12,
  },
  activityEmptyText: {
    color: GarageTheme.textSubtle,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  activityCard: {
    borderRadius: 18,
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  activityLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityIndex: {
    color: GarageTheme.accentSoft,
    fontSize: 14,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginRight: 14,
    minWidth: 24,
  },
  activityDivider: {
    width: 1,
    height: 32,
    backgroundColor: GarageTheme.border,
    marginRight: 14,
  },
  activityContent: {
    flex: 1,
  },
  activityDate: {
    color: GarageTheme.textStrong,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  activityMeta: {
    color: GarageTheme.textSubtle,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  activityRight: {
    marginLeft: 12,
  },
  activityArrow: {
    fontSize: 18,
    color: GarageTheme.textMuted,
    fontWeight: '300',
  },
});
