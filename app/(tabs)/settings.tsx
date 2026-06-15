import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  EXERCISE_EDIT_GROUPS,
  EXERCISE_CATEGORY_LABELS,
  EXERCISE_SELECTION_GROUPS,
  formatLoadKg,
  getDefaultCategoryForSelectionGroup,
  getExerciseCategoryLabel,
  getExerciseSelectionGroup,
  getPrimarySelectionGroupForCategory,
  inferExercisePreset,
  matchesExerciseSelectionGroup,
  type ExerciseSelectionGroupId,
} from "@/src/constants/exerciseCatalog";
import { GarageTheme } from "@/src/constants/garageTheme";
import ExerciseService from "@/src/services/ExerciseService";
import {
  DEFAULT_APP_SETTINGS,
  loadAppSettings,
  saveAppSettings,
} from "@/src/services/AppSettingsService";
import CrashReportService from "@/src/services/CrashReportService";
import { useTrainingStore } from "@/src/store/trainingStore";
import { HelpButton } from "@/src/components/HelpButton";
import {
  POWERLIFTING_PHASES,
  getBlockWeekPlan,
  getPhaseForBlockWeek,
} from "@/src/utils/PowerliftingVBTProtocol";
import type { AppSettings, Exercise } from "@/src/types/index";

const defaultSettings: AppSettings = DEFAULT_APP_SETTINGS;

const OVR_SAMPLE_EXERCISE_NAMES = [
  "Larsen Bench Press",
  "Sumo Deadlift",
  "Adductor DELTA new",
  "Shoulder Press",
  "bench press",
  "Dips",
  "Leg Extension DELTA",
  "Leg Curl Delta",
  "chinning",
  "Larsen Bottom Pulse Bench",
  "Adductor-Focused Wide Dea",
  "Cable Press Down",
  "Cable Face Pull",
  "Cable Upright Row",
  "SSB Adductor  Squat",
  "Seal Row",
  "Larsen 4/2/0 tempo bench",
  "Landmune shoulder press",
  "SBB Support Squat",
] as const;

const MODE_LABELS: Record<
  NonNullable<Exercise["rep_detection_mode"]>,
  string
> = {
  standard: "標準",
  tempo: "テンポ",
  pause: "ポーズ",
  short_rom: "短ROM",
};

const DEFAULT_WEEK_BY_PHASE: Record<
  AppSettings["target_training_phase"],
  number
> = {
  hypertrophy: 1,
  strength: 5,
  peaking: 9,
  power: 5,
};

const getSelectionGroupLabel = (groupId: ExerciseSelectionGroupId) =>
  EXERCISE_SELECTION_GROUPS.find((group) => group.id === groupId)?.label ??
  groupId;

type SettingsSectionId =
  | "training"
  | "session"
  | "display"
  | "focus"
  | "audio"
  | "share"
  | "exercises";

type BooleanSettingKey = {
  [K in keyof AppSettings]: AppSettings[K] extends boolean ? K : never;
}[keyof AppSettings];

const SETTINGS_SECTIONS: {
  id: SettingsSectionId;
  label: string;
  description: string;
}[] = [
  {
    id: "training",
    label: "トレーニング",
    description: "単位 / VBT / ブロック",
  },
  { id: "session", label: "セッション", description: "自動開始 / 軽量化" },
  { id: "display", label: "表示項目", description: "通常画面の表示ON/OFF" },
  { id: "focus", label: "計測中表示", description: "フォーカス画面の項目" },
  { id: "audio", label: "音声", description: "読み上げ / 音量" },
  { id: "share", label: "共有", description: "Mac Live Share" },
  { id: "exercises", label: "種目", description: "カテゴリ / マスタ" },
];

const SESSION_DISPLAY_TOGGLES: {
  key: BooleanSettingKey;
  label: string;
  meta: string;
}[] = [
  {
    key: "session_display_advice_group",
    label: "アドバイス系まとめ",
    meta: "プロトコル/提案/判定/AI助言を一括表示",
  },
  {
    key: "session_display_status",
    label: "接続状態",
    meta: "センサー接続と心拍バッジ",
  },
  {
    key: "session_display_simulator",
    label: "VBT SIM",
    meta: "シミュレーター操作",
  },
  {
    key: "session_display_exercise_picker",
    label: "種目選択",
    meta: "Exerciseカード",
  },
  {
    key: "session_display_vl_settings",
    label: "VL閾値",
    meta: "種目別VLクイック設定",
  },
  {
    key: "session_display_protocol",
    label: "PL VBTプロトコル",
    meta: "トップシングル/バックオフ案内",
  },
  {
    key: "session_display_lvp_build",
    label: "LVP BUILD",
    meta: "Big3のLVP作成案内",
  },
  {
    key: "session_display_training_notes",
    label: "種目ノート",
    meta: "キューとフォーカスノート",
  },
  {
    key: "session_display_session_note",
    label: "今日のメモ",
    meta: "セッションメモ入力",
  },
  {
    key: "session_display_session_banner",
    label: "開始/記録バナー",
    meta: "開始・一時停止の大きい表示",
  },
  {
    key: "session_display_intelligence",
    label: "CNS / e1RM",
    meta: "状態サマリー",
  },
  {
    key: "session_display_attempt_guide",
    label: "試技ガイド",
    meta: "e1RMからの第1-第3案",
  },
  {
    key: "session_display_suggestions",
    label: "提案バナー",
    meta: "重量提案とMVT提案",
  },
  {
    key: "session_display_rest_timer",
    label: "レストタイマー",
    meta: "休憩中の次セット開始",
  },
  {
    key: "session_display_target_weight",
    label: "目標重量",
    meta: "Big3トップセット入力",
  },
  {
    key: "session_display_warmup_guide",
    label: "ウォームアップ",
    meta: "目標重量からのステップ",
  },
  {
    key: "session_display_readiness",
    label: "当日状態判定",
    meta: "同程度重量との比較",
  },
  {
    key: "session_display_set_config",
    label: "セット設定",
    meta: "重量入力と微調整",
  },
  {
    key: "session_display_live_data",
    label: "Live Data",
    meta: "速度・パワー・ROM",
  },
  {
    key: "session_display_velocity_chart",
    label: "速度グラフ",
    meta: "現在セットのレップ推移",
  },
  {
    key: "session_display_vl_decision",
    label: "VL判定",
    meta: "セット継続/終了判断",
  },
  {
    key: "session_display_action_buttons",
    label: "操作ボタン",
    meta: "ウォームアップ/SET COMPLETE",
  },
  {
    key: "session_display_same_load_history",
    label: "同重量履歴",
    meta: "直近同重量の比較",
  },
  {
    key: "session_display_recent_history",
    label: "種目履歴",
    meta: "最近の同種目セット",
  },
  {
    key: "session_display_session_history",
    label: "セッション履歴",
    meta: "完了セットカード一覧",
  },
  {
    key: "session_display_end_session",
    label: "終了ボタン",
    meta: "SESSION ENDボタン",
  },
];

