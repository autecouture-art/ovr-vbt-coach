# Training Supervisor Implementation Report - 2026-06-10

## Summary

RepVeloCoach was updated for three user-reported issues:

1. Settings exercise editing categories did not match the categories shown during training exercise selection.
2. Manual entry needed a direct "consult Chappy supervisor" button.
3. A Gmail crash report suggested a crash risk around opening the form-video overlay while VBT was connected.

## Implemented

### 1. Exercise Category Alignment

- Settings now uses the same visible exercise selection groups as the training exercise picker:
  - Bench
  - Squat
  - Deadlift
  - Chest
  - Shoulders
  - Back
  - Quads
  - Posterior Chain
  - Adductors
  - Arms
  - Core
  - Other
- Internally, each visible group maps to a safe persisted exercise category.
- The exercise row now shows both the visible group and the internal category so the mapping is transparent.
- Unit coverage was added for the group/category mapping.

### 2. Manual Entry Supervisor Button

- Manual Entry now has a "チャッピー監督へ相談" button near the top.
- The button works from:
  - the current unsaved draft set, when load and reps are entered
  - the latest saved manual set, when no draft is available
- The copied packet includes:
  - exercise name and category
  - load, reps, set index, set type
  - RPE
  - AV
  - VL avg/last/min
  - ROM
  - e1RM
  - today's manual summary
  - recent same-lift set history
  - deterministic app preview when velocity data is present
  - JSON block for stable ChatGPT parsing
- After copying, the app attempts to open ChatGPT.

### 3. Form Video Crash Safety

- The latest Gmail crash report was reviewed.
- The reported context had:
  - `reason: form_video_overlay_open_attempt`
  - VBT connected
  - form video enabled
  - session active
- To prevent repeated crash loops, Session now disables form-video mode on the next screen load when the previous crash context was `form_video_overlay_open_attempt`.
- The user gets an alert explaining that form video was temporarily turned off and can be re-enabled manually from the Session screen.

## Validation

- `pnpm check`: passed
- `pnpm lint`: passed
- `pnpm test -- exerciseCatalog SessionDecisionService`: passed
- `git diff --check`: passed

## Notes For Supervisor

The manual-entry packet is intentionally short enough to paste during training but includes the key fields needed to reason about the next set. If velocity is missing, the packet asks the supervisor to rely on RPE, recent history, and notes rather than over-interpreting VBT fields.

The form-video safeguard does not remove the feature. It only prevents automatic reuse after a suspected overlay-open crash. The user can turn video back on from Session after confirming stability.
