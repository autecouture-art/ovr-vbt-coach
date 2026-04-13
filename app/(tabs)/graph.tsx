/**
 * LVP Graph Screen
 * 負荷-速度プロファイル・進捗グラフ画面
 * DBから実データを取得してグラフ表示
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DatabaseService from '@/src/services/DatabaseService';
import { GarageTheme } from '@/src/constants/garageTheme';
import AICoachService from '@/src/services/AICoachService';
import {
  EXERCISE_SELECTION_GROUPS,
  matchesExerciseSelectionGroup,
  type ExerciseSelectionGroupId,
} from '@/src/constants/exerciseCatalog';
import type { LVPData, SessionData, SetData, Exercise } from '@/src/types/index';

const DEFAULT_VELOCITY_ZONES = [
  { name: 'POWER', minV: 1.0, maxV: 1.5, color: GarageTheme.accentSoft, desc: '爆発的な出力領域' },
  { name: 'SPEED STRENGTH', minV: 0.75, maxV: 1.0, color: GarageTheme.accent, desc: '速度優位の筋力領域' },
  { name: 'HYPERTROPHY', minV: 0.5, maxV: 0.75, color: GarageTheme.success, desc: '筋量寄りの領域' },
  { name: 'MAX STRENGTH', minV: 0.0, maxV: 0.5, color: GarageTheme.danger, desc: '高強度領域' },
];

const percentile = (values: number[], ratio: number) => {
  if (values.length === 0) return 0;
  const idx = Math.min(values.length - 1, Math.max(0, Math.floor((values.length - 1) * ratio)));
  return values[idx];
};

const buildVelocityZonesFromHistory = (sets: SetData[]) => {
  const velocities = sets
    .map((set) => set.avg_velocity)
    .filter((value): value is number => typeof value === 'number' && value > 0)
    .sort((a, b) => a - b);

  if (velocities.length < 4) {
    return DEFAULT_VELOCITY_ZONES;
  }

  const p25 = percentile(velocities, 0.25);
  const p50 = percentile(velocities, 0.5);
  const p75 = percentile(velocities, 0.75);
  const max = velocities[velocities.length - 1];

  return [
    { name: 'MAX STRENGTH', minV: 0, maxV: Number(p25.toFixed(2)), color: GarageTheme.danger, desc: '履歴下位25%の低速域' },
    { name: 'HYPERTROPHY', minV: Number(p25.toFixed(2)), maxV: Number(p50.toFixed(2)), color: GarageTheme.success, desc: '履歴25-50%の中低速域' },
    { name: 'SPEED STRENGTH', minV: Number(p50.toFixed(2)), maxV: Number(p75.toFixed(2)), color: GarageTheme.accent, desc: '履歴50-75%の中高速域' },
    { name: 'POWER', minV: Number(p75.toFixed(2)), maxV: Number(Math.max(max, p75 + 0.05).toFixed(2)), color: GarageTheme.accentSoft, desc: '履歴上位25%の高速域' },
  ];
};

type TabType = 'lvp' | 'trend' | 'zones';

export default function GraphScreen() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [activeTab, setActiveTab] = useState<TabType>('lvp');
  const [selectedExercise, setSelectedExercise] = useState('ベンチプレス');
  const [selectedGroup, setSelectedGroup] = useState<ExerciseSelectionGroupId>('all');
  const [lvpData, setLvpData] = useState<LVPData | null>(null);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [recentSets, setRecentSets] = useState<SetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [e1rmEstimate, setE1rmEstimate] = useState<number | null>(null);
  const [exercisesList, setExercisesList] = useState<Exercise[]>([]);

  useEffect(() => {
    if (isFocused) {
      void loadExercises();
    }
  }, [isFocused]);

  const loadExercises = async () => {
    try {
      const exs = await DatabaseService.getExercises();
      setExercisesList(exs);
      if (exs.length > 0 && (!selectedExercise || selectedExercise === 'ベンチプレス')) {
        setSelectedExercise(exs[0].name);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isFocused && selectedExercise) {
      void loadData();
    }
  }, [isFocused, selectedExercise]);

  const filteredExercises = useMemo(
    () => exercisesList.filter((exercise) => matchesExerciseSelectionGroup(exercise, selectedGroup)),
    [exercisesList, selectedGroup],
  );

  useEffect(() => {
    if (filteredExercises.length === 0) return;
    if (!filteredExercises.some((exercise) => exercise.name === selectedExercise)) {
      setSelectedExercise(filteredExercises[0].name);
    }
  }, [filteredExercises, selectedExercise]);

  const velocityZones = useMemo(
    () => buildVelocityZonesFromHistory(recentSets),
    [recentSets],
  );

  const loadData = async () => {
    setLoading(true);
    try {
      // DBからLVPプロファイルを取得（なければデモデータ）
      const lvp = await DatabaseService.getLVPProfile(selectedExercise);
      if (lvp) {
        setLvpData(lvp);
        const est1rm = Math.abs(lvp.intercept / lvp.slope);
        setE1rmEstimate(est1rm);
      } else {
        // デモ用フォールバック
        const demo: LVPData = {
          lift: selectedExercise,
          vmax: 1.5,
          v1rm: 0.15,
          slope: -0.0135,
          intercept: 1.65,
          r_squared: 0.95,
          last_updated: new Date().toISOString(),
        };
        setLvpData(demo);
        setE1rmEstimate(Math.abs(demo.intercept / demo.slope));
      }

      // 最近のセッションをDBから取得
      const allSessions = await DatabaseService.getSessions();
      setSessions(allSessions.slice(0, 10));

      // 最新5セッションのセットデータを集める
      const allSets: SetData[] = [];
      for (const session of allSessions.slice(0, 5)) {
        const sets = await DatabaseService.getSetsForSession(session.session_id);
        const filtered = sets.filter(s => s.lift === selectedExercise);
        allSets.push(...filtered);
      }
      setRecentSets(allSets.slice(0, 20));
    } catch (error) {
      console.error('LVPデータ読み込み失敗:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    await loadExercises();
    if (selectedExercise) {
      await loadData();
    }
  };

  // LVPラインをシンプルなバー表示で描画（react-native-chart-kitが不要）
  const renderLVPBars = () => {
    if (!lvpData) return null;
    const loads = [20, 40, 60, 80, 100, 120, 140];
    const maxVel = lvpData.vmax;

    return (
      <View style={styles.barsContainer}>
        <Text style={styles.subLabel}>負荷 → 速度プロファイル</Text>
        {loads.map(load => {
          const vel = Math.max(0, lvpData.intercept + lvpData.slope * load);
          const pct = (vel / maxVel) * 100;
          const zone = AICoachService.getZone(vel);
          return (
            <View key={load} style={styles.barRow}>
              <Text style={styles.barLabel}>{load}kg</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: zone.color }]} />
              </View>
              <Text style={[styles.barValue, { color: zone.color }]}>{vel.toFixed(2)}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  // 過去セッションのボリュームトレンドを表示
  const renderVolumeTrend = () => {
    if (sessions.length === 0) {
      return (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>まだセッションデータがありません</Text>
          <Text style={styles.noDataSubText}>トレーニングを記録してください</Text>
        </View>
      );
    }

    const maxVol = Math.max(...sessions.map(s => s.total_volume || 0));
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SESSION VOLUME</Text>
        {sessions.map((session, idx) => {
          const vol = session.total_volume || 0;
          const pct = maxVol > 0 ? (vol / maxVol) * 100 : 0;
          return (
            <View key={idx} style={styles.barRow}>
              <Text style={styles.barLabel}>{session.date.slice(5)}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: GarageTheme.accent }]} />
              </View>
              <Text style={[styles.barValue, { color: GarageTheme.accent }]}>
                {Math.round(vol).toLocaleString()}
              </Text>
            </View>
          );
        })}
        <Text style={styles.unitLabel}>単位: kg（総ボリューム）</Text>
      </View>
    );
  };

  // 最近のセット速度トレンド
  const renderVelocityTrend = () => {
    if (recentSets.length === 0) {
      return (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>{selectedExercise} のデータがありません</Text>
        </View>
      );
    }

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{selectedExercise} / VELOCITY TREND</Text>
        {recentSets.map((set, idx) => {
          const vel = set.avg_velocity ?? 0;
          const zone = AICoachService.getZone(vel);
          return (
            <View key={idx} style={styles.trendRow}>
              <Text style={styles.trendSetLabel}>#{set.set_index}</Text>
              <Text style={styles.trendLoad}>{set.load_kg}kg×{set.reps}</Text>
              <View style={styles.trendZone}>
                <Text style={[styles.trendZoneText, { color: zone.color }]}>
                  {zone.name}  {vel.toFixed(2)} m/s
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.header, { paddingTop: (insets.top || 0) + 12 }]}>
        <Text style={styles.title}>LVP GRAPH</Text>
        <TouchableOpacity style={styles.refreshChip} onPress={() => void handleRefresh()}>
          <Text style={styles.refreshChipText}>最新化</Text>
        </TouchableOpacity>
      </View>

      {/* 種目選択（カテゴリ起点） */}
      {activeTab !== 'zones' && exercisesList.length > 0 && (
        <View style={styles.exercisePickerSection}>
          <Text style={styles.exercisePickerLabel}>CATEGORY / EXERCISE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.exerciseScroll}>
            {EXERCISE_SELECTION_GROUPS.map((group) => (
              <TouchableOpacity
                key={group.id}
                style={[styles.groupChip, selectedGroup === group.id && styles.groupChipActive]}
                onPress={() => setSelectedGroup(group.id)}
              >
                <Text style={[styles.groupChipText, selectedGroup === group.id && styles.groupChipTextActive]}>
                  {group.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.exerciseScroll}>
            {filteredExercises.map((ex) => (
              <TouchableOpacity
                key={ex.id}
                style={[styles.exerciseButton, selectedExercise === ex.name && styles.exerciseButtonActive]}
                onPress={() => setSelectedExercise(ex.name)}
              >
                <Text style={[styles.exerciseButtonText, selectedExercise === ex.name && styles.exerciseButtonTextActive]}>
                  {ex.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* タブ切替 */}
      <View style={styles.tabBar}>
        {(['lvp', 'trend', 'zones'] as TabType[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'lvp' ? 'LVP' : tab === 'trend' ? '進捗' : '速度ゾーン'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab !== 'zones' && filteredExercises.length === 0 && !loading ? (
        <View style={styles.noDataContainer}>
          <Text style={styles.noDataText}>種目データがまだありません</Text>
          <Text style={styles.noDataSubText}>手動入力かセッション記録を作成するとここに表示されます</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={GarageTheme.accent} />
        </View>
      ) : (
        <>
          {/* LVPタブ */}
          {activeTab === 'lvp' && lvpData && (
            <>
              {/* 統計カード */}
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>Vmax</Text>
                  <Text style={styles.statValue}>{lvpData.vmax.toFixed(2)}</Text>
                  <Text style={styles.statUnit}>m/s</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>V@1RM</Text>
                  <Text style={styles.statValue}>{lvpData.v1rm.toFixed(2)}</Text>
                  <Text style={styles.statUnit}>m/s</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>R²</Text>
                  <Text style={[styles.statValue, { color: lvpData.r_squared > 0.9 ? GarageTheme.success : GarageTheme.warning }]}>
                    {lvpData.r_squared.toFixed(2)}
                  </Text>
                  <Text style={styles.statUnit}>適合度</Text>
                </View>
                <View style={[styles.statCard, { borderColor: GarageTheme.borderStrong, borderWidth: 1 }]}>
                  <Text style={styles.statLabel}>推定1RM</Text>
                  <Text style={[styles.statValue, { color: GarageTheme.accentSoft }]}>
                    {e1rmEstimate?.toFixed(1)}
                  </Text>
                  <Text style={styles.statUnit}>kg</Text>
                </View>
              </View>

              {/* バーグラフでLVP表示 */}
              <View style={styles.section}>{renderLVPBars()}</View>
            </>
          )}

          {/* 進捗タブ */}
          {activeTab === 'trend' && (
            <>
              {renderVolumeTrend()}
              {renderVelocityTrend()}
            </>
          )}

          {/* 速度ゾーンタブ */}
          {activeTab === 'zones' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>速度ゾーンガイド</Text>
              {velocityZones.map((zone) => (
                <View key={zone.name} style={[styles.zoneCard, { borderLeftColor: zone.color }]}>
                  <View style={[styles.zoneIndicator, { backgroundColor: zone.color }]} />
                  <View style={styles.zoneInfo}>
                    <Text style={[styles.zoneName, { color: zone.color }]}>{zone.name}</Text>
                    <Text style={styles.zoneRange}>{zone.minV} – {zone.maxV} m/s</Text>
                    <Text style={styles.zoneDesc}>{zone.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: GarageTheme.background },
  header: { padding: 16, borderBottomWidth: 1, borderBottomColor: GarageTheme.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 22, fontWeight: 'bold', color: GarageTheme.textStrong },
  refreshChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: GarageTheme.border, backgroundColor: GarageTheme.panel },
  refreshChipText: { color: GarageTheme.textStrong, fontSize: 12, fontWeight: '700' },
  exercisePickerSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  exercisePickerLabel: {
    color: GarageTheme.accentSoft,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  tabBar: {
    flexDirection: 'row', margin: 16, backgroundColor: GarageTheme.surfaceAlt,
    borderRadius: 10, padding: 4,
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 7 },
  tabActive: { backgroundColor: GarageTheme.accent },
  tabText: { color: GarageTheme.textMuted, fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: GarageTheme.textStrong },
  exerciseScroll: { marginBottom: 4 },
  groupChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#3a261d',
    backgroundColor: '#141414',
    marginRight: 8,
    marginBottom: 10,
  },
  groupChipActive: {
    backgroundColor: '#5b2515',
    borderColor: GarageTheme.accent,
  },
  groupChipText: { color: GarageTheme.textMuted, fontSize: 12, fontWeight: '700' },
  groupChipTextActive: { color: GarageTheme.textStrong },
  exerciseButton: {
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: GarageTheme.surfaceAlt, borderRadius: 20, marginRight: 8,
  },
  exerciseButtonActive: { backgroundColor: GarageTheme.panel, borderColor: GarageTheme.accent, borderWidth: 1 },
  exerciseButtonText: { color: GarageTheme.textMuted, fontSize: 13 },
  exerciseButtonTextActive: { color: GarageTheme.textStrong, fontWeight: '600' },
  loadingContainer: { padding: 60, alignItems: 'center' },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 12, marginBottom: 8,
  },
  statCard: {
    width: '48%', margin: '1%',
    backgroundColor: GarageTheme.surfaceAlt, borderRadius: 10,
    padding: 12, alignItems: 'center',
  },
  statLabel: { fontSize: 11, color: GarageTheme.textMuted, marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: 'bold', color: GarageTheme.accent },
  statUnit: { fontSize: 11, color: GarageTheme.textSubtle, marginTop: 2 },
  section: { padding: 16 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: GarageTheme.textStrong, marginBottom: 12 },
  subLabel: { fontSize: 13, color: GarageTheme.textMuted, marginBottom: 12 },
  barsContainer: { gap: 8 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 44, fontSize: 12, color: GarageTheme.textMuted, textAlign: 'right' },
  barTrack: {
    flex: 1, height: 18, backgroundColor: GarageTheme.surfaceAlt,
    borderRadius: 4, overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 4, minWidth: 4 },
  barValue: { width: 40, fontSize: 12, textAlign: 'right' },
  unitLabel: { fontSize: 11, color: GarageTheme.textSubtle, marginTop: 8, textAlign: 'right' },
  noDataContainer: { padding: 48, alignItems: 'center' },
  noDataText: { fontSize: 16, color: GarageTheme.textMuted, marginBottom: 8 },
  noDataSubText: { fontSize: 13, color: GarageTheme.textSubtle, textAlign: 'center' },
  trendRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2a2a2a',
  },
  trendSetLabel: { width: 28, fontSize: 12, color: GarageTheme.textSubtle },
  trendLoad: { width: 80, fontSize: 13, color: GarageTheme.textStrong },
  trendZone: { flex: 1, alignItems: 'flex-end' },
  trendZoneText: { fontSize: 14, fontWeight: '600' },
  zoneCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: GarageTheme.surfaceAlt, padding: 14,
    borderRadius: 10, marginBottom: 10, borderLeftWidth: 4,
  },
  zoneIndicator: { width: 4, height: 50, borderRadius: 2, marginRight: 12 },
  zoneInfo: { flex: 1 },
  zoneName: { fontSize: 16, fontWeight: 'bold', marginBottom: 2 },
  zoneRange: { fontSize: 13, color: GarageTheme.textMuted, marginBottom: 2 },
  zoneDesc: { fontSize: 12, color: GarageTheme.textSubtle },
});
