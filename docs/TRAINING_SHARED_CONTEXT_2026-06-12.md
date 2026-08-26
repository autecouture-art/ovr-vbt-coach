# Training Shared Context - 2026-06-12

## Video and Improvement PDCA Contract - 2026-08-21

- Codex is the supervisor. ChatGPT is Chappy coach / the field-decision coach. Neither intake nor Chappy may modify the training plan automatically.
- Form video is manual prepare/manual start. The camera controller is the only owner of a native recording operation; BLE remains active by default. The legacy BLE-safe mode is a per-device compatibility fallback, not the normal path.
- The app records a `capture_id` and fixed `set_attempt_id` before/while recording. A video becomes `verified` only after its copied file's size and MD5 match. Video failure must never block saving VBT sets.
- A user-selected review share carries `repvelocoach.form-review.v1` metadata plus the selected clip through the iOS share sheet. No video body, local URI, token, thumbnail URI, or private URL is automatically sent to Personal MCP.
- `気づき` is stored locally first. With explicit settings consent, it is sent at session end or next launch. Mac absence/offline status keeps the local queue and must never block training.
- Personal MCP intake is append-only and read-only to ChatGPT. Codex triages accepted intake into `docs/IMPROVEMENT_TRACKER.md`; TestFlight distribution is not a verification result. The user's `解決` / `まだダメ` evaluation is the final PDCA gate.

This is the handoff brief for the training supervisor, Chappy coach, and RepVeloCoach app engineering session.

## Required Reading For App Agents

Every RepVeloCoach app engineering agent must check these files at the start of work and before finishing:

1. `/Users/hoshinohideyuki/Library/CloudStorage/GoogleDrive-autecouture@gmail.com/マイドライブ/RepVeloCoach_監督_チャッピー_アプリ共有コンテキスト.md`
2. `/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo/docs/TRAINING_SHARED_CONTEXT_2026-06-12.md`
3. `/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo/docs/IMPROVEMENT_TRACKER.md`

Do not conclude that there is no supervisor order unless these three files have been checked.

## Current Training Position

- Current executable plan: `2026-08-18-week12-v2`, checksum `fnv1a32:a1e1e9c7`, valid through 2026-08-23.
- Week12-Day1 result: Low Bar Squat 152.5 kg x1 succeeded at AV 0.24 and ROM 70.4 cm with pain 0. Manual RPE was not recorded, so AV/ROM are confirmed but RPE-based classification is unavailable.
- Week12-Day2: Bench Press 95 -> 102.5 -> 110/107.5 kg conditional attempts. Every ramp set must be marked warm-up and manual RPE is required before increasing. Squat recovery work is optional 70 kg x3 x1 only when pain and soreness are both <= 1/10.
- Week12-Day3: Sumo Deadlift 155 -> 165 -> 172.5/170 kg conditional attempts. Every ramp set must be marked warm-up and manual RPE is required before increasing.
- Google Sheet: `Week12_BIG3_PR挑戦_スマホ版_20260818_v2`; four tabs, five columns, no frozen rows or columns.

## Supervisor-Adopted V@1RM

Do not treat the app's stored `mvt` / `v1rm` as the only truth. The supervisor needs a separate user-specific value derived from historical OVR and RepVeloCoach measured reps.

Current supervisor-adopted values:

| Lift | app stored value | supervisor adopted V@1RM | evidence | operational note |
|---|---:|---:|---|---|
| Bench Press | 0.15 m/s | 0.12 m/s | Multiple successful 95-100 kg reps at 0.10-0.14 m/s; OVR also has 100 kg x1 at 0.13 m/s | Use 0.12 for true max estimation, but treat 0.15-0.17 as a training caution zone |
| Squat | 0.30 m/s | 0.24 m/s provisional | 2026-08-18 successful 152.5 kg x1 at AV 0.24 m/s and ROM 70.4 cm; earlier 140-150 kg singles were faster but not all were max-effort equivalents | Use 0.24 as the current measured V@1RM candidate; require future max/AMRAP terminal-rep samples before tightening the profile |
| Sumo Deadlift | 0.28 m/s | 0.18 m/s | RepVelo has 152.5 kg x1 at 0.20 m/s; OVR has 150 kg x1 at 0.23 and 165 kg x1 at 0.12; 2026-06-12 150 kg x1 was 0.28 | Use 0.18 for max estimation; below 0.20 means very heavy during training |

Required app behavior:

- Store/display both `app_mvt` and `supervisor_v1rm_velocity`.
- Let the supervisor/user override the adopted V@1RM per lift.
- Include both values in Chappy packets.
- Use `supervisor_v1rm_velocity` for e1RM / proximity-to-1RM estimates when present.
- Keep a separate `training_caution_velocity` so the app can warn before true grinder speed.

