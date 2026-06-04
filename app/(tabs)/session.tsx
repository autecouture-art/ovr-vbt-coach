import React, { Suspense, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";

import { GarageTheme } from "@/src/constants/garageTheme";
import BLEService from "@/src/services/BLEService";
import CrashReportService, {
  type VBTScreenCrashContext,
} from "@/src/services/CrashReportService";

type LoadedSessionScreen = React.ComponentType<Record<string, never>>;
type LoadedEmergencySessionLogScreen = React.ComponentType<{
  onClose: () => void;
}>;

const LazyEmergencySessionLogScreen = React.lazy(
  async (): Promise<{ default: LoadedEmergencySessionLogScreen }> => {
    const module = await import("@/src/screens/EmergencySessionLogScreen");
    return { default: module.default };
  },
);

export default function SessionGateScreen() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [previousVbtCrashContext, setPreviousVbtCrashContext] =
    useState<VBTScreenCrashContext | null>(null);
  const [LoadedSessionScreen, setLoadedSessionScreen] =
    useState<LoadedSessionScreen | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [showEmergencyLog, setShowEmergencyLog] = useState(false);

  useEffect(() => {
    if (!isFocused || LoadedSessionScreen) {
      return;
    }

    let cancelled = false;

    void CrashReportService.getLastVBTScreenContext()
      .then((snapshot) => {
        if (!cancelled) {
          setPreviousVbtCrashContext(snapshot);
        }
      })
      .catch((error) => {
        console.warn("[SessionGate] Failed to load crash context:", error);
      });

    return () => {
      cancelled = true;
    };
  }, [LoadedSessionScreen, isFocused]);

  const getVBTScreenCrashReport = async (): Promise<string | null> => {
    const snapshot =
      previousVbtCrashContext ??
      (await CrashReportService.getLastVBTScreenContext());
    if (!snapshot) {
      Alert.alert("クラッシュ記録なし", "共有できるクラッシュ疑い記録がありません。");
      return null;
    }

    return CrashReportService.buildVBTCrashMarkdown(snapshot);
  };

  const handleShareVBTScreenCrashReport = async () => {
    try {
      const report = await getVBTScreenCrashReport();
      if (!report) {
        return;
      }

      await Clipboard.setStringAsync(report);
      const file = await CrashReportService.writeVBTCrashReportFile(report);
      const canShare = await Sharing.isAvailableAsync();

      if (canShare) {
        await Sharing.shareAsync(file.uri, {
          mimeType: "text/markdown",
          UTI: "net.daringfireball.markdown",
          dialogTitle: "クラッシュ状況を添付共有",
        });
      }

      Alert.alert(
        canShare ? "添付共有を開きました" : "クラッシュ報告をコピーしました",
        canShare
          ? "本文もクリップボードにコピー済みです。記録はクリアするまで残します。"
          : "共有シートが使えないため、本文をクリップボードにコピーしました。",
      );
    } catch (error) {
      console.error("[SessionGate] Failed to share VBT crash report:", error);
      Alert.alert("共有失敗", "クラッシュ報告の作成に失敗しました。");
    }
  };

  const handleShareVBTScreenCrashReportText = async () => {
    try {
      const report = await getVBTScreenCrashReport();
      if (!report) {
        return;
      }

      await Clipboard.setStringAsync(report);
      await Share.share({
        title: "RepVeloCoach VBT crash report",
        message: report,
      });
      Alert.alert(
        "本文共有を開きました",
        "Gmailを選ぶと本文として送れます。記録はクリアするまで残します。",
      );
    } catch (error) {
      console.error("[SessionGate] Failed to share VBT crash report text:", error);
      Alert.alert("本文共有失敗", "クラッシュ報告本文の共有に失敗しました。");
    }
  };

  const handleClearVBTScreenCrashReport = async () => {
    await CrashReportService.clearVBTScreenContext();
    setPreviousVbtCrashContext(null);
  };

  const handleOpenSessionScreen = async () => {
    setIsLoadingSession(true);
    try {
      const deviceInfo = BLEService.getLastDeviceInfo();
      await CrashReportService.saveVBTSessionMountAttempt({
        entry_point: "bottom_tab",
        is_connected: Boolean(deviceInfo.id),
      });
      const module = await import("@/src/screens/SessionScreen");
      await CrashReportService.saveVBTSessionStageAttempt(
        "session_screen_import_loaded",
        {
          entry_point: "bottom_tab",
          is_connected: Boolean(deviceInfo.id),
        },
      );
      setLoadedSessionScreen(() => module.default as LoadedSessionScreen);
    } catch (error) {
      console.error("[SessionGate] Failed to load Session screen:", error);
      Alert.alert(
        "セッション画面を開けません",
        "クラッシュ調査用の記録は保存しました。本文共有でCodexへ送ってください。",
      );
      const snapshot = await CrashReportService.getLastVBTScreenContext();
      setPreviousVbtCrashContext(snapshot);
    } finally {
      setIsLoadingSession(false);
    }
  };

  if (LoadedSessionScreen) {
    return <LoadedSessionScreen />;
  }

  if (showEmergencyLog) {
    return (
      <Suspense fallback={<View style={styles.loadingFallback} />}>
        <LazyEmergencySessionLogScreen
          onClose={() => setShowEmergencyLog(false)}
        />
      </Suspense>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[
        styles.content,
        { paddingTop: Math.max(insets.top + 18, 28) },
      ]}
    >
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>SESSION SAFE GATE</Text>
        <Text style={styles.title}>セッションモード</Text>
        <Text style={styles.description}>
          タブを押しただけで落ちる問題を切り分けるため、まず軽い画面を開いています。
          下のボタンで本体を読み込みます。
        </Text>

        <TouchableOpacity
          style={[styles.primaryButton, isLoadingSession && styles.buttonDisabled]}
          onPress={() => void handleOpenSessionScreen()}
          disabled={isLoadingSession}
        >
          {isLoadingSession ? (
            <ActivityIndicator color={GarageTheme.background} />
          ) : (
            <Text style={styles.primaryButtonText}>セッション本体を開く</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => setShowEmergencyLog(true)}
        >
          <Text style={styles.secondaryButtonText}>緊急記録モード</Text>
        </TouchableOpacity>
      </View>

      {previousVbtCrashContext ? (
        <View style={styles.crashReportCard}>
          <View style={styles.crashReportHeader}>
            <View style={styles.crashReportDot} />
            <View style={styles.crashReportTextGroup}>
              <Text style={styles.crashReportTitle}>
                前回セッションモードでクラッシュ疑い
              </Text>
              <Text style={styles.crashReportSubtitle}>
                本体を開かず、この画面からCodexへ状況を送れます
              </Text>
            </View>
          </View>
          <Text style={styles.crashReportMeta}>
            saved {previousVbtCrashContext.saved_at} / {previousVbtCrashContext.reason}
          </Text>
          <View style={styles.crashReportActions}>
            <TouchableOpacity
              style={[styles.crashReportButton, styles.crashReportButtonPrimary]}
              onPress={() => void handleShareVBTScreenCrashReport()}
            >
              <Text style={styles.crashReportButtonTextPrimary}>添付共有</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.crashReportButton, styles.crashReportButtonPrimary]}
              onPress={() => void handleShareVBTScreenCrashReportText()}
            >
              <Text style={styles.crashReportButtonTextPrimary}>本文共有</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.crashReportButton}
              onPress={() => void handleClearVBTScreenCrashReport()}
            >
              <Text style={styles.crashReportButtonText}>クリア</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.noteCard}>
          <Text style={styles.noteTitle}>クラッシュ記録なし</Text>
          <Text style={styles.noteText}>
            もし本体を開いた後に落ちた場合、再起動後にこの画面へ戻ると共有カードが出ます。
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GarageTheme.background,
  },
  loadingFallback: {
    flex: 1,
    backgroundColor: GarageTheme.background,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  heroCard: {
    borderRadius: 24,
    padding: 22,
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    shadowColor: GarageTheme.accent,
    shadowOpacity: Platform.OS === "ios" ? 0.18 : 0,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
  },
  eyebrow: {
    color: GarageTheme.accentSoft,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
  title: {
    color: GarageTheme.textStrong,
    fontSize: 34,
    fontWeight: "900",
    marginTop: 10,
  },
  description: {
    color: GarageTheme.textMuted,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 21,
    marginTop: 12,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GarageTheme.accent,
    marginTop: 22,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: GarageTheme.background,
    fontSize: 15,
    fontWeight: "900",
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GarageTheme.panel,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    marginTop: 12,
  },
  secondaryButtonText: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: "900",
  },
  crashReportCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.warning,
  },
  crashReportHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  crashReportDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: GarageTheme.warning,
    marginTop: 6,
  },
  crashReportTextGroup: {
    flex: 1,
  },
  crashReportTitle: {
    color: GarageTheme.textStrong,
    fontSize: 16,
    fontWeight: "900",
  },
  crashReportSubtitle: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  crashReportMeta: {
    color: GarageTheme.warning,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 10,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  crashReportActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  crashReportButton: {
    flex: 1,
    minWidth: 86,
    minHeight: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    backgroundColor: GarageTheme.panel,
  },
  crashReportButtonPrimary: {
    borderColor: GarageTheme.accent,
    backgroundColor: GarageTheme.accent + "22",
  },
  crashReportButtonText: {
    color: GarageTheme.textMuted,
    fontSize: 13,
    fontWeight: "800",
  },
  crashReportButtonTextPrimary: {
    color: GarageTheme.accent,
    fontSize: 13,
    fontWeight: "800",
  },
  noteCard: {
    marginTop: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: GarageTheme.panel,
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  noteTitle: {
    color: GarageTheme.textStrong,
    fontSize: 15,
    fontWeight: "900",
  },
  noteText: {
    color: GarageTheme.textMuted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
});
