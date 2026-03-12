/**
 * VBT Session Screen
 * Refactored to use useSessionLogic and trainingStore
 * UI is now a "Dumb Component" driven by global state
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTrainingStore } from '@/src/store/trainingStore';
import { useSessionLogic } from '@/src/hooks/useSessionLogic';
import { ExerciseSelectModal } from '@/src/components/ExerciseSelectModal';
import PRNotification from '@/src/components/PRNotification';
import DatabaseService from '@/src/services/DatabaseService';
import AICoachService from '@/src/services/AICoachService';
import { RepDetailModal } from '@/src/components/RepDetailModal';
import { RepVelocityChart } from '@/src/components/RepVelocityChart';
import {
  getExerciseCategoryLabel,
  getLocalizedExerciseName,
} from '@/src/utils/exerciseLocalization';
import { calculateWarmupSteps, isBig3 } from '@/src/utils/WarmupLogic';
import type { Exercise, PRRecord, RepData, SetData } from '@/src/types/index';

export default function SessionScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const lastNavigateAtRef = useRef(0);

  // PR検知時のモーダル状態
  const [prRecord, setPRRecord] = useState<PRRecord | null>(null);
  const [showPRModal, setShowPRModal] = useState(false);

  // Custom Hook for Logic（PR検知コールバックを渡す）
  const {
    finishSet,
    startSet,
    resumeSet,
    handleExcludeRep,
    handleMarkFailedRep,
    calculateAndProposeMVT
  } = useSessionLogic((pr: PRRecord) => {
    setPRRecord(pr);
    setShowPRModal(true);
  });

  // Global State
  const {
    currentSetIndex,
    isConnected,
    liveData,
    currentExercise,
    currentLoad,
    currentReps,
    setHistory,
    currentSession,
    isSessionActive,
    sessionStartTime,
    currentLift,
    updateLoad,
    updateSettings,
    targetWeight,
    setTargetWeight,
    currentHeartRate,
    restStartTime,
    sessionHRPoints,
    repHistory,
    setCurrentExercise,
    startSession,
    endSession,
    isPaused,
    setPaused,
    pauseReason,

    // VBT Intelligence
    cnsBattery,
    estimated1RM,
    estimated1RM_confidence,
    suggestedLoad,
    proposedMVT,
    setProposedMVT,
    settings,
  } = useTrainingStore();

  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [focusMode, setFocusMode] = useState(true);

  // レップ詳細モーダルの状態
  const [repDetailVisible, setRepDetailVisible] = useState(false);
  const [selectedSetIndex, setSelectedSetIndex] = useState<number>(1);

  // Fetch all reps on mount or when returning
  const [sessionAllReps, setSessionAllReps] = useState<RepData[]>([]);

  useEffect(() => {
    if (currentSession?.session_id) {
      DatabaseService.getRepsForSession(currentSession.session_id).then(setSessionAllReps);
    }
  }, [currentSession?.session_id, setHistory.length]);

  useEffect(() => {
    if (isSessionActive) {
      setFocusMode(true);
    }
  }, [currentSession?.session_id, isSessionActive]);

  const [inputTargetWeight, setInputTargetWeight] = useState('');
  const [inputLoad, setInputLoad] = useState('');
  const phaseOptions = [
    { value: 'power', label: 'パワー' },
    { value: 'hypertrophy', label: '筋肥大' },
    { value: 'strength', label: '筋力' },
    { value: 'peaking', label: 'ピーク' },
  ] as const;
  const vlOptions = [5, 10, 15, 20, 25, 30];
  const recommendedVlThreshold = AICoachService.getVlThresholdByExercise(currentExercise?.category || '');
  const firstRepVelocity = repHistory.length >= 1 ? repHistory[0]?.mean_velocity ?? null : null;
  const lastRepVelocity =
    repHistory.length >= 1 ? repHistory[repHistory.length - 1]?.mean_velocity ?? null : null;
  const currentVelocityLoss =
    repHistory.length >= 2 &&
    firstRepVelocity !== null &&
    firstRepVelocity > 0 &&
    lastRepVelocity !== null
      ? ((firstRepVelocity - lastRepVelocity) / firstRepVelocity) * 100
      : null;
  const currentSetRepCount = repHistory.filter((rep) => !rep.is_excluded).length;
  const latestReviewableSetIndex =
    currentSetRepCount > 0
      ? currentSetIndex
      : setHistory.length > 0
        ? setHistory[setHistory.length - 1].set_index
        : null;
  const focusVelocity = liveData?.mean_velocity ?? lastRepVelocity;
  const focusPeakVelocity = liveData?.peak_velocity ?? repHistory[repHistory.length - 1]?.peak_velocity ?? null;
  const focusZone = focusVelocity !== null ? AICoachService.getZone(focusVelocity) : null;
  const localizedExerciseName = getLocalizedExerciseName(currentExercise?.name);
  const localizedExerciseCategory = getExerciseCategoryLabel(currentExercise?.category);
  const repModalReps = useMemo(() => {
    const merged = new Map<string, RepData>();

    for (const rep of sessionAllReps) {
      merged.set(String(rep.id ?? rep.rep_index), rep);
    }

    for (const rep of repHistory) {
      merged.set(String(rep.id ?? rep.rep_index), rep);
    }

    return Array.from(merged.values()).sort((a, b) => {
      if (a.set_index === b.set_index) {
        return a.rep_index - b.rep_index;
      }
      return a.set_index - b.set_index;
    });
  }, [repHistory, sessionAllReps]);
  const formatLoad = (value: number) =>
    Number.isInteger(value) ? value.toString() : value.toFixed(1);

  // Sync input with store
  useEffect(() => {
    setInputLoad(formatLoad(currentLoad));
  }, [currentLoad]);

  useEffect(() => {
    if (targetWeight !== null) {
      setInputTargetWeight(formatLoad(targetWeight));
    } else {
      setInputTargetWeight('');
    }
  }, [targetWeight]);

  const handleTargetWeightChange = (text: string) => {
    setInputTargetWeight(text);
    const val = parseFloat(text.replace(',', '.'));
    if (!isNaN(val)) setTargetWeight(val);
    else setTargetWeight(null);
  };

  const adjustLoad = (amount: number) => {
    const newLoad = Math.max(0, Math.round((currentLoad + amount) * 2) / 2);
    updateLoad(newLoad);
  };

  const openRepDetail = (setIndex: number) => {
    setSelectedSetIndex(setIndex);
    setRepDetailVisible(true);
  };

  const handleLoadChange = (text: string) => {
    setInputLoad(text);
    const val = parseFloat(text.replace(',', '.'));
    if (!isNaN(val)) updateLoad(val);
  };

  const handleExerciseSelect = (exercise: Exercise) => {
    setCurrentExercise(exercise);
    setShowExerciseModal(false);
  };

  const handleExclude = async (repId: string, reason: string) => {
    await handleExcludeRep(repId, reason);
    // Reload reps
    if (currentSession?.session_id) {
      DatabaseService.getRepsForSession(currentSession.session_id).then(setSessionAllReps);
    }
  };

  // セッション開始処理
  const handleStartSession = async () => {
    if (!isConnected) {
      Alert.alert('センサー未接続', 'BLEセンサーを接続してからセッションを開始してください。');
      return;
    }
    // UUID風のセッションIDを生成
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    startSession(sessionId);
    // DBにセッションレコードを作成
    try {
      await DatabaseService.insertSession({
        session_id: sessionId,
        date: new Date().toISOString().split('T')[0],
        total_volume: 0,
        total_sets: 0,
        lifts: [],
      });
    } catch (e) {
      console.error('セッション作成失敗:', e);
    }
  };

  const handleFinishSet = () => {
    if (!isSessionActive) {
      Alert.alert('セッション未開始', 'まずセッションを開始してください。');
      return;
    }
    finishSet();
  };

  // セッション終了 & DBへの集計保存
  const handleFinishSession = async () => {
    if (setHistory.length === 0) {
      Alert.alert('セッション終了', 'セットが記録されていません。終了しますか？', [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '終了', style: 'destructive', onPress: () => {
            endSession();
            router.back();
          }
        },
      ]);
      return;
    }

    // MVTの計算と提案（セッション終了時に行う）
    try {
      await calculateAndProposeMVT();
    } catch (e) {
      console.error('MVT提案計算に失敗（セッション終了は継続します）:', e);
    }

    // セッション集計をDBに更新
    if (currentSession?.session_id) {
      try {
        const totalVolume = setHistory.reduce((sum, s) => sum + (s.load_kg * s.reps), 0);
        const durationMs = sessionStartTime ? Date.now() - sessionStartTime : 0;
        const durationMin = Math.round(durationMs / 60000);
        const avgHr = sessionHRPoints.length > 0 ? sessionHRPoints.reduce((s, x) => s + x, 0) / sessionHRPoints.length : undefined;

        await DatabaseService.updateSession({
          session_id: currentSession.session_id,
          date: currentSession.date || new Date().toISOString().split('T')[0],
          total_volume: totalVolume,
          total_sets: setHistory.length,
          duration_minutes: durationMin,
          duration_seconds: Math.round(durationMs / 1000),
          start_timestamp: currentSession.start_timestamp,
          end_timestamp: new Date().toISOString(),
          avg_hr: avgHr,
          notes: currentSession.notes,
        });
      } catch (e) {
        console.error('セッション集計の保存に失敗:', e);
      }
    }

    endSession();
    Alert.alert('セッション完了', `${setHistory.length}セットを保存しました。`, [
      { text: 'OK', onPress: () => router.back() }
    ]);
  };

  const handleAcceptMVT = async () => {
    if (!currentLift || proposedMVT === null) return;
    try {
      const existingLvp = await DatabaseService.getLVPProfile(currentLift);
      if (existingLvp) {
        await DatabaseService.saveLVPProfile({
          ...existingLvp,
          mvt: proposedMVT,
          last_updated: new Date().toISOString()
        });
        Alert.alert('MVT更新', `${getLocalizedExerciseName(currentLift)}の限界速度を ${proposedMVT}m/s に更新しました。`);
        setProposedMVT(null); // バナーを閉じる
      }
    } catch (e) {
      console.error('MVT更新失敗:', e);
    }
  };

  const navigateSafely = (action: () => void) => {
    const now = Date.now();
    if (now - lastNavigateAtRef.current < 600) return;
    lastNavigateAtRef.current = now;
    action();
  };

  return (
    <ScrollView style={styles.container}>
      <View style={[styles.header, { paddingTop: (insets.top || 0) + 12 }]}>
        <TouchableOpacity onPress={() => navigateSafely(() => router.back())} style={styles.backButton}>
          <Text style={styles.backButtonText}>← 戻る</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerEyebrow}>RUN CONTROL</Text>
          <Text style={styles.title}>セッション</Text>
        </View>
        <View style={styles.headerActions}>
          {isSessionActive && (
            <TouchableOpacity
              style={styles.focusToggleButton}
              onPress={() => setFocusMode((current) => !current)}
            >
              <Text style={styles.focusToggleButtonText}>{focusMode ? '詳細' : '集中'}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.coachNavButton}
            onPress={() => navigateSafely(() => router.push('/coach-chat' as any))}
          >
            <Text style={styles.coachNavButtonText}>🤖 AI</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Connection Status */}
      <View style={styles.statusCard}>
        <Text style={styles.panelEyebrow}>TELEMETRY LINK</Text>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isConnected ? '#4CAF50' : '#F44336' },
            ]}
          />
          <Text style={styles.statusText}>
            {isConnected ? 'センサー接続中' : 'センサー未接続'}
          </Text>
        </View>
        {currentHeartRate && (
          <View style={styles.hrBadge}>
            <Text style={styles.hrEmoji}>❤️</Text>
            <Text style={styles.hrValue}>{Math.round(currentHeartRate)}</Text>
            <Text style={styles.hrUnit}>bpm</Text>
          </View>
        )}
      </View>

      {/* セッション開始バナー */}
      {!isSessionActive ? (
        <View style={styles.sessionStartBanner}>
          <Text style={styles.bannerEyebrow}>GRID READY</Text>
          <Text style={styles.sessionStartText}>セッションを開始してください</Text>
          <TouchableOpacity
            style={[styles.button, styles.startSessionButton]}
            onPress={handleStartSession}
          >
            <Text style={styles.buttonText}>🏋️ セッション開始</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.sessionActiveBanner}>
          <Text style={styles.bannerEyebrow}>LIVE LAP</Text>
          <Text style={styles.sessionActiveText}>
            ✅ セット {currentSetIndex} 記録中
          </Text>
          <TouchableOpacity
            style={[styles.pauseBtn, isPaused && styles.pausedBtnActive]}
            onPress={() => {
              if (isPaused) {
                // 再開時：履歴を保持するため resumeSet を使用
                resumeSet();
              } else {
                // 一時停止時はsetPausedを使用
                setPaused(true, 'manual');
              }
            }}
          >
            <View style={styles.pauseBtnContent}>
              <Text style={styles.pauseBtnIcon}>{isPaused ? '▶' : '⏸'}</Text>
              <Text style={styles.pauseBtnText}>{isPaused ? '再開' : '一時停止'}</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* CNS Battery & VBT Intelligence Summary */}
      {isSessionActive && (
        <View style={styles.intelligenceRow}>
          <View style={styles.cnsBatteryContainer}>
            <Text style={styles.cnsLabel}>CNS BATTERY™</Text>
            <View style={styles.batteryGageBg}>
              <View style={[styles.batteryGageFill, { width: `${cnsBattery}%`, backgroundColor: cnsBattery > 70 ? '#4CAF50' : cnsBattery > 40 ? '#FF9800' : '#F44336' }]} />
            </View>
            <Text style={styles.cnsValue}>{cnsBattery}%</Text>
          </View>

          {estimated1RM !== null && (
            <View style={styles.intelligenceBadge}>
              <Text style={styles.intelligenceLabel}>本日予想 1RM</Text>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <Text style={styles.intelligenceValue}>{estimated1RM}</Text>
                <Text style={styles.unitSmall}>kg</Text>
              </View>
              {estimated1RM_confidence && (
                <View style={[
                  styles.confidenceIndicator,
                  { backgroundColor: estimated1RM_confidence === 'high' ? '#4CAF50' : estimated1RM_confidence === 'medium' ? '#FF9800' : '#F44336' }
                ]}>
                  <Text style={styles.confidenceText}>
                    {estimated1RM_confidence === 'high' ? 'High' : estimated1RM_confidence === 'medium' ? 'Med' : 'Low'}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Adaptive Load Suggestion */}
      {isSessionActive && suggestedLoad !== null && suggestedLoad !== currentLoad && (
        <TouchableOpacity
          style={styles.suggestionBanner}
          onPress={() => handleLoadChange(suggestedLoad.toString())}
        >
          <View style={styles.suggestionContent}>
            <Text style={styles.suggestionEmoji}>💡</Text>
            <Text style={styles.suggestionText}>
              推奨重量: <Text style={styles.suggestionWeight}>{suggestedLoad}kg</Text> に変更しますか？
            </Text>
          </View>
          <Text style={styles.applyText}>適用する</Text>
        </TouchableOpacity>
      )}

      {/* MVT Proposal Banner */}
      {!isSessionActive && proposedMVT !== null && currentLift && (
        <View style={[styles.suggestionBanner, { backgroundColor: '#4C1D95', borderLeftColor: '#8B5CF6' }]}>
          <View style={styles.suggestionContent}>
            <Text style={styles.suggestionEmoji}>🎯</Text>
            <View>
              <Text style={styles.suggestionText}>
                {getLocalizedExerciseName(currentLift)}の新しい限界速度(MVT)候補:
              </Text>
              <Text style={[styles.suggestionWeight, { color: '#C4B5FD', fontSize: 16 }]}>{proposedMVT} m/s</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={() => setProposedMVT(null)}>
              <Text style={[styles.applyText, { color: '#9CA3AF' }]}>無視</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleAcceptMVT}>
              <Text style={[styles.applyText, { color: '#C4B5FD', fontSize: 14 }]}>更新する</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Rest Timer Banner */}
      {isSessionActive && isPaused && pauseReason === 'rest' && (
        <View style={styles.restBanner}>
          <View style={styles.restHeader}>
            <Text style={styles.restLabel}>RESTING...</Text>
            <RestTimer startTime={restStartTime || 0} hr={currentHeartRate} peakHr={setHistory.length > 0 ? setHistory[setHistory.length - 1].peak_hr : null} />
          </View>
          <TouchableOpacity
            style={styles.startNextSetButton}
            onPress={startSet}
          >
            <Text style={styles.startNextSetText}>次のセットを開始</Text>
          </TouchableOpacity>
        </View>
      )}

      {isSessionActive && focusMode && (
        <View style={styles.focusHud}>
          <View style={styles.focusHudHeader}>
            <View>
              <Text style={styles.panelEyebrow}>FOCUS VIEW</Text>
              <Text style={styles.focusExerciseName}>{localizedExerciseName}</Text>
              <Text style={styles.focusExerciseMeta}>
                {localizedExerciseCategory} · {formatLoad(currentLoad)}kg
              </Text>
            </View>
            <View style={styles.focusSetBadge}>
              <Text style={styles.focusSetBadgeLabel}>SET</Text>
              <Text style={styles.focusSetBadgeValue}>{currentSetIndex}</Text>
            </View>
          </View>

          <View style={styles.focusMainRow}>
            <View style={styles.focusVelocityCard}>
              <Text style={styles.focusMetricLabel}>速度</Text>
              <Text style={[styles.focusVelocityValue, focusZone ? { color: focusZone.color } : null]}>
                {focusVelocity !== null ? focusVelocity.toFixed(2) : '--'}
              </Text>
              <Text style={styles.focusMetricUnit}>m/s</Text>
            </View>
            <View style={styles.focusRepCard}>
              <Text style={styles.focusMetricLabel}>REP</Text>
              <Text style={styles.focusRepValue}>{currentSetRepCount}</Text>
              <Text style={styles.focusMetricUnit}>count</Text>
            </View>
          </View>

          <View style={styles.focusStatsRow}>
            <View style={styles.focusStatPill}>
              <Text style={styles.focusStatLabel}>Peak</Text>
              <Text style={styles.focusStatValue}>
                {focusPeakVelocity !== null ? `${focusPeakVelocity.toFixed(2)} m/s` : '--'}
              </Text>
            </View>
            <View style={styles.focusStatPill}>
              <Text style={styles.focusStatLabel}>VL</Text>
              <Text
                style={[
                  styles.focusStatValue,
                  currentVelocityLoss !== null && currentVelocityLoss >= settings.velocity_loss_threshold
                    ? styles.focusStatValueDanger
                    : null,
                ]}
              >
                {currentVelocityLoss !== null ? `${currentVelocityLoss.toFixed(1)}%` : '待機中'}
              </Text>
            </View>
            <View style={styles.focusStatPill}>
              <Text style={styles.focusStatLabel}>ROM</Text>
              <Text style={styles.focusStatValue}>
                {liveData ? `${liveData.rom_cm.toFixed(0)} cm` : '--'}
              </Text>
            </View>
          </View>

          <View style={styles.focusActionRow}>
            {latestReviewableSetIndex !== null && (
              <TouchableOpacity
                style={[styles.focusActionButton, styles.focusActionButtonPrimary]}
                onPress={() => openRepDetail(latestReviewableSetIndex)}
              >
                <Text style={styles.focusActionButtonText}>
                  {currentSetRepCount > 0 ? '現在セット REP詳細' : '前セット REP詳細'}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.focusActionButton, styles.focusActionButtonSecondary]}
              onPress={handleFinishSet}
            >
              <Text style={styles.focusActionButtonText}>セット完了</Text>
            </TouchableOpacity>
          </View>

          {repHistory.length > 0 && (
            <View style={styles.focusChartWrap}>
              <RepVelocityChart reps={repHistory} setIndex={currentSetIndex} />
            </View>
          )}
        </View>
      )}

      {/* Exercise Selection */}
      {(!isSessionActive || !focusMode) && (
      <View style={styles.exerciseCard}>
        <Text style={styles.panelEyebrow}>CURRENT LIFT</Text>
        <Text style={styles.exerciseLabel}>種目</Text>
        {currentExercise ? (
          <TouchableOpacity
            style={styles.exerciseSelector}
            onPress={() => setShowExerciseModal(true)}
          >
            <View style={styles.exerciseInfo}>
              <Text style={styles.exerciseName}>{localizedExerciseName}</Text>
              <Text style={styles.exerciseCategory}>
                {localizedExerciseCategory}
              </Text>
            </View>
            <Text style={styles.exerciseChange}>変更</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.exerciseSelectButton}
            onPress={() => setShowExerciseModal(true)}
          >
            <Text style={styles.exerciseSelectButtonText}>種目を選択</Text>
          </TouchableOpacity>
        )}
      </View>
      )}

      {/* Target Weight Input (Big 3 Only) */}
      {isBig3(currentExercise?.category) && isSessionActive && !focusMode && (
        <View style={styles.targetWeightCard}>
          <Text style={styles.panelEyebrow}>TARGET LOAD</Text>
          <Text style={styles.targetWeightLabel}>今日の目標重量 (Top Set)</Text>
          <View style={styles.targetInputRow}>
            <TextInput
              style={styles.targetInput}
              value={inputTargetWeight}
              onChangeText={handleTargetWeightChange}
              placeholder="最高重量を入力"
              placeholderTextColor="#666"
              keyboardType="numeric"
            />
            <Text style={styles.unitText}>kg</Text>
          </View>
        </View>
      )}

      {/* Warmup Guide */}
      {isBig3(currentExercise?.category) && targetWeight && isSessionActive && !focusMode && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ウォームアップガイド</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.warmupScroll}>
            {calculateWarmupSteps(targetWeight).map((step, idx) => {
              const isCurrent = currentLoad === step.load_kg;
              return (
                <TouchableOpacity
                  key={idx}
                  style={[styles.warmupStep, isCurrent && styles.warmupStepActive]}
                  onPress={() => handleLoadChange(step.load_kg.toString())}
                >
                  <Text style={[styles.warmupStepLabel, isCurrent && styles.warmupStepLabelActive]}>
                    {step.label}
                  </Text>
                  <Text style={[styles.warmupWeight, isCurrent && styles.warmupWeightActive]}>
                    {step.load_kg}kg
                  </Text>
                  <Text style={[styles.warmupReps, isCurrent && styles.warmupRepsActive]}>
                    {step.reps > 0 ? `${step.reps} reps` : 'メイン'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Set Configuration */}
      {!focusMode && (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>セット設定</Text>
        <View style={styles.protocolCard}>
          <Text style={styles.panelEyebrow}>VL PROTOCOL</Text>
          <Text style={styles.protocolLabel}>Velocity Loss 閾値</Text>
          <Text style={styles.protocolHint}>
            現在 {settings.velocity_loss_threshold}% / 種目推奨 {recommendedVlThreshold}%
          </Text>
          <View style={styles.protocolChipRow}>
            {vlOptions.map((value) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.protocolChip,
                  settings.velocity_loss_threshold === value && styles.protocolChipActive,
                ]}
                onPress={() => updateSettings({ velocity_loss_threshold: value })}
              >
                <Text
                  style={[
                    styles.protocolChipText,
                    settings.velocity_loss_threshold === value && styles.protocolChipTextActive,
                  ]}
                >
                  {value}%
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.protocolLabel, styles.protocolLabelSpaced]}>トレーニングフェーズ</Text>
          <View style={styles.protocolChipRow}>
            {phaseOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.protocolChip,
                  settings.target_training_phase === option.value && styles.protocolChipActive,
                ]}
                onPress={() => updateSettings({ target_training_phase: option.value })}
              >
                <Text
                  style={[
                    styles.protocolChipText,
                    settings.target_training_phase === option.value && styles.protocolChipTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.vlLiveRow}>
            <Text style={styles.vlLiveLabel}>現在のVL</Text>
            <Text
              style={[
                styles.vlLiveValue,
                currentVelocityLoss !== null && currentVelocityLoss >= settings.velocity_loss_threshold
                  ? styles.vlLiveValueDanger
                  : null,
              ]}
            >
              {currentVelocityLoss !== null
                ? `${currentVelocityLoss.toFixed(1)}% / ${settings.velocity_loss_threshold}%`
                : `セット開始待ち / ${settings.velocity_loss_threshold}%`}
            </Text>
          </View>
        </View>
        <View style={styles.loadControlContainer}>
          <Text style={styles.panelEyebrow}>LOAD CONTROL</Text>
          <Text style={styles.loadControlLabel}>負荷 (kg)</Text>
          <View style={styles.loadInputRow}>
            <TextInput
              style={styles.loadInput}
              value={inputLoad}
              onChangeText={handleLoadChange}
              placeholder="重量を直接入力"
              placeholderTextColor="#666"
              keyboardType="decimal-pad"
            />
            <Text style={styles.unitText}>kg</Text>
          </View>
          <Text style={styles.loadControlHint}>0.5kg刻みと直接入力に対応</Text>
          <View style={styles.loadControlWrapper}>
            <View style={styles.loadAdjustRow}>
              <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustLoad(-5)}>
                <Text style={styles.adjustBtnText}>-5</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustLoad(-1)}>
                <Text style={styles.adjustBtnText}>-1</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustLoad(-0.5)}>
                <Text style={styles.adjustBtnText}>-0.5</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.loadDisplayValue}>
              <Text style={styles.loadDisplayValueText}>{formatLoad(currentLoad)}</Text>
            </View>
            <View style={styles.loadAdjustRow}>
              <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustLoad(0.5)}>
                <Text style={styles.adjustBtnText}>+0.5</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustLoad(1)}>
                <Text style={styles.adjustBtnText}>+1</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.adjustBtn} onPress={() => adjustLoad(5)}>
                <Text style={styles.adjustBtnText}>+5</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
      )}

      {/* Live データ表示 */}
      {!focusMode && (
      <View style={styles.dataCard}>
        <Text style={styles.panelEyebrow}>LIVE TELEMETRY</Text>
        <Text style={styles.dataTitle}>ライブデータ</Text>
        {liveData ? (
          <>
            {/* 速度ゾーンバッジ */}
            {(() => {
              const zone = AICoachService.getZone(liveData.mean_velocity);
              return (
                <View style={[styles.zoneBadge, { borderColor: zone.color }]}>
                  <Text style={styles.zoneEmoji}>{zone.emoji}</Text>
                  <Text style={[styles.zoneName, { color: zone.color }]}>{zone.name}ゾーン</Text>
                </View>
              );
            })()}
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>平均速度</Text>
              <Text style={[styles.dataValue, {
                color: AICoachService.getZone(liveData.mean_velocity).color
              }]}>
                {liveData.mean_velocity.toFixed(2)} m/s
              </Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>ピーク速度</Text>
              <Text style={styles.dataValue}>
                {liveData.peak_velocity.toFixed(2)} m/s
              </Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>可動域</Text>
              <Text style={styles.dataValue}>{liveData.rom_cm.toFixed(0)} cm</Text>
            </View>
          </>
        ) : (
          <Text style={styles.noDataText}>レップ待機中...</Text>
        )}
      </View>
      )}

      {/* レップ毎の平均速度推移グラフ */}
      {!focusMode && isSessionActive && repHistory && repHistory.length > 0 && (
        <RepVelocityChart reps={repHistory} setIndex={currentSetIndex} />
      )}

      {/* Action Buttons */}
      {!focusMode && (
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.recordButton]}
          onPress={handleFinishSet}
        >
          <Text style={styles.buttonText}>セット完了</Text>
        </TouchableOpacity>
      </View>
      )}

      {/* AIコーチアドバイスカード */}
      {!focusMode && setHistory.length > 0 && (() => {
        const advice = AICoachService.getCoachingAdvice(
          setHistory, currentSetIndex, currentExercise, settings
        );
        const colorMap = {
          info: '#2196F3',
          success: '#4CAF50',
          warning: '#FF9800',
          alert: '#F44336',
        };
        return (
          <View style={[styles.coachCard, { borderColor: colorMap[advice.severity] }]}>
            <Text style={styles.coachEmoji}>{advice.emoji}</Text>
            <View style={styles.coachContent}>
              <Text style={[styles.coachMessage, { color: colorMap[advice.severity] }]}>
                {advice.message}
              </Text>
              {advice.suggestedAction && (
                <Text style={styles.coachAction}>{advice.suggestedAction}</Text>
              )}
            </View>
          </View>
        );
      })()}

      {/* セッション履歴 */}
      {!focusMode && setHistory.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>セッション履歴</Text>
          {setHistory.map((set, idx) => {
            const zone = set.avg_velocity ? AICoachService.getZone(set.avg_velocity) : null;
            return (
              <TouchableOpacity key={idx} style={styles.setCard} onPress={() => openRepDetail(set.set_index)}>
                <View style={styles.setHeader}>
                  <Text style={styles.setNumberText}>セット {set.set_index}</Text>
                  <Text style={styles.setLoad}>{set.load_kg} kg × {set.reps}</Text>
                  {zone && <Text style={{ color: zone.color, fontSize: 14 }}>{zone.emoji}</Text>}
                </View>
                <View style={styles.setRowDetail}>
                  <Text style={[styles.setVelocity, zone ? { color: zone.color } : {}]}>
                    平均速度: {set.avg_velocity?.toFixed(2)} m/s
                  </Text>
                  {set.velocity_loss !== undefined && set.velocity_loss !== null && (
                    <Text style={styles.setVelocityLoss}>
                      速度低下: {set.velocity_loss.toFixed(1)}%
                    </Text>
                  )}
                  {set.avg_hr !== undefined && (
                    <Text style={styles.setHR}>
                      ❤️ {Math.round(set.avg_hr)} bpm
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* End Session */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.finishButton]}
          onPress={handleFinishSession}
        >
          <Text style={styles.buttonText}>セッション終了</Text>
        </TouchableOpacity>
      </View>

      {/* エクササイズ選択モーダル */}
      <ExerciseSelectModal
        visible={showExerciseModal}
        onClose={() => setShowExerciseModal(false)}
        onSelect={handleExerciseSelect}
        currentExerciseId={currentExercise?.id}
      />

      {/* PR達成通知モーダル */}
      <PRNotification
        visible={showPRModal}
        prRecord={prRecord}
        onClose={() => setShowPRModal(false)}
      />
      {/* レップ詳細モーダル */}
      <RepDetailModal
        visible={repDetailVisible}
        reps={repModalReps}
        setIndex={selectedSetIndex}
        onClose={() => setRepDetailVisible(false)}
        onExcludeRep={handleExclude}
        onMarkFailedRep={handleMarkFailedRep}
      />

    </ScrollView>
  );
}

/**
 * レストタイマーコンポーネント
 */
function RestTimer({ startTime, hr, peakHr }: { startTime: number, hr: number | null, peakHr: number | null | undefined }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [startTime]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isReady = hr && peakHr ? (hr < 120 || hr < peakHr * 0.8) : false;

  return (
    <View style={styles.timerRow}>
      <Text style={styles.timerText}>{formatTime(elapsed)}</Text>
      {isReady && (
        <View style={styles.readyBadge}>
          <Text style={styles.readyText}>READY 🔥</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
  },
  header: {
    padding: 16,
    margin: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#120d0d',
    borderWidth: 1,
    borderColor: '#382222',
    borderRadius: 20,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#ff8f5a',
    fontSize: 16,
  },
  headerTitleBlock: {
    flex: 1,
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerEyebrow: {
    color: '#ff7a18',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
  },
  setNumber: {
    fontSize: 16,
    color: '#999',
  },
  statusCard: {
    margin: 16,
    padding: 12,
    backgroundColor: '#151010',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3a2424',
  },
  panelEyebrow: {
    color: '#ff6b35',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  hrBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#281a1a',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 4,
  },
  hrEmoji: { fontSize: 14 },
  hrValue: { fontSize: 16, fontWeight: 'bold', color: '#ff4444' },
  hrUnit: { fontSize: 10, color: '#999' },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '700',
  },
  exerciseCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#151010',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#3a2424',
  },
  exerciseLabel: {
    fontSize: 14,
    color: '#b29d95',
    marginBottom: 8,
  },
  exerciseSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  exerciseCategory: {
    fontSize: 14,
    color: '#999',
    marginTop: 2,
  },
  exerciseChange: {
    color: '#ff8f5a',
    fontSize: 14,
    fontWeight: 'bold',
  },
  exerciseSelectButton: {
    padding: 12,
    backgroundColor: '#231919',
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#4d3434',
  },
  exerciseSelectButtonText: {
    color: '#ff8f5a',
    fontSize: 16,
  },
  section: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff4ea',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 16,
    color: '#fff',
  },
  loadControlContainer: {
    backgroundColor: '#151010',
    padding: 16,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#3a2424',
  },
  protocolCard: {
    backgroundColor: '#151010',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#3a2424',
  },
  protocolLabel: {
    fontSize: 14,
    color: '#fff4ea',
    fontWeight: '800',
    marginBottom: 6,
  },
  protocolLabelSpaced: {
    marginTop: 12,
  },
  protocolHint: {
    color: '#a9938a',
    fontSize: 12,
    marginBottom: 10,
  },
  protocolChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  protocolChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#523838',
    backgroundColor: '#231919',
  },
  protocolChipActive: {
    borderColor: '#ff7a18',
    backgroundColor: '#3d1c12',
  },
  protocolChipText: {
    color: '#d3c0b9',
    fontSize: 13,
    fontWeight: '700',
  },
  protocolChipTextActive: {
    color: '#fff5ef',
  },
  vlLiveRow: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2d1d1d',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vlLiveLabel: {
    color: '#b29d95',
    fontSize: 13,
    fontWeight: '700',
  },
  vlLiveValue: {
    color: '#4CAF50',
    fontSize: 13,
    fontWeight: '900',
  },
  vlLiveValueDanger: {
    color: '#F44336',
  },
  loadControlLabel: {
    fontSize: 14,
    color: '#999',
    marginBottom: 8,
    textAlign: 'center',
  },
  loadInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  loadInput: {
    flex: 1,
    backgroundColor: '#0d0d0d',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    borderWidth: 1,
    borderColor: '#523838',
    textAlign: 'center',
  },
  loadControlHint: {
    color: '#777',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
  },
  loadControlWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  loadAdjustRow: {
    flexDirection: 'row',
    gap: 8,
  },
  adjustBtn: {
    backgroundColor: '#231919',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#523838',
  },
  adjustBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadDisplayValue: {
    minWidth: 80,
    alignItems: 'center',
  },
  loadDisplayValueText: {
    color: '#4CAF50',
    fontSize: 32,
    fontWeight: 'bold',
  },
  dataCard: {
    margin: 16,
    padding: 16,
    backgroundColor: '#120f0f',
    borderRadius: 18,
    borderWidth: 2,
    borderColor: '#ff5a36',
    minHeight: 120,
    justifyContent: 'center',
  },
  dataTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#fff0e7',
    marginBottom: 12,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  dataLabel: {
    fontSize: 16,
    color: '#999',
  },
  dataValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  noDataText: {
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  buttonContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  button: {
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  recordButton: {
    backgroundColor: '#b33616',
  },
  finishButton: {
    backgroundColor: '#5b3810',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  setCard: {
    backgroundColor: '#151010',
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#352323',
  },
  setHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  setNumberText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  setLoad: {
    fontSize: 14,
    color: '#2196F3',
  },
  setRowDetail: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  setVelocity: {
    fontSize: 14,
    color: '#4CAF50',
  },
  setVelocityLoss: {
    fontSize: 13,
    color: '#FF9500',
    fontWeight: '500',
  },
  // セッション開始/アクティブバナー
  sessionStartBanner: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    backgroundColor: '#180f0f',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#ff7a18',
    alignItems: 'center',
  },
  bannerEyebrow: {
    color: '#ff7a18',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.6,
    marginBottom: 8,
  },
  sessionStartText: {
    fontSize: 16,
    color: '#fff4ea',
    marginBottom: 12,
    fontWeight: '800',
  },
  startSessionButton: {
    backgroundColor: '#b33616',
    width: '100%',
  },
  sessionActiveBanner: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    backgroundColor: '#141010',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#8d3f24',
  },
  sessionActiveText: {
    fontSize: 16,
    color: '#fff4ea',
    fontWeight: '800',
    marginBottom: 12,
  },
  pauseBtn: {
    backgroundColor: '#231919',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#523838',
    alignSelf: 'flex-start',
  },
  pausedBtnActive: {
    backgroundColor: '#8f5110',
    borderColor: '#ff9800',
  },
  pauseBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pauseBtnIcon: {
    color: '#fff',
    fontSize: 14,
  },
  pauseBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // レストバナー
  restBanner: {
    marginHorizontal: 16, marginBottom: 16, padding: 16,
    backgroundColor: '#121117', borderRadius: 16, borderWidth: 1, borderColor: '#4f5ec7',
  },
  restHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  restLabel: { fontSize: 12, color: '#3f51b5', fontWeight: 'bold' },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  timerText: { fontSize: 24, fontWeight: 'bold', color: '#fff', fontVariant: ['tabular-nums'] },
  readyBadge: { backgroundColor: '#4CAF50', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  readyText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  focusHud: {
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 18,
    backgroundColor: '#121010',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ff5a36',
  },
  focusHudHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  focusExerciseName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff5ef',
    marginBottom: 4,
  },
  focusExerciseMeta: {
    fontSize: 13,
    color: '#d7bfb4',
    fontWeight: '700',
  },
  focusSetBadge: {
    minWidth: 66,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: 'center',
    backgroundColor: '#251513',
    borderWidth: 1,
    borderColor: '#6a3224',
  },
  focusSetBadgeLabel: {
    color: '#ff9a6f',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  focusSetBadgeValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
  },
  focusMainRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  focusVelocityCard: {
    flex: 1.4,
    minHeight: 170,
    backgroundColor: '#1a1313',
    borderRadius: 18,
    padding: 16,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3d2320',
  },
  focusRepCard: {
    flex: 1,
    minHeight: 170,
    backgroundColor: '#191616',
    borderRadius: 18,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d2626',
  },
  focusMetricLabel: {
    color: '#bfa79b',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 10,
  },
  focusVelocityValue: {
    fontSize: 54,
    lineHeight: 58,
    fontWeight: '900',
    color: '#fff',
    fontVariant: ['tabular-nums'],
  },
  focusRepValue: {
    fontSize: 72,
    lineHeight: 78,
    fontWeight: '900',
    color: '#fff2e7',
    fontVariant: ['tabular-nums'],
  },
  focusMetricUnit: {
    marginTop: 6,
    color: '#8f8078',
    fontSize: 12,
    fontWeight: '700',
  },
  focusStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  focusStatPill: {
    flex: 1,
    backgroundColor: '#171414',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#2c2323',
  },
  focusStatLabel: {
    color: '#8f8078',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },
  focusStatValue: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  focusStatValueDanger: {
    color: '#ff6b57',
  },
  focusActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4,
  },
  focusActionButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  focusActionButtonPrimary: {
    backgroundColor: '#1b1717',
    borderColor: '#5a4940',
  },
  focusActionButtonSecondary: {
    backgroundColor: '#b33616',
    borderColor: '#ff7a18',
  },
  focusActionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  focusChartWrap: {
    marginHorizontal: -8,
    marginBottom: -6,
  },
  startNextSetButton: {
    backgroundColor: '#b33616',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  startNextSetText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // 速度ゾーンバッジ
  zoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    borderWidth: 2,
    marginBottom: 12,
    backgroundColor: '#1a1a1a',
    gap: 8,
  },
  zoneEmoji: { fontSize: 22 },
  zoneName: { fontSize: 16, fontWeight: 'bold' },
  // AIコーチカード
  coachCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    backgroundColor: '#141014',
    borderRadius: 16,
    borderWidth: 2,
    gap: 12,
  },
  coachEmoji: { fontSize: 28, lineHeight: 32 },
  coachContent: { flex: 1 },
  coachMessage: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  coachAction: { fontSize: 13, color: '#bbb', lineHeight: 18 },
  focusToggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#5a4b35',
    backgroundColor: '#1f1a14',
  },
  focusToggleButtonText: {
    color: '#ffd4a0',
    fontSize: 13,
    fontWeight: '700',
  },
  // AIコーチボタン（ヘッダー）
  coachNavButton: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: '#20171c', borderRadius: 16,
    borderWidth: 1, borderColor: '#6d5463',
  },
  coachNavButtonText: { color: '#ffb5c7', fontSize: 14, fontWeight: '700' },
  // Target Weight & Warmup UI
  targetWeightCard: {
    marginHorizontal: 16, marginBottom: 16, padding: 16,
    backgroundColor: '#151010', borderRadius: 16, borderWidth: 1, borderColor: '#3a2424',
  },
  targetWeightLabel: { fontSize: 13, color: '#ff8f5a', fontWeight: 'bold', marginBottom: 10 },
  targetInputRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  targetInput: {
    flex: 1, backgroundColor: '#0d0d0d', borderRadius: 8, padding: 12,
    color: '#fff', fontSize: 18, fontWeight: 'bold', borderWidth: 1, borderColor: '#523838'
  },
  unitText: { color: '#999', fontSize: 16 },
  warmupScroll: { marginTop: 4, paddingBottom: 8 },
  warmupStep: {
    backgroundColor: '#151010', borderRadius: 12, padding: 12,
    marginRight: 10, minWidth: 85, alignItems: 'center', borderWidth: 1, borderColor: '#352323'
  },
  warmupStepActive: { backgroundColor: '#1a1a1a', borderColor: '#2196F3', borderWidth: 2 },
  warmupStepLabel: { fontSize: 10, color: '#999', marginBottom: 4 },
  warmupStepLabelActive: { color: '#2196F3', fontWeight: 'bold' },
  warmupWeight: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  warmupWeightActive: { color: '#2196F3' },
  warmupReps: { fontSize: 10, color: '#666', marginTop: 2 },
  warmupRepsActive: { color: '#999' },
  // VBT Intelligence & CNS Battery UI
  intelligenceRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  cnsBatteryContainer: {
    flex: 1,
    backgroundColor: '#151010',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#352323',
  },
  cnsLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#999',
    marginBottom: 6,
  },
  batteryGageBg: {
    width: '100%',
    height: 8,
    backgroundColor: '#261c1c',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  batteryGageFill: {
    height: '100%',
    borderRadius: 4,
  },
  cnsValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  intelligenceBadge: {
    width: 100,
    backgroundColor: '#1b1510',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  intelligenceLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 4,
    textAlign: 'center',
  },
  intelligenceValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  unitSmall: {
    fontSize: 10,
    color: '#999',
  },
  confidenceIndicator: {
    marginTop: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 9,
    color: '#fff',
    fontWeight: 'bold',
  },
  // Adaptive Load Suggestion
  suggestionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#1f1411',
    borderRadius: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#ff7a18',
  },
  suggestionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  suggestionEmoji: { fontSize: 18 },
  suggestionText: { color: '#fff', fontSize: 14 },
  suggestionWeight: { fontWeight: 'bold', color: '#ff8f5a' },
  applyText: { color: '#ff8f5a', fontSize: 12, fontWeight: 'bold' },
  setHR: { fontSize: 13, color: '#F44336', marginTop: 2, fontWeight: 'bold' },
});
