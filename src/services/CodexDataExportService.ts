import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import DatabaseService from "./DatabaseService";
import type {
  Exercise,
  FormVideoRecord,
  LVPData,
  RepData,
  SessionData,
  SetData,
} from "../types/index";

export const CODEX_TRAINING_EXPORT_SCHEMA = "repvelocoach.codex-training-export.v1";

export type CodexTrainingExport = {
  schema: typeof CODEX_TRAINING_EXPORT_SCHEMA;
  exported_at: string;
  app: {
    name: "RepVeloCoach";
    export_version: 1;
  };
  counts: {
    sessions: number;
    sets: number;
    reps: number;
    exercises: number;
    lvp_profiles: number;
    form_videos: number;
  };
  sessions: SessionData[];
  sets: SetData[];
  reps: RepData[];
  exercises: Exercise[];
  lvp_profiles: LVPData[];
  form_videos: FormVideoRecord[];
};

export type CodexTrainingExportFile = {
  fileName: string;
  uri: string;
  bytes: number;
  payload: CodexTrainingExport;
};

export type CodexTrainingExportShareResult = CodexTrainingExportFile & {
  shared: boolean;
};

function buildExportFileName(exportedAt: Date): string {
  const stamp = exportedAt
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  return `repvelocoach-codex-export-${stamp}.json`;
}

class CodexDataExportService {
  async buildTrainingExport(): Promise<CodexTrainingExport> {
    await DatabaseService.initialize();

    const sessions = await DatabaseService.getSessions();
    const sets: SetData[] = [];
    const reps: RepData[] = [];

    for (const session of sessions) {
      const sessionSets = await DatabaseService.getSetsForSession(session.session_id);
      const sessionReps = await DatabaseService.getRepsForSession(session.session_id);
      sets.push(...sessionSets);
      reps.push(...sessionReps);
    }

    const exercises = await DatabaseService.getExercises();
    const lvpProfiles = await DatabaseService.getAllLVPProfiles();
    const formVideos: FormVideoRecord[] = [];

    for (const session of sessions) {
      const videos = await DatabaseService.getFormVideosForSession(
        session.session_id,
      );
      formVideos.push(...videos);
    }

    return {
      schema: CODEX_TRAINING_EXPORT_SCHEMA,
      exported_at: new Date().toISOString(),
      app: {
        name: "RepVeloCoach",
        export_version: 1,
      },
      counts: {
        sessions: sessions.length,
        sets: sets.length,
        reps: reps.length,
        exercises: exercises.length,
        lvp_profiles: lvpProfiles.length,
        form_videos: formVideos.length,
      },
      sessions,
      sets,
      reps,
      exercises,
      lvp_profiles: lvpProfiles,
      form_videos: formVideos,
    };
  }

  async writeTrainingExportFile(): Promise<CodexTrainingExportFile> {
    if (!FileSystem.documentDirectory) {
      throw new Error("File system document directory is not available.");
    }

    const payload = await this.buildTrainingExport();
    const exportedAt = new Date(payload.exported_at);
    const fileName = buildExportFileName(exportedAt);
    const uri = `${FileSystem.documentDirectory}${fileName}`;
    const json = JSON.stringify(payload, null, 2);

    await FileSystem.writeAsStringAsync(uri, json, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    return {
      fileName,
      uri,
      bytes: json.length,
      payload,
    };
  }

  async shareTrainingExportFile(): Promise<CodexTrainingExportShareResult> {
    const file = await this.writeTrainingExportFile();
    const canShare = await Sharing.isAvailableAsync();

    if (canShare) {
      await Sharing.shareAsync(file.uri, {
        mimeType: "application/json",
        UTI: "public.json",
        dialogTitle: "RepVeloCoach Codex Export",
      });
    }

    return {
      ...file,
      shared: canShare,
    };
  }
}

export default new CodexDataExportService();
