/**
 * Manual Entry Screen
 * For logging workouts without VBT sensor
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DatabaseService from "../services/DatabaseService";
import ExerciseService from "../services/ExerciseService";
import HealthService from "../services/HealthService";
import { loadAppSettings } from "../services/AppSettingsService";
import VBTCalculations from "../utils/VBTCalculations";
import DeterministicVBTCoach from "../services/DeterministicVBTCoach";
import { ExerciseSelectModal } from "../components/ExerciseSelectModal";
import {
  getExerciseCategoryLabel,
  isBig3Exercise,
} from "../constants/exerciseCatalog";
import { GarageTheme } from "../constants/garageTheme";
import { SetData, RepData, SetType, Exercise } from "../types/index";
import { createSessionId, formatSessionLabel } from "../utils/session";
import { buildManualSessionCompletionPayload } from "../utils/ManualSessionFinalization";
import {
  getBlockWeekPlan,
  getPhaseForBlockWeek,
  getPowerliftingProtocol,
  getTopSingleTargetText,
} from "../utils/PowerliftingVBTProtocol";
import {
  buildAccessoryRMTargetContext,
  formatAccessoryTargetLoad,
  resolveSetE1RMForPersistence,
} from "../utils/AccessoryRMTarget";
import {
  loadManualEntryFavoritePresets,
  registerManualEntryFavoritePreset,
  removeManualEntryFavoritePreset,
  touchManualEntryFavoritePreset,
  type ManualEntryFavoritePreset,
} from "../utils/ManualEntryFavorites";
import {
  formatLoadKgTwoDecimals,
  normalizeLoadKg,
  parseLoadKgInput,
} from "../utils/LoadPrecision";
import { getManualEntryHistoryPreview } from "../utils/ManualEntryHistory";

interface ManualEntryScreenProps {
  navigation: any;
}

type SupersetSlot = "active" | "A" | "B";

const CHATGPT_APP_URL = "chatgpt://";
const CHATGPT_WEB_URL = "https://chatgpt.com/";

const openChatGPT = async (): Promise<"app" | "web" | "none"> => {
  try {
    const canOpenApp = await Linking.canOpenURL(CHATGPT_APP_URL);
    if (canOpenApp) {
      await Linking.openURL(CHATGPT_APP_URL);
      return "app";
    }
    await Linking.openURL(CHATGPT_WEB_URL);
    return "web";
  } catch {
    return "none";
  }
};

const formatNumber = (
  value: number | null | undefined,
  digits = 1,
  suffix = "",
): string => {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${value.toFixed(digits)}${suffix}`;
};

const formatRelativeTime = (timestamp?: string | null): string => {
  if (!timestamp) return "前回日時なし";

  const diffMs = Date.now() - new Date(timestamp).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return "前回日時なし";

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 60) return `${Math.max(minutes, 1)}分前`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}時間前`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}日前`;

  const months = Math.floor(days / 30);
  return `${months}ヶ月前`;
};

const formatElapsedTime = (seconds: number): string => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const restSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${restSeconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes}:${restSeconds.toString().padStart(2, "0")}`;
};

const shouldStartManualHeartRateMonitoring = (authorized: boolean): boolean =>
  authorized;

const ManualEntryScreen: React.FC<ManualEntryScreenProps> = ({
  navigation,
}) => {
  const insets = useSafeAreaInsets();
  const [sessionId] = useState(() => createSessionId());
  const [lift, setLift] = useState("Bench Press");
  const [setIndex, setSetIndex] = useState(1);
  const [loadKg, setLoadKg] = useState("");
  const [reps, setReps] = useState("");
  const [rpe, setRpe] = useState("");
  const [avgVelocity, setAvgVelocity] = useState("");
  const [velocityLoss, setVelocityLoss] = useState("");
  const [romCm, setRomCm] = useState("");
  const [setType, setSetType] = useState<SetType>("normal");
  const [notes, setNotes] = useState("");
  const [savedSets, setSavedSets] = useState<SetData[]>([]);
  const [recentLiftSets, setRecentLiftSets] = useState<SetData[]>([]);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(
    null,
  );
  const [supersetExerciseA, setSupersetExerciseA] = useState<Exercise | null>(
    null,
  );
  const [supersetExerciseB, setSupersetExerciseB] = useState<Exercise | null>(
    null,
  );
  const [exerciseSelectSlot, setExerciseSelectSlot] =
    useState<SupersetSlot>("active");
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [blockWeek, setBlockWeek] = useState(5);
  const [manualStartedAt] = useState(() => Date.now());
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [currentHeartRate, setCurrentHeartRate] = useState<number | null>(null);
  const [heartRateStatus, setHeartRateStatus] = useState<
    "checking" | "active" | "unavailable"
  >("checking");
  const [showSavedSetsSheet, setShowSavedSetsSheet] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [favoritePresets, setFavoritePresets] = useState<
    ManualEntryFavoritePreset[]
  >([]);

  const primarySetTypes: { value: SetType; label: string }[] = [
    { value: "normal", label: "通常" },
    { value: "top_single", label: "トップS" },
    { value: "backoff", label: "バックオフ" },
    { value: "amrap", label: "AMRAP" },
  ];
  const advancedSetTypes: { value: SetType; label: string }[] = [
    { value: "drop", label: "ドロップ" },
    { value: "superset_A", label: "スーパーA" },
    { value: "superset_B", label: "スーパーB" },
  ];
  const setTypes = [...primarySetTypes, ...advancedSetTypes];

  const parsedLoadKg = loadKg ? parseLoadKgInput(loadKg) : null;
  const parsedReps = reps ? parseInt(reps, 10) : null;
  const parsedAvgVelocity = avgVelocity ? parseFloat(avgVelocity) : null;
  const parsedVelocityLoss = velocityLoss ? parseFloat(velocityLoss) : null;
  const parsedRomCm = romCm ? parseFloat(romCm) : null;
  const manualElapsedSeconds = Math.floor((nowMs - manualStartedAt) / 1000);
  const restElapsedSeconds =
    lastSavedAt == null ? null : Math.floor((nowMs - lastSavedAt) / 1000);
  const hasValidManualVbtMetrics =
    (parsedAvgVelocity == null ||
      (!isNaN(parsedAvgVelocity) &&
        parsedAvgVelocity > 0 &&
        parsedAvgVelocity <= 3)) &&
    (parsedVelocityLoss == null ||
      (!isNaN(parsedVelocityLoss) &&
        parsedVelocityLoss >= 0 &&
        parsedVelocityLoss <= 80)) &&
    (parsedRomCm == null ||
      (!isNaN(parsedRomCm) && parsedRomCm > 0 && parsedRomCm <= 200));
  const isSuperset = setType === "superset_A" || setType === "superset_B";
  const allowsZeroLoad =
    lift === "Chinning" ||
    lift === "Dips" ||
    selectedExercise?.name === "Chinning" ||
    selectedExercise?.name === "Dips";
  const manualPhase = useMemo(
    () => getPhaseForBlockWeek(blockWeek),
    [blockWeek],
  );
  const manualProtocol = useMemo(
    () => getPowerliftingProtocol(selectedExercise?.category, manualPhase),
    [manualPhase, selectedExercise?.category],
  );
  const blockWeekPlan = useMemo(
    () => getBlockWeekPlan(blockWeek, selectedExercise?.category),
    [blockWeek, selectedExercise?.category],
  );
  const topSingleTargetText = useMemo(
    () => getTopSingleTargetText(selectedExercise?.mvt, manualProtocol),
    [manualProtocol, selectedExercise?.mvt],
  );
  const setTypeGuidance = useMemo(() => {
    if (setType === "top_single") {
      return {
        title: "トップシングル",
        body: `当日の状態確認用の1回。目安は ${topSingleTargetText}。失敗試技は作らず、フォーム優先で止めます。`,
      };
    }

    if (setType === "backoff") {
      return {
        title: "バックオフ",
        body: `この種目の目安はVL ${manualProtocol.backoffVelocityLoss.min}〜${manualProtocol.backoffVelocityLoss.max}%まで。手動日はRPEとメモで失速感を残します。`,
      };
    }

    if (isSuperset) {
      return {
        title: "スーパーセット",
        body: "A/Bを交互に保存します。セット番号はB保存後に進むので、同じラウンドとして追えます。",
      };
    }

    return {
      title: manualProtocol.phaseLabel,
      body: manualProtocol.guidance,
    };
  }, [isSuperset, manualProtocol, setType, topSingleTargetText]);
  const draftSet = useMemo<SetData | null>(() => {
    if (parsedLoadKg == null || !parsedReps) return null;
    const rpeValue = rpe ? parseFloat(rpe) : undefined;

    return {
      session_id: sessionId,
      lift,
      set_index: setIndex,
      load_kg: parsedLoadKg,
      reps: parsedReps,
      device_type: "manual",
      set_type: setType,
      avg_velocity: parsedAvgVelocity,
      velocity_loss: parsedVelocityLoss,
      velocity_loss_avg: parsedVelocityLoss,
      velocity_loss_last: parsedVelocityLoss,
      velocity_loss_min: parsedVelocityLoss,
      avg_rom_cm: parsedRomCm,
      rpe: rpeValue,
      e1rm: VBTCalculations.estimate1RMFromReps(
        parsedLoadKg,
        parsedReps,
        rpeValue,
      ),
      timestamp: new Date().toISOString(),
      rest_duration_s: restElapsedSeconds ?? undefined,
      notes: notes || undefined,
    };
  }, [
    lift,
    notes,
    parsedAvgVelocity,
    parsedLoadKg,
    parsedReps,
    parsedRomCm,
    parsedVelocityLoss,
    rpe,
    restElapsedSeconds,
    sessionId,
    setIndex,
    setType,
  ]);
  const manualCoachDecision = useMemo(() => {
    if (!draftSet || parsedAvgVelocity == null || !hasValidManualVbtMetrics) {
      return null;
    }

    return DeterministicVBTCoach.evaluate({
      setHistory: [...savedSets.filter((set) => set.lift === lift), draftSet],
      exercise: selectedExercise,
      phase: manualPhase,
    });
  }, [
    draftSet,
    hasValidManualVbtMetrics,
    lift,
    manualPhase,
    parsedAvgVelocity,
    savedSets,
    selectedExercise,
  ]);

  const latestManualConsultationSet =
    draftSet ?? savedSets[savedSets.length - 1] ?? null;
  const accessoryRMTarget = useMemo(
    () =>
      buildAccessoryRMTargetContext({
        lift,
        currentLoadKg: latestManualConsultationSet?.load_kg ?? parsedLoadKg,
        currentReps: latestManualConsultationSet?.reps ?? parsedReps,
        currentE1RMKg: latestManualConsultationSet?.e1rm ?? null,
        exercise: selectedExercise,
        historySets: [...savedSets, ...recentLiftSets],
        currentSet: latestManualConsultationSet,
      }),
    [
      latestManualConsultationSet,
      lift,
      parsedLoadKg,
      parsedReps,
      recentLiftSets,
      savedSets,
      selectedExercise,
    ],
  );

  const handleCopyManualSupervisorPacket = async () => {
    if (!latestManualConsultationSet) {
      Alert.alert(
        "相談データなし",
        "負荷とレップ数を入力するか、先に1セット保存してください。",
      );
      return;
    }

    const sameLiftHistory = [
      ...savedSets.filter(
        (set) => set.lift === latestManualConsultationSet.lift,
      ),
      ...recentLiftSets.filter(
        (set) => set.lift === latestManualConsultationSet.lift,
      ),
    ]
      .slice()
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, 5);
    const currentSetSource = draftSet ? "入力中ドラフト" : "保存済み最新セット";
    const sessionContextSets = [...savedSets, ...(draftSet ? [draftSet] : [])]
      .slice()
      .sort((a, b) => {
        if (a.set_index !== b.set_index) return a.set_index - b.set_index;
        return (
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
      })
      .slice(-12);
    const sessionContextRows =
      sessionContextSets
        .map(
          (set) =>
            `| ${set.set_index} | ${set.lift} | ${getSetTypeLabel(set.set_type)} | ${formatNumber(set.load_kg, 2)} | ${set.reps} | ${formatNumber(set.rpe, 1)} | ${formatNumber(set.avg_velocity, 2)} | ${formatNumber(set.velocity_loss_last ?? set.velocity_loss, 1, "%")} | ${formatNumber(set.avg_rom_cm, 1, "cm")} | ${formatNumber(set.rest_duration_s, 0, "s")} | ${formatNumber(set.avg_hr, 0, "bpm")} | ${set.notes ?? ""} |`,
        )
        .join("\n") || "| - | - | - | - | - | - | - | - | - | - | - | - |";
    const supersetRounds = sessionContextSets.reduce<
      Record<
        string,
        { lift: string; type: SetType; load: number; reps: number }[]
      >
    >((acc, set) => {
      if (set.set_type !== "superset_A" && set.set_type !== "superset_B") {
        return acc;
      }
      const key = `${set.set_index}`;
      acc[key] = acc[key] ?? [];
      acc[key].push({
        lift: set.lift,
        type: set.set_type,
        load: set.load_kg,
        reps: set.reps,
      });
      return acc;
    }, {});
    const packetAccessoryRMTarget = buildAccessoryRMTargetContext({
      lift: latestManualConsultationSet.lift,
      currentLoadKg: latestManualConsultationSet.load_kg,
      currentReps: latestManualConsultationSet.reps,
      currentE1RMKg: latestManualConsultationSet.e1rm ?? null,
      exercise: selectedExercise,
      historySets: sameLiftHistory,
      currentSet: latestManualConsultationSet,
    });
    const accessoryTargetRows = packetAccessoryRMTarget.enabled
      ? packetAccessoryRMTarget.conversionTable
          .map(
            (row) =>
              `| ${row.reps} | ${formatAccessoryTargetLoad(row.targetLoadKg)} | ${formatNumber(row.targetE1RMKg, 1, "kg")} | ${formatNumber(row.currentLoadE1RMKg, 1, "kg")} | ${row.currentLoadHitsTarget == null ? "-" : row.currentLoadHitsTarget ? "yes" : "no"} |`,
          )
          .join("\n")
      : "";
    const historyRows =
      sameLiftHistory
        .map(
          (set) =>
            `| ${new Date(set.timestamp).toLocaleString("ja-JP")} | ${formatLoadKgTwoDecimals(set.load_kg)} | ${set.reps} | ${formatNumber(set.avg_velocity, 2)} | ${formatNumber(set.velocity_loss_last ?? set.velocity_loss, 1, "%")} | ${formatNumber(set.avg_rom_cm, 1, "cm")} | ${formatNumber(set.rpe, 1)} |`,
        )
        .join("\n") || "| - | - | - | - | - | - | - |";
    const packetJson = {
      packet_version: "manual_supervisor_v4_accessory_rm",
      source: "RepVeloCoach manual entry",
      generated_at: new Date().toISOString(),
      session_id: sessionId,
      source_state: currentSetSource,
      exercise: {
        name: latestManualConsultationSet.lift,
        category: selectedExercise?.category ?? null,
        category_label: selectedExercise
          ? getExerciseCategoryLabel(selectedExercise.category)
          : null,
        set_type: latestManualConsultationSet.set_type,
      },
      current_set: {
        set_index: latestManualConsultationSet.set_index,
        load_kg: latestManualConsultationSet.load_kg,
        reps: latestManualConsultationSet.reps,
        rpe: latestManualConsultationSet.rpe ?? null,
        avg_velocity: latestManualConsultationSet.avg_velocity,
        vl_avg:
          latestManualConsultationSet.velocity_loss_avg ??
          latestManualConsultationSet.velocity_loss,
        vl_last: latestManualConsultationSet.velocity_loss_last ?? null,
        vl_min: latestManualConsultationSet.velocity_loss_min ?? null,
        rom_cm: latestManualConsultationSet.avg_rom_cm ?? null,
        e1rm: latestManualConsultationSet.e1rm ?? null,
        notes: latestManualConsultationSet.notes ?? (notes || null),
      },
      today_summary: sessionSummary,
      manual_timing: {
        elapsed_s: manualElapsedSeconds,
        rest_elapsed_s: restElapsedSeconds,
        current_heart_rate: currentHeartRate,
        heart_rate_status: heartRateStatus,
      },
      session_context_sets: sessionContextSets.map((set) => ({
        set_index: set.set_index,
        lift: set.lift,
        set_type: set.set_type,
        load_kg: set.load_kg,
        reps: set.reps,
        rpe: set.rpe ?? null,
        avg_velocity: set.avg_velocity ?? null,
        vl_last: set.velocity_loss_last ?? set.velocity_loss ?? null,
        rom_cm: set.avg_rom_cm ?? null,
        e1rm: set.e1rm ?? null,
        rest_duration_s: set.rest_duration_s ?? null,
        avg_hr: set.avg_hr ?? null,
        notes: set.notes ?? null,
      })),
      superset_rounds: supersetRounds,
      deterministic_preview: manualCoachDecision
        ? {
            action: manualCoachDecision.action,
            message: manualCoachDecision.message,
            suggestedAction: manualCoachDecision.suggestedAction ?? null,
          }
        : null,
      accessory_rm_target: packetAccessoryRMTarget,
      recent_same_lift_sets: sameLiftHistory.map((set) => ({
        timestamp: set.timestamp,
        load_kg: set.load_kg,
        reps: set.reps,
        avg_velocity: set.avg_velocity,
        vl_last: set.velocity_loss_last ?? set.velocity_loss ?? null,
        rom_cm: set.avg_rom_cm ?? null,
        rpe: set.rpe ?? null,
        e1rm: set.e1rm ?? null,
      })),
    };

    const packet = [
      "# チャッピーコーチ 手動入力相談パケット",
      `出力日時: ${new Date().toLocaleString("ja-JP")}`,
      `状態: ${currentSetSource}`,
      `種目: ${latestManualConsultationSet.lift}`,
      `カテゴリ: ${
        selectedExercise
          ? getExerciseCategoryLabel(selectedExercise.category)
          : "-"
      }`,
      `セット: ${latestManualConsultationSet.set_index}`,
      `負荷/回数: ${formatNumber(latestManualConsultationSet.load_kg, 2, "kg")} x ${latestManualConsultationSet.reps}`,
      `RPE: ${formatNumber(latestManualConsultationSet.rpe, 1)}`,
      `AV: ${formatNumber(latestManualConsultationSet.avg_velocity, 2, "m/s")}`,
      `VL avg/last/min: ${formatNumber(latestManualConsultationSet.velocity_loss_avg ?? latestManualConsultationSet.velocity_loss, 1, "%")} / ${formatNumber(latestManualConsultationSet.velocity_loss_last, 1, "%")} / ${formatNumber(latestManualConsultationSet.velocity_loss_min, 1, "%")}`,
      `ROM: ${formatNumber(latestManualConsultationSet.avg_rom_cm, 1, "cm")}`,
      `e1RM: ${formatNumber(latestManualConsultationSet.e1rm, 1, "kg")}`,
      `手動入力タイマー: 経過 ${formatElapsedTime(manualElapsedSeconds)} / レスト ${restElapsedSeconds == null ? "-" : formatElapsedTime(restElapsedSeconds)} / 心拍 ${currentHeartRate ?? "-"} bpm`,
      packetAccessoryRMTarget.enabled
        ? `補助RM目標: 5〜15rep / 目標e1RM ${formatNumber(packetAccessoryRMTarget.targetE1RMKg, 1, "kg")} / ${packetAccessoryRMTarget.targetSource === "previous_best" ? "過去Best更新狙い" : "初回基準作成"}`
        : "補助RM目標: 対象外",
      manualCoachDecision
        ? `アプリ暫定判定: ${manualCoachDecision.action} / ${manualCoachDecision.message}`
        : "アプリ暫定判定: 速度未入力または判定なし",
      "",
      "## 今回セッション文脈（複数セット/スーパーセット用）",
      "| set | lift | type | load | reps | RPE | AV | VL_last | ROM | rest | HR | notes |",
      "|---:|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|",
      sessionContextRows,
      "",
      "## 直近同種目履歴",
      "| time | load | reps | AV | VL_last | ROM | RPE |",
      "|---|---:|---:|---:|---:|---:|---:|",
      historyRows,
      "",
      "## 補助種目 5〜15rep換算表",
      "| reps | 目標重量 | 目標e1RM | 現在重量ならe1RM | 現在重量で達成 |",
      "|---:|---:|---:|---:|---|",
      accessoryTargetRows || "| - | - | - | - | - |",
      "",
      "## 相談したいこと",
      "この手動入力データだけを根拠に、次セットの重量・回数・休憩・継続可否を実用的に判断してください。速度が未入力の場合はRPE/履歴/メモを中心に、断定しすぎず条件つきで提案してください。",
      "",
      "```json",
      JSON.stringify(packetJson, null, 2),
      "```",
    ].join("\n");

    await Clipboard.setStringAsync(packet);
    const openResult = await openChatGPT();
    Alert.alert(
      openResult === "none"
        ? "コピーしました"
        : "コピーしてChatGPTを開きました",
      openResult === "none"
        ? "チャッピーコーチ用パケットをコピーしました。"
        : "ChatGPTへ貼り付けて相談してください。",
    );
  };

  // 種目別プリセット重量
  const exercisePresets: Record<string, number[]> = {
    "Bench Press": [40, 60, 80, 100, 120, 140],
    Squat: [60, 80, 100, 120, 140, 160, 180, 200],
    Deadlift: [60, 80, 100, 120, 140, 160, 180, 200, 220],
    "Shoulder Press": [20, 30, 40, 50, 60, 70, 80],
    "Barbell Row": [40, 50, 60, 70, 80, 90, 100],
    Chinning: [0, 5, 10, 15, 20, 25, 30],
    Dips: [0, 10, 20, 30, 40],
  };

  const currentPresets =
    exercisePresets[lift] || exercisePresets["Bench Press"];

  const formatLoadInputValue = (value: number): string =>
    formatLoadKgTwoDecimals(value);

  const formatFavoritePresetLabel = (
    preset: ManualEntryFavoritePreset,
  ): string =>
    `${preset.exerciseName} ${formatLoadInputValue(preset.loadKg)}kg${
      preset.reps ? ` ×${preset.reps}` : ""
    }`;

  // 重量調整関数
  const adjustLoad = (amount: number) => {
    const current = parsedLoadKg || 0;
    const newLoad = normalizeLoadKg(Math.max(0, current + amount));
    setLoadKg(formatLoadInputValue(newLoad));
  };

  // プリセット選択
  const selectPreset = (weight: number) => {
    setLoadKg(formatLoadInputValue(weight));
  };

  // 直近の同種目の重量をQuick選択
  const selectRecentWeight = (weight: number) => {
    setLoadKg(formatLoadInputValue(weight));
  };

  const applyActiveExercise = (exercise: Exercise) => {
    setLift(exercise.name);
    setSelectedExercise(exercise);
  };

  const applyExerciseName = async (exerciseName: string) => {
    if (selectedExercise?.name === exerciseName) return;
    const exercises = await ExerciseService.getAllExercises().catch(() => []);
    const match =
      exercises.find((exercise) => exercise.name === exerciseName) ?? null;

    if (match) {
      applyActiveExercise(match);
      if (!supersetExerciseA) setSupersetExerciseA(match);
      return;
    }

    setLift(exerciseName);
    setSelectedExercise(null);
  };

  const openExerciseSelector = (slot: SupersetSlot) => {
    setExerciseSelectSlot(slot);
    setShowExerciseModal(true);
  };

  const handleSetTypeChange = (nextType: SetType) => {
    setSetType(nextType);

    if (nextType === "superset_A") {
      const nextExercise = supersetExerciseA ?? selectedExercise;
      if (nextExercise) {
        setSupersetExerciseA(nextExercise);
        applyActiveExercise(nextExercise);
      }
      return;
    }

    if (nextType === "superset_B") {
      const nextExercise = supersetExerciseB ?? selectedExercise;
      if (nextExercise) {
        setSupersetExerciseB(nextExercise);
        applyActiveExercise(nextExercise);
      }
      if (!supersetExerciseB) {
        openExerciseSelector("B");
      }
      return;
    }

    if (selectedExercise) {
      applyActiveExercise(selectedExercise);
    }
  };

  const handleExerciseSelected = (exercise: Exercise) => {
    if (exerciseSelectSlot === "A") {
      setSupersetExerciseA(exercise);
      if (setType === "superset_A") applyActiveExercise(exercise);
    } else if (exerciseSelectSlot === "B") {
      setSupersetExerciseB(exercise);
      if (setType === "superset_B") applyActiveExercise(exercise);
    } else {
      applyActiveExercise(exercise);
      if (!supersetExerciseA) setSupersetExerciseA(exercise);
    }

    setShowExerciseModal(false);
  };

  const getSetTypeLabel = (type: SetType) =>
    setTypes.find((item) => item.value === type)?.label ?? type;

  const sessionSummary = useMemo(() => {
    const totalVolume = savedSets.reduce(
      (sum, set) => sum + set.load_kg * set.reps,
      0,
    );
    const totalReps = savedSets.reduce((sum, set) => sum + set.reps, 0);
    return {
      savedSetCount: savedSets.length,
      totalVolume,
      totalReps,
      liftNames: Array.from(new Set(savedSets.map((set) => set.lift))),
    };
  }, [savedSets]);

  const recentSetsForDisplay = useMemo(() => {
    const currentSessionSets = savedSets
      .filter((set) => set.lift === lift)
      .slice()
      .sort((a, b) => {
        const timeDiff =
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        if (timeDiff !== 0) return timeDiff;
        return b.set_index - a.set_index;
      });

    const merged = [...currentSessionSets];
    const seenKeys = new Set(
      currentSessionSets.map(
        (set) => `${set.session_id}_${set.lift}_${set.set_index}`,
      ),
    );

    for (const set of recentLiftSets) {
      const key = `${set.session_id}_${set.lift}_${set.set_index}`;
      if (!seenKeys.has(key)) {
        merged.push(set);
      }
    }

    return merged;
  }, [lift, recentLiftSets, savedSets]);

  const manualHistoryPreview = useMemo(
    () => getManualEntryHistoryPreview(savedSets),
    [savedSets],
  );

  const favoritePresetsForDisplay = useMemo(() => {
    const sameLift = favoritePresets.filter(
      (preset) => preset.exerciseName === lift,
    );
    const otherLift = favoritePresets.filter(
      (preset) => preset.exerciseName !== lift,
    );
    return [...sameLift, ...otherLift].slice(0, 12);
  }, [favoritePresets, lift]);

  const loadRecentLiftSets = async () => {
    try {
      const sets = await DatabaseService.getRecentSetsForLift(
        lift,
        30,
        sessionId,
      );
      setRecentLiftSets(sets);
    } catch {
      setRecentLiftSets([]);
    }
  };

  useEffect(() => {
    void loadRecentLiftSets();
    // Recent-set lookup should refresh only for the current lift/session keys.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lift, sessionId]);

  useEffect(() => {
    let cancelled = false;

    const loadFavorites = async () => {
      const presets = await loadManualEntryFavoritePresets().catch(() => []);
      if (!cancelled) setFavoritePresets(presets);
    };

    void loadFavorites();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      const settings = await loadAppSettings();
      if (cancelled) return;
      setBlockWeek(settings.powerlifting_block_week);
    };

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!saveStatus) return;

    const timeout = setTimeout(() => setSaveStatus(null), 2500);
    return () => clearTimeout(timeout);
  }, [saveStatus]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let hrTimerId: any = null;

    const startHeartRate = async () => {
      const authorized = await HealthService.authorize().catch(() => false);
      if (cancelled) return;

      if (!shouldStartManualHeartRateMonitoring(authorized)) {
        setHeartRateStatus("unavailable");
        setCurrentHeartRate(null);
        return;
      }

      hrTimerId = HealthService.startHeartRateMonitoring((bpm) => {
        if (cancelled) return;
        setCurrentHeartRate(bpm);
        setHeartRateStatus(bpm == null ? "unavailable" : "active");
      });
    };

    void startHeartRate();

    return () => {
      cancelled = true;
      if (hrTimerId) {
        HealthService.stopHeartRateMonitoring(hrTimerId);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadDefaultExercise = async () => {
      const exercises = await ExerciseService.getAllExercises();
      const match =
        exercises.find((exercise) => exercise.name === lift) ??
        exercises[0] ??
        null;
      if (!cancelled && match) {
        setLift(match.name);
        setSelectedExercise(match);
        setSupersetExerciseA(match);
      }
    };

    void loadDefaultExercise();

    return () => {
      cancelled = true;
    };
    // Default exercise bootstrap is intentionally run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleApplyRecentSet = (set: SetData) => {
    setLoadKg(formatLoadInputValue(set.load_kg));
    setReps(set.reps.toString());
    if (set.rpe != null) setRpe(set.rpe.toString());
    if (set.avg_velocity != null) setAvgVelocity(set.avg_velocity.toFixed(2));
    if (set.velocity_loss != null)
      setVelocityLoss(set.velocity_loss.toFixed(1));
    if (set.avg_rom_cm != null) setRomCm(set.avg_rom_cm.toFixed(1));
    setSaveStatus(
      `${formatRelativeTime(set.timestamp)} の ${formatLoadKgTwoDecimals(set.load_kg)}kg × ${set.reps} を反映`,
    );
  };

  const handleRegisterFavoritePreset = async () => {
    const loadValue = parsedLoadKg ?? NaN;
    const repsValue = parsedReps ?? null;

    if (!lift || isNaN(loadValue) || loadValue < 0) {
      Alert.alert(
        "お気に入り登録",
        "種目と0kg以上の重量を入力してから登録してください。",
      );
      return;
    }

    const next = await registerManualEntryFavoritePreset(favoritePresets, {
      exerciseName: lift,
      loadKg: loadValue,
      reps:
        repsValue != null && !isNaN(repsValue) && repsValue > 0
          ? repsValue
          : null,
      setType,
    });
    setFavoritePresets(next);
    setSaveStatus(
      `${lift} ${formatLoadInputValue(loadValue)}kg${
        repsValue ? ` ×${repsValue}` : ""
      } をお気に入り登録`,
    );
  };

  const handleApplyFavoritePreset = async (
    preset: ManualEntryFavoritePreset,
  ) => {
    await applyExerciseName(preset.exerciseName);
    setLoadKg(formatLoadInputValue(preset.loadKg));
    if (preset.reps) setReps(preset.reps.toString());
    setSetType(preset.setType);
    const next = await touchManualEntryFavoritePreset(
      favoritePresets,
      preset.id,
    );
    setFavoritePresets(next);
    setSaveStatus(`${formatFavoritePresetLabel(preset)} を反映`);
  };

  const handleRemoveFavoritePreset = (preset: ManualEntryFavoritePreset) => {
    Alert.alert(
      "お気に入りを削除",
      `${formatFavoritePresetLabel(preset)} を削除しますか？`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除",
          style: "destructive",
          onPress: () => {
            void removeManualEntryFavoritePreset(
              favoritePresets,
              preset.id,
            ).then(setFavoritePresets);
          },
        },
      ],
    );
  };

  const handleSaveSet = async () => {
    const loadValue = parsedLoadKg ?? NaN;
    const repsValue = parsedReps ?? NaN;
    const rpeValue = rpe ? parseFloat(rpe) : undefined;
    setSaveStatus(null);

    if (!loadKg || !reps) {
      Alert.alert("エラー", "負荷とレップ数を入力してください");
      return;
    }

    if (
      isNaN(loadValue) ||
      loadValue < 0 ||
      (loadValue === 0 && !allowsZeroLoad)
    ) {
      Alert.alert(
        "エラー",
        allowsZeroLoad
          ? "有効な負荷を入力してください"
          : "有効な負荷を入力してください。自重チンニング/ディップスは0kgで保存できます。",
      );
      return;
    }

    if (isNaN(repsValue) || repsValue <= 0) {
      Alert.alert("エラー", "有効なレップ数を入力してください");
      return;
    }

    if (setType === "top_single" && repsValue !== 1) {
      Alert.alert(
        "トップシングルの確認",
        "トップシングルは当日の状態を見る1回として保存してください。",
      );
      return;
    }

    if (rpeValue && (rpeValue < 1 || rpeValue > 10)) {
      Alert.alert("エラー", "RPEは1-10の範囲で入力してください");
      return;
    }

    if (
      parsedAvgVelocity != null &&
      (isNaN(parsedAvgVelocity) ||
        parsedAvgVelocity <= 0 ||
        parsedAvgVelocity > 3)
    ) {
      Alert.alert(
        "エラー",
        "Average Velocityは0〜3.0 m/sの範囲で入力してください",
      );
      return;
    }

    if (
      parsedVelocityLoss != null &&
      (isNaN(parsedVelocityLoss) ||
        parsedVelocityLoss < 0 ||
        parsedVelocityLoss > 80)
    ) {
      Alert.alert("エラー", "Velocity Lossは0〜80%の範囲で入力してください");
      return;
    }

    if (
      parsedRomCm != null &&
      (isNaN(parsedRomCm) || parsedRomCm <= 0 || parsedRomCm > 200)
    ) {
      Alert.alert("エラー", "ROMは0〜200cmの範囲で入力してください");
      return;
    }

    if (isSuperset && (!supersetExerciseA || !supersetExerciseB)) {
      Alert.alert(
        "スーパーセット種目を選択",
        "スーパーセットはA/B両方の種目を選んでから保存してください。",
      );
      openExerciseSelector(!supersetExerciseA ? "A" : "B");
      return;
    }

    try {
      await DatabaseService.ensureSession(sessionId, notes);
      const completedAt = new Date();
      const restDurationS =
        lastSavedAt == null
          ? undefined
          : Math.max(
              0,
              Math.round((completedAt.getTime() - lastSavedAt) / 1000),
            );

      const rawE1RM = VBTCalculations.estimate1RMFromReps(
        loadValue,
        repsValue,
        rpeValue,
      );
      const e1rmDecision = resolveSetE1RMForPersistence({
        rawE1RM,
        reps: repsValue,
        isAccessory: selectedExercise
          ? !isBig3Exercise(selectedExercise)
          : false,
      });

      const setData: SetData = {
        session_id: sessionId,
        lift,
        set_index: setIndex,
        load_kg: loadValue,
        reps: repsValue,
        device_type: "manual",
        set_type: setType,
        avg_velocity: parsedAvgVelocity,
        velocity_loss: parsedVelocityLoss,
        velocity_loss_avg: parsedVelocityLoss,
        velocity_loss_last: parsedVelocityLoss,
        velocity_loss_min: parsedVelocityLoss,
        avg_rom_cm: parsedRomCm,
        rpe: rpeValue,
        e1rm: e1rmDecision.e1rm,
        timestamp: completedAt.toISOString(),
        end_timestamp: completedAt.toISOString(),
        rest_duration_s: restDurationS,
        notes:
          [notes.trim(), e1rmDecision.exclusionReason]
            .filter(Boolean)
            .join("\n") || undefined,
      };

      await DatabaseService.insertSet(setData);

      for (let i = 1; i <= repsValue; i += 1) {
        const repData: RepData = {
          session_id: sessionId,
          lift,
          set_index: setIndex,
          rep_index: i,
          load_kg: loadValue,
          device_type: "manual",
          mean_velocity: parsedAvgVelocity,
          peak_velocity: parsedAvgVelocity,
          rom_cm: parsedRomCm,
          mean_power_w: null,
          rep_duration_ms: null,
          is_valid_rep: true,
          rpe_set: rpeValue,
          set_type: setType,
          timestamp: new Date().toISOString(),
        };
        await DatabaseService.insertRep(repData);
      }

      await DatabaseService.syncSessionSummary(sessionId);
      await ExerciseService.inferRomRangeForLift(lift);
      await loadRecentLiftSets();

      setSavedSets((prev) => [...prev, setData]);
      setLastSavedAt(completedAt.getTime());
      setLoadKg("");
      setReps("");
      setRpe("");
      setAvgVelocity("");
      setVelocityLoss("");
      setRomCm("");
      setNotes("");

      if (
        setType === "superset_A" &&
        supersetExerciseB &&
        supersetExerciseB.id !== selectedExercise?.id
      ) {
        setSetType("superset_B");
        applyActiveExercise(supersetExerciseB);
        setSaveStatus(
          `スーパーAを保存。続けて ${supersetExerciseB.name} を入力します`,
        );
      } else if (setType === "superset_B" && supersetExerciseA) {
        setSetType("superset_A");
        applyActiveExercise(supersetExerciseA);
        setSetIndex((prev) => prev + 1);
        setSaveStatus(`スーパーセット ${setIndex} を保存しました`);
      } else {
        setSetIndex((prev) => prev + 1);
        setSaveStatus(
          `${getSetTypeLabel(setType)} セット ${setIndex} を保存しました`,
        );
      }
    } catch (error) {
      console.error("Failed to save set:", error);
      Alert.alert("エラー", "セットの保存に失敗しました");
    }
  };

  const handleFinishSession = () => {
    if (savedSets.length === 0) {
      Alert.alert("エラー", "まずセットを記録してください");
      return;
    }

    if (isFinishing) return;

    const missingRpeCount = savedSets.filter((set) => set.rpe == null).length;
    Alert.alert(
      "セッション完了",
      `${savedSets.length}セットを記録しました${missingRpeCount ? `\n注意: RPE未入力 ${missingRpeCount}セット / 手動入力では痛みレビュー未入力` : "\n注意: 手動入力では痛みレビュー未入力"}`,
      [
        {
          text: "OK",
          onPress: () => {
            void (async () => {
              if (isFinishing) return;
              setIsFinishing(true);
              const completedAt = new Date();

              try {
                const existingSession =
                  await DatabaseService.getSession(sessionId);

                const sessionPayload = buildManualSessionCompletionPayload({
                  sessionId,
                  savedSets,
                  manualStartedAt: new Date(manualStartedAt),
                  completedAt,
                  existingSession,
                  notes,
                });

                if (sessionPayload == null) {
                  Alert.alert(
                    "完了保存に失敗",
                    "完了データを作成できませんでした。",
                  );
                  return;
                }

                await DatabaseService.updateSession(sessionPayload);
                setShowSavedSetsSheet(false);
                navigation.navigate("Home");
              } catch (error) {
                console.error("Failed to finalize manual session:", error);
                Alert.alert("完了保存に失敗", "完了保存に失敗しました。");
              } finally {
                setIsFinishing(false);
              }
            })();
          },
        },
      ],
    );
  };

  const statusHeartRateLabel =
    heartRateStatus === "active"
      ? currentHeartRate == null
        ? "HR --"
        : `HR ${Math.round(currentHeartRate)}`
      : heartRateStatus === "checking"
        ? "HR 確認中"
        : "HR --";

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Math.max(insets.top, 12)}
      >
        <ScrollView
          style={styles.container}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 120 },
          ]}
        >
          <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              onPress={() => navigation.goBack()}
              accessibilityLabel="前の画面に戻る"
            >
              <Text style={styles.backButton}>← 戻る</Text>
            </TouchableOpacity>
            <View style={styles.headerTitleBlock}>
              <Text style={styles.title}>手動入力</Text>
            </View>
            <Text style={styles.headerSetLabel}>セット {setIndex}</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.todaySummaryBar}>
              <Text style={styles.todaySummaryBarText} numberOfLines={1}>
                今日 {sessionSummary.savedSetCount}セット /{" "}
                {sessionSummary.totalReps}rep /{" "}
                {Math.round(sessionSummary.totalVolume).toLocaleString()}kg / 次{" "}
                {setIndex}
              </Text>
            </View>

            <View style={styles.favoriteQuickCard}>
              <View style={styles.favoriteQuickHeader}>
                <View>
                  <Text style={styles.favoriteQuickTitle}>お気に入り</Text>
                  <Text style={styles.favoriteQuickMeta}>
                    種目・重量・repを一発反映
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.favoriteRegisterButton}
                  onPress={handleRegisterFavoritePreset}
                  accessibilityLabel="今の入力をお気に入り登録"
                >
                  <Text style={styles.favoriteRegisterButtonText}>登録</Text>
                </TouchableOpacity>
              </View>
              {favoritePresetsForDisplay.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.favoriteQuickRow}
                >
                  {favoritePresetsForDisplay.map((preset) => (
                    <TouchableOpacity
                      key={preset.id}
                      style={[
                        styles.favoritePresetButton,
                        preset.exerciseName === lift &&
                          parsedLoadKg === preset.loadKg &&
                          styles.favoritePresetButtonActive,
                      ]}
                      onPress={() => {
                        void handleApplyFavoritePreset(preset);
                      }}
                      onLongPress={() => handleRemoveFavoritePreset(preset)}
                      accessibilityLabel={`${formatFavoritePresetLabel(
                        preset,
                      )} のお気に入りを反映`}
                      accessibilityHint="長押しで削除します"
                    >
                      <Text
                        style={[
                          styles.favoritePresetLabel,
                          preset.exerciseName === lift &&
                            parsedLoadKg === preset.loadKg &&
                            styles.favoritePresetLabelActive,
                        ]}
                        numberOfLines={1}
                      >
                        {formatFavoritePresetLabel(preset)}
                      </Text>
                      <Text style={styles.favoritePresetMeta}>
                        {getSetTypeLabel(preset.setType)}
                        {preset.useCount > 0 ? ` / ${preset.useCount}回` : ""}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.favoriteEmptyText}>
                  よく使う組み合わせを登録すると、次回から秒で入力できます。
                </Text>
              )}
            </View>

            {!isSuperset && (
              <>
                <Text style={styles.labelCompact}>種目</Text>
                <TouchableOpacity
                  style={styles.exerciseSelectorCard}
                  onPress={() => openExerciseSelector("active")}
                  accessibilityLabel="種目を選択"
                >
                  <View>
                    <Text style={styles.exerciseSelectorName}>{lift}</Text>
                    <Text style={styles.exerciseSelectorMeta}>
                      {selectedExercise
                        ? getExerciseCategoryLabel(selectedExercise.category)
                        : "種目を選択してください"}
                    </Text>
                  </View>
                  <Text style={styles.exerciseSelectorAction}>変更</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.compactInputCard}>
              <View style={styles.compactInputHeader}>
                <Text style={styles.compactInputTitle}>重量 / rep / RPE</Text>
                <Text style={styles.compactInputMeta}>RPEは任意</Text>
              </View>
              <View style={styles.weightInputContainer}>
                <TouchableOpacity
                  style={styles.adjustButton}
                  onPress={() => adjustLoad(-0.5)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityLabel="重量を0.5kg下げる"
                >
                  <Text style={styles.adjustButtonText}>−</Text>
                </TouchableOpacity>

                <TextInput
                  style={[styles.input, styles.weightInput]}
                  value={loadKg}
                  onChangeText={setLoadKg}
                  keyboardType="decimal-pad"
                  returnKeyType="next"
                  selectTextOnFocus
                  placeholder="kg"
                  placeholderTextColor="#666"
                  accessibilityLabel="重量を入力"
                />

                <TouchableOpacity
                  style={styles.adjustButton}
                  onPress={() => adjustLoad(0.5)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityLabel="重量を0.5kg上げる"
                >
                  <Text style={styles.adjustButtonText}>+</Text>
                </TouchableOpacity>
              </View>

              {(currentPresets.length > 0 ||
                recentSetsForDisplay.length > 0) && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.quickWeightRow}
                >
                  {currentPresets.map((weight) => (
                    <TouchableOpacity
                      key={`preset-${weight}`}
                      style={[
                        styles.presetButton,
                        parsedLoadKg === weight && styles.presetButtonActive,
                      ]}
                      onPress={() => selectPreset(weight)}
                      accessibilityLabel={`${weight}kgのプリセットを選択`}
                    >
                      <Text
                        style={[
                          styles.presetButtonText,
                          parsedLoadKg === weight &&
                            styles.presetButtonTextActive,
                        ]}
                      >
                        {weight}kg
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {recentSetsForDisplay.slice(0, 3).map((set) => (
                    <TouchableOpacity
                      key={`recent-${set.session_id}_${set.set_index}`}
                      style={[
                        styles.recentWeightButton,
                        parsedLoadKg === set.load_kg &&
                          styles.recentWeightButtonActive,
                      ]}
                      onPress={() => selectRecentWeight(set.load_kg)}
                      accessibilityLabel={`${formatLoadKgTwoDecimals(set.load_kg)}kgの直近重量を選択`}
                    >
                      <Text
                        style={[
                          styles.recentWeightButtonText,
                          parsedLoadKg === set.load_kg &&
                            styles.recentWeightButtonTextActive,
                        ]}
                      >
                        直近 {formatLoadKgTwoDecimals(set.load_kg)}kg
                      </Text>
                      <Text style={styles.recentWeightButtonSub}>
                        ×{set.reps}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <View style={styles.compactMetricsRow}>
                <View style={styles.compactMetricField}>
                  <Text style={styles.compactMetricLabel}>rep</Text>
                  <TextInput
                    style={[styles.input, styles.compactMetricInput]}
                    value={reps}
                    onChangeText={setReps}
                    keyboardType="number-pad"
                    returnKeyType="next"
                    selectTextOnFocus
                    placeholder="10"
                    placeholderTextColor="#666"
                    accessibilityLabel="レップ数を入力"
                  />
                </View>
                <View style={styles.compactMetricField}>
                  <Text style={styles.compactMetricLabel}>RPE</Text>
                  <TextInput
                    style={[styles.input, styles.compactMetricInput]}
                    value={rpe}
                    onChangeText={setRpe}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    selectTextOnFocus
                    placeholder="8.5"
                    placeholderTextColor="#666"
                    accessibilityLabel="RPEを入力"
                  />
                </View>
              </View>
            </View>

            <View style={styles.setTypeTopCard}>
              <View style={styles.setTypeTopHeader}>
                <Text style={styles.setTypeTopTitle}>セット種別</Text>
                <Text style={styles.setTypeTopBadge}>
                  {getSetTypeLabel(setType)}
                </Text>
              </View>
              <View style={styles.setTypeGroup}>
                <Text style={styles.setTypeGroupLabel}>基本</Text>
                <View style={styles.setTypeButtonRow}>
                  {primarySetTypes.map((type) => (
                    <TouchableOpacity
                      key={type.value}
                      style={[
                        styles.setTypeButton,
                        setType === type.value && styles.setTypeButtonActive,
                      ]}
                      onPress={() => handleSetTypeChange(type.value)}
                    >
                      <Text
                        style={[
                          styles.setTypeButtonText,
                          setType === type.value &&
                            styles.setTypeButtonTextActive,
                        ]}
                      >
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.setTypeGroup}>
                <Text style={styles.setTypeGroupLabel}>特殊</Text>
                <View style={styles.setTypeButtonRow}>
                  {advancedSetTypes.map((type) => (
                    <TouchableOpacity
                      key={type.value}
                      style={[
                        styles.setTypeButton,
                        styles.setTypeButtonCompact,
                        setType === type.value && styles.setTypeButtonActive,
                      ]}
                      onPress={() => handleSetTypeChange(type.value)}
                    >
                      <Text
                        style={[
                          styles.setTypeButtonText,
                          setType === type.value &&
                            styles.setTypeButtonTextActive,
                        ]}
                      >
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {isSuperset ? (
              <View style={styles.supersetCard}>
                <View style={styles.supersetHeader}>
                  <Text style={styles.supersetTitle}>スーパーセット種目</Text>
                  <Text style={styles.supersetMeta}>A/Bを交互に保存します</Text>
                </View>
                <View style={styles.supersetPairRow}>
                  <TouchableOpacity
                    style={[
                      styles.supersetExerciseCard,
                      setType === "superset_A" && styles.supersetExerciseActive,
                    ]}
                    onPress={() => openExerciseSelector("A")}
                    accessibilityLabel="スーパーセットAの種目を選択"
                  >
                    <Text style={styles.supersetSlotLabel}>A</Text>
                    <Text style={styles.supersetExerciseName}>
                      {supersetExerciseA?.name ?? "種目を選択"}
                    </Text>
                    <Text style={styles.supersetExerciseMeta}>
                      {supersetExerciseA
                        ? getExerciseCategoryLabel(supersetExerciseA.category)
                        : "未設定"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.supersetExerciseCard,
                      setType === "superset_B" && styles.supersetExerciseActive,
                    ]}
                    onPress={() => openExerciseSelector("B")}
                    accessibilityLabel="スーパーセットBの種目を選択"
                  >
                    <Text style={styles.supersetSlotLabel}>B</Text>
                    <Text style={styles.supersetExerciseName}>
                      {supersetExerciseB?.name ?? "種目を選択"}
                    </Text>
                    <Text style={styles.supersetExerciseMeta}>
                      {supersetExerciseB
                        ? getExerciseCategoryLabel(supersetExerciseB.category)
                        : "未設定"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null}

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.statusScrollContent}
            >
              <Text style={styles.statusPill}>
                経過 {formatElapsedTime(manualElapsedSeconds)}
              </Text>
              <Text style={styles.statusPill}>
                Rest{" "}
                {restElapsedSeconds == null
                  ? "--:--"
                  : formatElapsedTime(restElapsedSeconds)}
              </Text>
              <Text style={styles.statusPill}>{statusHeartRateLabel}</Text>
            </ScrollView>

            <TouchableOpacity
              style={styles.detailsToggle}
              onPress={() => setShowDetails((prev) => !prev)}
              accessibilityLabel={showDetails ? "詳細を閉じる" : "詳細を開く"}
            >
              <Text style={styles.detailsToggleLabel}>
                詳細 {showDetails ? "閉じる" : "開く"}
              </Text>
              <Text style={styles.detailsToggleMeta}>
                コーチ / Accessory RM / VBT / メモ
              </Text>
            </TouchableOpacity>

            {saveStatus ? (
              <Text
                accessibilityLiveRegion="polite"
                style={styles.saveStatusText}
              >
                {saveStatus}
              </Text>
            ) : null}

            {showDetails ? (
              <>
                <TouchableOpacity
                  style={[
                    styles.coachButton,
                    !latestManualConsultationSet && styles.coachButtonDisabled,
                  ]}
                  onPress={() => void handleCopyManualSupervisorPacket()}
                  disabled={!latestManualConsultationSet}
                  accessibilityLabel="チャッピーコーチへ相談"
                >
                  <Text style={styles.coachButtonText}>
                    チャッピーコーチへ相談
                  </Text>
                  <Text style={styles.coachButtonSubtext}>
                    入力中/保存済みセットと直近複数セットをコピーしてChatGPTへ渡す
                  </Text>
                </TouchableOpacity>

                {accessoryRMTarget.enabled ? (
                  <View style={styles.accessoryTargetCard}>
                    <View style={styles.accessoryTargetHeader}>
                      <View>
                        <Text style={styles.accessoryTargetEyebrow}>
                          ACCESSORY RM TARGET
                        </Text>
                        <Text style={styles.accessoryTargetTitle}>
                          5〜15rep 換算表
                        </Text>
                      </View>
                      <Text style={styles.accessoryTargetBadge}>
                        {accessoryRMTarget.targetSource === "previous_best"
                          ? "更新狙い"
                          : "初回基準"}
                      </Text>
                    </View>
                    <View style={styles.accessoryTargetGrid}>
                      <View style={styles.accessoryTargetMetric}>
                        <Text style={styles.accessoryTargetLabel}>
                          今回e1RM
                        </Text>
                        <Text style={styles.accessoryTargetValue}>
                          {formatNumber(
                            accessoryRMTarget.currentE1RMKg,
                            1,
                            "kg",
                          )}
                        </Text>
                      </View>
                      <View style={styles.accessoryTargetMetric}>
                        <Text style={styles.accessoryTargetLabel}>
                          過去Best
                        </Text>
                        <Text style={styles.accessoryTargetValue}>
                          {formatNumber(
                            accessoryRMTarget.previousBestE1RMKg,
                            1,
                            "kg",
                          )}
                        </Text>
                      </View>
                      <View style={styles.accessoryTargetMetric}>
                        <Text style={styles.accessoryTargetLabel}>
                          目標e1RM
                        </Text>
                        <Text style={styles.accessoryTargetValue}>
                          {formatNumber(
                            accessoryRMTarget.targetE1RMKg,
                            1,
                            "kg",
                          )}
                        </Text>
                      </View>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.accessoryTargetTable}
                    >
                      {accessoryRMTarget.conversionTable.map((row) => (
                        <View
                          key={`manual-accessory-rm-${row.reps}`}
                          style={styles.accessoryTargetCell}
                        >
                          <Text style={styles.accessoryTargetRep}>
                            {row.reps}rep
                          </Text>
                          <Text style={styles.accessoryTargetLoad}>
                            {formatAccessoryTargetLoad(row.targetLoadKg)}
                          </Text>
                          <Text style={styles.accessoryTargetCellMeta}>
                            e1RM {formatNumber(row.targetE1RMKg, 1, "kg")}
                          </Text>
                        </View>
                      ))}
                    </ScrollView>
                    <Text style={styles.accessoryTargetNote}>
                      各補助種目1セットだけRM換算セットマックス狙い。RPE9.5以上・痛み・ROM15%以上急変・主役リフトに響く疲労で終了。
                    </Text>
                  </View>
                ) : null}

                <View style={styles.manualVbtCard}>
                  <View style={styles.manualVbtHeader}>
                    <Text style={styles.manualVbtTitle}>VBT手動メトリクス</Text>
                    <Text style={styles.manualVbtMeta}>任意</Text>
                  </View>
                  <Text style={styles.manualVbtBody}>
                    OVRを使わない日でも、平均速度・VL・ROMを入れるとAPIなしコーチ判定に使えます。
                  </Text>
                  <View style={styles.manualVbtGrid}>
                    <View style={styles.manualVbtInputWrap}>
                      <Text style={styles.manualVbtLabel}>
                        Average Velocity
                      </Text>
                      <TextInput
                        style={styles.manualVbtInput}
                        value={avgVelocity}
                        onChangeText={setAvgVelocity}
                        keyboardType="decimal-pad"
                        returnKeyType="next"
                        selectTextOnFocus
                        placeholder="0.32"
                        placeholderTextColor="#666"
                      />
                    </View>
                    <View style={styles.manualVbtInputWrap}>
                      <Text style={styles.manualVbtLabel}>Velocity Loss %</Text>
                      <TextInput
                        style={styles.manualVbtInput}
                        value={velocityLoss}
                        onChangeText={setVelocityLoss}
                        keyboardType="decimal-pad"
                        returnKeyType="next"
                        selectTextOnFocus
                        placeholder="12"
                        placeholderTextColor="#666"
                      />
                    </View>
                    <View style={styles.manualVbtInputWrap}>
                      <Text style={styles.manualVbtLabel}>ROM cm</Text>
                      <TextInput
                        style={styles.manualVbtInput}
                        value={romCm}
                        onChangeText={setRomCm}
                        keyboardType="decimal-pad"
                        returnKeyType="done"
                        selectTextOnFocus
                        placeholder="45"
                        placeholderTextColor="#666"
                      />
                    </View>
                  </View>
                  {manualCoachDecision ? (
                    <View style={styles.manualCoachPreview}>
                      <Text style={styles.manualCoachKicker}>
                        {manualCoachDecision.action.toUpperCase()}
                      </Text>
                      <Text style={styles.manualCoachMessage}>
                        {manualCoachDecision.message}
                      </Text>
                      {manualCoachDecision.suggestedAction ? (
                        <Text style={styles.manualCoachAction}>
                          {manualCoachDecision.suggestedAction}
                        </Text>
                      ) : null}
                    </View>
                  ) : null}
                </View>

                <Text style={styles.label}>メモ (オプション)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="フォーム、疲労感、次回メモなど"
                  placeholderTextColor="#666"
                  multiline
                  accessibilityLabel="メモを入力"
                />

                <View style={styles.recentCard}>
                  <View style={styles.recentHeader}>
                    <View>
                      <Text style={styles.recentTitle}>最近使った設定</Text>
                      <Text style={styles.recentSubtitle}>
                        前回時刻つき。タップで負荷/レップを反映します
                      </Text>
                    </View>
                    <Text style={styles.recentBadge}>{lift}</Text>
                  </View>
                  {recentSetsForDisplay.length === 0 ? (
                    <Text style={styles.recentEmpty}>
                      まだ比較できる過去セットがありません
                    </Text>
                  ) : (
                    recentSetsForDisplay.map((set) => (
                      <View
                        key={`${set.session_id}_${set.set_index}_${set.lift}`}
                        style={styles.recentItem}
                      >
                        <TouchableOpacity
                          style={styles.recentItemCopy}
                          onPress={() => handleApplyRecentSet(set)}
                        >
                          <Text style={styles.recentItemDate}>
                            {formatRelativeTime(set.timestamp)} /{" "}
                            {formatSessionLabel(set.session_id)}
                          </Text>
                          <Text style={styles.recentItemMain}>
                            {formatLoadKgTwoDecimals(set.load_kg)} kg x {set.reps} reps
                          </Text>
                          <Text style={styles.recentItemSub}>
                            {getSetTypeLabel(set.set_type)}
                            {set.avg_velocity != null
                              ? ` / AV ${set.avg_velocity.toFixed(2)}m/s`
                              : ""}
                            {set.avg_rom_cm != null
                              ? ` / ROM ${set.avg_rom_cm.toFixed(0)}cm`
                              : ""}
                          </Text>
                        </TouchableOpacity>
                        <View style={styles.recentItemAction}>
                          <Text style={styles.recentItemMeta}>
                            {set.e1rm
                              ? `e1RM ${set.e1rm.toFixed(1)}`
                              : set.set_type}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
                </View>

                <View style={styles.vbtGuideCard}>
                  <View style={styles.vbtGuideHeader}>
                    <View>
                      <Text style={styles.vbtGuideEyebrow}>PL VBT GUIDE</Text>
                      <Text style={styles.vbtGuideTitle}>
                        {setTypeGuidance.title}
                      </Text>
                    </View>
                    <Text style={styles.vbtGuidePhase}>W{blockWeek}</Text>
                  </View>
                  <Text style={styles.vbtGuideBody}>
                    {setTypeGuidance.body}
                  </Text>
                  <View style={styles.vbtGuideGrid}>
                    <View style={styles.vbtGuideMetric}>
                      <Text style={styles.vbtGuideLabel}>Top Single</Text>
                      <Text style={styles.vbtGuideValue}>
                        {topSingleTargetText}
                      </Text>
                    </View>
                    <View style={styles.vbtGuideMetric}>
                      <Text style={styles.vbtGuideLabel}>Backoff VL</Text>
                      <Text style={styles.vbtGuideValue}>
                        {manualProtocol.backoffVelocityLoss.min}〜
                        {manualProtocol.backoffVelocityLoss.max}%
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.vbtGuideNote}>
                    {blockWeekPlan.phaseLabel}: {blockWeekPlan.focus}
                  </Text>
                </View>
              </>
            ) : null}

            <View style={styles.manualHistoryCard}>
              <View style={styles.manualHistoryHeader}>
                <View>
                  <Text style={styles.manualHistoryTitle}>手入力履歴</Text>
                  <Text style={styles.manualHistorySubtitle}>
                    今回保存したセット。タップで次の入力へ反映します
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.manualHistoryAllHitbox}
                  onPress={() => setShowSavedSetsSheet(true)}
                  accessibilityLabel={`保存済みセット全件を開く。${savedSets.length}件`}
                >
                  <Text style={styles.manualHistoryAllButton}>全件</Text>
                </TouchableOpacity>
              </View>
              {manualHistoryPreview.length === 0 ? (
                <Text style={styles.manualHistoryEmpty}>
                  セットを保存すると、ここに今回の履歴が表示されます
                </Text>
              ) : (
                manualHistoryPreview.map((set) => (
                  <TouchableOpacity
                    key={`manual-history-${set.session_id}_${set.set_index}_${set.lift}`}
                    style={styles.manualHistoryItem}
                    onPress={() => handleApplyRecentSet(set)}
                    accessibilityLabel={`${set.lift}、${formatLoadKgTwoDecimals(set.load_kg)}kg、${set.reps}repを次の入力へ反映`}
                  >
                    <View style={styles.manualHistoryItemBody}>
                      <Text style={styles.manualHistoryItemTitle} numberOfLines={1}>
                        {set.lift} / {formatLoadKgTwoDecimals(set.load_kg)} kg x {set.reps}
                      </Text>
                      <Text style={styles.manualHistoryItemMeta}>
                        セット {set.set_index} / {getSetTypeLabel(set.set_type)} / {formatRelativeTime(set.timestamp)}
                      </Text>
                    </View>
                    <Text style={styles.manualHistoryItemMetric}>
                      {set.rpe != null ? `RPE ${set.rpe.toFixed(1)}` : "RPE -"}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </View>
          </View>
        </ScrollView>

        <View
          style={[
            styles.actionBar,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <TouchableOpacity
            style={styles.savedSetsButton}
            onPress={() => setShowSavedSetsSheet(true)}
            accessibilityLabel={`保存済みセットを開く。${savedSets.length}件`}
          >
            <Text style={styles.savedSetsButtonLabel}>
              保存済み {savedSets.length}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSaveSet}
            accessibilityLabel="セットを保存"
          >
            <Text style={styles.saveButtonText}>セットを保存</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={showSavedSetsSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSavedSetsSheet(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable
            style={styles.sheetBackdrop}
            onPress={() => setShowSavedSetsSheet(false)}
            accessibilityLabel="保存済みセットを閉じる"
          />
          <View
            style={[
              styles.sheetContainer,
              { paddingBottom: insets.bottom + 12 },
            ]}
          >
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.summaryTitle}>保存済みセット</Text>
              <TouchableOpacity
                style={styles.sheetCloseButton}
                onPress={() => setShowSavedSetsSheet(false)}
                accessibilityLabel="保存済みセットを閉じる"
              >
                <Text style={styles.sheetCloseText}>閉じる</Text>
              </TouchableOpacity>
            </View>
            {savedSets.length === 0 ? (
              <Text style={styles.summaryEmpty}>
                まだ保存されたセットはありません
              </Text>
            ) : (
              <>
                <View style={styles.summaryOverview}>
                  <Text style={styles.summaryOverviewText}>
                    合計 {sessionSummary.savedSetCount} セット
                  </Text>
                  <Text style={styles.summaryOverviewText}>
                    {Math.round(sessionSummary.totalVolume).toLocaleString()} kg
                  </Text>
                </View>
                <ScrollView
                  style={styles.sheetList}
                  contentContainerStyle={styles.sheetListContent}
                >
                  {savedSets.map((set) => (
                    <View
                      key={`${set.session_id}_${set.set_index}_${set.lift}`}
                      style={styles.summaryItem}
                    >
                      <View style={styles.summaryItemBody}>
                        <Text style={styles.summaryText}>
                          {set.lift} / セット {set.set_index}
                        </Text>
                        <Text style={styles.summaryMeta}>
                          {getSetTypeLabel(set.set_type)} / {formatLoadKgTwoDecimals(set.load_kg)} kg ×{" "}
                          {set.reps} reps
                        </Text>
                        {set.rest_duration_s != null || set.avg_hr != null ? (
                          <Text style={styles.summaryTimingMeta}>
                            {set.rest_duration_s != null
                              ? `Rest ${formatElapsedTime(set.rest_duration_s)}`
                              : "Rest -"}
                            {set.avg_hr != null
                              ? ` / HR ${Math.round(set.avg_hr)}bpm`
                              : ""}
                          </Text>
                        ) : null}
                        {set.avg_velocity != null ||
                        set.velocity_loss != null ||
                        set.avg_rom_cm != null ? (
                          <Text style={styles.summaryVbtMeta}>
                            {set.avg_velocity != null
                              ? `AV ${set.avg_velocity.toFixed(2)}m/s`
                              : ""}
                            {set.velocity_loss != null
                              ? ` / VL avg/last/min ${set.velocity_loss.toFixed(1)} / ${(
                                  set.velocity_loss_last ?? set.velocity_loss
                                ).toFixed(1)} / ${(
                                  set.velocity_loss_min ?? set.velocity_loss
                                ).toFixed(1)}%`
                              : ""}
                            {set.avg_rom_cm != null
                              ? ` / ROM ${set.avg_rom_cm.toFixed(1)}cm`
                              : ""}
                          </Text>
                        ) : null}
                      </View>
                      {set.e1rm ? (
                        <Text style={styles.summaryE1rm}>
                          e1RM {set.e1rm.toFixed(1)}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </ScrollView>
              </>
            )}
            <TouchableOpacity
              style={[
                styles.finishButton,
                (savedSets.length === 0 || isFinishing) &&
                  styles.buttonDisabled,
              ]}
              onPress={handleFinishSession}
              disabled={savedSets.length === 0 || isFinishing}
              accessibilityLabel="セッションを完了"
            >
              <Text style={styles.finishButtonText}>
                {isFinishing ? "保存中..." : "セッション完了"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ExerciseSelectModal
        visible={showExerciseModal}
        onClose={() => setShowExerciseModal(false)}
        onSelect={handleExerciseSelected}
        currentExerciseId={
          exerciseSelectSlot === "A"
            ? supersetExerciseA?.id
            : exerciseSelectSlot === "B"
              ? supersetExerciseB?.id
              : selectedExercise?.id
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GarageTheme.background,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerTitleBlock: {
    flex: 1,
    minWidth: 0,
  },
  backButton: {
    color: GarageTheme.accent,
    fontSize: 15,
  },
  headerSetLabel: {
    color: GarageTheme.textStrong,
    fontSize: 13,
    fontWeight: "700",
  },
  title: {
    fontSize: 21,
    fontWeight: "700",
    color: GarageTheme.textStrong,
  },
  subtitle: {
    fontSize: 13,
    color: GarageTheme.textMuted,
    marginTop: 2,
  },
  form: {
    padding: 16,
  },
  todaySummaryBar: {
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#151515",
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
  },
  todaySummaryBarText: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  coachButton: {
    backgroundColor: "#1f1512",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#7170ff",
    padding: 14,
    marginBottom: 8,
  },
  coachButtonText: {
    color: "#f7f8f8",
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 4,
  },
  coachButtonSubtext: {
    color: "#d4a58f",
    fontSize: 12,
  },
  coachButtonDisabled: {
    opacity: 0.45,
  },
  recentCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 8,
    backgroundColor: "#151515",
    borderWidth: 1,
    borderColor: "#2f2f2f",
  },
  recentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
  },
  recentTitle: {
    color: "#f1f1f1",
    fontSize: 15,
    fontWeight: "500",
    marginBottom: 3,
  },
  recentSubtitle: {
    color: GarageTheme.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  recentBadge: {
    maxWidth: 112,
    color: "#111111",
    backgroundColor: GarageTheme.accentSoft,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 10,
    fontWeight: "600",
    textAlign: "center",
  },
  recentEmpty: {
    color: "#8a8a8a",
    fontSize: 13,
  },
  recentItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#232323",
  },
  recentItemCopy: {
    flex: 1,
  },
  recentItemDate: {
    color: "#9ad0ff",
    fontSize: 12,
    marginBottom: 3,
  },
  recentItemMain: {
    color: "#f7f8f8",
    fontSize: 14,
    fontWeight: "600",
  },
  recentItemSub: {
    color: "#8f8f8f",
    fontSize: 11,
    marginTop: 3,
    lineHeight: 15,
  },
  recentItemAction: {
    alignItems: "flex-end",
    gap: 4,
  },
  recentItemMeta: {
    color: "#a9d6a1",
    fontSize: 12,
    fontWeight: "500",
  },
  recentItemHint: {
    color: "#828fff",
    fontSize: 11,
    fontWeight: "500",
  },
  recentCoachMiniButton: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: "#2c2117",
    borderWidth: 1,
    borderColor: "#5a3b1b",
  },
  manualHistoryCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 8,
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
  },
  manualHistoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
  },
  manualHistoryTitle: {
    color: GarageTheme.textStrong,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 3,
  },
  manualHistorySubtitle: {
    color: GarageTheme.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  manualHistoryAllButton: {
    color: GarageTheme.accent,
    fontSize: 13,
    fontWeight: "700",
  },
  manualHistoryAllHitbox: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  manualHistoryEmpty: {
    color: GarageTheme.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  manualHistoryItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 52,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: GarageTheme.border,
  },
  manualHistoryItemBody: {
    flex: 1,
  },
  manualHistoryItemTitle: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: "600",
  },
  manualHistoryItemMeta: {
    color: GarageTheme.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  manualHistoryItemMetric: {
    color: "#a9d6a1",
    fontSize: 12,
    fontWeight: "600",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: GarageTheme.textStrong,
    marginTop: 16,
    marginBottom: 8,
  },
  labelCompact: {
    fontSize: 14,
    fontWeight: "600",
    color: GarageTheme.textStrong,
    marginBottom: 8,
  },
  exerciseSelectorCard: {
    backgroundColor: GarageTheme.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  exerciseSelectorName: {
    color: GarageTheme.textStrong,
    fontSize: 16,
    fontWeight: "600",
  },
  exerciseSelectorMeta: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  exerciseSelectorAction: {
    color: GarageTheme.accentSoft,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0,
  },
  favoriteQuickCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#111624",
    borderWidth: 1,
    borderColor: "#273352",
  },
  favoriteQuickHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },
  favoriteQuickTitle: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: "700",
  },
  favoriteQuickMeta: {
    color: GarageTheme.textMuted,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 3,
  },
  favoriteRegisterButton: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: "#25345c",
    borderWidth: 1,
    borderColor: "#435ea0",
    alignItems: "center",
    justifyContent: "center",
  },
  favoriteRegisterButtonText: {
    color: "#dfe7ff",
    fontSize: 13,
    fontWeight: "700",
  },
  favoriteQuickRow: {
    gap: 8,
    paddingRight: 8,
  },
  favoritePresetButton: {
    minHeight: 52,
    minWidth: 128,
    maxWidth: 190,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#18223a",
    borderWidth: 1,
    borderColor: "#2c3a60",
    justifyContent: "center",
  },
  favoritePresetButtonActive: {
    backgroundColor: "#2d3f78",
    borderColor: "#7187ff",
  },
  favoritePresetLabel: {
    color: "#cbd5ff",
    fontSize: 13,
    fontWeight: "700",
  },
  favoritePresetLabelActive: {
    color: "#f7f8f8",
  },
  favoritePresetMeta: {
    color: "#8895c8",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
  favoriteEmptyText: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  compactInputCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#151515",
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
  },
  compactInputHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  compactInputTitle: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: "700",
  },
  compactInputMeta: {
    color: GarageTheme.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  quickWeightRow: {
    gap: 8,
    paddingTop: 4,
    paddingBottom: 2,
  },
  compactMetricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 10,
  },
  compactMetricField: {
    flex: 1,
    minWidth: 132,
  },
  compactMetricLabel: {
    color: GarageTheme.textMuted,
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 5,
  },
  compactMetricInput: {
    textAlign: "center",
  },
  statusStrip: {
    flexDirection: "row",
    flexWrap: "nowrap",
    gap: 8,
    marginTop: 10,
    marginBottom: 6,
  },
  statusScrollContent: {
    flexDirection: "row",
    gap: 8,
  },
  statusPill: {
    color: "#dbeafe",
    fontSize: 12,
    fontWeight: "600",
    backgroundColor: "#172033",
    borderWidth: 1,
    borderColor: "#263852",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  detailsToggle: {
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
  },
  detailsToggleLabel: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  detailsToggleMeta: {
    color: GarageTheme.textMuted,
    fontSize: 11,
  },
  supersetCard: {
    marginTop: 8,
    marginBottom: 8,
    padding: 12,
    borderRadius: 8,
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
  },
  supersetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  supersetTitle: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: "600",
  },
  supersetMeta: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    fontWeight: "500",
  },
  supersetPairRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  supersetExerciseCard: {
    flexGrow: 1,
    flexBasis: 132,
    minWidth: 132,
    minHeight: 92,
    padding: 12,
    borderRadius: 8,
    backgroundColor: GarageTheme.chip,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
  },
  supersetExerciseActive: {
    borderColor: GarageTheme.accent,
    backgroundColor: "#4b2416",
  },
  supersetSlotLabel: {
    color: GarageTheme.accent,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  supersetExerciseName: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 18,
  },
  supersetExerciseMeta: {
    color: GarageTheme.textMuted,
    fontSize: 11,
    fontWeight: "500",
    marginTop: 6,
  },
  accessoryTargetCard: {
    marginTop: 10,
    marginBottom: 10,
    padding: 14,
    borderRadius: 8,
    backgroundColor: "#16131f",
    borderWidth: 1,
    borderColor: "#6f4cff",
  },
  accessoryTargetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
  },
  accessoryTargetEyebrow: {
    color: "#b7a8ff",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0,
    marginBottom: 3,
  },
  accessoryTargetTitle: {
    color: GarageTheme.textStrong,
    fontSize: 17,
    fontWeight: "600",
  },
  accessoryTargetBadge: {
    color: "#130f20",
    backgroundColor: "#b7a8ff",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: "600",
  },
  accessoryTargetGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  accessoryTargetMetric: {
    flex: 1,
    minHeight: 60,
    padding: 9,
    borderRadius: 8,
    backgroundColor: "#221b35",
    borderWidth: 1,
    borderColor: "#3d3165",
  },
  accessoryTargetLabel: {
    color: "#a395d8",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 5,
  },
  accessoryTargetValue: {
    color: GarageTheme.textStrong,
    fontSize: 15,
    fontWeight: "600",
  },
  accessoryTargetTable: {
    gap: 8,
    paddingRight: 8,
  },
  accessoryTargetCell: {
    width: 86,
    padding: 9,
    borderRadius: 8,
    backgroundColor: "#0f0d16",
    borderWidth: 1,
    borderColor: "#3d3165",
  },
  accessoryTargetRep: {
    color: "#b7a8ff",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
  },
  accessoryTargetLoad: {
    color: GarageTheme.textStrong,
    fontSize: 15,
    fontWeight: "600",
  },
  accessoryTargetCellMeta: {
    color: GarageTheme.textMuted,
    fontSize: 9,
    fontWeight: "500",
    marginTop: 4,
  },
  accessoryTargetNote: {
    color: "#c6bddf",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
    fontWeight: "500",
  },
  vbtGuideCard: {
    marginTop: 14,
    marginBottom: 2,
    padding: 14,
    borderRadius: 8,
    backgroundColor: "#111b18",
    borderWidth: 1,
    borderColor: "#245c4a",
  },
  vbtGuideHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8,
  },
  vbtGuideEyebrow: {
    color: "#58d89d",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0,
    marginBottom: 3,
  },
  vbtGuideTitle: {
    color: "#f4fff8",
    fontSize: 17,
    fontWeight: "600",
  },
  vbtGuidePhase: {
    color: "#111b18",
    backgroundColor: "#58d89d",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 12,
    fontWeight: "600",
  },
  vbtGuideBody: {
    color: "#c9dfd4",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  vbtGuideGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  vbtGuideMetric: {
    flex: 1,
    minHeight: 68,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#172620",
  },
  vbtGuideLabel: {
    color: "#8fb9a7",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 5,
  },
  vbtGuideValue: {
    color: "#f7f8f8",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  vbtGuideNote: {
    color: "#9fbbae",
    fontSize: 12,
    fontWeight: "500",
  },
  manualVbtCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 8,
    backgroundColor: "#171717",
    borderWidth: 1,
    borderColor: "#3d3d3d",
  },
  manualVbtHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
  },
  manualVbtTitle: {
    color: GarageTheme.textStrong,
    fontSize: 15,
    fontWeight: "600",
  },
  manualVbtMeta: {
    color: GarageTheme.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  manualVbtBody: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  manualVbtGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  manualVbtInputWrap: {
    flexGrow: 1,
    flexBasis: 132,
    minWidth: 132,
  },
  manualVbtLabel: {
    color: "#9fbbae",
    fontSize: 10,
    fontWeight: "600",
    marginBottom: 5,
  },
  manualVbtInput: {
    backgroundColor: "#242424",
    color: "#f7f8f8",
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: "#444",
  },
  manualCoachPreview: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#111b18",
    borderWidth: 1,
    borderColor: "#245c4a",
  },
  manualCoachKicker: {
    color: "#58d89d",
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0,
    marginBottom: 5,
  },
  manualCoachMessage: {
    color: "#f4fff8",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
  },
  manualCoachAction: {
    color: "#c9dfd4",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },
  exerciseGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  exerciseButton: {
    backgroundColor: "#2a2a2a",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  exerciseButtonActive: {
    backgroundColor: "#2196F3",
  },
  exerciseButtonText: {
    color: "#999",
    fontSize: 14,
  },
  exerciseButtonTextActive: {
    color: "#f7f8f8",
    fontWeight: "600",
  },
  setTypeTopCard: {
    backgroundColor: GarageTheme.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    padding: 12,
    marginBottom: 10,
  },
  setTypeTopHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  setTypeTopTitle: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: "700",
  },
  setTypeTopBadge: {
    color: GarageTheme.accent,
    fontSize: 11,
    fontWeight: "700",
  },
  setTypeGroup: {
    gap: 7,
    marginTop: 2,
  },
  setTypeGroupLabel: {
    color: GarageTheme.textMuted,
    fontSize: 11,
    fontWeight: "700",
  },
  setTypeButtonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  setTypeButton: {
    backgroundColor: "#2a2a2a",
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  setTypeButtonCompact: {
    backgroundColor: "#222",
  },
  setTypeButtonActive: {
    backgroundColor: "#7170ff",
  },
  setTypeButtonText: {
    color: "#999",
    fontSize: 14,
  },
  setTypeButtonTextActive: {
    color: "#f7f8f8",
    fontWeight: "600",
  },
  input: {
    backgroundColor: "#2a2a2a",
    color: "#f7f8f8",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 8,
    fontSize: 15,
    borderWidth: 1,
    borderColor: "#444",
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  saveButton: {
    backgroundColor: "#4CAF50",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    minHeight: 48,
    justifyContent: "center",
    flex: 1,
  },
  saveButtonText: {
    color: "#f7f8f8",
    fontSize: 18,
    fontWeight: "600",
  },
  saveStatusText: {
    color: GarageTheme.success,
    fontSize: 13,
    fontWeight: "500",
    marginTop: 10,
    textAlign: "center",
  },
  finishButton: {
    backgroundColor: "#2196F3",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 12,
    minHeight: 48,
    justifyContent: "center",
  },
  finishButtonText: {
    color: "#f7f8f8",
    fontSize: 18,
    fontWeight: "600",
  },
  buttonDisabled: {
    backgroundColor: "#444",
    opacity: 0.5,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f7f8f8",
    marginBottom: 12,
  },
  summaryEmpty: {
    fontSize: 14,
    color: "#888",
  },
  summaryOverview: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  summaryOverviewText: {
    color: "#f0f0f0",
    fontSize: 14,
    fontWeight: "600",
  },
  summaryItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 12,
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
  },
  summaryItemBody: {
    flex: 1,
  },
  summaryText: {
    fontSize: 14,
    color: "#f7f8f8",
    marginBottom: 2,
  },
  summaryMeta: {
    fontSize: 12,
    color: "#999",
  },
  summaryTimingMeta: {
    fontSize: 11,
    color: "#93c5fd",
    marginTop: 3,
    fontWeight: "500",
  },
  summaryVbtMeta: {
    fontSize: 11,
    color: "#9fbbae",
    marginTop: 3,
    fontWeight: "500",
  },
  summaryE1rm: {
    fontSize: 14,
    color: "#4CAF50",
    fontWeight: "600",
  },
  actionBar: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: "#111111",
    borderTopWidth: 1,
    borderTopColor: GarageTheme.borderStrong,
  },
  savedSetsButton: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    backgroundColor: GarageTheme.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  savedSetsButtonLabel: {
    color: GarageTheme.textStrong,
    fontSize: 15,
    fontWeight: "600",
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  sheetBackdrop: {
    flex: 1,
  },
  sheetContainer: {
    maxHeight: "78%",
    paddingTop: 10,
    paddingHorizontal: 16,
    backgroundColor: "#161616",
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: GarageTheme.borderStrong,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#4a4a4a",
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  sheetCloseText: {
    color: GarageTheme.accentSoft,
    fontSize: 14,
    fontWeight: "600",
  },
  sheetCloseButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetList: {
    marginTop: 4,
  },
  sheetListContent: {
    paddingBottom: 8,
  },
  weightInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  adjustButton: {
    backgroundColor: "#2a2a2a",
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#444",
  },
  adjustButtonText: {
    color: "#f7f8f8",
    fontSize: 24,
    fontWeight: "600",
  },
  weightInput: {
    flex: 1,
    textAlign: "center",
  },
  presetButton: {
    backgroundColor: "#2a2a2a",
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#444",
    justifyContent: "center",
  },
  presetButtonActive: {
    backgroundColor: "#2196F3",
    borderColor: "#2196F3",
  },
  presetButtonText: {
    color: "#999",
    fontSize: 14,
    fontWeight: "600",
  },
  presetButtonTextActive: {
    color: "#f7f8f8",
  },
  recentWeightButton: {
    backgroundColor: "#2a2a2a",
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#444",
    alignItems: "center",
    justifyContent: "center",
  },
  recentWeightButtonActive: {
    backgroundColor: "#7170ff",
    borderColor: "#7170ff",
  },
  recentWeightButtonText: {
    color: "#999",
    fontSize: 14,
    fontWeight: "600",
  },
  recentWeightButtonTextActive: {
    color: "#f7f8f8",
  },
  recentWeightButtonSub: {
    color: "#666",
    fontSize: 11,
  },
});

export default ManualEntryScreen;
