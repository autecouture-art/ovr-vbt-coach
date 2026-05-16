#!/usr/bin/env node

import { spawn } from "node:child_process";
import readline from "node:readline";
import { cwd as getCwd } from "node:process";

const usage = `Usage:
  pnpm codex:app-server:admin -- --prompt "Review current changes"
  pnpm codex:app-server:admin -- --preset review
  pnpm codex:app-server:admin -- --preset testflight
  pnpm codex:app-server:admin -- --dry-run --prompt "Summarize TestFlight readiness"

Options:
  --prompt <text>   Prompt to send to Codex App Server.
  --preset <name>   Use a canned prompt. Run --list-presets to see names.
  --note <text>     Extra instruction appended to the preset or prompt.
  --cwd <path>      Working directory for the Codex turn. Defaults to current directory.
  --model <name>    Optional model override. If omitted, Codex uses its configured default.
  --write           Allow workspace writes for implementation-oriented turns.
  --debug-json      Print raw JSON-RPC messages from the server.
  --dry-run         Print the JSON-RPC messages without starting Codex.
  --list-presets    Show available preset names.
  --help            Show this help.

Safety:
  This client uses stdio:// by spawning 'codex app-server'.
  It does not start a WebSocket listener.
`;

const PRESETS = {
  review: {
    title: "Review current changes",
    prompt:
      "RepVeloCoachの現在の未コミット差分をコードレビューしてください。重大度順に、バグ、回帰リスク、テスト不足、リリース前に直すべき点を短く列挙してください。ユーザー未承認の破壊的操作やネットワーク操作は行わず、必要なら読むだけのrepo-localコマンドに限定してください。",
  },
  testflight: {
    title: "Summarize TestFlight readiness",
    prompt:
      "RepVeloCoachをTestFlightへ出す前提で、現在のリポジトリ状態から準備状況を確認してください。見るべきものはAGENTS.md、docs/IMPROVEMENT_TRACKER.md、docs/AGENT_WALKTHROUGH.md、TESTFLIGHT_DEPLOYMENT.md、package.json、app.config.ts、ios側のbuild番号です。結論、ブロッカー、確認済み、次に実行すべきコマンドを日本語で短くまとめてください。アップロードや外部通信は実行しないでください。",
  },
  "vbt-plan": {
    title: "Plan deterministic VBT coaching work",
    prompt:
      "RepVeloCoachのアプリ内AIをAPI課金なしでも成立させるため、現在のVBT関連実装と改善トラッカーを読み、deterministic VBT coachingとして次に実装すべき項目を優先順位つきで整理してください。Average Velocity、Velocity Loss、MVT、ROM、トップシングル、バックオフ判断、手動入力UXを中心に、実装ファイル候補と検証方法まで短くまとめてください。",
  },
  performance: {
    title: "Investigate long-session slowdown risk",
    prompt:
      "RepVeloCoachで長時間使用すると重くなり固まる問題について、現在のセッション画面、store、DB保存、グラフ/履歴表示、BLE/Health関連の状態蓄積を読む範囲で調査してください。推測ではなく、怪しい配列・イベント購読・再レンダー原因・保存ループをファイル名つきで挙げ、修正優先度を示してください。破壊的変更はしないでください。",
  },
  "release-notes": {
    title: "Draft user-facing release notes",
    prompt:
      "RepVeloCoachの現在の未コミット差分と作業ログから、TestFlight向けのユーザー説明文を日本語で作ってください。ユーザーに伝える改善点、注意して確認してほしい点、既知の未解決リスクを分けて、専門用語を少なめにしてください。",
  },
};

const DEFAULT_MODEL = process.env.CODEX_APP_SERVER_MODEL || "gpt-5.4";

const listPresets = () => {
  console.log("Available presets:");
  for (const [name, preset] of Object.entries(PRESETS)) {
    console.log(`  ${name.padEnd(13)} ${preset.title}`);
  }
};

const readArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    cwd: getCwd(),
    dryRun: false,
    debugJson: false,
    model: DEFAULT_MODEL,
    note: "",
    preset: "",
    prompt: "",
    write: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--") {
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      console.log(usage);
      process.exit(0);
    }
    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (arg === "--debug-json") {
      options.debugJson = true;
      continue;
    }
    if (arg === "--write") {
      options.write = true;
      continue;
    }
    if (arg === "--list-presets") {
      listPresets();
      process.exit(0);
    }
    if (arg === "--preset") {
      options.preset = args[++i] ?? "";
      continue;
    }
    if (arg === "--prompt") {
      options.prompt = args[++i] ?? "";
      continue;
    }
    if (arg === "--note") {
      options.note = args[++i] ?? "";
      continue;
    }
    if (arg === "--cwd") {
      options.cwd = args[++i] ?? "";
      continue;
    }
    if (arg === "--model") {
      options.model = args[++i] ?? "";
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (options.preset) {
    const preset = PRESETS[options.preset];
    if (!preset) {
      throw new Error(`Unknown preset: ${options.preset}. Run --list-presets.`);
    }
    if (!options.prompt.trim()) {
      options.prompt = preset.prompt;
    }
  }

  if (!options.prompt.trim()) {
    options.prompt =
      "RepVeloCoachの現在の未コミット差分を安全に確認し、重要なリスクと次の一手を短くまとめてください。";
  }

  if (options.note.trim()) {
    options.prompt = `${options.prompt}\n\n追加指示:\n${options.note.trim()}`;
  }

  return options;
};

const buildMessages = ({ cwd, model, prompt, write }) => {
  const initialize = {
    method: "initialize",
    id: 0,
    params: {
      clientInfo: {
        name: "repvelocoach_admin_client",
        title: "RepVeloCoach Admin Client",
        version: "0.1.0",
      },
    },
  };

  const threadStart = {
    method: "thread/start",
    id: 1,
    params: {
      model,
      cwd,
      approvalPolicy: "never",
      sandbox: write ? "workspace-write" : "read-only",
      serviceName: "repvelocoach_admin_client",
    },
  };

  const sandboxPolicy = write
    ? {
        type: "workspaceWrite",
        writableRoots: [cwd],
        networkAccess: false,
      }
    : {
        type: "readOnly",
        networkAccess: false,
      };

  const turnParams = {
    threadId: "__THREAD_ID__",
    input: [{ type: "text", text: prompt }],
    cwd,
    approvalPolicy: "never",
    sandboxPolicy,
  };

  if (model) {
    turnParams.model = model;
  }

  return {
    initialize,
    initialized: { method: "initialized", params: {} },
    threadStart,
    turnStartTemplate: { method: "turn/start", id: 2, params: turnParams },
  };
};

const send = (proc, message) => {
  proc.stdin.write(`${JSON.stringify(message)}\n`);
};

const main = () => {
  const options = readArgs();
  const messages = buildMessages(options);

  if (options.dryRun) {
    console.log(JSON.stringify(messages.initialize, null, 2));
    console.log(JSON.stringify(messages.initialized, null, 2));
    console.log(JSON.stringify(messages.threadStart, null, 2));
    console.log(JSON.stringify(messages.turnStartTemplate, null, 2));
    return;
  }

  const proc = spawn("codex", ["app-server"], {
    stdio: ["pipe", "pipe", "inherit"],
  });

  const rl = readline.createInterface({ input: proc.stdout });
  let completed = false;
  let finalMessage = "";

  proc.on("error", (error) => {
    console.error(`Failed to start codex app-server: ${error.message}`);
    process.exitCode = 1;
  });

  rl.on("line", (line) => {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      console.log(line);
      return;
    }

    if (options.debugJson) {
      console.error(`server: ${JSON.stringify(msg)}`);
    }

    if (msg.id === 1 && msg.result?.thread?.id) {
      const turnStart = structuredClone(messages.turnStartTemplate);
      turnStart.params.threadId = msg.result.thread.id;
      send(proc, turnStart);
      return;
    }

    if (msg.method === "item/agentMessage/delta" && msg.params?.delta) {
      finalMessage += msg.params.delta;
      process.stdout.write(msg.params.delta);
      return;
    }

    if (
      msg.method === "item/completed" &&
      msg.params?.item?.type === "agentMessage" &&
      typeof msg.params.item.text === "string" &&
      !finalMessage
    ) {
      finalMessage = msg.params.item.text;
      process.stdout.write(finalMessage);
      return;
    }

    if (msg.method === "turn/completed") {
      completed = true;
      process.stdout.write("\n");
      proc.stdin.end();
      proc.kill();
      return;
    }

    if (msg.error) {
      console.error(JSON.stringify(msg.error, null, 2));
    }

    if (msg.method === "error" && msg.params?.error) {
      console.error(JSON.stringify(msg.params.error, null, 2));
    }
  });

  proc.on("exit", (code) => {
    if (!completed && code !== 0) {
      process.exitCode = code ?? 1;
    }
  });

  send(proc, messages.initialize);
  send(proc, messages.initialized);
  send(proc, messages.threadStart);
};

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
