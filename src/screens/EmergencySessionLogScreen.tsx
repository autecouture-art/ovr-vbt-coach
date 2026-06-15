import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GarageTheme } from "@/src/constants/garageTheme";

type EmergencySetLog = {
  id: string;
  created_at: string;
  lift: string;
  load_kg: number | null;
  reps: number | null;
  rpe: number | null;
  note: string;
};

type EmergencySessionLogScreenProps = {
  onClose: () => void;
};

const STORAGE_KEY = "repvelocoach.emergency_session_log.v1";

const parseNumber = (value: string): number | null => {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatNumber = (value: number | null): string => {
  if (value == null) return "-";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
};

const formatTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

const buildMarkdown = (logs: EmergencySetLog[]): string => {
  const createdAt = new Date().toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const rows = logs
    .map(
      (log, index) =>
        `| ${index + 1} | ${formatTime(log.created_at)} | ${log.lift || "-"} | ${formatNumber(log.load_kg)} | ${formatNumber(log.reps)} | ${formatNumber(log.rpe)} | ${log.note || "-"} |`,
    )
    .join("\n");

  return [
    "# RepVeloCoach 緊急トレーニング記録",
    "",
    `出力日時: ${createdAt}`,
    "",
    "| # | time | lift | kg | reps | RPE | note |",
    "|---:|---|---|---:|---:|---:|---|",
    rows || "| - | - | - | - | - | - | - |",
  ].join("\n");
};

export default function EmergencySessionLogScreen({
  onClose,
}: EmergencySessionLogScreenProps) {
  const insets = useSafeAreaInsets();
  const [logs, setLogs] = useState<EmergencySetLog[]>([]);
  const [lift, setLift] = useState("Bench Press");
  const [load, setLoad] = useState("");
  const [reps, setReps] = useState("");
  const [rpe, setRpe] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled || !raw) return;
        const parsed = JSON.parse(raw) as EmergencySetLog[];
        if (Array.isArray(parsed)) {
          setLogs(parsed.slice(-80));
        }
      })
      .catch((error) => {
        console.warn("[EmergencySessionLog] Failed to load logs:", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const totalVolume = useMemo(
    () =>
      logs.reduce((sum, item) => {
        if (item.load_kg == null || item.reps == null) return sum;
        return sum + item.load_kg * item.reps;
      }, 0),
    [logs],
  );

  const saveLogs = async (nextLogs: EmergencySetLog[]) => {
    setLogs(nextLogs);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextLogs.slice(-80)));
  };

  const handleAddSet = async () => {
    const nextLog: EmergencySetLog = {
      id: `emergency_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      created_at: new Date().toISOString(),
      lift: lift.trim() || "Unknown",
      load_kg: parseNumber(load),
      reps: parseNumber(reps),
      rpe: parseNumber(rpe),
      note: note.trim(),
    };

    const nextLogs = [...logs, nextLog].slice(-80);
    await saveLogs(nextLogs);
    setNote("");
  };

  const handleDeleteLatest = async () => {
    await saveLogs(logs.slice(0, -1));
  };

  const handleClear = () => {
    Alert.alert("緊急記録をクリア", "この画面の一時記録を全削除します。", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除",
        style: "destructive",
        onPress: () => {
          void saveLogs([]);
        },
      },
    ]);
  };

  const handleShare = async () => {
    const markdown = buildMarkdown(logs);
    await Clipboard.setStringAsync(markdown);
    await Share.share({
      title: "RepVeloCoach emergency training log",
      message: markdown,
    });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Math.max(insets.top + 16, 28) },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onClose}>
          <Text style={styles.backButtonText}>戻る</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>緊急記録</Text>
        <TouchableOpacity style={styles.shareButton} onPress={() => void handleShare()}>
          <Text style={styles.shareButtonText}>共有</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryCard}>
        <Text style={styles.eyebrow}>SAFE FALLBACK</Text>
        <Text style={styles.title}>明日の保険モード</Text>
        <Text style={styles.description}>
          セッション本体が不安定な時でも、セット記録だけはここに残せます。
          VBT値は取れませんが、種目・重量・回数・RPE・メモを後から復元できます。
        </Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{logs.length}</Text>
            <Text style={styles.summaryLabel}>sets</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{Math.round(totalVolume)}</Text>
            <Text style={styles.summaryLabel}>kg volume</Text>
          </View>
        </View>
      </View>

      <View style={styles.inputCard}>
        <Text style={styles.sectionTitle}>セット追加</Text>
        <Text style={styles.label}>種目</Text>
        <TextInput
          style={styles.input}
          value={lift}
          onChangeText={setLift}
          placeholder="Bench Press"
          placeholderTextColor={GarageTheme.textMuted}
          autoCapitalize="words"
        />

        <View style={styles.inputGrid}>
          <View style={styles.inputCell}>
            <Text style={styles.label}>重量 kg</Text>
            <TextInput
              style={styles.input}
              value={load}
              onChangeText={setLoad}
              keyboardType="decimal-pad"
              placeholder="100"
              placeholderTextColor={GarageTheme.textMuted}
            />
          </View>
          <View style={styles.inputCell}>
            <Text style={styles.label}>回数</Text>
            <TextInput
              style={styles.input}
              value={reps}
              onChangeText={setReps}
              keyboardType="number-pad"
              placeholder="5"
              placeholderTextColor={GarageTheme.textMuted}
            />
          </View>
          <View style={styles.inputCell}>
            <Text style={styles.label}>RPE</Text>
            <TextInput
              style={styles.input}
              value={rpe}
              onChangeText={setRpe}
              keyboardType="decimal-pad"
              placeholder="8"
              placeholderTextColor={GarageTheme.textMuted}
            />
          </View>
        </View>

        <Text style={styles.label}>メモ</Text>
        <TextInput
          style={[styles.input, styles.noteInput]}
          value={note}
          onChangeText={setNote}
          placeholder="フォーム、痛み、補助、失敗理由など"
          placeholderTextColor={GarageTheme.textMuted}
          multiline
        />

        <TouchableOpacity style={styles.primaryButton} onPress={() => void handleAddSet()}>
          <Text style={styles.primaryButtonText}>このセットを追加</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.historyCard}>
        <View style={styles.historyHeader}>
          <Text style={styles.sectionTitle}>今日の一時記録</Text>
          <View style={styles.historyActions}>
            <TouchableOpacity
              style={styles.smallButton}
              onPress={() => void handleDeleteLatest()}
              disabled={logs.length === 0}
            >
              <Text style={styles.smallButtonText}>最新削除</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.smallButton, styles.dangerButton]}
              onPress={handleClear}
              disabled={logs.length === 0}
            >
              <Text style={styles.dangerButtonText}>全削除</Text>
            </TouchableOpacity>
          </View>
        </View>

        {logs.length === 0 ? (
          <Text style={styles.emptyText}>まだ記録はありません。</Text>
        ) : (
          logs
            .slice()
            .reverse()
            .map((item) => (
              <View key={item.id} style={styles.logRow}>
                <View style={styles.logTopRow}>
                  <Text style={styles.logLift}>{item.lift}</Text>
                  <Text style={styles.logTime}>{formatTime(item.created_at)}</Text>
                </View>
                <Text style={styles.logMeta}>
                  {formatNumber(item.load_kg)} kg x {formatNumber(item.reps)} reps
                  {item.rpe != null ? ` / RPE ${formatNumber(item.rpe)}` : ""}
                </Text>
                {item.note ? <Text style={styles.logNote}>{item.note}</Text> : null}
              </View>
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
  content: {
    paddingHorizontal: 16,
    paddingBottom: 34,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backButton: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  backButtonText: {
    color: GarageTheme.accent,
    fontSize: 15,
    fontWeight: "600",
  },
  headerTitle: {
    color: GarageTheme.textStrong,
    fontSize: 20,
    fontWeight: "600",
  },
  shareButton: {
    minHeight: 40,
    minWidth: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: GarageTheme.accent + "22",
    borderWidth: 1,
    borderColor: GarageTheme.accent,
  },
  shareButtonText: {
    color: GarageTheme.accent,
    fontSize: 13,
    fontWeight: "600",
  },
  summaryCard: {
    padding: 18,
    borderRadius: 12,
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
  },
  eyebrow: {
    color: GarageTheme.warning,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0,
  },
  title: {
    color: GarageTheme.textStrong,
    fontSize: 28,
    fontWeight: "600",
    marginTop: 8,
  },
  description: {
    color: GarageTheme.textMuted,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 20,
    marginTop: 10,
  },
  summaryRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  summaryItem: {
    flex: 1,
    borderRadius: 12,
    padding: 14,
    backgroundColor: GarageTheme.panel,
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  summaryValue: {
    color: GarageTheme.textStrong,
    fontSize: 24,
    fontWeight: "600",
  },
  summaryLabel: {
    color: GarageTheme.textMuted,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 3,
  },
  inputCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  sectionTitle: {
    color: GarageTheme.textStrong,
    fontSize: 16,
    fontWeight: "600",
  },
  label: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 14,
    marginBottom: 7,
  },
  input: {
    minHeight: 46,
    borderRadius: 12,
    paddingHorizontal: 13,
    color: GarageTheme.textStrong,
    backgroundColor: GarageTheme.panel,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    fontSize: 16,
    fontWeight: "600",
  },
  noteInput: {
    minHeight: 76,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  inputGrid: {
    flexDirection: "row",
    gap: 10,
  },
  inputCell: {
    flex: 1,
  },
  primaryButton: {
    marginTop: 16,
    minHeight: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GarageTheme.accent,
  },
  primaryButtonText: {
    color: GarageTheme.background,
    fontSize: 15,
    fontWeight: "600",
  },
  historyCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: GarageTheme.panel,
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  historyHeader: {
    gap: 12,
  },
  historyActions: {
    flexDirection: "row",
    gap: 10,
  },
  smallButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  smallButtonText: {
    color: GarageTheme.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  dangerButton: {
    borderColor: GarageTheme.danger,
    backgroundColor: GarageTheme.danger + "1A",
  },
  dangerButtonText: {
    color: GarageTheme.danger,
    fontSize: 13,
    fontWeight: "600",
  },
  emptyText: {
    color: GarageTheme.textMuted,
    fontSize: 13,
    fontWeight: "500",
    marginTop: 14,
  },
  logRow: {
    marginTop: 12,
    padding: 13,
    borderRadius: 12,
    backgroundColor: GarageTheme.background,
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  logTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  logLift: {
    flex: 1,
    color: GarageTheme.textStrong,
    fontSize: 15,
    fontWeight: "600",
  },
  logTime: {
    color: GarageTheme.textMuted,
    fontSize: 11,
    fontWeight: "600",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  logMeta: {
    color: GarageTheme.accent,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 6,
  },
  logNote: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 18,
    marginTop: 6,
  },
});
