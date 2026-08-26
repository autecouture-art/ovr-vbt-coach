import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AppSettings } from "@/src/types/index";
import { normalizeVelocityLossThreshold } from "@/src/utils/VelocityLossThreshold";

export const SETTINGS_KEY = "@app_settings";

export const DEFAULT_APP_SETTINGS: AppSettings = {
  use_metric: true,
  velocity_loss_threshold: 20,
  enable_audio_feedback: true,
  enable_voice_commands: false,
  enable_video_recording: false,
  enable_form_video_ble_safe_mode: false,
  enable_google_drive_crash_report_upload: false,
  enable_google_drive_crash_report_auto_upload: false,
  google_drive_crash_report_url: "",
  google_drive_crash_report_token: "",
  enable_live_share: false,
  live_share_url: "",
  live_share_token: "",
  enable_improvement_feedback_sync: false,
  target_training_phase: "strength",
  powerlifting_block_week: 5,
  audio_volume: 1.0,
  enable_warmup_recommendations: true,
  enable_audio_rep_count: false,
  enable_audio_velocity_readout: false,
  enable_audio_faster_cue: true,
  enable_set_start_reminder: true,
  enable_auto_start_session: false,
  auto_start_rom_cm: 5,
  enable_vl_warning: true,
  enable_session_lightweight_mode: true,
  session_display_advice_group: true,
  session_display_status: true,
  session_display_simulator: true,
  session_display_exercise_picker: true,
  session_display_vl_settings: true,
  session_display_protocol: true,
  session_display_lvp_build: true,
  session_display_training_notes: true,
  session_display_session_note: true,
  session_display_session_banner: true,
  session_display_intelligence: true,
  session_display_attempt_guide: true,
  session_display_suggestions: true,
  session_display_rest_timer: true,
  session_display_target_weight: true,
  session_display_warmup_guide: true,
  session_display_readiness: true,
  session_display_set_config: true,
  session_display_live_data: true,
  session_display_velocity_chart: true,
  session_display_vl_decision: true,
  session_display_action_buttons: true,
  session_display_same_load_history: true,
  session_display_recent_history: true,
  session_display_session_history: true,
  session_display_end_session: true,
  session_display_focus_simulator: true,
  session_display_focus_info_grid: true,
  session_display_focus_velocity: true,
  session_display_focus_metrics: true,
  session_display_focus_rep_counter: true,
  session_display_focus_zone: true,
  session_display_focus_vl: true,
  session_display_focus_heart_rate: true,
  session_display_focus_load: true,
  enable_product_session_dashboard: false,
};

export async function loadAppSettings(): Promise<AppSettings> {
  try {
    const stored = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!stored) {
      return DEFAULT_APP_SETTINGS;
    }
    const merged = {
      ...DEFAULT_APP_SETTINGS,
      ...(JSON.parse(stored) as Partial<AppSettings>),
      enable_product_session_dashboard: false,
    };
    return {
      ...merged,
      velocity_loss_threshold: normalizeVelocityLossThreshold(
        merged.velocity_loss_threshold,
      ),
    };
  } catch (error) {
    console.error("Failed to load app settings:", error);
    return DEFAULT_APP_SETTINGS;
  }
}

export async function saveAppSettings(
  nextSettings: AppSettings,
): Promise<AppSettings> {
  const merged = {
    ...DEFAULT_APP_SETTINGS,
    ...nextSettings,
    velocity_loss_threshold: normalizeVelocityLossThreshold(
      nextSettings.velocity_loss_threshold,
    ),
  };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  return merged;
}
