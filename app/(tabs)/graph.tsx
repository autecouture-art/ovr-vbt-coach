/**
 * LVP Graph Screen
 * 負荷-速度プロファイル・進捗グラフ画面
 * DBから実データを取得してグラフ表示
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import DatabaseService from '@/src/services/DatabaseService';
import AICoachService from '@/src/services/AICoachService';
import { getLocalizedExerciseName } from '@/src/utils/exerciseLocalization';
import type { LVPData, SessionData, SetData, Exercise } from '@/src/types/index';

const { width } = Dimensions.get('window');

// 速度ゾーンの定義（日本語）
const VELOCITY_ZONES = [
  { name: '🔥 パワー', minV: 1.0, maxV: 1.5, color: '#FFD700', desc: '爆発的な力 (1RM 30-50%)' },
  { name: '⚡ スピード・ストレングス', minV: 0.75, maxV: 1.0, color: '#FF8C00', desc: '速い力 (1RM 50-70%)' },
  { name: '💪 筋肥大', minV: 0.5, maxV: 0.75, color: '#32CD32', desc: 'サイズアップ (1RM 70-85%)' },
  { name: '🏋️ 最大筋力', minV: 0.0, maxV: 0.5, color: '#DC143C', desc: '最大力 (1RM 85%+)' },
];

type TabType = 'lvp' | 'trend' | 'zones';

export default function GraphScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<TabType>('lvp');
  const [selectedExercise, setSelectedExercise] = useState('ベンチプレス');
  const [lvpData, setLvpData] = useState<LVPData | null>(null);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [recentSets, setRecentSets] = useState<SetData[]>([]);
  const [loading, setLoading] = useState(true);
  const [e1rmEstimate, setE1rmEstimate] = useState<number | null>(null);
  const [exercisesList, setExercisesList] = useState<Exercise[]>([]);

  useEffect(() => {
    loadExercises();
  }, []);

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
    if (selectedExercise) loadData();
  }, [selectedExercise]);

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
          <Text style={styles.noDataText}>📭 まだセッションデータがありません</Text>
          <Text style={styles.noDataSubText}>トレーニングを記録してください</Text>
        </View>
      );
    }

    const maxVol = Math.max(...sessions.map(s => s.total_volume || 0));
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📈 セッション別ボリューム</Text>
        {sessions.map((session, idx) => {
          const vol = session.total_volume || 0;
          const pct = maxVol > 0 ? (vol / maxVol) * 100 : 0;
          return (
            <View key={idx} style={styles.barRow}>
              <Text style={styles.barLabel}>{session.date.slice(5)}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: '#2196F3' }]} />
              </View>
              <Text style={[styles.barValue, { color: '#2196F3' }]}>
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
          <Text style={styles.noDataText}>⚡ {selectedExercise}のデータがありません</Text>
        </View>
      );
    }

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚡ {selectedExercise} — 最近の速度推移</Text>
        {recentSets.map((set, idx) => {
          const vel = set.avg_velocity ?? 0;
          const zone = AICoachService.getZone(vel);
          return (
            <View key={idx} style={styles.trendRow}>
              <Text style={styles.trendSetLabel}>#{set.set_index}</Text>
              <Text style={styles.trendLoad}>{set.load_kg}kg×{set.reps}</Text>
              <View style={styles.trendZone}>
                <Text style={[styles.trendZoneText, { color: zone.color }]}>
                  {zone.emoji} {vel.toFixed(2)} m/s
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
        <Text style={styles.headerEyebrow}>TELEMETRY DECK</Text>
        <Text style={styles.title}>LVP グラフ</Text>
      </View>

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

      {/* 種目選択（LVP/trend タブ） */}
      {activeTab !== 'zones' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.exerciseScroll}>
          {exercisesList.map((ex) => (
            <TouchableOpacity
              key={ex.id}
              style={[styles.exerciseButton, selectedExercise === ex.name && styles.exerciseButtonActive]}
              onPress={() => setSelectedExercise(ex.name)}
            >
              <Text style={[styles.exerciseButtonText, selectedExercise === ex.name && styles.exerciseButtonTextActive]}>
                {getLocalizedExerciseName(ex.name)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
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
                  <Text style={[styles.statValue, { color: lvpData.r_squared > 0.9 ? '#4CAF50' : '#FF9800' }]}>
                    {lvpData.r_squared.toFixed(2)}
                  </Text>
                  <Text style={styles.statUnit}>適合度</Text>
                </View>
                <View style={[styles.statCard, { borderColor: '#9C27B0', borderWidth: 1 }]}>
                  <Text style={styles.statLabel}>推定1RM</Text>
                  <Text style={[styles.statValue, { color: '#9C27B0' }]}>
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
              {VELOCITY_ZONES.map((zone) => (
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
  container: { flex: 1, backgroundColor: '#080808' },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#341810',
    backgroundColor: '#090909',
  },
  headerEyebrow: { color: '#ff6a2a', fontSize: 10, fontWeight: '800', letterSpacing: 2, marginBottom: 4 },
  title: { fontSize: 22, fontWeight: '800', color: '#fff5ee' },
  tabBar: {
    flexDirection: 'row', margin: 16, backgroundColor: '#141414',
    borderRadius: 14, padding: 4, borderWidth: 1, borderColor: '#341810',
  },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 7 },
  tabActive: { backgroundColor: '#ff5a1f' },
  tabText: { color: '#b8a79b', fontSize: 14, fontWeight: '700' },
  tabTextActive: { color: '#fff' },
  exerciseScroll: { paddingHorizontal: 16, marginBottom: 8 },
  exerciseButton: {
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: '#141414', borderRadius: 999, marginRight: 8, borderWidth: 1, borderColor: '#3b2218',
  },
  exerciseButtonActive: { backgroundColor: '#ff5a1f', borderColor: '#ff7a44' },
  exerciseButtonText: { color: '#b8a79b', fontSize: 13, fontWeight: '700' },
  exerciseButtonTextActive: { color: '#fff', fontWeight: '800' },
  loadingContainer: { padding: 60, alignItems: 'center' },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 12, marginBottom: 8,
  },
  statCard: {
    width: '48%', margin: '1%',
    backgroundColor: '#111111', borderRadius: 16,
    padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#432117',
  },
  statLabel: { fontSize: 11, color: '#b8a79b', marginBottom: 4, fontWeight: '700', letterSpacing: 1 },
  statValue: { fontSize: 22, fontWeight: '800', color: '#fff5ee' },
  statUnit: { fontSize: 11, color: '#8b786d', marginTop: 2 },
  section: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#fff5ee', marginBottom: 12 },
  subLabel: { fontSize: 13, color: '#ff6a2a', marginBottom: 12, fontWeight: '700', letterSpacing: 1 },
  barsContainer: { gap: 8 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { width: 44, fontSize: 12, color: '#d0c1b7', textAlign: 'right', fontWeight: '700' },
  barTrack: {
    flex: 1, height: 18, backgroundColor: '#171717',
    borderRadius: 999, overflow: 'hidden', borderWidth: 1, borderColor: '#3b2218',
  },
  barFill: { height: '100%', borderRadius: 999, minWidth: 4 },
  barValue: { width: 40, fontSize: 12, textAlign: 'right', fontWeight: '700' },
  unitLabel: { fontSize: 11, color: '#8b786d', marginTop: 8, textAlign: 'right' },
  noDataContainer: { padding: 48, alignItems: 'center' },
  noDataText: { fontSize: 16, color: '#d0c1b7', marginBottom: 8, fontWeight: '700' },
  noDataSubText: { fontSize: 13, color: '#8b786d', textAlign: 'center' },
  trendRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2a1812',
  },
  trendSetLabel: { width: 28, fontSize: 12, color: '#8b786d', fontWeight: '700' },
  trendLoad: { width: 80, fontSize: 13, color: '#fff5ee', fontWeight: '700' },
  trendZone: { flex: 1, alignItems: 'flex-end' },
  trendZoneText: { fontSize: 14, fontWeight: '600' },
  zoneCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#111111', padding: 14,
    borderRadius: 18, marginBottom: 10, borderLeftWidth: 4, borderWidth: 1, borderColor: '#432117',
  },
  zoneIndicator: { width: 4, height: 50, borderRadius: 2, marginRight: 12 },
  zoneInfo: { flex: 1 },
  zoneName: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  zoneRange: { fontSize: 13, color: '#d0c1b7', marginBottom: 2, fontWeight: '700' },
  zoneDesc: { fontSize: 12, color: '#8b786d' },
});
