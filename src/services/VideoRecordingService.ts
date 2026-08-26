import DatabaseService from "./DatabaseService";
import * as FileSystem from "expo-file-system/legacy";
import { trimFormVideoNative } from "@/src/native/FormVideoTrimModule";
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
  capture_id?: string | null;
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

  private async persistVideoFile(sourceUri: string, id: string): Promise<{
    uri: string;
    fileSizeBytes: number;
    fileHash: string | null;
  }> {
    if (!FileSystem.documentDirectory || !sourceUri.startsWith("file://")) {
      throw new Error("録画ファイルを永続保存できません。");
    }

    const directory = `${FileSystem.documentDirectory}form-videos/`;
    const destination = `${directory}${id}${this.getExtension(sourceUri)}`;
    const partial = `${destination}.partial`;

    try {
      await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
      const source = await FileSystem.getInfoAsync(sourceUri, { md5: true });
      if (!source.exists || !source.size || source.size <= 0) {
        throw new Error("録画ファイルが見つからないか、空です。");
      }
      await FileSystem.copyAsync({ from: sourceUri, to: partial });
      const copied = await FileSystem.getInfoAsync(partial, { md5: true });
      if (!copied.exists || !copied.size || copied.size <= 0) {
        throw new Error("録画ファイルのコピー確認に失敗しました。");
      }
      if (source.size !== copied.size || (source.md5 && copied.md5 && source.md5 !== copied.md5)) {
        throw new Error("録画ファイルの整合性確認に失敗しました。");
      }
      await FileSystem.moveAsync({ from: partial, to: destination });
      return {
        uri: destination,
        fileSizeBytes: copied.size,
        fileHash: copied.md5 ?? null,
      };
    } catch (error) {
      console.warn("[VideoRecordingService] Failed to persist video file:", error);
      await FileSystem.deleteAsync(partial, { idempotent: true }).catch(() => undefined);
      throw error;
    }
  }

  private addSeconds(iso: string, seconds: number): string {
    const timeMs = Date.parse(iso);
    if (!Number.isFinite(timeMs)) return iso;
    return new Date(timeMs + seconds * 1000).toISOString();
  }

  async saveFormVideoRecord(
    input: CreateFormVideoRecordInput,
  ): Promise<FormVideoRecord> {
    const id = this.createId();
    const persisted = await this.persistVideoFile(input.local_uri, id);
    const record: FormVideoRecord = {
      id,
      session_id: input.session_id,
      lift: input.lift,
      set_index: input.set_index ?? null,
      load_kg: input.load_kg ?? null,
      local_uri: persisted.uri,
      thumbnail_uri: input.thumbnail_uri ?? null,
      started_at: input.started_at,
      ended_at: input.ended_at,
      duration_s: this.calculateDurationSeconds(
        input.started_at,
        input.ended_at,
      ),
      created_at: new Date().toISOString(),
      notes: input.notes ?? null,
      capture_id: input.capture_id ?? null,
      integrity_status: "verified",
      file_size_bytes: persisted.fileSizeBytes,
      file_hash: persisted.fileHash,
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

  updateFormVideoNotes(id: string, notes: string | null): Promise<void> {
    return DatabaseService.updateFormVideoRecordNotes(id, notes);
  }

  async trimFormVideoRecord(
    source: FormVideoRecord,
    trimStartSeconds: number,
    trimEndSeconds: number,
  ): Promise<FormVideoRecord> {
    const trimStartS = Math.max(0, trimStartSeconds);
    const trimEndS = Math.max(0, trimEndSeconds);
    const result = await trimFormVideoNative(
      source.local_uri,
      trimStartS,
      trimEndS,
    );
    const startedAt = this.addSeconds(source.started_at, trimStartS);
    const endedAt = this.addSeconds(source.ended_at, -trimEndS);

    return this.saveFormVideoRecord({
      session_id: source.session_id,
      lift: source.lift,
      set_index: source.set_index,
      load_kg: source.load_kg,
      local_uri: result.uri,
      started_at: startedAt,
      ended_at: endedAt,
      notes: JSON.stringify({
        kind: "physical_trim",
        source_video_id: source.id,
        trim_start_s: Math.round(trimStartS * 10) / 10,
        trim_end_s: Math.round(trimEndS * 10) / 10,
        native_duration_s: result.durationS ?? null,
        trim_saved_at: new Date().toISOString(),
      }),
    });
  }
}

export default new VideoRecordingService();
