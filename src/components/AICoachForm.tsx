/**
 * AICoachForm Component
 * Form interface for AI Coach with structured input
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { GarageTheme } from '@/src/constants/garageTheme';

export interface FormData {
  targetWeight: string;
  currentWeight: string;
  currentVelocity: string;
}

interface AICoachFormProps {
  onSubmit: (data: {
    targetWeight: number;
    currentWeight?: number;
    currentVelocity?: number;
  }) => void;
  loading?: boolean;
}

export function AICoachForm({ onSubmit, loading }: AICoachFormProps) {
  const [formData, setFormData] = useState<FormData>({
    targetWeight: '',
    currentWeight: '',
    currentVelocity: '',
  });

  const [showOptional, setShowOptional] = useState(false);

  const handleSubmit = () => {
    const targetWeight = parseFloat(formData.targetWeight);
    const currentWeight = formData.currentWeight ? parseFloat(formData.currentWeight) : undefined;
    const currentVelocity = formData.currentVelocity ? parseFloat(formData.currentVelocity) : undefined;

    if (isNaN(targetWeight) || targetWeight <= 0) {
      return;
    }

    onSubmit({
      targetWeight,
      currentWeight,
      currentVelocity,
    });
  };

  const isFormValid = () => {
    const targetWeight = parseFloat(formData.targetWeight);
    return !isNaN(targetWeight) && targetWeight > 0;
  };

  const quickPresets = [
    { label: 'ベンチプレス +10kg', target: '+10' },
    { label: 'スクワット +10kg', target: '+10' },
    { label: 'デッドリフト +10kg', target: '+10' },
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 目標重量</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={formData.targetWeight}
              onChangeText={(text) => setFormData({ ...formData, targetWeight: text })}
              placeholder="110"
              placeholderTextColor={GarageTheme.colors.textSecondary}
              keyboardType="decimal-pad"
              autoFocus
            />
            <Text style={styles.unit}>kg</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.optionalToggle}
          onPress={() => setShowOptional(!showOptional)}
        >
          <Text style={styles.optionalToggleText}>
            {showOptional ? '▼' : '▶'} 現在のパフォーマンスを入力（任意）
          </Text>
        </TouchableOpacity>

        {showOptional && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>現在の重量</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={formData.currentWeight}
                onChangeText={(text) => setFormData({ ...formData, currentWeight: text })}
                placeholder="100"
                placeholderTextColor={GarageTheme.colors.textSecondary}
                keyboardType="decimal-pad"
              />
              <Text style={styles.unit}>kg</Text>
            </View>

            <Text style={styles.sectionTitle} style={{ marginTop: 16 }}>
              その重量での速度
            </Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={formData.currentVelocity}
                onChangeText={(text) => setFormData({ ...formData, currentVelocity: text })}
                placeholder="0.35"
                placeholderTextColor={GarageTheme.colors.textSecondary}
                keyboardType="decimal-pad"
              />
              <Text style={styles.unit}>m/s</Text>
            </View>
          </View>
        )}

        {!showOptional && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>クイックプリセット</Text>
            <View style={styles.presetsContainer}>
              {quickPresets.map((preset, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.presetButton}
                  onPress={() => {
                    // This would need to know current max to calculate target
                    // For now just a placeholder
                  }}
                >
                  <Text style={styles.presetButtonText}>{preset.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.infoBox}>
          <Text style={styles.infoIcon}>💡</Text>
          <Text style={styles.infoText}>
            現在の重量と速度を入力すると、より正確なアドバイスがもらえます。
            入力しない場合は、LVPプロファイルに基づいた一般的なアドバイスになります。
          </Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, (!isFormValid() || loading) && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!isFormValid() || loading}
        >
          <Text style={styles.submitButtonText}>
            {loading ? '計算中...' : 'アドバイスをもらう'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: GarageTheme.colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: GarageTheme.colors.text,
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GarageTheme.colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: GarageTheme.colors.border,
  },
  input: {
    flex: 1,
    fontSize: 18,
    color: GarageTheme.colors.text,
    paddingVertical: 14,
  },
  unit: {
    fontSize: 16,
    color: GarageTheme.colors.textSecondary,
    marginLeft: 8,
  },
  optionalToggle: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: GarageTheme.colors.card,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: GarageTheme.colors.border,
  },
  optionalToggleText: {
    fontSize: 14,
    color: GarageTheme.colors.textSecondary,
  },
  presetsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -8,
  },
  presetButton: {
    backgroundColor: GarageTheme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginHorizontal: 8,
    marginBottom: 8,
  },
  presetButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: GarageTheme.colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: GarageTheme.colors.border,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: GarageTheme.colors.textSecondary,
    lineHeight: 20,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: GarageTheme.colors.border,
    backgroundColor: GarageTheme.colors.card,
  },
  submitButton: {
    backgroundColor: GarageTheme.colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: GarageTheme.colors.border,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
