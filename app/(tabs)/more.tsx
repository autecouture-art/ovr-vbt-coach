import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { GarageTheme } from "@/src/constants/garageTheme";

type RouteTarget = "/(tabs)/settings" | "/(tabs)/import" | "/(tabs)/history" | "/exercise-history" | "/glossary" | "/feedback";

type MoreRow = {
  id: string;
  title: string;
  description: string;
  icon: string;
  route: RouteTarget;
};

type MoreSection = {
  id: string;
  title: string;
  rows: MoreRow[];
};

const MORE_SECTIONS: MoreSection[] = [
  {
    id: "training",
    title: "トレーニング",
    rows: [
      {
        id: "training-settings",
        title: "トレーニング設定",
        description: "単位、VBT、ブロック設定を調整",
        icon: "figure.strengthtraining.traditional",
        route: "/(tabs)/settings",
      },
    ],
  },
  {
    id: "sensor",
    title: "センサー",
    rows: [
      {
        id: "sensor-settings",
        title: "センサーと自動スタート",
        description: "接続状態と自動開始関連の設定",
        icon: "antenna.radiowaves.left.and.right",
        route: "/(tabs)/settings",
      },
    ],
  },
  {
    id: "audio-video",
    title: "音声・動画",
    rows: [
      {
        id: "audio-settings",
        title: "音声フィードバック",
        description: "読み上げ、ビープ、音量の調整",
        icon: "speaker.wave.2",
        route: "/(tabs)/settings",
      },
      {
        id: "video-settings",
        title: "フォーム動画設定",
        description: "録画と動画確認まわりの設定",
        icon: "video",
        route: "/(tabs)/settings",
      },
    ],
  },
  {
    id: "data",
    title: "データ",
    rows: [
      {
        id: "data-management",
        title: "データ管理",
        description: "インポート、エクスポート、保守",
        icon: "square.and.arrow.down",
        route: "/(tabs)/import",
      },
      {
        id: "session-history",
        title: "セッション履歴",
        description: "記録一覧と動画付きセットを確認",
        icon: "clock",
        route: "/(tabs)/history",
      },
      {
        id: "exercise-history",
        title: "種目履歴",
        description: "種目別の過去記録を確認",
        icon: "list.bullet.rectangle",
        route: "/exercise-history",
      },
    ],
  },
  {
    id: "dev",
    title: "開発・診断",
    rows: [
      {
        id: "my-reports",
        title: "私の報告",
        description: "気づき、対応状況、実機確認待ちを確認",
        icon: "flag",
        route: "/feedback",
      },
      {
        id: "dev-settings",
        title: "開発と診断",
        description: "表示項目、診断、種目マスタ設定",
        icon: "wrench.and.screwdriver",
        route: "/(tabs)/settings",
      },
    ],
  },
  {
    id: "reference",
    title: "参考",
    rows: [
      {
        id: "glossary",
        title: "用語集",
        description: "指標や略語の意味を確認",
        icon: "book",
        route: "/glossary",
      },
    ],
  },
];

export default function MoreTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>More</Text>
        <Text style={styles.subtitle}>設定・履歴・ツール</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {MORE_SECTIONS.map((section) => (
          <View key={section.id} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.list}>
              {section.rows.map((row, index) => (
                <TouchableOpacity
                  key={row.id}
                  style={[styles.row, index === section.rows.length - 1 && styles.rowLast]}
                  onPress={() => router.push(row.route as any)}
                  accessibilityRole="button"
                  accessibilityLabel={`${row.title}を開く`}
                >
                  <View style={styles.rowLeft}>
                    <View style={styles.rowIcon}>
                      <IconSymbol size={18} name={row.icon as any} color={GarageTheme.accent} />
                    </View>
                    <View style={styles.rowCopy}>
                      <Text style={styles.rowTitle}>{row.title}</Text>
                      <Text style={styles.rowDescription} numberOfLines={2}>
                        {row.description}
                      </Text>
                    </View>
                  </View>
                  <IconSymbol size={16} name="chevron.right" color={GarageTheme.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.footer}>
          <Text style={styles.footerText}>RepVelo Coach v2.3.5</Text>
          <Text style={styles.footerSubtext}>Velocity-Based Training Platform</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GarageTheme.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: GarageTheme.border,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    color: GarageTheme.textStrong,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: GarageTheme.textMuted,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingVertical: 16,
    paddingBottom: 32,
    gap: 16,
  },
  section: {
    paddingHorizontal: 16,
    gap: 10,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: GarageTheme.textMuted,
  },
  list: {
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    borderRadius: 8,
    overflow: "hidden",
  },
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: GarageTheme.border,
    gap: 10,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: GarageTheme.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  rowCopy: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: GarageTheme.textStrong,
  },
  rowDescription: {
    fontSize: 12,
    lineHeight: 16,
    color: GarageTheme.textMuted,
  },
  footer: {
    marginTop: 8,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  footerText: {
    fontSize: 12,
    color: GarageTheme.textSubtle,
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 11,
    color: GarageTheme.textSubtle,
  },
});
