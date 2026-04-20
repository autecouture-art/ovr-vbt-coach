/**
 * AI Coach Screen
 * Multi-modal AI coach interface with chat, form, and voice input
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Speech from 'expo-speech';
import { useTrainingStore } from '@/src/store/trainingStore';
import { AICoachChat } from '@/src/components/AICoachChat';
import { AICoachForm } from '@/src/components/AICoachForm';
import { AICoachService } from '@/src/services/AICoachService';
import DatabaseService from '@/src/services/DatabaseService';
import { GarageTheme } from '@/src/constants/garageTheme';

type InputMode = 'chat' | 'form' | 'voice';

export default function AICoachScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();

  const currentExercise = useTrainingStore((state) => state.currentExercise);
  const [mode, setMode] = useState<InputMode>('chat');
  const [lvp, setLvp] = useState<{
    slope: number;
    intercept: number;
    mvt?: number;
    r_squared: number;
    sample_count: number;
  } | null>(null);
  const [adviceResult, setAdviceResult] = useState<any>(null);

  // Load LVP data on mount
  React.useEffect(() => {
    loadLVPData();
  }, [currentExercise]);

  const loadLVPData = async () => {
    if (!currentExercise) return;

    try {
      const profile = await DatabaseService.getLVPProfile(currentExercise.name);
      if (profile) {
        setLvp({
          slope: profile.slope,
          intercept: profile.intercept,
          mvt: profile.mvt,
          r_squared: profile.r_squared,
          sample_count: profile.sample_count,
        });
      }
    } catch (error) {
      console.error('Failed to load LVP:', error);
    }
  };

  const handleAdviceGenerated = useCallback((advice: any, parsedData: any) => {
    setAdviceResult({ advice, parsedData });
  }, []);

  const handleFormSubmit = useCallback((data: {
    targetWeight: number;
    currentWeight?: number;
    currentVelocity?: number;
  }) => {
    if (!lvp) {
      Alert.alert('データ不足', 'まずは数回トレーニングしてLVPプロファイルを作成しましょう。');
      return;
    }

    const advice = AICoachService.generatePRChallengeAdvice(
      data.targetWeight,
      data.currentWeight,
      data.currentVelocity,
      lvp
    );

    setAdviceResult({
      advice,
      parsedData: data,
    });

    // Switch to result view
    setMode('chat');
  }, [lvp]);

  const handleVoiceInput = useCallback(async () => {
    // Start voice recognition
    // For now, this is a placeholder - would need to integrate with a voice recognition service
    Alert.alert(
      '音声入力',
      '音声入力機能は現在開発中です。\n\n近日中に実装予定です。',
      [
        { text: 'OK', style: 'default' },
      ]
    );
  }, []);

  const speakAdvice = useCallback((text: string) => {
    Speech.speak(text, {
      language: 'ja-JP',
      rate: 0.9,
    });
  }, []);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  if (!currentExercise) {
    return (
      <SafeAreaView style={[styles.safeArea, { paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
            <Text style={styles.headerButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>AIコーチ</Text>
          <View style={styles.headerButton} />
        </View>
        <View style={styles.centering}>
          <Text style={styles.errorText}>種目を選択してください</Text>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Text style={styles.backButtonText}>戻る</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { paddingBottom: insets.bottom }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={handleBack}>
          <Text style={styles.headerButtonText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>AIコーチ</Text>
          <Text style={styles.headerSubtitle}>{currentExercise.name}</Text>
        </View>
        <TouchableOpacity style={styles.headerButton} onPress={() => loadLVPData()}>
          <Text style={styles.refreshIcon}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Mode Selector */}
      <View style={styles.modeSelector}>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'chat' && styles.modeButtonActive]}
          onPress={() => setMode('chat')}
        >
          <Text style={[styles.modeButtonText, mode === 'chat' && styles.modeButtonTextActive]}>
            💬 チャット
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'form' && styles.modeButtonActive]}
          onPress={() => setMode('form')}
        >
          <Text style={[styles.modeButtonText, mode === 'form' && styles.modeButtonTextActive]}>
            📝 フォーム
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'voice' && styles.modeButtonActive]}
          onPress={() => setMode('voice')}
        >
          <Text style={[styles.modeButtonText, mode === 'voice' && styles.modeButtonTextActive]}>
            🎤 音声
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {mode === 'chat' && (
          <AICoachChat
            onAdviceGenerated={handleAdviceGenerated}
            lvp={lvp || undefined}
          />
        )}

        {mode === 'form' && (
          <AICoachForm
            onSubmit={handleFormSubmit}
            loading={false}
          />
        )}

        {mode === 'voice' && (
          <View style={styles.voiceContainer}>
            <View style={styles.voiceContent}>
              <Text style={styles.voiceTitle}>音声で相談</Text>
              <Text style={styles.voiceDescription}>
                今日のPR挑戦について音声で入力できます
              </Text>

              <TouchableOpacity style={styles.voiceButton} onPress={handleVoiceInput}>
                <Text style={styles.voiceButtonText}>🎤 録音開始</Text>
              </TouchableOpacity>

              <View style={styles.voiceTips}>
                <Text style={styles.voiceTipsTitle}>入力例：</Text>
                <Text style={styles.voiceTipsText}>• 「ベンチプレスで110kgのPRを狙いたい」</Text>
                <Text style={styles.voiceTipsText}>• 「100kgで0.35m/s出たから110kgいける？」</Text>
                <Text style={styles.voiceTipsText}>• 「今日の調子で何キロまでいける？」</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Result Panel */}
      {adviceResult && (
        <View style={styles.resultPanel}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle}>{adviceResult.advice.emoji} アドバイス</Text>
            <TouchableOpacity onPress={() => speakAdvice(adviceResult.advice.message)}>
              <Text style={styles.speakButton}>🔊</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.resultContent}>
            <Text style={styles.resultText}>{adviceResult.advice.message}</Text>
            {adviceResult.advice.suggestedAction && (
              <Text style={styles.resultAction}>
                💡 {adviceResult.advice.suggestedAction}
              </Text>
            )}
          </ScrollView>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setAdviceResult(null)}
          >
            <Text style={styles.closeButtonText}>閉じる</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: GarageTheme.colors.background,
  },
  centering: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: GarageTheme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: GarageTheme.colors.border,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonText: {
    fontSize: 24,
    color: GarageTheme.colors.text,
    fontWeight: 'bold',
  },
  refreshIcon: {
    fontSize: 20,
    color: GarageTheme.colors.textSecondary,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: GarageTheme.colors.text,
  },
  headerSubtitle: {
    fontSize: 14,
    color: GarageTheme.colors.textSecondary,
    marginTop: 2,
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: GarageTheme.colors.card,
    borderBottomWidth: 1,
    borderBottomColor: GarageTheme.colors.border,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  modeButtonActive: {
    borderBottomColor: GarageTheme.colors.primary,
  },
  modeButtonText: {
    fontSize: 14,
    color: GarageTheme.colors.textSecondary,
    fontWeight: '600',
  },
  modeButtonTextActive: {
    color: GarageTheme.colors.primary,
  },
  content: {
    flex: 1,
  },
  voiceContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  voiceContent: {
    alignItems: 'center',
    width: '100%',
  },
  voiceTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: GarageTheme.colors.text,
    marginBottom: 8,
  },
  voiceDescription: {
    fontSize: 16,
    color: GarageTheme.colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
  },
  voiceButton: {
    backgroundColor: GarageTheme.colors.primary,
    paddingHorizontal: 48,
    paddingVertical: 20,
    borderRadius: 30,
    marginBottom: 32,
  },
  voiceButtonText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: 'bold',
  },
  voiceTips: {
    backgroundColor: GarageTheme.colors.card,
    borderRadius: 12,
    padding: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: GarageTheme.colors.border,
  },
  voiceTipsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: GarageTheme.colors.text,
    marginBottom: 12,
  },
  voiceTipsText: {
    fontSize: 14,
    color: GarageTheme.colors.textSecondary,
    marginBottom: 8,
    lineHeight: 20,
  },
  resultPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: GarageTheme.colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: GarageTheme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    maxHeight: '50%',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: GarageTheme.colors.text,
  },
  speakButton: {
    fontSize: 24,
  },
  resultContent: {
    maxHeight: 200,
    marginBottom: 16,
  },
  resultText: {
    fontSize: 15,
    color: GarageTheme.colors.text,
    lineHeight: 22,
    marginBottom: 12,
  },
  resultAction: {
    fontSize: 14,
    color: GarageTheme.colors.primary,
    fontWeight: '600',
    fontStyle: 'italic',
  },
  closeButton: {
    backgroundColor: GarageTheme.colors.border,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeButtonText: {
    color: GarageTheme.colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    color: GarageTheme.colors.accent,
    textAlign: 'center',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: GarageTheme.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
