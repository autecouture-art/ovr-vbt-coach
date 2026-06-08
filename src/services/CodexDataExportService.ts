import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import DatabaseService from "./DatabaseService";
import type {
  Exercise,
  FormVideoRecord,
  LVPData,
  RepData,
  SessionData,
  SessionReadinessData,
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

const SESSION_READINESS_NOTE_PREFIX = "#SESSION_READINESS_JSON:";

function buildExportFileName(exportedAt: Date): string {
  const stamp = exportedAt
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  return `repvelocoach-codex-export-${stamp}.json`;
}

function parseSessionReadinessFromNotes(
  notes?: string | null,
): SessionReadinessData | null {
  if (!notes) return null;

  const markerLine = notes
    .split("\n")
    .find((line) => line.trim().startsWith(SESSION_READINESS_NOTE_PREFIX));
  if (!markerLine) return null;

  const json = markerLine
    .trim()
    .slice(SESSION_READINESS_NOTE_PREFIX.length)
    .trim();
  if (!json) return null;

  try {
    const parsed = JSON.parse(json) as SessionReadinessData;
    return {
      dieting:
        typeof parsed.dieting === "boolean" ? parsed.dieting : null,
      sleep_quality:
        parsed.sleep_quality === "good" ||
        parsed.sleep_quality === "ok" ||
        parsed.sleep_quality === "bad"
          ? parsed.sleep_quality
          : null,
      pain_area:
        typeof parsed.pain_area === "string" && parsed.pain_area.trim()
          ? parsed.pain_area
          : null,
      pain_score:
        typeof parsed.pain_score === "number" &&
        Number.isFinite(parsed.pain_score)
          ? parsed.pain_score
          : null,
      week_day:
        typeof parsed.week_day === "string" && parsed.week_day.trim()
          ? parsed.week_day
          : null,
      main_lift:
        parsed.main_lift === "SQ" ||
        parsed.main_lift === "BP" ||
        parsed.main_lift === "DL"
          ? parsed.main_lift
          : null,
      day_role:
        typeof parsed.day_role === "string" && parsed.day_role.trim()
          ? parsed.day_role
          : null,
      captured_at:
        typeof parsed.captured_at === "string" ? parsed.captured_at : undefined,
    };
  } catch {
    return null;
  }
}

class CodexDataExportService {
  async buildTrainingExport(): Promise<CodexTrainingExport> {
    await DatabaseService.initialize();

    const sessions = await DatabaseService.getSessions();
    const correctedSessions: SessionData[] = [];
    const sets: SetData[] = [];
    const reps: RepData[] = [];

    for (const session of sessions) {
      const sessionSets = await DatabaseService.getSetsForSession(session.session_id);
      const sessionReps = await DatabaseService.getRepsForSession(session.session_id);
      sets.push(...sessionSets);
      reps.push(...sessionReps);
      correctedSessions.push({
        ...session,
        total_sets: sessionSets.length,
        total_volume: sessionSets.reduce(
          (sum, set) => sum + (set.load_kg || 0) * (set.reps || 0),
          0,
        ),
        readiness: parseSessionReadinessFromNotes(session.notes),
      });
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
        sessions: correctedSessions.length,
        sets: sets.length,
        reps: reps.length,
        exercises: exercises.length,
        lvp_profiles: lvpProfiles.length,
        form_videos: formVideos.length,
      },
      sessions: correctedSessions,
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
