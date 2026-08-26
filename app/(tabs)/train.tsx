import React, { useState } from "react";
import { View, StyleSheet, Text, TouchableOpacity, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

import { GarageTheme } from "@/src/constants/garageTheme";
import { IconSymbol } from "@/components/ui/icon-symbol";
import CrashReportService from "@/src/services/CrashReportService";

type TrainMode = "vbt" | "manual";

export default function TrainTab() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeMode, setActiveMode] = useState<TrainMode>("vbt");

  const handleVBTStart = async () => {
    try {
      await CrashReportService.saveVBTSessionOpenAttempt({
        entry_point: "bottom_tab",
      });
    } catch (error) {
      console.warn("[TrainTab] Failed to save VBT session open attempt:", error);
    } finally {
      router.push("/(tabs)/session");
    }
  };

  const handleManualEntryStart = () => {
    router.push("/(tabs)/manual");
  };

  return (
    <View style={styles.container}>
      {/* Header with segmented control */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Train</Text>
        <View style={styles.segmentedControl}>
          <TouchableOpacity
            style={[styles.segment, activeMode === "vbt" && styles.segmentActive]}
            onPress={() => setActiveMode("vbt")}
            accessibilityState={{ selected: activeMode === "vbt" }}
            accessibilityRole="tab"
          >
            <Text style={[styles.segmentText, activeMode === "vbt" && styles.segmentTextActive]}>
              VBT
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segment, activeMode === "manual" && styles.segmentActive]}
            onPress={() => setActiveMode("manual")}
            accessibilityState={{ selected: activeMode === "manual" }}
            accessibilityRole="tab"
          >
            <Text style={[styles.segmentText, activeMode === "manual" && styles.segmentTextActive]}>
              手動入力
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content area */}
      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
        {activeMode === "vbt" ? (
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <View style={styles.panelIcon}>
                <IconSymbol size={32} name="bolt.fill" color={GarageTheme.accent} />
              </View>
              <View style={styles.panelTitleContainer}>
                <Text style={styles.panelTitle}>VBTセッション</Text>
                <Text style={styles.panelDescription}>
                  Velocity Based Trainingでセンサーと連携しながらトレーニングを記録
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.startButton}
              onPress={handleVBTStart}
              accessibilityRole="button"
              accessibilityLabel="VBTセッションを開始"
            >
              <Text style={styles.startButtonText}>セッションを開始</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.panel}>
            <View style={styles.panelHeader}>
              <View style={styles.panelIcon}>
                <IconSymbol size={32} name="pencil" color={GarageTheme.accent} />
              </View>
              <View style={styles.panelTitleContainer}>
                <Text style={styles.panelTitle}>手動入力</Text>
                <Text style={styles.panelDescription}>
                  センサーなしで重量・回数・速度を手動で入力して記録
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.startButton}
              onPress={handleManualEntryStart}
              accessibilityRole="button"
              accessibilityLabel="手動入力を開始"
            >
              <Text style={styles.startButtonText}>手動入力を開始</Text>
            </TouchableOpacity>
          </View>
        )}
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
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: "center",
    minHeight: 44,
  },
  segmentActive: {
    backgroundColor: GarageTheme.accent,
  },
  segmentText: {
    fontSize: 14,
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
  },
  panel: {
    backgroundColor: GarageTheme.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    padding: 16,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  panelIcon: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: GarageTheme.panel,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  panelTitleContainer: {
    flex: 1,
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: GarageTheme.textStrong,
    marginBottom: 4,
  },
  panelDescription: {
    fontSize: 14,
    color: GarageTheme.textMuted,
    lineHeight: 20,
  },
  startButton: {
    backgroundColor: GarageTheme.accent,
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    alignItems: "center",
    minHeight: 48,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: GarageTheme.background,
  },
});
