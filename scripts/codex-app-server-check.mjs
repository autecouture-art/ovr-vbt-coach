#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const run = (command, args, options = {}) =>
  spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });

const fail = (message, detail = "") => {
  console.error(`NG: ${message}`);
  if (detail.trim()) {
    console.error(detail.trim());
  }
  process.exit(1);
};

const codexPath = run("which", ["codex"]);
if (codexPath.status !== 0 || !codexPath.stdout.trim()) {
  fail("codex CLI was not found in PATH.");
}

const version = run("codex", ["--version"]);
if (version.status !== 0) {
  fail("codex CLI did not return a version.", version.stderr || version.stdout);
}

const help = run("codex", ["app-server", "--help"]);
if (help.status !== 0 || !help.stdout.includes("generate-json-schema")) {
  fail("codex app-server command is unavailable.", help.stderr || help.stdout);
}

const schemaDir = mkdtempSync(join(tmpdir(), "repvelo-codex-app-server-"));
try {
  const generated = run("codex", [
    "app-server",
    "generate-json-schema",
    "--out",
    schemaDir,
  ]);

  if (generated.status !== 0) {
    fail("codex app-server schema generation failed.", generated.stderr || generated.stdout);
  }

  const bundlePath = join(schemaDir, "codex_app_server_protocol.schemas.json");
  if (!existsSync(bundlePath) || statSync(bundlePath).size === 0) {
    fail("schema generation completed but the protocol bundle is missing.");
  }

  console.log("OK: Codex App Server CLI is available.");
  console.log(`OK: ${version.stdout.trim()}`);
  console.log("OK: JSON schema generation succeeded.");
  console.log("Policy: use stdio:// first; do not expose WebSocket remotely.");
} finally {
  rmSync(schemaDir, { recursive: true, force: true });
}
