/**
 * Settings Screen
 * App configuration and preferences
 */

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
} from "react-native";
import { AppSettings, Exercise } from "../types/index";
import {
  getExerciseCategoryLabel,
  inferExercisePreset,
} from "../constants/exerciseCatalog";
import {
  DEFAULT_APP_SETTINGS,
  loadAppSettings,
  saveAppSettings,
} from "../services/AppSettingsService";
import ExerciseService from "../services/ExerciseService";

interface SettingsScreenProps {
  navigation: any;
}

const defaultSettings: AppSettings = DEFAULT_APP_SETTINGS;

const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [exerciseCount, setExerciseCount] = useState(0);
  const [newExerciseName, setNewExerciseName] = useState("");
  const [newExerciseCategory, setNewExerciseCategory] =
    useState<Exercise["category"]>("accessory");
  const [newExerciseMvt, setNewExerciseMvt] = useState("");
  const [newExerciseRomThreshold, setNewExerciseRomThreshold] = useState("");

  useEffect(() => {
    loadSettings();
    loadExerciseCount();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await loadAppSettings();
      setSettings(stored);
    } catch (error) {
      console.error("Failed to load settings:", error);
    }
  };

  const loadExerciseCount = async () => {
    try {
      const exercises = await ExerciseService.getAllExercises();
      setExerciseCount(exercises.length);
    } catch (error) {
      console.error("Failed to load exercises:", error);
    }
  };

  const saveSettings = async (newSettings: AppSettings) => {
    try {
      const saved = await saveAppSettings(newSettings);
      setSettings(saved);
    } catch (error) {
      console.error("Failed to save settings:", error);
      Alert.alert("エラー", "設定の保存に失敗しました");
    }
  };

  const handleToggle = (key: keyof AppSettings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    saveSettings(newSettings);
  };

  const handleThresholdChange = (value: number) => {
    const newSettings = { ...settings, velocity_loss_threshold: value };
    saveSettings(newSettings);
  };

  const handlePhaseChange = (phase: AppSettings["target_training_phase"]) => {
    const newSettings = { ...settings, target_training_phase: phase };
    saveSettings(newSettings);
  };

  const handleAddExercise = async () => {
    const name = newExerciseName.trim();
    if (!name) {
      Alert.alert("種目名が必要です", "新規種目名を入力してください");
      return;
    }

    const inferred = inferExercisePreset(name, newExerciseCategory);
    const mvt = newExerciseMvt.trim()
      ? Number.parseFloat(newExerciseMvt.trim())
      : undefined;
    const romThreshold = newExerciseRomThreshold.trim()
      ? Number.parseFloat(newExerciseRomThreshold.trim())
      : undefined;

    if (mvt != null && (!Number.isFinite(mvt) || mvt <= 0)) {
      Alert.alert("入力エラー", "MVTは0より大きい数値で入力してください");
      return;
    }
    if (
      romThreshold != null &&
      (!Number.isFinite(romThreshold) || romThreshold <= 0)
    ) {
      Alert.alert("入力エラー", "ROM閾値は0より大きい数値で入力してください");
      return;
    }

    try {
      const exercise = await ExerciseService.addExercise({
        name,
        category: newExerciseCategory,
        subcategory: inferred.subcategory,
        has_lvp: inferred.has_lvp ?? true,
        machine_weight_steps: inferred.machine_weight_steps,
        min_rom_threshold:
          romThreshold ?? inferred.min_rom_threshold ?? 10,
        rep_detection_mode: inferred.rep_detection_mode ?? "standard",
        target_pause_ms: inferred.target_pause_ms ?? 0,
        rom_range_min_cm: inferred.rom_range_min_cm,
        rom_range_max_cm: inferred.rom_range_max_cm,
        rom_data_points: 0,
        description: inferred.description,
        mvt: mvt ?? inferred.mvt,
        ignore_first_rep_as_setup:
          inferred.ignore_first_rep_as_setup ?? false,
        auto_start_rom_cm: inferred.auto_start_rom_cm,
      });
      setNewExerciseName("");
      setNewExerciseMvt("");
      setNewExerciseRomThreshold("");
      await loadExerciseCount();
      Alert.alert("追加しました", `${exercise.name} を種目に追加しました`);
    } catch (error) {
      console.error("Failed to add exercise:", error);
      Alert.alert("エラー", "新規種目の追加に失敗しました");
    }
  };

  const thresholdOptions = [10, 15, 20, 25, 30];
  const categoryOptions: Exercise["category"][] = [
    "squat",
    "bench",
    "deadlift",
    "press",
    "pull",
    "row",
    "vertical_pull",
    "single_leg",
    "quad",
    "hamstring",
    "adductor",
    "glute",
    "triceps",
    "biceps",
    "core",
    "accessory",
  ];
  const phaseOptions: {
    value: AppSettings["target_training_phase"];
    label: string;
    description: string;
  }[] = [
    { value: "power", label: "パワー", description: "最大パワー出力の向上" },
    { value: "hypertrophy", label: "筋肥大", description: "筋肉量の増加" },
    { value: "strength", label: "筋力", description: "最大筋力の向上" },
    {
      value: "peaking",
      label: "ピーキング",
      description: "競技パフォーマンスの最大化",
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← 戻る</Text>
        </TouchableOpacity>
        <Text style={styles.title}>設定</Text>
      </View>

      {/* General Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>一般</Text>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>メートル法を使用</Text>
            <Text style={styles.settingDescription}>kg / m/s</Text>
          </View>
          <Switch
            value={settings.use_metric}
            onValueChange={() => handleToggle("use_metric")}
            trackColor={{ false: "#444", true: "#2196F3" }}
            thumbColor={settings.use_metric ? "#fff" : "#ccc"}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>音声フィードバック</Text>
            <Text style={styles.settingDescription}>
              レップ完了時に音声通知
            </Text>
          </View>
          <Switch
            value={settings.enable_audio_feedback}
            onValueChange={() => handleToggle("enable_audio_feedback")}
            trackColor={{ false: "#444", true: "#2196F3" }}
            thumbColor={settings.enable_audio_feedback ? "#fff" : "#ccc"}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>音声コマンド</Text>
            <Text style={styles.settingDescription}>
              音声でアプリを操作（未対応）
            </Text>
          </View>
          <Switch
            value={settings.enable_voice_commands}
            onValueChange={() => handleToggle("enable_voice_commands")}
            trackColor={{ false: "#444", true: "#2196F3" }}
            thumbColor={settings.enable_voice_commands ? "#fff" : "#ccc"}
            disabled
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>ビデオ録画</Text>
            <Text style={styles.settingDescription}>
              セッション画面にフォーム録画ボタンを表示
            </Text>
          </View>
          <Switch
            value={settings.enable_video_recording}
            onValueChange={() => handleToggle("enable_video_recording")}
            trackColor={{ false: "#444", true: "#2196F3" }}
            thumbColor={settings.enable_video_recording ? "#fff" : "#ccc"}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>フォーム動画 安全モード</Text>
            <Text style={styles.settingDescription}>
              録画中はVBT入力を一時停止してクラッシュを避ける
            </Text>
          </View>
          <Switch
            value={settings.enable_form_video_ble_safe_mode}
            onValueChange={() =>
              handleToggle("enable_form_video_ble_safe_mode")
            }
            trackColor={{ false: "#444", true: "#2196F3" }}
            thumbColor={
              settings.enable_form_video_ble_safe_mode ? "#fff" : "#ccc"
            }
          />
        </View>
      </View>

      {/* Exercise Management */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>種目管理</Text>
        <View style={styles.exerciseManagerCard}>
          <Text style={styles.settingLabel}>新規種目を追加</Text>
          <Text style={styles.settingDescription}>
            現在の登録数: {exerciseCount}種目。名前は英語表記推奨です。
          </Text>

          <TextInput
            style={styles.textInput}
            value={newExerciseName}
            onChangeText={setNewExerciseName}
            placeholder="例: Pin Squat"
            placeholderTextColor="#777"
            returnKeyType="done"
          />

          <View style={styles.categoryGrid}>
            {categoryOptions.map((category) => (
              <TouchableOpacity
                key={category}
                style={[
                  styles.categoryChip,
                  newExerciseCategory === category &&
                    styles.categoryChipActive,
                ]}
                onPress={() => setNewExerciseCategory(category)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    newExerciseCategory === category &&
                      styles.categoryChipTextActive,
                  ]}
                >
                  {getExerciseCategoryLabel(category)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.compactInputRow}>
            <TextInput
              style={[styles.textInput, styles.compactInput]}
              value={newExerciseMvt}
              onChangeText={setNewExerciseMvt}
              placeholder="MVT 任意"
              placeholderTextColor="#777"
              keyboardType="decimal-pad"
            />
            <TextInput
              style={[styles.textInput, styles.compactInput]}
              value={newExerciseRomThreshold}
              onChangeText={setNewExerciseRomThreshold}
              placeholder="ROM閾値 任意"
              placeholderTextColor="#777"
              keyboardType="decimal-pad"
            />
          </View>

          <TouchableOpacity
            style={styles.addExerciseButton}
            onPress={handleAddExercise}
          >
            <Text style={styles.addExerciseButtonText}>種目を追加</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* VBT Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>VBT設定</Text>

        <View style={styles.settingBlock}>
          <Text style={styles.settingLabel}>Velocity Loss 閾値</Text>
          <Text style={styles.settingDescription}>
            この値を超えたらセット終了を推奨
          </Text>
          <View style={styles.optionsContainer}>
            {thresholdOptions.map((value) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.optionButton,
                  settings.velocity_loss_threshold === value &&
                    styles.optionButtonActive,
                ]}
                onPress={() => handleThresholdChange(value)}
              >
                <Text
                  style={[
                    styles.optionButtonText,
                    settings.velocity_loss_threshold === value &&
                      styles.optionButtonTextActive,
                  ]}
                >
                  {value}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Training Phase */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>トレーニングフェーズ</Text>

        {phaseOptions.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.phaseCard,
              settings.target_training_phase === option.value &&
                styles.phaseCardActive,
            ]}
            onPress={() => handlePhaseChange(option.value)}
          >
            <View style={styles.phaseInfo}>
              <Text style={styles.phaseLabel}>{option.label}</Text>
              <Text style={styles.phaseDescription}>{option.description}</Text>
            </View>
            {settings.target_training_phase === option.value && (
              <Text style={styles.checkmark}>✓</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>アプリ情報</Text>
        <View style={styles.aboutCard}>
          <Text style={styles.aboutTitle}>OVR VBT Coach</Text>
          <Text style={styles.aboutVersion}>Version 2.3.0</Text>
          <Text style={styles.aboutDescription}>
            Velocity-Based Training アプリケーション with AI Coaching
          </Text>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  header: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  backButton: {
    color: "#2196F3",
    fontSize: 16,
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2196F3",
    textTransform: "uppercase",
    marginBottom: 12,
  },
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#2a2a2a",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: "#999",
  },
  settingBlock: {
    backgroundColor: "#2a2a2a",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  exerciseManagerCard: {
    backgroundColor: "#2a2a2a",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: "#1a1a1a",
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 10,
    color: "#fff",
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#444",
    backgroundColor: "#1a1a1a",
  },
  categoryChipActive: {
    backgroundColor: "#2196F3",
    borderColor: "#2196F3",
  },
  categoryChipText: {
    color: "#aaa",
    fontSize: 12,
    fontWeight: "700",
  },
  categoryChipTextActive: {
    color: "#fff",
  },
  compactInputRow: {
    flexDirection: "row",
    gap: 10,
  },
  compactInput: {
    flex: 1,
  },
  addExerciseButton: {
    marginTop: 14,
    backgroundColor: "#4CAF50",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  addExerciseButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "800",
  },
  optionsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
  },
  optionButton: {
    backgroundColor: "#1a1a1a",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#444",
  },
  optionButtonActive: {
    backgroundColor: "#2196F3",
    borderColor: "#2196F3",
  },
  optionButtonText: {
    color: "#999",
    fontSize: 14,
    fontWeight: "600",
  },
  optionButtonTextActive: {
    color: "#fff",
  },
  phaseCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#2a2a2a",
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: "transparent",
  },
  phaseCardActive: {
    borderColor: "#4CAF50",
    backgroundColor: "#1a3a1a",
  },
  phaseInfo: {
    flex: 1,
  },
  phaseLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 4,
  },
  phaseDescription: {
    fontSize: 12,
    color: "#999",
  },
  checkmark: {
    fontSize: 24,
    color: "#4CAF50",
    fontWeight: "bold",
  },
  aboutCard: {
    backgroundColor: "#2a2a2a",
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
  },
  aboutTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  aboutVersion: {
    fontSize: 14,
    color: "#2196F3",
    marginBottom: 16,
  },
  aboutDescription: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
  },
});

export default SettingsScreen;
