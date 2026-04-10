import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { GarageTheme } from "../constants/garageTheme";
import { formatLoadKg, roundToHalfKg } from "../constants/exerciseCatalog";
import type { SetData } from "../types/index";

export type SetEditValues = {
  loadKg: number;
  lift: string;
  rpe?: number;
  notes: string;
};

type SetEditModalProps = {
  visible: boolean;
  setItem: SetData | null;
  onClose: () => void;
  onSave: (values: SetEditValues) => Promise<void> | void;
};

export function SetEditModal({
  visible,
  setItem,
  onClose,
  onSave,
}: SetEditModalProps) {
  const [loadText, setLoadText] = useState("");
  const [liftText, setLiftText] = useState("");
  const [rpeText, setRpeText] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !setItem) return;
    setLoadText(formatLoadKg(setItem.load_kg));
    setLiftText(setItem.lift ?? "");
    setRpeText(setItem.rpe != null ? String(setItem.rpe) : "");
    setNotes(setItem.notes ?? "");
    setError(null);
    setSaving(false);
  }, [visible, setItem]);

  const handleSave = async () => {
    if (!setItem || saving) return;

    const normalizedLoad = loadText.trim().replace(/,/g, ".");
    const parsedLoad = Number.parseFloat(normalizedLoad);

    if (!normalizedLoad || Number.isNaN(parsedLoad) || parsedLoad < 0) {
      setError("0以上の重量を入力してください。");
      return;
    }

    const normalizedLift = liftText.trim();
    if (!normalizedLift) {
      setError("種目名を入力してください。");
      return;
    }

    const normalizedRpe = rpeText.trim().replace(/,/g, ".");
    let parsedRpe: number | undefined;
    if (normalizedRpe.length > 0) {
      parsedRpe = Number.parseFloat(normalizedRpe);
      if (Number.isNaN(parsedRpe) || parsedRpe < 0 || parsedRpe > 10) {
        setError("RPE は 0 から 10 の範囲で入力してください。");
        return;
      }
    }

    setError(null);
    setSaving(true);
    try {
      await onSave({
        loadKg: roundToHalfKg(parsedLoad),
        lift: normalizedLift,
        rpe: parsedRpe,
        notes: notes.trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.overlay}
      >
        <View style={styles.card}>
          <Text style={styles.eyebrow}>SET SERVICE</Text>
          <Text style={styles.title}>セットを修正</Text>
          <Text style={styles.subtitle}>
            {setItem ? `${setItem.lift} / Set ${setItem.set_index}` : "-"}
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>種目名</Text>
            <TextInput
              style={styles.input}
              value={liftText}
              onChangeText={setLiftText}
              placeholder="ベンチプレス"
              placeholderTextColor={GarageTheme.textSubtle}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>重量 (kg)</Text>
            <TextInput
              style={styles.input}
              value={loadText}
              onChangeText={setLoadText}
              keyboardType="decimal-pad"
              placeholder="80.0"
              placeholderTextColor={GarageTheme.textSubtle}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>RPE</Text>
            <TextInput
              style={styles.input}
              value={rpeText}
              onChangeText={setRpeText}
              keyboardType="decimal-pad"
              placeholder="8.5"
              placeholderTextColor={GarageTheme.textSubtle}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>メモ</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlignVertical="top"
              placeholder="後から補足したい内容を入力"
              placeholderTextColor={GarageTheme.textSubtle}
            />
          </View>

          <Text style={styles.helper}>
            重量を変えた場合は、関連レップの負荷とセッション集計も更新します。
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.secondaryButton} onPress={onClose} disabled={saving}>
              <Text style={styles.secondaryButtonText}>キャンセル</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.primaryButton} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={GarageTheme.textStrong} />
              ) : (
                <Text style={styles.primaryButtonText}>保存</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    borderRadius: 20,
    backgroundColor: GarageTheme.surface,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    padding: 18,
    gap: 12,
  },
  eyebrow: {
    color: GarageTheme.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 3,
  },
  title: {
    color: GarageTheme.textStrong,
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    color: GarageTheme.textMuted,
    fontSize: 14,
  },
  field: {
    gap: 6,
  },
  label: {
    color: GarageTheme.textStrong,
    fontSize: 14,
    fontWeight: "700",
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    backgroundColor: GarageTheme.chip,
    color: GarageTheme.textStrong,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  notesInput: {
    minHeight: 96,
  },
  helper: {
    color: GarageTheme.textSubtle,
    fontSize: 12,
    lineHeight: 18,
  },
  error: {
    color: GarageTheme.danger,
    fontSize: 13,
    fontWeight: "700",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: GarageTheme.border,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    backgroundColor: GarageTheme.surfaceAlt,
  },
  secondaryButtonText: {
    color: GarageTheme.textMuted,
    fontSize: 15,
    fontWeight: "700",
  },
  primaryButton: {
    flex: 1,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    backgroundColor: GarageTheme.accent,
    minHeight: 50,
  },
  primaryButtonText: {
    color: GarageTheme.textStrong,
    fontSize: 15,
    fontWeight: "800",
  },
});
