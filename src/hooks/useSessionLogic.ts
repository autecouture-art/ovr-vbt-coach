/**
 * Session Logic Controller
 * Connects UI, BLE, Store, VBTLogic, and AudioService
 */

import { useEffect, useCallback, useRef } from "react";
import { shallow } from "zustand/shallow";
import { useTrainingStore } from "../store/trainingStore";
import BLEService from "../services/BLEService";
import AudioService from "../services/AudioService";
import { VBTLogic } from "../services/VBTLogic";
import VBTCalculations, {
  getVelocityAt1RM,
  estimate1RMFourPoint,
} from "../utils/VBTCalculations";
import DatabaseService from "../services/DatabaseService";
import ExerciseService from "../services/ExerciseService";
import LiveShareService from "../services/LiveShareService";
import VBTGuideService from "../services/VBTGuideService";
import HealthService from "../services/HealthService";
import { loadAppSettings } from "../services/AppSettingsService";
import CrashReportService from "../services/CrashReportService";
import type {
  RepVeloData,
  RepData,
  SetData,
  PRRecord,
  LVPData,
} from "../types/index";

// === 定数定義 ===
// 重複排除の時間窓（ミリ秒）
const REP_DEDUP_WINDOW_MS = 800;
// 自動完了のタイムアウト（ミリ秒）
const AUTO_FINISH_TIMEOUT_MS = 10000;
// セット開始後、最初のレップが入るまで鳴らす開始確認キューの間隔
const SET_START_REMINDER_INTERVAL_MS = 6000;
const HR_READY_THRESHOLD_BPM = 120;
const HR_RECOVERY_MIN_PEAK_OVER_READY_BPM = 5;
const HR_RECOVERY_MIN_VALID_SECONDS = 15;
const HR_RECOVERY_MAX_TRACK_SECONDS = 15 * 60;
const SPEED_PR_MIN_IMPROVEMENT_MPS = 0.01;
const E1RM_PR_MIN_IMPROVEMENT_KG = 0.5;
// 最小ROMのデフォルト値（cm）
const MIN_ROM_DEFAULT_CM = 10.0;
// 負荷の下限比率（baseline1RMの30%未満は予測のブレが大きいため除外）
const LOAD_LOWER_BOUND_RATIO = 0.3;
// オートスタートROMのデフォルト閾値（cm）
const AUTO_START_ROM_DEFAULT_CM = 5.0;
const MAX_REASONABLE_VELOCITY_MPS = 3.5;
const MAX_REASONABLE_ROM_CM = 250;
const MAX_REASONABLE_POWER_W = 10000;
const MAX_REASONABLE_REP_DURATION_MS = 30000;

// PR検知コールバック型
type PRCallback = (pr: PRRecord) => void;
// 自動スタートコールバック型
type AutoStartCallback = () => void;

const toFiniteNumberOrNull = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const normalizeRepVeloData = (data: RepVeloData): RepVeloData | null => {
  const meanVelocity = toFiniteNumberOrNull(data.mean_velocity);
  const peakVelocity = toFiniteNumberOrNull(data.peak_velocity);
  const romCm = toFiniteNumberOrNull(data.rom_cm);
  const repDurationMs = toFiniteNumberOrNull(data.rep_duration_ms);

  if (
    meanVelocity == null ||
    peakVelocity == null ||
    romCm == null ||
    repDurationMs == null
  ) {
    console.warn("[useSessionLogic] Ignoring incomplete VBT payload", data);
    return null;
  }

  if (
    meanVelocity <= 0 ||
    meanVelocity > MAX_REASONABLE_VELOCITY_MPS ||
    peakVelocity < 0 ||
    peakVelocity > MAX_REASONABLE_VELOCITY_MPS ||
    romCm <= 0 ||
    romCm > MAX_REASONABLE_ROM_CM ||
    repDurationMs < 0 ||
    repDurationMs > MAX_REASONABLE_REP_DURATION_MS
  ) {
    console.warn("[useSessionLogic] Ignoring out-of-range VBT payload", data);
    return null;
  }

  const meanPower = toFiniteNumberOrNull(data.mean_power_w);
  const peakPower = toFiniteNumberOrNull(data.peak_power_w);

  return {
    ...data,
    mean_velocity: meanVelocity,
    peak_velocity: peakVelocity,
    rom_cm: romCm,
    rep_duration_ms: repDurationMs,
    mean_power_w:
      meanPower != null &&
      meanPower > 0 &&
      meanPower <= MAX_REASONABLE_POWER_W
        ? meanPower
        : undefined,
    peak_power_w:
      peakPower != null &&
      peakPower > 0 &&
      peakPower <= MAX_REASONABLE_POWER_W
        ? peakPower
        : undefined,
    timestamp:
      toFiniteNumberOrNull(data.timestamp) != null ? data.timestamp : Date.now(),
  };
};

