import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import DatabaseService from '@/src/services/DatabaseService';
import type { SessionData, SetData } from '@/src/types/index';
import { firstRouteParam } from '@/src/utils/routeParams';
import { formatSessionLabel } from '@/src/utils/session';

export default function SessionDetailScreen() {
  const router = useRouter();
  const navigationState = useNavigation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ sessionId?: string | string[] }>();
  const sessionId = firstRouteParam(params.sessionId) ?? '';
  const [session, setSession] = useState<SessionData | null>(null);
  const [sets, setSets] = useState<SetData[]>([]);

  useEffect(() => {
    const load = async () => {
      await DatabaseService.initialize();
      if (!sessionId) return;
      const [loadedSession, loadedSets] = await Promise.all([
        DatabaseService.getSession(sessionId),
        DatabaseService.getSetsForSession(sessionId),
      ]);
      setSession(loadedSession);
      setSets(loadedSets);
    };

    void load();
  }, [sessionId]);

  const liftNames = useMemo(
    () => Array.from(new Set(sets.map((set) => set.lift))),
    [sets],
  );

  const totalVolume = useMemo(
    () => sets.reduce((sum, set) => sum + set.load_kg * set.reps, 0),
    [sets],
  );

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }} onPress={() => (navigationState.canGoBack() ? router.back() : router.replace('/'))}>
          <Text style={styles.backButton}>← 戻る</Text>
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>セッション詳細</Text>
          <Text style={styles.subtitle}>{session ? formatSessionLabel(session.session_id, session.date) : sessionId}</Text>
        </View>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>サマリー</Text>
        <Text style={styles.summaryLine}>種目: {liftNames.join(' / ') || 'なし'}</Text>
        <Text style={styles.summaryLine}>セット数: {sets.length}</Text>
        <Text style={styles.summaryLine}>総ボリューム: {Math.round(totalVolume)} kg</Text>
        <TouchableOpacity
          style={styles.coachButton}
          onPress={() =>
            router.push({
              pathname: '/coach-chat',
              params: {
                source: 'session-detail',
                sessionId,
                currentExercise: liftNames[0] ?? '',
                totalSets: String(sets.length),
                totalVolume: String(Math.round(totalVolume)),
                message: 'このセッションを振り返って改善点を教えて',
              },
            })
          }
        >
          <Text style={styles.coachButtonText}>AIコーチに振り返りを聞く</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>セット一覧</Text>
        {sets.map((set) => (
          <View key={`${set.session_id}_${set.set_index}_${set.lift}`} style={styles.setCard}>
            <Text style={styles.setTitle}>{set.lift} / セット {set.set_index}</Text>
            <Text style={styles.setMeta}>{set.load_kg} kg × {set.reps} reps</Text>
            {set.e1rm ? <Text style={styles.setMeta}>e1RM {set.e1rm.toFixed(1)} kg</Text> : null}
            {set.velocity_loss !== null ? (
              <Text style={styles.setMeta}>VL {set.velocity_loss.toFixed(1)}%</Text>
            ) : null}
            {set.notes ? <Text style={styles.notes}>{set.notes}</Text> : null}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f10' },
  header: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2220',
  },
  backButton: { color: '#ffb347', fontSize: 16, fontWeight: '700', marginBottom: 12 },
  headerCopy: { gap: 4 },
  title: { color: '#fff4ec', fontSize: 28, fontWeight: '800' },
  subtitle: { color: '#9f8a80', fontSize: 14 },
  summaryCard: {
    margin: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#181414',
    borderWidth: 1,
    borderColor: '#3d2a24',
  },
  summaryTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 12 },
  summaryLine: { color: '#d7cbc5', fontSize: 14, marginBottom: 6 },
  coachButton: {
    marginTop: 14,
    backgroundColor: '#ff5a1f',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  coachButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  listSection: { paddingHorizontal: 16, paddingBottom: 24 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 12 },
  setCard: {
    backgroundColor: '#171717',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#2d2d2d',
  },
  setTitle: { color: '#fff2e8', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  setMeta: { color: '#b8aaa1', fontSize: 13, marginBottom: 4 },
  notes: { color: '#8cc7ff', fontSize: 12, marginTop: 6 },
});
