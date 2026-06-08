# Training Supervisor Feedback Improvements 2026-06-05

## Context

User wants RepVeloCoach to work as a live training system that can send one-set summaries to a ChatGPT project acting as a powerlifting supervisor.

The supervisor workflow is:

1. User trains in RepVeloCoach.
2. After each set, RepVeloCoach prepares a compact packet for ChatGPT.
3. User asks the training supervisor whether to continue, reduce load, reduce sets, change exercise, or stop.
4. After the workout, RepVeloCoach exports a session JSON/report for Codex to archive into the Excel plan and adjust future training.

The latest real session that motivated this request was 2026-06-04. User reported adductor soreness and dieting. Output was low, especially bench 75-80 kg and deadlift 120 kg speed work. This should be treated as a readiness/fatigue detection use case, not only as a raw logging issue.

## Product Goals

- Make RepVeloCoach useful during the workout, not only after export.
- Reduce decision friction between sets.
- Detect fatigue/readiness problems from fixed warm-up velocity.
- Make ChatGPT/Codex handoff reliable and copy-friendly.
- Keep all AI-facing packets short, structured, and privacy-safe.

## Requested Improvements

### 1. One-Set Supervisor Packet

Add a button after each completed set:

- `Copy Supervisor Packet`
- optional later: `Open ChatGPT`

Packet format:

```text
Week-Day:
種目:
予定:
実施:
初速:
終速:
VL_avg:
VL_last:
RPE:
痛み:
疲労/睡眠/食事:
メモ:
```

Include JSON after the human-readable text:

```json
{
  "date": "YYYY-MM-DD",
  "session_id": "...",
  "week_day": "Week2-Day3",
  "lift": "Bench Press",
  "planned": {"load_kg": 82.5, "reps": 6, "sets": 3},
  "actual": {"load_kg": 75, "reps": 6, "set_index": 5},
  "velocity": {
    "first_rep_mps": 0.29,
    "last_rep_mps": 0.24,
    "avg_mps": 0.25,
    "vl_avg_pct": 13.8,
    "vl_last_pct": 27.6
  },
  "rpe": 8.5,
  "readiness": {
    "pain_area": "adductor",
    "pain_score": 3,
    "dieting": true,
    "sleep_note": null
  }
}
```

### 2. Fixed Observation Ladder Readiness Monitor

Detect and highlight fixed observation ladder velocities:

- SQ: 20 / 70 / 100 / 120 kg
- BP: 20 / 60 / 80 / 90 kg
- DL: 70 / 120 / 140 / 150 kg

Rules:

- Compare today vs recent rolling average at the same load.
- Compare the current ladder step against the previous step for unusual drops.
- If same-load velocity is down by 3% or more, show `Fatigue suspected`.
- If down by 5% or more, recommend skipping the upper observation step and reducing main load.
- If no recent baseline exists, collect data without warning.

Upper observation steps are conditional, not mandatory max attempts:

- BP 90 kg is only for days when BP 80 kg speed, ROM, and feel are acceptable.
- DL 150 kg is only for days when DL 140 kg speed, ROM, and feel are acceptable.
- If an upper step is skipped, this should be treated as correct fatigue management, not a failure.

### 3. VL10 Speed-Work Stop Alert

For speed rows:

- bench speed: 60-65 kg x 3
- squat speed: 90-100 kg x 2
- deadlift speed: 110-120 kg x 2

If VL exceeds 10%, show:

```text
Speed purpose complete. Stop this speed exercise or reduce the load.
```

The alert should use `velocity_loss_last` as the main safety signal, while keeping `velocity_loss_avg` visible.

### 4. Session Readiness Check

At session start, ask for:

- dieting: yes/no
- sleep quality: good/ok/bad
- pain area: none/adductor/back/shoulder/elbow/knee/other
- pain score: 0-10
- planned Week-Day

This data should be stored with the session and exported in Codex JSON.

### 5. Planned Menu Awareness

RepVeloCoach should know the planned Week-Day and planned sets, then show planned vs actual:

- planned exercise
- planned load/reps/sets
- actual load/reps/velocity/VL/RPE
- status: on plan / heavy today / fatigue suspected / stop

This can begin as a simple local JSON import or manually entered Week-Day mapping.

### 6. End-of-Session Supervisor Report

Add an export/share item:

```text
Training Supervisor Report
date:
week_day:
summary:
good:
bad:
fatigue:
pain:
VBT:
next adjustment:
developer notes:
```

This should be included in the existing Codex export or available as a separate copy/share action.

### 7. Fix Session Total Volume Inconsistency

The 2026-06-04 session contained 23 sets but the session object had:

- `total_volume: 0`
- `total_sets: 0`

This makes Codex analysis less reliable. Session totals should be recalculated from saved sets during export when stored session summary fields are zero or stale.

### 8. Crash and Diagnostics Handoff

Keep improving:

- crash report body sharing, not only Markdown attachment
- last safe screen marker
- VBT connection state
- recent live packets
- app version/build
- device/session context

The supervisor workflow depends on reliable post-crash recovery and reporting.

## Acceptance Criteria

- After a set, user can copy one short supervisor packet in two taps or less.
- Packet includes planned vs actual, velocity, VL avg/last, RPE, readiness, and pain info.
- Fixed observation ladder warning appears when velocity drops 3%+.
- Speed-work VL10 stop alert appears during speed work.
- End-of-session report can be shared to Codex/ChatGPT.
- Codex export includes readiness fields and corrected session totals.

## Priority

Critical for the live coaching workflow:

