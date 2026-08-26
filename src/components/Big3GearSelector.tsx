import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { GarageTheme } from "@/src/constants/garageTheme";
import {
  BIG3_GEAR_LABELS,
  BIG3_GEAR_OPTIONS_BY_LIFT,
  GENERAL_GEAR_OPTIONS,
  formatBig3GearSummary,
  getCompetitionBig3Lift,
  normalizeBig3GearSelection,
  type Big3GearKind,
  type Big3GearSelection,
} from "@/src/utils/Big3Gear";

type Big3GearSelectorProps = {
  lift: string | null;
  value: Big3GearSelection | null;
  onChange: (selection: Big3GearSelection) => void;
  description?: string;
};

export function Big3GearSelector({
  lift,
  value,
  onChange,
  description,
}: Big3GearSelectorProps) {
  const competitionLift = getCompetitionBig3Lift(lift);
  const [visible, setVisible] = useState(false);
  const [draftGear, setDraftGear] = useState<Big3GearKind[]>([]);
  const [draftOther, setDraftOther] = useState("");

  useEffect(() => {
    if (!visible) return;
    setDraftGear(value?.gear ?? []);
    setDraftOther(value?.other ?? "");
  }, [value, visible]);

  const summary = useMemo(() => formatBig3GearSummary(value), [value]);

  const availableOptions = competitionLift
    ? BIG3_GEAR_OPTIONS_BY_LIFT[competitionLift]
    : GENERAL_GEAR_OPTIONS;
  const title = competitionLift ? `${competitionLift} 使用ギア` : "使用ギア";

  const toggleGear = (gear: Big3GearKind) => {
    setDraftGear((current) =>
      current.includes(gear)
        ? current.filter((item) => item !== gear)
        : [...current, gear],
    );
  };

  const save = () => {
    onChange(
      normalizeBig3GearSelection({ gear: draftGear, other: draftOther }),
    );
    setVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${lift ?? "この種目"}の使用ギアを記録`}
        style={styles.summaryButton}
        onPress={() => setVisible(true)}
      >
        <View style={styles.summaryCopy}>
          <Text style={styles.label}>使用ギア</Text>
          <Text style={styles.summary} numberOfLines={2}>
            {summary}
          </Text>
        </View>
        <Text style={styles.editText}>変更</Text>
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description}>
              {description ?? `次に完了する${lift}セットへ記録し、同じ種目の次セットにも引き継ぎます。`}
            </Text>
            <ScrollView style={styles.optionScroll}>
              <View style={styles.optionGrid}>
                {availableOptions.map((gear) => {
                  const selected = draftGear.includes(gear);
                  return (
                    <TouchableOpacity
                      key={gear}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected }}
                      style={[styles.option, selected && styles.optionSelected]}
                      onPress={() => toggleGear(gear)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          selected && styles.optionTextSelected,
                        ]}
                      >
                        {selected ? "✓ " : ""}
                        {BIG3_GEAR_LABELS[gear]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.otherLabel}>その他</Text>
              <TextInput
                style={styles.otherInput}
                value={draftOther}
                onChangeText={setDraftOther}
                placeholder="例: テーピング"
                placeholderTextColor={GarageTheme.textSubtle}
                returnKeyType="done"
              />
            </ScrollView>
            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => setVisible(false)}
              >
                <Text style={styles.secondaryButtonText}>キャンセル</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} onPress={save}>
                <Text style={styles.primaryButtonText}>
                  {draftGear.length === 0 && !draftOther.trim()
                    ? "ギアなしで保存"
                    : "保存"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  summaryButton: {
    minHeight: 58,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    backgroundColor: GarageTheme.surfaceAlt,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  summaryCopy: { flex: 1, paddingRight: 12 },
  label: { color: GarageTheme.textMuted, fontSize: 12 },
  summary: { color: GarageTheme.textStrong, fontSize: 15, marginTop: 3 },
  editText: { color: GarageTheme.accentSoft, fontSize: 14, fontWeight: "700" },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    maxHeight: "80%",
    backgroundColor: GarageTheme.panel,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    padding: 18,
  },
  title: { color: GarageTheme.textStrong, fontSize: 20, fontWeight: "800" },
  description: {
    color: GarageTheme.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 14,
  },
  optionScroll: { flexGrow: 0 },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  option: {
    minHeight: 44,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    backgroundColor: GarageTheme.chip,
    alignItems: "center",
    justifyContent: "center",
  },
  optionSelected: {
    borderColor: GarageTheme.accentSoft,
    backgroundColor: "rgba(94,106,210,0.2)",
  },
  optionText: { color: GarageTheme.text, fontSize: 14 },
  optionTextSelected: { color: GarageTheme.textStrong, fontWeight: "700" },
  otherLabel: { color: GarageTheme.textMuted, fontSize: 12, marginTop: 16 },
  otherInput: {
    minHeight: 46,
    marginTop: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
    color: GarageTheme.textStrong,
    backgroundColor: GarageTheme.surface,
  },
  actions: { flexDirection: "row", gap: 10, marginTop: 18 },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: GarageTheme.borderStrong,
  },
  secondaryButtonText: { color: GarageTheme.text },
  primaryButton: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GarageTheme.accent,
  },
  primaryButtonText: { color: "#fff", fontWeight: "800" },
});
