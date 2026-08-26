import React, { useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GarageTheme } from "@/src/constants/garageTheme";
import AudioService from "@/src/services/AudioService";
import LiveShareService from "@/src/services/LiveShareService";
import VideoRecordingService from "@/src/services/VideoRecordingService";

type FormVideoRecordingPayload = {
  session_id: string;
  lift: string;
  set_index: number;
  load_kg: number;
  started_at: string;
  ended_at: string;
  local_uri: string;
};

const ZOOM_PRESETS = [
  { label: "1x", value: 0 },
  { label: "1.5x", value: 0.18 },
  { label: "2x", value: 0.32 },
] as const;

const getParam = (value: string | string[] | undefined): string =>
  Array.isArray(value) ? value[0] ?? "" : value ?? "";

const saveFormVideoRecording = async (
  payload: FormVideoRecordingPayload,
): Promise<void> => {
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
};

export default function FormVideoRecorderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const cameraRef = useRef<CameraView | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null);
  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [endedAt, setEndedAt] = useState<string | null>(null);
  const [cameraZoom, setCameraZoom] = useState(0);

  const recordingContext = useMemo(() => {
    const setIndex = Number.parseInt(getParam(params.set_index), 10);
    const loadKg = Number.parseFloat(getParam(params.load_kg));
    return {
      sessionId: getParam(params.session_id),
      lift: getParam(params.lift),
      setIndex: Number.isFinite(setIndex) ? setIndex : 0,
      loadKg: Number.isFinite(loadKg) ? loadKg : 0,
    };
  }, [params.lift, params.load_kg, params.session_id, params.set_index]);

  const hasPermission = cameraPermission?.granted === true;
  const permissionReady = cameraPermission != null;
  const contextReady =
    recordingContext.sessionId.length > 0 &&
    recordingContext.lift.length > 0 &&
    recordingContext.setIndex > 0;

  React.useEffect(() => {
    void AudioService.keepExternalAudioAlive("form-video-screen-mounted");
    return () => {
      void AudioService.keepExternalAudioAlive("form-video-screen-unmounted");
    };
  }, []);

  const requestPermissions = async () => {
    const nextCamera = await requestCameraPermission();
    if (!nextCamera.granted) {
      Alert.alert(
        "権限が必要です",
        "フォーム動画を撮るにはカメラ権限を許可してください。音声は録音しません。",
      );
    }
  };

  const handleStart = async () => {
    if (!cameraRef.current || !cameraReady || !hasPermission) return;

    const nextStartedAt = new Date().toISOString();
    setCapturedUri(null);
    setEndedAt(null);
    setStartedAt(nextStartedAt);
    setRecording(true);

    try {
      await AudioService.keepExternalAudioAlive("form-video-screen-before-record");
      const video = await cameraRef.current.recordAsync({
        maxDuration: 180,
      });
      setCapturedUri(video?.uri ?? null);
      setEndedAt(new Date().toISOString());
      if (!video?.uri) {
        Alert.alert("録画未保存", "動画ファイルを受け取れませんでした。");
      }
    } catch (error) {
      console.error("[FormVideoRecorder] Failed to record video:", error);
      Alert.alert("録画エラー", "フォーム動画の録画に失敗しました。");
    } finally {
      setRecording(false);
      void AudioService.keepExternalAudioAlive("form-video-screen-after-record");
    }
  };

  const handleStop = () => {
    cameraRef.current?.stopRecording();
    void AudioService.keepExternalAudioAlive("form-video-screen-stop");
  };

  const handleHome = () => {
    router.replace("/(tabs)");
  };

  const handleDiscard = () => {
    setCapturedUri(null);
    setStartedAt(null);
    setEndedAt(null);
  };

  const handleSave = async () => {
    if (!capturedUri || !startedAt || !endedAt) return;
    setSaving(true);
    try {
      await saveFormVideoRecording({
        session_id: recordingContext.sessionId,
        lift: recordingContext.lift,
        set_index: recordingContext.setIndex,
        load_kg: recordingContext.loadKg,
        started_at: startedAt,
        ended_at: endedAt,
        local_uri: capturedUri,
      });
      void AudioService.keepExternalAudioAlive("form-video-screen-saved");
      Alert.alert(
        "保存完了",
        "フォーム動画をセットに紐付けました。セッション履歴の該当セットをタップして FORM VIDEOS から再生できます。",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (error) {
      console.error("[FormVideoRecorder] Failed to save video metadata:", error);
      Alert.alert("保存エラー", "フォーム動画の保存に失敗しました。");
    } finally {
      setSaving(false);
    }
  };

  if (!contextReady) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.title}>フォーム動画</Text>
        <Text style={styles.message}>セッション、種目、セット情報が不足しています。</Text>
        <TouchableOpacity
          style={[styles.secondaryButton, styles.centeredActionButton]}
          onPress={() => router.back()}
        >
          <Text style={styles.secondaryButtonText}>戻る</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryButton, styles.centeredActionButton]}
          onPress={handleHome}
        >
          <Text style={styles.secondaryButtonText}>ホーム</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!permissionReady) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={GarageTheme.accent} />
        <Text style={styles.message}>カメラ権限を確認しています...</Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={[styles.container, styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.title}>フォーム動画</Text>
        <Text style={styles.message}>
          カメラ権限を許可すると、音楽を止めずにセットへ紐付くフォーム動画を撮れます。音声は録音しません。
        </Text>
        <TouchableOpacity
          style={[styles.primaryButton, styles.centeredActionButton]}
          onPress={requestPermissions}
        >
          <Text style={styles.primaryButtonText}>権限を許可</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryButton, styles.centeredActionButton]}
          onPress={() => router.back()}
        >
          <Text style={styles.secondaryButtonText}>キャンセル</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryButton, styles.centeredActionButton]}
          onPress={handleHome}
        >
          <Text style={styles.secondaryButtonText}>ホーム</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
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
          console.error("[FormVideoRecorder] Camera mount error:", event);
          setCameraAvailable(false);
        }}
      />

      <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={styles.kicker}>FORM VIDEO</Text>
          <Text style={styles.title}>{recordingContext.lift}</Text>
          <Text style={styles.contextText}>
            Set {recordingContext.setIndex} / {recordingContext.loadKg}kg
          </Text>
        </View>
        <View style={styles.topActions}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              if (recording) {
                handleStop();
              }
              router.back();
            }}
          >
            <Text style={styles.closeButtonText}>閉じる</Text>
          </TouchableOpacity>
          {!recording ? (
            <TouchableOpacity style={styles.closeButton} onPress={handleHome}>
              <Text style={styles.closeButtonText}>ホーム</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {cameraAvailable === false && (
        <View style={styles.unavailablePanel}>
          <Text style={styles.title}>カメラを使用できません</Text>
          <Text style={styles.message}>
            シミュレーターや別アプリの使用中は録画できない場合があります。
          </Text>
        </View>
      )}

      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + 18 }]}>
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
        {capturedUri ? (
          <>
            <Text style={styles.statusText}>録画済み: 保存または破棄を選んでください。</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleDiscard}
                disabled={saving}
              >
                <Text style={styles.secondaryButtonText}>破棄</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, saving && styles.disabledButton]}
                onPress={handleSave}
                disabled={saving}
              >
                <Text style={styles.primaryButtonText}>
                  {saving ? "保存中..." : "保存"}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.statusText}>
              {recording
                ? "録画中です。セットが終わったら停止してください。"
                : cameraReady
                  ? "カメラ準備OK。開始でフォーム動画を撮影します。"
                  : "カメラを準備しています..."}
            </Text>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => router.back()}
                disabled={recording}
              >
                <Text style={styles.secondaryButtonText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.recordButton,
                  (!cameraReady || cameraAvailable === false) && styles.disabledButton,
                ]}
                onPress={recording ? handleStop : () => void handleStart()}
                disabled={!cameraReady || cameraAvailable === false}
              >
                <Text style={styles.primaryButtonText}>
                  {recording ? "停止" : "録画開始"}
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#050505",
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    paddingHorizontal: 20,
    paddingBottom: 18,
    backgroundColor: "rgba(0,0,0,0.42)",
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  kicker: {
    color: GarageTheme.accent,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0,
  },
  title: {
    color: GarageTheme.text,
    fontSize: 24,
    fontWeight: "600",
    marginTop: 6,
  },
  contextText: {
    color: GarageTheme.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  message: {
    color: GarageTheme.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
    textAlign: "center",
  },
  closeButton: {
    borderColor: "rgba(255,255,255,0.28)",
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  topActions: {
    flexDirection: "row",
    gap: 8,
  },
  closeButtonText: {
    color: GarageTheme.text,
    fontSize: 13,
    fontWeight: "500",
  },
  unavailablePanel: {
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.72)",
    borderColor: GarageTheme.danger,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 180,
    padding: 18,
    width: "86%",
  },
  bottomPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.58)",
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  zoomPanel: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  zoomLabel: {
    color: GarageTheme.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  zoomControls: {
    flexDirection: "row",
    gap: 8,
  },
  zoomChip: {
    borderColor: "rgba(255,255,255,0.24)",
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 54,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  statusText: {
    color: GarageTheme.text,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
    marginBottom: 14,
    textAlign: "center",
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: GarageTheme.accent,
    borderRadius: 8,
    flex: 1,
    paddingVertical: 15,
  },
  recordButton: {
    alignItems: "center",
    backgroundColor: GarageTheme.danger,
    borderRadius: 8,
    flex: 1,
    paddingVertical: 15,
  },
  primaryButtonText: {
    color: "#f7f8f8",
    fontSize: 15,
    fontWeight: "600",
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "rgba(255,255,255,0.24)",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    marginTop: 12,
    paddingVertical: 15,
  },
  centeredActionButton: {
    alignSelf: "stretch",
    flex: 0,
    maxWidth: 320,
    minWidth: 220,
  },
  secondaryButtonText: {
    color: GarageTheme.text,
    fontSize: 15,
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.45,
  },
});