1. One-set supervisor packet.
2. Fixed observation ladder readiness monitor.
3. Session total recalculation in export.
4. Readiness check fields in export.
5. VL10 speed-work alert.

## Field Test Notes 2026-06-08

User ran Week2-Day1 accumulation session with Squat, Bench Press, Speed Bench Press, and T-bar row.

Training context:

- Previous-day sauna.
- User felt floating/unstable and less braced than usual.
- Perceived fatigue was stronger than heart-rate impression.

Useful coach behavior observed:

- Squat was correctly reduced from planned 122.5 kg x 5 x 5 to 122.5, 117.5, then 112.5 kg.
- Bench 82.5 kg x 5 produced high VL_last 38.5%, so switching to 75 kg back-off sets was correct.
- T-bar row produced an accessory PR: 45 kg x 11, estimated RM 61.5, compared with previous 45 kg x 9 / eRM 58.5.

New app issues found:

1. Manual-added Speed Bench Press existed in app history but was not included in the AI consultation packet.
2. AI consultation packet had `currentLoad` as 60 kg while `workingSets` ended at 75 kg bench sets.
3. This suggests `currentLoad/currentSet` and `workingSets/latestRep` may be read from different sources.
4. Accessory PRs need explicit display, especially eRM PR, same-load rep PR, and volume PR.
5. T-bar row ROM changed from previous 57 cm to 44 cm on the first current set, then 51-56 cm. This is likely sensor placement change rather than true ROM collapse.

Additional acceptance criteria:

- Manual-entry sets and manually added exercises appear in the same supervisor packet as sensor-recorded sets.
- Supervisor packet displays `currentLoad`, `latestSetLoad`, and `latestRepSource` for debugging.
- If those fields disagree, show an internal consistency warning before copying the packet.
- Accessory movements show PR badges for eRM, same-load reps, and total volume.
- ROM changes of 15% or more show `measurement position may have changed` instead of treating ROM alone as a performance drop.

Export evidence from `repvelocoach-codex-export-20260608T002009Z.json`:

- Main sensor session: `session_1780868095845_xh3hgvfls`.
- Session summary says `total_volume: 1032.5` and `total_sets: 4`.
- Recalculating from exported sets gives 19 sets and 5985 kg.
- Speed Bench Press appears as Bench Press 60 kg x 3 x 2 in sets 9 and 10.
- Speed Bench set 9: AV 0.480, VL_last 2.0%.
- Speed Bench set 10: AV 0.493, VL_last 0.0%.

This confirms the export/session-summary path must never trust stale session totals when set rows are available.

## Program Direction Change 2026-06-08

User changed the overall program direction because the previous plan felt too intense.

New program structure:

- Day 1: Squat main.
- Day 2: Bench Press main.
- Day 3: Deadlift main.
- Only one competition lift is the main lift of the day.
- Other competition lifts are light technique work, optional, or omitted.
- Main lift work should usually stay around RPE 6.5-7.5.
- Accessory movements may be used for PR attempts if pain and ROM consistency are acceptable.

RepVeloCoach should support this structure directly.

Needed program metadata:

```json
{
  "week": 2,
  "day": "Day 2",
  "main_lift": "BP",
  "day_role": "bench_main",
  "rows": [
    {
      "priority": "required",
      "block": "main",
      "lift": "Bench Press",
      "load_kg": 72.5,
      "reps": 5,
      "sets": 3,
      "target_rpe": 7,
      "vl_last_limit_pct": 15
    },
    {
      "priority": "optional",
      "block": "light_technique",
      "lift": "Squat",
      "load_kg": 92.5,
      "reps": 3,
      "sets": 2
    }
  ]
}
```

Fixed observation ladder metadata:

```json
{
  "fixed_observation_ladders": {
    "SQ": [
      {"load_kg": 20, "stage": "base", "required": true},
      {"load_kg": 70, "stage": "warm", "required": true},
      {"load_kg": 100, "stage": "submax", "required": true},
      {"load_kg": 120, "stage": "top_observe", "required": false}
    ],
    "BP": [
      {"load_kg": 20, "stage": "base", "required": true},
      {"load_kg": 60, "stage": "warm", "required": true},
      {"load_kg": 80, "stage": "submax", "required": true},
      {"load_kg": 90, "stage": "top_observe", "required": false}
    ],
    "DL": [
      {"load_kg": 70, "stage": "warm", "required": true},
      {"load_kg": 120, "stage": "readiness", "required": true},
      {"load_kg": 140, "stage": "submax", "required": false},
      {"load_kg": 150, "stage": "top_observe", "required": false}
    ]
  }
}
```

Ladder rules:

- The main lift of the day should show its ladder at session start.
- Required steps should be logged before main work when practical.
- Conditional upper steps should have a clear `skip upper step` button.
- Skipping BP 90 or DL 150 after a poor previous step is good fatigue management.
- Coach packets should include ladder step AV, ROM, RPE, same-load baseline change, and whether an upper step was skipped.

Coach packet requirements:

- Include `main_lift`.
- Include `day_role`.
- Include whether each planned row is `required` or `optional`.
- Include whether the current set belongs to the main lift or non-main technique work.
- If the main lift warm-up speed is down 3% or more, suggest reducing main load and cutting optional work.
- If down 5% or more, suggest switching the main lift to 60-70% technique work and skipping non-main competition lifts.

Example user-facing decision language:

```text
今日はBP主役の日です。SQは軽技術なので追わない。
BP75固定アップが遅ければ、BPメインは-5%して任意補助を切る。
```
