import React from "react";
import {
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { GarageTheme } from "@/src/constants/garageTheme";
import {
  normalizeVelocityLossThreshold,
  VELOCITY_LOSS_THRESHOLD_OPTIONS,
} from "@/src/utils/VelocityLossThreshold";

type Props = {
  value: number;
  onChange: (value: number) => void;
  recommendedValue?: number | null;
  onApplyRecommended?: () => void;
  compact?: boolean;
};

export function VelocityLossThresholdPicker({
  value,
  onChange,
  recommendedValue,
  onApplyRecommended,
  compact = false,
}: Props) {
  const normalizedValue = normalizeVelocityLossThreshold(value);
  const normalizedRecommendation =
    recommendedValue == null
      ? null
      : normalizeVelocityLossThreshold(recommendedValue);
  const selectedIndex = normalizedValue - VELOCITY_LOSS_THRESHOLD_OPTIONS[0];
  const itemHeight = compact ? 34 : 40;

  const handleMomentumEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const index = Math.round(event.nativeEvent.contentOffset.y / itemHeight);
    const threshold = VELOCITY_LOSS_THRESHOLD_OPTIONS[index];
    if (threshold != null && threshold !== normalizedValue) {
      onChange(threshold);
    }
  };

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      <View style={styles.summaryRow}>
        <Text style={styles.valueText}>現在 {normalizedValue}%</Text>
        {normalizedRecommendation != null && (
          <TouchableOpacity
            style={styles.recommendationButton}
            onPress={onApplyRecommended}
            disabled={!onApplyRecommended}
            accessibilityLabel={`監督推奨VL ${normalizedRecommendation}%を適用`}
          >
            <Text style={styles.recommendationText}>
              監督推奨 {normalizedRecommendation}%
            </Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={[styles.wheel, { height: itemHeight * 3 }]}>
        <FlatList
          key={`${normalizedValue}-${compact ? "compact" : "regular"}`}
          data={VELOCITY_LOSS_THRESHOLD_OPTIONS}
          keyExtractor={(threshold) => String(threshold)}
          initialScrollIndex={selectedIndex}
          getItemLayout={(_, index) => ({
            length: itemHeight,
            offset: itemHeight * index,
            index,
          })}
          onMomentumScrollEnd={handleMomentumEnd}
          snapToInterval={itemHeight}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingVertical: itemHeight,
          }}
          renderItem={({ item: threshold }) => {
          const selected = normalizedValue === threshold;
          const recommended = normalizedRecommendation === threshold;
          return (
            <TouchableOpacity
              key={threshold}
              style={[styles.option, { height: itemHeight }, selected && styles.optionSelected, recommended && !selected && styles.optionRecommended]}
              onPress={() => onChange(threshold)}
              accessibilityLabel={`VL ${threshold}%`}
              accessibilityState={{ selected }}
            >
              <Text
                style={[
                  styles.optionText,
                  selected && styles.optionTextSelected,
                  recommended && !selected && styles.optionTextRecommended,
                ]}
              >
                {threshold}%
              </Text>
            </TouchableOpacity>
          );
          }}
        />
        <View pointerEvents="none" style={[styles.selectionGuide, { top: itemHeight, height: itemHeight }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  containerCompact: {
    gap: 6,
  },
  summaryRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  valueText: {
    color: GarageTheme.textStrong,
    fontSize: 13,
    fontWeight: "700",
  },
  recommendationButton: {
    borderColor: GarageTheme.accentSoft,
    borderRadius: 6,
    borderWidth: 1,
    minHeight: 36,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  recommendationText: {
    color: GarageTheme.accentSoft,
    fontSize: 12,
    fontWeight: "700",
  },
  wheel: {
    overflow: "hidden",
    position: "relative",
  },
  option: {
    alignItems: "center",
    backgroundColor: GarageTheme.surface,
    borderColor: GarageTheme.border,
    borderRadius: 6,
    borderWidth: 1,
    justifyContent: "center",
    minWidth: 72,
    paddingHorizontal: 8,
  },
  optionSelected: {
    backgroundColor: GarageTheme.accent,
    borderColor: GarageTheme.accent,
  },
  optionRecommended: {
    borderColor: GarageTheme.accentSoft,
  },
  optionText: {
    color: GarageTheme.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  optionTextSelected: {
    color: GarageTheme.textStrong,
  },
  optionTextRecommended: {
    color: GarageTheme.accentSoft,
  },
  selectionGuide: {
    borderColor: GarageTheme.accent,
    borderRadius: 6,
    borderWidth: 1,
    left: 0,
    position: "absolute",
    right: 0,
  },
});
