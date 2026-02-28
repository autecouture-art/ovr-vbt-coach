/**
 * Training Store - Zustand State Management
 * Manages VBT training session state, ensuring data persistence across screens.
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
  RepVeloData,
} from '../types/index';

interface TrainingState {
  // Session State
  currentSession: TrainingSession | null;
  isSessionActive: boolean;
  sessionStartTime: number | null;

  // Current Set State
  currentSetIndex: number; // 1-based
  currentLift: string | null;
  currentLoad: number;
  currentReps: number;
  setHistory: SetData[];

  // Live Data State
  isConnected: boolean;
  liveData: RepVeloData | null;
  repHistory: RepData[]; // Current set reps

  // Settings & Metadata
  currentExercise: Exercise | null;
  settings: AppSettings;

  // Actions
  startSession: (sessionId: string) => void;
  endSession: () => void;
  setConnectionStatus: (status: boolean) => void;
  setLiveData: (data: RepVeloData | null) => void;
  addRep: (rep: RepData) => void;
  completeSet: (setData: SetData) => void;
  updateLoad: (load: number) => void;
  setCurrentExercise: (exercise: Exercise) => void;
  resetSetData: () => void;
}

export const useTrainingStore = create<TrainingState>((set, get) => ({
  // Initial State
  currentSession: null,
  isSessionActive: false,
  sessionStartTime: null,

  currentSetIndex: 1,
  currentLift: null,
  currentLoad: 0,
  currentReps: 5,
  setHistory: [],

  isConnected: false,
  liveData: null,
  repHistory: [],

  currentExercise: null,
  settings: {
    use_metric: true,
    velocity_loss_threshold: 20, // Default 20%
    enable_audio_feedback: true,
    enable_voice_commands: false,
    enable_video_recording: false,
    target_training_phase: 'strength',
  },

  // Actions
  startSession: (sessionId: string) => {
    set({
      currentSession: {
        session_id: sessionId,
        id: sessionId,
        date: new Date().toISOString(),
        exercises: [],
        sets: [],
        total_volume: 0,
      },
      isSessionActive: true,
      sessionStartTime: Date.now(),
      setHistory: [],
      currentSetIndex: 1,
      repHistory: [],
    });
  },

  endSession: () => {
    set({
      isSessionActive: false,
      currentSession: null,
      sessionStartTime: null,
      liveData: null,
    });
  },

  setConnectionStatus: (status: boolean) => {
    set({ isConnected: status });
  },

  setLiveData: (data: RepVeloData | null) => {
    set({ liveData: data });
  },

  addRep: (rep: RepData) => {
    set((state) => ({
      repHistory: [...state.repHistory, rep],
    }));
  },

  completeSet: (setData: SetData) => {
    set((state) => ({
      setHistory: [...state.setHistory, setData],
      currentSetIndex: state.currentSetIndex + 1,
      repHistory: [], // Clear reps for next set
      liveData: null,
    }));
  },

  updateLoad: (load: number) => {
    set({ currentLoad: load });
  },

  setCurrentExercise: (exercise: Exercise) => {
    set({
      currentExercise: exercise,
      currentLift: exercise.name,
      // Reset set counter if switching exercises? Maybe optional.
      // For now, keep session flow simple.
    });
  },

  resetSetData: () => {
    set({
      repHistory: [],
      liveData: null,
    });
  }
}));
