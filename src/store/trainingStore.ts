/**
 * Training Store - Zustand State Management
 * Manages VBT training session state, ensuring data persistence across screens.
 */

import { createWithEqualityFn } from "zustand/traditional";
import type {
  TrainingSession,
  SetData,
  RepData,
  Exercise,
  AppSettings,
  RepVeloData,
} from "../types/index";
import { getJstTrainingDayId } from "../utils/SupervisorPlanGuards";
import { DEFAULT_APP_SETTINGS } from "../services/AppSettingsService";

const nearlyEqual = (
  a: number | null | undefined,
  b: number | null | undefined,
  epsilon: number = 0.001,
) => {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a - b) <= epsilon;
};

interface TrainingState {
  // Session State
  currentSession: TrainingSession | null;
  isSessionActive: boolean;
  isPaused: boolean;
  pauseReason?: "manual" | "rest";
  sessionStartTime: number | null; // ms
  sessionStartTimeStamp: string | null; // ISO

  // Current Set State
  currentSetIndex: number; // 1-based
  currentLift: string | null;
  currentLoad: number;
  currentReps: number;
  plannedSetCount: number | null;
  plannedRpe: number | null;
  targetWeight: number | null; // 今日の目標（トップセット）重量
  setHistory: SetData[];
  setStartTimeStamp: string | null; // セット開始時の ISO
  restStartTime: number | null; // 休憩開始時の ms

  // Live Data State
  isConnected: boolean;
  sensorInputMuted: boolean;
  liveData: RepVeloData | null;
  repHistory: RepData[]; // Current set reps
  currentHeartRate: number | null;
  sessionHRPoints: number[]; // セッション中の心拍数データポイント
  setHRPoints: number[]; // 各セット中の心拍数データポイント

  // Latest VBT Intelligence State
  cnsBattery: number; // 0-100%
  estimated1RM: number | null; // 本日の予想 1RM
  estimated1RM_confidence: "high" | "medium" | "low" | null; // 予測1RMの信頼度
  suggestedLoad: number | null; // 適応型エンジンによる推奨重量
  proposedMVT: number | null; // AIによるMVT更新提案

  // Settings & Metadata
  currentExercise: Exercise | null;
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => void;

  // Actions
  startSession: (sessionId: string) => void;
  restoreRecoveredSession: (data: {
    session: TrainingSession;
    setHistory: SetData[];
    currentExercise: Exercise | null;
    currentLift: string | null;
    currentLoad: number;
    currentReps: number;
    currentSetIndex?: number | null;
    sessionStartTime: number | null;
    sessionStartTimeStamp: string | null;
  }) => void;
  endSession: () => void;
  setConnectionStatus: (status: boolean) => void;
  setSensorInputMuted: (muted: boolean) => void;
  setLiveData: (data: RepVeloData | null) => void;
  addRep: (rep: RepData) => void;
  completeSet: (setData: SetData) => void;
  updateLoad: (load: number) => void;
  updateReps: (reps: number) => void;
  setPlannedSetCount: (sets: number | null) => void;
  setPlannedRpe: (rpe: number | null) => void;
  setTargetWeight: (weight: number | null) => void;
  setCurrentExercise: (exercise: Exercise) => void;
  resetSetData: () => void;
  removeRepFromHistory: (repId: string) => void; // Changed from repIndex to repId
  markRepFailedInHistory: (repId: string, isFailed: boolean) => void; // Changed from repIndex to repId
  updateSetHistory: (
    setIndex: number,
    lift: string,
    setData: Partial<SetData>,
  ) => void;
  removeSetFromHistory: (setIndex: number, lift: string) => void;

  // New Actions for VBT Intelligence
  updateVBTIntelligence: (data: {
    cnsBattery?: number;
    estimated1RM?: number;
    estimated1RM_confidence?: "high" | "medium" | "low";
    suggestedLoad?: number;
  }) => void;
  setProposedMVT: (mvt: number | null) => void;

  // New Actions for HR & Timer
  updateHeartRate: (bpm: number | null) => void;
  startSet: () => void;
  startRest: () => void;
  resumeSet: () => void; // 休憩再開専用（履歴を保持）
  setPaused: (paused: boolean, reason?: "manual" | "rest") => void;
}

