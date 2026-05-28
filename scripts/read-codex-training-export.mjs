#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const EXPORT_SCHEMA = "repvelocoach.codex-training-export.v1";
const EXPORT_FILE_RE = /^repvelocoach-codex-export-.*\.json$/;

function usage() {
  console.log("Usage: pnpm codex:training-export [file-or-directory]");
  console.log("Default directory: ~/Downloads");
}

function resolveInputPath(input) {
  if (!input || input === "~") {
    return path.join(os.homedir(), "Downloads");
  }
  if (input.startsWith("~/")) {
    return path.join(os.homedir(), input.slice(2));
  }
  return path.resolve(input);
}

function findLatestExport(inputPath) {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Path not found: ${inputPath}`);
  }

  const stat = fs.statSync(inputPath);
  if (stat.isFile()) {
    return inputPath;
  }
  if (!stat.isDirectory()) {
    throw new Error(`Not a file or directory: ${inputPath}`);
  }

  const candidates = fs
    .readdirSync(inputPath)
    .filter((name) => EXPORT_FILE_RE.test(name))
    .map((name) => {
      const filePath = path.join(inputPath, name);
      return {
        filePath,
        mtimeMs: fs.statSync(filePath).mtimeMs,
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (candidates.length === 0) {
    throw new Error(`No RepVeloCoach Codex export JSON found in: ${inputPath}`);
  }

  return candidates[0].filePath;
}

function topExercisesBySetCount(sets) {
  const counts = new Map();
  for (const set of sets) {
    const lift = typeof set.lift === "string" && set.lift.trim() ? set.lift : "(unknown)";
    counts.set(lift, (counts.get(lift) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([lift, count]) => ({ lift, count }));
}

function latestSession(payload) {
  const sessions = Array.isArray(payload.sessions) ? payload.sessions : [];
  return [...sessions].sort((a, b) => {
    const aDate = String(a.date ?? a.session_id ?? "");
    const bDate = String(b.date ?? b.session_id ?? "");
    return bDate.localeCompare(aDate);
  })[0];
}

function formatNumber(value, digits = 2) {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(digits) : "-";
}

function summarizeExport(filePath, payload) {
  const counts = payload.counts ?? {};
  const sets = Array.isArray(payload.sets) ? payload.sets : [];
  const reps = Array.isArray(payload.reps) ? payload.reps : [];
  const lvpProfiles = Array.isArray(payload.lvp_profiles) ? payload.lvp_profiles : [];
  const formVideos = Array.isArray(payload.form_videos) ? payload.form_videos : [];
  const latest = latestSession(payload);
  const validVelocities = reps
    .map((rep) => rep.mean_velocity)
    .filter((value) => typeof value === "number" && Number.isFinite(value));
  const averageVelocity =
    validVelocities.length > 0
      ? validVelocities.reduce((sum, value) => sum + value, 0) / validVelocities.length
      : null;

  console.log("RepVeloCoach Codex Training Export");
  console.log(`File: ${filePath}`);
  console.log(`Exported at: ${payload.exported_at ?? "-"}`);
  console.log("");
  console.log("Counts");
  console.log(`  Sessions: ${counts.sessions ?? payload.sessions?.length ?? 0}`);
  console.log(`  Sets: ${counts.sets ?? sets.length}`);
  console.log(`  Reps: ${counts.reps ?? reps.length}`);
  console.log(`  Exercises: ${counts.exercises ?? payload.exercises?.length ?? 0}`);
  console.log(`  LVP profiles: ${counts.lvp_profiles ?? lvpProfiles.length}`);
  console.log(`  Form videos: ${counts.form_videos ?? formVideos.length}`);
  console.log("");

  if (latest) {
    console.log("Latest Session");
    console.log(`  ID: ${latest.session_id ?? "-"}`);
    console.log(`  Date: ${latest.date ?? "-"}`);
    console.log(`  Sets: ${latest.total_sets ?? "-"}`);
    console.log(`  Volume: ${Math.round(latest.total_volume ?? 0)} kg`);
    console.log("");
  }

  console.log("Velocity");
  console.log(`  Mean of rep Average Velocity values: ${formatNumber(averageVelocity)} m/s`);
  console.log("");

  console.log("Top Exercises By Sets");
  for (const item of topExercisesBySetCount(sets)) {
    console.log(`  ${item.lift}: ${item.count}`);
  }

  if (lvpProfiles.length > 0) {
    console.log("");
    console.log("MY V@1RM Profiles");
    for (const profile of lvpProfiles.slice(0, 10)) {
      const myV1rm = profile.mvt ?? profile.v1rm;
      console.log(`  ${profile.lift}: ${formatNumber(myV1rm)} m/s (${profile.sample_count ?? 0} samples)`);
    }
  }

  if (formVideos.length > 0) {
    console.log("");
    console.log("Form Videos");
    for (const video of formVideos.slice(0, 10)) {
      const setLabel =
        video.set_index == null ? "session" : `${video.lift} set ${video.set_index}`;
      console.log(
        `  ${setLabel}: ${Math.round(video.duration_s ?? 0)}s ${video.local_uri ?? ""}`,
      );
    }
  }
}

try {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    usage();
    process.exit(0);
  }

  const inputPath = resolveInputPath(process.argv[2]);
  const filePath = findLatestExport(inputPath);
  const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));

  if (payload.schema !== EXPORT_SCHEMA) {
    throw new Error(`Unsupported export schema: ${payload.schema ?? "(missing)"}`);
  }

  summarizeExport(filePath, payload);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  usage();
  process.exit(1);
}
