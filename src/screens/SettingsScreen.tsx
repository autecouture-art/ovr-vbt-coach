/**
 * Settings Screen
 * App configuration and preferences
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings } from '../types/index';

interface SettingsScreenProps {
  navigation: any;
}

const SETTINGS_KEY = '@app_settings';

const defaultSettings: AppSettings = {
  use_metric: true,
  velocity_loss_threshold: 20,
  enable_audio_feedback: true,
  enable_voice_commands: false,
  enable_video_recording: false,
  target_training_phase: 'hypertrophy',
};

const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        setSettings(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const saveSettings = async (newSettings: AppSettings) => {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Failed to save settings:', error);
      Alert.alert('エラー', '設定の保存に失敗しました');
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

  const handlePhaseChange = (phase: AppSettings['target_training_phase']) => {
    const newSettings = { ...settings, target_training_phase: phase };
    saveSettings(newSettings);
  };

  const thresholdOptions = [10, 15, 20, 25, 30];
  const phaseOptions: Array<{
    value: AppSettings['target_training_phase'];
    label: string;
    description: string;
  }> = [
    { value: 'power', label: 'パワー', description: '最大パワー出力の向上' },
    { value: 'hypertrophy', label: '筋肥大', description: '筋肉量の増加' },
    { value: 'strength', label: '筋力', description: '最大筋力の向上' },
    { value: 'peaking', label: 'ピーキング', description: '競技パフォーマンスの最大化' },
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
            onValueChange={() => handleToggle('use_metric')}
            trackColor={{ false: '#444', true: '#2196F3' }}
            thumbColor={settings.use_metric ? '#fff' : '#ccc'}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>音声フィードバック</Text>
            <Text style={styles.settingDescription}>レップ完了時に音声通知</Text>
          </View>
          <Switch
            value={settings.enable_audio_feedback}
            onValueChange={() => handleToggle('enable_audio_feedback')}
            trackColor={{ false: '#444', true: '#2196F3' }}
            thumbColor={settings.enable_audio_feedback ? '#fff' : '#ccc'}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>音声コマンド</Text>
            <Text style={styles.settingDescription}>音声でアプリを操作（未対応）</Text>
          </View>
          <Switch
            value={settings.enable_voice_commands}
            onValueChange={() => handleToggle('enable_voice_commands')}
            trackColor={{ false: '#444', true: '#2196F3' }}
            thumbColor={settings.enable_voice_commands ? '#fff' : '#ccc'}
            disabled
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>ビデオ録画</Text>
            <Text style={styles.settingDescription}>フォーム分析用の録画（未対応）</Text>
          </View>
          <Switch
            value={settings.enable_video_recording}
            onValueChange={() => handleToggle('enable_video_recording')}
            trackColor={{ false: '#444', true: '#2196F3' }}
            thumbColor={settings.enable_video_recording ? '#fff' : '#ccc'}
            disabled
          />
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
          <Text style={styles.aboutTitle}>RepVelo VBT Coach</Text>
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
    backgroundColor: '#1a1a1a',
  },
  header: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    color: '#2196F3',
    fontSize: 16,
    marginRight: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2196F3',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
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
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    color: '#999',
  },
  settingBlock: {
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  optionButton: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#444',
  },
  optionButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  optionButtonText: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
  },
  optionButtonTextActive: {
    color: '#fff',
  },
  phaseCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  phaseCardActive: {
    borderColor: '#4CAF50',
    backgroundColor: '#1a3a1a',
  },
  phaseInfo: {
    flex: 1,
  },
  phaseLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  phaseDescription: {
    fontSize: 12,
    color: '#999',
  },
  checkmark: {
    fontSize: 24,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  aboutCard: {
    backgroundColor: '#2a2a2a',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
  },
  aboutTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  aboutVersion: {
    fontSize: 14,
    color: '#2196F3',
    marginBottom: 16,
  },
  aboutDescription: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});

export default SettingsScreen;
