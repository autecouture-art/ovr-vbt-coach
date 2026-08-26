import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { IconSymbol } from "@/components/ui/icon-symbol";
import { GarageTheme } from "@/src/constants/garageTheme";
import { BreathForgeProgressCard } from "@/src/components/BreathForgeProgressCard";

type ProgressMode = "strength" | "speed" | "recovery" | "videos";

type ProgressConfig = {
  title: string;
  summary: string;
  detail: string;
  cta: string;
  icon: string;
  route: () => void;
  accessibilityLabel: string;
};

export default function ProgressTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeMode, setActiveMode] = useState<ProgressMode>("strength");

  const navigateToGraph = (mode: "strength" | "speed") => {
    router.push({
      pathname: "/(tabs)/graph",
      params: { focus: mode },
    });
  };

  const navigateToHistory = (mode: "recovery" | "videos") => {
    router.push({
      pathname: "/(tabs)/history",
      params: { focus: mode },
    });
  };

  const modeConfig: Record<ProgressMode, ProgressConfig> = {
    strength: {
      title: "強さ",
      summary: "種目別の強度推移を確認",
      detail: "トレンド表示へ移動して、主要リフトの変化をまとめて見返します。",
      cta: "強さのグラフを見る",
      icon: "figure.strengthtraining.traditional",
      route: () => navigateToGraph("strength"),
      accessibilityLabel: "強さのグラフを表示",
    },
    speed: {
      title: "速度",
      summary: "平均速度とLVP確認へ直行",
      detail: "速度のばらつきや最近の反応を、既存のグラフ導線のまま確認します。",
      cta: "速度のグラフを見る",
      icon: "gauge",
      route: () => navigateToGraph("speed"),
      accessibilityLabel: "速度のグラフを表示",
    },
    recovery: {
      title: "回復",
      summary: "履歴から回復傾向を確認",
      detail: "既存の履歴画面へ移動し、回復の振れやセッション全体の流れを見ます。",
      cta: "回復の履歴を見る",
      icon: "heart",
      route: () => navigateToHistory("recovery"),
      accessibilityLabel: "回復の履歴を表示",
    },
    videos: {
      title: "動画",
      summary: "フォーム動画の確認導線",
      detail: "録画済みセットのフォーム動画一覧へ、履歴ルートのまま最短で移動します。",
      cta: "フォーム動画を見る",
      icon: "video",
      route: () => navigateToHistory("videos"),
      accessibilityLabel: "フォーム動画の履歴を表示",
    },
  };

  const activeConfig = modeConfig[activeMode];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Progress</Text>
        <View style={styles.segmentedControl} accessibilityRole="tablist">
          {(Object.keys(modeConfig) as ProgressMode[]).map((mode) => (
            <TouchableOpacity
              key={mode}
              style={[styles.segment, activeMode === mode && styles.segmentActive]}
              onPress={() => setActiveMode(mode)}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeMode === mode }}
              accessibilityLabel={`${modeConfig[mode].title}タブ`}
            >
              <Text style={[styles.segmentText, activeMode === mode && styles.segmentTextActive]}>
                {modeConfig[mode].title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        <BreathForgeProgressCard />
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryIcon}>
              <IconSymbol size={18} name={activeConfig.icon as any} color={GarageTheme.accent} />
            </View>
            <View style={styles.summaryCopy}>
              <Text style={styles.summaryEyebrow}>{activeConfig.title}</Text>
              <Text style={styles.summaryTitle}>{activeConfig.summary}</Text>
            </View>
          </View>
          <Text style={styles.summaryDetail}>{activeConfig.detail}</Text>
        </View>

        <TouchableOpacity
          style={styles.routeRow}
          onPress={activeConfig.route}
          accessibilityRole="button"
          accessibilityLabel={activeConfig.accessibilityLabel}
        >
          <View style={styles.routeRowLeft}>
            <View style={styles.routeIcon}>
              <IconSymbol size={16} name={activeConfig.icon as any} color={GarageTheme.accent} />
            </View>
            <View style={styles.routeCopy}>
              <Text style={styles.routeTitle}>{activeConfig.cta}</Text>
              <Text style={styles.routeDescription} numberOfLines={2}>
                既存の分析画面へ移動
              </Text>
            </View>
          </View>
          <IconSymbol size={16} name="chevron.right" color={GarageTheme.textMuted} />
        </TouchableOpacity>
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
    marginBottom: 12,
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: GarageTheme.surfaceAlt,
    borderRadius: 8,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  segmentActive: {
    backgroundColor: GarageTheme.accent,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: "500",
    color: GarageTheme.textMuted,
  },
  segmentTextActive: {
    color: GarageTheme.textStrong,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 12,
  },
  summaryCard: {
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    borderRadius: 8,
    padding: 14,
    gap: 10,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: GarageTheme.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryCopy: {
    flex: 1,
    gap: 2,
  },
  summaryEyebrow: {
    fontSize: 11,
    fontWeight: "600",
    color: GarageTheme.textMuted,
  },
  summaryTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: GarageTheme.textStrong,
  },
  summaryDetail: {
    fontSize: 13,
    lineHeight: 18,
    color: GarageTheme.textMuted,
  },
  routeRow: {
    minHeight: 56,
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  routeRowLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  routeIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: GarageTheme.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  routeCopy: {
    flex: 1,
    gap: 2,
  },
  routeTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: GarageTheme.textStrong,
  },
  routeDescription: {
    fontSize: 12,
    lineHeight: 16,
    color: GarageTheme.textMuted,
  },
});
