import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AppSettings } from "@/src/types/index";

export const SETTINGS_KEY = "@app_settings";

export const DEFAULT_APP_SETTINGS: AppSettings = {
  use_metric: true,
  velocity_loss_threshold: 20,
  enable_audio_feedback: true,
  enable_voice_commands: false,
  enable_video_recording: false,
  target_training_phase: "hypertrophy",
  audio_volume: 1.0,
  enable_warmup_recommendations: true,
  enable_audio_rep_count: false,
  enable_audio_velocity_readout: false,
  enable_audio_faster_cue: true,
};

export async function loadAppSettings(): Promise<AppSettings> {
  try {
    const stored = await AsyncStorage.getItem(SETTINGS_KEY);
    if (!stored) {
      return DEFAULT_APP_SETTINGS;
    }
    return {
      ...DEFAULT_APP_SETTINGS,
      ...(JSON.parse(stored) as Partial<AppSettings>),
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
  };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
  return merged;
}
