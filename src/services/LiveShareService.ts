import AsyncStorage from "@react-native-async-storage/async-storage";

import { loadAppSettings } from "./AppSettingsService";
import CodexDataExportService from "./CodexDataExportService";
import type { AppSettings } from "../types/index";
import {
  buildLiveShareEventsUrl,
  buildRepVeloCoachSyncUrl,
} from "../utils/LiveShareEndpoint";

export type LiveShareEventType =
  | "session_started"
  | "rep_recorded"
  | "set_completed"
  | "form_video_saved";

export type LiveShareEvent = {
  id: string;
  app: "RepVeloCoach";
  type: LiveShareEventType;
  created_at: string;
  payload: Record<string, unknown>;
};

const LIVE_SHARE_QUEUE_KEY = "@repvelo_live_share_queue_v1";
const SETTINGS_CACHE_TTL_MS = 3000;
const MAX_QUEUE_LENGTH = 100;
const REQUEST_TIMEOUT_MS = 2500;
const FULL_SYNC_TIMEOUT_MS = 10000;

export type RepVeloCoachSyncResult = {
  synced_at: string;
  counts: {
    sessions: number;
    sets: number;
    reps: number;
    exercises: number;
    lvp_profiles: number;
    form_videos: number;
  };
};

class LiveShareService {
  private settingsCache: AppSettings | null = null;
  private settingsLoadedAt = 0;
  private flushInFlight = false;
  private queueMutation: Promise<void> = Promise.resolve();

  private createId(type: LiveShareEventType): string {
    const randomPart =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return `live_${type}_${randomPart}`;
  }

  private async getSettings(): Promise<AppSettings> {
    const now = Date.now();
    if (
      this.settingsCache &&
      now - this.settingsLoadedAt < SETTINGS_CACHE_TTL_MS
    ) {
      return this.settingsCache;
    }

    const settings = await loadAppSettings();
    this.settingsCache = settings;
    this.settingsLoadedAt = now;
    return settings;
  }

  private normalizeEndpoint(rawUrl: string): string | null {
    return buildLiveShareEventsUrl(rawUrl);
  }

  private async readQueue(): Promise<LiveShareEvent[]> {
    const stored = await AsyncStorage.getItem(LIVE_SHARE_QUEUE_KEY);
    if (!stored) return [];
    try {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? (parsed as LiveShareEvent[]) : [];
    } catch {
      return [];
    }
  }

  private async writeQueue(events: LiveShareEvent[]): Promise<void> {
    await AsyncStorage.setItem(
      LIVE_SHARE_QUEUE_KEY,
      JSON.stringify(events.slice(-MAX_QUEUE_LENGTH)),
    );
  }

  private async enqueue(event: LiveShareEvent): Promise<void> {
    this.queueMutation = this.queueMutation
      .then(async () => {
        const queue = await this.readQueue();
        queue.push(event);
        await this.writeQueue(queue);
      })
      .catch((error) => {
        console.warn("[LiveShareService] Queue write failed:", error);
      });
    await this.queueMutation;
  }

  private async postEvent(
    endpoint: string,
    token: string,
    event: LiveShareEvent,
  ): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token.trim()
            ? { "X-RepVelo-Live-Token": token.trim() }
            : {}),
        },
        body: JSON.stringify(event),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Live Share HTTP ${response.status}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  async syncTrainingExport(): Promise<RepVeloCoachSyncResult | null> {
    const settings = await this.getSettings();
    if (!settings.enable_live_share) return null;

    const endpoint = buildRepVeloCoachSyncUrl(settings.live_share_url);
    if (!endpoint) {
      throw new Error("Mac / MCP同期URLが設定されていません。");
    }

    const payload = await CodexDataExportService.buildTrainingExport();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FULL_SYNC_TIMEOUT_MS);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(settings.live_share_token.trim()
            ? { "X-RepVelo-Sync-Token": settings.live_share_token.trim() }
            : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Mac / MCP同期 HTTP ${response.status}`);
      }

      const result = (await response.json()) as Partial<RepVeloCoachSyncResult>;
      return {
        synced_at:
          typeof result.synced_at === "string"
            ? result.synced_at
            : new Date().toISOString(),
        counts: payload.counts,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  async sendEvent(
    type: LiveShareEventType,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      const settings = await this.getSettings();
      if (!settings.enable_live_share) return;

      const endpoint = this.normalizeEndpoint(settings.live_share_url);
      if (!endpoint) return;

      const event: LiveShareEvent = {
        id: this.createId(type),
        app: "RepVeloCoach",
        type,
        created_at: new Date().toISOString(),
        payload,
      };

      await this.postEvent(endpoint, settings.live_share_token, event);
      void this.flushQueue();
    } catch (error) {
      console.warn("[LiveShareService] Event send failed; queued:", error);
      try {
        await this.enqueue({
          id: this.createId(type),
          app: "RepVeloCoach",
          type,
          created_at: new Date().toISOString(),
          payload,
        });
      } catch (queueError) {
        console.warn("[LiveShareService] Failed to queue event:", queueError);
      }
    }
  }

  async flushQueue(): Promise<void> {
    if (this.flushInFlight) return;
    this.flushInFlight = true;

    try {
      const settings = await this.getSettings();
      if (!settings.enable_live_share) return;

      const endpoint = this.normalizeEndpoint(settings.live_share_url);
      if (!endpoint) return;

      const token = settings.live_share_token;
      const queue = await this.readQueue();
      if (queue.length === 0) return;

      const remaining: LiveShareEvent[] = [];
      for (const event of queue) {
        try {
          await this.postEvent(endpoint, token, event);
        } catch {
          remaining.push(event);
        }
      }
      await this.writeQueue(remaining);
    } catch (error) {
      console.warn("[LiveShareService] Queue flush failed:", error);
    } finally {
      this.flushInFlight = false;
    }
  }
}

export default new LiveShareService();
