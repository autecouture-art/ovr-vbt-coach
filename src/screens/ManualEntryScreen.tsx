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
import { getExerciseCategoryLabel } from "../constants/exerciseCatalog";
import { GarageTheme } from "../constants/garageTheme";
import { SetData, RepData, SetType, Exercise } from "../types/index";
import { createSessionId, formatSessionLabel } from "../utils/session";
import {
  getBlockWeekPlan,
  getPhaseForBlockWeek,
  getPowerliftingProtocol,
  getTopSingleTargetText,
} from "../utils/PowerliftingVBTProtocol";
import {
  buildAccessoryRMTargetContext,
  formatAccessoryTargetLoad,
} from "../utils/AccessoryRMTarget";

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
  const [supersetExerciseA, setSupersetExerciseA] =
    useState<Exercise | null>(null);
  const [supersetExerciseB, setSupersetExerciseB] =
    useState<Exercise | null>(null);
  const [exerciseSelectSlot, setExerciseSelectSlot] =
    useState<SupersetSlot>("active");
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [blockWeek, setBlockWeek] = useState(5);
  const [manualStartedAt] = useState(() => Date.now());
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [currentHeartRate, setCurrentHeartRate] = useState<number | null>(null);
  const [heartRateStatus, setHeartRateStatus] =
    useState<"checking" | "active" | "unavailable">("checking");

  const setTypes: { value: SetType; label: string }[] = [
    { value: "normal", label: "通常" },
    { value: "top_single", label: "トップS" },
    { value: "backoff", label: "バックオフ" },
    { value: "amrap", label: "AMRAP" },
    { value: "drop", label: "ドロップ" },
    { value: "superset_A", label: "スーパーA" },
    { value: "superset_B", label: "スーパーB" },
  ];

  const parsedLoadKg = loadKg ? parseFloat(loadKg) : null;
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
  const manualPhase = useMemo(() => getPhaseForBlockWeek(blockWeek), [blockWeek]);
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
    if (!parsedLoadKg || !parsedReps) return null;
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
      avg_hr: currentHeartRate ?? undefined,
      peak_hr: currentHeartRate ?? undefined,
      notes: notes || undefined,
    };
  }, [
    currentHeartRate,
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

  const latestManualConsultationSet = draftSet ?? savedSets[savedSets.length - 1] ?? null;
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
      ...savedSets.filter((set) => set.lift === latestManualConsultationSet.lift),
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
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      })
      .slice(-12);
    const sessionContextRows =
      sessionContextSets
        .map(
          (set) =>
            `| ${set.set_index} | ${set.lift} | ${getSetTypeLabel(set.set_type)} | ${formatNumber(set.load_kg, 1)} | ${set.reps} | ${formatNumber(set.rpe, 1)} | ${formatNumber(set.avg_velocity, 2)} | ${formatNumber(set.velocity_loss_last ?? set.velocity_loss, 1, "%")} | ${formatNumber(set.avg_rom_cm, 1, "cm")} | ${formatNumber(set.rest_duration_s, 0, "s")} | ${formatNumber(set.avg_hr, 0, "bpm")} | ${set.notes ?? ""} |`,
        )
        .join("\n") || "| - | - | - | - | - | - | - | - | - | - | - | - |";
    const supersetRounds = sessionContextSets.reduce<
      Record<string, { lift: string; type: SetType; load: number; reps: number }[]>
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
            `| ${new Date(set.timestamp).toLocaleString("ja-JP")} | ${set.load_kg} | ${set.reps} | ${formatNumber(set.avg_velocity, 2)} | ${formatNumber(set.velocity_loss_last ?? set.velocity_loss, 1, "%")} | ${formatNumber(set.avg_rom_cm, 1, "cm")} | ${formatNumber(set.rpe, 1)} |`,
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
      "# チャッピー監督 手動入力相談パケット",
      `出力日時: ${new Date().toLocaleString("ja-JP")}`,
      `状態: ${currentSetSource}`,
      `種目: ${latestManualConsultationSet.lift}`,
      `カテゴリ: ${
        selectedExercise
          ? getExerciseCategoryLabel(selectedExercise.category)
          : "-"
      }`,
      `セット: ${latestManualConsultationSet.set_index}`,
      `負荷/回数: ${formatNumber(latestManualConsultationSet.load_kg, 1, "kg")} x ${latestManualConsultationSet.reps}`,
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
      openResult === "none" ? "コピーしました" : "コピーしてChatGPTを開きました",
      openResult === "none"
        ? "チャッピー監督用パケットをコピーしました。"
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
    Chinning: [0, 10, 20, 30, 40],
    Dips: [0, 10, 20, 30, 40],
  };

  const currentPresets =
    exercisePresets[lift] || exercisePresets["Bench Press"];

  // 重量調整関数
  const adjustLoad = (amount: number) => {
    const current = parsedLoadKg || 0;
    const newLoad = Math.max(0, current + amount);
    setLoadKg(newLoad % 1 === 0 ? newLoad.toString() : newLoad.toFixed(1));
  };

  // プリセット選択
  const selectPreset = (weight: number) => {
    setLoadKg(weight.toString());
  };

  // 直近の同種目の重量をQuick選択
  const selectRecentWeight = (weight: number) => {
    setLoadKg(weight.toString());
  };

  const applyActiveExercise = (exercise: Exercise) => {
    setLift(exercise.name);
    setSelectedExercise(exercise);
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
      const authorized = await HealthService.authorize();
      if (cancelled) return;

      if (!authorized) {
        setHeartRateStatus("unavailable");
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
    setLoadKg(set.load_kg % 1 === 0 ? set.load_kg.toString() : set.load_kg.toFixed(1));
    setReps(set.reps.toString());
    if (set.rpe != null) setRpe(set.rpe.toString());
    if (set.avg_velocity != null) setAvgVelocity(set.avg_velocity.toFixed(2));
    if (set.velocity_loss != null) setVelocityLoss(set.velocity_loss.toFixed(1));
    if (set.avg_rom_cm != null) setRomCm(set.avg_rom_cm.toFixed(1));
    setSaveStatus(`${formatRelativeTime(set.timestamp)} の ${set.load_kg}kg × ${set.reps} を反映`);
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

    if (isNaN(loadValue) || loadValue <= 0) {
      Alert.alert("エラー", "有効な負荷を入力してください");
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
      (isNaN(parsedAvgVelocity) || parsedAvgVelocity <= 0 || parsedAvgVelocity > 3)
    ) {
      Alert.alert("エラー", "Average Velocityは0〜3.0 m/sの範囲で入力してください");
      return;
    }

    if (
      parsedVelocityLoss != null &&
      (isNaN(parsedVelocityLoss) || parsedVelocityLoss < 0 || parsedVelocityLoss > 80)
    ) {
      Alert.alert("エラー", "Velocity Lossは0〜80%の範囲で入力してください");
      return;
    }

    if (parsedRomCm != null && (isNaN(parsedRomCm) || parsedRomCm <= 0 || parsedRomCm > 200)) {
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
          : Math.max(0, Math.round((completedAt.getTime() - lastSavedAt) / 1000));

      const e1rm = VBTCalculations.estimate1RMFromReps(
        loadValue,
        repsValue,
        rpeValue,
      );

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
        e1rm,
        timestamp: completedAt.toISOString(),
        end_timestamp: completedAt.toISOString(),
        rest_duration_s: restDurationS,
        avg_hr: currentHeartRate ?? undefined,
        peak_hr: currentHeartRate ?? undefined,
        notes: notes || undefined,
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

    Alert.alert("セッション完了", `${savedSets.length}セットを記録しました`, [
      {
        text: "OK",
        onPress: () => navigation.navigate("Home"),
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButton}>← 戻る</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.title}>手動入力</Text>
          <Text style={styles.subtitle}>
            {lift} / セット {setIndex}
          </Text>
        </View>
      </View>

      <View style={styles.form}>
        <View style={styles.todaySummaryCard}>
          <View style={styles.todaySummaryHeader}>
            <Text style={styles.todaySummaryEyebrow}>TODAY / MANUAL LOG</Text>
            <Text style={styles.todaySummaryLift} numberOfLines={1}>
              {lift}
            </Text>
          </View>
          <View style={styles.todaySummaryGrid}>
            <View style={styles.todaySummaryMetric}>
              <Text style={styles.todaySummaryValue}>
                {sessionSummary.savedSetCount}
              </Text>
              <Text style={styles.todaySummaryLabel}>セット</Text>
            </View>
            <View style={styles.todaySummaryMetric}>
              <Text style={styles.todaySummaryValue}>
                {sessionSummary.totalReps}
              </Text>
              <Text style={styles.todaySummaryLabel}>レップ</Text>
            </View>
            <View style={styles.todaySummaryMetric}>
              <Text style={styles.todaySummaryValue}>
                {Math.round(sessionSummary.totalVolume).toLocaleString()}
              </Text>
              <Text style={styles.todaySummaryLabel}>kg</Text>
            </View>
            <View style={styles.todaySummaryMetric}>
              <Text style={styles.todaySummaryValue}>{setIndex}</Text>
              <Text style={styles.todaySummaryLabel}>次セット</Text>
            </View>
          </View>
        </View>

        <View style={styles.manualMonitorCard}>
          <View style={styles.manualMonitorHeader}>
            <Text style={styles.manualMonitorEyebrow}>LIVE MANUAL MONITOR</Text>
            <Text style={styles.manualMonitorStatus}>
              {heartRateStatus === "active"
                ? "心拍取得中"
                : heartRateStatus === "checking"
                  ? "確認中"
                  : "心拍未取得"}
            </Text>
          </View>
          <View style={styles.manualMonitorGrid}>
            <View style={styles.manualMonitorMetric}>
              <Text style={styles.manualMonitorValue}>
                {formatElapsedTime(manualElapsedSeconds)}
              </Text>
              <Text style={styles.manualMonitorLabel}>入力経過</Text>
            </View>
            <View style={styles.manualMonitorMetric}>
              <Text style={styles.manualMonitorValue}>
                {restElapsedSeconds == null
                  ? "--:--"
                  : formatElapsedTime(restElapsedSeconds)}
              </Text>
              <Text style={styles.manualMonitorLabel}>レスト</Text>
            </View>
            <View style={styles.manualMonitorMetric}>
              <Text style={styles.manualMonitorValue}>
                {currentHeartRate == null ? "--" : Math.round(currentHeartRate)}
              </Text>
              <Text style={styles.manualMonitorLabel}>bpm</Text>
            </View>
          </View>
          <Text style={styles.manualMonitorHint}>
            セット保存後にレストを自動開始。保存時の心拍と休憩秒数も記録します。
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.coachButton,
            !latestManualConsultationSet && styles.coachButtonDisabled,
          ]}
          onPress={() => void handleCopyManualSupervisorPacket()}
          disabled={!latestManualConsultationSet}
        >
          <Text style={styles.coachButtonText}>チャッピー監督へ相談</Text>
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
                <Text style={styles.accessoryTargetLabel}>今回e1RM</Text>
                <Text style={styles.accessoryTargetValue}>
                  {formatNumber(accessoryRMTarget.currentE1RMKg, 1, "kg")}
                </Text>
              </View>
              <View style={styles.accessoryTargetMetric}>
                <Text style={styles.accessoryTargetLabel}>過去Best</Text>
                <Text style={styles.accessoryTargetValue}>
                  {formatNumber(accessoryRMTarget.previousBestE1RMKg, 1, "kg")}
                </Text>
              </View>
              <View style={styles.accessoryTargetMetric}>
                <Text style={styles.accessoryTargetLabel}>目標e1RM</Text>
                <Text style={styles.accessoryTargetValue}>
                  {formatNumber(accessoryRMTarget.targetE1RMKg, 1, "kg")}
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
                  <Text style={styles.accessoryTargetRep}>{row.reps}rep</Text>
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

        <Text style={styles.label}>種目</Text>
        <TouchableOpacity
          style={styles.exerciseSelectorCard}
          onPress={() =>
            openExerciseSelector(
              isSuperset ? (setType === "superset_A" ? "A" : "B") : "active",
            )
          }
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

        {isSuperset ? (
          <View style={styles.supersetCard}>
            <View style={styles.supersetHeader}>
              <Text style={styles.supersetTitle}>スーパーセット種目</Text>
              <Text style={styles.supersetMeta}>
                A/Bを交互に保存します
              </Text>
            </View>
            <View style={styles.supersetPairRow}>
              <TouchableOpacity
                style={[
                  styles.supersetExerciseCard,
                  setType === "superset_A" && styles.supersetExerciseActive,
                ]}
                onPress={() => openExerciseSelector("A")}
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
                    {formatRelativeTime(set.timestamp)} / {formatSessionLabel(set.session_id)}
                  </Text>
                  <Text style={styles.recentItemMain}>
                    {set.load_kg} kg x {set.reps} reps
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
                    {set.e1rm ? `e1RM ${set.e1rm.toFixed(1)}` : set.set_type}
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
              <Text style={styles.vbtGuideTitle}>{setTypeGuidance.title}</Text>
            </View>
            <Text style={styles.vbtGuidePhase}>W{blockWeek}</Text>
          </View>
          <Text style={styles.vbtGuideBody}>{setTypeGuidance.body}</Text>
          <View style={styles.vbtGuideGrid}>
            <View style={styles.vbtGuideMetric}>
              <Text style={styles.vbtGuideLabel}>Top Single</Text>
              <Text style={styles.vbtGuideValue}>{topSingleTargetText}</Text>
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

        <Text style={styles.label}>セットタイプ</Text>
        <View style={styles.setTypeContainer}>
          {setTypes.map((type) => (
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
                  setType === type.value && styles.setTypeButtonTextActive,
                ]}
              >
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>負荷 (kg)</Text>
        <View style={styles.weightInputContainer}>
          <TouchableOpacity
            style={styles.adjustButton}
            onPress={() => adjustLoad(-0.5)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
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
            placeholder="例: 80.0"
            placeholderTextColor="#666"
          />

          <TouchableOpacity
            style={styles.adjustButton}
            onPress={() => adjustLoad(0.5)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.adjustButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        {currentPresets.length > 0 && (
          <>
            <Text style={styles.label}>プリセット重量 ({lift})</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.presetScrollView}
            >
              <View style={styles.presetContainer}>
                {currentPresets.map((weight) => (
                  <TouchableOpacity
                    key={weight}
                    style={[
                      styles.presetButton,
                      parsedLoadKg === weight && styles.presetButtonActive,
                    ]}
                    onPress={() => selectPreset(weight)}
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
              </View>
            </ScrollView>
          </>
        )}

        {recentSetsForDisplay.length > 0 && (
          <>
            <Text style={styles.label}>直近の重量から選択</Text>
            <View style={styles.recentWeightContainer}>
              {recentSetsForDisplay.slice(0, 3).map((set) => (
                <TouchableOpacity
                  key={`${set.session_id}_${set.set_index}`}
                  style={[
                    styles.recentWeightButton,
                    parsedLoadKg === set.load_kg &&
                      styles.recentWeightButtonActive,
                  ]}
                  onPress={() => selectRecentWeight(set.load_kg)}
                >
                  <Text
                    style={[
                      styles.recentWeightButtonText,
                      parsedLoadKg === set.load_kg &&
                        styles.recentWeightButtonTextActive,
                    ]}
                  >
                    {set.load_kg}kg
                  </Text>
                  <Text style={styles.recentWeightButtonSub}>×{set.reps}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <Text style={styles.label}>レップ数</Text>
        <TextInput
          style={styles.input}
          value={reps}
          onChangeText={setReps}
          keyboardType="number-pad"
          returnKeyType="next"
          selectTextOnFocus
          placeholder="例: 10"
          placeholderTextColor="#666"
        />

        <Text style={styles.label}>RPE (1-10, オプション)</Text>
        <TextInput
          style={styles.input}
          value={rpe}
          onChangeText={setRpe}
          keyboardType="decimal-pad"
          returnKeyType="done"
          selectTextOnFocus
          placeholder="任意: 8.5"
          placeholderTextColor="#666"
        />

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
              <Text style={styles.manualVbtLabel}>Average Velocity</Text>
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
        />

        <TouchableOpacity style={styles.saveButton} onPress={handleSaveSet}>
          <Text style={styles.saveButtonText}>セットを保存</Text>
        </TouchableOpacity>
        {saveStatus ? (
          <Text accessibilityLiveRegion="polite" style={styles.saveStatusText}>
            {saveStatus}
          </Text>
        ) : null}

        <TouchableOpacity
          style={[
            styles.finishButton,
            savedSets.length === 0 && styles.buttonDisabled,
          ]}
          onPress={handleFinishSession}
          disabled={savedSets.length === 0}
        >
          <Text style={styles.finishButtonText}>セッション完了</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>保存済みセット</Text>
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
            {savedSets.map((set) => (
              <View
                key={`${set.session_id}_${set.set_index}_${set.lift}`}
                style={styles.summaryItem}
              >
                <View>
                  <Text style={styles.summaryText}>
                    {set.lift} / セット {set.set_index}
                  </Text>
                  <Text style={styles.summaryMeta}>
                    {getSetTypeLabel(set.set_type)} / {set.load_kg} kg ×{" "}
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
          </>
        )}
      </View>

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
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GarageTheme.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    color: GarageTheme.accent,
    fontSize: 16,
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
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
  coachButton: {
    backgroundColor: "#1f1512",
    borderRadius: 12,
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
  todaySummaryCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#151515",
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    marginBottom: 14,
  },
  todaySummaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  todaySummaryEyebrow: {
    color: GarageTheme.accentSoft,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0,
  },
  todaySummaryLift: {
    flex: 1,
    color: GarageTheme.textStrong,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
  },
  todaySummaryGrid: {
    flexDirection: "row",
    gap: 8,
  },
  todaySummaryMetric: {
    flex: 1,
    minHeight: 64,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#202020",
    borderWidth: 1,
    borderColor: "#303030",
    justifyContent: "center",
  },
  todaySummaryValue: {
    color: "#f7f8f8",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 3,
  },
  todaySummaryLabel: {
    color: GarageTheme.textMuted,
    fontSize: 10,
    fontWeight: "600",
  },
  manualMonitorCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#101827",
    borderWidth: 1,
    borderColor: "#243654",
    marginBottom: 12,
  },
  manualMonitorHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  manualMonitorEyebrow: {
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0,
  },
  manualMonitorStatus: {
    color: "#dbeafe",
    fontSize: 11,
    fontWeight: "600",
  },
  manualMonitorGrid: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  manualMonitorMetric: {
    flex: 1,
    minHeight: 64,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#172033",
    borderWidth: 1,
    borderColor: "#263852",
    justifyContent: "center",
  },
  manualMonitorValue: {
    color: "#f8fafc",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 3,
  },
  manualMonitorLabel: {
    color: "#93a4bc",
    fontSize: 10,
    fontWeight: "600",
  },
  manualMonitorHint: {
    color: "#aabbd1",
    fontSize: 12,
    lineHeight: 17,
  },
  recentCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
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
    borderRadius: 999,
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
    borderRadius: 999,
    backgroundColor: "#2c2117",
    borderWidth: 1,
    borderColor: "#5a3b1b",
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
    color: GarageTheme.textStrong,
    marginTop: 16,
    marginBottom: 8,
  },
  exerciseSelectorCard: {
    backgroundColor: GarageTheme.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
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
  supersetCard: {
    marginTop: 8,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
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
    gap: 10,
  },
  supersetExerciseCard: {
    flex: 1,
    minHeight: 92,
    padding: 12,
    borderRadius: 12,
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
    borderRadius: 12,
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
    borderRadius: 999,
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
    borderRadius: 10,
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
    borderRadius: 10,
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
    borderRadius: 12,
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
    borderRadius: 999,
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
    borderRadius: 10,
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
    borderRadius: 12,
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
    gap: 8,
  },
  manualVbtInputWrap: {
    flex: 1,
    minWidth: 0,
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
    borderRadius: 10,
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
  setTypeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  setTypeButton: {
    backgroundColor: "#2a2a2a",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
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
    padding: 12,
    borderRadius: 8,
    fontSize: 16,
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
    borderRadius: 12,
    alignItems: "center",
    marginTop: 24,
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
    marginTop: 8,
    textAlign: "center",
  },
  finishButton: {
    backgroundColor: "#2196F3",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 12,
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
  summaryContainer: {
    margin: 16,
    marginTop: 0,
    padding: 16,
    backgroundColor: "#2a2a2a",
    borderRadius: 12,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "bold",
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
    alignItems: "center",
    padding: 12,
    backgroundColor: "#1a1a1a",
    borderRadius: 8,
    marginBottom: 8,
    gap: 12,
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
  weightInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
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
  presetScrollView: {
    marginBottom: 8,
  },
  presetContainer: {
    flexDirection: "row",
    gap: 8,
  },
  presetButton: {
    backgroundColor: "#2a2a2a",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#444",
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
  recentWeightContainer: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  recentWeightButton: {
    backgroundColor: "#2a2a2a",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#444",
    alignItems: "center",
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
    fontSize: 12,
  },
});

export default ManualEntryScreen;
