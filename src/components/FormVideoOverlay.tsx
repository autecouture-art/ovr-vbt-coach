import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  CameraView,
  useCameraPermissions,
  useMicrophonePermissions,
} from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GarageTheme } from "@/src/constants/garageTheme";
import LiveShareService from "@/src/services/LiveShareService";
import VideoRecordingService from "@/src/services/VideoRecordingService";
import type { FormVideoRecord } from "@/src/types/index";

type FormVideoOverlayProps = {
  visible: boolean;
  sessionId: string;
  lift: string;
  setIndex: number;
  loadKg: number;
  onClose: () => void;
  onSaved?: (record: FormVideoRecord) => void;
};

type FormVideoRecordingPayload = {
  session_id: string;
  lift: string;
  set_index: number;
  load_kg: number;
  started_at: string;
  ended_at: string;
  local_uri: string;
};

const saveFormVideoRecording = async (
  payload: FormVideoRecordingPayload,
): Promise<FormVideoRecord> => {
  const record = await VideoRecordingService.saveFormVideoRecord(payload);
  void LiveShareService.sendEvent("form_video_saved", {
    id: record.id,
    session_id: record.session_id,
    lift: record.lift,
    set_index: record.set_index,
    load_kg: record.load_kg,
    local_uri: record.local_uri,
    duration_s: record.duration_s,
    started_at: record.started_at,
    ended_at: record.ended_at,
    created_at: record.created_at,
  });
  return record;
};

