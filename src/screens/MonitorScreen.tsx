/**
 * Monitor Screen
 * Real-time VBT monitoring during workout
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BLEService from '../services/BLEService';
import DatabaseService from '../services/DatabaseService';
import VBTCalculations from '../utils/VBTCalculations';
import { RepData, RepVeloData, SetData } from '../types/index';
import { createSessionId, formatSessionLabel } from '../utils/session';
import { GarageTheme } from '../constants/garageTheme';

interface MonitorScreenProps {
  navigation: any;
}

const DEFAULT_LIFT = "Bench Press";
const DEFAULT_LOAD = 80;

const MonitorScreen: React.FC<MonitorScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [sessionId] = useState(() => createSessionId());
  const [currentSet, setCurrentSet] = useState(1);
  const [currentRep, setCurrentRep] = useState(0);
  const [liveData, setLiveData] = useState<RepVeloData | null>(null);
  const [repData, setRepData] = useState<RepData[]>([]);
  const [velocityLoss, setVelocityLoss] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recentLiftSets, setRecentLiftSets] = useState<SetData[]>([]);

  useEffect(() => {
    setupBLECallbacks();
    return () => {
      BLEService.stopNotifications();
    };
    // Monitor callback wiring is intentionally installed once for this legacy screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (repData.length > 0) {
      const metrics = VBTCalculations.calculateVelocityLossMetrics(repData);
      setVelocityLoss(metrics.vlLast ?? metrics.vlAvg);
    }
  }, [repData]);

  const loadRecentLiftSets = async () => {
    try {
      const sets = await DatabaseService.getRecentSetsForLift(DEFAULT_LIFT, 3, sessionId);
      setRecentLiftSets(sets);
    } catch {
      setRecentLiftSets([]);
    }
  };

  useEffect(() => {
    void loadRecentLiftSets();
    // Recent-set lookup should refresh only when this monitor session changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const setupBLECallbacks = () => {
    BLEService.setCallbacks({
      onDataReceived: (data: RepVeloData) => {
        setLiveData(data);

        if (isRecording) {
          handleNewRep(data);
        }
      },
      onError: (error) => {
        Alert.alert('BLEエラー', error);
      },
    });
  };

  const handleNewRep = (data: RepVeloData) => {
    const newRep: RepData = {
      session_id: sessionId,
      lift: DEFAULT_LIFT,
      set_index: currentSet,
      rep_index: currentRep + 1,
      load_kg: DEFAULT_LOAD,
      device_type: 'VBT',
      mean_velocity: data.mean_velocity,
      peak_velocity: data.peak_velocity,
      rom_cm: data.rom_cm,
      mean_power_w: data.mean_power_w ?? null,
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
      setIsRecording(true);
      setRepData([]);
      setCurrentRep(0);
    } catch {
      Alert.alert('エラー', '記録の開始に失敗しました');
    }
  };

  const handleStopRecording = () => {
    setIsRecording(false);
  };

  const handleFinishSet = async () => {
    if (repData.length === 0) {
      Alert.alert('エラー', 'まずレップを記録してください');
      return;
    }

    try {
      await DatabaseService.ensureSession(sessionId);

      const meanVelocities = repData
        .map((rep) => rep.mean_velocity)
        .filter((value): value is number => value !== null);
      const velocityLossMetrics =
        VBTCalculations.calculateVelocityLossMetrics(repData);

      const setData: SetData = {
        session_id: sessionId,
        lift: DEFAULT_LIFT,
        set_index: currentSet,
        load_kg: DEFAULT_LOAD,
        reps: repData.length,
        device_type: 'VBT',
        set_type: 'normal',
        avg_velocity:
          meanVelocities.length > 0
            ? meanVelocities.reduce((sum, value) => sum + value, 0) / meanVelocities.length
            : null,
        velocity_loss: velocityLossMetrics.vlAvg,
        velocity_loss_avg: velocityLossMetrics.vlAvg,
        velocity_loss_last: velocityLossMetrics.vlLast,
        velocity_loss_min: velocityLossMetrics.vlMin,
        timestamp: new Date().toISOString(),
      };

      await DatabaseService.insertSet(setData);

      for (const rep of repData) {
        await DatabaseService.insertRep(rep);
      }

      await DatabaseService.syncSessionSummary(sessionId);
      await loadRecentLiftSets();

      Alert.alert('成功', `セット ${currentSet} を保存しました`);

      setCurrentSet((prev) => prev + 1);
      setRepData([]);
      setCurrentRep(0);
      setVelocityLoss(null);
      setIsRecording(false);
    } catch {
      Alert.alert('エラー', 'セットの保存に失敗しました');
    }
  };

  const getVelocityColor = (velocity: number | null): string => {
    if (!velocity) return GarageTheme.textMuted;
    if (velocity >= 1.0) return GarageTheme.accentSoft;
    if (velocity >= 0.75) return GarageTheme.accent;
    if (velocity >= 0.5) return GarageTheme.success;
    return GarageTheme.danger;
  };

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }} onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← 戻る</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>VBT モニター</Text>
          <Text style={styles.subtitle}>{DEFAULT_LIFT} / {DEFAULT_LOAD} kg</Text>
        </View>
      </View>

      <View style={styles.recentCard}>
        <Text style={styles.recentTitle}>前回の {DEFAULT_LIFT}</Text>
        {recentLiftSets.length === 0 ? (
          <Text style={styles.recentEmpty}>比較できる過去セットはまだありません</Text>
        ) : (
          recentLiftSets.map((set) => (
            <View
              key={`${set.session_id}_${set.set_index}_${set.lift}`}
              style={styles.recentItem}
            >
              <View>
                <Text style={styles.recentItemDate}>{formatSessionLabel(set.session_id)}</Text>
                <Text style={styles.recentItemMain}>{set.load_kg} kg x {set.reps} reps</Text>
              </View>
              <View style={styles.recentItemAction}>
                <Text style={styles.recentItemMeta}>
                  {set.avg_velocity !== null ? `${set.avg_velocity.toFixed(2)} m/s` : 'manual'}
                </Text>
              </View>
            </View>
          ))
        )}
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
            Peak: {liveData.peak_velocity.toFixed(2)} m/s
          </Text>
        </View>
      )}

      {velocityLoss !== null && (
        <View style={styles.vlCard}>
          <Text style={styles.vlLabel}>Velocity Loss</Text>
          <Text
            style={[
              styles.vlValue,
              { color: velocityLoss > 20 ? GarageTheme.danger : GarageTheme.success },
            ]}
          >
            {velocityLoss.toFixed(1)}%
          </Text>
          {velocityLoss > 20 && (
            <Text style={styles.vlWarning}>セットを終了することをお勧めします</Text>
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
    backgroundColor: GarageTheme.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: GarageTheme.border,
    gap: 16,
  },
  backButton: {
    color: GarageTheme.accent,
    fontSize: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: GarageTheme.textStrong,
  },
  subtitle: {
    fontSize: 13,
    color: GarageTheme.textMuted,
    marginTop: 4,
  },
  recentCard: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  recentTitle: {
    color: GarageTheme.textStrong,
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 10,
  },
  recentEmpty: {
    color: GarageTheme.textMuted,
    fontSize: 13,
  },
  recentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: GarageTheme.border,
    gap: 12,
  },
  recentItemDate: {
    color: GarageTheme.info,
    fontSize: 12,
    marginBottom: 3,
  },
  recentItemMain: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: '600',
  },
  recentItemAction: {
    alignItems: 'flex-end',
    gap: 4,
  },
  recentItemMeta: {
    color: GarageTheme.success,
    fontSize: 12,
    fontWeight: '500',
  },
  recentItemHint: {
    color: GarageTheme.accentSoft,
    fontSize: 11,
    fontWeight: '500',
  },

  setInfo: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: GarageTheme.surfaceAlt,
    margin: 16,
    borderRadius: 12,
  },
  setLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: GarageTheme.textStrong,
  },
  repLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: GarageTheme.textMuted,
  },
  velocityDisplay: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: GarageTheme.surfaceAlt,
    margin: 16,
    borderRadius: 12,
  },
  velocityLabel: {
    fontSize: 16,
    color: GarageTheme.textMuted,
    marginBottom: 8,
  },
  velocityValue: {
    fontSize: 64,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  peakLabel: {
    fontSize: 14,
    color: GarageTheme.textMuted,
  },
  vlCard: {
    padding: 16,
    backgroundColor: GarageTheme.surfaceAlt,
    marginHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  vlLabel: {
    fontSize: 16,
    color: GarageTheme.textMuted,
    marginBottom: 8,
  },
  vlValue: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  vlWarning: {
    fontSize: 14,
    color: GarageTheme.danger,
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
  coachButton: {
    backgroundColor: GarageTheme.accent,
  },
  startButton: {
    backgroundColor: GarageTheme.success,
  },
  stopButton: {
    backgroundColor: GarageTheme.danger,
  },
  finishButton: {
    backgroundColor: GarageTheme.accent,
  },
  buttonText: {
    color: GarageTheme.textStrong,
    fontSize: 18,
    fontWeight: '600',
  },
  repList: {
    padding: 16,
  },
  repListTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: GarageTheme.textStrong,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 14,
    color: GarageTheme.textMuted,
    textAlign: 'center',
    paddingVertical: 24,
  },
  repItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: GarageTheme.surfaceAlt,
    borderRadius: 8,
    marginBottom: 8,
  },
  repNumber: {
    fontSize: 16,
    color: GarageTheme.textStrong,
  },
  repVelocity: {
    fontSize: 16,
    fontWeight: '600',
    color: GarageTheme.success,
  },
});

export default MonitorScreen;
