import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
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
} from "expo-camera";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GarageTheme } from "@/src/constants/garageTheme";
import AudioService from "@/src/services/AudioService";
import {
  CameraRecordingController,
  type CameraCaptureOperation,
} from "@/src/services/CameraRecordingController";
import LiveShareService from "@/src/services/LiveShareService";
import DatabaseService from "@/src/services/DatabaseService";
import VideoRecordingService from "@/src/services/VideoRecordingService";
import type { FormVideoCapture, FormVideoRecord } from "@/src/types/index";

type FormVideoOverlayProps = {
  visible: boolean;
  sessionId: string;
  lift: string;
  setIndex: number;
  loadKg: number;
  autoStopToken?: number;
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
  capture_id?: string;
};

type LockedRecordingContext = {
  sessionId: string;
  lift: string;
  setIndex: number;
  loadKg: number;
};

const ZOOM_PRESETS = [
  { label: "1x", value: 0 },
  { label: "1.5x", value: 0.18 },
  { label: "2x", value: 0.32 },
] as const;

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
  autoStopToken,
  onClose,
  onSaved,
}: FormVideoOverlayProps) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView | null>(null);
  const controllerRef = useRef(new CameraRecordingController());
  const mountedRef = useRef(true);
  const activeOperationIdRef = useRef<string | null>(null);
  const startingRecordingRef = useRef(false);
  const lastAutoStopTokenRef = useRef(autoStopToken);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null);
  const [recording, setRecording] = useState(false);
  const [startingRecording, setStartingRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [captureId, setCaptureId] = useState<string | null>(null);
  const [endedAt, setEndedAt] = useState<string | null>(null);
  const [cameraZoom, setCameraZoom] = useState(0);
  const [lockedContext, setLockedContext] =
    useState<LockedRecordingContext | null>(null);

  useEffect(() => {
    if (!visible) {
      setCameraReady(false);
      setCameraAvailable(null);
      setRecording(false);
      setSaving(false);
      setStartedAt(null);
      setCapturedUri(null);
      setCaptureId(null);
      setEndedAt(null);
      setLockedContext(null);
      void AudioService.keepExternalAudioAlive("form-video-overlay-hidden");
      return;
    }
    void AudioService.keepExternalAudioAlive("form-video-overlay-visible");
  }, [visible]);

  useEffect(() => {
    mountedRef.current = true;
    const controller = controllerRef.current;
    return () => {
      mountedRef.current = false;
      void controller.interrupt().catch(() => undefined);
    };
  }, []);

  const contextReady = sessionId.length > 0 && lift.length > 0 && setIndex > 0;
  const hasPermission = cameraPermission?.granted === true;
  const permissionReady = cameraPermission != null;
  const activeContext = lockedContext ?? { sessionId, lift, setIndex, loadKg };
  const persistCaptureState = (
    nextCaptureId: string,
    state: FormVideoCapture["state"],
    details: Pick<
      FormVideoCapture,
      "local_uri" | "set_id" | "ended_at" | "error_message"
    > = {},
  ) => {
    void DatabaseService.updateFormVideoCaptureState(nextCaptureId, state, details).catch(
      (error) => console.warn("[FormVideoOverlay] Failed to update capture state:", error),
    );
  };
  const statusText = useMemo(() => {
    if (!contextReady) {
      return "セッション、種目、セット情報が不足しています。";
    }
    if (!permissionReady) {
      return "カメラ権限を確認しています...";
    }
    if (!hasPermission) {
      return "カメラ権限を許可すると、音楽を止めずにミュート録画できます。";
    }
    if (cameraAvailable === false) {
      return "カメラを使用できません。実機または他アプリの使用状況を確認してください。";
    }
    if (capturedUri) {
      return `録画済みです。保存すると ${activeContext.lift} Set ${activeContext.setIndex} に紐付きます。`;
    }
    if (recording) {
      return "録画中です。セットが終わったら停止してください。";
    }
    return cameraReady
      ? "セッション画面を見ながら録画できます。録画音声は入れません。"
      : "カメラを準備しています...";
  }, [
    activeContext.lift,
    activeContext.setIndex,
    cameraAvailable,
    cameraReady,
    capturedUri,
    contextReady,
    hasPermission,
    permissionReady,
    recording,
  ]);

  const requestPermissions = async () => {
    const nextCamera = await requestCameraPermission();
    if (!nextCamera.granted) {
      Alert.alert(
        "権限が必要です",
        "フォーム動画を撮るにはカメラ権限を許可してください。音声は録音しません。",
      );
    }
  };

  const settleCapture = (
    operation: CameraCaptureOperation,
    uri: string | null | undefined,
  ) => {
    if (activeOperationIdRef.current !== operation.id) return;
    activeOperationIdRef.current = null;
    if (!mountedRef.current) return;
    setCapturedUri(uri ?? null);
    setEndedAt(new Date().toISOString());
    setRecording(false);
    persistCaptureState(
      operation.id,
      uri ? "captured" : "recoverable_draft",
      {
        local_uri: uri ?? null,
        ended_at: new Date().toISOString(),
        error_message: uri ? null : "Camera returned no video URI.",
      },
    );
    void AudioService.keepExternalAudioAlive("form-video-overlay-after-record");
    if (!uri) {
      Alert.alert("録画未保存", "動画ファイルを受け取れませんでした。");
    }
  };

  const handleStart = async () => {
    if (!cameraRef.current || !cameraReady || !hasPermission || !contextReady) {
      return;
    }

    if (startingRecordingRef.current || controllerRef.current.isRecording()) return;
    startingRecordingRef.current = true;
    setStartingRecording(true);

    const nextStartedAt = new Date().toISOString();
    const nextContext = { sessionId, lift, setIndex, loadKg };
    setCapturedUri(null);
    setEndedAt(null);
    setStartedAt(nextStartedAt);
    setLockedContext(nextContext);
    try {
      await AudioService.keepExternalAudioAlive("form-video-overlay-before-record");
      const operation = controllerRef.current.start(cameraRef.current);
      activeOperationIdRef.current = operation.id;
      setCaptureId(operation.id);
      setRecording(true);
      startingRecordingRef.current = false;
      setStartingRecording(false);
      void DatabaseService.upsertFormVideoCapture({
        capture_id: operation.id,
        session_id: nextContext.sessionId,
        lift: nextContext.lift,
        set_attempt_id: `${nextContext.sessionId}:${nextContext.lift}:${nextContext.setIndex}:${nextStartedAt}`,
        set_index: nextContext.setIndex,
        load_kg: nextContext.loadKg,
        state: "recording",
        started_at: nextStartedAt,
        updated_at: nextStartedAt,
      }).catch((error) =>
        console.warn("[FormVideoOverlay] Failed to create capture draft:", error),
      );
      void operation.completion
        .then((video) => settleCapture(operation, video?.uri))
        .catch((error) => {
          if (activeOperationIdRef.current !== operation.id) return;
          activeOperationIdRef.current = null;
          if (!mountedRef.current) return;
          setRecording(false);
          setEndedAt(new Date().toISOString());
          persistCaptureState(
            operation.id,
            "recoverable_draft",
            { error_message: error instanceof Error ? error.message : "Camera recording failed." },
          );
          void AudioService.keepExternalAudioAlive("form-video-overlay-record-failed");
          console.error("[FormVideoOverlay] Failed to record video:", error);
          Alert.alert("録画エラー", "フォーム動画の録画に失敗しました。");
        });
    } catch (error) {
      startingRecordingRef.current = false;
      if (mountedRef.current) setStartingRecording(false);
      console.error("[FormVideoOverlay] Failed to record video:", error);
      Alert.alert("録画エラー", "フォーム動画の録画に失敗しました。");
    }
  };

  const handleStop = () => {
    void controllerRef.current.interrupt(cameraRef.current);
    void AudioService.keepExternalAudioAlive("form-video-overlay-stop");
  };

  useEffect(() => {
    const previous = lastAutoStopTokenRef.current;
    lastAutoStopTokenRef.current = autoStopToken;
    if (
      previous !== undefined &&
      autoStopToken !== undefined &&
      autoStopToken > previous &&
      controllerRef.current.isRecording()
    ) {
      void controllerRef.current
        .interrupt(cameraRef.current)
        .catch(() => undefined);
    }
  }, [autoStopToken]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active" || !controllerRef.current.isRecording()) return;
      void controllerRef.current
        .interrupt(cameraRef.current)
        .catch(() => undefined);
    });
    return () => subscription.remove();
  }, []);

  if (!visible) return null;

  const handleDiscard = () => {
    setCapturedUri(null);
    setCaptureId(null);
    setStartedAt(null);
    setEndedAt(null);
    setLockedContext(null);
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
    if (
      !capturedUri ||
      !startedAt ||
      !endedAt ||
      !activeContext.sessionId ||
      !activeContext.lift ||
      activeContext.setIndex <= 0
    ) {
      return;
    }
    setSaving(true);
    try {
      if (captureId) {
        persistCaptureState(captureId, "persisting");
      }
      const record = await saveFormVideoRecording({
        session_id: activeContext.sessionId,
        lift: activeContext.lift,
        set_index: activeContext.setIndex,
        load_kg: activeContext.loadKg,
        started_at: startedAt,
        ended_at: endedAt,
        local_uri: capturedUri,
        capture_id: captureId ?? undefined,
      });
      if (captureId) {
        persistCaptureState(captureId, "verified", {
          set_id: record.id,
          local_uri: record.local_uri,
          ended_at: record.ended_at,
        });
      }
      onSaved?.(record);
      handleDiscard();
      onClose();
      void AudioService.keepExternalAudioAlive("form-video-overlay-saved");
      Alert.alert(
        "保存完了",
        "録画はセット履歴の該当セットをタップして、FORM VIDEOS から再生できます。",
      );
    } catch (error) {
      if (captureId) {
        persistCaptureState(captureId, "recoverable_draft", {
          local_uri: capturedUri,
          error_message: error instanceof Error ? error.message : "Video persistence failed.",
        });
      }
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
            mute
            zoom={cameraZoom}
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
        <View style={styles.zoomPanel}>
          <Text style={styles.zoomLabel}>倍率</Text>
          <View style={styles.zoomControls}>
            {ZOOM_PRESETS.map((preset) => {
              const active = cameraZoom === preset.value;
              return (
                <TouchableOpacity
                  key={preset.label}
                  style={[styles.zoomChip, active && styles.zoomChipActive]}
                  onPress={() => setCameraZoom(preset.value)}
                  disabled={recording}
                >
                  <Text
                    style={[
                      styles.zoomChipText,
                      active && styles.zoomChipTextActive,
                    ]}
                  >
                    {preset.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
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
              Set {activeContext.setIndex || "-"} / {activeContext.loadKg || 0}kg
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
                  saving ||
                  startingRecording
                }
              >
                <Text style={styles.primaryButtonText}>
                  {recording ? "停止" : startingRecording ? "準備中..." : "録画開始"}
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
  zoomPanel: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  zoomLabel: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  zoomControls: {
    flexDirection: "row",
    gap: 8,
  },
  zoomChip: {
    borderColor: "rgba(255,255,255,0.22)",
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 52,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  zoomChipActive: {
    backgroundColor: GarageTheme.accent,
    borderColor: GarageTheme.accent,
  },
  zoomChipText: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  zoomChipTextActive: {
    color: "#f7f8f8",
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
