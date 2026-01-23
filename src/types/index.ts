/**
 * OVR VBT Coach Type Definitions
 */

// ========================================
// Core VBT Types
// ========================================

export type DeviceType = 'VBT' | 'manual';
export type SetType = 'normal' | 'amrap' | 'drop' | 'superset_A' | 'superset_B';

export interface RepData {
  session_id: string;
  lift: string;
  set_index: number;
  rep_index: number;
  load_kg: number;
  device_type: DeviceType;
  mean_velocity: number | null;
  peak_velocity: number | null;
  rom_cm: number | null;
  rep_duration_ms: number | null;
  is_valid_rep: boolean;
  rpe_set?: number;
  set_type: SetType;
  notes?: string;
  timestamp: string;
}

export interface SetData {
  session_id: string;
  lift: string;
  set_index: number;
  load_kg: number;
  reps: number;
  device_type: DeviceType;
  set_type: SetType;
  avg_velocity: number | null;
  velocity_loss: number | null;
  rpe?: number;
  e1rm?: number;
  timestamp: string;
  notes?: string;
}

export interface SessionData {
  session_id: string;
  date: string;
  total_volume: number;
  total_sets: number;
  lifts: string[];
  duration_minutes?: number;
  notes?: string;
}

// ========================================
// Load-Velocity Profile (LVP)
// ========================================

export interface LVPData {
  lift: string;
  vmax: number; // Maximum velocity at lightest load
  v1rm: number; // Velocity at 1RM
  slope: number; // LVP slope
  intercept: number; // LVP intercept
  r_squared: number; // Model fit quality
  last_updated: string;
}

export interface VelocityZone {
  name: 'power' | 'strength_speed' | 'hypertrophy' | 'strength';
  min_velocity: number;
  max_velocity: number;
  load_range: string;
  color: string;
}

// ========================================
// BLE Types
// ========================================

export interface BLEDeviceInfo {
  id: string;
  name: string;
  rssi?: number;
  isConnected: boolean;
}

export interface OVRData {
  mean_velocity: number;
  peak_velocity: number;
  rom_cm: number;
  rep_duration_ms: number;
  timestamp: number;
}

// ========================================
// Training Types
// ========================================

export interface Exercise {
  id: string;
  name: string;
  category: 'squat' | 'bench' | 'deadlift' | 'press' | 'pull' | 'accessory';
  has_lvp: boolean;
  machine_weight_steps?: number[];
}

export interface TrainingSession {
  id: string;
  date: string;
  exercises: Exercise[];
  sets: SetData[];
  total_volume: number;
  readiness_score?: number;
  notes?: string;
}

// ========================================
// PR (Personal Record) Types
// ========================================

export type PRType = 'e1rm' | 'speed' | 'set' | 'volume';

export interface PRRecord {
  id: string;
  type: PRType;
  lift: string;
  value: number;
  load_kg?: number;
  reps?: number;
  date: string;
  previous_value?: number;
  improvement: number;
}

// ========================================
// AI Coaching Types
// ========================================

export interface ReadinessAssessment {
  delta_v: number; // Velocity difference from baseline
  readiness_level: 'excellent' | 'good' | 'normal' | 'fatigued';
  load_adjustment: number; // Percentage adjustment
  recommendation: string;
}

export interface SetRecommendation {
  recommended_load: number;
  target_velocity: number;
  target_reps: number;
  reasoning: string;
}

export interface DropSetRecommendation {
  next_load: number;
  load_reduction_percent: number;
  target_velocity_range: [number, number];
  estimated_reps: number;
}

// ========================================
// UI State Types
// ========================================

export interface AppState {
  currentSession: TrainingSession | null;
  isConnectedToBLE: boolean;
  currentExercise: Exercise | null;
  currentSet: number;
  liveRepData: RepData[];
  notifications: NotificationData[];
}

export interface NotificationData {
  id: string;
  type: 'pr' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

// ========================================
// Chart/Graph Types
// ========================================

export interface ChartDataPoint {
  x: number;
  y: number;
  label?: string;
}

export interface LVPChartData {
  lift: string;
  data_points: ChartDataPoint[];
  lvp_line: ChartDataPoint[];
  zones: VelocityZone[];
}

// ========================================
// Settings Types
// ========================================

export interface AppSettings {
  use_metric: boolean;
  velocity_loss_threshold: number;
  enable_audio_feedback: boolean;
  enable_voice_commands: boolean;
  enable_video_recording: boolean;
  target_training_phase: 'power' | 'hypertrophy' | 'strength' | 'peaking';
}

// ========================================
// Database Types
// ========================================

export interface DBSchema {
  sessions: SessionData[];
  sets: SetData[];
  reps: RepData[];
  lvp_profiles: LVPData[];
  pr_records: PRRecord[];
  exercises: Exercise[];
  settings: AppSettings;
}

// ========================================
// Export all types
// ========================================

export type {
  DeviceType,
  SetType,
  RepData,
  SetData,
  SessionData,
  LVPData,
  VelocityZone,
  BLEDeviceInfo,
  OVRData,
  Exercise,
  TrainingSession,
  PRType,
  PRRecord,
  ReadinessAssessment,
  SetRecommendation,
  DropSetRecommendation,
  AppState,
  NotificationData,
  ChartDataPoint,
  LVPChartData,
  AppSettings,
  DBSchema,
};