export const useSessionLogic = (
  onPRDetected?: PRCallback,
  onAutoStart?: AutoStartCallback,
) => {
  // Store State & Actions
  const {
    currentSession,
    isSessionActive,
    currentSetIndex,
    currentLift,
    currentLoad,
    currentExercise,
    repHistory,
    setHistory,
    settings,
    currentHeartRate,
    sensorInputMuted,
    setHRPoints,
    restStartTime,
    setStartTimeStamp,
    pauseReason,

    // Actions
    setConnectionStatus,
    setLiveData,
    addRep,
    completeSet,
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
  } = useTrainingStore(
    (state) => ({
      currentSession: state.currentSession,
      isSessionActive: state.isSessionActive,
      currentSetIndex: state.currentSetIndex,
      currentLift: state.currentLift,
      currentLoad: state.currentLoad,
      currentExercise: state.currentExercise,
      repHistory: state.repHistory,
      setHistory: state.setHistory,
      settings: state.settings,
      currentHeartRate: state.currentHeartRate,
      sensorInputMuted: state.sensorInputMuted,
      setHRPoints: state.setHRPoints,
      restStartTime: state.restStartTime,
      setStartTimeStamp: state.setStartTimeStamp,
      pauseReason: state.pauseReason,
      setConnectionStatus: state.setConnectionStatus,
      setLiveData: state.setLiveData,
      addRep: state.addRep,
      completeSet: state.completeSet,
      updateHeartRate: state.updateHeartRate,
      startRest: state.startRest,
      updateVBTIntelligence: state.updateVBTIntelligence,
      removeRepFromHistory: state.removeRepFromHistory,
      markRepFailedInHistory: state.markRepFailedInHistory,
      updateSetHistory: state.updateSetHistory,
      isPaused: state.isPaused,
      setProposedMVT: state.setProposedMVT,
      startSet: state.startSet,
      resumeSet: state.resumeSet,
      updateSettings: state.updateSettings,
    }),
    shallow,
  );

  const isMounted = useRef(true);
  const lastNotifiedRestTime = useRef<number | null>(null);
  const isFinishingSet = useRef(false); // ガードフラグ
  const lastRepTime = useRef<number>(Date.now()); // 最後のレップ検出時刻
  const autoFinishTimer = useRef<ReturnType<typeof setTimeout> | null>(null); // 自動完了タイマー
  const isWarmupSet = useRef(false); // ウォームアップセットフラグ
  const lastAcceptedRepSignature = useRef<string | null>(null);
  const lastAcceptedRepAt = useRef<number>(0);

  // --- パフォーマンス最適化: 状態をrefで追跡 ---
  // これにより、コールバックの依存配列を最小限に抑え、再レンダリングを抑制
  const repHistoryRef = useRef(repHistory);
  const settingsRef = useRef(settings);
  const isPausedRef = useRef(isPaused);
  const sensorInputMutedRef = useRef(sensorInputMuted);
  const currentExerciseRef = useRef(currentExercise);
  const currentLoadRef = useRef(currentLoad);
  const currentLiftRef = useRef(currentLift);
  const currentSetIndexRef = useRef(currentSetIndex);
  const currentSessionRef = useRef(currentSession);
  const currentHeartRateRef = useRef(currentHeartRate);
  const currentHeartRateUpdatedAtRef = useRef<number>(
    currentHeartRate != null ? Date.now() : 0,
  );
  const setHRPointsRef = useRef(setHRPoints);
  const restStartTimeRef = useRef(restStartTime);
  const setStartTimeStampRef = useRef(setStartTimeStamp);
  const lvpProfileRef = useRef<LVPData | null>(null);
  const lvpProfileLiftRef = useRef<string | null>(null);
  const persistenceQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingHrRecoveryRef = useRef<{
    sessionId: string;
    lift: string;
    setIndex: number;
    setEndAtMs: number;
  } | null>(null);

  const enqueuePersistence = useCallback((task: () => Promise<void>) => {
    const queuedTask = persistenceQueueRef.current
      .catch(() => undefined)
      .then(task);
    persistenceQueueRef.current = queuedTask.catch((error) => {
      console.error("[useSessionLogic] queued persistence failed:", error);
    });
    return queuedTask;
  }, []);

  // refを最新の状態に保つ
  useEffect(() => {
    repHistoryRef.current = repHistory;
    settingsRef.current = settings;
    isPausedRef.current = isPaused;
    sensorInputMutedRef.current = sensorInputMuted;
    currentExerciseRef.current = currentExercise;
    currentLoadRef.current = currentLoad;
    currentLiftRef.current = currentLift;
    currentSetIndexRef.current = currentSetIndex;
    currentSessionRef.current = currentSession;
    currentHeartRateRef.current = currentHeartRate;
    if (currentHeartRate != null) {
      currentHeartRateUpdatedAtRef.current = Date.now();
    }
    setHRPointsRef.current = setHRPoints;
    restStartTimeRef.current = restStartTime;
    setStartTimeStampRef.current = setStartTimeStamp;
  }, [
    repHistory,
    settings,
    isPaused,
    sensorInputMuted,
    currentExercise,
    currentLoad,
    currentLift,
    currentSetIndex,
    currentSession,
    currentHeartRate,
    setHRPoints,
    restStartTime,
    setStartTimeStamp,
  ]);

  useEffect(() => {
    let cancelled = false;
    if (!currentLift) {
      lvpProfileRef.current = null;
      lvpProfileLiftRef.current = null;
      return;
    }

    DatabaseService.getLVPProfile(currentLift)
      .then((profile) => {
        if (cancelled) return;
        lvpProfileRef.current = profile;
        lvpProfileLiftRef.current = currentLift;
      })
      .catch((error) => {
        if (cancelled) return;
        console.error("[useSessionLogic] LVP cache refresh failed:", error);
        lvpProfileRef.current = null;
        lvpProfileLiftRef.current = currentLift;
      });

    return () => {
      cancelled = true;
    };
  }, [currentLift]);

  // --- Setup finishSet for reuse ---

  const finishSet = useCallback(
    async (repsOverride?: RepData[]) => {
      // 既存のタイマーをクリア（メモリリーク防止）
      if (autoFinishTimer.current) {
        clearTimeout(autoFinishTimer.current);
        autoFinishTimer.current = null;
      }

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
      const repsToSave = repsOverride ?? repHistoryRef.current;

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

      // refから最新の状態を取得
      const currentLoad = currentLoadRef.current;
      const currentHeartRate = currentHeartRateRef.current;
      const setHRPoints = setHRPointsRef.current;
      const restStartTime = restStartTimeRef.current;
      const setStartTimeStamp = setStartTimeStampRef.current;
      const currentSession = currentSessionRef.current;
      const currentLift = currentLiftRef.current;
      const currentSetIndex = currentSetIndexRef.current;
      const currentExercise = currentExerciseRef.current;
      const currentSettings = settingsRef.current;
      const currentSetHistory = setHistory; // setHistoryはrefではなく直接使用（DB保存後に更新されるため）

      // セット平均を計算
      const avgVel =
        validReps.reduce((sum, r) => sum + (r.mean_velocity ?? 0), 0) /
        validReps.length;
      const peakVel = Math.max(...validReps.map((r) => r.peak_velocity ?? 0));
      const validRoms = validReps
        .map((r) => r.rom_cm)
        .filter((rom): rom is number => rom != null && rom > 0);
      const avgRom =
        validRoms.length > 0
          ? validRoms.reduce((sum, rom) => sum + rom, 0) / validRoms.length
          : null;

      // Velocity Loss: avgは互換、last/minは判定用
      const velocityLossMetrics =
        VBTCalculations.calculateVelocityLossMetrics(validReps);
      const vLoss = velocityLossMetrics.vlAvg ?? 0;

      // e1RMは有効レップ数(validReps.length)を基準に計算（reps <= 0の場合はnull）
      const e1rm =
        VBTLogic.calculateE1RM(currentLoad, validReps.length) ?? null;

      // 平均パワーの計算（パワー値が存在するレップのみで計算）
      const repsWithPower = validReps.filter(
        (r) => r.mean_power_w != null && r.mean_power_w > 0,
      );
      const avgPower =
        repsWithPower.length > 0
          ? repsWithPower.reduce((sum, r) => sum + r.mean_power_w!, 0) /
            repsWithPower.length
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
      const shouldTrackHrRecovery =
        peakHr != null &&
        peakHr >= HR_READY_THRESHOLD_BPM + HR_RECOVERY_MIN_PEAK_OVER_READY_BPM;

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
        velocity_loss_avg: velocityLossMetrics.vlAvg,
        velocity_loss_last: velocityLossMetrics.vlLast,
        velocity_loss_min: velocityLossMetrics.vlMin,
        avg_rom_cm: avgRom,
        e1rm: e1rm,
        timestamp: endTimestamp,
        start_timestamp: setStartTimeStamp || undefined,
        end_timestamp: endTimestamp,
        rest_duration_s: restDuration,
        avg_hr: avgHr,
        peak_hr: peakHr,
        hr_recovery_to_120_s: null,
        avg_power_w: avgPower,
        is_warmup: isWarmupSet.current,
      };

      // ウォームアップセットフラグをリセット
      isWarmupSet.current = false;

      // Storeに保存
      lastAcceptedRepSignature.current = null;
      lastAcceptedRepAt.current = 0;
      completeSet(newSet);
      void LiveShareService.sendEvent("set_completed", {
        session_id: newSet.session_id,
        lift: newSet.lift,
        set_index: newSet.set_index,
        load_kg: newSet.load_kg,
        reps: newSet.reps,
        avg_velocity: newSet.avg_velocity,
        peak_velocity: peakVel,
        velocity_loss: newSet.velocity_loss,
        velocity_loss_avg: newSet.velocity_loss_avg,
        velocity_loss_last: newSet.velocity_loss_last,
        velocity_loss_min: newSet.velocity_loss_min,
        vl_judgement_metric: "vlLast",
        avg_rom_cm: newSet.avg_rom_cm,
        avg_power_w: newSet.avg_power_w,
        avg_hr: newSet.avg_hr,
        peak_hr: newSet.peak_hr,
        rest_duration_s: newSet.rest_duration_s,
        is_warmup: newSet.is_warmup,
        start_timestamp: newSet.start_timestamp,
        end_timestamp: newSet.end_timestamp,
      });

      if (
        currentSession?.session_id &&
        shouldTrackHrRecovery
      ) {
        pendingHrRecoveryRef.current = {
          sessionId: currentSession.session_id,
          lift: newSet.lift,
          setIndex: newSet.set_index,
          setEndAtMs: new Date(endTimestamp).getTime(),
        };
      } else {
        pendingHrRecoveryRef.current = null;
      }

      // === VBT Intelligence 更新 ===
      const updatedHistory = [...currentSetHistory, newSet];
      const cnsBattery =
        VBTCalculations.calculateCNSFatigueScore(updatedHistory);

      // 次セットの推奨重量 (Adaptive Load Engine™)
      let suggestedLoad = currentLoad;
      if (avgVel) {
        const suggestion = VBTGuideService.suggestNextLoad(
          avgVel,
          (currentSettings.target_training_phase as any) || "strength",
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

      const persistCompletedSet = async () => {
        try {
          if (currentSession?.session_id) {
            await DatabaseService.insertSet(newSet);
            // repsOverrideが指定された場合はそれを使う（自動終了時の最終レップ含む）
            for (const rep of repsToSave) {
              await DatabaseService.insertRep(rep);
            }

            try {
              const lift = currentLift || "Unknown";
              if (!currentSettings.enable_session_lightweight_mode) {
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
              }
            } catch (estimateError) {
              console.error(
                "[finishSet] 4-point 1RM estimation failed:",
                estimateError,
              );
            }

            // === PR検知 ===
            const today = new Date().toISOString().split("T")[0];
            const lift = currentLift || "Unknown";
            const previousWorkingSets = currentSetHistory.filter(
              (set) =>
                set.lift === lift &&
                !set.is_warmup &&
                set.avg_rom_cm != null &&
                set.avg_rom_cm > 0,
            );
            const baselineRom =
              previousWorkingSets.length > 0
                ? Math.max(
                    ...previousWorkingSets.map((set) => set.avg_rom_cm ?? 0),
                  )
                : null;
            const romTooShallowForPR =
              baselineRom != null &&
              newSet.avg_rom_cm != null &&
              newSet.avg_rom_cm < baselineRom - 2;
            const peakVelocityLooksInvalid = peakVel != null && peakVel > 2.0;
            const prEligible =
              !newSet.is_warmup &&
              !romTooShallowForPR &&
              !peakVelocityLooksInvalid;

            // 1. e1RM PR チェック
            if (e1rm && prEligible) {
              const bestE1RM = await DatabaseService.getBestPR(lift, "e1rm");
              if (!bestE1RM) {
                await DatabaseService.insertPRRecord({
                  id: `pr_e1rm_${Date.now()}`,
                  type: "e1rm",
                  lift,
                  value: e1rm,
                  load_kg: currentLoad,
                  reps: validReps.length,
                  date: today,
                  previous_value: undefined,
                  improvement: 0,
                });
              } else if (e1rm > bestE1RM.value + E1RM_PR_MIN_IMPROVEMENT_KG) {
                const prRecord: PRRecord = {
                  id: `pr_e1rm_${Date.now()}`,
                  type: "e1rm",
                  lift,
                  value: e1rm,
                  load_kg: currentLoad,
                  reps: validReps.length,
                  date: today,
                  previous_value: bestE1RM.value,
                  improvement: e1rm - bestE1RM.value,
                };
                await DatabaseService.insertPRRecord(prRecord);
                onPRDetected?.(prRecord);
                AudioService.announcePR();
              }
            }

            // 2. 最高速度 PR チェック
            if (peakVel && prEligible) {
              const bestSpeed = await DatabaseService.getBestSpeedPRForLoad(
                lift,
                currentLoad,
              );
              if (!bestSpeed) {
                await DatabaseService.insertPRRecord({
                  id: `pr_speed_${Date.now()}`,
                  type: "speed",
                  lift,
                  value: peakVel,
                  load_kg: currentLoad,
                  reps: validReps.length,
                  date: today,
                  previous_value: undefined,
                  improvement: 0,
                });
              } else if (peakVel > bestSpeed.value + SPEED_PR_MIN_IMPROVEMENT_MPS) {
                const prRecord: PRRecord = {
                  id: `pr_speed_${Date.now()}`,
                  type: "speed",
                  lift,
                  value: peakVel,
                  load_kg: currentLoad,
                  reps: validReps.length,
                  date: today,
                  previous_value: bestSpeed.value,
                  improvement: peakVel - bestSpeed.value,
                };
                await DatabaseService.insertPRRecord(prRecord);
                onPRDetected?.(prRecord);
              }
            }

            // === LVP自動更新 ===
            // セットごとにLVPを更新して1eRMを常に最新に保つ（1セット以上で更新）
            // 品質チェックによりR² > 0.7の場合のみ更新 to誤ったLVP計算を防止
            const updatedSetsForLVP = updatedHistory.filter(
              (s) => s.avg_velocity && s.load_kg,
            );
            if (updatedSetsForLVP.length >= 1) {
              const lvp = VBTCalculations.calculateLVP(
                updatedSetsForLVP.map((s) => ({
                  load: s.load_kg,
                  velocity: s.avg_velocity!,
                })),
                currentExercise?.mvt,
              );

              if (lvp && lvp.r_squared > 0.7) {
                await DatabaseService.saveLVPProfile({
                  ...lvp,
                  lift,
                });
                if (lvpProfileLiftRef.current === lift) {
                  lvpProfileRef.current = {
                    ...lvp,
                    lift,
                  };
                }
              }
            }

            if (!currentSettings.enable_session_lightweight_mode) {
              await ExerciseService.inferRomRangeForLift(lift);
            }
          }
        } catch (e) {
          console.error("セット保存失敗:", e);
        }
      };

      startRest(); // 休憩タイマー開始
      AudioService.speakCoach("セット完了。お疲れ様でした。");

      // ガードフラグをクリア（次のセット用）
      isFinishingSet.current = false;
      void enqueuePersistence(persistCompletedSet);
    },
    [
      completeSet,
      setHistory,
      updateVBTIntelligence,
      startRest,
      onPRDetected,
      isSessionActive,
      enqueuePersistence,
    ],
  );

  // --- BLE Event Handlers ---

  const handleDataReceived = useCallback(
    async (data: RepVeloData) => {
      const normalizedData = normalizeRepVeloData(data);
      if (!normalizedData) {
        return;
      }
      data = normalizedData;

      // 0. Auto-start mode: セッションが開始されていない場合で、自動スタートモードが有効な場合に自動開始
      // refから最新の状態を取得（パフォーマンス最適化）
      const currentSettings = settingsRef.current;
      let currentIsPaused = isPausedRef.current;
      const currentSensorInputMuted = sensorInputMutedRef.current;
      const currentExercise = currentExerciseRef.current;

      if (currentSensorInputMuted) {
        console.log(
          "[handleDataReceived] Sensor input muted, discarding input",
        );
        return;
      }

      const autoStartRomThreshold =
        currentExercise?.auto_start_rom_cm ??
        currentSettings.auto_start_rom_cm ??
        AUTO_START_ROM_DEFAULT_CM; // デフォルト値5cm

      if (
        !isSessionActive &&
        currentSettings.enable_auto_start_session &&
        data.rom_cm > autoStartRomThreshold
      ) {
        console.log(
          "[handleDataReceived] Auto-starting session on movement detection",
        );
        onAutoStart?.();
        return;
      }

      // セット間のオートスタート（休憩中に動きが検出されたら自動的にセット再開）
      if (
        currentIsPaused &&
        pauseReason === "rest" &&
        data.rom_cm > autoStartRomThreshold
      ) {
        console.log(
          "[handleDataReceived] Auto-resuming set on movement detection",
        );
        resumeSet();
        currentIsPaused = false;
        // 休憩解除後、このレップを通常通り処理する
      }

      // 1. Finish Set Guard - finishSet実行中（DB保存中）はBLE入力を完全に破棄
      if (isFinishingSet.current) {
        console.log(
          "[handleDataReceived] Finishing set in progress, discarding BLE input to prevent duplicate reps",
        );
        return;
      }

      // 2. Pause Gate - 休憩中(isPaused)はBLE入力を完全に破棄
      if (currentIsPaused) {
        console.log("[handleDataReceived] Paused, discarding BLE input");
        return;
      }

      const currentLoad = currentLoadRef.current;
      const resolvePower = (
        reportedPower: number | undefined,
        velocity: number | undefined,
      ): number | null => {
        if (reportedPower != null && reportedPower > 0) {
          return reportedPower;
        }
        if (velocity != null && velocity > 0 && currentLoad > 0) {
          return VBTLogic.calculatePower(currentLoad, velocity);
        }
        return null;
      };
      const meanPower = resolvePower(data.mean_power_w, data.mean_velocity);
      const peakPower = resolvePower(data.peak_power_w, data.peak_velocity);
      const enrichedLiveData = {
        ...data,
        mean_power_w: meanPower ?? undefined,
        peak_power_w: peakPower ?? undefined,
      };

      // 3. Update Live Data in Store (for UI)
      setLiveData(enrichedLiveData);

      // 3. Process Rep Logic
      const minRom = currentExercise?.min_rom_threshold ?? MIN_ROM_DEFAULT_CM;
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
        now - lastAcceptedRepAt.current < REP_DEDUP_WINDOW_MS
      ) {
        console.log(
          "[handleDataReceived] Duplicate rep payload ignored",
          repSignature,
        );
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
      const currentRepHistory = repHistoryRef.current;
      if (
        !isWarmupSet.current &&
        !currentIsPaused &&
        currentRepHistory.length > 0
      ) {
        autoFinishTimer.current = setTimeout(() => {
          console.log(
            "[useSessionLogic] Auto-finishing set due to no movement",
          );
          finishSet();
        }, AUTO_FINISH_TIMEOUT_MS);
      }

      if (isValidRep) {
        const isAutoSetupRep = Boolean(
          currentExercise?.ignore_first_rep_as_setup &&
          currentRepHistory.length === 0,
        );

        // 3. Audio Feedback (Velocity Sense™)
        if (currentSettings.enable_audio_feedback && !isAutoSetupRep) {
          const isGood = data.mean_velocity >= 0.5;
          const announcements: string[] = [];
          if (currentSettings.enable_audio_rep_count) {
            announcements.push(`${currentRepHistory.length + 1}レップ`);
          }
          if (currentSettings.enable_audio_velocity_readout) {
            announcements.push(`${data.mean_velocity.toFixed(2)}`);
          }
          if (currentSettings.enable_audio_faster_cue && !isGood) {
            announcements.push("もっと速く");
          }
          if (announcements.length > 0) {
            void AudioService.speak(announcements.join("。"));
          }
        }

        // 4. Calculate Derived Metrics
        const isShort = currentExercise
          ? VBTCalculations.isShortROM(data.rom_cm, currentExercise)
          : false;

        const currentSession = currentSessionRef.current;
        const currentLift = currentLiftRef.current;
        const currentSetIndex = currentSetIndexRef.current;
        const currentHeartRate = currentHeartRateRef.current;

        const newRep: RepData = {
          id: `${Date.now().toString()}-${Math.random().toString(36).substring(2, 15)}`,
          session_id: currentSession?.session_id || "offline",
          lift: currentLift || "Unknown",
          set_index: currentSetIndex,
          rep_index: currentRepHistory.length + 1,
          mean_velocity: data.mean_velocity,
          peak_velocity: data.peak_velocity,
          rom_cm: data.rom_cm,
          rep_duration_ms: data.rep_duration_ms,
          mean_power_w: meanPower,
          peak_power_w: peakPower,
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
        void LiveShareService.sendEvent("rep_recorded", {
          session_id: newRep.session_id,
          lift: newRep.lift,
          set_index: newRep.set_index,
          rep_index: newRep.rep_index,
          load_kg: newRep.load_kg,
          mean_velocity: newRep.mean_velocity,
          peak_velocity: newRep.peak_velocity,
          rom_cm: newRep.rom_cm,
          mean_power_w: newRep.mean_power_w,
          peak_power_w: newRep.peak_power_w,
          hr_bpm: newRep.hr_bpm,
          is_valid_rep: newRep.is_valid_rep,
          is_short_rom: newRep.is_short_rom,
          is_excluded: newRep.is_excluded,
          timestamp: newRep.timestamp,
        });

        // 6. Intelligent 1RM Estimator (セッション中の全レップデータを活用)
        const allReps = [...currentRepHistory, newRep];
        const liveVelocityLossMetrics =
          VBTCalculations.calculateVelocityLossMetrics(allReps);
        const vLoss =
          liveVelocityLossMetrics.vlLast ?? liveVelocityLossMetrics.vlAvg ?? 0;

        if (data.mean_velocity > 0) {
          const lvp =
            lvpProfileLiftRef.current === currentLift
              ? lvpProfileRef.current
              : null;
          if (lvp && lvp.slope < 0) {
            // MVT基準のbaseline 1RMを計算（getVelocityAt1RM経由でmvtを優先）
            const velocityAt1RM = getVelocityAt1RM(lvp);
            const baseline1RM = (velocityAt1RM - lvp.intercept) / lvp.slope;

            // ガード条件1: ウォームアップが軽すぎる場合（例: 30%未満）は予測のブレが大きいため除外
            if (currentLoad >= baseline1RM * LOAD_LOWER_BOUND_RATIO) {
              // セッション中の有効なレップデータを収集（高速なレップを優先）
              const validReps = allReps.filter(
                (rep) => rep.mean_velocity !== null && rep.mean_velocity > 0,
              );

              if (validReps.length > 0) {
                // 最新のレップ、最高速度のレップ、高負荷のレップを優先的に分析
                const sortedReps = [...validReps].sort((a, b) => {
                  // 1. 速度で降順ソート（より良いパフォーマンスを優先）
                  const velocityDiff =
                    (b.mean_velocity || 0) - (a.mean_velocity || 0);
                  // 2. 速度が同じ場合は負荷で降順（高負荷を優先）
                  if (Math.abs(velocityDiff) < 0.01) {
                    return b.load_kg - a.load_kg;
                  }
                  return velocityDiff;
                });

                // 上位3つのレップで1eRMを推定（平均化して安定性向上）
                const topReps = sortedReps.slice(
                  0,
                  Math.min(3, sortedReps.length),
                );
                const e1rmEstimates = topReps.map((rep) =>
                  VBTCalculations.estimateCurrentDay1RM(
                    rep.load_kg,
                    rep.mean_velocity!,
                    lvp,
                  ),
                );

                // 中央値を使用して外れ値の影響を低減
                // 配列が空の場合はスキップ（安全性確保）
                if (e1rmEstimates.length > 0) {
                  const sortedEstimates = [...e1rmEstimates].sort(
                    (a, b) => a - b,
                  );
                  const medianIndex = Math.floor(sortedEstimates.length / 2);
                  const e1rm = sortedEstimates[medianIndex];

                  // ガード条件2: 予測値が異常に変動した場合（例: ベースラインの±30%以上）は外れ値として無視
                  const diffRatio = Math.abs(e1rm - baseline1RM) / baseline1RM;
                  if (diffRatio <= 0.3) {
                    // 信頼度の計算: R² と変動幅、サンプル数に基づく
                    let confidence: "high" | "medium" | "low" = "low";
                    const sampleBonus = validReps.length >= 3 ? 0.1 : 0; // 複数レップで信頼度アップ

                    if (
                      lvp.r_squared >= 0.8 &&
                      diffRatio <= 0.1 - sampleBonus
                    ) {
                      confidence = "high";
                    } else if (
                      lvp.r_squared >= 0.6 &&
                      diffRatio <= 0.2 - sampleBonus
                    ) {
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
          }
        }

        // 7. Velocity Loss 警告 (最新論文基準: S:20%, B:10%, D:5%)
        const paperVL = VBTGuideService.getVlThresholdByExercise(
          currentExercise?.category || "",
          currentSettings.target_training_phase,
        );
        // 種目別VLカットオフを優先、なければグローバル設定、なければ論文値
        // ?? 演算子を使用して 0 を有効な閾値として扱う
        const currentVLThreshold =
          currentExercise?.velocity_loss_threshold ??
          currentSettings.velocity_loss_threshold ??
          paperVL;

        // VL警告が有効で、閾値が0より大きく、閾値を超えた場合のみ警告
        if (
          !isAutoSetupRep &&
          currentSettings.enable_vl_warning &&
          currentVLThreshold > 0 &&
          vLoss >= currentVLThreshold
        ) {
          if (currentSettings.enable_audio_feedback) {
            const reason = `VL_last ${vLoss.toFixed(1)}%が閾値(${currentVLThreshold}%)を超えました`;
            AudioService.announceStopSet(reason);
          }

          // 自動フィニッシュセットは無効化 - 警告のみでセット継続を許可
          // ユーザーが手動でセット完了ボタンを押すまで記録を続ける
        }
      }
    },
    [
      isSessionActive,
      pauseReason,
      setLiveData,
      addRep,
      updateVBTIntelligence,
      onAutoStart,
      finishSet,
      resumeSet,
    ],
  );

  const handleConnectionChanged = useCallback(
    (connected: boolean) => {
      setConnectionStatus(connected);
    },
    [setConnectionStatus],
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
        AudioService.setVolume(loaded.audio_volume);
      }
    });

    void CrashReportService.saveVBTSessionStageAttempt(
      "session_logic_setup_start",
      {
        entry_point: "bottom_tab",
        is_connected: Boolean(BLEService.getLastDeviceInfo().id),
      },
    ).catch((error) => {
      console.warn("[useSessionLogic] Failed to mark setup start:", error);
    });

    let bleCallbacks: Parameters<typeof BLEService.setCallbacks>[0] | null = null;
    const setupTimer = setTimeout(() => {
      if (!isMounted.current) {
        return;
      }

      bleCallbacks = {
        onDataReceived: (data) => {
          void dataReceivedRef.current(data);
        },
        onConnectionStatusChanged: (connected) => {
          connectionChangedRef.current(connected);
        },
        onError: (error) => console.error("BLE Error:", error),
      };

      BLEService.setCallbacks(bleCallbacks);
      void CrashReportService.saveVBTSessionStageAttempt(
        "session_logic_ble_callbacks_set",
        {
          entry_point: "bottom_tab",
          is_connected: Boolean(BLEService.getLastDeviceInfo().id),
        },
      ).catch((error) => {
        console.warn("[useSessionLogic] Failed to mark BLE callbacks:", error);
      });

      BLEService.isConnected()
        .then((result) => {
          if (isMounted.current) setConnectionStatus(result);
          return CrashReportService.saveVBTSessionStageAttempt(
            "session_logic_ble_status_checked",
            {
              entry_point: "bottom_tab",
              is_connected: result,
            },
          );
        })
        .catch((error) => {
          console.error("BLE status check failed:", error);
        });
    }, 350);

    return () => {
      isMounted.current = false;
      clearTimeout(setupTimer);
      // 自動完了タイマーをクリア
      if (autoFinishTimer.current) {
        clearTimeout(autoFinishTimer.current);
        autoFinishTimer.current = null;
      }
      void BLEService.stopNotifications();
      if (bleCallbacks) {
        BLEService.clearCallbacks(bleCallbacks);
      }
    };
  }, [setConnectionStatus, updateSettings]);

  // --- Audio Volume Update on Settings Change ---
  useEffect(() => {
    AudioService.setVolume(settings.audio_volume);
    AudioService.setEnabled(settings.enable_audio_feedback);
  }, [settings.audio_volume, settings.enable_audio_feedback]);

  useEffect(() => {
    if (
      !isSessionActive ||
      isPaused ||
      sensorInputMuted ||
      repHistory.length > 0 ||
      !settings.enable_audio_feedback ||
      !settings.enable_set_start_reminder
    ) {
      return;
    }

    void AudioService.announceSetStartReminder();
    const reminderTimer = setInterval(() => {
      void AudioService.announceSetStartReminder();
    }, SET_START_REMINDER_INTERVAL_MS);

    return () => clearInterval(reminderTimer);
  }, [
    isSessionActive,
    isPaused,
    repHistory.length,
    sensorInputMuted,
    settings.enable_audio_feedback,
    settings.enable_set_start_reminder,
  ]);

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

      const peakHr =
        setHistory.length > 0
          ? setHistory[setHistory.length - 1].peak_hr || 180
          : 180;

      const isReadyByAbsolute = currentHeartRate < HR_READY_THRESHOLD_BPM;
      const isReadyByRecovery = currentHeartRate < peakHr * 0.8;

      if (isReadyByAbsolute || isReadyByRecovery) {
        lastNotifiedRestTime.current = restStartTime;
        AudioService.speak("You are ready for the next set");
      }
    }
  }, [isPaused, pauseReason, currentHeartRate, restStartTime, setHistory]);

  // --- Heart Rate Recovery Tracking ---
  useEffect(() => {
    const pending = pendingHrRecoveryRef.current;
    if (!pending || !currentHeartRate) return;
    const recoverySeconds = Math.max(
      0,
      (Date.now() - pending.setEndAtMs) / 1000,
    );

    if (recoverySeconds > HR_RECOVERY_MAX_TRACK_SECONDS) {
      pendingHrRecoveryRef.current = null;
      return;
    }

    if (currentHeartRate > HR_READY_THRESHOLD_BPM) return;
    if (recoverySeconds < HR_RECOVERY_MIN_VALID_SECONDS) return;
    if (currentHeartRateUpdatedAtRef.current < pending.setEndAtMs) return;

    pendingHrRecoveryRef.current = null;
    updateSetHistory(pending.setIndex, pending.lift, {
      hr_recovery_to_120_s: recoverySeconds,
    });
    void enqueuePersistence(async () => {
      await DatabaseService.updateSetHeartRateRecovery(
        pending.sessionId,
        pending.lift,
        pending.setIndex,
        recoverySeconds,
      );
    });
  }, [currentHeartRate, enqueuePersistence, updateSetHistory]);

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
    setWarmupMode: (warmup: boolean) => {
      isWarmupSet.current = warmup;
    },
    // Expose store state for UI to consume directly if needed,
    // but preferably UI uses useTrainingStore() directly for reading state.
  };
};
