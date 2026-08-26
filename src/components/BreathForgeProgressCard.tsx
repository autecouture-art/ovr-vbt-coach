import React, { useCallback, useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { GarageTheme } from "@/src/constants/garageTheme";
import {
  completedBreathSessionsThisWeek,
  loadBreathForgeHistory,
  openBreathForgeHome,
} from "@/src/services/BreathForgeIntegrationService";
import type { BreathForgeSharedHistory } from "@/src/native/BreathForgeAppGroupModule";

const displayLevel = (quarterStep: number) => {
  const value = quarterStep / 4;
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
};

const sessionDate = (startedAt: string) => {
  const date = new Date(startedAt);
  if (Number.isNaN(date.getTime())) return "日時不明";
  return date.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export function BreathForgeProgressCard() {
  const [history, setHistory] = useState<BreathForgeSharedHistory | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    setHistory(await loadBreathForgeHistory());
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sessions = history?.sessions ?? [];
  const weeklyCompleted = completedBreathSessionsThisWeek(history);
  const latest = sessions[0] ?? null;

  const handleOpenBreathForge = useCallback(async () => {
    if (await openBreathForgeHome()) return;
    Alert.alert(
      "BREATHFORGEを開けません",
      "同じiPhoneにBREATHFORGEをインストールしてから再試行してください。",
    );
  }, []);

  return (
    <View style={styles.card} accessible accessibilityLabel="呼吸筋の記録">
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>BREATHFORGE // 30</Text>
          <Text style={styles.title}>呼吸筋</Text>
        </View>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={() => void refresh()}
          accessibilityLabel="呼吸筋履歴を再読込"
        >
          <Text style={styles.refreshText}>更新</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.summary}>
        今週 {weeklyCompleted} / 14 セッション · 全 {sessions.length} 件
      </Text>
      {latest ? (
        <Text style={styles.latest}>
          最新: Level {displayLevel(latest.quarter_step)} · 約 {Math.round(latest.estimated_pressure_cmh2o)} cmH₂O
        </Text>
      ) : (
        <Text style={styles.empty}>
          {loaded
            ? "共有履歴がありません。BREATHFORGEで最初の記録を保存してください。"
            : "共有履歴を確認中…"}
        </Text>
      )}

      {sessions.map((session) => (
        <View key={session.id} style={styles.historyRow}>
          <View style={styles.historyCopy}>
            <Text style={styles.historyTitle}>
              {sessionDate(session.started_at)} · {session.mode === "warmUp" ? "ウォームアップ" : "通常"}
            </Text>
            <Text style={styles.historyMeta}>
              Level {displayLevel(session.quarter_step)} · {session.completed_breaths} 呼吸
              {session.rpe != null ? ` · RPE ${session.rpe}` : ""}
              {session.form_quality ? ` · ${session.form_quality}` : ""}
            </Text>
          </View>
          <Text style={session.completion_state === "complete" ? styles.complete : styles.partial}>
            {session.completion_state === "complete" ? "完了" : "途中"}
          </Text>
        </View>
      ))}

      <TouchableOpacity
        style={styles.openButton}
        onPress={() => void handleOpenBreathForge()}
        accessibilityLabel="BREATHFORGEで記録と編集を開く"
      >
        <Text style={styles.openButtonText}>BREATHFORGEで記録・編集</Text>
      </TouchableOpacity>
      <Text style={styles.privacy}>
        症状と自由メモは共有せず、BREATHFORGE内だけに保存されます。
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    borderRadius: 8,
    padding: 14,
    gap: 9,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kicker: {
    color: GarageTheme.textMuted,
    fontSize: 10,
    fontWeight: "700",
  },
  title: {
    color: GarageTheme.textStrong,
    fontSize: 18,
    fontWeight: "700",
  },
  refreshButton: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderRadius: 7,
    backgroundColor: GarageTheme.panel,
  },
  refreshText: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  summary: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: "600",
  },
  latest: {
    color: GarageTheme.info,
    fontSize: 12,
  },
  empty: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: GarageTheme.border,
    paddingTop: 9,
  },
  historyCopy: {
    flex: 1,
    gap: 2,
  },
  historyTitle: {
    color: GarageTheme.textStrong,
    fontSize: 12,
    fontWeight: "600",
  },
  historyMeta: {
    color: GarageTheme.textMuted,
    fontSize: 11,
  },
  complete: {
    color: GarageTheme.success,
    fontSize: 11,
    fontWeight: "700",
  },
  partial: {
    color: GarageTheme.warning,
    fontSize: 11,
    fontWeight: "700",
  },
  openButton: {
    minHeight: 44,
    borderRadius: 7,
    backgroundColor: GarageTheme.info,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 3,
  },
  openButtonText: {
    color: GarageTheme.textStrong,
    fontSize: 13,
    fontWeight: "700",
  },
  privacy: {
    color: GarageTheme.textSubtle,
    fontSize: 10,
    lineHeight: 14,
  },
});