export function FormVideoOverlay({
  visible,
  sessionId,
  lift,
  setIndex,
  loadKg,
  onClose,
  onSaved,
}: FormVideoOverlayProps) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] =
    useMicrophonePermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null);
  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [endedAt, setEndedAt] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setCameraReady(false);
      setCameraAvailable(null);
      setRecording(false);
      setSaving(false);
      setStartedAt(null);
      setCapturedUri(null);
      setEndedAt(null);
    }
  }, [visible]);

  const contextReady = sessionId.length > 0 && lift.length > 0 && setIndex > 0;
  const hasPermission =
    cameraPermission?.granted === true && microphonePermission?.granted === true;
  const permissionReady = cameraPermission != null && microphonePermission != null;
  const statusText = useMemo(() => {
    if (!contextReady) {
      return "セッション、種目、セット情報が不足しています。";
    }
    if (!permissionReady) {
      return "カメラ権限を確認しています...";
    }
    if (!hasPermission) {
      return "カメラとマイクの権限を許可すると録画できます。";
    }
    if (cameraAvailable === false) {
      return "カメラを使用できません。実機または他アプリの使用状況を確認してください。";
    }
    if (capturedUri) {
      return "録画済みです。保存するとこのセットに紐付きます。";
    }
    if (recording) {
      return "録画中です。セットが終わったら停止してください。";
    }
    return cameraReady
      ? "セッション画面を見ながら録画できます。"
      : "カメラを準備しています...";
  }, [
    cameraAvailable,
    cameraReady,
    capturedUri,
    contextReady,
    hasPermission,
    permissionReady,
    recording,
  ]);

  if (!visible) return null;

  const requestPermissions = async () => {
    const nextCamera = await requestCameraPermission();
    const nextMicrophone = await requestMicrophonePermission();
    if (!nextCamera.granted || !nextMicrophone.granted) {
      Alert.alert(
        "権限が必要です",
        "フォーム動画を撮るにはカメラとマイクの権限を許可してください。",
      );
    }
  };

  const handleStart = async () => {
    if (!cameraRef.current || !cameraReady || !hasPermission || !contextReady) {
      return;
    }

    const nextStartedAt = new Date().toISOString();
    setCapturedUri(null);
    setEndedAt(null);
    setStartedAt(nextStartedAt);
    setRecording(true);

    try {
      const video = await cameraRef.current.recordAsync({
        maxDuration: 180,
      });
      setCapturedUri(video?.uri ?? null);
      setEndedAt(new Date().toISOString());
      if (!video?.uri) {
        Alert.alert("録画未保存", "動画ファイルを受け取れませんでした。");
      }
    } catch (error) {
      console.error("[FormVideoOverlay] Failed to record video:", error);
      Alert.alert("録画エラー", "フォーム動画の録画に失敗しました。");
    } finally {
      setRecording(false);
    }
  };

  const handleStop = () => {
    cameraRef.current?.stopRecording();
  };

  const handleDiscard = () => {
    setCapturedUri(null);
    setStartedAt(null);
    setEndedAt(null);
  };

  const closeOrStop = () => {
    if (saving) return;
    if (recording) {
      handleStop();
      return;
    }
    if (capturedUri) {
      Alert.alert("録画を破棄しますか？", "未保存のフォーム動画があります。", [
        { text: "戻る", style: "cancel" },
        {
          text: "破棄して閉じる",
          style: "destructive",
          onPress: () => {
            handleDiscard();
            onClose();
          },
        },
      ]);
      return;
    }
    onClose();
  };

  const handleSave = async () => {
    if (!capturedUri || !startedAt || !endedAt || !contextReady) return;
    setSaving(true);
    try {
      const record = await saveFormVideoRecording({
        session_id: sessionId,
        lift,
        set_index: setIndex,
        load_kg: loadKg,
        started_at: startedAt,
        ended_at: endedAt,
        local_uri: capturedUri,
      });
      onSaved?.(record);
      handleDiscard();
      onClose();
    } catch (error) {
      console.error("[FormVideoOverlay] Failed to save video metadata:", error);
      Alert.alert("保存エラー", "フォーム動画の保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  const renderBody = () => {
    if (!contextReady) {
      return <Text style={styles.message}>{statusText}</Text>;
    }

    if (!permissionReady) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator color={GarageTheme.accent} />
          <Text style={styles.message}>{statusText}</Text>
        </View>
      );
    }

    if (!hasPermission) {
      return (
        <View style={styles.centered}>
          <Text style={styles.message}>{statusText}</Text>
          <TouchableOpacity
            style={[styles.primaryButton, styles.permissionButton]}
            onPress={requestPermissions}
          >
            <Text style={styles.primaryButtonText}>権限を許可</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <>
        <View style={styles.cameraFrame}>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
            mode="video"
            onCameraReady={() => {
              setCameraReady(true);
              setCameraAvailable(true);
            }}
            onMountError={(event) => {
              console.error("[FormVideoOverlay] Camera mount error:", event);
              setCameraAvailable(false);
            }}
          />
          {cameraAvailable === false && (
            <View style={styles.cameraUnavailable}>
              <Text style={styles.message}>{statusText}</Text>
            </View>
          )}
        </View>
        <Text style={styles.statusText}>{statusText}</Text>
      </>
    );
  };

  return (
    <View style={[styles.overlay, { paddingBottom: insets.bottom + 12 }]}>
      <View style={styles.panel}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.kicker}>FORM VIDEO OVERLAY</Text>
            <Text style={styles.title} numberOfLines={1}>
              {lift || "フォーム動画"}
            </Text>
            <Text style={styles.contextText}>
              Set {setIndex || "-"} / {loadKg || 0}kg
            </Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={closeOrStop}>
            <Text style={styles.closeButtonText}>{recording ? "停止" : "閉じる"}</Text>
          </TouchableOpacity>
        </View>

        {renderBody()}

        <View style={styles.actionRow}>
          {capturedUri ? (
            <>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleDiscard}
                disabled={saving}
              >
                <Text style={styles.secondaryButtonText}>破棄</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  styles.actionButton,
                  saving && styles.disabledButton,
                ]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.primaryButtonText}>
                  {saving ? "保存中..." : "保存"}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={closeOrStop}
                disabled={saving}
              >
                <Text style={styles.secondaryButtonText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.recordButton,
                  (!hasPermission ||
                    !cameraReady ||
                    cameraAvailable === false ||
                    !contextReady ||
                    saving) &&
                    styles.disabledButton,
                ]}
                onPress={recording ? handleStop : () => void handleStart()}
                disabled={
                  !hasPermission ||
                  !cameraReady ||
                  cameraAvailable === false ||
                  !contextReady ||
                  saving
                }
              >
                <Text style={styles.primaryButtonText}>
                  {recording ? "停止" : "録画開始"}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.28)",
    justifyContent: "flex-end",
    paddingHorizontal: 12,
    zIndex: 50,
  },
  panel: {
    backgroundColor: "rgba(17,18,22,0.96)",
    borderColor: "rgba(255,255,255,0.14)",
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.34,
    shadowRadius: 18,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  headerText: {
    flex: 1,
    paddingRight: 12,
  },
  kicker: {
    color: GarageTheme.accent,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0,
  },
  title: {
    color: GarageTheme.text,
    fontSize: 18,
    fontWeight: "600",
    marginTop: 3,
  },
  contextText: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    fontWeight: "500",
    marginTop: 2,
  },
  closeButton: {
    borderColor: "rgba(255,255,255,0.22)",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  closeButtonText: {
    color: GarageTheme.text,
    fontSize: 13,
    fontWeight: "600",
  },
  cameraFrame: {
    backgroundColor: "#050505",
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 10,
    borderWidth: 1,
    height: 220,
    overflow: "hidden",
  },
  camera: {
    flex: 1,
  },
  cameraUnavailable: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    padding: 16,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
  },
  message: {
    color: GarageTheme.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  statusText: {
    color: GarageTheme.text,
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 19,
    marginTop: 10,
    textAlign: "center",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: GarageTheme.accent,
    borderRadius: 8,
    paddingVertical: 13,
  },
  actionButton: {
    flex: 1,
  },
  permissionButton: {
    alignSelf: "stretch",
    marginTop: 12,
  },
  recordButton: {
    alignItems: "center",
    backgroundColor: GarageTheme.danger,
    borderRadius: 8,
    flex: 1,
    paddingVertical: 13,
  },
  primaryButtonText: {
    color: "#f7f8f8",
    fontSize: 14,
    fontWeight: "600",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.22)",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 13,
  },
  secondaryButtonText: {
    color: GarageTheme.text,
    fontSize: 14,
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.45,
  },
});