## Supervisor Order Text For App Engineer

```text
Supervisor order.

Before starting and before finishing, check:

1. /Users/hoshinohideyuki/Library/CloudStorage/GoogleDrive-autecouture@gmail.com/マイドライブ/RepVeloCoach_監督_チャッピー_アプリ共有コンテキスト.md
2. /Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo/docs/TRAINING_SHARED_CONTEXT_2026-06-12.md
3. /Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo/docs/IMPROVEMENT_TRACKER.md

Do not say there is no supervisor order unless those files have been read.

Main implementation order:

1. Separate app stored MVT from supervisor-adopted V@1RM.

Current supervisor-adopted V@1RM:
- Bench Press: 0.12 m/s
- Squat: 0.27 m/s
- Sumo Deadlift: 0.18 m/s

Required fields:
- app_mvt
- app_v1rm_velocity
- supervisor_v1rm_velocity
- training_caution_velocity

Use supervisor_v1rm_velocity for e1RM / 1RM proximity estimates when available.
Use training_caution_velocity for in-session warnings before true grinder speed.

2. Upgrade Chappy packets to One-Set Supervisor Packet v4.

Required packet fields:
- latest_set
- session_context
- planned_session
- ladder_progress
- recent_3week_strength
- today_completed_sets
- accessory_rm_target
- app_mvt
- supervisor_v1rm_velocity
- training_caution_velocity

Add this Japanese instruction to copied text:
直近1セットだけで大きく下方修正しないでください。アップ/固定観察中は、予定メニュー、ラダー進行、直近3週間の現在地を見て、次の観察段へ進むか、上限段を省略するか、メインへ入るかを判断してください。

3. Manual Entry data is included in Codex export.

The 2026-06-12 export includes 74 manual sets and 614 manual reps.
Manual Entry packets must also use v4.
Because manual entries often lack velocity/VL/ROM, include RPE, e1RM, recent same-lift history, planned menu context, and supervisor_v1rm_velocity.

4. Accessory RM target.

Each accessory movement may have one set-max attempt by estimated RM.
Add:
- accessory_rm_target=true
- e1RM PR
- same-load rep PR
- same-load volume PR

Stop accessory PR attempts if RPE >= 9.5, pain appears, ROM changes 15%+, or the main lift would be compromised.

5. Program menu.

Use this fixture first:
/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo/docs/repvelocoach_program_menu_current_20260623_fullbody_main_plus_tempo.json

The fixture uses `schema=repvelocoach.program_menu.v7`; program rows are stored in the top-level `rows` array.
Populate `planned_session.today_rows` from the selected Week-Day, preserving `テンポ/停止`, `基本重量kg`, `上方分岐kg`, `分岐条件`, `現場判断ルール`, `チャッピーへ渡す意図`, `判定ルール`, and `次回増量`.
```

Latest menu workbook:

`/Users/hoshinohideyuki/Library/CloudStorage/GoogleDrive-autecouture@gmail.com/マイドライブ/BIG3_12週メニュー_全身法_通常メイン+テンポ補助_実績反映_20260623.xlsx`

Latest menu JSON fixture:

`/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo/docs/repvelocoach_program_menu_current_20260623_fullbody_main_plus_tempo.json`

Shared user-facing context:

`/Users/hoshinohideyuki/Library/CloudStorage/GoogleDrive-autecouture@gmail.com/マイドライブ/RepVeloCoach_監督_チャッピー_アプリ共有コンテキスト.md`

## Field Session Update - 2026-06-15 Week4-D1

- Conditions: no gear, no VBT device, RPE-only management, rack wait caused Bench Press before Squat.
- Main lift: Squat.
- Bench before Squat: Bench Press 80 kg x3 @RPE6 and Larsen 4-2-0 Tempo Bench 60 kg x5 @RPE6. Acceptable as light technique.
- Squat: 20 x5, 70 x3, 100 x1, skipped 120 kg observation, then 95 x3 @RPE7, 95 x3 @RPE6, 100 x3 @RPE7.
- Supervisor judgment: successful RPE-managed session. Skipping SQ120 was correct. The normal Squat main target 125 kg x5 x3 was not completed, so the next Squat day should retry the normal main target if readiness is good. Tempo Squat is assistance after the normal main, not the replacement.
- Accessory warning: T-bar row 50 kg x12 @RPE9.5/e1RM70.8 PR, then several shoulder/arm accessories at RPE9-10. Next Bench day should check shoulder/elbow/back fatigue and cap accessories around RPE7.
- App implications: add no-gear flag, no-VBT mode, order-changed reason, accessory RPE9+ fatigue guard, and session closeout pain/mood/fatigue taps.

