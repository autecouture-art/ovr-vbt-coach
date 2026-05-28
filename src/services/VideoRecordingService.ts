import DatabaseService from "./DatabaseService";
import * as FileSystem from "expo-file-system/legacy";
import type { FormVideoRecord } from "../types/index";

export type CreateFormVideoRecordInput = {
  session_id: string;
  lift: string;
  set_index?: number | null;
  load_kg?: number | null;
  local_uri: string;
  thumbnail_uri?: string | null;
  started_at: string;
  ended_at: string;
  notes?: string | null;
};

class VideoRecordingService {
  private createId(): string {
    const randomPart =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    return `form_video_${randomPart}`;
  }

  private calculateDurationSeconds(startedAt: string, endedAt: string): number {
    const startedMs = Date.parse(startedAt);
    const endedMs = Date.parse(endedAt);
    if (!Number.isFinite(startedMs) || !Number.isFinite(endedMs)) {
      return 0;
    }
    return Math.max(0, Math.round((endedMs - startedMs) / 1000));
  }

  private getExtension(uri: string): string {
    const match = uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    return match?.[1] ? `.${match[1]}` : ".mov";
  }

  private async persistVideoFile(sourceUri: string, id: string): Promise<string> {
    if (!FileSystem.documentDirectory || !sourceUri.startsWith("file://")) {
      return sourceUri;
    }

    const directory = `${FileSystem.documentDirectory}form-videos/`;
    const destination = `${directory}${id}${this.getExtension(sourceUri)}`;

    try {
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      await FileSystem.copyAsync({ from: sourceUri, to: destination });
      return destination;
    } catch (error) {
      console.warn("[VideoRecordingService] Failed to persist video file:", error);
      return sourceUri;
    }
  }

  async saveFormVideoRecord(
    input: CreateFormVideoRecordInput,
  ): Promise<FormVideoRecord> {
    const id = this.createId();
    const localUri = await this.persistVideoFile(input.local_uri, id);
    const record: FormVideoRecord = {
      id,
      session_id: input.session_id,
      lift: input.lift,
      set_index: input.set_index ?? null,
      load_kg: input.load_kg ?? null,
      local_uri: localUri,
      thumbnail_uri: input.thumbnail_uri ?? null,
      started_at: input.started_at,
      ended_at: input.ended_at,
      duration_s: this.calculateDurationSeconds(
        input.started_at,
        input.ended_at,
      ),
      created_at: new Date().toISOString(),
      notes: input.notes ?? null,
    };

    await DatabaseService.insertFormVideoRecord(record);
    return record;
  }

  getFormVideosForSet(
    sessionId: string,
    lift: string,
    setIndex: number,
  ): Promise<FormVideoRecord[]> {
    return DatabaseService.getFormVideosForSet(sessionId, lift, setIndex);
  }

  getFormVideosForSession(sessionId: string): Promise<FormVideoRecord[]> {
    return DatabaseService.getFormVideosForSession(sessionId);
  }

  deleteFormVideoRecord(id: string): Promise<void> {
    return DatabaseService.deleteFormVideoRecord(id);
  }
}

export default new VideoRecordingService();
