/**
 * Home Screen
 * VBTトレーニングのメインダッシュボード
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import BLEService from '@/src/services/BLEService';
import DatabaseService from '@/src/services/DatabaseService';
import type { SessionData } from '@/src/types/index';
import { formatSessionLabel } from '@/src/utils/session';

export default function HomeScreen() {
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(false);
  const [recentSessions, setRecentSessions] = useState<SessionData[]>([]);

  useEffect(() => {
    void initializeApp();
    void loadRecentSessions();
  }, []);

  const initializeApp = async () => {
    try {
      await DatabaseService.initialize();
      BLEService.setCallbacks({
        onConnectionStatusChanged: (connected) => {
          setIsConnected(connected);
        },
        onError: (error) => {
          Alert.alert('エラー', error);
        },
      });
    } catch {
      Alert.alert('初期化エラー', 'アプリの初期化に失敗しました');
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

  const handleConnectBLE = async () => {
    try {
      await BLEService.scanForDevices();
    } catch {
      Alert.alert('BLE接続エラー', 'デバイスのスキャンに失敗しました');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>OVR VBT Coach</Text>
        <Text style={styles.subtitle}>Velocity-Based Training</Text>
      </View>

      <View style={styles.statusCard}>
        <Text style={styles.statusLabel}>BLE接続状態</Text>
        <View
          style={[
            styles.statusIndicator,
            { backgroundColor: isConnected ? '#4CAF50' : '#F44336' },
          ]}
        />
        <Text style={styles.statusText}>
          {isConnected ? '接続済み' : '未接続'}
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        {!isConnected && (
          <TouchableOpacity style={styles.button} onPress={handleConnectBLE}>
            <Text style={styles.buttonText}>BLEデバイスに接続</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={() => router.push('/monitor')}
        >
          <Text style={styles.buttonText}>VBTセッション開始</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={() => router.push('/manual-entry')}
        >
          <Text style={styles.buttonText}>手動入力</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.historyButton]}
          onPress={() => router.push('/history')}
        >
          <Text style={styles.buttonText}>履歴を見る</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.tertiaryButton]}
          onPress={() => Alert.alert('開発中', 'LVPグラフ画面は準備中です')}
        >
          <Text style={styles.buttonText}>LVPグラフ</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.coachButton]}
          onPress={() => router.push('/coach-chat')}
        >
          <Text style={styles.buttonText}>AIコーチ</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>最近のセッション</Text>
        {recentSessions.length === 0 ? (
          <Text style={styles.emptyText}>まだセッションがありません</Text>
        ) : (
          recentSessions.map((session) => (
            <TouchableOpacity
              key={session.session_id}
              style={styles.sessionCard}
              onPress={() => router.push({ pathname: '/session-detail', params: { sessionId: session.session_id } })}
            >
              <Text style={styles.sessionDate}>{formatSessionLabel(session.session_id, session.date)}</Text>
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
  buttonContainer: {
    padding: 16,
  },
  button: {
    backgroundColor: '#444',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#2196F3',
  },
  secondaryButton: {
    backgroundColor: '#FF9800',
  },
  historyButton: {
    backgroundColor: '#2f8f6f',
  },
  tertiaryButton: {
    backgroundColor: '#9C27B0',
  },
  coachButton: {
    backgroundColor: '#ff5a1f',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 20,
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
});
