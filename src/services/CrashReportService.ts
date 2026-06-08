import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";

import type { AppSettings, RepVeloData, SetData } from "@/src/types/index";

const VBT_SCREEN_CONTEXT_KEY = "@repvelocoach_vbt_screen_crash_context_v1";
const DRIVE_UPLOAD_QUEUE_KEY =
  "@repvelocoach_drive_crash_report_upload_queue_v1";
const DRIVE_UPLOADED_IDS_KEY =
  "@repvelocoach_drive_crash_report_uploaded_ids_v1";
const VBT_CONTEXT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const DRIVE_QUEUE_LIMIT = 8;
const DRIVE_UPLOADED_ID_LIMIT = 50;

export type VBTScreenCrashContext = {
  schema: "repvelocoach.vbt-screen-crash-context.v1";
  saved_at: string;
  reason:
    | "session_tab_open_attempt"
    | "session_screen_mount_attempt"
    | "session_screen_import_loaded"
    | "session_screen_render_entered"
    | "session_logic_setup_start"
    | "session_logic_ble_callbacks_set"
    | "session_logic_ble_status_checked"
    | "vbt_session_screen_active"
    | "form_video_overlay_open_attempt";
  entry_point?: "bottom_tab" | "home_card" | "unknown";
  session_id: string | null;
  is_session_active: boolean;
  is_paused: boolean;
  pause_reason: string | null;
  is_connected: boolean;
  sensor_input_muted: boolean;
  current_lift: string | null;
  current_exercise_name: string | null;
  current_load: number;
  current_reps: number;
  current_set_index: number;
  completed_set_count: number;
  current_rep_count: number;
  current_heart_rate: number | null;
  live_data: Partial<RepVeloData> | null;
  latest_completed_set: Partial<SetData> | null;
  settings_snapshot: {
    lightweight_mode: boolean;
    session_history: boolean;
    velocity_chart: boolean;
    recent_history: boolean;
    same_load_history: boolean;
    form_video: boolean;
  };
};

export type SaveVBTScreenCrashContextInput = Omit<
  VBTScreenCrashContext,
  "schema" | "saved_at" | "reason"
> & {
  reason?: VBTScreenCrashContext["reason"];
};

export type SaveVBTSessionOpenAttemptInput = {
  entry_point?: VBTScreenCrashContext["entry_point"];
  is_connected?: boolean | null;
  current_lift?: string | null;
  current_exercise_name?: string | null;
  current_load?: number | null;
  current_reps?: number | null;
};

export type DriveCrashReportUploadEntry = {
  id: string;
  queued_at: string;
  attempts: number;
  last_error?: string;
  markdown: string;
  snapshot: VBTScreenCrashContext;
};

export type DriveCrashReportUploadResult = {
  status:
    | "disabled"
    | "missing_url"
    | "already_uploaded"
    | "queued"
    | "uploaded"
    | "partial";
  attempted: number;
  uploaded: number;
  failed: number;
  queued: number;
  last_error?: string;
};

const safeNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const compactLiveData = (
  liveData: RepVeloData | null | undefined,
): Partial<RepVeloData> | null => {
  if (!liveData) return null;
  return {
    mean_velocity: safeNumber(liveData.mean_velocity) ?? undefined,
    peak_velocity: safeNumber(liveData.peak_velocity) ?? undefined,
    rom_cm: safeNumber(liveData.rom_cm) ?? undefined,
    mean_power_w: safeNumber(liveData.mean_power_w) ?? undefined,
    peak_power_w: safeNumber(liveData.peak_power_w) ?? undefined,
    rep_duration_ms: safeNumber(liveData.rep_duration_ms) ?? undefined,
    timestamp: safeNumber(liveData.timestamp) ?? undefined,
  };
};

const compactSet = (
  setData: SetData | null | undefined,
): Partial<SetData> | null => {
  if (!setData) return null;
  return {
    session_id: setData.session_id,
    lift: setData.lift,
    set_index: setData.set_index,
    load_kg: setData.load_kg,
    reps: setData.reps,
    avg_velocity: setData.avg_velocity,
    velocity_loss: setData.velocity_loss,
    velocity_loss_avg: setData.velocity_loss_avg,
    velocity_loss_last: setData.velocity_loss_last,
    velocity_loss_min: setData.velocity_loss_min,
    avg_power_w: setData.avg_power_w,
    start_timestamp: setData.start_timestamp,
    end_timestamp: setData.end_timestamp,
    timestamp: setData.timestamp,
  };
};

