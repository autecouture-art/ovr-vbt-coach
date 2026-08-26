import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

import DatabaseService from "./DatabaseService";
import SupervisorProgramPlanService from "./SupervisorProgramPlanService";
import type {
  Exercise,
  FormVideoRecord,
  LVPData,
  RepData,
  SessionData,
  SessionReadinessData,
  SetData,
} from "../types/index";
import {
  buildSupervisorPlanMetadataFromProgramPlan,
  buildTrainingDayAggregates,
  extractAiConsultationsFromSessions,
  type AiConsultationExport,
  type SupervisorPlanMetadata,
  type TrainingDayAggregate,
} from "../utils/SupervisorPlanGuards";
import type { SupervisorProgramPlanV8 } from "../utils/SupervisorProgramPlan";
import { assessSessionDataCompleteness, type SessionDataCompleteness } from "../utils/SessionDataCompleteness";

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
    training_days: number;
    ai_consultations: number;
  };
  supervisor_plan: SupervisorPlanMetadata & {
    latest_guard_status: "applied" | "stale_or_missing";
  };
  supervisor_program_plan: {
    applied: Pick<
      SupervisorProgramPlanV8,
      | "schema"
      | "plan_id"
      | "version"
      | "updated_at"
      | "effective_from"
      | "valid_until"
      | "checksum"
    > | null;
    is_stale: boolean;
    stale_reason: string | null;
    executable: boolean;
    rows: SupervisorProgramPlanV8["rows"];
  };
  sessions: SessionData[];
  sets: SetData[];
  reps: RepData[];
  exercises: Exercise[];
  lvp_profiles: LVPData[];
  form_videos: FormVideoRecord[];
  training_days: TrainingDayAggregate[];
  ai_consultations: AiConsultationExport[];
  data_completeness: { session_id: string; assessment: SessionDataCompleteness }[];
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
      pain_reviewed: parsed.pain_reviewed === true,
      pain_reviewed_at:
        typeof parsed.pain_reviewed_at === "string"
          ? parsed.pain_reviewed_at
          : null,
      recovery_status:
        parsed.recovery_status === "recovered" ||
        parsed.recovery_status === "partial" ||
        parsed.recovery_status === "not_recovered"
          ? parsed.recovery_status
          : null,
      recovery_muscles: Array.isArray(parsed.recovery_muscles)
        ? parsed.recovery_muscles.filter(
            (muscle): muscle is string =>
              typeof muscle === "string" && muscle.trim().length > 0,
          )
        : [],
      recovery_soreness_score:
        typeof parsed.recovery_soreness_score === "number" &&
        Number.isFinite(parsed.recovery_soreness_score)
          ? Math.max(0, Math.min(10, parsed.recovery_soreness_score))
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
      supervisor_plan_version:
        typeof parsed.supervisor_plan_version === "string"
          ? parsed.supervisor_plan_version
          : undefined,
      supervisor_plan_updated_at:
        typeof parsed.supervisor_plan_updated_at === "string"
          ? parsed.supervisor_plan_updated_at
          : undefined,
      supervisor_plan_source:
        typeof parsed.supervisor_plan_source === "string"
          ? parsed.supervisor_plan_source
          : undefined,
      supervisor_plan_checksum:
        typeof parsed.supervisor_plan_checksum === "string"
          ? parsed.supervisor_plan_checksum
          : null,
      planned_row_id:
        typeof parsed.planned_row_id === "string" ? parsed.planned_row_id : null,
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
    const dataCompleteness: { session_id: string; assessment: SessionDataCompleteness }[] = [];
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
      dataCompleteness.push({
        session_id: session.session_id,
        assessment: assessSessionDataCompleteness(
          { ...session, readiness: parseSessionReadinessFromNotes(session.notes) },
          sessionSets,
        ),
      });
    }

    const trainingDays = buildTrainingDayAggregates(correctedSessions, sets, {
      timezone: "Asia/Tokyo",
      accessorySetLimit: 3,
      blockedCandidateNames: ["Upright Row", "Face Pull", "French Press"],
    });
    const aiConsultations = extractAiConsultationsFromSessions(correctedSessions);
    const supervisorProgramPlanState =
      await SupervisorProgramPlanService.getState();

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
        training_days: trainingDays.length,
        ai_consultations: aiConsultations.length,
      },
      supervisor_plan: {
        ...buildSupervisorPlanMetadataFromProgramPlan(
          supervisorProgramPlanState.applied,
          null,
        ),
        latest_guard_status:
          supervisorProgramPlanState.applied && !supervisorProgramPlanState.is_stale
            ? "applied"
            : "stale_or_missing",
      },
      supervisor_program_plan: {
        applied: supervisorProgramPlanState.applied
          ? {
              schema: supervisorProgramPlanState.applied.schema,
              plan_id: supervisorProgramPlanState.applied.plan_id,
              version: supervisorProgramPlanState.applied.version,
              updated_at: supervisorProgramPlanState.applied.updated_at,
              effective_from: supervisorProgramPlanState.applied.effective_from,
              valid_until: supervisorProgramPlanState.applied.valid_until,
              checksum: supervisorProgramPlanState.applied.checksum,
            }
          : null,
        is_stale: supervisorProgramPlanState.is_stale,
        stale_reason: supervisorProgramPlanState.stale_reason,
        executable:
          Boolean(supervisorProgramPlanState.applied) &&
          !supervisorProgramPlanState.is_stale,
        rows: supervisorProgramPlanState.applied?.rows ?? [],
      },
      sessions: correctedSessions,
      sets,
      reps,
      exercises,
      lvp_profiles: lvpProfiles,
      form_videos: formVideos,
      training_days: trainingDays,
      ai_consultations: aiConsultations,
      data_completeness: dataCompleteness,
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
