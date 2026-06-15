# Training Shared Context - 2026-06-12

This is the handoff brief for the training supervisor, Chappy coach, and RepVeloCoach app engineering session.

## Required Reading For App Agents

Every RepVeloCoach app engineering agent must check these files at the start of work and before finishing:

1. `/Users/hoshinohideyuki/Library/CloudStorage/GoogleDrive-autecouture@gmail.com/マイドライブ/RepVeloCoach_監督_チャッピー_アプリ共有コンテキスト.md`
2. `/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo/docs/TRAINING_SHARED_CONTEXT_2026-06-12.md`
3. `/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo/docs/IMPROVEMENT_TRACKER.md`

Do not conclude that there is no supervisor order unless these three files have been checked.

## Current Training Position

- User is at roughly Week3-Day3.
- Squat: 122.5 kg x 5 is established. Next squat-main day should use 125 kg x 5 x 3 as the base.
- Bench: 77.5 kg x 5 x 2 plus 75 kg x 5 is established. BP 90 kg observation improved to AV 0.230 on 2026-06-12. Next bench-main day should use 80 kg x 5 x 3 as the base.
- Deadlift: DL observation reached 150 kg x 1 at AV 0.28, then 130 kg x 4 x 3 was completed. Next deadlift-main day should use 132.5-135 kg x 4 x 3 as the base.

## Supervisor-Adopted V@1RM

Do not treat the app's stored `mvt` / `v1rm` as the only truth. The supervisor needs a separate user-specific value derived from historical OVR and RepVeloCoach measured reps.

Current supervisor-adopted values:

| Lift | app stored value | supervisor adopted V@1RM | evidence | operational note |
|---|---:|---:|---|---|
| Bench Press | 0.15 m/s | 0.12 m/s | Multiple successful 95-100 kg reps at 0.10-0.14 m/s; OVR also has 100 kg x1 at 0.13 m/s | Use 0.12 for true max estimation, but treat 0.15-0.17 as a training caution zone |
| Squat | 0.30 m/s | 0.27 m/s | 122.5 kg late reps at 0.30 m/s, 140 kg single at 0.34 m/s, regression to 150 kg suggests about 0.25 m/s | Use 0.27 for estimation; 0.30 remains a caution zone, not an automatic stop |
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
/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo/docs/repvelocoach_program_menu_current_20260615_main_plus_tempo.json

The fixture uses `schema=repvelocoach.program_menu.v4`; program rows are stored in the top-level `rows` array.
Populate `planned_session.today_rows` from the selected Week-Day, preserving `テンポ/停止`, `基本重量kg`, `上方分岐kg`, `分岐条件`, `現場判断ルール`, `チャッピーへ渡す意図`, `判定ルール`, and `次回増量`.
```

Latest menu workbook:

`/Users/hoshinohideyuki/Library/CloudStorage/GoogleDrive-autecouture@gmail.com/マイドライブ/BIG3_12週メニュー_通常メイン+テンポ補助_20260615.xlsx`

Latest menu JSON fixture:

`/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo/docs/repvelocoach_program_menu_current_20260615_main_plus_tempo.json`

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

## Menu Update - Normal Main Plus Tempo Assistance

The current menu was corrected on 2026-06-15. The previous tempo-only design accidentally removed the normal non-tempo main sets. That was wrong for the user's goal.

The current rule is: normal competition-style main sets are primary. Tempo/pause BIG3 work is assistance after the normal main work, not a replacement.

Use the v4 JSON fixture generated from the workbook above.

Key changes:

- Every main day has a normal non-tempo main set row.
- Tempo/pause rows are `テンポ補助`, usually 1-2 sets after the normal main.
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

- Use `repvelocoach_program_menu_current_20260615_main_plus_tempo.json`.
- Store active `week`, `day`, `main_lift`, `block/category`, `exercise`, `tempo_pause`, `load_kg`, `upper_branch_load`, `reps`, `sets`, `target_rpe`, `vl_cap`, `priority`, `status`, `decision_rule`, and `next_decision`.
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
   - Use `docs/repvelocoach_program_menu_current_20260615_main_plus_tempo.json` as the first local program fixture.
   - The readiness Week-Day picker should populate today's planned rows from this fixture.
   - Preserve tempo-specific fields: `テンポ/停止`, `判定ルール`, and `次回増量`.
   - Add copy guidance that tempo/pause BIG3 should be judged by tempo, pause position, ROM, RPE, and form quality before velocity/e1RM.