## Field Session Update - 2026-06-17 Week4-D2

- Main lift: Bench Press.
- Bench readiness: 20 kg x4 AV0.975, 60 kg x3 AV0.477, 80 kg x3 AV0.323, 90 kg x1 AV0.24.
- Bench main: 82.5 kg x5 x3, AV 0.286 / 0.280 / 0.274, max VL_last 17.2, ROM stable around 26 cm.
- Supervisor judgment: Bench Green. Next Bench main candidate is 85 kg x4 x3; if fatigue is present, repeat 82.5 kg x5 x3.
- Tempo assistance: Tempo Bench 65 kg x3 x2 was good after the normal main work.
- Full-body note: Pec Fly, Reverse Pec Deck, Landmine Shoulder Press, and SSB Bulgarian Squat were included. This supports the user's full-body preference, but SSB Bulgarian volume was high at 4 sets; cap it at 2 sets next time.
- Next Day3: Deadlift main. If legs are sore from Bulgarian Squat, reduce to 132.5 kg x4 x2 and keep Paused DL to 1 set. Bench should be light technique only; chest/shoulder accessories should be light.

## Field Session Update - 2026-06-19 Week4-D3

- Main lift: Sumo Deadlift.
- Readiness ladder: 120 kg x2 AV0.505, 150 kg x1 AV0.28. Readiness was good.
- Deadlift main: 135 kg x4 AV0.373, 135 kg x4 AV0.313, then 125 kg x4 AV0.45. The user worked above the planned 132.5 kg target for two sets and adjusted the third set down.
- Supervisor judgment: Deadlift Green-Yellow. Next Deadlift main target is 135 kg x4 x3; if fatigue is present, use 135 kg x4 x2.
- Paused DL: 105 kg x2 x2, good.
- Light Bench: 60 kg x3 x3, AV0.463 / 0.497 / 0.503, good full-body light technique.
- Accessory warning: Lat pull down mag narrow 63.6 kg x10 @RPE9 and Cable Pressdown 43.75 kg x5 @RPE9.5. Next Squat day should cap upper-back/arm accessories around RPE7-8.

## Field Session Update - 2026-06-23 Week5-D1

- Main lift: Low Bar Squat.
- Bench light technique before Squat was good: 90 kg x1 AV0.23 and 80 kg x3 x2 after it.
- Squat main: 125 kg x4 AV0.35/VL18.4, 115 kg x5 AV0.406/VL13.6, 110 kg x5 AV0.446/VL32.7.
- Supervisor judgment: Squat Yellow. Intensity is good, but the planned 125 kg x5 x3 was not achieved. The 110 kg set's VL32.7 is a fatigue sign.
- Next Squat target: 125 kg x4 x3 or 122.5 kg x5 x3. Do not advance to 125 kg x5 x3 yet.
- Accessory warning: T-Bar Row 52.5 kg x12/e1RM73.5 was strong but VL35.1; Cable Upright Row 40 kg x12 @RPE10 is too aggressive before the next Bench day.
- Next Bench day: 85 kg x4 x3 only if shoulders/back feel fresh; otherwise repeat 82.5 kg x5 x3. Cap accessories around RPE7.

## Problem Found In Field Use

The current one-set supervisor packet is too latest-set centered. During warmups or fixed observation ladder sets, Chappy may overreact to a single light or transitional set and recommend reducing the main work too aggressively.

The one-set packet should not be only a one-set packet. It must be a compact decision packet with enough session context for warmup-to-main decisions.

## Required Packet v4 Fields

Add these fields to both Session one-set supervisor packets and Manual Entry supervisor packets where possible:

```json
{
  "packet_version": "one_set_supervisor_v4",
  "latest_set": {},
  "session_context": {
    "week_day": "Week4-Day1",
    "main_lift": "SQ",
    "day_role": "main",
    "dieting": true,
    "sleep_quality": "ok",
    "pain_area": "none",
    "pain_score": 0
  },
  "planned_session": {
    "source": "current_menu_20260612",
    "today_rows": []
  },
  "ladder_progress": {
    "lift": "BP",
    "steps": [
      {"load_kg": 20, "status": "done", "avg_velocity": 0.99},
      {"load_kg": 60, "status": "done", "avg_velocity": 0.49},
      {"load_kg": 80, "status": "done", "avg_velocity": 0.32},
      {"load_kg": 90, "status": "pending_or_optional"}
    ],
    "is_warmup_or_ladder": true,
    "upper_step_optional": true
  },
  "recent_3week_strength": {
    "sq": "122.5x5 established; next base 125x5x3",
    "bp": "77.5x5x2 established; next base 80x5x3",
    "dl": "130x4x3 established; next base 132.5-135x4x3"
  },
  "today_completed_sets": [],
  "accessory_rm_target": {
    "enabled": true,
    "rule": "one e1RM set-max attempt per accessory movement, RPE 8-9, stop before it affects the main lift"
  }
}
```

