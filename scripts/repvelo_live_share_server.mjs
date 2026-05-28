#!/usr/bin/env node
import { createServer } from "node:http";
import { mkdir, appendFile, readFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_OUTPUT = path.resolve("exports/live-share/events.jsonl");

const args = process.argv.slice(2);

const getArg = (name, fallback) => {
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1]) {
    return args[index + 1];
  }
  return fallback;
};

const host = getArg("--host", "127.0.0.1");
const port = Number.parseInt(getArg("--port", "8788"), 10);
const output = path.resolve(getArg("--output", DEFAULT_OUTPUT));
const token = getArg("--token", process.env.REPVELO_LIVE_SHARE_TOKEN ?? "");

if (!Number.isFinite(port) || port <= 0 || port > 65535) {
  console.error("Invalid --port. Use a number between 1 and 65535.");
  process.exit(1);
}

const readBody = async (request) =>
  await new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    request.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > 1024 * 1024) {
        reject(new Error("Payload too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });

const sendJson = (response, status, body) => {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
};

const sendText = (response, status, body, contentType = "text/plain") => {
  response.writeHead(status, { "Content-Type": `${contentType}; charset=utf-8` });
  response.end(body);
};

const getUrl = (request) =>
  new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

const isAuthorized = (request, url) => {
  if (!token) return true;
  const headerToken = request.headers["x-repvelo-live-token"];
  const queryToken = url.searchParams.get("token");
  return headerToken === token || queryToken === token;
};

const readRecentEvents = async (limit = 200) => {
  try {
    const raw = await readFile(output, "utf8");
    return raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .slice(-limit)
      .map((line) => JSON.parse(line))
      .filter((line) => line?.event?.app === "RepVeloCoach");
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
};

const formatMetric = (value, digits = 2, suffix = "") =>
  typeof value === "number" && Number.isFinite(value)
    ? `${value.toFixed(digits)}${suffix}`
    : "-";

const formatTime = (timestamp) => {
  if (!timestamp) return "-";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

const summarizeEvents = (lines) => {
  const events = lines.map((line) => line.event);
  const sets = events.filter((event) => event.type === "set_completed");
  const reps = events.filter((event) => event.type === "rep_recorded");
  const videos = events.filter((event) => event.type === "form_video_saved");
  const sessions = events.filter((event) => event.type === "session_started");
  const lastEvent = events.at(-1) ?? null;
  const lastSet = sets.at(-1) ?? null;
  const currentLift =
    lastEvent?.payload?.lift ??
    lastSet?.payload?.lift ??
    sessions.at(-1)?.payload?.current_lift ??
    "-";

  return {
    event_count: events.length,
    set_count: sets.length,
    rep_count: reps.length,
    video_count: videos.length,
    session_count: sessions.length,
    current_lift: currentLift,
    last_event_type: lastEvent?.type ?? "-",
    last_event_at: lastEvent?.created_at ?? lines.at(-1)?.received_at ?? null,
    last_set: lastSet,
    recent_sets: sets.slice(-12).reverse(),
    recent_reps: reps.slice(-12).reverse(),
    recent_videos: videos.slice(-6).reverse(),
  };
};

const buildGptPacket = (lines) => {
  const summary = summarizeEvents(lines);
  const sets = summary.recent_sets.slice().reverse();
  const reps = summary.recent_reps.slice().reverse();
  const videos = summary.recent_videos.slice().reverse();

  const setRows = sets
    .map((event) => {
      const p = event.payload ?? {};
      return `| ${p.set_index ?? "-"} | ${p.lift ?? "-"} | ${formatMetric(p.load_kg, 1, " kg")} | ${p.reps ?? "-"} | ${formatMetric(p.avg_velocity, 2)} | ${formatMetric(p.velocity_loss, 1, "%")} | ${formatMetric(p.avg_rom_cm, 1, " cm")} | ${formatMetric(p.avg_power_w, 0, " W")} | ${p.peak_hr ?? "-"} | ${formatTime(p.end_timestamp ?? event.created_at)} |`;
    })
    .join("\n");

  const repRows = reps
    .map((event) => {
      const p = event.payload ?? {};
      return `| ${p.rep_index ?? "-"} | ${p.lift ?? "-"} | ${formatMetric(p.load_kg, 1, " kg")} | ${formatMetric(p.mean_velocity, 2)} | ${formatMetric(p.peak_velocity, 2)} | ${formatMetric(p.rom_cm, 1, " cm")} | ${formatMetric(p.mean_power_w, 0, " W")} | ${p.hr_bpm ?? "-"} | ${formatTime(p.timestamp ?? event.created_at)} |`;
    })
    .join("\n");

  const videoRows = videos
    .map((event) => {
      const p = event.payload ?? {};
      return `| ${p.lift ?? "-"} | ${p.set_index ?? "-"} | ${formatMetric(p.load_kg, 1, " kg")} | ${p.duration_s ?? "-"}s | ${p.local_uri ?? "-"} |`;
    })
    .join("\n");

  return `# RepVeloCoach Live Share GPT Packet

## Summary
- Generated at: ${new Date().toISOString()}
- Current lift: ${summary.current_lift}
- Last event: ${summary.last_event_type} / ${formatTime(summary.last_event_at)}
- Events: ${summary.event_count}
- Sets: ${summary.set_count}
- Reps: ${summary.rep_count}
- Form videos: ${summary.video_count}

## Recent Sets
| set | lift | load | reps | AV | VL | ROM | power | peak HR | time |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---|
${setRows || "| - | - | - | - | - | - | - | - | - | - |"}

## Recent Reps
| rep | lift | load | mean v | peak v | ROM | power | HR | time |
|---:|---|---:|---:|---:|---:|---:|---:|---|
${repRows || "| - | - | - | - | - | - | - | - | - |"}

## Form Videos
| lift | set | load | duration | local uri |
|---|---:|---:|---:|---|
${videoRows || "| - | - | - | - | - |"}

## Ask
この実測データを根拠に、疲労度、次セット重量、休憩時間、フォーム/ROM低下、PR扱いの妥当性を実用的に判断してください。`;
};

const dashboardHtml = () => `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>RepVeloCoach Live Share</title>
  <style>
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #080807; color: #f5f2ea; }
    main { max-width: 1180px; margin: 0 auto; padding: 28px; }
    h1 { font-size: 34px; margin: 0 0 6px; }
    h2 { font-size: 18px; margin: 0 0 12px; color: #ffd166; }
    .muted { color: #a8a097; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; margin: 20px 0; }
    .card { background: #171513; border: 1px solid #332b23; border-radius: 10px; padding: 16px; }
    .value { font-size: 28px; font-weight: 850; margin-top: 8px; }
    .section { margin-top: 18px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; border-bottom: 1px solid #302a24; padding: 9px 8px; white-space: nowrap; }
    th { color: #ffd166; font-size: 12px; }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 16px; }
    button, a.button { border: 1px solid #6f4d20; background: #2b2117; color: #f5f2ea; border-radius: 8px; padding: 10px 14px; font-weight: 750; text-decoration: none; cursor: pointer; }
    button:hover, a.button:hover { border-color: #ffd166; }
    #status { color: #8ae88a; font-weight: 750; }
    pre { background: #111; border: 1px solid #332b23; border-radius: 10px; padding: 14px; overflow: auto; max-height: 300px; }
  </style>
</head>
<body>
  <main>
    <p class="muted">LOCAL LAN / NO DISCOVERY</p>
    <h1>RepVeloCoach Live Share</h1>
    <div id="status">waiting...</div>
    <div class="actions">
      <button id="copyPacket">GPTパケットをコピー</button>
      <a class="button" id="packetLink" href="/gpt-packet" target="_blank">GPTパケットを開く</a>
      <a class="button" href="/health" target="_blank">health</a>
    </div>
    <div class="grid">
      <div class="card"><div class="muted">Current Lift</div><div class="value" id="currentLift">-</div></div>
      <div class="card"><div class="muted">Sets</div><div class="value" id="sets">0</div></div>
      <div class="card"><div class="muted">Reps</div><div class="value" id="reps">0</div></div>
      <div class="card"><div class="muted">Videos</div><div class="value" id="videos">0</div></div>
    </div>
    <section class="card section">
      <h2>Recent Sets</h2>
      <table><thead><tr><th>set</th><th>lift</th><th>load</th><th>reps</th><th>AV</th><th>VL</th><th>ROM</th><th>HR</th><th>time</th></tr></thead><tbody id="setsBody"></tbody></table>
    </section>
    <section class="card section">
      <h2>Recent Reps</h2>
      <table><thead><tr><th>rep</th><th>lift</th><th>load</th><th>mean</th><th>peak</th><th>ROM</th><th>power</th><th>HR</th><th>time</th></tr></thead><tbody id="repsBody"></tbody></table>
    </section>
    <section class="card section">
      <h2>Latest Raw Event</h2>
      <pre id="raw">{}</pre>
    </section>
  </main>
  <script>
    const params = new URLSearchParams(location.search);
    const tokenParam = params.get("token");
    const tokenQuery = tokenParam ? "?token=" + encodeURIComponent(tokenParam) : "";
    if (tokenParam) document.getElementById("packetLink").href = "/gpt-packet" + tokenQuery;
    const fmt = (value, digits = 2, suffix = "") => typeof value === "number" ? value.toFixed(digits) + suffix : "-";
    const clock = (value) => value ? new Date(value).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "-";
    const row = (cells) => "<tr>" + cells.map((cell) => "<td>" + String(cell ?? "-") + "</td>").join("") + "</tr>";
    async function refresh() {
      try {
        const response = await fetch("/events/recent" + tokenQuery);
        if (!response.ok) throw new Error("HTTP " + response.status);
        const data = await response.json();
        const summary = data.summary;
        document.getElementById("status").textContent = "connected / " + new Date().toLocaleTimeString("ja-JP");
        document.getElementById("currentLift").textContent = summary.current_lift ?? "-";
        document.getElementById("sets").textContent = summary.set_count ?? 0;
        document.getElementById("reps").textContent = summary.rep_count ?? 0;
        document.getElementById("videos").textContent = summary.video_count ?? 0;
        document.getElementById("setsBody").innerHTML = summary.recent_sets.map((event) => {
          const p = event.payload || {};
          return row([p.set_index, p.lift, fmt(p.load_kg, 1, " kg"), p.reps, fmt(p.avg_velocity), fmt(p.velocity_loss, 1, "%"), fmt(p.avg_rom_cm, 1, " cm"), p.peak_hr, clock(p.end_timestamp || event.created_at)]);
        }).join("") || row(["-", "-", "-", "-", "-", "-", "-", "-", "-"]);
        document.getElementById("repsBody").innerHTML = summary.recent_reps.map((event) => {
          const p = event.payload || {};
          return row([p.rep_index, p.lift, fmt(p.load_kg, 1, " kg"), fmt(p.mean_velocity), fmt(p.peak_velocity), fmt(p.rom_cm, 1, " cm"), fmt(p.mean_power_w, 0, " W"), p.hr_bpm, clock(p.timestamp || event.created_at)]);
        }).join("") || row(["-", "-", "-", "-", "-", "-", "-", "-", "-"]);
        document.getElementById("raw").textContent = JSON.stringify(data.latest ?? {}, null, 2);
      } catch (error) {
        document.getElementById("status").textContent = "error / " + error.message;
      }
    }
    document.getElementById("copyPacket").addEventListener("click", async () => {
      const response = await fetch("/gpt-packet" + tokenQuery);
      const text = await response.text();
      await navigator.clipboard.writeText(text);
      document.getElementById("status").textContent = "GPT packet copied";
    });
    refresh();
    setInterval(refresh, 2000);
  </script>
</body>
</html>`;

const appendEvent = async (request, event) => {
  const line = {
    received_at: new Date().toISOString(),
    remote: request.socket.remoteAddress ?? null,
    event,
  };
  await mkdir(path.dirname(output), { recursive: true });
  await appendFile(output, `${JSON.stringify(line)}\n`, "utf8");
  return line;
};

const server = createServer(async (request, response) => {
  try {
    const url = getUrl(request);

    if (request.method === "GET" && url.pathname === "/health") {
      sendJson(response, 200, {
        ok: true,
        app: "RepVeloCoach Live Share",
        output,
        dashboard: `http://${host}:${port}/dashboard`,
      });
      return;
    }

    if (
      request.method === "GET" &&
      (url.pathname === "/" || url.pathname === "/dashboard")
    ) {
      sendText(response, 200, dashboardHtml(), "text/html");
      return;
    }

    if (request.method === "GET" && url.pathname === "/events/recent") {
      if (!isAuthorized(request, url)) {
        sendJson(response, 401, { ok: false, error: "unauthorized" });
        return;
      }
      const lines = await readRecentEvents(
        Number.parseInt(url.searchParams.get("limit") ?? "200", 10),
      );
      sendJson(response, 200, {
        ok: true,
        output,
        latest: lines.at(-1) ?? null,
        summary: summarizeEvents(lines),
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/gpt-packet") {
      if (!isAuthorized(request, url)) {
        sendJson(response, 401, { ok: false, error: "unauthorized" });
        return;
      }
      const lines = await readRecentEvents(
        Number.parseInt(url.searchParams.get("limit") ?? "200", 10),
      );
      sendText(response, 200, buildGptPacket(lines), "text/markdown");
      return;
    }

    if (request.method !== "POST" || url.pathname !== "/events") {
      sendJson(response, 404, { ok: false, error: "not_found" });
      return;
    }

    if (!isAuthorized(request, url)) {
      sendJson(response, 401, { ok: false, error: "unauthorized" });
      return;
    }

    const body = await readBody(request);
    const event = JSON.parse(body);
    if (!event || event.app !== "RepVeloCoach" || !event.type) {
      sendJson(response, 400, { ok: false, error: "invalid_event" });
      return;
    }

    const saved = await appendEvent(request, event);
    console.log(
      `[${saved.received_at}] ${event.type} ${event.payload?.lift ?? ""} ${event.payload?.set_index ?? ""}`,
    );
    sendJson(response, 200, { ok: true });
  } catch (error) {
    console.error("[live-share] request failed:", error);
    sendJson(response, 500, { ok: false, error: "server_error" });
  }
});

server.listen(port, host, () => {
  console.log(`RepVeloCoach Live Share listening on http://${host}:${port}`);
  console.log(`Dashboard: http://${host}:${port}/dashboard`);
  console.log(`Events: ${output}`);
});