export const useTrainingStore = createWithEqualityFn<TrainingState>((set, get) => ({
  // Initial State
  currentSession: null,
  isSessionActive: false,
  isPaused: false,
  pauseReason: undefined,
  sessionStartTime: null,
  sessionStartTimeStamp: null,

  currentSetIndex: 1,
  currentLift: null,
  currentLoad: 0,
  currentReps: 5,
  plannedSetCount: null,
  plannedRpe: null,
  targetWeight: null,
  setHistory: [],
  setStartTimeStamp: null,
  restStartTime: null,

  isConnected: false,
  sensorInputMuted: false,
  liveData: null,
  repHistory: [],
  currentHeartRate: null,
  sessionHRPoints: [],
  setHRPoints: [],

  cnsBattery: 100,
  estimated1RM: null,
  estimated1RM_confidence: null,
  suggestedLoad: null,
  proposedMVT: null,

  currentExercise: null,
  settings: {
    ...DEFAULT_APP_SETTINGS,
    target_training_phase: "strength",
  },

  // Actions
  startSession: (sessionId: string) => {
    const startedAt = new Date().toISOString();
    set({
      currentSession: {
        session_id: sessionId,
        id: sessionId,
        date: getJstTrainingDayId(startedAt),
        exercises: [],
        sets: [],
        total_volume: 0,
        start_timestamp: startedAt,
      },
      isSessionActive: true,
      isPaused: false,
      pauseReason: undefined,
      sessionStartTime: Date.now(),
      sessionStartTimeStamp: startedAt,
      setHistory: [],
      currentSetIndex: 1,
      plannedSetCount: null,
      plannedRpe: null,
      repHistory: [],
      sensorInputMuted: false,
      targetWeight: null,
      sessionHRPoints: [],
      setStartTimeStamp: startedAt,
      restStartTime: null,
      cnsBattery: 100,
      estimated1RM: null,
      estimated1RM_confidence: null,
      suggestedLoad: null,
      proposedMVT: null,
    });
  },

  restoreRecoveredSession: (data) => {
    const dbNextSetIndex =
      data.setHistory
        .filter((setItem) => setItem.lift === data.currentLift)
        .reduce(
          (maxIndex, setItem) => Math.max(maxIndex, setItem.set_index),
          0,
        ) + 1;
    set({
      currentSession: data.session,
      isSessionActive: true,
      isPaused: true,
      pauseReason: "manual",
      sessionStartTime: data.sessionStartTime,
      sessionStartTimeStamp: data.sessionStartTimeStamp,
      currentExercise: data.currentExercise,
      currentLift: data.currentLift,
      currentLoad: data.currentLoad,
      currentReps: data.currentReps,
      currentSetIndex: Math.max(
        1,
        data.currentSetIndex ?? dbNextSetIndex,
        dbNextSetIndex,
      ),
      setHistory: data.setHistory.slice(-50),
      repHistory: [],
      liveData: null,
      sensorInputMuted: false,
      currentHeartRate: null,
      sessionHRPoints: [],
      setHRPoints: [],
      restStartTime: null,
      setStartTimeStamp: null,
    });
  },

  endSession: () => {
    set({
      isSessionActive: false,
      isPaused: false,
      pauseReason: undefined,
      currentSession: null,
      sessionStartTime: null,
      sessionStartTimeStamp: null,
      liveData: null,
      sensorInputMuted: false,
      currentHeartRate: null,
      restStartTime: null,
      cnsBattery: 100,
      estimated1RM: null,
      estimated1RM_confidence: null,
      suggestedLoad: null,
    });
  },

  setConnectionStatus: (status: boolean) => {
    set({ isConnected: status });
  },

  setSensorInputMuted: (muted: boolean) => {
    set({
      sensorInputMuted: muted,
      liveData: muted ? null : get().liveData,
    });
  },

  setLiveData: (data: RepVeloData | null) => {
    set((state) => {
      if (!data && !state.liveData) return state;
      if (data && state.liveData) {
        const isSame =
          nearlyEqual(data.mean_velocity, state.liveData.mean_velocity) &&
          nearlyEqual(data.peak_velocity, state.liveData.peak_velocity) &&
          nearlyEqual(data.rom_cm, state.liveData.rom_cm, 0.1) &&
          nearlyEqual(data.mean_power_w, state.liveData.mean_power_w, 0.5) &&
          nearlyEqual(data.peak_power_w, state.liveData.peak_power_w, 0.5);
        if (isSame) return state;
      }
      return { liveData: data };
    });
  },

  addRep: (rep: RepData) => {
    set((state) => ({
      repHistory: [...state.repHistory, rep],
      // 心拍数があれば記録ポイントに追加（最新100件に制限）
      setHRPoints: state.currentHeartRate
        ? [...state.setHRPoints, state.currentHeartRate].slice(-100)
        : state.setHRPoints,
    }));
  },

  completeSet: (setData: SetData) => {
    set((state) => ({
      setHistory: [...state.setHistory, setData].slice(-50), // Keep only last 50 sets
      currentSetIndex: state.currentSetIndex + 1,
      repHistory: [], // Clear reps for next set
      liveData: null,
      sensorInputMuted: false,
      setStartTimeStamp: null, // Reset set timestamp for next set
      setHRPoints: [], // Reset HR points for next set
    }));
  },

  removeRepFromHistory: (repId: string) => {
    set((state) => ({
      repHistory: state.repHistory.map((rep) => {
        // Try exact ID match first (UUID or stringified number)
        if (rep.id === repId) {
          return {
            ...rep,
            is_excluded: true,
            exclusion_reason: "user_removed",
          };
        }
        // Fallback: check if repId is a numeric string and match by rep_index for backward compatibility
        const numericId = parseInt(repId, 10);
        if (!isNaN(numericId) && rep.rep_index === numericId) {
          return {
            ...rep,
            is_excluded: true,
            exclusion_reason: "user_removed",
          };
        }
        return rep;
      }),
    }));
  },

  markRepFailedInHistory: (repId: string, isFailed: boolean) => {
    set((state) => ({
      repHistory: state.repHistory.map((rep) => {
        // Try exact ID match first (UUID or stringified number)
        if (rep.id === repId) {
          return { ...rep, is_failed: isFailed };
        }
        // Fallback: check if repId is a numeric string and match by rep_index for backward compatibility
        const numericId = parseInt(repId, 10);
        if (!isNaN(numericId) && rep.rep_index === numericId) {
          return { ...rep, is_failed: isFailed };
        }
        return rep;
      }),
    }));
  },

  updateSetHistory: (
    setIndex: number,
    lift: string,
    setData: Partial<SetData>,
  ) => {
    set((state) => ({
      setHistory: state.setHistory.map((setItem) =>
        setItem.set_index === setIndex && setItem.lift === lift
          ? { ...setItem, ...setData }
          : setItem,
      ),
    }));
  },

  removeSetFromHistory: (setIndex: number, lift: string) => {
    set((state) => {
      const nextHistory = state.setHistory.filter(
        (setItem) => !(setItem.set_index === setIndex && setItem.lift === lift),
      );
      const sameLiftMaxSetIndex = nextHistory
        .filter((setItem) => setItem.lift === lift)
        .reduce(
          (maxIndex, setItem) => Math.max(maxIndex, setItem.set_index),
          0,
        );

      return {
        setHistory: nextHistory,
        currentSetIndex:
          state.currentLift === lift
            ? sameLiftMaxSetIndex + 1
            : state.currentSetIndex,
      };
    });
  },

  updateLoad: (load: number) => {
    set({ currentLoad: load });
  },

  updateReps: (reps: number) => {
    set({ currentReps: Math.max(1, Math.round(reps)) });
  },

  setPlannedSetCount: (sets: number | null) => {
    set({ plannedSetCount: sets == null ? null : Math.max(1, Math.round(sets)) });
  },

  setPlannedRpe: (rpe: number | null) => {
    set({ plannedRpe: rpe == null ? null : Math.min(10, Math.max(1, rpe)) });
  },

  setTargetWeight: (weight: number | null) => {
    set({ targetWeight: weight });
  },

  setCurrentExercise: (exercise: Exercise) => {
    set((state) => {
      const nextSetIndex =
        state.setHistory.filter((setItem) => setItem.lift === exercise.name)
          .length + 1;
      return {
        currentExercise: exercise,
        currentLift: exercise.name,
        currentSetIndex: nextSetIndex,
        setStartTimeStamp: new Date().toISOString(),
      };
    });
  },

  updateVBTIntelligence: (data) => {
    set((state) => ({
      cnsBattery: data.cnsBattery ?? state.cnsBattery,
      estimated1RM: data.estimated1RM ?? state.estimated1RM,
      estimated1RM_confidence:
        data.estimated1RM_confidence ?? state.estimated1RM_confidence,
      suggestedLoad: data.suggestedLoad ?? state.suggestedLoad,
    }));
  },

  updateHeartRate: (bpm: number | null) => {
    if (bpm) {
      set((state) => {
        if (state.currentHeartRate === bpm) return state;
        return {
          currentHeartRate: bpm,
          sessionHRPoints: [...state.sessionHRPoints, bpm].slice(-100),
        };
      });
    } else {
      set((state) =>
        state.currentHeartRate == null ? state : { currentHeartRate: null },
      );
    }
  },

  startSet: () => {
    set({
      setStartTimeStamp: new Date().toISOString(),
      setHRPoints: [],
      repHistory: [], // 新セット開始時はレップ履歴をクリア
      liveData: null,
      sensorInputMuted: false,
      isPaused: false,
      pauseReason: undefined,
      // restStartTime はクリアせず保持する（完了時の restDuration 計算のため）
    });
  },

  resumeSet: () => {
    // 休憩再開用：レップ履歴やセットタイムスタンプは保持し、一時停止を解除するのみ
    set({
      isPaused: false,
      pauseReason: undefined,
    });
  },

  startRest: () => {
    set({
      restStartTime: Date.now(),
      isPaused: true, // 休憩開始時に一時停止
      pauseReason: "rest",
    });
  },

  setPaused: (paused: boolean, reason?: "manual" | "rest") => {
    set({ isPaused: paused, pauseReason: reason });
  },

  setProposedMVT: (mvt: number | null) => {
    set({ proposedMVT: mvt });
  },

  resetSetData: () => {
    set({
      repHistory: [],
      liveData: null,
    });
  },

  updateSettings: (newSettings: Partial<AppSettings>) => {
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    }));
  },
}));
