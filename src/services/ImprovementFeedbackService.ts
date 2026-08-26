import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

import { loadAppSettings } from "./AppSettingsService";
import {
  buildRepVeloCoachFeedbackBatchesUrl,
  buildRepVeloCoachCrashHandoffsUrl,
  buildRepVeloCoachIssueReceiptsUrl,
  buildRepVeloCoachIssuesUrl,
} from "../utils/LiveShareEndpoint";
import type {
  ImprovementFeedback,
  ImprovementFeedbackCategory,
  ImprovementIssueReceipt,
  QueuedImprovementFeedback,
} from "../types/index";

const QUEUE_KEY = "@repvelo_improvement_feedback_queue_v1";
const RECEIPTS_KEY = "@repvelo_improvement_feedback_receipts_v1";
const MAX_QUEUE_LENGTH = 100;
const MAX_NOTE_LENGTH = 500;
const REQUEST_TIMEOUT_MS = 4000;

type SessionContext = NonNullable<ImprovementFeedback["session_context"]>;

function createId(): string {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `feedback_${randomPart}`;
}

function appVersion(): string {
  const config = Constants.expoConfig;
  const version = config?.version ?? "unknown";
  const build =
    config?.ios?.buildNumber ??
    Constants.nativeBuildVersion ??
    "unknown";
  return `${version} (${build})`;
}

function sanitizeNote(note: string): string {
  return note.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, MAX_NOTE_LENGTH);
}

class ImprovementFeedbackService {
  private syncInFlight = false;

