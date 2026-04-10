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
import { useRouter } from "expo-router";

import {
  getResolvedApiHealth,
  getStoredApiBaseUrlOverride,
  hydrateApiBaseUrlOverride,
  setStoredApiBaseUrlOverride,
} from "@/constants/oauth";
import {
  EXERCISE_CATEGORY_LABELS,
  EXERCISE_SELECTION_GROUPS,
  formatLoadKg,
  getExerciseCategoryLabel,
  getExerciseSelectionGroup,
  inferExercisePreset,
  matchesExerciseSelectionGroup,
  type ExerciseSelectionGroupId,
} from "@/src/constants/exerciseCatalog";
import { GarageTheme } from "@/src/constants/garageTheme";
import ExerciseService from "@/src/services/ExerciseService";
import {
  getLocalLLMHealth,
  saveLocalLLMConfig,
} from "@/src/services/LocalLLMService";
import {
  DEFAULT_APP_SETTINGS,
  loadAppSettings,
  saveAppSettings,
} from "@/src/services/AppSettingsService";
import { useTrainingStore } from "@/src/store/trainingStore";
import { HelpButton } from "@/src/components/HelpButton";
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

export default function SettingsTab() {
  const router = useRouter();
  const updateGlobalSettings = useTrainingStore(
    (state) => state.updateSettings,
  );
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [apiBaseUrlInput, setApiBaseUrlInput] = useState("");
  const [apiStatusText, setApiStatusText] = useState("未確認");
  const [checkingApi, setCheckingApi] = useState(false);
  const [localApiKeyInput, setLocalApiKeyInput] = useState("");
  const [localModelInput, setLocalModelInput] = useState("glm-4.7");
  const [localApiUrlInput, setLocalApiUrlInput] = useState(
    "https://api.z.ai/api/anthropic",
  );
  const [localStatusText, setLocalStatusText] = useState("未設定");
  const [savingLocalLlm, setSavingLocalLlm] = useState(false);
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
  const [editingExerciseVLThreshold, setEditingExerciseVLThreshold] =
    useState<number | null>(null);

  useEffect(() => {
    void loadSettings();
    void loadApiOverride();
    void loadLocalLlm();
    void loadExerciseMaster();
  }, []);

  const loadSettings = async () => {
    try {
      const loaded = await loadAppSettings();
      setSettings(loaded);
      updateGlobalSettings(loaded);
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  };

  const loadApiOverride = async () => {
    await hydrateApiBaseUrlOverride();
    setApiBaseUrlInput(getStoredApiBaseUrlOverride());
    await handleCheckApiHealth(false);
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

  const loadLocalLlm = async () => {
    try {
      const health = await getLocalLLMHealth();
      setLocalApiKeyInput(health.apiKey);
      setLocalModelInput(health.model);
      setLocalApiUrlInput(health.apiUrl);
      if (health.hasApiKey) {
        setLocalStatusText(`ローカル直接接続が有効 / ${health.model}`);
      } else {
        setLocalStatusText("ローカルAPIキー未設定");
      }
    } catch (error) {
      console.error("Failed to load local LLM config:", error);
      setLocalStatusText("ローカル設定の読み込みに失敗しました");
    }
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

  const handleSaveApiBaseUrl = async () => {
    try {
      await setStoredApiBaseUrlOverride(apiBaseUrlInput);
      await handleCheckApiHealth(true);
      Alert.alert(
        "保存完了",
        apiBaseUrlInput
          ? "AIサーバーURLを保存しました。"
          : "AIサーバーURLをクリアしました。",
      );
    } catch (error) {
      console.error("Failed to save API base URL override:", error);
      Alert.alert("エラー", "AIサーバーURLの保存に失敗しました。");
    }
  };

  const handleSaveLocalLlm = async () => {
    setSavingLocalLlm(true);
    try {
      await saveLocalLLMConfig({
        apiKey: localApiKeyInput,
        model: localModelInput,
        apiUrl: localApiUrlInput,
      });
      await loadLocalLlm();
      Alert.alert(
        "保存完了",
        localApiKeyInput.trim()
          ? "ローカルGLM設定を保存しました。"
          : "ローカルGLM設定をクリアしました。",
      );
    } catch (error) {
      console.error("Failed to save local LLM config:", error);
      Alert.alert("エラー", "ローカルGLM設定の保存に失敗しました。");
    } finally {
      setSavingLocalLlm(false);
    }
  };

  const handleCheckApiHealth = async (force: boolean = true) => {
    setCheckingApi(true);
    try {
      const { baseUrl, health } = await getResolvedApiHealth(force);
      if (!baseUrl) {
        setApiStatusText("未接続: AIサーバーURLが未設定です");
      } else if (!health?.ok) {
        setApiStatusText(`未接続: ${baseUrl}`);
      } else if (!health.llm?.hasApiKey) {
        setApiStatusText(`接続OK / APIキー未設定 / ${baseUrl}`);
      } else {
        const model = health.llm?.model ? ` / ${health.llm.model}` : "";
        setApiStatusText(`接続OK${model} / ${baseUrl}`);
      }
    } catch (error) {
      console.error("Failed to check API health:", error);
      setApiStatusText("ヘルスチェック失敗");
    } finally {
      setCheckingApi(false);
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
      setEditingExerciseVLThreshold(null);
    } else {
      // Start editing
      setEditingExerciseId(exerciseId);
      setEditingExerciseName(exercise.name);
      setEditingExerciseCategory(exercise.category);
      setEditingExerciseVLThreshold(exercise.velocity_loss_threshold ?? null);
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
      if (editingExerciseVLThreshold !== exercise.velocity_loss_threshold) {
        updates.velocity_loss_threshold = editingExerciseVLThreshold ?? undefined;
      }

      if (Object.keys(updates).length > 0) {
        await ExerciseService.updateExercise(exerciseId, updates);
        await loadExerciseMaster();
      }

      // Exit editing mode
      setEditingExerciseId(null);
      setEditingExerciseName("");
      setEditingExerciseCategory("accessory");
      setEditingExerciseVLThreshold(null);
    } catch (error) {
      console.error("Failed to save exercise edits:", error);
      Alert.alert("エラー", "種目情報の更新に失敗しました");
    }
  };

  const thresholdOptions = [10, 15, 20, 25, 30];

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
      const groupId = getExerciseSelectionGroup(exercise);
      if (!groups.has(groupId)) {
        groups.set(groupId, []);
      }
      groups.get(groupId)?.push(exercise);
    }
    return Array.from(groups.entries());
  }, [filteredExercises]);

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>SYSTEM / SETTINGS</Text>
          <Text style={styles.title}>設定</Text>
          <Text style={styles.subtitle}>
            アプリの挙動とAI接続先をここで揃えます。
          </Text>
        </View>
        <HelpButton />
      </View>

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
              void saveSettings({ ...settings, enable_audio_rep_count: value })
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
              void saveSettings({ ...settings, enable_audio_faster_cue: value })
            }
            trackColor={{ false: "#3b2b28", true: GarageTheme.accent }}
          />
        </View>
      </View>

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
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Velocity Loss</Text>
        <View style={styles.thresholdRow}>
          {thresholdOptions.map((value) => {
            const active = settings.velocity_loss_threshold === value;
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
                    velocity_loss_threshold: value,
                  })
                }
              >
                <Text
                  style={[
                    styles.thresholdText,
                    active && styles.thresholdTextActive,
                  ]}
                >
                  {value}%
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>ローカルGLM接続</Text>
        <Text style={styles.cardBody}>
          あなた専用運用向け。ここに APIキーを入れると、AIコーチは Mac
          サーバーなしで GLM に直接接続します。
        </Text>
        <TextInput
          style={styles.input}
          value={localApiKeyInput}
          onChangeText={setLocalApiKeyInput}
          placeholder="ZAI API Key"
          placeholderTextColor={GarageTheme.textSubtle}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
        <TextInput
          style={[styles.input, styles.stackInput]}
          value={localModelInput}
          onChangeText={setLocalModelInput}
          placeholder="glm-4.7"
          placeholderTextColor={GarageTheme.textSubtle}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={[styles.input, styles.stackInput]}
          value={localApiUrlInput}
          onChangeText={setLocalApiUrlInput}
          placeholder="https://api.z.ai/api/anthropic"
          placeholderTextColor={GarageTheme.textSubtle}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.statusLabel}>状態</Text>
        <Text style={styles.statusText}>{localStatusText}</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => void loadLocalLlm()}
          >
            <Text style={styles.secondaryButtonText}>再読込</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => void handleSaveLocalLlm()}
          >
            {savingLocalLlm ? (
              <ActivityIndicator color={GarageTheme.textStrong} />
            ) : (
              <Text style={styles.primaryButtonText}>保存</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>AIサーバーURL</Text>
        <Text style={styles.cardBody}>
          サーバー経由運用時だけ使います。ローカルGLM接続を使う場合は未設定でも構いません。
        </Text>
        <TextInput
          style={styles.input}
          value={apiBaseUrlInput}
          onChangeText={setApiBaseUrlInput}
          placeholder="http://192.168.1.23:3001"
          placeholderTextColor={GarageTheme.textSubtle}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.statusLabel}>状態</Text>
        <Text style={styles.statusText}>{apiStatusText}</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => void handleCheckApiHealth(true)}
          >
            {checkingApi ? (
              <ActivityIndicator color={GarageTheme.textStrong} />
            ) : (
              <Text style={styles.secondaryButtonText}>再確認</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => void handleSaveApiBaseUrl()}
          >
            <Text style={styles.primaryButtonText}>保存</Text>
          </TouchableOpacity>
        </View>
      </View>

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
            onPress={() => router.push("/coach-chat")}
          >
            <Text style={styles.actionButtonText}>+ 新規追加</Text>
          </TouchableOpacity>
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
                EXERCISE_SELECTION_GROUPS.find((group) => group.id === groupId)
                  ?.label ?? groupId;
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
                            {getExerciseCategoryLabel(exercise.category)} /{" "}
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
                                <Text style={styles.exerciseEditLabel}>種目名</Text>
                                <TextInput
                                  style={styles.exerciseEditInput}
                                  value={editingExerciseName}
                                  onChangeText={setEditingExerciseName}
                                  placeholder="種目名"
                                  placeholderTextColor={GarageTheme.textSubtle}
                                />
                              </View>

                              <View style={styles.exerciseEditRow}>
                                <Text style={styles.exerciseEditLabel}>カテゴリ</Text>
                                <ScrollView
                                  horizontal
                                  showsHorizontalScrollIndicator={false}
                                  style={styles.categorySelectorScroll}
                                >
                                  {Object.keys(
                                    EXERCISE_CATEGORY_LABELS,
                                  ).map((cat) => {
                                    const category = cat as Exercise["category"];
                                    const isSelected =
                                      editingExerciseCategory === category;
                                    return (
                                      <TouchableOpacity
                                        key={category}
                                        style={[
                                          styles.categoryChip,
                                          isSelected &&
                                            styles.categoryChipActive,
                                        ]}
                                        onPress={() =>
                                          setEditingExerciseCategory(category)
                                        }
                                      >
                                        <Text
                                          style={[
                                            styles.categoryChipText,
                                            isSelected &&
                                              styles.categoryChipTextActive,
                                          ]}
                                        >
                                          {
                                            EXERCISE_CATEGORY_LABELS[
                                              category
                                            ]
                                          }
                                        </Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </ScrollView>
                              </View>

                              <View style={styles.exerciseEditRow}>
                                <Text style={styles.exerciseEditLabel}>
                                  VL閾値
                                </Text>
                                <View style={styles.vlThresholdSelector}>
                                  {[null, 10, 15, 20, 25, 30].map((value) => {
                                    const isSelected =
                                      editingExerciseVLThreshold === value;
                                    return (
                                      <TouchableOpacity
                                        key={value ?? "default"}
                                        style={[
                                          styles.vlThresholdChip,
                                          isSelected &&
                                            styles.vlThresholdChipActive,
                                        ]}
                                        onPress={() =>
                                          setEditingExerciseVLThreshold(value)
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
                                            : `${value}%`}
                                        </Text>
                                      </TouchableOpacity>
                                    );
                                  })}
                                </View>
                              </View>

                              <View style={styles.exerciseEditRow}>
                                <View style={styles.exerciseInlineToggleCopy}>
                                  <Text style={styles.exerciseInlineToggleLabel}>
                                    最初の1レップをセットアップとして無視
                                  </Text>
                                  <Text style={styles.exerciseInlineToggleMeta}>
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
                            <Text style={styles.exerciseActionText}>削除</Text>
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
    fontWeight: "800",
    letterSpacing: 2,
    marginTop: 8,
  },
  title: {
    color: GarageTheme.text,
    fontSize: 32,
    fontWeight: "800",
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
  card: {
    borderRadius: 18,
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
  toggleLabel: {
    color: GarageTheme.text,
    fontSize: 16,
    fontWeight: "700",
  },
  toggleMeta: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  sectionTitle: {
    color: GarageTheme.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
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
    fontWeight: "700",
  },
  thresholdTextActive: {
    color: GarageTheme.textStrong,
  },
  cardBody: {
    color: GarageTheme.textMuted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  input: {
    borderRadius: 14,
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
    fontWeight: "800",
    letterSpacing: 1,
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
    borderRadius: 14,
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
    fontWeight: "800",
  },
  masterSummaryRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  summaryTile: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    backgroundColor: GarageTheme.chip,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  summaryLabel: {
    color: GarageTheme.textSubtle,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  summaryValue: {
    color: GarageTheme.textStrong,
    fontSize: 22,
    fontWeight: "800",
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
    fontWeight: "700",
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
    fontWeight: "800",
  },
  masterGroupCount: {
    color: GarageTheme.accentSoft,
    fontSize: 12,
    fontWeight: "800",
  },
  exerciseRow: {
    borderRadius: 16,
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
    fontWeight: "800",
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
    fontWeight: "900",
    letterSpacing: 1,
  },
  exerciseMeta: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    lineHeight: 18,
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
    fontWeight: "700",
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
    borderColor: "#ff4444",
    backgroundColor: "#2a1a1a",
  },
  exerciseActionText: {
    fontSize: 12,
    fontWeight: "700",
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
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
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
    fontWeight: "700",
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
    fontWeight: "700",
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
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  masterActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
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
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  emptyState: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    backgroundColor: GarageTheme.chip,
    padding: 18,
    alignItems: "center",
  },
  emptyStateTitle: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: "700",
  },
  emptyStateText: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    backgroundColor: GarageTheme.chip,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: "800",
  },
  primaryButton: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: GarageTheme.accent,
    backgroundColor: "#4b2416",
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonText: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: "800",
  },
});
