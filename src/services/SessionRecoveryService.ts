import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Exercise } from "@/src/types/index";

const ACTIVE_SESSION_KEY = "@repvelocoach_active_session_recovery_v1";
const LAST_EXERCISE_KEY = "@repvelocoach_last_session_exercise_v1";

export type ActiveSessionRecoverySnapshot = {
  schema: "repvelocoach.active-session-recovery.v1";
  saved_at: string;
  session_id: string;
  session_start_time: number | null;
  session_start_timestamp: string | null;
  current_exercise_id: string | null;
  current_exercise_name: string | null;
  current_lift: string | null;
  current_load: number;
  current_reps: number;
  current_set_index: number;
  completed_set_count: number;
  last_completed_set_at: string | null;
};

export type LastSessionExerciseSnapshot = {
  saved_at: string;
  exercise_id: string;
  exercise_name: string;
};

class SessionRecoveryService {
  async saveActiveSession(
    snapshot: Omit<ActiveSessionRecoverySnapshot, "schema" | "saved_at">,
  ): Promise<void> {
    const payload: ActiveSessionRecoverySnapshot = {
      schema: "repvelocoach.active-session-recovery.v1",
      saved_at: new Date().toISOString(),
      ...snapshot,
    };
    await AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(payload));
  }

  async getActiveSession(): Promise<ActiveSessionRecoverySnapshot | null> {
    const raw = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as ActiveSessionRecoverySnapshot;
      if (parsed.schema !== "repvelocoach.active-session-recovery.v1") {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  async clearActiveSession(): Promise<void> {
    await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
  }

  async saveLastExercise(exercise: Exercise): Promise<void> {
    const payload: LastSessionExerciseSnapshot = {
      saved_at: new Date().toISOString(),
      exercise_id: exercise.id,
      exercise_name: exercise.name,
    };
    await AsyncStorage.setItem(LAST_EXERCISE_KEY, JSON.stringify(payload));
  }

  async getLastExercise(): Promise<LastSessionExerciseSnapshot | null> {
    const raw = await AsyncStorage.getItem(LAST_EXERCISE_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as LastSessionExerciseSnapshot;
      return parsed.exercise_id && parsed.exercise_name ? parsed : null;
    } catch {
      return null;
    }
  }
}

export default new SessionRecoveryService();