function formatValue(value: unknown): string {
  if (value == null) return "-";
  if (typeof value === "number") return Number.isFinite(value) ? `${value}` : "invalid";
  return `${value}`;
}

function buildFileName(date: Date): string {
  const stamp = date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  return `repvelocoach-vbt-crash-report-${stamp}.md`;
}

function buildDriveReportId(snapshot: VBTScreenCrashContext): string {
  return [
    snapshot.saved_at,
    snapshot.reason,
    snapshot.session_id ?? "no-session",
  ]
    .join("_")
    .replace(/[^a-zA-Z0-9_-]+/g, "_");
}

function settingsAllowDriveUpload(settings: AppSettings): boolean {
  return Boolean(settings.enable_google_drive_crash_report_upload);
}

function getDriveEndpoint(settings: AppSettings): string {
  return settings.google_drive_crash_report_url.trim();
}

function getDriveToken(settings: AppSettings): string {
  return settings.google_drive_crash_report_token.trim();
}

async function readJsonArray<T>(key: string): Promise<T[]> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function writeUploadedIds(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(
    DRIVE_UPLOADED_IDS_KEY,
    JSON.stringify(ids.slice(0, DRIVE_UPLOADED_ID_LIMIT)),
  );
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

class CrashReportService {
  async saveVBTSessionOpenAttempt(
    input: SaveVBTSessionOpenAttemptInput = {},
  ): Promise<void> {
    const payload: VBTScreenCrashContext = {
      schema: "repvelocoach.vbt-screen-crash-context.v1",
      saved_at: new Date().toISOString(),
      reason: "session_tab_open_attempt",
      entry_point: input.entry_point ?? "unknown",
      session_id: null,
      is_session_active: false,
      is_paused: false,
      pause_reason: null,
      is_connected: Boolean(input.is_connected),
      sensor_input_muted: false,
      current_lift: input.current_lift ?? null,
      current_exercise_name: input.current_exercise_name ?? null,
      current_load:
        typeof input.current_load === "number" && Number.isFinite(input.current_load)
          ? input.current_load
          : 0,
      current_reps:
        typeof input.current_reps === "number" && Number.isFinite(input.current_reps)
          ? input.current_reps
          : 0,
      current_set_index: 0,
      completed_set_count: 0,
      current_rep_count: 0,
      current_heart_rate: null,
      live_data: null,
      latest_completed_set: null,
      settings_snapshot: {
        lightweight_mode: false,
        session_history: false,
        velocity_chart: false,
        recent_history: false,
        same_load_history: false,
        form_video: false,
      },
    };
    await AsyncStorage.setItem(VBT_SCREEN_CONTEXT_KEY, JSON.stringify(payload));
  }

  async saveVBTSessionMountAttempt(
    input: SaveVBTSessionOpenAttemptInput = {},
  ): Promise<void> {
    await this.saveVBTSessionStageAttempt("session_screen_mount_attempt", input);
  }

  async saveVBTSessionStageAttempt(
    reason: VBTScreenCrashContext["reason"],
    input: SaveVBTSessionOpenAttemptInput = {},
  ): Promise<void> {
    const payload: VBTScreenCrashContext = {
      schema: "repvelocoach.vbt-screen-crash-context.v1",
      saved_at: new Date().toISOString(),
      reason,
      entry_point: input.entry_point ?? "unknown",
      session_id: null,
      is_session_active: false,
      is_paused: false,
      pause_reason: null,
      is_connected: Boolean(input.is_connected),
      sensor_input_muted: false,
      current_lift: input.current_lift ?? null,
      current_exercise_name: input.current_exercise_name ?? null,
      current_load:
        typeof input.current_load === "number" && Number.isFinite(input.current_load)
          ? input.current_load
          : 0,
      current_reps:
        typeof input.current_reps === "number" && Number.isFinite(input.current_reps)
          ? input.current_reps
          : 0,
      current_set_index: 0,
      completed_set_count: 0,
      current_rep_count: 0,
      current_heart_rate: null,
      live_data: null,
      latest_completed_set: null,
      settings_snapshot: {
        lightweight_mode: false,
        session_history: false,
        velocity_chart: false,
        recent_history: false,
        same_load_history: false,
        form_video: false,
      },
    };
    await AsyncStorage.setItem(VBT_SCREEN_CONTEXT_KEY, JSON.stringify(payload));
  }

  async saveVBTScreenContext(
    input: SaveVBTScreenCrashContextInput,
  ): Promise<void> {
    const payload: VBTScreenCrashContext = {
      schema: "repvelocoach.vbt-screen-crash-context.v1",
      saved_at: new Date().toISOString(),
      entry_point: input.entry_point,
      ...input,
      reason: input.reason ?? "vbt_session_screen_active",
      live_data: compactLiveData(input.live_data as RepVeloData | null),
      latest_completed_set: compactSet(input.latest_completed_set as SetData | null),
    };
    await AsyncStorage.setItem(VBT_SCREEN_CONTEXT_KEY, JSON.stringify(payload));
  }

  async getLastVBTScreenContext(): Promise<VBTScreenCrashContext | null> {
    const raw = await AsyncStorage.getItem(VBT_SCREEN_CONTEXT_KEY);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw) as VBTScreenCrashContext;
      if (parsed.schema !== "repvelocoach.vbt-screen-crash-context.v1") {
        return null;
      }

      const savedAt = new Date(parsed.saved_at).getTime();
      if (!Number.isFinite(savedAt) || Date.now() - savedAt > VBT_CONTEXT_MAX_AGE_MS) {
        await this.clearVBTScreenContext();
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  async clearVBTScreenContext(): Promise<void> {
    await AsyncStorage.removeItem(VBT_SCREEN_CONTEXT_KEY);
  }

  buildVBTCrashMarkdown(
    snapshot: VBTScreenCrashContext,
    currentDiagnosticMarkdown?: string,
  ): string {
    const liveData = snapshot.live_data;
    const latestSet = snapshot.latest_completed_set;

    return [
      "# RepVeloCoach VBT接続クラッシュ状況報告",
      "",
      "このままCodexへ貼る、またはGmailで共有してください。VBT接続後またはセッションモード入室時にクラッシュした可能性がある再起動後レポートです。",
      "",
      "## 前回クラッシュ疑いスナップショット",
      `- 保存時刻: ${snapshot.saved_at}`,
      `- reason: ${snapshot.reason}`,
      `- entry_point: ${snapshot.entry_point ?? "-"}`,
      `- session_id: ${snapshot.session_id ?? "-"}`,
      `- セッションActive: ${snapshot.is_session_active ? "yes" : "no"}`,
      `- Pause状態: ${snapshot.is_paused ? `yes (${snapshot.pause_reason ?? "-"})` : "no"}`,
      `- VBT接続: ${snapshot.is_connected ? "yes" : "no"}`,
      `- センサー入力: ${snapshot.sensor_input_muted ? "OFF" : "ON"}`,
      `- 現在種目: ${snapshot.current_lift ?? snapshot.current_exercise_name ?? "-"}`,
      `- 現在重量: ${snapshot.current_load} kg`,
      `- 予定reps: ${snapshot.current_reps}`,
      `- 現在セット番号: ${snapshot.current_set_index}`,
      `- 完了セット数: ${snapshot.completed_set_count}`,
      `- 現在セットrep数: ${snapshot.current_rep_count}`,
      `- 現在心拍: ${snapshot.current_heart_rate ?? "-"} bpm`,
      "",
      "## 直前Live VBTデータ",
      `- mean_velocity: ${formatValue(liveData?.mean_velocity)}`,
      `- peak_velocity: ${formatValue(liveData?.peak_velocity)}`,
      `- ROM: ${formatValue(liveData?.rom_cm)} cm`,
      `- mean_power: ${formatValue(liveData?.mean_power_w)} W`,
      `- peak_power: ${formatValue(liveData?.peak_power_w)} W`,
      `- rep_duration_ms: ${formatValue(liveData?.rep_duration_ms)}`,
      `- timestamp: ${formatValue(liveData?.timestamp)}`,
      "",
      "## 直近完了セット",
      `- session_id: ${latestSet?.session_id ?? "-"}`,
      `- lift: ${latestSet?.lift ?? "-"}`,
      `- set_index: ${formatValue(latestSet?.set_index)}`,
      `- load_kg: ${formatValue(latestSet?.load_kg)}`,
      `- reps: ${formatValue(latestSet?.reps)}`,
      `- avg_velocity: ${formatValue(latestSet?.avg_velocity)}`,
      `- VL avg/last/min: ${formatValue(latestSet?.velocity_loss_avg ?? latestSet?.velocity_loss)} / ${formatValue(latestSet?.velocity_loss_last ?? latestSet?.velocity_loss)} / ${formatValue(latestSet?.velocity_loss_min ?? latestSet?.velocity_loss)}%`,
      `- avg_power_w: ${formatValue(latestSet?.avg_power_w)}`,
      `- start: ${latestSet?.start_timestamp ?? "-"}`,
      `- end: ${latestSet?.end_timestamp ?? latestSet?.timestamp ?? "-"}`,
      "",
      "## 表示/設定状態",
      `- 軽量モード: ${snapshot.settings_snapshot.lightweight_mode ? "ON" : "OFF"}`,
      `- セッション履歴: ${snapshot.settings_snapshot.session_history ? "ON" : "OFF"}`,
      `- 速度チャート: ${snapshot.settings_snapshot.velocity_chart ? "ON" : "OFF"}`,
      `- 直近履歴: ${snapshot.settings_snapshot.recent_history ? "ON" : "OFF"}`,
      `- 同重量履歴: ${snapshot.settings_snapshot.same_load_history ? "ON" : "OFF"}`,
      `- フォーム動画: ${snapshot.settings_snapshot.form_video ? "ON" : "OFF"}`,
      "",
      "## Codexに見てほしい観点",
      "- VBT接続直後、Session画面へ入った時点でnative BLE側またはJS側の例外が出ていないか。",
      "- live_dataにNaN/undefined/極端値が残っていないか。",
      "- フォーム動画ON時にBLE/カメラ/音声の組み合わせで落ちていないか。",
      "- セッション復旧スナップショット、DBセット数、storeセット数にズレがないか。",
      currentDiagnosticMarkdown
        ? ["", "## 再起動後の現在診断", currentDiagnosticMarkdown].join("\n")
        : "",
    ]
      .filter(Boolean)
      .join("\n");
  }

  async writeVBTCrashReportFile(markdown: string): Promise<{
    fileName: string;
    uri: string;
    bytes: number;
  }> {
    if (!FileSystem.documentDirectory) {
      throw new Error("File system document directory is not available.");
    }

    const fileName = buildFileName(new Date());
    const uri = `${FileSystem.documentDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(uri, markdown, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return {
      fileName,
      uri,
      bytes: markdown.length,
    };
  }

  async getDriveCrashReportQueue(): Promise<DriveCrashReportUploadEntry[]> {
    return readJsonArray<DriveCrashReportUploadEntry>(DRIVE_UPLOAD_QUEUE_KEY);
  }

  async clearDriveCrashReportQueue(): Promise<void> {
    await AsyncStorage.removeItem(DRIVE_UPLOAD_QUEUE_KEY);
  }

  async submitLastVBTScreenContextToGoogleDrive(
    settings: AppSettings,
    currentDiagnosticMarkdown?: string,
    options: { force?: boolean } = {},
  ): Promise<DriveCrashReportUploadResult> {
    if (!settingsAllowDriveUpload(settings)) {
      return {
        status: "disabled",
        attempted: 0,
        uploaded: 0,
        failed: 0,
        queued: (await this.getDriveCrashReportQueue()).length,
      };
    }

    if (!getDriveEndpoint(settings)) {
      return {
        status: "missing_url",
        attempted: 0,
        uploaded: 0,
        failed: 0,
        queued: (await this.getDriveCrashReportQueue()).length,
      };
    }

    const snapshot = await this.getLastVBTScreenContext();
    if (snapshot) {
      const markdown = this.buildVBTCrashMarkdown(
        snapshot,
        currentDiagnosticMarkdown,
      );
      await this.enqueueDriveCrashReport(snapshot, markdown, options);
    }

    return this.flushGoogleDriveCrashReportQueue(settings);
  }

  async flushGoogleDriveCrashReportQueue(
    settings: AppSettings,
  ): Promise<DriveCrashReportUploadResult> {
    if (!settingsAllowDriveUpload(settings)) {
      return {
        status: "disabled",
        attempted: 0,
        uploaded: 0,
        failed: 0,
        queued: (await this.getDriveCrashReportQueue()).length,
      };
    }

    const endpoint = getDriveEndpoint(settings);
    if (!endpoint) {
      return {
        status: "missing_url",
        attempted: 0,
        uploaded: 0,
        failed: 0,
        queued: (await this.getDriveCrashReportQueue()).length,
      };
    }

    const queue = await this.getDriveCrashReportQueue();
    const uploadedIds = await readJsonArray<string>(DRIVE_UPLOADED_IDS_KEY);
    const uploadedIdSet = new Set(uploadedIds);
    const remaining: DriveCrashReportUploadEntry[] = [];
    let uploaded = 0;
    let failed = 0;
    let lastError: string | undefined;

    for (const entry of queue) {
      if (uploadedIdSet.has(entry.id)) {
        continue;
      }

      try {
        await this.uploadDriveCrashReportEntry(endpoint, getDriveToken(settings), entry);
        uploaded += 1;
        uploadedIdSet.add(entry.id);
      } catch (error) {
        failed += 1;
        lastError = toErrorMessage(error);
        remaining.push({
          ...entry,
          attempts: entry.attempts + 1,
          last_error: lastError,
        });
      }
    }

    await AsyncStorage.setItem(
      DRIVE_UPLOAD_QUEUE_KEY,
      JSON.stringify(remaining.slice(-DRIVE_QUEUE_LIMIT)),
    );
    await writeUploadedIds(Array.from(uploadedIdSet).reverse());

    const status =
      failed > 0 && uploaded > 0
        ? "partial"
        : failed > 0
          ? "queued"
          : uploaded > 0
            ? "uploaded"
            : "already_uploaded";

    return {
      status,
      attempted: queue.length,
      uploaded,
      failed,
      queued: remaining.length,
      last_error: lastError,
    };
  }

  private async enqueueDriveCrashReport(
    snapshot: VBTScreenCrashContext,
    markdown: string,
    options: { force?: boolean },
  ): Promise<void> {
    const id = buildDriveReportId(snapshot);
    const uploadedIds = await readJsonArray<string>(DRIVE_UPLOADED_IDS_KEY);
    if (!options.force && uploadedIds.includes(id)) {
      return;
    }

    const queue = await this.getDriveCrashReportQueue();
    const nextEntry: DriveCrashReportUploadEntry = {
      id,
      queued_at: new Date().toISOString(),
      attempts: 0,
      markdown,
      snapshot,
    };
    const withoutDuplicate = queue.filter((entry) => entry.id !== id);
    await AsyncStorage.setItem(
      DRIVE_UPLOAD_QUEUE_KEY,
      JSON.stringify([...withoutDuplicate, nextEntry].slice(-DRIVE_QUEUE_LIMIT)),
    );
  }

  private async uploadDriveCrashReportEntry(
    endpoint: string,
    token: string,
    entry: DriveCrashReportUploadEntry,
  ): Promise<void> {
    const fileBaseName = buildFileName(new Date(entry.snapshot.saved_at)).replace(
      /\.md$/,
      "",
    );
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        schema: "repvelocoach.google-drive-crash-report.v1",
        token: token || undefined,
        report_id: entry.id,
        queued_at: entry.queued_at,
        uploaded_at: new Date().toISOString(),
        file_base_name: fileBaseName,
        markdown: entry.markdown,
        snapshot: entry.snapshot,
      }),
    });

    const responseText = await response.text();
    if (!response.ok) {
      throw new Error(
        `Google Drive upload failed: HTTP ${response.status} ${responseText.slice(
          0,
          160,
        )}`,
      );
    }

    if (responseText) {
      try {
        const parsed = JSON.parse(responseText) as { ok?: boolean; error?: string };
        if (parsed.ok === false) {
          throw new Error(parsed.error ?? "Google Drive upload rejected.");
        }
      } catch (error) {
        if (error instanceof SyntaxError) {
          return;
        }
        throw error;
      }
    }
  }
}

export default new CrashReportService();
