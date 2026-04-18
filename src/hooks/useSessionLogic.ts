/**
 * Session Logic Controller
 * Connects UI, BLE, Store, VBTLogic, and AudioService
 */

import { useEffect, useCallback, useRef } from "react";
import { useTrainingStore } from "../store/trainingStore";
import BLEService from "../services/BLEService";
import AudioService from "../services/AudioService";
import { VBTLogic } from "../services/VBTLogic";
import VBTCalculations, { getVelocityAt1RM, estimate1RMFourPoint } from "../utils/VBTCalculations";
import DatabaseService from "../services/DatabaseService";
import ExerciseService from "../services/ExerciseService";
import AICoachService from "../services/AICoachService";
import HealthService from "../services/HealthService";
import { loadAppSettings } from "../services/AppSettingsService";
import type {
  RepVeloData,
  Exercise,
  RepData,
  SetData,
  PRRecord,
} from "../types/index";

// PR検知コールバック型
type PRCallback = (pr: PRRecord) => void;
// 自動スタートコールバック型
type AutoStartCallback = () => void;

export const useSessionLogic = (onPRDetected?: PRCallback, onAutoStart?: AutoStartCallback) => {
  // Store State & Actions
  const {
    currentSession,
    isSessionActive,
    currentSetIndex,
    currentLift,
    currentLoad,
    currentReps,
    currentExercise,
    isConnected,
    liveData,
    repHistory,
    setHistory,
    settings,
    currentHeartRate,
    setHRPoints,
    sessionHRPoints,
    restStartTime,
    setStartTimeStamp,
    pauseReason,

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
    updateSettings,
  } = useTrainingStore();

  const isMounted = useRef(true);
  const lastNotifiedRestTime = useRef<number | null>(null);
  const isFinishingSet = useRef(false); // ガードフラグ
  const lastRepTime = useRef<number>(Date.now()); // 最後のレップ検出時刻
  const autoFinishTimer = useRef<ReturnType<typeof setTimeout> | null>(null); // 自動完了タイマー
  const isWarmupSet = useRef(false); // ウォームアップセットフラグ
  const lastAcceptedRepSignature = useRef<string | null>(null);
  const lastAcceptedRepAt = useRef<number>(0);

  // --- Setup finishSet for reuse ---

  const finishSet = useCallback(
    async (repsOverride?: RepData[]) => {
      // ガード処理: 既に実行中の場合は何もしない
      if (isFinishingSet.current) {
        console.log("[finishSet] Already executing, skipping...");
        return;
      }

      // セッションがアクティブでない場合は何もしない
      if (!isSessionActive) {
        console.log("[finishSet] Session not active, skipping...");
        return;
      }

      // 保存対象レップを決定（明示的に指定された場合はそれを使う）
      const repsToSave = repsOverride ?? repHistory;

      // レップ履歴がない場合は何もしない
      if (repsToSave.length === 0) {
        console.log("[finishSet] No reps to save, skipping...");
        return;
      }

      // フラグを立てて多重実行を防止
      isFinishingSet.current = true;

      // 有効なレップのみを抽出（除外・失敗レップを除く）
      const validReps = repsToSave.filter(
        (r) => !r.is_excluded && !r.is_failed && r.is_valid_rep,
      );

      // 有効なレップがない場合は警告して終了
      if (validReps.length === 0) {
        console.warn("[finishSet] No valid reps to save, skipping...");
        isFinishingSet.current = false;
        return;
      }

      // セット平均を計算
      const avgVel =
        validReps.reduce((sum, r) => sum + (r.mean_velocity ?? 0), 0) /
        validReps.length;
      const peakVel = Math.max(...validReps.map((r) => r.peak_velocity ?? 0));

      // Velocity Loss: セット内最高速度 vs 平均速度 (calculateSetVelocityLoss使用)
      const vLoss = VBTCalculations.calculateSetVelocityLoss(validReps) ?? 0;

      // e1RMは有効レップ数(validReps.length)を基準に計算（reps <= 0の場合はnull）
      const e1rm =
        VBTLogic.calculateE1RM(currentLoad, validReps.length) ?? null;

      // 平均パワーの計算
      const avgPower =
        validReps.length > 0
          ? validReps.reduce((sum, r) => sum + (r.mean_power_w ?? 0), 0) /
            validReps.length
          : null;

      // 心拍数統計の計算
      const avgHr =
        setHRPoints.length > 0
          ? setHRPoints.reduce((s, x) => s + x, 0) / setHRPoints.length
          : currentHeartRate || undefined;
      const peakHr =
        setHRPoints.length > 0
          ? Math.max(...setHRPoints)
          : currentHeartRate || undefined;
      const endTimestamp = new Date().toISOString();
      // Rest duration: time from previous set end (restStartTime) to this set start (setStartTimeStamp)
      const restDuration =
        restStartTime && setStartTimeStamp
          ? (new Date(setStartTimeStamp).getTime() - restStartTime) / 1000
          : undefined;

      const newSet: SetData = {
        session_id: currentSession?.session_id || "offline",
        lift: currentLift || "Unknown",
        set_index: currentSetIndex,
        load_kg: currentLoad,
        reps: validReps.length,
        device_type: "OVR Velocity",
        set_type: "normal",
        avg_velocity: avgVel,
        velocity_loss: vLoss,
        e1rm: e1rm,
        timestamp: endTimestamp,
        start_timestamp: setStartTimeStamp || undefined,
        end_timestamp: endTimestamp,
        rest_duration_s: restDuration,
        avg_hr: avgHr,
        peak_hr: peakHr,
        avg_power_w: avgPower,
        is_warmup: isWarmupSet.current,
      };

      // ウォームアップセットフラグをリセット
      isWarmupSet.current = false;

      // Storeに保存
      lastAcceptedRepSignature.current = null;
      lastAcceptedRepAt.current = 0;
      completeSet(newSet);

      // === VBT Intelligence 更新 ===
      const updatedHistory = [...setHistory, newSet];
      const cnsBattery =
        VBTCalculations.calculateCNSFatigueScore(updatedHistory);

      // 次セットの推奨重量 (Adaptive Load Engine™)
      let suggestedLoad = currentLoad;
      if (avgVel) {
        const suggestion = AICoachService.suggestNextLoad(
          avgVel,
          (settings.target_training_phase as any) || "strength",
          currentLoad,
        );
        suggestedLoad = suggestion.suggestedLoad;
      }

      const estimatedConfidence = e1rm
        ? validReps.length >= 5
          ? "high"
          : validReps.length >= 3
            ? "medium"
            : "low"
        : undefined;

      updateVBTIntelligence({
        cnsBattery,
        suggestedLoad,
        estimated1RM: e1rm ?? undefined,
        estimated1RM_confidence: estimatedConfidence,
      });

      // DBに保存 (Async)
      try {
        if (currentSession?.session_id) {
          await DatabaseService.insertSet(newSet);
          // repsOverrideが指定された場合はそれを使う（自動終了時の最終レップ含む）
          for (const rep of repsToSave) {
            await DatabaseService.insertRep(rep);
          }

          try {
            const lift = currentLift || "Unknown";
            const sessionReps = await DatabaseService.getRepsForSession(
              currentSession.session_id,
            );
            const oneRMEstimate = await estimate1RMFourPoint(
              lift,
              updatedHistory.filter(
                (set) => set.lift === lift && !set.is_warmup,
              ),
              sessionReps,
              currentExercise?.mvt ?? 0.15,
              async () =>
                await DatabaseService.getHistoricalVelocityData(lift, 12),
            );

            if (oneRMEstimate.estimated1RM > 0) {
              updateVBTIntelligence({
                estimated1RM: oneRMEstimate.estimated1RM,
                estimated1RM_confidence: oneRMEstimate.confidence,
              });
            }
          } catch (estimateError) {
            console.error("[finishSet] 4-point 1RM estimation failed:", estimateError);
          }

          // === PR検知 ===
          const today = new Date().toISOString().split("T")[0];
          const lift = currentLift || "Unknown";

          // 1. e1RM PR チェック
          if (e1rm) {
            const bestE1RM = await DatabaseService.getBestPR(lift, "e1rm");
            if (!bestE1RM || e1rm > bestE1RM.value) {
              const prRecord: PRRecord = {
                id: `pr_e1rm_${Date.now()}`,
                type: "e1rm",
                lift,
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
            const bestSpeed = await DatabaseService.getBestPR(lift, "speed");
            if (!bestSpeed || peakVel > bestSpeed.value) {
              const prRecord: PRRecord = {
                id: `pr_speed_${Date.now()}`,
                type: "speed",
                lift,
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
          const updatedSetsForLVP = updatedHistory.filter(
            (s) => s.avg_velocity && s.load_kg,
          );
          if (updatedSetsForLVP.length >= 3) {
            const lvp = VBTCalculations.calculateLVP(
              updatedSetsForLVP.map((s) => ({
                load: s.load_kg,
                velocity: s.avg_velocity!,
              })),
              currentExercise?.mvt,
            );

            if (lvp && lvp.r_squared > 0.5) {
              await DatabaseService.saveLVPProfile({
                ...lvp,
                lift,
              });
            }
          }

          await ExerciseService.inferRomRangeForLift(lift);
        }
      } catch (e) {
        console.error("セット保存失敗:", e);
      }

      startRest(); // 休憩タイマー開始
      AudioService.speakCoach("セット完了。お疲れ様でした。");

      // ガードフラグをクリア（次のセット用）
      isFinishingSet.current = false;
    },
    [
      repHistory,
      currentLoad,
      currentHeartRate,
      setHRPoints,
      restStartTime,
      currentSession,
      currentLift,
      currentSetIndex,
      setStartTimeStamp,
      completeSet,
      setHistory,
      settings,
      updateVBTIntelligence,
      startRest,
      onPRDetected,
      isSessionActive,
      startSet,
    ],
  );

  // --- BLE Event Handlers ---

  const handleDataReceived = useCallback(
    async (data: RepVeloData) => {
      // 0. Auto-start mode: セッションが開始されていない場合で、自動スタートモードが有効な場合に自動開始
      const autoStartRomThreshold = currentExercise?.auto_start_rom_cm ?? settings.auto_start_rom_cm;
      if (!isSessionActive && settings.enable_auto_start_session && data.rom_cm > autoStartRomThreshold) {
        console.log("[handleDataReceived] Auto-starting session on movement detection");
        onAutoStart?.();
        return;
      }

      // 1. Finish Set Guard - finishSet実行中（DB保存中）はBLE入力を完全に破棄
      if (isFinishingSet.current) {
        console.log(
          "[handleDataReceived] Finishing set in progress, discarding BLE input to prevent duplicate reps",
        );
        return;
      }

      // 2. Pause Gate - 休憩中(isPaused)はBLE入力を完全に破棄
      if (isPaused) {
        console.log("[handleDataReceived] Paused, discarding BLE input");
        return;
      }

      // 3. Update Live Data in Store (for UI)
      setLiveData(data);

      // 3. Process Rep Logic
      const minRom = currentExercise?.min_rom_threshold ?? 10.0;
      const isValidRep = data.rom_cm > minRom;
      const repSignature = [
        data.raw_mean_v ?? Math.round(data.mean_velocity * 100),
        data.raw_rom ?? Math.round(data.rom_cm * 10),
        data.rep_duration_ms,
      ].join(":");
      const now = Date.now();

      if (
        isValidRep &&
        repSignature === lastAcceptedRepSignature.current &&
        now - lastAcceptedRepAt.current < 800
      ) {
        console.log("[handleDataReceived] Duplicate rep payload ignored", repSignature);
        return;
      }

      // 最後のレップ検出時刻を更新
      lastRepTime.current = Date.now();

      // 自動完了タイマーをリセット
      if (autoFinishTimer.current) {
        clearTimeout(autoFinishTimer.current);
        autoFinishTimer.current = null;
      }

      // 10秒後に自動完了するタイマーをセット（ウォームアップセットでない場合）
      if (!isWarmupSet.current && !isPaused && repHistory.length > 0) {
        autoFinishTimer.current = setTimeout(() => {
          console.log("[useSessionLogic] Auto-finishing set due to no movement");
          finishSet();
        }, 10000);
      }

      if (isValidRep) {
        const isAutoSetupRep = Boolean(
          currentExercise?.ignore_first_rep_as_setup && repHistory.length === 0,
        );

        // 3. Audio Feedback (Velocity Sense™)
        if (settings.enable_audio_feedback && !isAutoSetupRep) {
          const isGood = data.mean_velocity >= 0.5;
          const announcements: string[] = [];
          if (settings.enable_audio_rep_count) {
            announcements.push(`${repHistory.length + 1}レップ`);
          }
          if (settings.enable_audio_velocity_readout) {
            announcements.push(`${data.mean_velocity.toFixed(2)}`);
          }
          if (settings.enable_audio_faster_cue && !isGood) {
            announcements.push("もっと速く");
          }
          if (announcements.length > 0) {
            void AudioService.speak(announcements.join("。"));
          }
        }

        // 4. Calculate Derived Metrics
        const firstTrackedRep = repHistory.find(
          (rep) => !rep.is_excluded && !rep.is_failed && rep.is_valid_rep,
        );
        const firstRepVel =
          firstTrackedRep?.mean_velocity ?? data.mean_velocity;
        const vLoss = VBTLogic.calculateVelocityLoss(
          firstRepVel as number,
          data.mean_velocity,
        );

        // Power Calculation
        const power = VBTLogic.calculatePower(currentLoad, data.mean_velocity);

        const isShort = currentExercise
          ? VBTCalculations.isShortROM(data.rom_cm, currentExercise)
          : false;

        const newRep: RepData = {
          id: `${Date.now().toString()}-${Math.random().toString(36).substring(2, 15)}`,
          session_id: currentSession?.session_id || "offline",
          lift: currentLift || "Unknown",
          set_index: currentSetIndex,
          rep_index: repHistory.length + 1,
          mean_velocity: data.mean_velocity,
          peak_velocity: data.peak_velocity,
          rom_cm: data.rom_cm,
          rep_duration_ms: data.rep_duration_ms,
          mean_power_w: power,
          load_kg: currentLoad,
          device_type: "OVR Velocity",
          timestamp: new Date().toISOString(),
          is_valid_rep: true,
          is_short_rom: isShort,
          set_type: "normal",
          hr_bpm: currentHeartRate || undefined,
          is_excluded: isAutoSetupRep,
          exclusion_reason: isAutoSetupRep ? "setup_reaction" : undefined,
        };

        // 5. Add to Store
        lastAcceptedRepSignature.current = repSignature;
        lastAcceptedRepAt.current = now;
        addRep(newRep);

        // 6. Intelligent 1RM Estimator (初動レップで計算)
        if (repHistory.length === 0 && data.mean_velocity > 0) {
          const lvp = await DatabaseService.getLVPProfile(currentLift || "");
          if (lvp && lvp.slope < 0) {
            // MVT基準のbaseline 1RMを計算（getVelocityAt1RM経由でmvtを優先）
            const velocityAt1RM = getVelocityAt1RM(lvp);
            const baseline1RM = (velocityAt1RM - lvp.intercept) / lvp.slope;

            // ガード条件1: ウォームアップが軽すぎる場合（例: 30%未満）は予測のブレが大きいため除外
            if (currentLoad >= baseline1RM * 0.3) {
              const e1rm = VBTCalculations.estimateCurrentDay1RM(
                currentLoad,
                data.mean_velocity,
                lvp,
              );

              // ガード条件2: 予測値が異常に変動した場合（例: ベースラインの±30%以上）は外れ値として無視
              const diffRatio = Math.abs(e1rm - baseline1RM) / baseline1RM;
              if (diffRatio <= 0.3) {
                // 信頼度の計算: R² と変動幅に基づく
                let confidence: "high" | "medium" | "low" = "low";
                if (lvp.r_squared >= 0.8 && diffRatio <= 0.1) {
                  confidence = "high";
                } else if (lvp.r_squared >= 0.6 && diffRatio <= 0.2) {
                  confidence = "medium";
                }

                updateVBTIntelligence({
                  estimated1RM: e1rm,
                  estimated1RM_confidence: confidence,
                });
              }
            }
          }
        }

        // 7. Velocity Loss 警告 (最新論文基準: S:20%, B:10%, D:5%)
        const paperVL = AICoachService.getVlThresholdByExercise(
          currentExercise?.category || "",
        );
        // 種目別VLカットオフを優先、なければグローバル設定、なければ論文値
        const currentVLThreshold =
          currentExercise?.velocity_loss_threshold ||
          settings.velocity_loss_threshold ||
          paperVL;

        if (!isAutoSetupRep && vLoss >= currentVLThreshold) {
          if (settings.enable_audio_feedback) {
            const reason = `速度低下率${vLoss.toFixed(1)}%が閾値(${currentVLThreshold}%)を超えました`;
            AudioService.announceStopSet(reason);
          }

          // 自動フィニッシュセットは無効化 - 警告のみでセット継続を許可
          // ユーザーが手動でセット完了ボタンを押すまで記録を続ける
          // const nextReps = [...repHistory, newRep];
          // finishSet(nextReps);
        }
      }
    },
    [
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
    ],
  );

  const handleConnectionChanged = useCallback(
    (connected: boolean) => {
      setConnectionStatus(connected);
    },
    [setConnectionStatus, updateSettings],
  );

  const dataReceivedRef = useRef(handleDataReceived);
  const connectionChangedRef = useRef(handleConnectionChanged);

  useEffect(() => {
    dataReceivedRef.current = handleDataReceived;
    connectionChangedRef.current = handleConnectionChanged;
  }, [handleDataReceived, handleConnectionChanged]);

  // --- Setup & Teardown ---

  useEffect(() => {
    isMounted.current = true;
    void AudioService.initialize();
    void loadAppSettings().then((loaded) => {
      if (isMounted.current) {
        updateSettings(loaded);
      }
    });

    BLEService.setCallbacks({
      onDataReceived: (data) => {
        void dataReceivedRef.current(data);
      },
      onConnectionStatusChanged: (connected) => {
        connectionChangedRef.current(connected);
      },
      onError: (error) => console.error("BLE Error:", error),
    });

    BLEService.isConnected().then((result) => {
      if (isMounted.current) setConnectionStatus(result);
    });

    return () => {
      isMounted.current = false;
      // 自動完了タイマーをクリア
      if (autoFinishTimer.current) {
        clearTimeout(autoFinishTimer.current);
      }
    };
  }, [setConnectionStatus]);
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

  // --- HealthKit Authorization (On Mount) ---
  useEffect(() => {
    if (isMounted.current) {
      HealthService.authorize().then((authorized) => {
        console.log(
          "[useSessionLogic] HealthKit initial authorization:",
          authorized,
        );
      });
    }
  }, []);

  // --- Rest Timing & Ready Notification ---
  useEffect(() => {
    // 休憩状態（isPaused && pauseReason === 'rest'）でのみready通知を発行
    if (
      isPaused &&
      pauseReason === "rest" &&
      restStartTime &&
      currentHeartRate
    ) {
      // 重複通知防止: 既に現在の休憩時間で通知済みなら何もしない
      if (lastNotifiedRestTime.current === restStartTime) return;

      const readyThreshold = 120;
      const peakHr =
        setHistory.length > 0
          ? setHistory[setHistory.length - 1].peak_hr || 180
          : 180;

      const isReadyByAbsolute = currentHeartRate < readyThreshold;
      const isReadyByRecovery = currentHeartRate < peakHr * 0.8;

      if (isReadyByAbsolute || isReadyByRecovery) {
        lastNotifiedRestTime.current = restStartTime;
        AudioService.speak("You are ready for the next set");
      }
    }
  }, [isPaused, pauseReason, currentHeartRate, restStartTime, setHistory]);

  // --- User Actions ---

  // --- 1RM & MVT Intelligence ---

  const calculateAndProposeMVT = async () => {
    if (!currentLift) return;

    // 直近セッションから高負荷レップを取得
    const highLoadReps =
      await DatabaseService.getHighLoadRepsForMVT(currentLift);

    // MVTの提案値を計算
    const proposed = VBTCalculations.proposeNewMVT(highLoadReps);

    if (proposed !== null) {
      // 既存MVTと比較し、差があればストアにセットする
      const existingLvp = await DatabaseService.getLVPProfile(currentLift);
      const currentMvr = existingLvp?.mvt || 0.2;

      if (Math.abs(proposed - currentMvr) >= 0.02) {
        setProposedMVT(proposed);
      }
    }
  };

  const handleExcludeRep = async (repId: string, reason: string) => {
    // 1. Mark in DB
    await DatabaseService.excludeRep(repId, reason);

    // 2. Locate the rep by id (with fallback to rep_index for backward compatibility)
    const targetRep =
      repHistory.find((r) => r.id === repId) ||
      (
        await DatabaseService.getRepsForSession(
          currentSession?.session_id || "",
        )
      ).find((r) => r.id === repId);

    if (!targetRep) return;
    const setIndexToRecalc = targetRep.set_index;
    const targetLift = targetRep.lift; // Use the rep's actual lift, not currentLift

    // 3. Mark in Current Rep History if it's the active set
    if (setIndexToRecalc === currentSetIndex && targetLift === currentLift) {
      // Find the rep by id in current history and mark it as excluded
      removeRepFromHistory(repId);
    }

    // 4. Recalculate and update using unified function
    if (currentSession?.session_id) {
      await DatabaseService.recalculateAndUpdateSet(
        currentSession.session_id,
        targetLift,
        setIndexToRecalc,
      );

      // 5. Update Set in Store (get updated metrics from DB)
      const metrics = await DatabaseService.recalculateSetMetrics(
        currentSession.session_id,
        targetLift,
        setIndexToRecalc,
      );

      if (metrics) {
        updateSetHistory(setIndexToRecalc, targetLift, metrics);
      }
    }
  };

  const handleMarkFailedRep = async (repId: string, isFailed: boolean) => {
    // 1. Mark in DB
    await DatabaseService.markRepAsFailed(repId, isFailed);

    // 2. Locate the rep by id (with fallback to rep_index for backward compatibility)
    const targetRep =
      repHistory.find((r) => r.id === repId) ||
      (
        await DatabaseService.getRepsForSession(
          currentSession?.session_id || "",
        )
      ).find((r) => r.id === repId);

    if (!targetRep) return;
    const setIndexToRecalc = targetRep.set_index;
    const targetLift = targetRep.lift; // Use the rep's actual lift, not currentLift

    // 3. Mark in Current Rep History if it's the active set
    if (setIndexToRecalc === currentSetIndex && targetLift === currentLift) {
      // Find the rep by id in current history and mark it as failed
      markRepFailedInHistory(repId, isFailed);
    }

    // 4. Recalculate and update using unified function
    if (currentSession?.session_id) {
      await DatabaseService.recalculateAndUpdateSet(
        currentSession.session_id,
        targetLift,
        setIndexToRecalc,
      );

      // 5. Update Set in Store (get updated metrics from DB)
      const metrics = await DatabaseService.recalculateSetMetrics(
        currentSession.session_id,
        targetLift,
        setIndexToRecalc,
      );

      if (metrics) {
        updateSetHistory(setIndexToRecalc, targetLift, metrics);
      }
    }
  };

  return {
    finishSet,
    startSet,
    resumeSet,
    handleExcludeRep,
    handleMarkFailedRep,
    calculateAndProposeMVT,
    setWarmupMode: (warmup: boolean) => { isWarmupSet.current = warmup; },
    // Expose store state for UI to consume directly if needed,
    // but preferably UI uses useTrainingStore() directly for reading state.
  };
};
