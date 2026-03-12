/**
 * Session Logic Controller
 * Connects UI, BLE, Store, VBTLogic, and AudioService
 */

import { useEffect, useCallback, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useTrainingStore } from '../store/trainingStore';
import BLEService from '../services/BLEService';
import AudioService from '../services/AudioService';
import { VBTLogic } from '../services/VBTLogic';
import VBTCalculations, { getVelocityAt1RM } from '../utils/VBTCalculations';
import DatabaseService from '../services/DatabaseService';
import AICoachService from '../services/AICoachService';
import HealthService from '../services/HealthService';
import SessionRecoveryService, { type SessionRecoverySnapshot } from '../services/SessionRecoveryService';
import type { RepVeloData, Exercise, RepData, SetData, PRRecord } from '../types/index';

// PR検知コールバック型
type PRCallback = (pr: PRRecord) => void;

export const useSessionLogic = (onPRDetected?: PRCallback) => {
  const [recoveryReady, setRecoveryReady] = useState(false);
  // Store State & Actions
  const {
    currentSession,
    isSessionActive,
    currentSetIndex,
    currentLift,
    currentLoad,
    currentReps,
    currentExercise,
    targetWeight,
    sessionStartTime,
    isConnected,
    liveData,
    repHistory,
    setHistory,
    settings,
    currentHeartRate,
    setHRPoints,
    sessionHRPoints,
    restStartTime,
    sessionStartTimeStamp,
    setStartTimeStamp,
    pauseReason,
    cnsBattery,
    estimated1RM,
    estimated1RM_confidence,
    suggestedLoad,
    proposedMVT,

    // Actions
    setConnectionStatus,
    setLiveData,
    addRep,
    completeSet,
    resetSetData,
    updateHeartRate,
    startRest,
    updateVBTIntelligence,
    removeRepFromHistory,
    markRepFailedInHistory,
    updateSetHistory,
    isPaused,
    setProposedMVT,
    startSet,
    resumeSet,
  } = useTrainingStore();

  const isMounted = useRef(true);
  const lastNotifiedRestTime = useRef<number | null>(null);
  const isFinishingSet = useRef(false); // ガードフラグ
  const lastLiveDataAt = useRef(0);
  const lastAcceptedRepAt = useRef(0);
  const handleDataReceivedRef = useRef<((data: RepVeloData) => Promise<void>) | null>(null);
  const handleConnectionChangedRef = useRef<((connected: boolean) => void) | null>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const restoreFromSnapshot = useCallback(async (snapshot: SessionRecoverySnapshot) => {
    useTrainingStore.setState((state) => ({
      ...state,
      currentSession: snapshot.currentSession,
      isSessionActive: true,
      isPaused: snapshot.isPaused,
      pauseReason: snapshot.pauseReason,
      sessionStartTime: snapshot.sessionStartTime,
      sessionStartTimeStamp: snapshot.sessionStartTimeStamp,
      currentSetIndex: snapshot.currentSetIndex,
      currentLift: snapshot.currentLift,
      currentLoad: snapshot.currentLoad,
      currentReps: snapshot.currentReps,
      targetWeight: snapshot.targetWeight,
      setHistory: snapshot.setHistory,
      setStartTimeStamp: snapshot.setStartTimeStamp,
      restStartTime: snapshot.restStartTime,
      liveData: null,
      repHistory: snapshot.repHistory,
      currentHeartRate: snapshot.currentHeartRate,
      sessionHRPoints: state.sessionHRPoints,
      setHRPoints: state.setHRPoints,
      cnsBattery: snapshot.cnsBattery,
      estimated1RM: snapshot.estimated1RM,
      estimated1RM_confidence: snapshot.estimated1RM_confidence,
      suggestedLoad: snapshot.suggestedLoad,
      proposedMVT: snapshot.proposedMVT,
      currentExercise: snapshot.currentExercise,
    }));
  }, []);

  // --- Setup finishSet for reuse ---

  const finishSet = useCallback(async (repsOverride?: RepData[]) => {
    // ガード処理: 既に実行中の場合は何もしない
    if (isFinishingSet.current) {
      console.log('[finishSet] Already executing, skipping...');
      return;
    }

    // セッションがアクティブでない場合は何もしない
    if (!isSessionActive) {
      console.log('[finishSet] Session not active, skipping...');
      return;
    }

    // 保存対象レップを決定（明示的に指定された場合はそれを使う）
    const repsToSave = repsOverride ?? repHistory;

    // レップ履歴がない場合は何もしない
    if (repsToSave.length === 0) {
      console.log('[finishSet] No reps to save, skipping...');
      return;
    }

    // フラグを立てて多重実行を防止
    isFinishingSet.current = true;

    try {
      // 有効なレップのみを抽出（除外・失敗レップを除く）
      const validReps = repsToSave.filter(r => !r.is_excluded && !r.is_failed && r.is_valid_rep);

      // 有効なレップがない場合は警告して終了
      if (validReps.length === 0) {
        console.warn('[finishSet] No valid reps to save, skipping...');
        return;
      }

      // セット平均を計算
      const avgVel = validReps.reduce((sum, r) => sum + (r.mean_velocity ?? 0), 0) / validReps.length;
      const peakVel = Math.max(...validReps.map(r => r.peak_velocity ?? 0));

      // Velocity Loss: セット内最高速度 vs 平均速度 (calculateSetVelocityLoss使用)
      const vLoss = VBTCalculations.calculateSetVelocityLoss(validReps) ?? 0;

      // e1RMは有効レップ数(validReps.length)を基準に計算（reps <= 0の場合はnull）
      const e1rm = VBTLogic.calculateE1RM(currentLoad, validReps.length) ?? null;

      // 心拍数統計の計算
      const avgHr = setHRPoints.length > 0 ? setHRPoints.reduce((s, x) => s + x, 0) / setHRPoints.length : currentHeartRate || undefined;
      const peakHr = setHRPoints.length > 0 ? Math.max(...setHRPoints) : currentHeartRate || undefined;
      const endTimestamp = new Date().toISOString();
      // Rest duration: time from previous set end (restStartTime) to this set start (setStartTimeStamp)
      const restDuration = (restStartTime && setStartTimeStamp) ?
        (new Date(setStartTimeStamp).getTime() - restStartTime) / 1000 :
        undefined;

      const newSet: SetData = {
        session_id: currentSession?.session_id || 'offline',
        lift: currentLift || 'Unknown',
        set_index: currentSetIndex,
        load_kg: currentLoad,
        reps: validReps.length,
        device_type: 'OVR Velocity',
        set_type: 'normal',
        avg_velocity: avgVel,
        velocity_loss: vLoss,
        e1rm: e1rm,
        timestamp: endTimestamp,
        start_timestamp: setStartTimeStamp || undefined,
        end_timestamp: endTimestamp,
        rest_duration_s: restDuration,
        avg_hr: avgHr,
        peak_hr: peakHr,
      };

      // Storeに保存（ローカル状態遷移を確実に完了させる）
      completeSet(newSet);
      startRest(); // 休憩タイマー開始

      try {
        // === VBT Intelligence 更新 ===
        const updatedHistory = [...setHistory, newSet];
        const cnsBattery = VBTCalculations.calculateCNSFatigueScore(updatedHistory);

        // 次セットの推奨重量 (Adaptive Load Engine™)
        let suggestedLoad = currentLoad;
        if (avgVel) {
          const suggestion = AICoachService.suggestNextLoad(
            avgVel,
            settings.target_training_phase as any || 'strength',
            currentLoad
          );
          suggestedLoad = suggestion.suggestedLoad;
        }

        updateVBTIntelligence({
          cnsBattery,
          suggestedLoad
        });

        // DBに保存 (Async)
        if (currentSession?.session_id) {
          await DatabaseService.insertSet(newSet);
          // repsOverrideが指定された場合はそれを使う（自動終了時の最終レップ含む）
          for (const rep of repsToSave) {
            await DatabaseService.insertRep(rep);
          }

          // === PR検知 ===
          const today = new Date().toISOString().split('T')[0];
          const liftValue = currentLift || 'Unknown';

          // 1. e1RM PR チェック
          if (e1rm) {
            const bestE1RM = await DatabaseService.getBestPR(liftValue, 'e1rm');
            if (!bestE1RM || e1rm > bestE1RM.value) {
              const prRecord: PRRecord = {
                id: `pr_e1rm_${Date.now()}`,
                type: 'e1rm',
                lift: liftValue,
                value: e1rm,
                load_kg: currentLoad,
                reps: validReps.length,
                date: today,
                previous_value: bestE1RM?.value,
                improvement: bestE1RM ? e1rm - bestE1RM.value : e1rm,
              };
              await DatabaseService.insertPRRecord(prRecord);
              onPRDetected?.(prRecord);
              AudioService.announcePR();
            }
          }

          // 2. 最高速度 PR チェック
          if (peakVel) {
            const bestSpeed = await DatabaseService.getBestPR(liftValue, 'speed');
            if (!bestSpeed || peakVel > bestSpeed.value) {
              const prRecord: PRRecord = {
                id: `pr_speed_${Date.now()}`,
                type: 'speed',
                lift: liftValue,
                value: peakVel,
                load_kg: currentLoad,
                date: today,
                previous_value: bestSpeed?.value,
                improvement: bestSpeed ? peakVel - bestSpeed.value : peakVel,
              };
              await DatabaseService.insertPRRecord(prRecord);
              onPRDetected?.(prRecord);
            }
          }

          // === LVP自動更新 ===
          // 十分なデータポイント（3セット以上）がある場合は線形回帰でLVPを更新
          const updatedSetsForLVP = updatedHistory.filter(s => s.avg_velocity && s.load_kg);
          if (updatedSetsForLVP.length >= 3) {
            const lvp = VBTCalculations.calculateLVP(updatedSetsForLVP.map(s => ({
              load: s.load_kg,
              velocity: s.avg_velocity!
            })), currentExercise?.mvt);

            if (lvp && lvp.r_squared > 0.5) {
              await DatabaseService.saveLVPProfile({
                ...lvp,
                lift: liftValue
              });
            }
          }
        }
        AudioService.speakCoach('セット完了。お疲れ様でした。');
      } catch (e) {
        console.error('セット永続化失敗:', e);
      }
    } catch (e) {
      console.error('セット全体の処理失敗:', e);
    } finally {
      // ガードフラグをクリア（必ず実行）
      isFinishingSet.current = false;
    }
  }, [
    repHistory, currentLoad, currentHeartRate, setHRPoints, restStartTime,
    currentSession, currentLift, currentSetIndex, setStartTimeStamp,
    completeSet, setHistory, settings, updateVBTIntelligence, startRest, onPRDetected,
    isSessionActive, startSet, currentExercise
  ]);

  // --- BLE Event Handlers ---

  const handleDataReceived = useCallback(async (data: RepVeloData) => {
    const now = Date.now();

    // セッション未開始時はライブ表示だけ間引いて更新し、重いレップ処理は行わない
    if (!isSessionActive) {
      if (now - lastLiveDataAt.current > 50) {
        lastLiveDataAt.current = now;
        setLiveData(data);
      }
      return;
    }

    // 1. Finish Set Guard - finishSet実行中（DB保存中）はBLE入力を完全に破棄
    if (isFinishingSet.current) {
      console.log('[handleDataReceived] Finishing set in progress, discarding BLE input to prevent duplicate reps');
      return;
    }

    // 2. Pause Gate - 休憩中(isPaused)はBLE入力を完全に破棄
    if (isPaused) {
      console.log('[handleDataReceived] Paused, discarding BLE input');
      return;
    }

    // 2. Update Live Data in Store (for UI)
    if (now - lastLiveDataAt.current > 33) {
      lastLiveDataAt.current = now;
      setLiveData(data);
    }

    // 3. Process Rep Logic
    const minRom = currentExercise?.min_rom_threshold ?? 10.0;
    const isValidRep = data.rom_cm > minRom;

    if (isValidRep) {
      // 同一レップの連続入力を抑制（センサー連投時のUIフリーズ対策）
      if (now - lastAcceptedRepAt.current < 350) return;
      lastAcceptedRepAt.current = now;

      // 3. Calculate Derived Metrics
      const firstRepVel = repHistory.length > 0 ? repHistory[0].mean_velocity : data.mean_velocity;
      const vLoss = VBTLogic.calculateVelocityLoss(firstRepVel as number, data.mean_velocity);

      // Power Calculation
      const power = VBTLogic.calculatePower(currentLoad, data.mean_velocity);

      const isShort = currentExercise ? VBTCalculations.isShortROM(data.rom_cm, currentExercise) : false;

      const newRep: RepData = {
        id: `${Date.now().toString()}-${Math.random().toString(36).substring(2, 15)}`,
        session_id: currentSession?.session_id || 'offline',
        lift: currentLift || 'Unknown',
        set_index: currentSetIndex,
        rep_index: repHistory.length + 1,
        mean_velocity: data.mean_velocity,
        peak_velocity: data.peak_velocity,
        rom_cm: data.rom_cm,
        rep_duration_ms: data.rep_duration_ms,
        mean_power_w: power,
        load_kg: currentLoad,
        device_type: 'OVR Velocity',
        timestamp: new Date().toISOString(),
        is_valid_rep: true,
        is_short_rom: isShort,
        set_type: 'normal',
        hr_bpm: currentHeartRate || undefined,
      };

      // 5. Add to Store
      addRep(newRep);

      if (settings.enable_audio_feedback) {
        AudioService.announceRepCount(newRep.rep_index);
      }

      // 6. Intelligent 1RM Estimator (初動レップで計算)
      if (repHistory.length === 0 && data.mean_velocity > 0) {
        void (async () => {
          const lvp = await DatabaseService.getLVPProfile(currentLift || '');
          if (lvp && lvp.slope < 0) {
            // MVT基準のbaseline 1RMを計算（getVelocityAt1RM経由でmvtを優先）
            const velocityAt1RM = getVelocityAt1RM(lvp);
            const baseline1RM = (velocityAt1RM - lvp.intercept) / lvp.slope;

            // ガード条件1: ウォームアップが軽すぎる場合（例: 30%未満）は予測のブレが大きいため除外
            if (currentLoad >= baseline1RM * 0.3) {
              const e1rm = VBTCalculations.estimateCurrentDay1RM(currentLoad, data.mean_velocity, lvp);

              // ガード条件2: 予測値が異常に変動した場合（例: ベースラインの±30%以上）は外れ値として無視
              const diffRatio = Math.abs(e1rm - baseline1RM) / baseline1RM;
              if (diffRatio <= 0.3) {
                // 信頼度の計算: R² と変動幅に基づく
                let confidence: 'high' | 'medium' | 'low' = 'low';
                if (lvp.r_squared >= 0.8 && diffRatio <= 0.1) {
                  confidence = 'high';
                } else if (lvp.r_squared >= 0.6 && diffRatio <= 0.2) {
                  confidence = 'medium';
                }

                updateVBTIntelligence({
                  estimated1RM: e1rm,
                  estimated1RM_confidence: confidence
                });
              }
            }
          }
        })().catch((e) => console.error('e1RM calculation failed:', e));
      }

      // 7. Velocity Loss 警告 (最新論文基準: S:20%, B:10%, D:5%)
      const paperVL = AICoachService.getVlThresholdByExercise(currentExercise?.category || '');
      const currentVLThreshold = settings.velocity_loss_threshold || paperVL;

      if (vLoss >= currentVLThreshold) {
        if (settings.enable_audio_feedback) {
          const reason = `速度低下率${vLoss.toFixed(1)}%が閾値(${currentVLThreshold}%)を超えました`;
          AudioService.announceStopSet(reason);
        }

        // 自動フィニッシュセット - 新しいレップを明示的に渡して最終レップ欠落を防止
        const nextReps = [...repHistory, newRep];
        finishSet(nextReps);
      }
    }
  }, [
    currentExercise,
    currentLoad,
    currentSession,
    currentLift,
    currentSetIndex,
    repHistory,
    settings,
    setLiveData,
    addRep,
    currentHeartRate,
    updateVBTIntelligence,
    isPaused,
    finishSet,
  ]);

  const handleConnectionChanged = useCallback((connected: boolean) => {
    setConnectionStatus(connected);
  }, [setConnectionStatus]);

  // --- Setup & Teardown ---

  useEffect(() => {
    handleDataReceivedRef.current = handleDataReceived;
  }, [handleDataReceived]);

  useEffect(() => {
    handleConnectionChangedRef.current = handleConnectionChanged;
  }, [handleConnectionChanged]);

  useEffect(() => {
    isMounted.current = true;
    // Initialize Services
    AudioService.initialize();

    // Set BLE Callbacks
    BLEService.setCallbacks({
      onDataReceived: (data) => handleDataReceivedRef.current?.(data),
      onConnectionStatusChanged: (connected) => handleConnectionChangedRef.current?.(connected),
      onError: (error) => console.error('BLE Error:', error),
    });

    // Check initial connection
    BLEService.isConnected().then(result => {
      if (isMounted.current) setConnectionStatus(result);
    });

    return () => {
      isMounted.current = false;
      // Cleanup callbacks? (Optional if singleton persists)
    };
  }, [setConnectionStatus]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const snapshot = await SessionRecoveryService.loadSnapshot();
      if (cancelled) return;

      if (snapshot && !useTrainingStore.getState().isSessionActive) {
        await restoreFromSnapshot(snapshot);
      }

      setRecoveryReady(true);
    })().catch((error) => {
      console.error('Session recovery bootstrap failed:', error);
      setRecoveryReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [restoreFromSnapshot]);

  useEffect(() => {
    if (!recoveryReady) return;

    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }

    if (!isSessionActive || !currentSession) {
      void SessionRecoveryService.clearSnapshot();
      return;
    }

    const snapshot: SessionRecoverySnapshot = {
      version: 1,
      updatedAt: Date.now(),
      currentSession,
      currentSetIndex,
      currentLift,
      currentLoad,
      currentReps,
      targetWeight,
      setHistory,
      repHistory,
      currentExercise,
      isPaused,
      pauseReason,
      sessionStartTime,
      sessionStartTimeStamp,
      setStartTimeStamp,
      restStartTime,
      currentHeartRate,
      cnsBattery,
      estimated1RM,
      estimated1RM_confidence,
      suggestedLoad,
      proposedMVT,
    };

    persistTimerRef.current = setTimeout(() => {
      void SessionRecoveryService.saveSnapshot(snapshot);
    }, 250);

    return () => {
      if (persistTimerRef.current) {
        clearTimeout(persistTimerRef.current);
        persistTimerRef.current = null;
      }
    };
  }, [
    recoveryReady,
    isSessionActive,
    currentSession,
    currentSetIndex,
    currentLift,
    currentLoad,
    currentReps,
    targetWeight,
    setHistory,
    repHistory,
    currentExercise,
    isPaused,
    pauseReason,
    sessionStartTime,
    sessionStartTimeStamp,
    setStartTimeStamp,
    restStartTime,
    currentHeartRate,
    cnsBattery,
    estimated1RM,
    estimated1RM_confidence,
    suggestedLoad,
    proposedMVT,
  ]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if ((nextState === 'background' || nextState === 'inactive') && useTrainingStore.getState().isSessionActive) {
        const state = useTrainingStore.getState();
        if (state.currentSession) {
          void SessionRecoveryService.saveSnapshot({
            version: 1,
            updatedAt: Date.now(),
            currentSession: state.currentSession,
            currentSetIndex: state.currentSetIndex,
            currentLift: state.currentLift,
            currentLoad: state.currentLoad,
            currentReps: state.currentReps,
            targetWeight: state.targetWeight,
            setHistory: state.setHistory,
            repHistory: state.repHistory,
            currentExercise: state.currentExercise,
            isPaused: state.isPaused,
            pauseReason: state.pauseReason,
            sessionStartTime: state.sessionStartTime,
            sessionStartTimeStamp: state.sessionStartTimeStamp,
            setStartTimeStamp: state.setStartTimeStamp,
            restStartTime: state.restStartTime,
            currentHeartRate: state.currentHeartRate,
            cnsBattery: state.cnsBattery,
            estimated1RM: state.estimated1RM,
            estimated1RM_confidence: state.estimated1RM_confidence,
            suggestedLoad: state.suggestedLoad,
            proposedMVT: state.proposedMVT,
          });
        }
      }

      if ((previousState === 'background' || previousState === 'inactive') && nextState === 'active') {
        void (async () => {
          const storeState = useTrainingStore.getState();
          if (!storeState.isSessionActive) {
            const snapshot = await SessionRecoveryService.loadSnapshot();
            if (snapshot && !useTrainingStore.getState().isSessionActive) {
              await restoreFromSnapshot(snapshot);
            }
          }

          const activeState = useTrainingStore.getState();
          if (!activeState.isSessionActive) {
            return;
          }

          const connected = await BLEService.isConnected();
          if (!connected && BLEService.getLastDeviceInfo().id) {
            const reconnected = await BLEService.reconnect();
            if (reconnected) {
              await BLEService.startNotifications();
            }
          } else if (connected) {
            await BLEService.startNotifications();
          }
        })().catch((error) => {
          console.error('Foreground session recovery failed:', error);
        });
      }
    });

    return () => {
      subscription.remove();
    };
  }, [restoreFromSnapshot]);
  // --- Heart Rate Monitoring (Polling when Active) ---
  useEffect(() => {
    let hrTimerId: any = null;

    if (isSessionActive && isMounted.current) {
      hrTimerId = HealthService.startHeartRateMonitoring((bpm) => {
        if (isMounted.current) updateHeartRate(bpm);
      });
    }

    return () => {
      if (hrTimerId) HealthService.stopHeartRateMonitoring(hrTimerId);
    };
  }, [isSessionActive, updateHeartRate]);

  // NOTE:
  // HealthKit authorization on mount is disabled for stability in TestFlight.
  // It can be re-enabled after TurboModule crash root-cause is fixed.

  // --- Rest Timing & Ready Notification ---
  useEffect(() => {
    // 休憩状態（isPaused && pauseReason === 'rest'）でのみready通知を発行
    if (isPaused && pauseReason === 'rest' && restStartTime && currentHeartRate) {
      // 重複通知防止: 既に現在の休憩時間で通知済みなら何もしない
      if (lastNotifiedRestTime.current === restStartTime) return;

      const readyThreshold = 120;
      const peakHr = setHistory.length > 0 ? setHistory[setHistory.length - 1].peak_hr || 180 : 180;

      const isReadyByAbsolute = currentHeartRate < readyThreshold;
      const isReadyByRecovery = currentHeartRate < peakHr * 0.8;

      if (isReadyByAbsolute || isReadyByRecovery) {
        lastNotifiedRestTime.current = restStartTime;
        AudioService.speak('You are ready for the next set');
      }
    }
  }, [isPaused, pauseReason, currentHeartRate, restStartTime, setHistory]);


  // --- User Actions ---

  // --- 1RM & MVT Intelligence ---

  const calculateAndProposeMVT = async () => {
    if (!currentLift) return;

    // 直近セッションから高負荷レップを取得
    const highLoadReps = await DatabaseService.getHighLoadRepsForMVT(currentLift);

    // MVTの提案値を計算
    const proposed = VBTCalculations.proposeNewMVT(highLoadReps);

    if (proposed !== null) {
      // 既存MVTと比較し、差があればストアにセットする
      const existingLvp = await DatabaseService.getLVPProfile(currentLift);
      const currentMvr = existingLvp?.mvt || 0.2;

      // 差分が微小（0.01未満）でない限り、積極的に提案する（以前は0.02）
      if (Math.abs(proposed - currentMvr) >= 0.01) {
        setProposedMVT(proposed);
      } else {
        // 差が微小な場合は、提案をクリアして現在の値が最適であることを示す
        setProposedMVT(null);
      }
    } else {
      setProposedMVT(null);
    }
  };

  const handleExcludeRep = async (repId: string, reason: string) => {
    // 1. Mark in DB
    await DatabaseService.excludeRep(repId, reason);

    // 2. Locate the rep by id (with fallback to rep_index for backward compatibility)
    const targetRep = repHistory.find(r => r.id === repId)
      || (await DatabaseService.getRepsForSession(currentSession?.session_id || '')).find(r => r.id === repId);

    if (!targetRep) return;
    const setIndexToRecalc = targetRep.set_index;
    const targetLift = targetRep.lift; // Use the rep's actual lift, not currentLift

    // 3. Mark in Current Rep History if it's the active set
    if (setIndexToRecalc === currentSetIndex) {
      // Find the rep by id in current history and mark it as excluded
      removeRepFromHistory(repId);
    }

    // 4. Recalculate and update using unified function
    if (currentSession?.session_id) {
      await DatabaseService.recalculateAndUpdateSet(
        currentSession.session_id,
        targetLift,
        setIndexToRecalc
      );

      // 5. Update Set in Store (get updated metrics from DB)
      const metrics = await DatabaseService.recalculateSetMetrics(
        currentSession.session_id,
        targetLift,
        setIndexToRecalc
      );

      if (metrics) {
        updateSetHistory(setIndexToRecalc, metrics);
      }
    }
  };

  const handleMarkFailedRep = async (repId: string, isFailed: boolean) => {
    // 1. Mark in DB
    await DatabaseService.markRepAsFailed(repId, isFailed);

    // 2. Locate the rep by id (with fallback to rep_index for backward compatibility)
    const targetRep = repHistory.find(r => r.id === repId)
      || (await DatabaseService.getRepsForSession(currentSession?.session_id || '')).find(r => r.id === repId);

    if (!targetRep) return;
    const setIndexToRecalc = targetRep.set_index;
    const targetLift = targetRep.lift; // Use the rep's actual lift, not currentLift

    // 3. Mark in Current Rep History if it's the active set
    if (setIndexToRecalc === currentSetIndex) {
      // Find the rep by id in current history and mark it as failed
      markRepFailedInHistory(repId, isFailed);
    }

    // 4. Recalculate and update using unified function
    if (currentSession?.session_id) {
      await DatabaseService.recalculateAndUpdateSet(
        currentSession.session_id,
        targetLift,
        setIndexToRecalc
      );

      // 5. Update Set in Store (get updated metrics from DB)
      const metrics = await DatabaseService.recalculateSetMetrics(
        currentSession.session_id,
        targetLift,
        setIndexToRecalc
      );

      if (metrics) {
        updateSetHistory(setIndexToRecalc, metrics);
      }
    }
  };

  return {
    finishSet,
    handleDataReceived,
    startSet,
    resumeSet,
    handleExcludeRep,
    handleMarkFailedRep,
    calculateAndProposeMVT,
  };
};
