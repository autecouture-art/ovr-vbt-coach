import React, { useState } from "react";
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { GarageTheme } from "@/src/constants/garageTheme";
import ImprovementFeedbackService from "@/src/services/ImprovementFeedbackService";
import type { ImprovementFeedbackCategory } from "@/src/types/index";

type Props = {
  visible: boolean;
  sessionId?: string | null;
  lift?: string;
  loadKg?: number;
  sensorConnected?: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

const CATEGORIES: { id: ImprovementFeedbackCategory; label: string }[] = [
  { id: "bug", label: "不具合" },
  { id: "usability", label: "使いにくい" },
  { id: "feature", label: "改善案" },
  { id: "data", label: "記録データ" },
];

export function ImprovementFeedbackSheet({
  visible,
  sessionId,
  lift,
  loadKg,
  sensorConnected,
  onClose,
  onSaved,
}: Props) {
  const [category, setCategory] = useState<ImprovementFeedbackCategory>("usability");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const close = () => {
    if (saving) return;
    setNote("");
    onClose();
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await ImprovementFeedbackService.queueFeedback({
        category,
        note,
        screen: "session",
        sessionId,
        sessionContext: {
          lift,
          load_kg: loadKg,
          sensor_connected: sensorConnected,
        },
      });
      setNote("");
      onSaved?.();
      onClose();
    } catch (error) {
      Alert.alert(
        "保存できません",
        error instanceof Error ? error.message : "気づきの保存に失敗しました。",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.kicker}>IMPROVEMENT NOTE</Text>
              <Text style={styles.title}>気づきを保存</Text>
            </View>
            <TouchableOpacity onPress={close} style={styles.closeButton} accessibilityLabel="閉じる">
              <Text style={styles.closeText}>閉じる</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.hint}>
            端末へ先に保存します。同期はセッション終了時、または次回接続時に一度だけ行います。
          </Text>
          <View style={styles.categories}>
            {CATEGORIES.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.chip, category === item.id && styles.chipActive]}
                onPress={() => setCategory(item.id)}
              >
                <Text style={[styles.chipText, category === item.id && styles.chipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            value={note}
            onChangeText={(text) => setNote(text.slice(0, 500))}
            placeholder="例: セット完了直後に動画を保存すると画面が戻りにくい"
            placeholderTextColor={GarageTheme.textMuted}
            multiline
            maxLength={500}
            style={styles.input}
            textAlignVertical="top"
          />
          <Text style={styles.count}>{note.length}/500</Text>
          <TouchableOpacity
            style={[styles.saveButton, (!note.trim() || saving) && styles.saveButtonDisabled]}
            disabled={!note.trim() || saving}
            onPress={() => void save()}
          >
            <Text style={styles.saveText}>{saving ? "保存中..." : "端末に保存"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.62)" },
  sheet: { backgroundColor: GarageTheme.surface, borderTopWidth: 1, borderColor: GarageTheme.border, padding: 20, gap: 14 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  kicker: { color: GarageTheme.accent, fontSize: 11, fontWeight: "700" },
  title: { color: GarageTheme.textStrong, fontSize: 21, fontWeight: "700", marginTop: 2 },
  closeButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  closeText: { color: GarageTheme.textMuted, fontSize: 15, fontWeight: "600" },
  hint: { color: GarageTheme.textMuted, fontSize: 13, lineHeight: 19 },
  categories: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 38, paddingHorizontal: 12, justifyContent: "center", borderWidth: 1, borderColor: GarageTheme.border, borderRadius: 7 },
  chipActive: { borderColor: GarageTheme.accent, backgroundColor: "rgba(76, 109, 255, 0.16)" },
  chipText: { color: GarageTheme.textMuted, fontWeight: "600" },
  chipTextActive: { color: GarageTheme.textStrong },
  input: { minHeight: 120, borderWidth: 1, borderColor: GarageTheme.border, borderRadius: 7, padding: 12, color: GarageTheme.textStrong, fontSize: 16 },
  count: { color: GarageTheme.textMuted, fontSize: 12, textAlign: "right", marginTop: -8 },
  saveButton: { minHeight: 52, justifyContent: "center", alignItems: "center", backgroundColor: GarageTheme.accent, borderRadius: 7 },
  saveButtonDisabled: { opacity: 0.45 },
  saveText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
