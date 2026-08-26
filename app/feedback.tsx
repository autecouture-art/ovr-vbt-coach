import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";

import { GarageTheme } from "@/src/constants/garageTheme";
import ImprovementFeedbackService from "@/src/services/ImprovementFeedbackService";
import type { ImprovementIssueReceipt, QueuedImprovementFeedback } from "@/src/types/index";

export default function FeedbackScreen() {
  const router = useRouter();
  const [queue, setQueue] = useState<QueuedImprovementFeedback[]>([]);
  const [receipts, setReceipts] = useState<ImprovementIssueReceipt[]>([]);

  const reload = useCallback(async () => {
    const [nextQueue, nextReceipts] = await Promise.all([
      ImprovementFeedbackService.listQueued(),
      ImprovementFeedbackService.refreshReceipts().catch(() => ImprovementFeedbackService.listReceipts()),
    ]);
    setQueue(nextQueue);
    setReceipts(nextReceipts);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")} style={styles.back}>
          <Text style={styles.backText}>戻る</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.kicker}>IMPROVEMENT & DIAGNOSTICS</Text>
          <Text style={styles.title}>私の報告</Text>
        </View>
        <TouchableOpacity onPress={() => void reload()} style={styles.refresh}>
          <Text style={styles.refreshText}>更新</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.caption}>端末に保存した気づきは、セッション終了時または次回接続時に同期します。動画本体はここから送信しません。</Text>
        {queue.map((item) => {
          const receipt = receipts.find((value) => value.feedback_id === item.id);
          return (
            <View key={item.id} style={styles.row}>
              <Text style={styles.status}>{receipt?.state ?? item.status}</Text>
              <Text style={styles.note}>{item.note}</Text>
              <Text style={styles.meta}>{new Date(item.created_at).toLocaleString()}</Text>
              {receipt?.issue_id ? <Text style={styles.meta}>Issue {receipt.issue_id}</Text> : null}
              {receipt?.note ? <Text style={styles.receipt}>{receipt.note}</Text> : null}
            </View>
          );
        })}
        {queue.length === 0 ? <Text style={styles.empty}>まだ報告はありません。</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: GarageTheme.background },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 56, paddingBottom: 14, borderBottomWidth: 1, borderColor: GarageTheme.border },
  back: { minHeight: 44, justifyContent: "center" }, backText: { color: GarageTheme.accent, fontWeight: "700" },
  kicker: { color: GarageTheme.accent, fontSize: 10, fontWeight: "700" }, title: { color: GarageTheme.textStrong, fontSize: 20, fontWeight: "700" },
  refresh: { marginLeft: "auto", minHeight: 44, justifyContent: "center" }, refreshText: { color: GarageTheme.textStrong, fontWeight: "700" },
  content: { padding: 16, gap: 10 }, caption: { color: GarageTheme.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 8 },
  row: { paddingVertical: 14, borderBottomWidth: 1, borderColor: GarageTheme.border, gap: 5 }, status: { color: GarageTheme.accent, fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  note: { color: GarageTheme.textStrong, fontSize: 16, lineHeight: 22 }, meta: { color: GarageTheme.textMuted, fontSize: 12 }, receipt: { color: GarageTheme.textMuted, fontSize: 13 }, empty: { color: GarageTheme.textMuted, textAlign: "center", paddingVertical: 40 },
});
