/**
 * RepVelo VBT Coach Type Definitions
 */

// ========================================
// Core VBT Types
// ========================================

export type DeviceType = "VBT" | "manual" | "OVR Velocity";
export type SetType = "normal" | "amrap" | "drop" | "superset_A" | "superset_B";

export interface RepData {
  id?: string; // Unique identifier for the rep (UUID)
  session_id: string;
  lift: string;
  set_index: number;
  rep_index: number;
  load_kg: number;
  device_type: DeviceType;
  mean_velocity: number | null;
  peak_velocity: number | null;
  rom_cm: number | null;
  mean_power_w: number | null;
  rep_duration_ms: number | null;
  is_valid_rep: boolean;
  is_short_rom?: boolean;
  rpe_set?: number;
  set_type: SetType;
  notes?: string;
  hr_bpm?: number; // 心拍数 (bpm)
  timestamp: string;
  is_excluded?: boolean;
  exclusion_reason?: string;
  edited_at?: number;
  is_failed?: boolean;
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
  e1rm?: number | null;
  timestamp: string; // 完了時間
  start_timestamp?: string; // セット開始時間
  end_timestamp?: string; // セット完了時間
  rest_duration_s?: number; // 前のセットからの休憩時間
  avg_hr?: number; // 平均心拍数
  peak_hr?: number; // 最大心拍数
  notes?: string;
  avg_power_w?: number | null;
  is_warmup?: boolean; // ウォームアップセットフラグ
}

export interface SessionData {
  session_id: string;
  date: string;
  total_volume: number;
  total_sets: number;
  lifts?: string[]; // Optional: not stored in DB schema, derived from sets when needed
  duration_minutes?: number;
  duration_seconds?: number; // 詳細な経過時間
  start_timestamp?: string; // セッション開始時間
  end_timestamp?: string; // セッション終了時間
  avg_hr?: number; // 平均心拍数
  notes?: string;
}

// ========================================
// Load-Velocity Profile (LVP)
// ========================================

export interface LVPData {
  lift: string;
  vmax: number; // Maximum velocity at lightest load
  v1rm: number; // Velocity at 1RM
  mvt?: number; // Minimum Velocity Threshold (1RM velocity specific to lift)
  slope: number; // LVP slope
  intercept: number; // LVP intercept
  r_squared: number; // Model fit quality
  last_updated: string;
  sample_count?: number;
}

export interface VelocityZone {
  name: "power" | "strength_speed" | "hypertrophy" | "strength";
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

export interface RepVeloData {
  mean_velocity: number;
  peak_velocity: number;
  rom_cm: number;
  rep_duration_ms: number;
  mean_power_w?: number; // 平均パワー (W)
  peak_power_w?: number; // ピークパワー (W)
  timestamp: number;
  // Raw data for debugging
  raw_peak_v?: number;
  raw_mean_v?: number;
  raw_rom?: number;
  raw_mean_p?: number;
  raw_peak_p?: number;
}

// ========================================
// Training Types
// ========================================

export interface Exercise {
  id: string;
  name: string;
  category:
    | "squat"
    | "bench"
    | "deadlift"
    | "press"
    | "pull"
    | "row"
    | "vertical_pull"
    | "single_leg"
    | "quad"
    | "hamstring"
    | "adductor"
    | "glute"
    | "triceps"
    | "biceps"
    | "core"
    | "accessory";
  subcategory?: string;
  has_lvp: boolean;
  machine_weight_steps?: number[];
  min_rom_threshold?: number; // 最小ROM (cm) - デフォルト 10
  rep_detection_mode?: "standard" | "tempo" | "pause" | "short_rom";
  target_pause_ms?: number; // 目標静止時間 (ms)
  rom_range_min_cm?: number;
  rom_range_max_cm?: number;
  rom_data_points?: number;
  description?: string;
  mvt?: number; // Minimum Velocity Threshold (e.g., 0.15 for bench, 0.3 for squat)
  ignore_first_rep_as_setup?: boolean;
  velocity_loss_threshold?: number; // 種目別VLカットオフ (%)
  auto_start_rom_cm?: number; // 自動スタートROM閾値 (cm) - 種目別オーバーライド
  training_cue?: string; // トレーニングキュー（実行時の意識ポイントなど）
  focus_note?: string; // フォーカスノート（種目ごとの注意点など）
}

export interface TrainingSession {
  session_id: string; // DBとの整合性のためのセッションID
  id: string;
  date: string;
  exercises: Exercise[];
  sets: SetData[];
  total_volume: number;
  readiness_score?: number;
  start_timestamp?: string;
  end_timestamp?: string;
  avg_hr?: number;
  notes?: string;
}

// ========================================
// PR (Personal Record) Types
// ========================================

export type PRType =
  | "e1rm"
  | "speed"
  | "set"
  | "volume"
  | "1rm"
  | "velocity"
  | "power";

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
  readiness_level: "excellent" | "good" | "normal" | "fatigued";
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
  type: "pr" | "warning" | "info" | "success";
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
  target_training_phase: "power" | "hypertrophy" | "strength" | "peaking";
  audio_volume: number; // 0.0 to 1.0
  enable_warmup_recommendations: boolean;
  enable_audio_rep_count: boolean;
  enable_audio_velocity_readout: boolean;
  enable_audio_faster_cue: boolean;
  enable_auto_start_session: boolean; // 自動スタートモード
  auto_start_rom_cm: number; // 自動スタートROM閾値 (cm) - デフォルト 5
  enable_vl_warning: boolean; // VL警告音オンオフ - デフォルト true
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
