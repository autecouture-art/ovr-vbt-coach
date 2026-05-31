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
const defaultThresholds = {
  av_drop_watch_pct: Number.parseFloat(getArg("--av-drop-watch", "5")),
  av_drop_major_pct: Number.parseFloat(getArg("--av-drop-major", "10")),
  rom_drop_watch_cm: Number.parseFloat(getArg("--rom-drop-watch", "2")),
  rom_drop_major_cm: Number.parseFloat(getArg("--rom-drop-major", "4")),
  vl_watch_pct: Number.parseFloat(getArg("--vl-watch", "15")),
  vl_major_pct: Number.parseFloat(getArg("--vl-major", "20")),
  peak_hr_watch_bpm: Number.parseFloat(getArg("--hr-watch", "160")),
};

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

const withThresholdOverrides = (url) => {
  const readOverride = (key, fallback) => {
    const raw = url.searchParams.get(key);
    if (raw == null) return fallback;
    const value = Number.parseFloat(raw);
    return Number.isFinite(value) ? value : fallback;
  };

  return {
    av_drop_watch_pct: readOverride(
      "avDropWatch",
      defaultThresholds.av_drop_watch_pct,
    ),
    av_drop_major_pct: readOverride(
      "avDropMajor",
      defaultThresholds.av_drop_major_pct,
    ),
    rom_drop_watch_cm: readOverride(
      "romDropWatch",
      defaultThresholds.rom_drop_watch_cm,
    ),
    rom_drop_major_cm: readOverride(
      "romDropMajor",
      defaultThresholds.rom_drop_major_cm,
    ),
    vl_watch_pct: readOverride("vlWatch", defaultThresholds.vl_watch_pct),
    vl_major_pct: readOverride("vlMajor", defaultThresholds.vl_major_pct),
    peak_hr_watch_bpm: readOverride(
      "hrWatch",
      defaultThresholds.peak_hr_watch_bpm,
    ),
  };
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

const getVlAvg = (payload) => asNumber(payload?.velocity_loss_avg) ?? asNumber(payload?.velocity_loss);
const getVlLast = (payload) => asNumber(payload?.velocity_loss_last) ?? asNumber(payload?.velocity_loss);
const getVlMin = (payload) =>
  asNumber(payload?.velocity_loss_min) ?? getVlLast(payload) ?? getVlAvg(payload);
const formatVlTriplet = (payload) =>
  `${formatMetric(getVlAvg(payload), 1)} / ${formatMetric(getVlLast(payload), 1)} / ${formatMetric(getVlMin(payload), 1)}%`;

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

const asNumber = (value) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const getPayloadNumber = (event, key) => asNumber(event?.payload?.[key]);

const getEventTime = (event) => {
  const raw =
    event?.payload?.end_timestamp ??
    event?.payload?.timestamp ??
    event?.created_at ??
    null;
  const time = raw ? new Date(raw).getTime() : NaN;
  return Number.isFinite(time) ? time : 0;
};

const getWorkingSets = (sets) =>
  sets.filter((event) => event?.payload?.is_warmup !== true);

const buildSetAnalysis = (sets, thresholds = defaultThresholds) => {
  const chronological = getWorkingSets(sets).sort(
    (a, b) => getEventTime(a) - getEventTime(b),
  );
  const lastSet = chronological.at(-1) ?? null;
  if (!lastSet) {
    return {
      status: "waiting",
      headline: "作業セット待ち",
      recommendation: "Live Shareで作業セットが入ると判定を開始します。",
      flags: [],
      current_lift: "-",
      current_load_kg: null,
      av: null,
      av_drop_pct: null,
      rom_cm: null,
      rom_drop_cm: null,
      vl_pct: null,
      peak_hr: null,
      rest_s: null,
      same_load_sets: [],
      lift_sets: [],
    };
  }

  const lastPayload = lastSet.payload ?? {};
  const currentLift = lastPayload.lift ?? "-";
  const currentLoad = asNumber(lastPayload.load_kg);
  const liftSets = chronological.filter(
    (event) => event.payload?.lift === currentLift,
  );
  const sameLoadSets =
    currentLoad == null
      ? []
      : liftSets.filter(
          (event) => asNumber(event.payload?.load_kg) === currentLoad,
        );

  const avValues = sameLoadSets
    .map((event) => getPayloadNumber(event, "avg_velocity"))
    .filter((value) => value != null);
  const currentAv = asNumber(lastPayload.avg_velocity);
  const bestAv = avValues.length > 0 ? Math.max(...avValues) : null;
  const avDropPct =
    currentAv != null && bestAv != null && bestAv > 0
      ? ((bestAv - currentAv) / bestAv) * 100
      : null;

  const romValues = liftSets
    .map((event) => getPayloadNumber(event, "avg_rom_cm"))
    .filter((value) => value != null && value > 0);
  const currentRom = asNumber(lastPayload.avg_rom_cm);
  const baselineRom = romValues.length > 0 ? Math.max(...romValues) : null;
  const romDropCm =
    currentRom != null && baselineRom != null ? baselineRom - currentRom : null;

  const vlPct = getVlLast(lastPayload);
  const vlMinPct = getVlMin(lastPayload);
  const peakHr = asNumber(lastPayload.peak_hr);
  const restS = asNumber(lastPayload.rest_duration_s);

  const flags = [];
  if (avDropPct != null && avDropPct >= thresholds.av_drop_watch_pct) {
    flags.push({
      severity: avDropPct >= thresholds.av_drop_major_pct ? "major" : "watch",
      label: "AV低下",
      detail: `同重量最高から ${avDropPct.toFixed(1)}% 低下`,
    });
  }
  if (romDropCm != null && romDropCm >= thresholds.rom_drop_watch_cm) {
    flags.push({
      severity: romDropCm >= thresholds.rom_drop_major_cm ? "major" : "watch",
      label: "ROM低下",
      detail: `基準ROMから -${romDropCm.toFixed(1)} cm`,
    });
  }
  if (vlPct != null && vlPct >= thresholds.vl_watch_pct) {
    flags.push({
      severity: vlPct >= thresholds.vl_major_pct ? "major" : "watch",
      label: "VL_last高め",
      detail: `${vlPct.toFixed(1)}%`,
    });
  }
  if (vlMinPct != null && vlMinPct >= Math.max(25, thresholds.vl_major_pct)) {
    flags.push({
      severity: vlMinPct >= 30 ? "major" : "watch",
      label: "VL_min失速",
      detail: `${vlMinPct.toFixed(1)}%`,
    });
  }
  if (peakHr != null && peakHr >= thresholds.peak_hr_watch_bpm) {
    flags.push({
      severity: "watch",
      label: "心拍高め",
      detail: `Peak ${peakHr} bpm`,
    });
  }

  const majorFlags = flags.filter((flag) => flag.severity === "major");
  const status =
    majorFlags.length > 0 ? "major" : flags.length > 0 ? "watch" : "good";
  const headline =
    status === "major"
      ? "重量を落として質優先"
      : status === "watch"
        ? "次セット条件つき"
        : "継続しやすい状態";
  const recommendation =
    status === "major"
      ? "次セットは2.5〜10kg落とし、ROMとフォームを戻せるか確認してください。"
      : status === "watch"
        ? "休憩を少し伸ばし、次セットはROMと1レップ目の速度を見て継続判断してください。"
        : "同じ重量または予定通りに継続できます。";

  return {
    status,
    headline,
    recommendation,
    flags,
    current_lift: currentLift,
    current_load_kg: currentLoad,
    av: currentAv,
    av_drop_pct: avDropPct,
    rom_cm: currentRom,
    rom_drop_cm: romDropCm,
    vl_pct: vlPct,
    peak_hr: peakHr,
    rest_s: restS,
    same_load_sets: sameLoadSets.slice(-6),
    lift_sets: liftSets.slice(-12),
    thresholds,
  };
};

const summarizeEvents = (lines, thresholds = defaultThresholds) => {
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
  const lastReceivedAt = lines.at(-1)?.received_at ?? null;
  const lastReceivedMs = lastReceivedAt ? new Date(lastReceivedAt).getTime() : NaN;
  const freshnessSeconds = Number.isFinite(lastReceivedMs)
    ? Math.max(0, Math.round((Date.now() - lastReceivedMs) / 1000))
    : null;

  return {
    event_count: events.length,
    set_count: sets.length,
    rep_count: reps.length,
    video_count: videos.length,
    session_count: sessions.length,
    current_lift: currentLift,
    last_event_type: lastEvent?.type ?? "-",
    last_event_at: lastEvent?.created_at ?? lines.at(-1)?.received_at ?? null,
    last_received_at: lastReceivedAt,
    freshness_s: freshnessSeconds,
    last_set: lastSet,
    recent_sets: sets.slice(-12).reverse(),
    recent_reps: reps.slice(-12).reverse(),
    recent_videos: videos.slice(-6).reverse(),
    recent_events: lines.slice(-18).reverse(),
    analysis: buildSetAnalysis(sets, thresholds),
  };
};

const buildGptPacket = (lines, thresholds = defaultThresholds) => {
  const summary = summarizeEvents(lines, thresholds);
  const sets = summary.recent_sets.slice().reverse();
  const reps = summary.recent_reps.slice().reverse();
  const videos = summary.recent_videos.slice().reverse();

  const setRows = sets
    .map((event) => {
      const p = event.payload ?? {};
      return `| ${p.set_index ?? "-"} | ${p.lift ?? "-"} | ${formatMetric(p.load_kg, 1, " kg")} | ${p.reps ?? "-"} | ${formatMetric(p.avg_velocity, 2)} | ${formatVlTriplet(p)} | ${formatMetric(p.avg_rom_cm, 1, " cm")} | ${formatMetric(p.avg_power_w, 0, " W")} | ${p.peak_hr ?? "-"} | ${formatTime(p.end_timestamp ?? event.created_at)} |`;
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

## App-side Live Analysis
- Status: ${summary.analysis.headline}
- Recommendation: ${summary.analysis.recommendation}
- Current load: ${formatMetric(summary.analysis.current_load_kg, 1, " kg")}
- AV: ${formatMetric(summary.analysis.av, 2, " m/s")}
- AV drop: ${formatMetric(summary.analysis.av_drop_pct, 1, "%")}
- ROM: ${formatMetric(summary.analysis.rom_cm, 1, " cm")}
- ROM drop: ${formatMetric(summary.analysis.rom_drop_cm, 1, " cm")}
- VL_last: ${formatMetric(summary.analysis.vl_pct, 1, "%")}
- Peak HR: ${summary.analysis.peak_hr ?? "-"} bpm
- Flags: ${
    summary.analysis.flags.length > 0
      ? summary.analysis.flags
          .map((flag) => `${flag.label}(${flag.detail})`)
          .join(", ")
      : "none"
  }
- Thresholds: AV watch ${summary.analysis.thresholds.av_drop_watch_pct}% / AV major ${summary.analysis.thresholds.av_drop_major_pct}% / ROM watch ${summary.analysis.thresholds.rom_drop_watch_cm}cm / ROM major ${summary.analysis.thresholds.rom_drop_major_cm}cm / VL watch ${summary.analysis.thresholds.vl_watch_pct}% / VL major ${summary.analysis.thresholds.vl_major_pct}% / HR watch ${summary.analysis.thresholds.peak_hr_watch_bpm}bpm

## Recent Sets
| set | lift | load | reps | AV | VL avg/last/min | ROM | power | peak HR | time |
|---:|---|---:|---:|---:|---|---:|---:|---:|---|
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

const escapeCsv = (value) => {
  if (value == null) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
};

const buildEventsCsv = (lines) => {
  const header = [
    "received_at",
    "type",
    "created_at",
    "lift",
    "set_index",
    "rep_index",
    "load_kg",
    "reps",
    "avg_velocity",
    "mean_velocity",
    "peak_velocity",
    "velocity_loss",
    "velocity_loss_avg",
    "velocity_loss_last",
    "velocity_loss_min",
    "rom_cm",
    "avg_rom_cm",
    "avg_power_w",
    "mean_power_w",
    "peak_hr",
    "hr_bpm",
    "duration_s",
    "local_uri",
  ];
  const rows = lines.map((line) => {
    const event = line.event ?? {};
    const p = event.payload ?? {};
    return [
      line.received_at,
      event.type,
      event.created_at,
      p.lift ?? p.current_lift,
      p.set_index,
      p.rep_index,
      p.load_kg ?? p.current_load_kg,
      p.reps,
      p.avg_velocity,
      p.mean_velocity,
      p.peak_velocity,
      p.velocity_loss,
      p.velocity_loss_avg,
      p.velocity_loss_last,
      p.velocity_loss_min,
      p.rom_cm,
      p.avg_rom_cm,
      p.avg_power_w,
      p.mean_power_w,
      p.peak_hr,
      p.hr_bpm,
      p.duration_s,
      p.local_uri,
    ];
  });

  return [header, ...rows]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\n");
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
    .analysis { border-color: #6f4d20; background: linear-gradient(135deg, #211914, #13110f); }
    .analysis.good { border-color: #2f8f52; }
    .analysis.watch { border-color: #c7932e; }
    .analysis.major { border-color: #d05252; }
    .analysis-head { display: flex; gap: 16px; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; }
    .headline { font-size: 28px; font-weight: 900; margin: 8px 0; }
    .recommendation { color: #f2d99d; font-size: 16px; line-height: 1.5; max-width: 760px; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .chip { border-radius: 999px; padding: 7px 10px; background: #2a241f; border: 1px solid #45372c; font-size: 12px; font-weight: 750; }
    .chip.watch { border-color: #c7932e; color: #ffd166; }
    .chip.major { border-color: #d05252; color: #ff9a9a; }
    .stale { color: #ff9a9a; }
    .metric-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-top: 16px; }
    .metric { background: #100f0e; border: 1px solid #302a24; border-radius: 8px; padding: 10px; }
    .metric-label { color: #a8a097; font-size: 11px; }
    .metric-value { font-size: 20px; font-weight: 850; margin-top: 4px; }
    .spark { display: flex; align-items: end; gap: 4px; min-height: 70px; margin-top: 12px; }
    .bar { width: 16px; min-height: 4px; border-radius: 4px 4px 0 0; background: #ffd166; opacity: 0.85; }
    .bar.rom { background: #7bdff2; }
    .split { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
    .control-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
    label { display: block; color: #a8a097; font-size: 11px; font-weight: 750; margin-bottom: 5px; }
    input { box-sizing: border-box; width: 100%; border: 1px solid #45372c; border-radius: 8px; background: #0f0e0d; color: #f5f2ea; padding: 9px 10px; font-size: 14px; }
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
      <a class="button" id="csvLink" href="/events.csv" target="_blank">CSVを書き出す</a>
      <a class="button" href="/health" target="_blank">health</a>
    </div>
    <section class="card section">
      <h2>Thresholds</h2>
      <div class="control-grid">
        <div><label>AV watch %</label><input data-threshold="avDropWatch" type="number" step="0.5" /></div>
        <div><label>AV major %</label><input data-threshold="avDropMajor" type="number" step="0.5" /></div>
        <div><label>ROM watch cm</label><input data-threshold="romDropWatch" type="number" step="0.5" /></div>
        <div><label>ROM major cm</label><input data-threshold="romDropMajor" type="number" step="0.5" /></div>
        <div><label>VL watch %</label><input data-threshold="vlWatch" type="number" step="0.5" /></div>
        <div><label>VL major %</label><input data-threshold="vlMajor" type="number" step="0.5" /></div>
        <div><label>HR watch bpm</label><input data-threshold="hrWatch" type="number" step="1" /></div>
      </div>
      <p class="muted">ここで変えた値はこのブラウザに保存され、判定とGPTパケットに反映されます。</p>
    </section>
    <div class="grid">
      <div class="card"><div class="muted">Current Lift</div><div class="value" id="currentLift">-</div></div>
      <div class="card"><div class="muted">Sets</div><div class="value" id="sets">0</div></div>
      <div class="card"><div class="muted">Reps</div><div class="value" id="reps">0</div></div>
      <div class="card"><div class="muted">Videos</div><div class="value" id="videos">0</div></div>
      <div class="card"><div class="muted">Last Event</div><div class="value" id="freshness">-</div></div>
    </div>
    <section class="card analysis section" id="analysisCard">
      <div class="analysis-head">
        <div>
          <div class="muted">LIVE DECISION</div>
          <div class="headline" id="analysisHeadline">作業セット待ち</div>
          <div class="recommendation" id="analysisRecommendation">Live Shareで作業セットが入ると判定を開始します。</div>
        </div>
        <div class="chips" id="analysisFlags"></div>
      </div>
      <div class="metric-row">
        <div class="metric"><div class="metric-label">Load</div><div class="metric-value" id="analysisLoad">-</div></div>
        <div class="metric"><div class="metric-label">AV</div><div class="metric-value" id="analysisAv">-</div></div>
        <div class="metric"><div class="metric-label">AV Drop</div><div class="metric-value" id="analysisAvDrop">-</div></div>
        <div class="metric"><div class="metric-label">ROM</div><div class="metric-value" id="analysisRom">-</div></div>
        <div class="metric"><div class="metric-label">ROM Drop</div><div class="metric-value" id="analysisRomDrop">-</div></div>
        <div class="metric"><div class="metric-label">VL_last</div><div class="metric-value" id="analysisVl">-</div></div>
        <div class="metric"><div class="metric-label">Peak HR</div><div class="metric-value" id="analysisHr">-</div></div>
      </div>
      <div class="split">
        <div>
          <h2>Same Load AV</h2>
          <div class="spark" id="avSpark"></div>
        </div>
        <div>
          <h2>Lift ROM</h2>
          <div class="spark" id="romSpark"></div>
        </div>
      </div>
    </section>
    <section class="card section">
      <h2>Recent Sets</h2>
      <table><thead><tr><th>set</th><th>lift</th><th>load</th><th>reps</th><th>AV</th><th>VL avg/last/min</th><th>ROM</th><th>HR</th><th>time</th></tr></thead><tbody id="setsBody"></tbody></table>
    </section>
    <section class="card section">
      <h2>Recent Reps</h2>
      <table><thead><tr><th>rep</th><th>lift</th><th>load</th><th>mean</th><th>peak</th><th>ROM</th><th>power</th><th>HR</th><th>time</th></tr></thead><tbody id="repsBody"></tbody></table>
    </section>
    <section class="card section">
      <h2>Timeline</h2>
      <table><thead><tr><th>received</th><th>type</th><th>lift</th><th>set</th><th>rep</th><th>load</th><th>summary</th></tr></thead><tbody id="timelineBody"></tbody></table>
    </section>
    <section class="card section">
      <h2>Latest Raw Event</h2>
      <pre id="raw">{}</pre>
    </section>
  </main>
  <script>
    const params = new URLSearchParams(location.search);
    const tokenParam = params.get("token");
    const defaults = ${JSON.stringify({
      avDropWatch: defaultThresholds.av_drop_watch_pct,
      avDropMajor: defaultThresholds.av_drop_major_pct,
      romDropWatch: defaultThresholds.rom_drop_watch_cm,
      romDropMajor: defaultThresholds.rom_drop_major_cm,
      vlWatch: defaultThresholds.vl_watch_pct,
      vlMajor: defaultThresholds.vl_major_pct,
      hrWatch: defaultThresholds.peak_hr_watch_bpm,
    })};
    const thresholdInputs = Array.from(document.querySelectorAll("[data-threshold]"));
    thresholdInputs.forEach((input) => {
      const key = input.dataset.threshold;
      input.value = localStorage.getItem("repveloLive_" + key) ?? String(defaults[key]);
      input.addEventListener("input", () => {
        localStorage.setItem("repveloLive_" + key, input.value);
        updateLinks();
        refresh();
      });
    });
    const makeQuery = () => {
      const query = new URLSearchParams();
      if (tokenParam) query.set("token", tokenParam);
      thresholdInputs.forEach((input) => {
        const value = Number.parseFloat(input.value);
        if (Number.isFinite(value)) query.set(input.dataset.threshold, String(value));
      });
      const text = query.toString();
      return text ? "?" + text : "";
    };
    const updateLinks = () => {
      const query = makeQuery();
      document.getElementById("packetLink").href = "/gpt-packet" + query;
      document.getElementById("csvLink").href = "/events.csv" + query;
    };
    updateLinks();
    const fmt = (value, digits = 2, suffix = "") => typeof value === "number" ? value.toFixed(digits) + suffix : "-";
    const vlAvg = (p) => typeof p.velocity_loss_avg === "number" ? p.velocity_loss_avg : p.velocity_loss;
    const vlLast = (p) => typeof p.velocity_loss_last === "number" ? p.velocity_loss_last : p.velocity_loss;
    const vlMin = (p) => typeof p.velocity_loss_min === "number" ? p.velocity_loss_min : vlLast(p);
    const fmtVlTriplet = (p) => fmt(vlAvg(p), 1) + " / " + fmt(vlLast(p), 1) + " / " + fmt(vlMin(p), 1) + "%";
    const clock = (value) => value ? new Date(value).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "-";
    const row = (cells) => "<tr>" + cells.map((cell) => "<td>" + String(cell ?? "-") + "</td>").join("") + "</tr>";
    const renderFlags = (flags) => flags.length > 0
      ? flags.map((flag) => '<span class="chip ' + flag.severity + '">' + flag.label + ': ' + flag.detail + '</span>').join("")
      : '<span class="chip">flagsなし</span>';
    const renderSpark = (events, key, className = "") => {
      const values = events.map((event) => event.payload?.[key]).filter((value) => typeof value === "number" && Number.isFinite(value));
      if (!values.length) return '<span class="muted">dataなし</span>';
      const max = Math.max(...values, 0.01);
      return values.map((value) => '<div class="bar ' + className + '" title="' + value.toFixed(2) + '" style="height:' + Math.max(5, Math.round((value / max) * 66)) + 'px"></div>').join("");
    };
    const freshnessText = (seconds) => {
      if (typeof seconds !== "number") return "-";
      if (seconds < 60) return seconds + "s ago";
      return Math.floor(seconds / 60) + "m " + (seconds % 60) + "s ago";
    };
    const eventSummary = (event) => {
      const p = event.payload || {};
      if (event.type === "set_completed") return "AV " + fmt(p.avg_velocity) + " / VL avg/last/min " + fmtVlTriplet(p) + " / ROM " + fmt(p.avg_rom_cm, 1, " cm");
      if (event.type === "rep_recorded") return "mean " + fmt(p.mean_velocity) + " / peak " + fmt(p.peak_velocity) + " / ROM " + fmt(p.rom_cm, 1, " cm");
      if (event.type === "form_video_saved") return "video " + (p.duration_s ?? "-") + "s";
      if (event.type === "session_started") return "session started";
      return "-";
    };
    async function refresh() {
      try {
        const response = await fetch("/events/recent" + makeQuery());
        if (!response.ok) throw new Error("HTTP " + response.status);
        const data = await response.json();
        const summary = data.summary;
        document.getElementById("status").textContent = "connected / " + new Date().toLocaleTimeString("ja-JP");
        document.getElementById("currentLift").textContent = summary.current_lift ?? "-";
        document.getElementById("sets").textContent = summary.set_count ?? 0;
        document.getElementById("reps").textContent = summary.rep_count ?? 0;
        document.getElementById("videos").textContent = summary.video_count ?? 0;
        const freshness = document.getElementById("freshness");
        freshness.textContent = freshnessText(summary.freshness_s);
        freshness.classList.toggle("stale", typeof summary.freshness_s === "number" && summary.freshness_s > 30);
        const analysis = summary.analysis || {};
        const analysisCard = document.getElementById("analysisCard");
        analysisCard.classList.remove("good", "watch", "major");
        analysisCard.classList.add(analysis.status || "watch");
        document.getElementById("analysisHeadline").textContent = analysis.headline ?? "-";
        document.getElementById("analysisRecommendation").textContent = analysis.recommendation ?? "-";
        document.getElementById("analysisFlags").innerHTML = renderFlags(analysis.flags || []);
        document.getElementById("analysisLoad").textContent = fmt(analysis.current_load_kg, 1, " kg");
        document.getElementById("analysisAv").textContent = fmt(analysis.av, 2, " m/s");
        document.getElementById("analysisAvDrop").textContent = fmt(analysis.av_drop_pct, 1, "%");
        document.getElementById("analysisRom").textContent = fmt(analysis.rom_cm, 1, " cm");
        document.getElementById("analysisRomDrop").textContent = fmt(analysis.rom_drop_cm, 1, " cm");
        document.getElementById("analysisVl").textContent = fmt(analysis.vl_pct, 1, "%");
        document.getElementById("analysisHr").textContent = analysis.peak_hr ? analysis.peak_hr + " bpm" : "-";
        document.getElementById("avSpark").innerHTML = renderSpark(analysis.same_load_sets || [], "avg_velocity");
        document.getElementById("romSpark").innerHTML = renderSpark(analysis.lift_sets || [], "avg_rom_cm", "rom");
        document.getElementById("setsBody").innerHTML = summary.recent_sets.map((event) => {
          const p = event.payload || {};
          return row([p.set_index, p.lift, fmt(p.load_kg, 1, " kg"), p.reps, fmt(p.avg_velocity), fmtVlTriplet(p), fmt(p.avg_rom_cm, 1, " cm"), p.peak_hr, clock(p.end_timestamp || event.created_at)]);
        }).join("") || row(["-", "-", "-", "-", "-", "-", "-", "-", "-"]);
        document.getElementById("repsBody").innerHTML = summary.recent_reps.map((event) => {
          const p = event.payload || {};
          return row([p.rep_index, p.lift, fmt(p.load_kg, 1, " kg"), fmt(p.mean_velocity), fmt(p.peak_velocity), fmt(p.rom_cm, 1, " cm"), fmt(p.mean_power_w, 0, " W"), p.hr_bpm, clock(p.timestamp || event.created_at)]);
        }).join("") || row(["-", "-", "-", "-", "-", "-", "-", "-", "-"]);
        document.getElementById("timelineBody").innerHTML = summary.recent_events.map((line) => {
          const event = line.event || {};
          const p = event.payload || {};
          return row([clock(line.received_at), event.type, p.lift || p.current_lift || "-", p.set_index, p.rep_index, fmt(p.load_kg || p.current_load_kg, 1, " kg"), eventSummary(event)]);
        }).join("") || row(["-", "-", "-", "-", "-", "-", "-"]);
        document.getElementById("raw").textContent = JSON.stringify(data.latest ?? {}, null, 2);
      } catch (error) {
        document.getElementById("status").textContent = "error / " + error.message;
      }
    }
    document.getElementById("copyPacket").addEventListener("click", async () => {
      const response = await fetch("/gpt-packet" + makeQuery());
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
        thresholds: defaultThresholds,
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
      const thresholds = withThresholdOverrides(url);
      sendJson(response, 200, {
        ok: true,
        output,
        latest: lines.at(-1) ?? null,
        summary: summarizeEvents(lines, thresholds),
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
      sendText(
        response,
        200,
        buildGptPacket(lines, withThresholdOverrides(url)),
        "text/markdown",
      );
      return;
    }

    if (request.method === "GET" && url.pathname === "/events.csv") {
      if (!isAuthorized(request, url)) {
        sendJson(response, 401, { ok: false, error: "unauthorized" });
        return;
      }
      const lines = await readRecentEvents(
        Number.parseInt(url.searchParams.get("limit") ?? "2000", 10),
      );
      response.writeHead(200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="repvelo-live-share-events.csv"',
      });
      response.end(buildEventsCsv(lines));
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