## Coach Instruction Embedded In Packet

Add a short instruction line to copied text:

> Do not make a large main-work reduction from the latest set alone unless there is sharp pain, dizziness, clear form breakdown, or a severe velocity/ROM collapse. During warmups and fixed observation ladder work, judge whether to continue the ladder, skip the optional upper step, or start the planned main work by using the full session context.

Japanese app copy:

> 直近1セットだけで大きく下方修正しないでください。アップ/固定観察中は、予定メニュー、ラダー進行、直近3週間の現在地を見て、次の観察段へ進むか、上限段を省略するか、メインへ入るかを判断してください。

## Accessory PR Requirement

User wants accessory movements to include one set-max attempt by estimated RM each time.

Implementation expectation:

- Mark one set per accessory movement as `accessory_rm_target: true`.
- Show whether the set is an e1RM PR, same-load rep PR, or same-load volume PR.
- If RPE >= 9.5, pain appears, ROM changes 15%+, or the main lift would be compromised, stop accessory PR attempts for the day.

## Menu Import Need

The app still needs a simple way to ingest or reference the current menu. The current workaround is to include a compact current-menu snapshot in the packet. Longer term, implement a program import shape based on the workbook sheet `チャッピー渡し用メニュー`.

### 2026-07-23 v8 Source-of-Truth Update

- The executable menu source is now the applied `repvelocoach.program_menu.v8` JSON package, not shared Markdown text or compiled Week constants.
- RepVeloCoach resolves the current Week-Day and exercise against the applied v8 row and passes that same row into the actual next-set decision, consultation packet, and Codex export.
- If no applied v8 row exists for the current exercise, the app may fall back to existing calculations, but the candidate source must be explicit (`fallback_*`).
- v7 fixture migration is retained only as local compatibility and packaging input. The published Personal MCP file is validated v8 only.
- `valid_until` is preferred for stale handling. Without it, the fallback is week-safe rather than 72 hours.
- Rollback swaps applied and previous versions so A/B rollback works in both directions.
- MCP validates checksum before serving and does not mutate returned plan content after validation. Unknown or secret-like fields are rejected at publish/validation time.
- Chappy Coach must read `get_current_supervisor_plan`, keep `plan_id/version/row_id` in answers, and stay inside allowed branches. Codex remains the supervisor.

## Menu Update - Normal Main Plus Tempo Assistance

The current menu was corrected on 2026-06-15. The previous tempo-only design accidentally removed the normal non-tempo main sets. That was wrong for the user's goal.

The current rule is: normal competition-style main sets are primary. Tempo/pause BIG3 work is assistance after the normal main work, not a replacement.

Use the v4 JSON fixture generated from the workbook above.

Key changes:

- Every main day has a normal non-tempo main set row.
- Tempo/pause rows are `テンポ補助`, usually 1-2 sets after the normal main.
- From 2026-06-17, the program is biased toward full-body training. Rows include `全身法役割` so the app and Chappy can distinguish main lift, secondary/light technique, upper pull, unilateral lower, and small trunk/arm work.
- If the normal main exceeds RPE 7.5, pain appears, or time is short, skip tempo assistance first.
- Week7 is a lighter week.
- Week8 is a normal BIG3 heavy observation week, not a max-out week.
- Tempo/pause movements are evaluated by tempo, pause position, ROM, RPE, and form quality, but progression is governed primarily by the normal main lift.

Main plus tempo bases:

| Week | Squat Day | Bench Day | Deadlift Day |
|---:|---|---|---|
| 4 | D1 done: SQ 100x3 RPE7, normal 125x5x3 not done | BP 80x5x3 + Tempo BP 65x3x2 | DL 132.5x4x3 + Paused DL 105x2x2 |
| 5 | SQ 125x5x3 + Tempo SQ 90x3x2 | BP 82.5x4x3 + Tempo BP 67.5x3x2 | DL 135x4x3 + Paused DL 107.5x2x2 |
| 6 | SQ 127.5x4x3 + Tempo SQ 92.5x3x2 | BP 82.5x5x2 + Tempo BP 70x3x2 | DL 137.5x3x3 + Paused DL 110x2x2 |
| 7 | lighter SQ 120x3x2 + Tempo SQ 80x3x1 | lighter BP 77.5x3x2 + Tempo BP 60x3x1 | lighter DL 125x2x2 + Paused DL 95x2x1 |
| 8 | SQ 130-135x1 observation | BP 90-95x1 observation | DL 150-155x1 observation |