  async listQueued(): Promise<QueuedImprovementFeedback[]> {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as QueuedImprovementFeedback[]) : [];
    } catch {
      return [];
    }
  }

  async listReceipts(): Promise<ImprovementIssueReceipt[]> {
    const raw = await AsyncStorage.getItem(RECEIPTS_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as ImprovementIssueReceipt[]) : [];
    } catch {
      return [];
    }
  }

  private async saveQueue(queue: QueuedImprovementFeedback[]): Promise<void> {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE_LENGTH)));
  }

  async queueFeedback(input: {
    category: ImprovementFeedbackCategory;
    note: string;
    screen: ImprovementFeedback["screen"];
    sessionId?: string | null;
    sessionContext?: SessionContext;
  }): Promise<QueuedImprovementFeedback> {
    const note = sanitizeNote(input.note);
    if (!note) throw new Error("気づきを入力してください。");

    const feedback: QueuedImprovementFeedback = {
      schema: "repvelocoach.improvement-feedback.v1",
      id: createId(),
      created_at: new Date().toISOString(),
      category: input.category,
      note,
      screen: input.screen,
      app_version: appVersion(),
      session_context: input.sessionContext,
      session_id: input.sessionId ?? null,
      consent_to_send: true,
      status: "queued",
      sent_at: null,
    };
    const queue = await this.listQueued();
    queue.push(feedback);
    await this.saveQueue(queue);
    return feedback;
  }

  private async post(url: string, token: string, body: unknown): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      return await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token.trim() ? { "X-RepVelo-Sync-Token": token.trim() } : {}),
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async flushAtSessionEnd(sessionId?: string | null): Promise<number> {
    if (this.syncInFlight) return 0;
    this.syncInFlight = true;
    try {
      const settings = await loadAppSettings();
      if (!settings.enable_improvement_feedback_sync) return 0;
      const issueUrl = buildRepVeloCoachIssuesUrl(settings.live_share_url);
      const batchUrl = buildRepVeloCoachFeedbackBatchesUrl(settings.live_share_url);
      if (!issueUrl || !batchUrl) return 0;

      const queue = await this.listQueued();
      const pending = queue.filter((item) => item.status === "queued");
      if (pending.length === 0) return 0;

      const deliveredIds = new Set<string>();
      for (const item of pending) {
        try {
          const response = await this.post(issueUrl, settings.live_share_token, {
            schema: "repvelocoach.improvement-issue.v1",
            id: item.id,
            fingerprint: `${item.category}:${item.note.toLowerCase().replace(/[^a-z0-9]+/gi, "-").slice(0, 80) || item.id}`,
            created_at: item.created_at,
            kind: "improvement",
            title: `RepVeloCoach ${item.category}`,
            summary: item.note,
            priority: item.category === "bug" ? "high" : "normal",
            session_id: item.session_id ?? null,
            review_package: null,
          });
          if (!response.ok) continue;
          deliveredIds.add(item.id);
        } catch {
          // Offline or an unavailable Mac is expected: preserve the local queue.
        }
      }

      if (deliveredIds.size > 0) {
        await this.saveQueue(
          queue.map((item) =>
            deliveredIds.has(item.id)
              ? { ...item, status: "sent" as const, sent_at: new Date().toISOString() }
              : item,
          ),
        );
        try {
          if (sessionId) {
            await this.post(batchUrl, settings.live_share_token, {
              schema: "repvelocoach.session-feedback-batch.v1",
              id: `feedback_batch_${Date.now()}`,
              created_at: new Date().toISOString(),
              session_id: sessionId,
              feedback: queue
                .filter((item) => deliveredIds.has(item.id))
                .map((item) => ({
                  id: item.id,
                  created_at: item.created_at,
                  kind: "improvement",
                  message: item.note,
                  rating: null,
                })),
            });
          }
        } catch {
          // Receipts can still be fetched later; batch delivery never blocks training.
        }
      }
      return deliveredIds.size;
    } finally {
      this.syncInFlight = false;
    }
  }

  async refreshReceipts(): Promise<ImprovementIssueReceipt[]> {
    const settings = await loadAppSettings();
    if (!settings.enable_improvement_feedback_sync) return this.listReceipts();
    const url = buildRepVeloCoachIssueReceiptsUrl(settings.live_share_url);
    if (!url) return this.listReceipts();
    const known = await this.listReceipts();
    const after = encodeURIComponent(known.at(-1)?.updated_at ?? "");
    const response = await fetch(`${url}?after=${after}`, {
      headers: settings.live_share_token.trim()
        ? { "X-RepVelo-Sync-Token": settings.live_share_token.trim() }
        : undefined,
    });
    if (!response.ok) return known;
    const payload = (await response.json()) as {
      receipts?: {
        intake_id?: string;
        status?: "accepted" | "duplicate";
        received_at?: string;
      }[];
    };
    const merged = new Map(known.map((receipt) => [receipt.feedback_id, receipt]));
    for (const receipt of payload.receipts ?? []) {
      if (!receipt.intake_id || !receipt.received_at) continue;
      merged.set(receipt.intake_id, {
        feedback_id: receipt.intake_id,
        issue_id: receipt.intake_id,
        state: "received",
        updated_at: receipt.received_at,
        note: receipt.status === "duplicate" ? "既存の報告へ統合しました。" : "監督Inboxで受信しました。",
      });
    }
    const next = [...merged.values()].sort((a, b) => a.updated_at.localeCompare(b.updated_at));
    await AsyncStorage.setItem(RECEIPTS_KEY, JSON.stringify(next.slice(-MAX_QUEUE_LENGTH)));
    return next;
  }

  async sendCrashHandoff(input: {
    saved_at: string;
    reason: string;
    session_id: string | null;
    is_connected: boolean;
    sensor_input_muted: boolean;
    current_lift: string | null;
    current_set_index: number;
    completed_set_count: number;
  }): Promise<boolean> {
    const settings = await loadAppSettings();
    if (!settings.enable_improvement_feedback_sync) return false;
    const url = buildRepVeloCoachCrashHandoffsUrl(settings.live_share_url);
    if (!url) return false;
    const fingerprint = `${input.reason}:${input.session_id ?? "none"}:${input.current_lift ?? "none"}`.replace(/[^a-zA-Z0-9._:-]+/g, "-");
    try {
      const response = await this.post(url, settings.live_share_token, {
        schema: "repvelocoach.crash-handoff.v1",
        id: `crash_${input.saved_at.replace(/[^0-9]/g, "")}`,
        fingerprint,
        created_at: new Date().toISOString(),
        event: input.reason.includes("form_video") ? "form_video" : input.reason.includes("session") ? "vbt_session" : "app_launch",
        summary: `再起動後に未完了の診断スナップショットを検出: ${input.reason}`,
        session_id: input.session_id,
        context: {
          is_connected: input.is_connected,
          sensor_input_muted: input.sensor_input_muted,
          current_lift: input.current_lift,
          current_set_index: input.current_set_index,
          completed_set_count: input.completed_set_count,
          last_reason: input.reason,
        },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export default new ImprovementFeedbackService();