const FOCUS_DISPLAY_TOGGLES: {
  key: BooleanSettingKey;
  label: string;
  meta: string;
}[] = [
  {
    key: "session_display_focus_simulator",
    label: "VBT SIM",
    meta: "計測中のシミュレーター操作",
  },
  {
    key: "session_display_focus_info_grid",
    label: "情報グリッド",
    meta: "種目 / 重量 / パワー",
  },
  {
    key: "session_display_focus_velocity",
    label: "速度メイン",
    meta: "中央の大きいm/s表示",
  },
  {
    key: "session_display_focus_metrics",
    label: "補助メトリクス",
    meta: "AVG V / ROM / PEAK P",
  },
  {
    key: "session_display_focus_rep_counter",
    label: "レップ数",
    meta: "REPSカウンター",
  },
  {
    key: "session_display_focus_zone",
    label: "ゾーン",
    meta: "速度ゾーンバッジ",
  },
  {
    key: "session_display_focus_vl",
    label: "VLボックス",
    meta: "Velocity Loss警告",
  },
  { key: "session_display_focus_heart_rate", label: "心拍", meta: "bpm表示" },
  { key: "session_display_focus_load", label: "重量", meta: "右下のkg表示" },
];

export default function SettingsTab() {
  const insets = useSafeAreaInsets();
  const updateGlobalSettings = useTrainingStore(
    (state) => state.updateSettings,
  );
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [activeSection, setActiveSection] =
    useState<SettingsSectionId>("training");
  const [exerciseMaster, setExerciseMaster] = useState<Exercise[]>([]);
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState("");
  const [exerciseGroup, setExerciseGroup] =
    useState<ExerciseSelectionGroupId>("all");
  const [loadingExerciseMaster, setLoadingExerciseMaster] = useState(false);
  const [syncingExerciseMaster, setSyncingExerciseMaster] = useState(false);
  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(
    null,
  );
  const [editingExerciseName, setEditingExerciseName] = useState("");
  const [editingExerciseCategory, setEditingExerciseCategory] =
    useState<Exercise["category"]>("accessory");
  const [editingExerciseAutoStartRom, setEditingExerciseAutoStartRom] =
    useState<number | null>(null);
  const [editingTrainingCue, setEditingTrainingCue] = useState("");
  const [editingFocusNote, setEditingFocusNote] = useState("");
  const [newExerciseName, setNewExerciseName] = useState("");
  const [newExerciseCategory, setNewExerciseCategory] =
    useState<Exercise["category"]>("accessory");
  const [newExerciseDescription, setNewExerciseDescription] = useState("");
  const [driveCrashQueueCount, setDriveCrashQueueCount] = useState(0);
  const blockWeekPlan = useMemo(
    () => getBlockWeekPlan(settings.powerlifting_block_week, "squat"),
    [settings.powerlifting_block_week],
  );

  useEffect(() => {
    void loadSettings();
    void loadExerciseMaster();
    // Settings bootstrap is intentionally run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSettings = async () => {
    try {
      const loaded = await loadAppSettings();
      setSettings(loaded);
      updateGlobalSettings(loaded);
      await refreshDriveCrashQueueCount();
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  };

  const saveSettings = async (nextSettings: AppSettings) => {
    try {
      const saved = await saveAppSettings(nextSettings);
      setSettings(saved);
      updateGlobalSettings(saved);
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  };

  const refreshDriveCrashQueueCount = async () => {
    const queue = await CrashReportService.getDriveCrashReportQueue();
    setDriveCrashQueueCount(queue.length);
  };

  const handleFlushDriveCrashReports = async () => {
    try {
      const result =
        await CrashReportService.submitLastVBTScreenContextToGoogleDrive(
          settings,
          undefined,
          { force: true },
        );
      await refreshDriveCrashQueueCount();

      if (result.status === "disabled") {
        Alert.alert("Drive診断OFF", "Google Drive診断送信をONにしてください。");
        return;
      }
      if (result.status === "missing_url") {
        Alert.alert(
          "URL未設定",
          "Google Apps Script Web App URLを入力してください。",
        );
        return;
      }

      Alert.alert(
        result.failed > 0 ? "Drive送信をキュー保存しました" : "Drive送信完了",
        `送信: ${result.uploaded} / 失敗: ${result.failed} / キュー: ${result.queued}${
          result.last_error ? `\n${result.last_error}` : ""
        }`,
      );
    } catch (error) {
      console.error("Failed to flush drive crash reports:", error);
      Alert.alert("Drive送信失敗", "診断レポート送信に失敗しました。");
    }
  };

  const handleAddExercise = async () => {
    const name = newExerciseName.trim();
    if (!name) {
      Alert.alert("種目名が必要です", "追加する種目名を入力してください。");
      return;
    }

    const exists = exerciseMaster.some(
      (exercise) => exercise.name.toLowerCase() === name.toLowerCase(),
    );
    if (exists) {
      Alert.alert("重複しています", `${name} はすでに登録されています。`);
      return;
    }

    try {
      const preset = inferExercisePreset(name, newExerciseCategory);
      await ExerciseService.addExercise({
        name,
        category:
          (preset.category as Exercise["category"] | undefined) ??
          newExerciseCategory,
        subcategory: preset.subcategory,
        has_lvp: preset.has_lvp ?? false,
        machine_weight_steps: preset.machine_weight_steps,
        min_rom_threshold: preset.min_rom_threshold,
        rep_detection_mode: preset.rep_detection_mode,
        target_pause_ms: preset.target_pause_ms,
        rom_range_min_cm: preset.rom_range_min_cm,
        rom_range_max_cm: preset.rom_range_max_cm,
        description:
          newExerciseDescription.trim() || preset.description || undefined,
        mvt: preset.mvt,
        ignore_first_rep_as_setup: preset.ignore_first_rep_as_setup ?? false,
        auto_start_rom_cm: preset.auto_start_rom_cm,
      });
      setNewExerciseName("");
      setNewExerciseDescription("");
      await loadExerciseMaster();
      Alert.alert("追加完了", `${name} を種目マスタに追加しました。`);
    } catch (error) {
      console.error("Failed to add exercise:", error);
      Alert.alert("追加失敗", "種目の追加に失敗しました。");
    }
  };

  const handleSelectNewExerciseGroup = (groupId: ExerciseSelectionGroupId) => {
    if (groupId === "all") return;
    setNewExerciseCategory(getDefaultCategoryForSelectionGroup(groupId));
  };

  const handleSelectEditingExerciseGroup = (
    groupId: ExerciseSelectionGroupId,
  ) => {
    if (groupId === "all") return;
    setEditingExerciseCategory(getDefaultCategoryForSelectionGroup(groupId));
  };

  const loadExerciseMaster = async (force: boolean = false) => {
    setLoadingExerciseMaster(true);
    try {
      await ExerciseService.initialize(force);
      const exercises = await ExerciseService.getAllExercises();
      setExerciseMaster(exercises);
    } catch (error) {
      console.error("Failed to load exercise master:", error);
      Alert.alert("エラー", "種目マスタの読み込みに失敗しました。");
    } finally {
      setLoadingExerciseMaster(false);
    }
  };

  const handleSyncExerciseMaster = async () => {
    setSyncingExerciseMaster(true);
    try {
      await loadExerciseMaster(true);
      Alert.alert("同期完了", "種目マスタを最新の既定構成に同期しました。");
    } catch (error) {
      console.error("Failed to sync exercise master:", error);
      Alert.alert("エラー", "種目マスタの同期に失敗しました。");
    } finally {
      setSyncingExerciseMaster(false);
    }
  };

  const handleDeleteExercise = async (
    exerciseId: string,
    exerciseName: string,
  ) => {
    Alert.alert(
      "種目を削除",
      `${exerciseName} を削除しますか？この操作は取り消せません。`,
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除",
          style: "destructive",
          onPress: async () => {
            try {
              await ExerciseService.deleteExercise(exerciseId);
              await loadExerciseMaster();
              Alert.alert("削除完了", `${exerciseName} を削除しました`);
            } catch (error) {
              console.error("Failed to delete exercise:", error);
              Alert.alert("エラー", "種目の削除に失敗しました");
            }
          },
        },
      ],
    );
  };

  const handleEditExercise = (exerciseId: string) => {
    const exercise = exerciseMaster.find((e) => e.id === exerciseId);
    if (!exercise) return;

    if (editingExerciseId === exerciseId) {
      // Cancel editing
      setEditingExerciseId(null);
      setEditingExerciseName("");
      setEditingExerciseCategory("accessory");
      setEditingExerciseAutoStartRom(null);
      setEditingTrainingCue("");
      setEditingFocusNote("");
    } else {
      // Start editing
      setEditingExerciseId(exerciseId);
      setEditingExerciseName(exercise.name);
      setEditingExerciseCategory(exercise.category);
      setEditingExerciseAutoStartRom(exercise.auto_start_rom_cm ?? null);
      setEditingTrainingCue(exercise.training_cue ?? "");
      setEditingFocusNote(exercise.focus_note ?? "");
    }
  };

  const handleSaveExerciseEdits = async (exerciseId: string) => {
    try {
      const updates: Partial<Exercise> = {};
      const exercise = exerciseMaster.find((e) => e.id === exerciseId);
      if (!exercise) return;

      if (editingExerciseName.trim() && editingExerciseName !== exercise.name) {
        updates.name = editingExerciseName.trim();
      }
      if (editingExerciseCategory !== exercise.category) {
        updates.category = editingExerciseCategory;
      }
      if (editingExerciseAutoStartRom !== exercise.auto_start_rom_cm) {
        updates.auto_start_rom_cm = editingExerciseAutoStartRom ?? undefined;
      }
      if (editingTrainingCue !== exercise.training_cue) {
        updates.training_cue = editingTrainingCue || undefined;
      }
      if (editingFocusNote !== exercise.focus_note) {
        updates.focus_note = editingFocusNote || undefined;
      }

      if (Object.keys(updates).length > 0) {
        await ExerciseService.updateExercise(exerciseId, updates);
        await loadExerciseMaster();
      }

      // Exit editing mode
      setEditingExerciseId(null);
      setEditingExerciseName("");
      setEditingExerciseCategory("accessory");
      setEditingExerciseAutoStartRom(null);
      setEditingTrainingCue("");
      setEditingFocusNote("");
    } catch (error) {
      console.error("Failed to save exercise edits:", error);
      Alert.alert("エラー", "種目情報の更新に失敗しました");
    }
  };

  const filteredExercises = useMemo(
    () =>
      exerciseMaster.filter((exercise) => {
        const query = exerciseSearchQuery.trim().toLowerCase();
        const matchesGroup = matchesExerciseSelectionGroup(
          exercise,
          exerciseGroup,
        );
        const haystack = [
          exercise.name,
          getExerciseCategoryLabel(exercise.category),
          exercise.description ?? "",
        ]
          .join(" ")
          .toLowerCase();
        const matchesSearch = !query || haystack.includes(query);
        return matchesGroup && matchesSearch;
      }),
    [exerciseGroup, exerciseMaster, exerciseSearchQuery],
  );

  const groupedExercises = useMemo(() => {
    const groups = new Map<string, Exercise[]>();
    for (const exercise of filteredExercises) {
      const groupId =
        exerciseGroup === "all"
          ? getExerciseSelectionGroup(exercise)
          : exerciseGroup;
      if (!groups.has(groupId)) {
        groups.set(groupId, []);
      }
      groups.get(groupId)?.push(exercise);
    }
    return Array.from(groups.entries());
  }, [exerciseGroup, filteredExercises]);

  const lvpExerciseCount = useMemo(
    () => exerciseMaster.filter((exercise) => exercise.has_lvp).length,
    [exerciseMaster],
  );

  const ovrSampleCoverageCount = useMemo(() => {
    const exerciseIds = new Set(exerciseMaster.map((exercise) => exercise.id));
    return OVR_SAMPLE_EXERCISE_NAMES.filter((name) => {
      const preset = inferExercisePreset(name);
      return preset.id ? exerciseIds.has(preset.id) : false;
    }).length;
  }, [exerciseMaster]);

  const renderSettingSwitch = (
    key: BooleanSettingKey,
    label: string,
    meta: string,
  ) => (
    <View key={key} style={styles.toggleRow}>
      <View style={styles.toggleCopy}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleMeta}>{meta}</Text>
      </View>
      <Switch
        value={Boolean(settings[key])}
        onValueChange={(value) =>
          void saveSettings({ ...settings, [key]: value })
        }
        trackColor={{ false: "#3b2b28", true: GarageTheme.accent }}
      />
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16 }]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>SYSTEM / SETTINGS</Text>
          <Text style={styles.title}>設定</Text>
          <Text style={styles.subtitle}>
            メニューからカテゴリを選んで、必要な項目だけ調整します。
          </Text>
        </View>
        <HelpButton />
      </View>

      <View style={styles.sectionMenu}>
        {SETTINGS_SECTIONS.map((section) => {
          const active = activeSection === section.id;
          return (
            <TouchableOpacity
              key={section.id}
              style={[
                styles.sectionMenuCard,
                active && styles.sectionMenuCardActive,
              ]}
              onPress={() => setActiveSection(section.id)}
            >
              <Text
                style={[
                  styles.sectionMenuLabel,
                  active && styles.sectionMenuLabelActive,
                ]}
              >
                {section.label}
              </Text>
              <Text style={styles.sectionMenuMeta}>{section.description}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {activeSection === "training" && (
        <View style={styles.card}>
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleLabel}>メートル法</Text>
              <Text style={styles.toggleMeta}>kg / m/s を使用</Text>
            </View>
            <Switch
              value={settings.use_metric}
              onValueChange={(value) =>
                void saveSettings({ ...settings, use_metric: value })
              }
              trackColor={{ false: "#3b2b28", true: GarageTheme.accent }}
            />
          </View>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleLabel}>音声フィードバック</Text>
              <Text style={styles.toggleMeta}>レップ通知を再生</Text>
            </View>
            <Switch
              value={settings.enable_audio_feedback}
              onValueChange={(value) =>
                void saveSettings({ ...settings, enable_audio_feedback: value })
              }
              trackColor={{ false: "#3b2b28", true: GarageTheme.accent }}
            />
          </View>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleLabel}>
                最高重量ベースのウォームアップ提案
              </Text>
              <Text style={styles.toggleMeta}>
                Big3 のトップセット入力時に提案を表示
              </Text>
            </View>
            <Switch
              value={settings.enable_warmup_recommendations}
              onValueChange={(value) =>
                void saveSettings({
                  ...settings,
                  enable_warmup_recommendations: value,
                })
              }
              trackColor={{ false: "#3b2b28", true: GarageTheme.accent }}
            />
          </View>
        </View>
      )}

      {activeSection === "training" && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>パワーリフティングVBT運用</Text>
          <Text style={styles.toggleMeta}>
            トップシングルで当日の状態を見て、バックオフをVelocity
            Lossで止める前提に合わせます。
          </Text>
          <View style={styles.phaseGrid}>
            {POWERLIFTING_PHASES.map((phase) => {
              const active = settings.target_training_phase === phase.value;
              return (
                <TouchableOpacity
                  key={phase.value}
                  style={[
                    styles.phaseOption,
                    active && styles.phaseOptionActive,
                  ]}
                  onPress={() =>
                    void saveSettings({
                      ...settings,
                      target_training_phase: phase.value,
                      powerlifting_block_week:
                        DEFAULT_WEEK_BY_PHASE[phase.value],
                    })
                  }
                >
                  <Text
                    style={[
                      styles.phaseOptionLabel,
                      active && styles.phaseOptionLabelActive,
                    ]}
                  >
                    {phase.label}
                  </Text>
                  <Text style={styles.phaseOptionDescription}>
                    {phase.description}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.blockWeekHeader}>
            <Text style={styles.blockWeekTitle}>12週間ブロック</Text>
            <Text style={styles.blockWeekMeta}>
              Week {blockWeekPlan.week} / {blockWeekPlan.phaseLabel}
            </Text>
          </View>
          <View style={styles.weekGrid}>
            {Array.from({ length: 12 }, (_, index) => index + 1).map((week) => {
              const active = settings.powerlifting_block_week === week;
              return (
                <TouchableOpacity
                  key={week}
                  style={[styles.weekChip, active && styles.weekChipActive]}
                  onPress={() =>
                    void saveSettings({
                      ...settings,
                      powerlifting_block_week: week,
                      target_training_phase: getPhaseForBlockWeek(week),
                    })
                  }
                >
                  <Text
                    style={[
                      styles.weekChipText,
                      active && styles.weekChipTextActive,
                    ]}
                  >
                    {week}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.phaseOptionDescription}>
            {blockWeekPlan.note}
          </Text>
        </View>
      )}

      {activeSection === "audio" && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>音声ガイド</Text>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleLabel}>レップカウント</Text>
              <Text style={styles.toggleMeta}>1レップごとに回数を読み上げ</Text>
            </View>
            <Switch
              value={settings.enable_audio_rep_count}
              onValueChange={(value) =>
                void saveSettings({
                  ...settings,
                  enable_audio_rep_count: value,
                })
              }
              trackColor={{ false: "#3b2b28", true: GarageTheme.accent }}
            />
          </View>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleLabel}>速度読み上げ</Text>
              <Text style={styles.toggleMeta}>
                各レップの平均速度を音声で通知
              </Text>
            </View>
            <Switch
              value={settings.enable_audio_velocity_readout}
              onValueChange={(value) =>
                void saveSettings({
                  ...settings,
                  enable_audio_velocity_readout: value,
                })
              }
              trackColor={{ false: "#3b2b28", true: GarageTheme.accent }}
            />
          </View>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleLabel}>もっと速くキュー</Text>
              <Text style={styles.toggleMeta}>
                低速レップ時のみ「もっと速く」を再生
              </Text>
            </View>
            <Switch
              value={settings.enable_audio_faster_cue}
              onValueChange={(value) =>
                void saveSettings({
                  ...settings,
                  enable_audio_faster_cue: value,
                })
              }
              trackColor={{ false: "#3b2b28", true: GarageTheme.accent }}
            />
          </View>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleLabel}>セット開始リマインダー</Text>
              <Text style={styles.toggleMeta}>
                開始後、最初のレップが入るまで一定間隔で音を鳴らす
              </Text>
            </View>
            <Switch
              value={settings.enable_set_start_reminder}
              onValueChange={(value) =>
                void saveSettings({
                  ...settings,
                  enable_set_start_reminder: value,
                })
              }
              trackColor={{ false: "#3b2b28", true: GarageTheme.accent }}
            />
          </View>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.toggleLabel}>音量</Text>
              <Text style={styles.toggleMeta}>
                現在: {Math.round(settings.audio_volume * 100)}%
              </Text>
            </View>
          </View>
          <View style={styles.thresholdRow}>
            {[0.25, 0.5, 0.75, 1.0].map((value) => {
              const active = settings.audio_volume === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.thresholdButton,
                    active && styles.thresholdButtonActive,
                  ]}
                  onPress={() =>
                    void saveSettings({
                      ...settings,
                      audio_volume: value,
                    })
                  }
                >
                  <Text
                    style={[
                      styles.thresholdText,
                      active && styles.thresholdTextActive,
                    ]}
                  >
                    {Math.round(value * 100)}%
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {activeSection === "session" && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>自動スタート</Text>

          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleLabel}>自動スタートモード</Text>
              <Text style={styles.toggleMeta}>
                センサー動作検出でセッション自動開始
              </Text>
            </View>
            <Switch
              value={settings.enable_auto_start_session}
              onValueChange={(value) =>
                void saveSettings({
                  ...settings,
                  enable_auto_start_session: value,
                })
              }
              trackColor={{ false: "#3b2b28", true: GarageTheme.accent }}
            />
          </View>

          <View style={styles.thresholdRow}>
            <Text style={styles.thresholdLabel}>
              ROM閾値: {settings.auto_start_rom_cm} cm
            </Text>
            <Text style={styles.toggleMeta}>この可動域を超えると自動開始</Text>
          </View>
          <View style={styles.thresholdRow}>
            {[3, 5, 7, 10].map((value) => {
              const active = settings.auto_start_rom_cm === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.thresholdButton,
                    active && styles.thresholdButtonActive,
                  ]}
                  onPress={() =>
                    void saveSettings({
                      ...settings,
                      auto_start_rom_cm: value,
                    })
                  }
                >
                  <Text
                    style={[
                      styles.thresholdText,
                      active && styles.thresholdTextActive,
                    ]}
                  >
                    {value}cm
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {activeSection === "session" && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>セッション軽量化</Text>
          <Text style={styles.cardBody}>
            6セット目あたりで重くなる対策です。軽量モードはセッション履歴の描画とDB再取得を抑え、詳細を開いた時だけ必要なレップを読み込みます。
          </Text>
          {renderSettingSwitch(
            "enable_session_lightweight_mode",
            "軽量セッションモード",
            "最新5セット中心に表示して計測操作を優先",
          )}
        </View>
      )}

      {activeSection === "session" && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>フォーム動画</Text>
          <Text style={styles.cardBody}>
            セッション中に専用画面を開いて、セットに紐付けるフォーム確認動画を撮影します。
          </Text>
          {renderSettingSwitch(
            "enable_video_recording",
            "フォーム動画モード",
            "セッション画面に録画ボタンを表示",
          )}
        </View>
      )}

      {activeSection === "share" && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Mac Live Share</Text>
          <Text style={styles.cardBody}>
            セッション中の rep / set / 動画メタデータを、手入力したMac側URLへ送ります。ネットワーク探索はしません。
          </Text>

          {renderSettingSwitch(
            "enable_live_share",
            "Live Shareを有効化",
            "失敗時は端末内キューに残し、トレーニング操作は止めません",
          )}

          <Text style={styles.statusLabel}>MAC URL</Text>
          <TextInput
            style={styles.input}
            value={settings.live_share_url}
            onChangeText={(value) =>
              void saveSettings({ ...settings, live_share_url: value })
            }
            placeholder="http://MacのIPまたは.local:8788"
            placeholderTextColor={GarageTheme.textSubtle}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Text style={styles.toggleMeta}>
            例: http://line93.local:8788 または http://192.168.x.x:8788
          </Text>

          <Text style={styles.statusLabel}>TOKEN 任意</Text>
          <TextInput
            style={styles.input}
            value={settings.live_share_token}
            onChangeText={(value) =>
              void saveSettings({ ...settings, live_share_token: value })
            }
            placeholder="Mac側サーバーに --token を付けた時だけ入力"
            placeholderTextColor={GarageTheme.textSubtle}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <Text style={styles.cardBody}>
            Mac側: pnpm live-share:server -- --host 0.0.0.0 --port 8788
          </Text>
        </View>
      )}

      {activeSection === "share" && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Google Drive 診断送信</Text>
          <Text style={styles.cardBody}>
            クラッシュ疑いレポートをGoogle Apps Script経由でDriveへ保存します。Gmail操作の代わりに、再起動後の自動送信やボタン送信で共有できます。
          </Text>
          <Text style={styles.cardBody}>
            最短手順: 1. Macで `scripts/google_drive_crash_report_webapp.gs`
            をApps Scriptへ貼る  2. Webアプリとしてデプロイ  3. `/exec`
            で終わるURLを下へ貼る。分からない時は、再起動後のクラッシュカードで
            「本文共有」を押してGmail送信すればCodexが読めます。
          </Text>

          {renderSettingSwitch(
            "enable_google_drive_crash_report_upload",
            "Drive診断送信を有効化",
            "URL未設定時は送信せず、端末内の診断記録だけ残します",
          )}

          {renderSettingSwitch(
            "enable_google_drive_crash_report_auto_upload",
            "クラッシュ後に自動送信",
            "アプリ再起動時、未送信診断があればDriveへ送ります",
          )}

          <Text style={styles.statusLabel}>Google Apps Script Web App URL</Text>
          <TextInput
            style={styles.input}
            value={settings.google_drive_crash_report_url}
            onChangeText={(value) =>
              void saveSettings({
                ...settings,
                google_drive_crash_report_url: value,
              })
            }
            placeholder="https://script.google.com/macros/s/.../exec"
            placeholderTextColor={GarageTheme.textSubtle}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />

          <Text style={styles.statusLabel}>TOKEN 任意</Text>
          <TextInput
            style={styles.input}
            value={settings.google_drive_crash_report_token}
            onChangeText={(value) =>
              void saveSettings({
                ...settings,
                google_drive_crash_report_token: value,
              })
            }
            placeholder="Apps Script側で照合する共有トークン"
            placeholderTextColor={GarageTheme.textSubtle}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
          />
          <Text style={styles.cardBody}>
            未送信キュー: {driveCrashQueueCount}件。送信失敗時はキューに残して、次回または手動送信で再試行します。
          </Text>
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionSyncButton]}
              onPress={() => void handleFlushDriveCrashReports()}
            >
              <Text style={styles.actionButtonText}>Driveへ診断送信</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => void refreshDriveCrashQueueCount()}
            >
              <Text style={styles.actionButtonText}>キュー確認</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {activeSection === "display" && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>セッション表示項目</Text>
          <Text style={styles.cardBody}>
            通常のセッション画面に出す項目です。使わない項目を切るほどスクロール量と描画負荷が減ります。
          </Text>
          <Text style={styles.cardBody}>
            「アドバイス系まとめ」をOFFにすると、個別設定がONでも助言・判定・提案カードはまとめて非表示になります。
          </Text>
          {SESSION_DISPLAY_TOGGLES.map((item) =>
            renderSettingSwitch(item.key, item.label, item.meta),
          )}
        </View>
      )}

      {activeSection === "focus" && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>計測中フォーカス表示</Text>
          <Text style={styles.cardBody}>
            セット記録中の大画面表示です。計測中に見たい情報だけ残せます。
          </Text>
          {FOCUS_DISPLAY_TOGGLES.map((item) =>
            renderSettingSwitch(item.key, item.label, item.meta),
          )}
        </View>
      )}

      {activeSection === "exercises" && (
        <View style={styles.card}>
          <View style={styles.masterHeaderRow}>
            <View style={styles.masterHeaderCopy}>
              <Text style={styles.sectionTitle}>種目マスタ</Text>
              <Text style={styles.cardBody}>
                OVRサンプル由来の種目を日本語名とカテゴリで整理しています。設定から全体を確認できます。
              </Text>
            </View>
            <TouchableOpacity
              style={styles.syncButton}
              onPress={() => void handleSyncExerciseMaster()}
              disabled={loadingExerciseMaster || syncingExerciseMaster}
            >
              {loadingExerciseMaster || syncingExerciseMaster ? (
                <ActivityIndicator color={GarageTheme.textStrong} />
              ) : (
                <Text style={styles.syncButtonText}>同期</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.masterSummaryRow}>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryLabel}>総種目数</Text>
              <Text style={styles.summaryValue}>{exerciseMaster.length}</Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryLabel}>LVP対応</Text>
              <Text style={styles.summaryValue}>{lvpExerciseCount}</Text>
            </View>
            <View style={styles.summaryTile}>
              <Text style={styles.summaryLabel}>OVRサンプル</Text>
              <Text style={styles.summaryValue}>
                {ovrSampleCoverageCount}/{OVR_SAMPLE_EXERCISE_NAMES.length}
              </Text>
            </View>
          </View>

          <TextInput
            style={styles.input}
            value={exerciseSearchQuery}
            onChangeText={setExerciseSearchQuery}
            placeholder="種目名・カテゴリで検索"
            placeholderTextColor={GarageTheme.textSubtle}
          />

          <View style={styles.masterActionsRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionSyncButton]}
              onPress={handleSyncExerciseMaster}
              disabled={syncingExerciseMaster}
            >
              <Text style={styles.actionButtonText}>
                {syncingExerciseMaster ? "同期中..." : "⟳ 既定に復元"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.addButton]}
              onPress={() => void handleAddExercise()}
            >
              <Text style={styles.actionButtonText}>+ 新規追加</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.addExerciseBox}>
            <Text style={styles.statusLabel}>新規種目</Text>
            <TextInput
              style={styles.input}
              value={newExerciseName}
              onChangeText={setNewExerciseName}
              placeholder="例: Tempo Squat / Cable Row"
              placeholderTextColor={GarageTheme.textSubtle}
              autoCapitalize="words"
            />
            <Text style={styles.helperText}>
              種目選択画面と同じカテゴリで選びます。保存時は内部カテゴリへ自動変換します。
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categorySelectorScroll}
            >
              {EXERCISE_EDIT_GROUPS.map((group) => {
                const selected =
                  getPrimarySelectionGroupForCategory(newExerciseCategory) ===
                  group.id;
                return (
                  <TouchableOpacity
                    key={group.id}
                    style={[
                      styles.categoryChip,
                      selected && styles.categoryChipActive,
                    ]}
                    onPress={() => handleSelectNewExerciseGroup(group.id)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        selected && styles.categoryChipTextActive,
                      ]}
                    >
                      {group.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <Text style={styles.helperText}>
              内部カテゴリ: {EXERCISE_CATEGORY_LABELS[newExerciseCategory]}
            </Text>
            <TextInput
              style={[styles.input, styles.stackInput]}
              value={newExerciseDescription}
              onChangeText={setNewExerciseDescription}
              placeholder="メモ任意。空ならカテゴリから自動推定します"
              placeholderTextColor={GarageTheme.textSubtle}
              multiline
            />
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.groupScroll}
            contentContainerStyle={styles.groupScrollContent}
          >
            {EXERCISE_SELECTION_GROUPS.map((group) => {
              const active = exerciseGroup === group.id;
              return (
                <TouchableOpacity
                  key={group.id}
                  style={[styles.groupChip, active && styles.groupChipActive]}
                  onPress={() => setExerciseGroup(group.id)}
                >
                  <Text
                    style={[
                      styles.groupChipText,
                      active && styles.groupChipTextActive,
                    ]}
                  >
                    {group.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {loadingExerciseMaster ? (
            <View style={styles.loadingState}>
              <ActivityIndicator color={GarageTheme.accent} />
              <Text style={styles.loadingText}>種目マスタを読み込み中...</Text>
            </View>
          ) : (
            <View style={styles.masterList}>
              {groupedExercises.map(([groupId, exercises]) => {
                const label =
                  EXERCISE_SELECTION_GROUPS.find(
                    (group) => group.id === groupId,
                  )?.label ?? groupId;
                return (
                  <View key={groupId} style={styles.masterGroupSection}>
                    <View style={styles.masterGroupHeader}>
                      <Text style={styles.masterGroupTitle}>{label}</Text>
                      <Text style={styles.masterGroupCount}>
                        {exercises.length}
                      </Text>
                    </View>

                    {exercises.map((exercise) => {
                      const romText =
                        exercise.rom_range_min_cm != null &&
                        exercise.rom_range_max_cm != null
                          ? `${formatLoadKg(exercise.rom_range_min_cm)}-${formatLoadKg(exercise.rom_range_max_cm)} cm`
                          : exercise.min_rom_threshold != null
                            ? `最小ROM ${formatLoadKg(exercise.min_rom_threshold)} cm`
                            : "ROM未設定";

                      const isEditing = editingExerciseId === exercise.id;

                      return (
                        <View
                          key={exercise.id}
                          style={[
                            styles.exerciseRow,
                            isEditing && styles.exerciseRowEditing,
                          ]}
                        >
                          <View style={styles.exerciseRowMain}>
                            <View style={styles.exerciseNameRow}>
                              <Text style={styles.exerciseName}>
                                {exercise.name}
                              </Text>
                              {exercise.has_lvp ? (
                                <View style={styles.lvpBadge}>
                                  <Text style={styles.lvpBadgeText}>LVP</Text>
                                </View>
                              ) : null}
                            </View>
                            <Text style={styles.exerciseMeta}>
                              {getSelectionGroupLabel(
                                getPrimarySelectionGroupForCategory(
                                  exercise.category,
                                ),
                              )}{" "}
                              / {getExerciseCategoryLabel(exercise.category)} /{" "}
                              {
                                MODE_LABELS[
                                  exercise.rep_detection_mode ?? "standard"
                                ]
                              }{" "}
                              / {romText}
                            </Text>
                            {exercise.description ? (
                              <Text style={styles.exerciseDescription}>
                                {exercise.description}
                              </Text>
                            ) : null}
                            {isEditing ? (
                              <View style={styles.exerciseEditForm}>
                                <View style={styles.exerciseEditRow}>
                                  <Text style={styles.exerciseEditLabel}>
                                    種目名
                                  </Text>
                                  <TextInput
                                    style={styles.exerciseEditInput}
                                    value={editingExerciseName}
                                    onChangeText={setEditingExerciseName}
                                    placeholder="種目名"
                                    placeholderTextColor={
                                      GarageTheme.textSubtle
                                    }
                                  />
                                </View>

                                <View style={styles.exerciseEditRow}>
                                  <Text style={styles.exerciseEditLabel}>
                                    カテゴリ
                                  </Text>
                                  <Text style={styles.helperText}>
                                    種目選択画面と同じカテゴリで選択
                                  </Text>
                                  <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    style={styles.categorySelectorScroll}
                                  >
                                    {EXERCISE_EDIT_GROUPS.map(
                                      (group) => {
                                        const isSelected =
                                          getPrimarySelectionGroupForCategory(
                                            editingExerciseCategory,
                                          ) === group.id;
                                        return (
                                          <TouchableOpacity
                                            key={group.id}
                                            style={[
                                              styles.categoryChip,
                                              isSelected &&
                                                styles.categoryChipActive,
                                            ]}
                                            onPress={() =>
                                              handleSelectEditingExerciseGroup(
                                                group.id,
                                              )
                                            }
                                          >
                                            <Text
                                              style={[
                                                styles.categoryChipText,
                                                isSelected &&
                                                  styles.categoryChipTextActive,
                                              ]}
                                            >
                                              {group.label}
                                            </Text>
                                          </TouchableOpacity>
                                        );
                                      },
                                    )}
                                  </ScrollView>
                                  <Text style={styles.helperText}>
                                    内部カテゴリ:{" "}
                                    {
                                      EXERCISE_CATEGORY_LABELS[
                                        editingExerciseCategory
                                      ]
                                    }
                                  </Text>
                                </View>

                                <View style={styles.exerciseEditRow}>
                                  <Text style={styles.exerciseEditLabel}>
                                    自動スタートROM
                                  </Text>
                                  <View style={styles.vlThresholdSelector}>
                                    {[null, 3, 5, 7, 10].map((value) => {
                                      const isSelected =
                                        editingExerciseAutoStartRom === value;
                                      return (
                                        <TouchableOpacity
                                          key={value ?? "default"}
                                          style={[
                                            styles.vlThresholdChip,
                                            isSelected &&
                                              styles.vlThresholdChipActive,
                                          ]}
                                          onPress={() =>
                                            setEditingExerciseAutoStartRom(
                                              value,
                                            )
                                          }
                                        >
                                          <Text
                                            style={[
                                              styles.vlThresholdChipText,
                                              isSelected &&
                                                styles.vlThresholdChipTextActive,
                                            ]}
                                          >
                                            {value === null
                                              ? "既定"
                                              : `${value}cm`}
                                          </Text>
                                        </TouchableOpacity>
                                      );
                                    })}
                                  </View>
                                </View>

                                <View style={styles.exerciseEditRow}>
                                  <Text style={styles.exerciseEditLabel}>
                                    トレーニングキュー
                                  </Text>
                                  <TextInput
                                    style={[
                                      styles.exerciseEditInput,
                                      styles.textAreaInput,
                                    ]}
                                    value={editingTrainingCue}
                                    onChangeText={setEditingTrainingCue}
                                    placeholder="実行時の意識ポイント（例：胸を張る、お尻を締める）"
                                    placeholderTextColor={
                                      GarageTheme.textSubtle
                                    }
                                    multiline
                                    numberOfLines={2}
                                  />
                                </View>

                                <View style={styles.exerciseEditRow}>
                                  <Text style={styles.exerciseEditLabel}>
                                    フォーカスノート
                                  </Text>
                                  <TextInput
                                    style={[
                                      styles.exerciseEditInput,
                                      styles.textAreaInput,
                                    ]}
                                    value={editingFocusNote}
                                    onChangeText={setEditingFocusNote}
                                    placeholder="種目ごとの注意点（例：膝が内側に入らないように）"
                                    placeholderTextColor={
                                      GarageTheme.textSubtle
                                    }
                                    multiline
                                    numberOfLines={2}
                                  />
                                </View>

                                <View style={styles.exerciseEditRow}>
                                  <View style={styles.exerciseInlineToggleCopy}>
                                    <Text
                                      style={styles.exerciseInlineToggleLabel}
                                    >
                                      最初の1レップをセットアップとして無視
                                    </Text>
                                    <Text
                                      style={styles.exerciseInlineToggleMeta}
                                    >
                                      開始位置に運ぶ反応を自動除外します
                                    </Text>
                                  </View>
                                  <Switch
                                    value={Boolean(
                                      exercise.ignore_first_rep_as_setup,
                                    )}
                                    onValueChange={(value) => {
                                      void ExerciseService.updateExercise(
                                        exercise.id,
                                        { ignore_first_rep_as_setup: value },
                                      ).then(() => loadExerciseMaster());
                                    }}
                                    trackColor={{
                                      false: "#3b2b28",
                                      true: GarageTheme.accent,
                                    }}
                                  />
                                </View>

                                <TouchableOpacity
                                  style={styles.saveExerciseButton}
                                  onPress={() =>
                                    void handleSaveExerciseEdits(exercise.id)
                                  }
                                >
                                  <Text style={styles.saveExerciseButtonText}>
                                    保存
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            ) : null}
                          </View>
                          <View style={styles.exerciseActions}>
                            <TouchableOpacity
                              style={styles.exerciseActionBtn}
                              onPress={() => handleEditExercise(exercise.id)}
                            >
                              <Text style={styles.exerciseActionText}>
                                {isEditing ? "×" : "編集"}
                              </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.exerciseActionBtn,
                                styles.exerciseDeleteBtn,
                              ]}
                              onPress={() =>
                                handleDeleteExercise(exercise.id, exercise.name)
                              }
                            >
                              <Text style={styles.exerciseActionText}>
                                削除
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                );
              })}

              {groupedExercises.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateTitle}>
                    一致する種目がありません
                  </Text>
                  <Text style={styles.emptyStateText}>
                    検索条件かカテゴリを変更してください。
                  </Text>
                </View>
              ) : null}
            </View>
          )}
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
  content: {
    padding: 16,
    paddingBottom: 36,
  },
  eyebrow: {
    color: GarageTheme.accent,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0,
    marginTop: 8,
  },
  title: {
    color: GarageTheme.text,
    fontSize: 32,
    fontWeight: "600",
    marginTop: 8,
  },
  subtitle: {
    color: GarageTheme.textMuted,
    fontSize: 14,
    marginTop: 6,
    marginBottom: 18,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerText: {
    flex: 1,
  },
  sectionMenu: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  sectionMenuCard: {
    width: "47%",
    borderRadius: 12,
    backgroundColor: GarageTheme.chip,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    padding: 12,
  },
  sectionMenuCardActive: {
    backgroundColor: "#4b2416",
    borderColor: GarageTheme.accent,
  },
  sectionMenuLabel: {
    color: GarageTheme.text,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  sectionMenuLabelActive: {
    color: GarageTheme.textStrong,
  },
  sectionMenuMeta: {
    color: GarageTheme.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  card: {
    borderRadius: 12,
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    padding: 16,
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  toggleCopy: {
    flex: 1,
    paddingRight: 12,
  },
  toggleLabel: {
    color: GarageTheme.text,
    fontSize: 16,
    fontWeight: "500",
  },
  toggleMeta: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  sectionTitle: {
    color: GarageTheme.text,
    fontSize: 16,
    fontWeight: "500",
    marginBottom: 12,
  },
  thresholdLabel: {
    color: GarageTheme.text,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  thresholdRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  thresholdButton: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: GarageTheme.chip,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
  },
  thresholdButtonActive: {
    backgroundColor: "#4b2416",
    borderColor: GarageTheme.accent,
  },
  thresholdText: {
    color: GarageTheme.textMuted,
    fontSize: 14,
    fontWeight: "500",
  },
  thresholdTextActive: {
    color: GarageTheme.textStrong,
  },
  phaseGrid: {
    gap: 10,
    marginTop: 14,
  },
  phaseOption: {
    borderRadius: 12,
    padding: 12,
    backgroundColor: GarageTheme.chip,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
  },
  phaseOptionActive: {
    backgroundColor: "#4b2416",
    borderColor: GarageTheme.accent,
  },
  phaseOptionLabel: {
    color: GarageTheme.text,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  phaseOptionLabelActive: {
    color: GarageTheme.textStrong,
  },
  phaseOptionDescription: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },
  blockWeekHeader: {
    marginTop: 16,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  blockWeekTitle: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: "600",
  },
  blockWeekMeta: {
    color: GarageTheme.accent,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "right",
  },
  weekGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  weekChip: {
    width: 42,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GarageTheme.chip,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
  },
  weekChipActive: {
    backgroundColor: "#4b2416",
    borderColor: GarageTheme.accent,
  },
  weekChipText: {
    color: GarageTheme.textMuted,
    fontSize: 13,
    fontWeight: "600",
  },
  weekChipTextActive: {
    color: GarageTheme.textStrong,
  },
  cardBody: {
    color: GarageTheme.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    backgroundColor: GarageTheme.chip,
    color: GarageTheme.textStrong,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 15,
  },
  stackInput: {
    marginTop: 10,
  },
  statusLabel: {
    color: GarageTheme.accentSoft,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0,
    marginTop: 14,
    marginBottom: 6,
  },
  statusText: {
    color: GarageTheme.text,
    fontSize: 13,
    lineHeight: 18,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  masterHeaderRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  masterHeaderCopy: {
    flex: 1,
  },
  syncButton: {
    minWidth: 86,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GarageTheme.accent,
    backgroundColor: "#4b2416",
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  syncButtonText: {
    color: GarageTheme.textStrong,
    fontSize: 13,
    fontWeight: "600",
  },
  masterSummaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  summaryTile: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    backgroundColor: GarageTheme.chip,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  summaryLabel: {
    color: GarageTheme.textSubtle,
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0,
  },
  summaryValue: {
    color: GarageTheme.textStrong,
    fontSize: 22,
    fontWeight: "600",
    marginTop: 6,
  },
  groupScroll: {
    marginTop: 12,
    marginBottom: 14,
  },
  groupScrollContent: {
    gap: 8,
    paddingRight: 8,
  },
  groupChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    backgroundColor: GarageTheme.chip,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  groupChipActive: {
    backgroundColor: "#4b2416",
    borderColor: GarageTheme.accent,
  },
  groupChipText: {
    color: GarageTheme.textMuted,
    fontSize: 13,
    fontWeight: "500",
  },
  groupChipTextActive: {
    color: GarageTheme.textStrong,
  },
  loadingState: {
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    color: GarageTheme.textMuted,
    fontSize: 13,
  },
  masterList: {
    gap: 16,
  },
  masterGroupSection: {
    gap: 10,
  },
  masterGroupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 2,
  },
  masterGroupTitle: {
    color: GarageTheme.textStrong,
    fontSize: 15,
    fontWeight: "600",
  },
  masterGroupCount: {
    color: GarageTheme.accentSoft,
    fontSize: 12,
    fontWeight: "600",
  },
  exerciseRow: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    backgroundColor: GarageTheme.chip,
    padding: 14,
  },
  exerciseRowMain: {
    gap: 6,
  },
  exerciseNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  exerciseName: {
    flex: 1,
    color: GarageTheme.textStrong,
    fontSize: 15,
    fontWeight: "600",
  },
  lvpBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: GarageTheme.accent,
    backgroundColor: "#3c1f14",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  lvpBadgeText: {
    color: GarageTheme.accentSoft,
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0,
  },
  exerciseMeta: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  helperText: {
    color: GarageTheme.textSubtle,
    fontSize: 11,
    lineHeight: 16,
  },
  exerciseDescription: {
    color: GarageTheme.textSubtle,
    fontSize: 12,
    lineHeight: 18,
  },
  exerciseInlineToggleRow: {
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: GarageTheme.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  exerciseInlineToggleCopy: {
    flex: 1,
  },
  exerciseInlineToggleLabel: {
    color: GarageTheme.textStrong,
    fontSize: 13,
    fontWeight: "500",
  },
  exerciseInlineToggleMeta: {
    color: GarageTheme.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  exerciseRowEditing: {
    borderColor: GarageTheme.accent,
    backgroundColor: "#4b2416",
  },
  exerciseActions: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  exerciseActionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 50,
    height: 32,
    borderRadius: 8,
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    justifyContent: "center",
    alignItems: "center",
  },
  exerciseDeleteBtn: {
    borderColor: "#ef4444",
    backgroundColor: "#2a1a1a",
  },
  exerciseActionText: {
    fontSize: 12,
    fontWeight: "500",
    color: GarageTheme.textStrong,
  },
  exerciseEditForm: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: GarageTheme.border,
    gap: 12,
  },
  exerciseEditRow: {
    gap: 6,
  },
  exerciseEditLabel: {
    color: GarageTheme.textMuted,
    fontSize: 11,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0,
  },
  exerciseEditInput: {
    backgroundColor: GarageTheme.chip,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: "600",
  },
  textAreaInput: {
    height: 60,
    textAlignVertical: "top",
  },
  categorySelectorScroll: {
    marginTop: 4,
  },
  vlThresholdSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  vlThresholdChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: GarageTheme.chip,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
  },
  vlThresholdChipActive: {
    backgroundColor: "#4b2416",
    borderColor: GarageTheme.accent,
  },
  vlThresholdChipText: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    fontWeight: "500",
  },
  vlThresholdChipTextActive: {
    color: GarageTheme.textStrong,
  },
  categoryChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    backgroundColor: GarageTheme.chip,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: "#4b2416",
    borderColor: GarageTheme.accent,
  },
  categoryChipText: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    fontWeight: "500",
  },
  categoryChipTextActive: {
    color: GarageTheme.textStrong,
  },
  saveExerciseButton: {
    backgroundColor: "#4b2416",
    borderColor: GarageTheme.accent,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  saveExerciseButtonText: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0,
  },
  masterActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  addExerciseBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 14,
    marginTop: 14,
    gap: 10,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1.5,
  },
  actionSyncButton: {
    backgroundColor: "#4b2416",
    borderColor: GarageTheme.accent,
  },
  addButton: {
    backgroundColor: "#1d3020",
    borderColor: GarageTheme.success,
  },
  actionButtonText: {
    color: "#f7f8f8",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0,
  },
  emptyState: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    backgroundColor: GarageTheme.chip,
    padding: 18,
    alignItems: "center",
  },
  emptyStateTitle: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: "500",
  },
  emptyStateText: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    backgroundColor: GarageTheme.chip,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: "600",
  },
  primaryButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GarageTheme.accent,
    backgroundColor: "#4b2416",
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: "600",
  },
});
