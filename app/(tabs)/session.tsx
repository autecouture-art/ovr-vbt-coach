/**
 * VBT Session Screen
 * Refactored to use useSessionLogic and trainingStore
 * UI is now a "Dumb Component" driven by global state
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  AppState,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRouter } from "expo-router";
import { useTrainingStore } from "@/src/store/trainingStore";
import { useSessionLogic } from "@/src/hooks/useSessionLogic";
import { ExerciseSelectModal } from "@/src/components/ExerciseSelectModal";
import PRNotification from "@/src/components/PRNotification";
import DatabaseService from "@/src/services/DatabaseService";
import ExerciseService from "@/src/services/ExerciseService";
import AICoachService from "@/src/services/AICoachService";
import { VBTLogic } from "@/src/services/VBTLogic";
import { RepDetailModal } from "@/src/components/RepDetailModal";
import { SetEditModal } from "@/src/components/SetEditModal";
import { RepVelocityChart } from "@/src/components/RepVelocityChart";
import { ManualRepModal } from "@/src/components/ManualRepModal";
import { calculateWarmupSteps, isBig3 } from "@/src/utils/WarmupLogic";
import {
  formatLoadKg,
  getExerciseCategoryLabel,
  roundToHalfKg,
} from "@/src/constants/exerciseCatalog";
import { GarageTheme } from "@/src/constants/garageTheme";
import { estimateRPEFromVelocityLoss } from "@/src/utils/RPECalculator";
import { calculateRecoverySignal, getPeakHeartRate } from "@/src/utils/HeartRateUtils";
import {
  VelocityTooltip,
  VELOCITY_GLOSSARY,
} from "@/src/components/VelocityTooltip";
import type { Exercise, PRRecord, RepData, SetData } from "@/src/types/index";

export default function SessionScreen() {
  const router = useRouter();
  const navigationState = useNavigation();
  const insets = useSafeAreaInsets();

  // PR検知時のモーダル状態
  const [prRecord, setPRRecord] = useState<PRRecord | null>(null);
  const [showPRModal, setShowPRModal] = useState(false);

  // 手動レップ追加モーダル状態
  const [showManualRepModal, setShowManualRepModal] = useState(false);

  // Custom Hook for Logic（PR検知コールバックを渡す）
  const {
    finishSet,
    startSet,
    resumeSet,
    handleExcludeRep,
    handleMarkFailedRep,
    calculateAndProposeMVT,
    setWarmupMode,
  } = useSessionLogic(
    (pr: PRRecord) => {
      setPRRecord(pr);
      setShowPRModal(true);
    },
    // Auto-start callback
    async () => {
      if (!isConnected) {
        Alert.alert(
          "センサー未接続",
          "BLEセンサーを接続してからセッションを開始してください。",
        );
        return;
      }
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      startSession(sessionId);
      try {
        await DatabaseService.insertSession({
          session_id: sessionId,
          date: new Date().toISOString().split("T")[0],
          total_volume: 0,
          total_sets: 0,
          lifts: [],
        });
      } catch (e) {
        console.error("セッション作成失敗:", e);
      }
    },
  );

  // Global State
  const {
    currentSetIndex,
    isConnected,
    liveData,
    currentExercise,
    currentLoad,
    currentReps,
    setHistory,
    currentSession,
    isSessionActive,
    sessionStartTime,
    currentLift,
    updateLoad,
    targetWeight,
    setTargetWeight,
    currentHeartRate,
    restStartTime,
    sessionHRPoints,
    repHistory,
    setCurrentExercise,
    startSession,
    endSession,
    isPaused,
    setPaused,
    pauseReason,

    // VBT Intelligence
    cnsBattery,
    estimated1RM,
    estimated1RM_confidence,
    suggestedLoad,
    proposedMVT,
    setProposedMVT,
    updateSetHistory,
    settings,
  } = useTrainingStore();

  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [isWarmupMode, setIsWarmupMode] = useState(false);

  // レップ詳細モーダルの状態
  const [repDetailVisible, setRepDetailVisible] = useState(false);
  const [selectedSetIndex, setSelectedSetIndex] = useState<number>(1);
  const [selectedSetLift, setSelectedSetLift] = useState<string>("");
  const [editingSet, setEditingSet] = useState<SetData | null>(null);

  // ツールチップの状態
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipData, setTooltipData] = useState<{
    term: string;
    definition: string;
    targetRange?: string;
    currentStatus?: "good" | "warning" | "danger";
    currentValue?: string;
  } | null>(null);

  // Session note editing state
  const [sessionNote, setSessionNote] = useState("");
  const [editingSessionNote, setEditingSessionNote] = useState(false);

  // Fetch all reps on mount or when returning
  const [sessionAllReps, setSessionAllReps] = useState<RepData[]>([]);

  // Recent exercise history (from previous sessions)
  const [recentExerciseHistory, setRecentExerciseHistory] = useState<SetData[]>(
    [],
  );
  // Historical session reps for detail modal
  const [historicalSessionReps, setHistoricalSessionReps] = useState<{
    sessionId: string;
    reps: RepData[];
  } | null>(null);

  const refreshSessionAllReps = useCallback(async () => {
    if (!currentSession?.session_id) {
      setSessionAllReps([]);
      return;
    }

    const reps = await DatabaseService.getRepsForSession(
      currentSession.session_id,
    );
    setSessionAllReps(reps);
  }, [currentSession?.session_id]);

  const refreshRecentExerciseHistory = useCallback(async () => {
    if (!currentLift) {
      setRecentExerciseHistory([]);
      return;
    }

    try {
      const recentSets = await DatabaseService.getRecentSetsForLift(
        currentLift,
        5,
        currentSession?.session_id,
      );
      setRecentExerciseHistory(recentSets);
    } catch (error) {
      console.error("Failed to fetch recent exercise history:", error);
      setRecentExerciseHistory([]);
    }
  }, [currentLift, currentSession?.session_id]);

  useEffect(() => {
    void refreshSessionAllReps();

    // セット保存直後はDB書き込みが少し遅延するため、短い再読込を入れて詳細を即時参照可能にする
    const timerId = setTimeout(() => {
      void refreshSessionAllReps();
    }, 450);

    return () => clearTimeout(timerId);
  }, [refreshSessionAllReps, setHistory.length, currentSetIndex]);

  // Refresh recent exercise history when lift changes
  useEffect(() => {
    void refreshRecentExerciseHistory();
  }, [refreshRecentExerciseHistory]);

  const sameLoadRecentHistory = useMemo(
    () =>
      recentExerciseHistory.filter(
        (set) => Math.abs(set.load_kg - currentLoad) < 0.26,
      ),
    [currentLoad, recentExerciseHistory],
  );

  // Initialize session note from current session
  useEffect(() => {
    setSessionNote(currentSession?.notes ?? "");
  }, [currentSession?.notes]);

  // Auto-finish session on app background to prevent data loss
  const autoFinishHandled = useRef(false);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (
        nextAppState === "background" &&
        isSessionActive &&
        repHistory.length > 0 &&
        !autoFinishHandled.current
      ) {
        autoFinishHandled.current = true;
        console.log(
          "[SessionScreen] App going to background with active session and reps, auto-finishing...",
        );

        // Use setTimeout to allow the UI to update before blocking on save
        setTimeout(async () => {
          try {
            await finishSet();
            await refreshSessionAllReps();
            console.log("[SessionScreen] Auto-finish completed successfully");
          } catch (error) {
            console.error("[SessionScreen] Auto-finish failed:", error);
          }
        }, 100);
      } else if (nextAppState === "active") {
        // Reset the flag when app comes back to foreground
        autoFinishHandled.current = false;
      }
    });

    return () => {
      subscription.remove();
    };
  }, [isSessionActive, repHistory.length, finishSet, refreshSessionAllReps]);

  const [inputTargetWeight, setInputTargetWeight] = useState("");
  const [inputLoad, setInputLoad] = useState(formatLoadKg(currentLoad));

  const getSetKey = useCallback(
    (lift: string, setIndex: number) => `${lift}::${setIndex}`,
    [],
  );

  const repsBySetKey = useMemo(() => {
    const map = new Map<string, RepData[]>();
    for (const rep of sessionAllReps) {
      const key = getSetKey(rep.lift, rep.set_index);
      const existing = map.get(key);
      if (existing) {
        existing.push(rep);
      } else {
        map.set(key, [rep]);
      }
    }
    return map;
  }, [getSetKey, sessionAllReps]);

  const selectedSet = useMemo(
    () =>
      setHistory.find(
        (setItem) =>
          setItem.set_index === selectedSetIndex &&
          setItem.lift === selectedSetLift,
      ) ?? null,
    [selectedSetIndex, selectedSetLift, setHistory],
  );

  useEffect(() => {
    if (targetWeight !== null) {
      setInputTargetWeight(targetWeight.toString());
    } else {
      setInputTargetWeight("");
    }
  }, [targetWeight]);

  useEffect(() => {
    setInputLoad(formatLoadKg(currentLoad));
  }, [currentLoad]);

  const handleTargetWeightChange = (text: string) => {
    setInputTargetWeight(text);
    const val = parseFloat(text);
    if (!isNaN(val)) setTargetWeight(val);
    else setTargetWeight(null);
  };

  const adjustLoad = (amount: number) => {
    const newLoad = roundToHalfKg(Math.max(0, currentLoad + amount));
    updateLoad(newLoad);
  };

  const commitLoadInput = (text: string) => {
    const normalized = text.trim().replace(",", ".");
    if (!normalized) {
      setInputLoad(formatLoadKg(currentLoad));
      return;
    }

    const val = Number.parseFloat(normalized);
    if (Number.isNaN(val)) {
      setInputLoad(formatLoadKg(currentLoad));
      return;
    }

    updateLoad(roundToHalfKg(Math.max(0, val)));
  };

  const openRepDetail = async (setItem: SetData) => {
    setSelectedSetIndex(setItem.set_index);
    setSelectedSetLift(setItem.lift);

    // Check if this is a historical set (different session)
    if (setItem.session_id !== currentSession?.session_id) {
      // Fetch reps for the historical session
      try {
        const historicalReps = await DatabaseService.getRepsForSession(
          setItem.session_id,
        );
        setHistoricalSessionReps({
          sessionId: setItem.session_id,
          reps: historicalReps,
        });
      } catch (error) {
        console.error("Failed to fetch historical reps:", error);
        setHistoricalSessionReps(null);
      }
    } else {
      // Current session - use current session reps
      setHistoricalSessionReps(null);
      await refreshSessionAllReps();
    }

    setRepDetailVisible(true);
  };

  const showTooltip = (
    type: "MEAN_VELOCITY" | "PEAK_VELOCITY" | "VELOCITY_LOSS" | "ROM",
    currentValue?: number,
  ) => {
    const glossary = VELOCITY_GLOSSARY[type];
    let currentStatus: "good" | "warning" | "danger" | undefined;
    let currentValueStr: string | undefined;

    if (currentValue !== undefined) {
      currentValueStr = `${currentValue.toFixed(2)} ${type === "VELOCITY_LOSS" ? "%" : "m/s"}`;

      if (type === "MEAN_VELOCITY" || type === "PEAK_VELOCITY") {
        if (currentValue >= 1.0) currentStatus = "good";
        else if (currentValue >= 0.75) currentStatus = "warning";
        else currentStatus = "danger";
      } else if (type === "VELOCITY_LOSS") {
        if (currentValue <= 20) currentStatus = "good";
        else if (currentValue <= 30) currentStatus = "warning";
        else currentStatus = "danger";
      }
    }

    setTooltipData({
      term: glossary.term,
      definition: glossary.definition,
      targetRange: glossary.targetRange,
      currentStatus,
      currentValue: currentValueStr,
    });
    setTooltipVisible(true);
  };

  const handleLoadChange = (text: string) => {
    const val = parseFloat(text);
    if (!isNaN(val)) updateLoad(roundToHalfKg(val));
  };

  const handleExerciseSelect = (exercise: Exercise) => {
    setCurrentExercise(exercise);
    setShowExerciseModal(false);
  };

  const handleExclude = async (repId: string, reason: string) => {
    await handleExcludeRep(repId, reason);
    if (currentSession?.session_id) {
      DatabaseService.getRepsForSession(currentSession.session_id).then(
        setSessionAllReps,
      );
    }
  };

  const handleMarkSetupRep = async (repId: string) => {
    await handleExclude(repId, "setup_reaction");
  };

  const handleAddMissedRep = async () => {
    if (!currentSession?.session_id || !selectedSet) return;

    try {
      const targetSetReps =
        repsBySetKey.get(getSetKey(selectedSet.lift, selectedSet.set_index)) ??
        [];

      const newRep: RepData = {
        id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        session_id: currentSession.session_id,
        lift: selectedSet.lift,
        set_index: selectedSet.set_index,
        rep_index: targetSetReps.length + 1,
        load_kg: selectedSet.load_kg,
        device_type: "manual",
        mean_velocity: null,
        peak_velocity: null,
        rom_cm: null,
        rep_duration_ms: null,
        mean_power_w: null,
        timestamp: new Date().toISOString(),
        is_valid_rep: false,
        set_type: selectedSet.set_type,
        notes: "手動追加",
      };

      await DatabaseService.insertRep(newRep);
      await DatabaseService.recalculateAndUpdateSet(
        currentSession.session_id,
        selectedSet.lift,
        selectedSet.set_index,
      );
      const metrics = await DatabaseService.recalculateSetMetrics(
        currentSession.session_id,
        selectedSet.lift,
        selectedSet.set_index,
      );
      if (metrics) {
        updateSetHistory(selectedSet.set_index, selectedSet.lift, metrics);
      }
      await refreshSessionAllReps();

      Alert.alert("成功", "レップを追加しました");
    } catch (error) {
      console.error("Failed to add rep:", error);
      Alert.alert("エラー", "レップの追加に失敗しました");
    }
  };

  const handleEditSetLoad = (setItem: SetData) => {
    setEditingSet(setItem);
  };

  const handleSaveSetEdits = async (values: {
    loadKg: number;
    lift: string;
    rpe?: number;
    notes: string;
  }) => {
    if (!currentSession?.session_id || !editingSet) return;

    try {
      const oldLift = editingSet.lift;
      const newLift = values.lift;

      await DatabaseService.updateSetEditableFields(
        currentSession.session_id,
        editingSet.set_index,
        editingSet.lift,
        {
          load_kg: values.loadKg,
          lift: newLift,
          rpe: values.rpe,
          notes: values.notes,
        },
      );

      // 種目名が変更された場合は、古い種目名でメトリクスを再計算してから新しい種目名で更新
      const metrics = await DatabaseService.recalculateSetMetrics(
        currentSession.session_id,
        oldLift,
        editingSet.set_index,
      );

      // 種目名が変更された場合は、新しい種目名で履歴を更新
      updateSetHistory(editingSet.set_index, oldLift, {
        lift: newLift,
        load_kg: values.loadKg,
        rpe: values.rpe,
        notes: values.notes,
        ...(metrics ?? {}),
      });

      await refreshSessionAllReps();
      setEditingSet(null);
    } catch (error) {
      console.error("Failed to update set fields:", error);
      Alert.alert("保存失敗", "セット情報の更新に失敗しました。");
    }
  };

  // セッション開始処理
  const handleStartSession = async () => {
    if (!isConnected) {
      Alert.alert(
        "センサー未接続",
        "BLEセンサーを接続してからセッションを開始してください。",
      );
      return;
    }
    // UUID風のセッションIDを生成
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    startSession(sessionId);
    // DBにセッションレコードを作成
    try {
      await DatabaseService.insertSession({
        session_id: sessionId,
        date: new Date().toISOString().split("T")[0],
        total_volume: 0,
        total_sets: 0,
        lifts: [],
      });
    } catch (e) {
      console.error("セッション作成失敗:", e);
    }
  };

  const handleFinishSet = async () => {
    if (!isSessionActive) {
      Alert.alert("セッション未開始", "まずセッションを開始してください。");
      return;
    }

    await finishSet();
    await refreshSessionAllReps();
  };

  const handleSaveSessionNote = async () => {
    if (!currentSession?.session_id) return;
    try {
      await DatabaseService.updateSessionNotes(
        currentSession.session_id,
        sessionNote,
      );
      setEditingSessionNote(false);
      Alert.alert("保存完了", "セッションノートを保存しました");
    } catch (error) {
      console.error("Failed to save session note:", error);
      Alert.alert("エラー", "セッションノートの保存に失敗しました");
    }
  };

  const isMeasuring = isSessionActive && !isPaused;

  // セッション終了 & DBへの集計保存
  const handleFinishSession = async () => {
    if (setHistory.length === 0) {
      Alert.alert(
        "セッション終了",
        "セットが記録されていません。終了しますか？",
        [
          { text: "キャンセル", style: "cancel" },
          {
            text: "終了",
            style: "destructive",
            onPress: () => {
              endSession();
              if (navigationState.canGoBack()) {
                router.back();
              } else {
                router.replace("/(tabs)");
              }
            },
          },
        ],
      );
      return;
    }

    // MVTの計算と提案（セッション終了時に行う）
    try {
      await calculateAndProposeMVT();
    } catch (e) {
      console.error("MVT提案計算に失敗（セッション終了は継続します）:", e);
    }

    // セッション集計をDBに更新
    if (currentSession?.session_id) {
      try {
        const totalVolume = setHistory.reduce(
          (sum, s) => sum + s.load_kg * s.reps,
          0,
        );
        const durationMs = sessionStartTime ? Date.now() - sessionStartTime : 0;
        const durationMin = Math.round(durationMs / 60000);
        const avgHr =
          sessionHRPoints.length > 0
            ? sessionHRPoints.reduce((s, x) => s + x, 0) /
              sessionHRPoints.length
            : undefined;

        await DatabaseService.updateSession({
          session_id: currentSession.session_id,
          date: currentSession.date || new Date().toISOString().split("T")[0],
          total_volume: totalVolume,
          total_sets: setHistory.length,
          duration_minutes: durationMin,
          duration_seconds: Math.round(durationMs / 1000),
          start_timestamp: currentSession.start_timestamp,
          end_timestamp: new Date().toISOString(),
          avg_hr: avgHr,
          notes: currentSession.notes,
        });
      } catch (e) {
        console.error("セッション集計の保存に失敗:", e);
      }
    }

    endSession();
    Alert.alert(
      "セッション完了",
      `${setHistory.length}セットを保存しました。`,
      [
        {
          text: "OK",
          onPress: () =>
            navigationState.canGoBack()
              ? router.back()
              : router.replace("/(tabs)"),
        },
      ],
    );
  };

  const handleAcceptMVT = async () => {
    if (!currentLift || proposedMVT === null) return;
    try {
      const existingLvp = await DatabaseService.getLVPProfile(currentLift);
      if (existingLvp) {
        await DatabaseService.saveLVPProfile({
          ...existingLvp,
          mvt: proposedMVT,
          last_updated: new Date().toISOString(),
        });
      }

      if (currentExercise?.id) {
        await ExerciseService.updateExercise(currentExercise.id, {
          mvt: proposedMVT,
        });
      }

      Alert.alert(
        "MVT更新",
        `${currentLift}の限界速度を ${proposedMVT}m/s に更新しました。`,
      );
      setProposedMVT(null); // バナーを閉じる
    } catch (e) {
      console.error("MVT更新失敗:", e);
    }
  };

  return (
    <View
      style={[styles.screenFrame, isMeasuring && styles.screenFrameRecording]}
    >
      <ScrollView style={styles.container}>
        <View style={[styles.header, { paddingTop: (insets.top || 0) + 12 }]}>
          <TouchableOpacity
            onPress={() =>
              navigationState.canGoBack()
                ? router.back()
                : router.replace("/(tabs)")
            }
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>← 戻る</Text>
          </TouchableOpacity>
          <Text style={styles.title}>セッション</Text>
          {/* AIコーチボタン */}
          <TouchableOpacity
            style={styles.coachNavButton}
            onPress={() => router.push('/ai-coach')}
          >
            <Text style={styles.coachNavButtonText}>AIコーチ</Text>
          </TouchableOpacity>
        </View>

        {/* Connection Status */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: isConnected
                    ? GarageTheme.success
                    : GarageTheme.danger,
                },
              ]}
            />
            <Text style={styles.statusText}>
              {isConnected ? "センサー接続中" : "センサー未接続"}
            </Text>
          </View>
          {currentHeartRate != null && (
            <View style={styles.hrBadge}>
              <Text style={styles.hrValue}>{Math.round(currentHeartRate)}</Text>
              <Text style={styles.hrUnit}>bpm</Text>
              {(() => {
                const peakHr =
                  setHistory.length > 0 && setHistory[setHistory.length - 1].peak_hr
                    ? setHistory[setHistory.length - 1].peak_hr!
                    : getPeakHeartRate(sessionHRPoints);

                if (peakHr > 0) {
                  const signal = calculateRecoverySignal(currentHeartRate, peakHr);
                  return (
                    <View style={[styles.signalDot, { backgroundColor: signal.color }]}>
                      <Text style={styles.signalLabel}>{signal.label}</Text>
                    </View>
                  );
                }
                return null;
              })()}
            </View>
          )}
        </View>

        {/* Exercise Selection */}
        <View style={styles.exerciseCard}>
          <Text style={styles.exerciseLabel}>Exercise</Text>
          {currentExercise ? (
            <TouchableOpacity
              style={styles.exerciseSelector}
              onPress={() => setShowExerciseModal(true)}
            >
              <View style={styles.exerciseInfo}>
                <Text style={styles.exerciseName}>{currentExercise.name}</Text>
                <Text style={styles.exerciseCategory}>
                  {getExerciseCategoryLabel(currentExercise.category)}
                </Text>
              </View>
              <Text style={styles.exerciseChange}>Change</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.exerciseSelectButton}
              onPress={() => setShowExerciseModal(true)}
            >
              <Text style={styles.exerciseSelectButtonText}>
                Select Exercise
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* VL Threshold Quick Setting */}
        {currentExercise && (
          <View style={styles.vlSettingsCard}>
            <View style={styles.vlSettingsHeader}>
              <Text style={styles.vlSettingsTitle}>VL閾値</Text>
              <View style={styles.vlToggleRow}>
                <Text style={styles.vlToggleLabel}>オン</Text>
                <TouchableOpacity
                  style={[
                    styles.vlToggleButton,
                    settings.enable_vl_warning ? styles.vlToggleOn : styles.vlToggleOff,
                  ]}
                  onPress={() => updateSettings({ enable_vl_warning: !settings.enable_vl_warning })}
                >
                  <View style={[
                    styles.vlToggleKnob,
                    settings.enable_vl_warning ? styles.vlToggleKnobOn : styles.vlToggleKnobOff,
                  ]} />
                </TouchableOpacity>
              </View>
            </View>
            {settings.enable_vl_warning && (
              <View style={styles.vlThresholdButtons}>
                {[10, 15, 20, 25, 30].map((threshold) => {
                  const currentThreshold = currentExercise.velocity_loss_threshold ?? settings.velocity_loss_threshold;
                  const isSelected = currentThreshold === threshold;
                  return (
                    <TouchableOpacity
                      key={threshold}
                      style={[
                        styles.vlThresholdButton,
                        isSelected ? styles.vlThresholdButtonSelected : styles.vlThresholdButtonUnselected,
                      ]}
                      onPress={async () => {
                        const updatedExercise = { ...currentExercise, velocity_loss_threshold: threshold };
                        setCurrentExercise(updatedExercise);
                        await ExerciseService.updateExercise(updatedExercise);
                      }}
                    >
                      <Text style={[
                        styles.vlThresholdButtonText,
                        isSelected ? styles.vlThresholdButtonTextSelected : styles.vlThresholdButtonTextUnselected,
                      ]}>
                        {threshold}%
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* Training Cue & Focus Note */}
        {currentExercise &&
          (currentExercise.training_cue || currentExercise.focus_note) && (
            <View style={styles.trainingNotesCard}>
              {currentExercise.training_cue && (
                <View style={styles.noteSection}>
                  <Text style={styles.noteLabel}>トレーニングキュー</Text>
                  <Text style={styles.noteText}>
                    {currentExercise.training_cue}
                  </Text>
                </View>
              )}
              {currentExercise.focus_note && (
                <View style={styles.noteSection}>
                  <Text style={styles.noteLabel}>フォーカスノート</Text>
                  <Text style={styles.noteText}>
                    {currentExercise.focus_note}
                  </Text>
                </View>
              )}
            </View>
          )}

        {/* Session Note */}
        {isSessionActive && (
          <View style={styles.sessionNoteCard}>
            <View style={styles.sessionNoteHeader}>
              <Text style={styles.sessionNoteLabel}>
                今日のトレーニングメモ
              </Text>
              <TouchableOpacity
                onPress={() => setEditingSessionNote(!editingSessionNote)}
                style={styles.sessionNoteEditButton}
              >
                <Text style={styles.sessionNoteEditText}>
                  {editingSessionNote ? "閉じる" : "編集"}
                </Text>
              </TouchableOpacity>
            </View>
            {editingSessionNote ? (
              <View style={styles.sessionNoteEditContainer}>
                <TextInput
                  style={styles.sessionNoteInput}
                  value={sessionNote}
                  onChangeText={setSessionNote}
                  placeholder="今日のトレーニングのメモを入力..."
                  placeholderTextColor={GarageTheme.textSubtle}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
                <TouchableOpacity
                  style={styles.sessionNoteSaveButton}
                  onPress={handleSaveSessionNote}
                >
                  <Text style={styles.sessionNoteSaveButtonText}>保存</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.sessionNoteText}>
                {sessionNote || "メモはまだありません"}
              </Text>
            )}
          </View>
        )}

        {/* セッション開始バナー */}
        {!isSessionActive ? (
          <View style={styles.sessionStartBanner}>
            <View style={styles.sessionStartBannerContent}>
              <View style={styles.sessionStartBadge}>
                <Text style={styles.sessionStartBadgeIcon}>⚡</Text>
              </View>
              <View style={styles.sessionStartTextContainer}>
                <Text style={styles.sessionStartTitle}>
                  セッションを開始してください
                </Text>
                <Text style={styles.sessionStartSubtitle}>
                  BLEセンサー接続済み
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.button, styles.startSessionButton]}
              onPress={handleStartSession}
            >
              <Text style={styles.buttonText}>セッション開始</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.sessionActiveBanner}>
            <View style={styles.sessionActiveBannerLeft}>
              <View
                style={[
                  styles.sessionActiveIndicator,
                  isPaused && styles.sessionActiveIndicatorPaused,
                ]}
              >
                <View
                  style={[
                    styles.sessionActiveIndicatorDot,
                    isPaused && styles.sessionActiveIndicatorDotPaused,
                  ]}
                />
              </View>
              <View style={styles.sessionActiveTextContainer}>
                <Text style={styles.sessionActiveTitle}>
                  {isPaused
                    ? `SET ${Math.max(1, currentSetIndex - 1)} PAUSED`
                    : `SET ${currentSetIndex} RECORDING`}
                </Text>
                <Text style={styles.sessionActiveSubtitle}>
                  {isPaused ? "一時停止中" : "レコーディング中"}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.pauseBtn, isPaused && styles.pausedBtnActive]}
              onPress={() => {
                if (isPaused) {
                  // 再開時：履歴を保持するため resumeSet を使用
                  resumeSet();
                } else {
                  // 一時停止時はsetPausedを使用
                  setPaused(true, "manual");
                }
              }}
            >
              <View style={styles.pauseBtnContent}>
                <Text style={styles.pauseBtnIcon}>{isPaused ? "▶" : "⏸"}</Text>
                <Text style={styles.pauseBtnText}>
                  {isPaused ? "再開" : "一時停止"}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* CNS Battery & VBT Intelligence Summary */}
        {isSessionActive && (
          <View style={styles.intelligenceRow}>
            <View style={styles.cnsBatteryContainer}>
              <Text style={styles.cnsLabel}>CNS BATTERY™</Text>
              <View style={styles.batteryGageBg}>
                <View
                  style={[
                    styles.batteryGageFill,
                    {
                      width: `${cnsBattery}%`,
                      backgroundColor:
                        cnsBattery > 70
                          ? GarageTheme.success
                          : cnsBattery > 40
                            ? GarageTheme.warning
                            : GarageTheme.danger,
                    },
                  ]}
                />
              </View>
              <Text style={styles.cnsValue}>{cnsBattery}%</Text>
            </View>

            {estimated1RM !== null && (
              <View style={styles.intelligenceBadge}>
                <Text style={styles.intelligenceLabel}>本日予想 1RM</Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "baseline",
                    gap: 4,
                  }}
                >
                  <Text style={styles.intelligenceValue}>{estimated1RM}</Text>
                  <Text style={styles.unitSmall}>kg</Text>
                </View>
                {estimated1RM_confidence && (
                  <View
                    style={[
                      styles.confidenceIndicator,
                      {
                        backgroundColor:
                          estimated1RM_confidence === "high"
                            ? GarageTheme.success
                            : estimated1RM_confidence === "medium"
                              ? GarageTheme.warning
                              : GarageTheme.danger,
                      },
                    ]}
                  >
                    <Text style={styles.confidenceText}>
                      {estimated1RM_confidence === "high"
                        ? "High"
                        : estimated1RM_confidence === "medium"
                          ? "Med"
                          : "Low"}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Adaptive Load Suggestion */}
        {isSessionActive &&
          suggestedLoad !== null &&
          suggestedLoad !== currentLoad && (
            <TouchableOpacity
              style={styles.suggestionBanner}
              onPress={() => handleLoadChange(suggestedLoad.toString())}
            >
              <View style={styles.suggestionContent}>
                <Text style={styles.suggestionText}>
                  推奨重量:{" "}
                  <Text style={styles.suggestionWeight}>
                    {formatLoadKg(suggestedLoad)}kg
                  </Text>{" "}
                  に変更しますか？
                </Text>
              </View>
              <Text style={styles.applyText}>適用する</Text>
            </TouchableOpacity>
          )}

        {!isSessionActive && currentLift && (
          <TouchableOpacity
            style={styles.optimizeMvtButton}
            onPress={() => void calculateAndProposeMVT()}
          >
            <Text style={styles.optimizeMvtButtonText}>
              履歴から V@1RM を最適化
            </Text>
          </TouchableOpacity>
        )}

        {/* MVT Proposal Banner */}
        {!isSessionActive && proposedMVT !== null && currentLift && (
          <View
            style={[
              styles.suggestionBanner,
              {
                backgroundColor: GarageTheme.surface,
                borderLeftColor: GarageTheme.accentSoft,
              },
            ]}
          >
            <View style={styles.suggestionContent}>
              <View>
                <Text style={styles.suggestionText}>
                  {currentLift}の新しい限界速度(MVT)候補:
                </Text>
                <Text
                  style={[
                    styles.suggestionWeight,
                    { color: GarageTheme.accentSoft, fontSize: 16 },
                  ]}
                >
                  {proposedMVT} m/s
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity onPress={() => setProposedMVT(null)}>
                <Text
                  style={[styles.applyText, { color: GarageTheme.textMuted }]}
                >
                  無視
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAcceptMVT}>
                <Text
                  style={[
                    styles.applyText,
                    { color: GarageTheme.accentSoft, fontSize: 14 },
                  ]}
                >
                  更新する
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Rest Timer Banner */}
        {isSessionActive && isPaused && pauseReason === "rest" && (
          <View style={styles.restBanner}>
            <View style={styles.restHeader}>
              <Text style={styles.restLabel}>RESTING...</Text>
              <RestTimer
                startTime={restStartTime || 0}
                hr={currentHeartRate}
                peakHr={
                  setHistory.length > 0
                    ? setHistory[setHistory.length - 1].peak_hr
                    : null
                }
              />
            </View>
            <TouchableOpacity
              style={styles.startNextSetButton}
              onPress={startSet}
            >
              <Text style={styles.startNextSetText}>次のセットを開始</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Target Weight Input (Big 3 Only) */}
        {isBig3(currentExercise?.category) && isSessionActive && (
          <View style={styles.targetWeightCard}>
            <Text style={styles.targetWeightLabel}>
              今日の目標重量 (Top Set)
            </Text>
            <View style={styles.targetInputRow}>
              <TextInput
                style={styles.targetInput}
                value={inputTargetWeight}
                onChangeText={handleTargetWeightChange}
                placeholder="最高重量を入力"
                placeholderTextColor="#666"
                keyboardType="numeric"
              />
              <Text style={styles.unitText}>kg</Text>
            </View>
          </View>
        )}

        {/* Warmup Guide */}
        {isBig3(currentExercise?.category) &&
          targetWeight &&
          isSessionActive &&
          settings.enable_warmup_recommendations && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>WARMUP GUIDE</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.warmupScroll}
              >
                {calculateWarmupSteps(targetWeight).map((step, idx) => {
                  const isCurrent = currentLoad === step.load_kg;
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[
                        styles.warmupStep,
                        isCurrent && styles.warmupStepActive,
                      ]}
                      onPress={() => handleLoadChange(step.load_kg.toString())}
                    >
                      <Text
                        style={[
                          styles.warmupStepLabel,
                          isCurrent && styles.warmupStepLabelActive,
                        ]}
                      >
                        {step.label}
                      </Text>
                      <Text
                        style={[
                          styles.warmupWeight,
                          isCurrent && styles.warmupWeightActive,
                        ]}
                      >
                        {formatLoadKg(step.load_kg)}kg
                      </Text>
                      <Text
                        style={[
                          styles.warmupReps,
                          isCurrent && styles.warmupRepsActive,
                        ]}
                      >
                        {step.reps > 0 ? `${step.reps} reps` : "Main"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

        {/* Set Configuration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SET CONFIGURATION</Text>
          <View style={styles.loadControlContainer}>
            <Text style={styles.loadControlLabel}>Load (kg)</Text>
            <View style={styles.loadControlWrapper}>
              <View style={styles.loadAdjustRow}>
                <TouchableOpacity
                  style={styles.adjustBtn}
                  onPress={() => adjustLoad(-5)}
                >
                  <Text style={styles.adjustBtnText}>-5</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.adjustBtn}
                  onPress={() => adjustLoad(-1)}
                >
                  <Text style={styles.adjustBtnText}>-1</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.adjustBtn}
                  onPress={() => adjustLoad(-0.5)}
                >
                  <Text style={styles.adjustBtnText}>-0.5</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.loadDisplayValue}>
                <Text style={styles.loadDisplayValueText}>
                  {formatLoadKg(currentLoad)}
                </Text>
              </View>
              <View style={styles.loadAdjustRow}>
                <TouchableOpacity
                  style={styles.adjustBtn}
                  onPress={() => adjustLoad(0.5)}
                >
                  <Text style={styles.adjustBtnText}>+0.5</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.adjustBtn}
                  onPress={() => adjustLoad(1)}
                >
                  <Text style={styles.adjustBtnText}>+1</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.adjustBtn}
                  onPress={() => adjustLoad(5)}
                >
                  <Text style={styles.adjustBtnText}>+5</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.loadInputRow}>
              <TextInput
                style={styles.loadInput}
                value={inputLoad}
                onChangeText={setInputLoad}
                onEndEditing={(event) =>
                  commitLoadInput(event.nativeEvent.text)
                }
                onBlur={() => commitLoadInput(inputLoad)}
                keyboardType="decimal-pad"
                placeholder="重量を入力"
                placeholderTextColor={GarageTheme.textSubtle}
                returnKeyType="done"
              />
              <Text style={styles.unitText}>kg</Text>
            </View>
          </View>
        </View>

        {/* Live データ表示 */}
        <View style={styles.dataCard}>
          <Text style={styles.dataTitle}>Live Data</Text>
          {liveData ? (
            <>
              {/* 速度ゾーンバッジ */}
              {(() => {
                const zone = AICoachService.getZone(liveData.mean_velocity);
                return (
                  <View style={[styles.zoneBadge, { borderColor: zone.color }]}>
                    <Text
                      style={[
                        styles.zoneTag,
                        { color: zone.color, borderColor: zone.color },
                      ]}
                    >
                      {zone.emoji}
                    </Text>
                    <Text style={[styles.zoneName, { color: zone.color }]}>
                      {zone.name}
                    </Text>
                  </View>
                );
              })()}
              <TouchableOpacity
                style={styles.dataRow}
                onPress={() =>
                  showTooltip("MEAN_VELOCITY", liveData.mean_velocity)
                }
              >
                <Text style={styles.dataLabel}>Mean Velocity</Text>
                <Text
                  style={[
                    styles.dataValue,
                    {
                      color: AICoachService.getZone(liveData.mean_velocity)
                        .color,
                    },
                  ]}
                >
                  {liveData.mean_velocity.toFixed(2)} m/s
                </Text>
                <Text style={styles.helpIcon}>❓</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dataRow}
                onPress={() =>
                  showTooltip("PEAK_VELOCITY", liveData.peak_velocity)
                }
              >
                <Text style={styles.dataLabel}>Peak Velocity</Text>
                <Text style={styles.dataValue}>
                  {liveData.peak_velocity.toFixed(2)} m/s
                </Text>
                <Text style={styles.helpIcon}>❓</Text>
              </TouchableOpacity>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Mean Power</Text>
                <Text style={styles.dataValue}>
                  {liveData.mean_power_w != null
                    ? `${Math.round(liveData.mean_power_w)} W`
                    : liveData.mean_velocity != null
                      ? `${Math.round(
                          VBTLogic.calculatePower(
                            currentLoad,
                            liveData.mean_velocity,
                          ),
                        )} W`
                      : liveData.peak_velocity != null
                        ? `${Math.round(
                            VBTLogic.calculatePower(
                              currentLoad,
                              liveData.peak_velocity,
                            ),
                          )} W`
                        : "-"}
                </Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Peak Power</Text>
                <Text style={styles.dataValue}>
                  {liveData.peak_power_w != null
                    ? `${Math.round(liveData.peak_power_w)} W`
                    : liveData.peak_velocity != null
                      ? `${Math.round(
                          VBTLogic.calculatePower(
                            currentLoad,
                            liveData.peak_velocity,
                          ),
                        )} W`
                      : "-"}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.dataRow}
                onPress={() => showTooltip("ROM", liveData.rom_cm)}
              >
                <Text style={styles.dataLabel}>ROM</Text>
                <Text style={styles.dataValue}>
                  {liveData.rom_cm.toFixed(0)} cm
                </Text>
                <Text style={styles.helpIcon}>❓</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.noDataText}>REP INPUT WAITING</Text>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Mean Power</Text>
                <Text style={styles.dataValue}>-</Text>
              </View>
              <View style={styles.dataRow}>
                <Text style={styles.dataLabel}>Peak Power</Text>
                <Text style={styles.dataValue}>-</Text>
              </View>
            </>
          )}
        </View>

        {/* レップ毎の平均速度推移グラフ */}
        {isSessionActive && repHistory && repHistory.length > 0 && (
          <RepVelocityChart
            reps={repHistory}
            setIndex={currentSetIndex}
            lift={currentLift}
          />
        )}

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.warmupButton,
              isWarmupMode && styles.warmupButtonActive,
            ]}
            onPress={() => {
              const newMode = !isWarmupMode;
              setIsWarmupMode(newMode);
              setWarmupMode(newMode);
            }}
          >
            <Text style={styles.warmupButtonText}>
              {isWarmupMode ? "ウォームアップON" : "ウォームアップ"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.recordButton]}
            onPress={handleFinishSet}
          >
            <Text style={styles.buttonText}>SET COMPLETE</Text>
          </TouchableOpacity>
        </View>

        {/* AIコーチアドバイスカード */}
        {setHistory.length > 0 &&
          (() => {
            const advice = AICoachService.getCoachingAdvice(
              setHistory,
              currentSetIndex,
              currentExercise,
            );
            const colorMap = {
              info: GarageTheme.info,
              success: GarageTheme.success,
              warning: GarageTheme.warning,
              alert: GarageTheme.danger,
            };
            return (
              <View
                style={[
                  styles.coachCard,
                  { borderColor: colorMap[advice.severity] },
                ]}
              >
                <View
                  style={[
                    styles.coachBadge,
                    { borderColor: colorMap[advice.severity] },
                  ]}
                >
                  <Text
                    style={[
                      styles.coachBadgeText,
                      { color: colorMap[advice.severity] },
                    ]}
                  >
                    {advice.emoji}
                  </Text>
                </View>
                <View style={styles.coachContent}>
                  <Text
                    style={[
                      styles.coachMessage,
                      { color: colorMap[advice.severity] },
                    ]}
                  >
                    {advice.message}
                  </Text>
                  {advice.suggestedAction && (
                    <Text style={styles.coachAction}>
                      {advice.suggestedAction}
                    </Text>
                  )}
                </View>
              </View>
            );
          })()}

        {/* 直近同重量の速度履歴 */}
        {sameLoadRecentHistory.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              直近同重量 {formatLoadKg(currentLoad)}kg の速度履歴
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.recentHistoryScroll}
              contentContainerStyle={styles.recentHistoryContent}
            >
              {sameLoadRecentHistory.map((set) => {
                const zone = set.avg_velocity
                  ? AICoachService.getZone(set.avg_velocity)
                  : null;
                return (
                  <TouchableOpacity
                    key={`same-${set.session_id}-${set.set_index}`}
                    style={[
                      styles.recentHistoryCard,
                      { borderColor: zone?.color ?? GarageTheme.border },
                    ]}
                    onPress={() => openRepDetail(set)}
                  >
                    <Text style={styles.recentHistoryDate}>
                      {new Date(set.timestamp).toLocaleDateString("ja-JP", {
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                    <View style={styles.recentHistoryStats}>
                      <View style={styles.recentHistoryStat}>
                        <Text style={styles.recentHistoryStatLabel}>回数</Text>
                        <Text style={styles.recentHistoryStatValue}>
                          {set.reps}
                        </Text>
                      </View>
                      {set.avg_velocity ? (
                        <View style={styles.recentHistoryStat}>
                          <Text style={styles.recentHistoryStatLabel}>
                            平均速度
                          </Text>
                          <Text style={styles.recentHistoryStatValue}>
                            {set.avg_velocity.toFixed(2)}
                          </Text>
                        </View>
                      ) : null}
                      {set.velocity_loss != null ? (
                        <View style={styles.recentHistoryStat}>
                          <Text style={styles.recentHistoryStatLabel}>VL</Text>
                          <Text style={styles.recentHistoryStatValue}>
                            {set.velocity_loss.toFixed(1)}%
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* 最近の種目履歴 */}
        {recentExerciseHistory.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>最近の{currentLift}履歴</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.recentHistoryScroll}
              contentContainerStyle={styles.recentHistoryContent}
            >
              {recentExerciseHistory.map((set) => {
                const zone = set.avg_velocity
                  ? AICoachService.getZone(set.avg_velocity)
                  : null;
                return (
                  <TouchableOpacity
                    key={`${set.session_id}-${set.set_index}`}
                    style={[
                      styles.recentHistoryCard,
                      { borderColor: zone?.color ?? GarageTheme.border },
                    ]}
                    onPress={() => openRepDetail(set)}
                  >
                    <Text style={styles.recentHistoryDate}>
                      {new Date(set.timestamp).toLocaleDateString("ja-JP", {
                        month: "short",
                        day: "numeric",
                      })}
                    </Text>
                    <View style={styles.recentHistoryStats}>
                      <View style={styles.recentHistoryStat}>
                        <Text style={styles.recentHistoryStatLabel}>重量</Text>
                        <Text style={styles.recentHistoryStatValue}>
                          {formatLoadKg(set.load_kg)}
                        </Text>
                      </View>
                      <View style={styles.recentHistoryStat}>
                        <Text style={styles.recentHistoryStatLabel}>回数</Text>
                        <Text style={styles.recentHistoryStatValue}>
                          {set.reps}
                        </Text>
                      </View>
                      {set.avg_velocity && (
                        <View style={styles.recentHistoryStat}>
                          <Text style={styles.recentHistoryStatLabel}>
                            速度
                          </Text>
                          <Text style={styles.recentHistoryStatValue}>
                            {set.avg_velocity.toFixed(2)}
                          </Text>
                        </View>
                      )}
                    </View>
                    {set.e1rm && (
                      <Text style={styles.recentHistoryE1RM}>
                        e1RM: {formatLoadKg(set.e1rm)}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* セッション履歴 */}
        {setHistory.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SESSION HISTORY</Text>
            {setHistory.map((set, idx) => {
              const zone = set.avg_velocity
                ? AICoachService.getZone(set.avg_velocity)
                : null;
              const setReps =
                repsBySetKey.get(getSetKey(set.lift, set.set_index)) ?? [];
              const trackedReps = setReps.filter(
                (rep) => !rep.is_excluded && !rep.is_failed && rep.is_valid_rep,
              );
              const avgPower =
                trackedReps.length > 0
                  ? trackedReps.reduce(
                      (sum, rep) => sum + (rep.mean_power_w ?? 0),
                      0,
                    ) / trackedReps.length
                  : set.avg_power_w != null
                    ? set.avg_power_w
                    : set.avg_velocity != null
                      ? VBTLogic.calculatePower(set.load_kg, set.avg_velocity)
                      : null;
              const estimatedRPE =
                set.velocity_loss != null
                  ? estimateRPEFromVelocityLoss(set.velocity_loss, set.reps)
                  : null;

              return (
                <View
                  key={`${set.lift}_${set.set_index}_${idx}`}
                  style={styles.setCard}
                >
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={() => {
                      void openRepDetail(set);
                    }}
                  >
                    <View style={styles.setHeader}>
                      <Text style={styles.setExerciseName}>{set.lift}</Text>
                      <Text style={styles.setNumberText}>
                        Set {set.set_index}
                      </Text>
                    </View>
                    <View style={styles.setMetaRow}>
                      <Text style={styles.setLoad}>
                        {formatLoadKg(set.load_kg)} kg × {set.reps}
                      </Text>
                      {zone ? (
                        <Text
                          style={[
                            styles.setZoneTag,
                            { color: zone.color, borderColor: zone.color },
                          ]}
                        >
                          {zone.emoji}
                        </Text>
                      ) : null}
                    </View>
                    <View style={styles.setRowDetail}>
                      <Text
                        style={[
                          styles.setVelocity,
                          zone ? { color: zone.color } : {},
                        ]}
                      >
                        Avg Vel {set.avg_velocity?.toFixed(2) ?? "-"} m/s
                      </Text>
                      <Text style={styles.setMetricChipText}>
                        Power{" "}
                        {avgPower != null ? `${Math.round(avgPower)} W` : "-"}
                      </Text>
                      <Text style={styles.setMetricChipText}>
                        VL{" "}
                        {set.velocity_loss != null
                          ? `${set.velocity_loss.toFixed(1)}%`
                          : "-"}
                      </Text>
                      <Text style={styles.setMetricChipText}>
                        心拍{" "}
                        {set.avg_hr != null
                          ? `${Math.round(set.avg_hr)} bpm`
                          : "-"}
                      </Text>
                      <Text style={styles.setMetricChipText}>
                        推定RPE{" "}
                        {estimatedRPE ? estimatedRPE.rpe.toFixed(1) : "-"}
                      </Text>
                    </View>
                    <SetVelocityMiniChart reps={trackedReps} />
                  </TouchableOpacity>
                  <View style={styles.setCardActions}>
                    <TouchableOpacity
                      style={styles.setActionButton}
                      onPress={() => {
                        void openRepDetail(set);
                      }}
                    >
                      <Text style={styles.setActionButtonText}>詳細</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.setActionButton}
                      onPress={() => handleEditSetLoad(set)}
                    >
                      <Text style={styles.setActionButtonText}>編集</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* End Session */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.finishButton]}
            onPress={handleFinishSession}
          >
            <Text style={styles.buttonText}>SESSION END</Text>
          </TouchableOpacity>
        </View>

        {/* エクササイズ選択モーダル */}
        <ExerciseSelectModal
          visible={showExerciseModal}
          onClose={() => setShowExerciseModal(false)}
          onSelect={handleExerciseSelect}
          currentExerciseId={currentExercise?.id}
        />

        {/* PR達成通知モーダル */}
        <PRNotification
          visible={showPRModal}
          prRecord={prRecord}
          onClose={() => setShowPRModal(false)}
        />
        {/* レップ詳細モーダル */}
        <RepDetailModal
          visible={repDetailVisible}
          reps={historicalSessionReps?.reps ?? sessionAllReps}
          setIndex={selectedSetIndex}
          lift={selectedSetLift}
          loadKg={selectedSet?.load_kg}
          onClose={() => setRepDetailVisible(false)}
          onEditSetLoad={
            selectedSet && !historicalSessionReps
              ? () => handleEditSetLoad(selectedSet)
              : undefined
          }
          onExcludeRep={!historicalSessionReps ? handleExclude : undefined}
          onMarkFailedRep={
            !historicalSessionReps ? handleMarkFailedRep : undefined
          }
          onMarkSetupRep={
            !historicalSessionReps ? handleMarkSetupRep : undefined
          }
          onAddMissedRep={
            !historicalSessionReps ? handleAddMissedRep : undefined
          }
        />

        <SetEditModal
          visible={Boolean(editingSet)}
          setItem={editingSet}
          onClose={() => setEditingSet(null)}
          onSave={handleSaveSetEdits}
        />

        {/* 用語ツールチップ */}
        {tooltipData && (
          <VelocityTooltip
            visible={tooltipVisible}
            onClose={() => setTooltipVisible(false)}
            term={tooltipData.term}
            definition={tooltipData.definition}
            targetRange={tooltipData.targetRange}
            currentStatus={tooltipData.currentStatus}
            currentValue={tooltipData.currentValue}
          />
        )}
      </ScrollView>
    </View>
  );
}

/**
 * セット履歴ミニ速度チャート
 */
function SetVelocityMiniChart({ reps }: { reps: RepData[] }) {
  if (reps.length === 0) {
    return null;
  }

  const maxVelocity = Math.max(
    ...reps.map((rep) => rep.mean_velocity ?? 0),
    0.4,
  );

  return (
    <View style={styles.setMiniChart}>
      {reps.map((rep) => {
        const velocity = rep.mean_velocity ?? 0;
        const height = Math.max(8, Math.round((velocity / maxVelocity) * 28));
        return (
          <View
            key={`${rep.lift}_${rep.set_index}_${rep.rep_index}_${rep.id ?? "rep"}`}
            style={[
              styles.setMiniBar,
              { height },
              (rep.is_excluded || rep.is_failed) && styles.setMiniBarMuted,
            ]}
          />
        );
      })}
    </View>
  );
}

/**
 * レストタイマーコンポーネント
 */
function RestTimer({
  startTime,
  hr,
  peakHr,
}: {
  startTime: number;
  hr: number | null;
  peakHr: number | null | undefined;
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const isReady = hr && peakHr ? hr < 120 || hr < peakHr * 0.8 : false;

  return (
    <View style={styles.timerRow}>
      <Text style={styles.timerText}>{formatTime(elapsed)}</Text>
      {hr != null ? (
        <View style={styles.timerHrBadge}>
          <Text style={styles.timerHrLabel}>心拍</Text>
          <Text style={styles.timerHrText}>{Math.round(hr)}</Text>
        </View>
      ) : null}
      {isReady && (
        <View style={styles.readyBadge}>
          <Text style={styles.readyText}>READY</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screenFrame: {
    flex: 1,
    backgroundColor: GarageTheme.background,
  },
  screenFrameRecording: {
    borderWidth: 2,
    borderColor: "#ff3b30",
    shadowColor: "#ff3b30",
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 5,
  },
  container: {
    flex: 1,
    backgroundColor: GarageTheme.background,
  },
  header: {
    padding: 18,
    borderBottomWidth: 1,
    borderBottomColor: GarageTheme.borderStrong,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: GarageTheme.accent,
    fontSize: 24,
    fontWeight: "700",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: GarageTheme.textStrong,
    letterSpacing: 1.4,
  },
  setNumber: {
    fontSize: 16,
    color: GarageTheme.textMuted,
  },
  statusCard: {
    margin: 16,
    padding: 14,
    backgroundColor: GarageTheme.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: GarageTheme.borderStrong,
    shadowColor: GarageTheme.accent,
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  hrBadge: {
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GarageTheme.panel,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 4,
  },
  hrValue: { fontSize: 16, fontWeight: "bold", color: GarageTheme.danger },
  hrUnit: { fontSize: 10, color: GarageTheme.textMuted },
  signalDot: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    marginLeft: 4,
  },
  signalLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#FFF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: GarageTheme.textStrong,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  exerciseCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: GarageTheme.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: GarageTheme.border,
    shadowColor: GarageTheme.textStrong,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  exerciseLabel: {
    fontSize: 10,
    color: GarageTheme.textSubtle,
    marginBottom: 10,
    letterSpacing: 1.8,
    fontWeight: "800",
  },
  exerciseSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: "bold",
    color: GarageTheme.textStrong,
  },
  exerciseCategory: {
    fontSize: 14,
    color: GarageTheme.textMuted,
    marginTop: 2,
  },
  trainingNotesCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    backgroundColor: GarageTheme.accentSoft + "15",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: GarageTheme.accentSoft + "40",
  },
  noteSection: {
    marginBottom: 8,
  },
  noteLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: GarageTheme.accentSoft,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  noteText: {
    fontSize: 13,
    color: GarageTheme.textStrong,
    lineHeight: 18,
  },
  sessionNoteCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    backgroundColor: GarageTheme.surfaceAlt,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: GarageTheme.border,
  },
  sessionNoteHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sessionNoteLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: GarageTheme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sessionNoteEditButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  sessionNoteEditText: {
    fontSize: 12,
    color: GarageTheme.accent,
    fontWeight: "600",
  },
  sessionNoteEditContainer: {
    gap: 8,
  },
  sessionNoteInput: {
    backgroundColor: GarageTheme.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: GarageTheme.textStrong,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    minHeight: 80,
  },
  sessionNoteSaveButton: {
    backgroundColor: GarageTheme.success,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  sessionNoteSaveButtonText: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: "bold",
  },
  sessionNoteText: {
    fontSize: 13,
    color: GarageTheme.textStrong,
    lineHeight: 18,
  },
  exerciseChange: {
    color: GarageTheme.accent,
    fontSize: 14,
    fontWeight: "bold",
  },
  exerciseSelectButton: {
    padding: 12,
    backgroundColor: GarageTheme.border,
    borderRadius: 8,
    alignItems: "center",
  },
  exerciseSelectButtonText: {
    color: GarageTheme.accent,
    fontSize: 16,
  },
  section: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: GarageTheme.textStrong,
    marginBottom: 12,
  },
  recentHistoryScroll: {
    marginTop: 8,
  },
  recentHistoryContent: {
    paddingRight: 16,
    gap: 12,
  },
  recentHistoryCard: {
    backgroundColor: GarageTheme.surface,
    borderRadius: 16,
    borderWidth: 2,
    padding: 14,
    minWidth: 140,
    shadowColor: GarageTheme.textStrong,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  recentHistoryDate: {
    fontSize: 12,
    color: GarageTheme.textMuted,
    fontWeight: "700",
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  recentHistoryStats: {
    gap: 8,
  },
  recentHistoryStat: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: GarageTheme.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  recentHistoryStatLabel: {
    fontSize: 10,
    color: GarageTheme.textSubtle,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  recentHistoryStatValue: {
    fontSize: 14,
    color: GarageTheme.textStrong,
    fontWeight: "800",
  },
  recentHistoryE1RM: {
    fontSize: 12,
    color: GarageTheme.accent,
    fontWeight: "800",
    marginTop: 10,
    letterSpacing: 0.3,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: GarageTheme.surfaceAlt,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 16,
    color: GarageTheme.textStrong,
  },
  loadControlContainer: {
    backgroundColor: GarageTheme.surfaceAlt,
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  loadControlLabel: {
    fontSize: 14,
    color: GarageTheme.textMuted,
    marginBottom: 12,
    textAlign: "center",
  },
  loadControlWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  loadAdjustRow: {
    flexDirection: "row",
    gap: 8,
  },
  adjustBtn: {
    backgroundColor: GarageTheme.border,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  adjustBtnText: {
    color: GarageTheme.textStrong,
    fontSize: 16,
    fontWeight: "bold",
  },
  loadDisplayValue: {
    minWidth: 80,
    alignItems: "center",
  },
  loadDisplayValueText: {
    color: GarageTheme.success,
    fontSize: 32,
    fontWeight: "bold",
  },
  loadInputRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadInput: {
    minWidth: 120,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    backgroundColor: GarageTheme.background,
    color: GarageTheme.textStrong,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
  },
  dataCard: {
    margin: 16,
    padding: 18,
    backgroundColor: GarageTheme.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: GarageTheme.success,
    minHeight: 120,
    justifyContent: "center",
    shadowColor: GarageTheme.success,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  dataTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: GarageTheme.success,
    marginBottom: 12,
    textAlign: "left",
    letterSpacing: 1.1,
  },
  dataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: GarageTheme.border,
    alignItems: "center",
  },
  dataLabel: {
    fontSize: 11,
    color: GarageTheme.textMuted,
    flex: 1,
    letterSpacing: 1.4,
    fontWeight: "700",
  },
  dataValue: {
    fontSize: 20,
    fontWeight: "800",
    color: GarageTheme.textStrong,
  },
  helpIcon: {
    fontSize: 12,
    color: GarageTheme.textSubtle,
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: GarageTheme.chip,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    textAlign: "center",
    minWidth: 18,
  },
  noDataText: {
    color: GarageTheme.textSubtle,
    textAlign: "center",
    fontSize: 13,
    letterSpacing: 1.2,
  },
  buttonContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 10,
  },
  button: {
    padding: 18,
    borderRadius: 14,
    alignItems: "center",
    shadowColor: GarageTheme.textStrong,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  recordButton: {
    backgroundColor: GarageTheme.success,
    borderWidth: 2,
    borderColor: GarageTheme.success + "60",
  },
  finishButton: {
    backgroundColor: GarageTheme.warning,
    borderWidth: 2,
    borderColor: GarageTheme.warning + "60",
  },
  buttonText: {
    color: GarageTheme.textStrong,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  warmupButton: {
    flex: 1,
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: GarageTheme.surfaceAlt,
    borderWidth: 2,
    borderColor: GarageTheme.borderStrong,
    marginRight: 10,
  },
  warmupButtonActive: {
    backgroundColor: GarageTheme.accentSoft,
    borderColor: GarageTheme.accentSoft,
    shadowColor: GarageTheme.accentSoft,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  warmupButtonText: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  setCard: {
    backgroundColor: GarageTheme.surfaceAlt,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: GarageTheme.border,
    shadowColor: GarageTheme.textStrong,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  setHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  setExerciseName: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    color: GarageTheme.textStrong,
    marginRight: 8,
    letterSpacing: 0.3,
  },
  setMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  setNumberText: {
    fontSize: 14,
    fontWeight: "800",
    color: GarageTheme.textMuted,
    letterSpacing: 0.6,
  },
  setLoad: {
    fontSize: 16,
    color: GarageTheme.accent,
    fontWeight: "700",
  },
  setRowDetail: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  setMetricChipText: {
    fontSize: 11,
    color: GarageTheme.textMuted,
    fontWeight: "700",
    letterSpacing: 0.3,
    backgroundColor: GarageTheme.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  setMiniChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    marginTop: 12,
    minHeight: 32,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: GarageTheme.border,
  },
  setMiniBar: {
    width: 12,
    borderRadius: 4,
    backgroundColor: GarageTheme.accent,
  },
  setMiniBarMuted: {
    opacity: 0.3,
    backgroundColor: GarageTheme.textSubtle,
  },
  setCardActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: GarageTheme.border,
  },
  setActionButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: GarageTheme.borderStrong,
    backgroundColor: GarageTheme.chip,
  },
  setActionButtonText: {
    color: GarageTheme.textStrong,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  setVelocity: {
    fontSize: 14,
    color: GarageTheme.success,
    fontWeight: "700",
  },
  setVelocityLoss: {
    fontSize: 13,
    color: GarageTheme.warning,
    fontWeight: "700",
  },
  // セッション開始/アクティブバナー
  sessionStartBanner: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 18,
    backgroundColor: GarageTheme.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: GarageTheme.accentSoft + "60",
    shadowColor: GarageTheme.accentSoft,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  startSessionButton: {
    backgroundColor: GarageTheme.accentSoft,
    width: "100%",
    shadowColor: GarageTheme.accentSoft,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sessionActiveBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    backgroundColor: GarageTheme.surface,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: GarageTheme.success + "40",
    shadowColor: GarageTheme.success,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  pauseBtn: {
    backgroundColor: GarageTheme.panel,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: GarageTheme.borderStrong,
    shadowColor: GarageTheme.textStrong,
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  pausedBtnActive: {
    backgroundColor: GarageTheme.warning,
    borderColor: GarageTheme.warning,
    shadowColor: GarageTheme.warning,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  pauseBtnContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pauseBtnIcon: {
    color: GarageTheme.textStrong,
    fontSize: 16,
    fontWeight: "700",
  },
  pauseBtnText: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  // レストバナー
  restBanner: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 18,
    backgroundColor: GarageTheme.surface,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: GarageTheme.info + "40",
    shadowColor: GarageTheme.info,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  restHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  restLabel: {
    fontSize: 13,
    color: GarageTheme.info,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  timerText: {
    fontSize: 32,
    fontWeight: "900",
    color: GarageTheme.textStrong,
    fontVariant: ["tabular-nums"],
    letterSpacing: 2,
  },
  timerHrBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: GarageTheme.danger + "15",
    borderWidth: 2,
    borderColor: GarageTheme.danger + "40",
  },
  timerHrLabel: {
    color: GarageTheme.danger,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  timerHrText: {
    color: GarageTheme.danger,
    fontSize: 18,
    fontWeight: "900",
  },
  readyBadge: {
    backgroundColor: GarageTheme.success,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: GarageTheme.success,
  },
  readyText: {
    color: GarageTheme.textStrong,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  startNextSetButton: {
    backgroundColor: GarageTheme.success,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
    shadowColor: GarageTheme.success,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  startNextSetText: {
    color: GarageTheme.textStrong,
    fontSize: 17,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  // 速度ゾーンバッジ
  zoneBadge: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 8,
    borderWidth: 2,
    marginBottom: 12,
    backgroundColor: GarageTheme.background,
    gap: 8,
  },
  zoneTag: {
    fontSize: 12,
    fontWeight: "800",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  zoneName: { fontSize: 16, fontWeight: "bold" },
  // AIコーチカード
  coachCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 18,
    backgroundColor: GarageTheme.surface,
    borderRadius: 16,
    borderWidth: 2,
    gap: 14,
    shadowColor: GarageTheme.textStrong,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  coachBadge: {
    minWidth: 64,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  coachBadgeText: { fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  coachContent: { flex: 1 },
  coachMessage: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
    lineHeight: 20,
  },
  coachAction: { fontSize: 13, color: GarageTheme.textMuted, lineHeight: 18 },
  // AIコーチボタン（ヘッダー）
  coachNavButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: GarageTheme.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GarageTheme.accent,
  },
  coachNavButtonText: {
    color: GarageTheme.accent,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  // Target Weight & Warmup UI
  targetWeightCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: GarageTheme.surfaceAlt,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: GarageTheme.border,
  },
  targetWeightLabel: {
    fontSize: 13,
    color: GarageTheme.accent,
    fontWeight: "bold",
    marginBottom: 10,
    letterSpacing: 0.8,
  },
  targetInputRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  targetInput: {
    flex: 1,
    backgroundColor: GarageTheme.background,
    borderRadius: 8,
    padding: 12,
    color: GarageTheme.textStrong,
    fontSize: 18,
    fontWeight: "bold",
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  unitText: { color: GarageTheme.textMuted, fontSize: 16 },
  warmupScroll: { marginTop: 4, paddingBottom: 8 },
  warmupStep: {
    backgroundColor: GarageTheme.surfaceAlt,
    borderRadius: 10,
    padding: 12,
    marginRight: 10,
    minWidth: 85,
    alignItems: "center",
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  warmupStepActive: {
    backgroundColor: GarageTheme.background,
    borderColor: GarageTheme.accent,
    borderWidth: 2,
  },
  warmupStepLabel: {
    fontSize: 10,
    color: GarageTheme.textMuted,
    marginBottom: 4,
  },
  warmupStepLabelActive: { color: GarageTheme.accent, fontWeight: "bold" },
  warmupWeight: {
    fontSize: 16,
    fontWeight: "bold",
    color: GarageTheme.textStrong,
  },
  warmupWeightActive: { color: GarageTheme.accent },
  warmupReps: { fontSize: 10, color: GarageTheme.textSubtle, marginTop: 2 },
  warmupRepsActive: { color: GarageTheme.textMuted },
  // VBT Intelligence & CNS Battery UI
  intelligenceRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  cnsBatteryContainer: {
    flex: 1,
    backgroundColor: GarageTheme.surfaceAlt,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  cnsLabel: {
    fontSize: 10,
    fontWeight: "bold",
    color: GarageTheme.textMuted,
    marginBottom: 6,
  },
  batteryGageBg: {
    width: "100%",
    height: 8,
    backgroundColor: GarageTheme.border,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 4,
  },
  batteryGageFill: {
    height: "100%",
    borderRadius: 4,
  },
  cnsValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: GarageTheme.textStrong,
  },
  intelligenceBadge: {
    width: 100,
    backgroundColor: GarageTheme.panel,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
  },
  intelligenceLabel: {
    fontSize: 9,
    fontWeight: "bold",
    color: GarageTheme.accentSoft,
    marginBottom: 4,
    textAlign: "center",
  },
  intelligenceValue: {
    fontSize: 16,
    fontWeight: "bold",
    color: GarageTheme.textStrong,
  },
  unitSmall: {
    fontSize: 10,
    color: GarageTheme.textMuted,
  },
  confidenceIndicator: {
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 9,
    color: GarageTheme.textStrong,
    fontWeight: "bold",
  },
  // Adaptive Load Suggestion
  optimizeMvtButton: {
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GarageTheme.accentSoft,
    backgroundColor: GarageTheme.surface,
    alignItems: "center",
  },
  optimizeMvtButtonText: {
    color: GarageTheme.accentSoft,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  suggestionBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    backgroundColor: GarageTheme.panel,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: GarageTheme.accent,
  },
  suggestionContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  suggestionEmoji: { fontSize: 18 },
  suggestionText: { color: GarageTheme.textStrong, fontSize: 14 },
  suggestionWeight: { fontWeight: "bold", color: GarageTheme.accentSoft },
  applyText: {
    color: GarageTheme.accent,
    fontSize: 12,
    fontWeight: "bold",
    letterSpacing: 0.6,
  },
  setHR: {
    fontSize: 13,
    color: GarageTheme.danger,
    marginTop: 2,
    fontWeight: "bold",
  },
  setZoneTag: {
    fontSize: 11,
    fontWeight: "800",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: "hidden",
  },
  // Premium dashboard control styles
  sessionStartBannerContent: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  sessionStartBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: GarageTheme.accentSoft + "20",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: GarageTheme.accentSoft,
  },
  sessionStartBadgeIcon: {
    fontSize: 20,
  },
  sessionStartTextContainer: {
    flex: 1,
  },
  sessionStartTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: GarageTheme.textStrong,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sessionStartSubtitle: {
    fontSize: 13,
    fontWeight: "600",
    color: GarageTheme.success,
    letterSpacing: 0.3,
  },
  sessionActiveBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  sessionActiveIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: GarageTheme.success + "30",
    borderWidth: 2,
    borderColor: GarageTheme.success,
    alignItems: "center",
    justifyContent: "center",
  },
  sessionActiveIndicatorPaused: {
    backgroundColor: GarageTheme.warning + "30",
    borderColor: GarageTheme.warning,
  },
  sessionActiveIndicatorDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: GarageTheme.success,
  },
  sessionActiveIndicatorDotPaused: {
    backgroundColor: GarageTheme.warning,
  },
  sessionActiveTextContainer: {
    flex: 1,
  },
  sessionActiveTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: GarageTheme.textStrong,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  sessionActiveSubtitle: {
    fontSize: 11,
    fontWeight: "700",
    color: GarageTheme.textMuted,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  // VL設定カード
  vlSettingsCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 14,
    backgroundColor: GarageTheme.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: GarageTheme.border,
  },
  vlSettingsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  vlSettingsTitle: {
    fontSize: 12,
    fontWeight: "bold",
    color: GarageTheme.textMuted,
    letterSpacing: 0.6,
  },
  vlToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  vlToggleLabel: {
    fontSize: 13,
    color: GarageTheme.textStrong,
    fontWeight: "600",
  },
  vlToggleButton: {
    width: 48,
    height: 26,
    borderRadius: 13,
    backgroundColor: GarageTheme.border,
    padding: 2,
  },
  vlToggleButtonOn: {
    backgroundColor: GarageTheme.accent,
  },
  vlToggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: GarageTheme.textStrong,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  vlToggleKnobOn: {
    alignSelf: "flex-end",
    backgroundColor: GarageTheme.background,
  },
  vlThresholdButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  vlThresholdButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: GarageTheme.background,
    borderWidth: 1,
    borderColor: GarageTheme.border,
  },
  vlThresholdButtonSelected: {
    backgroundColor: GarageTheme.accent + "20",
    borderColor: GarageTheme.accent,
  },
  vlThresholdButtonText: {
    fontSize: 12,
    color: GarageTheme.textMuted,
    fontWeight: "700",
  },
  vlThresholdButtonTextSelected: {
    color: GarageTheme.accent,
  },
});