Green/yellow/red rules:

- Green: normal main is RPE <= 7.5, ROM/form stable, no pain, and tempo assistance does not degrade the main lift. Next normal main +2.5 kg where planned.
- Yellow: normal main RPE around 8 or form/ROM slightly fades. Repeat the same normal main weight and reduce/skip tempo assistance.
- Red: pain, form break, RPE >= 8.5, or major fatigue. Reduce normal main by 2.5-5 kg and skip tempo assistance.

Suggested first implementation:

- Use `repvelocoach_program_menu_current_20260623_fullbody_main_plus_tempo.json`.
- Store active `week`, `day`, `main_lift`, `block/category`, `full_body_role`, `exercise`, `tempo_pause`, `load_kg`, `upper_branch_load`, `reps`, `sets`, `target_rpe`, `vl_cap`, `priority`, `status`, `decision_rule`, and `next_decision`.
- Session readiness Week-Day selection should use this to populate `planned_session.today_rows`.
- Chappy packet copy must explicitly say: normal main sets are primary. Tempo/pause work is assistance and should be skipped before reducing the main plan when fatigue or time is the issue.

## Order For Session `019dfa46-0518-7d11-a55f-f71886f03b34`

1. Simulator retry status:
   - `pnpm ios -- --device "iPhone 17 Pro"` failed because Expo picked the stale `OVRVBTCoach` scheme.
   - `pnpm exec expo run:ios --scheme RepVeloCoach --device "iPhone 17 Pro"` later built and launched successfully.
   - Supervisor confirmed the RepVeloCoach home screen in Simulator: OFFLINE status, SCAN DEVICES, Training Modules, and Manual Logging card are visible.
   - Fix the default iOS launch path so it does not select stale `OVRVBTCoach`.
2. Implement One-Set Supervisor Packet v4:
   - Include `latest_set`, `session_context`, `planned_session`, `ladder_progress`, `recent_3week_strength`, `today_completed_sets`, and `accessory_rm_target`.
   - Add the Japanese copy warning Chappy not to down-adjust from a warmup/ladder set alone.
3. Align Manual Entry supervisor packet with v4:
   - The Codex export already includes manual data. In the 2026-06-12 export there are 74 manual sets and 614 manual reps.
   - Manual entries often lack velocity/VL/ROM, so the packet must emphasize RPE, e1RM, recent same-lift history, and planned menu context.
4. Accessory RM set target:
   - Add `accessory_rm_target=true` for one set per accessory movement.
   - Show e1RM PR / same-load rep PR / same-load volume PR.
5. Program fixture:
   - Use `docs/repvelocoach_program_menu_current_20260623_fullbody_main_plus_tempo.json` as the first local program fixture.
   - The readiness Week-Day picker should populate today's planned rows from this fixture.
   - Preserve tempo-specific fields: `テンポ/停止`, `判定ルール`, and `次回増量`.
   - Add copy guidance that tempo/pause BIG3 should be judged by tempo, pause position, ROM, RPE, and form quality before velocity/e1RM.

## 2026-07-29 Chappy Termination And Mode Flow Update

- Chappy Coach / 現場判断コーチ must distinguish exercise termination from session termination.
- Session packet fields now include `session_termination_level`, `exercise_termination_code`, planned rows completed/remaining, JST same-day total sets, accessory sets after main, latest pain/RPE/HR/VL, and a `chappy_consultation_history_id`.
- Termination labels:
  - `主役終了・軽補助可`: BIG3 main is done; light full-body assistance is allowed only if Green, pain 0, RPE/VL under caps, at least 15 minutes remain, and total fatigue is not high.
  - `予定補助まで可`: only remaining supervisor-planned assistance is allowed; no extra movements.
  - `セッション完全終了`: no load/reps/additional movement suggestions after this point.
- VBT and Manual Entry sets must be treated as one JST training day for total fatigue and accessory limits.
- Copied Chappy packets are recorded as `#AI_CONSULTATION_JSON` session-note markers so Codex export can include `ai_consultations` even before the final adopted/rejected decision is filled.
- Home flow should prioritize: 今日のトレーニング開始, 結果を入力, チャッピーコーチに相談, 進捗を見る, 監督メニュー.
