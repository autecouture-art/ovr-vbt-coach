/**
 * Training Store - Zustand State Management
 * Manages VBT training session state
 */

import { create } from 'zustand';
import type {
  TrainingSession,
  SessionData,
  SetData,
  RepData,
  Exercise,
  LVPData,
  PRRecord,
  AppSettings,
} from '../types/index';

interface TrainingState {
  // Session Management
  currentSession: TrainingSession | null;
  sessions: SessionData[];
  
  // Set & Rep Data
  currentSet: number;
  currentExercise: Exercise | null;
  liveRepData: RepData[];
  
  // BLE Connection
  isConnectedToBLE: boolean;
  bleDeviceId: string | null;
  
  // LVP & PR Data
  lvpProfiles: LVPData[];
  prRecords: PRRecord[];
  
  // Settings
  settings: AppSettings;
  
  // UI State
  notifications: Array<{ id: string; type: string; message: string }>;
  
  // Actions
  startSession: (session: TrainingSession) => void;
  endSession: () => void;
  addRepData: (rep: RepData) => void;
  addSetData: (set: SetData) => void;
  setBLEConnection: (connected: boolean, deviceId?: string) => void;
  setCurrentExercise: (exercise: Exercise | null) => void;
  setCurrentSet: (setIndex: number) => void;
  addNotification: (type: string, message: string) => void;
  clearNotifications: () => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  addPRRecord: (pr: PRRecord) => void;
  updateLVPProfile: (lvp: LVPData) => void;
}

export const useTrainingStore = create<TrainingState>((set) => ({
  // Initial State
  currentSession: null,
  sessions: [],
  currentSet: 0,
  currentExercise: null,
  liveRepData: [],
  isConnectedToBLE: false,
  bleDeviceId: null,
  lvpProfiles: [],
  prRecords: [],
  notifications: [],
  settings: {
    use_metric: true,
    velocity_loss_threshold: 30,
    enable_audio_feedback: true,
    enable_voice_commands: false,
    enable_video_recording: false,
    target_training_phase: 'hypertrophy',
  },

  // Actions
  startSession: (session: TrainingSession) =>
    set(() => ({
      currentSession: session,
      liveRepData: [],
      currentSet: 0,
    })),

  endSession: () =>
    set(() => ({
      currentSession: null,
      liveRepData: [],
      currentSet: 0,
      currentExercise: null,
    })),

  addRepData: (rep: RepData) =>
    set((state) => ({
      liveRepData: [...state.liveRepData, rep],
    })),

  addSetData: (setData: SetData) =>
    set((state: TrainingState) => ({
      currentSet: state.currentSet + 1,
    })),

  setBLEConnection: (connected: boolean, deviceId?: string) =>
    set(() => ({
      isConnectedToBLE: connected,
      bleDeviceId: deviceId || null,
    })),

  setCurrentExercise: (exercise: Exercise | null) =>
    set(() => ({
      currentExercise: exercise,
      liveRepData: [],
      currentSet: 0,
    })),

  setCurrentSet: (setIndex: number) =>
    set(() => ({
      currentSet: setIndex,
    })),

  addNotification: (type: string, message: string) =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        {
          id: Date.now().toString(),
          type,
          message,
        },
      ],
    })),

  clearNotifications: () =>
    set(() => ({
      notifications: [],
    })),

  updateSettings: (newSettings: Partial<AppSettings>) =>
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    })),

  addPRRecord: (pr: PRRecord) =>
    set((state) => ({
      prRecords: [...state.prRecords, pr],
    })),

  updateLVPProfile: (lvp: LVPData) =>
    set((state) => {
      const existing = state.lvpProfiles.findIndex((p) => p.lift === lvp.lift);
      if (existing >= 0) {
        const updated = [...state.lvpProfiles];
        updated[existing] = lvp;
        return { lvpProfiles: updated };
      }
      return { lvpProfiles: [...state.lvpProfiles, lvp] };
    }),
}));
