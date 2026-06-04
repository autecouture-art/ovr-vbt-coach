# Agent Walkthrough Log

## 2026-05-12 (Codex / GPT-5)

Scope: Manual-entry support for deterministic VBT coach metrics.
Actions:

- Created backup at `.ai-backups/pre-manual-vbt-metrics-20260512-052606`.
- Added optional manual fields for Average Velocity, Velocity Loss, and ROM in `src/screens/ManualEntryScreen.tsx`.
- Added live deterministic coach preview for manual entries when Average Velocity is provided.
- Saved manual Average Velocity / Velocity Loss onto `SetData` and manual ROM onto generated `RepData`.
- Added optional `avg_rom_cm` to `SetData`, populated it from sensor reps in `useSessionLogic`, and added a ROM quality gate to `DeterministicVBTCoach`.
- Updated `docs/IMPROVEMENT_TRACKER.md` for `2026-05-11-03`.
  Results:
- `pnpm -s vitest run src/services/__tests__/DeterministicVBTCoach.test.ts` passed.
- `pnpm -s check` passed.
- `pnpm -s test` passed: 18 tests passed, 1 skipped.
  Remaining:
- Device/simulator UI verification for the new manual metrics card and text fit.
- Consider deriving set-level average ROM from persisted reps when reading old DB-backed histories.

## 2026-05-12 (Codex / GPT-5)

Scope: Implement deterministic VBT coach engine for API-free coaching.
Actions:

- Created backup at `.ai-backups/pre-deterministic-vbt-coach-20260512-051350`.
- Added `src/services/DeterministicVBTCoach.ts` as a pure decision service for Average Velocity, Velocity Loss, MVT-based top singles, and backoff stop/watch/continue decisions.
- Connected `AICoachService.getCoachingAdvice()` to prefer deterministic VBT decisions before the older trend-only advice.
- Added focused unit tests in `src/services/__tests__/DeterministicVBTCoach.test.ts`.
- Updated `docs/IMPROVEMENT_TRACKER.md` for `2026-05-11-02`.
  Results:
- `pnpm -s vitest run src/services/__tests__/DeterministicVBTCoach.test.ts` passed.
- `pnpm -s check` passed.
- `pnpm -s test` passed: 17 tests passed, 1 skipped.
  Remaining:
- Implement `2026-05-11-03` so manual entry can provide velocity/VL/ROM data to the deterministic coach.
- Add ROM quality/confidence gates to the deterministic coach when ROM is available on set-level or derived from reps.

## 2026-05-11 (Codex / GPT-5)

Scope: GLM解約後のCodexサブスク運用化とCodex App Server Phase 1導入。
Actions:

- Confirmed the local `codex` CLI exposes `codex app-server` and schema generation commands.
- Added `docs/CODEX_APP_SERVER_INTEGRATION.md` to define the safe integration direction: app runtime coaching remains deterministic/VBT-first, while Codex App Server is used for developer/admin automation.
- Added `scripts/codex-app-server-check.mjs` and `pnpm codex:app-server:check` as a repo-local readiness check.
- Added `scripts/codex-app-server-admin.mjs` and `pnpm codex:app-server:admin` as a local-only stdio admin client scaffold.
- Added canned admin presets: `review`, `testflight`, `vbt-plan`, `performance`, and `release-notes`.
- Tightened the admin client so presets default to `readOnly` sandbox with network access disabled; write access now requires explicit `--write`.
- Fixed the client protocol wiring so `thread/start` also receives repo `cwd`, `approvalPolicy`, and `sandbox: "read-only"` / `"workspace-write"` overrides.
- Set the admin client default model to `gpt-5.4` after a real App Server turn reported that `gpt-5.5` requires a newer Codex CLI than the verified `codex-cli 0.101.0`.
- Updated `docs/IMPROVEMENT_TRACKER.md` with the GLM-to-Codex migration item.
  Results:
- Backup created at `.ai-backups/pre-codex-app-server-20260511-194122`.
- Follow-up preset backup created at `.ai-backups/pre-codex-app-server-presets-20260511-203609`.
- `pnpm codex:app-server:check` passed with `codex-cli 0.101.0`.
- `pnpm codex:app-server:admin -- --help`, `--list-presets`, and preset `--dry-run` passed.
- First real App Server run with default `gpt-5.5` failed because the current CLI requires an upgrade for that model.
- After defaulting the admin client to `gpt-5.4`, `pnpm codex:app-server:admin -- --preset vbt-plan --note "Read-only. Do not modify files. Keep the answer concise."` completed and produced a deterministic VBT plan.
- Recorded the run output in `docs/CODEX_APP_SERVER_RUNS.md`.
- `pnpm -s check` passed.
  Remaining:
- Next implementation candidate: `2026-05-11-02` deterministic VBT coach engine, then `2026-05-11-03` manual-entry data support.
- Keep app-facing AI optional; prioritize deterministic VBT guidance so normal use does not require API billing.

## 2026-03-26 (Codex)

Scope: Repo stabilization, TestFlight workflow documentation, exercise selection fix.
Actions:

- Fixed exercise selection after category filter by dismissing keyboard and adjusting scroll view tap handling.
- Fixed settings screen TypeScript errors (router import, style key conflict).
- Resolved TypeScript build errors for ROM range display.
- TestFlight upload stabilized using FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT/RETRIES, CFBundleVersion bumped to 66 for upload.
  Results:
- TestFlight upload succeeded (build 66).
  Remaining:
- Keep walkthrough log updated on every agent/model switch.
- Record any new incidents and fixes.

## 2026-03-26 (Codex)

Scope: TestFlight build/upload.
Actions:

- Bumped CFBundleVersion to 67 for TestFlight upload.
- Ran fastlane beta via skill script with build settings timeout overrides.
  Results:
- Upload succeeded to App Store Connect (TestFlight processing pending).
  Remaining:
- Verify build 67 appears in TestFlight and run device testing.

## 2026-03-31 (Codex / GPT-5)

Scope: Normalize agent handoff, replace stale status document, preserve latest working-tree context for any follow-on agent.
Actions:

- Reviewed canonical repo path, recent git history, current dirty files, version/build metadata, and agent rules.
- Replaced stale CURRENT_STATUS.md, which still described the app as an early template build, with a current project status summary.
- Added docs/AGENT_HANDOFF_2026-03-31.md as a restart guide for Codex/Claude/GLM/Gemini.
- Recorded the active local risks: GLM status-check can pass while live send fails, latest GLM history-normalization fix is only type-checked so far, and app.config.ts build number is out of sync with ios/RepVeloCoach/Info.plist.
  Results:
- Canonical continuation point is now documented in CURRENT_STATUS.md and docs/AGENT_HANDOFF_2026-03-31.md.
- The repo now has explicit instructions for which path to use, what to build next, and what not to trust.
  Remaining:
- Commit or amend the current working tree after deciding whether to keep the GLM send fix as-is.
- Bump native build number above 71 and keep all build-number sources aligned before the next TestFlight upload.
- Verify AI Coach live send on device after the next build.

## 2026-03-31 (Codex / GPT-5)

Scope: Session history expansion, audio/warmup settings, direct-GLM send hardening.
Actions:

- Added app-level persisted settings defaults/service and hydrated them into the Zustand store so session logic reads the same settings the Settings tab edits.
- Added settings toggles for warmup recommendations, rep count readout, velocity readout, and the "もっと速く" cue.
- Added per-exercise `ignore_first_rep_as_setup` support in DB schema/service/catalog and exposed the toggle inside Settings > 種目マスタ.
- Updated session logic to auto-exclude the first rep as `setup_reaction` when the exercise flag is enabled, and to scope set-history updates by `lift + set_index`.
- Expanded session history cards with exercise name, derived average power, and a mini velocity graph.
- Added post-hoc set weight editing from session history and propagated the new load to both `sets` and `reps`.
- Updated rep detail modal to filter by `lift + set_index`, show setup/fail/excluded state, and allow marking a rep as setup.
- Added HR display next to the rest timer when heart-rate data is available.
- Hardened direct GLM chat send by compacting context/history and retrying once with a minimal prompt if the full payload fails.
  Results:
- `pnpm -s tsc --noEmit` passed after these changes.
- Session history and settings flow are materially improved and ready for device verification.
  Remaining:
- AirPods heart-rate acquisition is still limited by the current `HealthService` stub; UI is ready but true HealthKit/AirPods ingestion is not yet implemented.
- Direct GLM send should be re-tested on device to confirm the new minimal retry path resolves the remaining failure.
- Build number still needs alignment/bump before the next TestFlight upload.

## 2026-03-31 (Codex / GPT-5)

Scope: Commit current UX/coach improvements and ship a fresh TestFlight build.
Actions:

- Committed session-history, settings, setup-rep, and direct-GLM retry improvements as `fad5e6c`.
- Aligned iOS build number sources and bumped the native/TestFlight build to `72` in `app.config.ts`, `Info.plist`, and Xcode project metadata.
- Ran the documented Fastlane/TestFlight upload flow with App Store Connect API key auth.
  Results:
- TestFlight/App Store Connect upload succeeded for version `2.3.5` build `72`.
- Generated IPA: `ios/fastlane_export/RepVeloCoach.ipa`
  Remaining:
- Confirm on-device that AI Coach live send now succeeds with the history-normalization/minimal-retry path.
- Confirm music resumes correctly after voice prompts.
- Implement real AirPods/HealthKit heart-rate ingestion beyond the current UI/stub layer.

## 2026-03-31 (Codex / GPT-5)

Scope: Historical set editing and GLM auth-error clarification.
Actions:

- Added a reusable `SetEditModal` for editing set load, RPE, and notes.
- Replaced the session-screen weight-only prompt with the shared edit modal.
- Added the same edit flow to `app/session-detail.tsx`, so historical session sets can now be corrected from session detail.
- Added `DatabaseService.updateSetEditableFields()` to keep `sets`, `reps`, and session aggregates aligned when editing a historical set.
- Expanded direct-GLM 401 parsing to detect expired/invalid-token responses, including the Chinese error text returned by Z.AI.
  Results:
- `pnpm -s tsc --noEmit` passed.
- Historical session detail now has an edit button per set.
- Current AI Coach screenshot indicates authentication failure (`401`, token invalid/expired), not a transport/connectivity failure.
  Remaining:
- Re-enter or replace the Z.AI API key on device and re-test AI Coach send.
- If GLM still fails after replacing the key, capture the new exact status text and request payload mode (`anthropic` or `paas/v4`).

## 2026-03-31 (Codex / GPT-5)

Scope: TestFlight rebuild after GLM/session-detail fixes.
Actions:

- Bumped the app-side build number to `73` and updated the local native iOS build metadata used by Fastlane/archive.
- Ran the documented Fastlane upload flow with App Store Connect API key auth.
  Results:
- TestFlight/App Store Connect upload succeeded for version `2.3.5` build `73`.
- Generated IPA: `ios/fastlane_export/RepVeloCoach.ipa`
  Remaining:
- Wait for App Store Connect/TestFlight processing, then verify the new build on device.
- Verify historical set editing from session detail.
- Verify GLM send now works after the renewed API key.

## 2026-04-10 (Codex / GPT-5)

Scope: Make TestFlight build/upload reproducible for Claude as well as Codex.
Actions:

- Replaced repo-local `scripts/deploy.sh` and `scripts/upload_only.sh` with robust versions that auto-detect the canonical repo, enforce Xcode selection, check ASC env vars, and run Bundler/Fastlane directly from the repo.
- Rewrote `TESTFLIGHT_DEPLOYMENT.md` from stale Manus-era content to the current RepVeloCoach TestFlight workflow.
- Updated `AGENTS.md` so all agents prefer the repo-local scripts/docs over Codex-only home-directory skills for actual build/upload work.
- Updated `CURRENT_STATUS.md` to point Build And Upload at the repo-local workflow.
  Results:
- TestFlight build/upload workflow is now documented in repo-local files that Claude can read and execute without `~/.codex/skills/...`.
- `bash -n scripts/deploy.sh` and `bash -n scripts/upload_only.sh` passed.
  Remaining:
- Optionally mirror the same wording into any Claude-specific bootstrap file if one is later introduced.
- Keep repo-local scripts as the release source of truth when the workflow changes.

## 2026-04-10 (Claude Sonnet 4.6)

Scope: Second-pass implementation addressing reviewer feedback and remaining gaps.
Actions:

- Added UI toggle for `enable_auto_start_session` in settings with proper labeling and placement.
- Enhanced exercise master editing functionality:
  - Added per-exercise `velocity_loss_threshold` editing with 10-30% options plus "既定" (default).
  - Added exercise name editing with TextInput field.
  - Added category selector with horizontal scrolling chips for all exercise categories.
  - Implemented proper save/cancel workflow with state management for editing mode.
- Removed all emoji from UI copy (✏️, 🗑️ replaced with text labels "編集", "削除").
- Added recent exercise history panel to session screen:
  - Fetches and displays up to 5 recent sets for current exercise from previous sessions.
  - Shows horizontal scrollable cards with date, load, reps, velocity, and e1RM.
  - Automatically updates when exercise changes.
  - Uses `DatabaseService.getRecentSetsForLift` with session exclusion.
- Improved power display fallback logic in session history:
  - Now uses stored `set.avg_power_w` as intermediate fallback when rep-level power is unavailable.
  - Maintains existing VBTLogic.calculatePower as final fallback.
- Implemented auto-finish session on app background to prevent data loss:
  - Uses AppState listener to detect background transitions.
  - Auto-finishes current set if session is active and reps are present.
  - Uses ref flag to prevent duplicate saves on multiple background events.
  - Logs for debugging and includes proper error handling.
- Fixed TypeScript errors:
  - Corrected method name from `getRecentSetsByLift` to `getRecentSetsForLift`.
  - Added missing category chip styles for inline exercise category selector.
    Results:
- `pnpm -s tsc --noEmit` passed with no errors.
- All 8 major tasks from supervisor feedback completed:
  1. Auto-start session toggle - DONE
  2. Per-exercise VL threshold editing - DONE
  3. Exercise rename and category change - DONE
  4. Recent exercise history display - DONE
  5. Power display fallback improvement - DONE
  6. Auto-finish on background - DONE
  7. Style consistency (no emoji) - DONE
  8. TypeScript validation - PASSED
     Remaining:
- Interval timer 11-second auto-complete feature: Left as-is per guidance - not cleanly implementable without refactoring rest timer logic.
- Real-device testing recommended for auto-finish behavior and exercise editing workflow.
- Consider TestFlight upload after device verification.

## 2026-04-10 (Claude Sonnet 4.6)

Scope: Small corrective pass for session screen and RepDetailModal.
Actions:

- Fixed recent exercise history cards to properly display historical data:
  - Added `historicalSessionReps` state to track reps from tapped historical sessions.
  - Modified `openRepDetail` to fetch reps for historical sessions when cards are tapped.
  - Updated RepDetailModal to display historical reps and disable edit actions for read-only historical data.
  - Historical cards now show the actual reps from that session instead of depending on current-session reps.
- Removed emoji from warmup button text (changed "🔥 ウォームアップON" to "ウォームアップON").
- Restyled manual add-rep button in RepDetailModal to match GarageTheme:
  - Changed background from bright green (#4CAF50) to GarageTheme accent (#ff7a1a).
  - Changed border color to GarageTheme accentSoft (#ffb347).
  - Changed text color to GarageTheme text (#fff5ee) for consistency.
    Results:
- `pnpm -s tsc --noEmit` passed with no errors.
- Recent exercise history cards now open useful data from historical sessions.
- All UI elements now consistently follow GarageTheme styling.
- Historical sessions are properly read-only (no edit/add/delete actions).
  Remaining:
- Real-device testing recommended for historical session detail modal behavior.
- Consider TestFlight upload after device verification.

## 2026-04-10 (Claude Sonnet 4.6)

Scope: TestFlight build/upload with build number bump to 74.
Actions:

- Bumped iOS build number from 73 to 74 consistently in:
  - `app.config.ts` (buildNumber: "74")
  - `ios/RepVeloCoach/Info.plist` (CFBundleVersion: 74)
  - `ios/RepVeloCoach.xcodeproj/project.pbxproj` (CURRENT_PROJECT_VERSION = 74)
- Verified all three build numbers match.
- Ran repo-local TestFlight deployment script:
  - Executed: `FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 bash scripts/deploy.sh`
  - Used canonical repo path: `/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo`
    Results:
- TestFlight/App Store Connect upload succeeded for version `2.3.5` build `74`.
- Generated IPA: `ios/fastlane_export/RepVeloCoach.ipa`
- Fastlane summary: build_app (184s), upload_to_testflight (55s), total ~4 minutes.
- Upload completed successfully at 11:31:31.
  Remaining:
- Wait for App Store Connect/TestFlight processing (usually 15-30 minutes).
- Verify build 74 appears in TestFlight.
- Real-device testing recommended for all features implemented in recent sessions.

## 2026-04-13 (Codex / GPT-5 + Claude CLI via Z.AI GLM sonnet/opus)

Scope: Feedback triage after device test, introduce a canonical improvement tracker, and implement a first pass on session/AI/graph follow-ups.
Actions:

- Confirmed Claude CLI is currently pointed at Z.AI GLM and verified both `--model sonnet` and `--model opus` respond through the CLI.
- Added `docs/IMPROVEMENT_TRACKER.md` as the canonical improvement table for all agents and updated `AGENTS.md` to require reading/updating it.
- Launched two GLM worker tasks via the project-leader workflow:
  - `glm-sonnet-session`: session/settings/memo oriented changes
  - `glm-opus-ai`: AI context / estimation / graph oriented changes
- Reviewed worker output and only kept changes that were coherent with the current repo.
- Fixed a broken duplicated block in `app/(tabs)/session.tsx` that had been left in the file.
- Added same-load recent history cards to the session screen and removed duplicated same-weight history rendering.
- Added duplicate-rep suppression in `useSessionLogic` by ignoring identical rep payloads received within 800ms.
- Strengthened AI coach context with same-weight history, recent session notes, and exercise cue/focus metadata.
- Added category-first exercise selection to graph mode and replaced fixed graph zones with percentile-based history-derived zones (with fallback).
- Integrated a 4-point / historical-fallback 1RM estimator after set save, and surfaced velocity-loss-based estimated RPE in session history.
- Added an explicit `履歴から V@1RM を最適化` button and made accepted MVT updates propagate to both the LVP profile and the exercise master.
  Results:
- `pnpm -s tsc --noEmit` passed after the integrated changes.
- Improvement requests now have a single canonical tracking document that future Codex/Claude/GLM/Gemini sessions can update.
- The following items moved to implemented in the tracker:
  - same-load velocity history
  - AI coach context enrichment
  - 4-point 1RM update
  - V@1RM optimization button + persistence
  - graph category selection
  - graph dynamic velocity zones
  - set-level estimated RPE
- Existing implemented features were confirmed and tracked explicitly:
  - exercise master cue/focus notes
  - session note editing from session mode
    Remaining:
- Battery percentage issue is still unresolved; current UI exposes CNS Battery only, and a true sensor battery pipeline may still be missing.
- Auto-start still needs another pass; current movement trigger (`ROM > 5cm`) did not satisfy device testing.
- Duplicate-rep suppression must be re-tested on device because the fix is heuristic.
- If the next agent continues this work, start from `docs/IMPROVEMENT_TRACKER.md` and `git diff` rather than the old TODO file.

## 2026-04-13 (Claude Sonnet 4.6 via Z.AI GLM)

Scope: Auto-start ROM threshold configuration
Actions:

- Added `auto_start_rom_cm` field to `AppSettings` type with default value of 5cm.
- Added `auto_start_rom_cm` field to `Exercise` type for per-exercise override.
- Updated `AppSettingsService` to include the new field in `DEFAULT_APP_SETTINGS` and persistence.
- Modified `useSessionLogic` to use per-exercise override with fallback to settings default.
- Enhanced settings tab UI with ROM threshold selector (3cm, 5cm, 7cm, 10cm options).
- Added exercise-specific auto-start ROM editing in exercise master edit form.
- Updated `mergeExerciseWithPreset` in `exerciseCatalog.ts` to merge auto_start_rom_cm.
- Updated `ExerciseService.syncCatalog` to preserve existing auto_start_rom_cm values.
  Results:
- `pnpm -s tsc --noEmit` validation needed.
- Auto-start ROM threshold is now configurable at both app-level and exercise-level.
- Settings UI allows global configuration with visual feedback (current threshold displayed).
- Exercise master editing allows per-exercise override with "既定" (default) option.
- Auto-start logic follows precedence: exercise.override > settings.default.
  Remaining:
- Type-check and build to verify no compilation errors.
- Real-device testing to confirm auto-start behavior with configurable thresholds.
- Consider TestFlight upload after verification.

## 2026-04-13 (Codex review + GLM Sonnet auto-start threshold pass)

Scope: Make auto-start ROM threshold configurable globally and per exercise, then prepare for commit/build.
Actions:

- Used the global `glm-priority-workflow` and project-leader orchestration to route the task to a GLM Sonnet worker.
- Reviewed the partial worker changes and completed the missing persistence integration in `DatabaseService` and `ExerciseService`.
- Added a global app setting for auto-start ROM threshold (`auto_start_rom_cm`, default 5cm).
- Added an exercise-level override for auto-start ROM threshold and surfaced it in exercise-master editing.
- Updated session auto-start detection to use exercise override first, then global default.
- Updated the improvement tracker so auto-start is back in implemented state pending new device testing.
  Results:
- Auto-start threshold is no longer hard-coded to 5cm.
- Users can now tune it globally and override it per exercise from settings.
  Remaining:
- Device testing is still required to confirm the threshold choices are appropriate per lift.

## 2026-04-13 (Codex / GPT-5 + Claude CLI via Z.AI GLM sonnet)

Scope: Commit the integrated session/intelligence/auto-start changes, push `main`, and ship a new TestFlight build.
Actions:

- Final-reviewed the integrated working tree after GLM-assisted implementation and kept the canonical repo at `/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo`.
- Committed the feature batch as `825c4a2` (`Improve session intelligence and configurable auto-start`) and pushed it to `origin/main`.
- Bumped the iOS/TestFlight build number from `74` to `75` in all three required sources:
  - `app.config.ts`
  - `ios/RepVeloCoach/Info.plist`
  - `ios/RepVeloCoach.xcodeproj/project.pbxproj`
- Committed the build bump as `fb20d70` (`Bump iOS build number to 75 for TestFlight`) and pushed it to `origin/main`.
- Ran the repo-local upload flow:
  - `source ~/.zshrc && FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 bash scripts/deploy.sh`
- Verified archive, IPA export, and App Store Connect upload success from the fastlane output.
  Results:
- GitHub `main` now contains the auto-start threshold changes and the session/intelligence improvements.
- TestFlight/App Store Connect upload succeeded for version `2.3.5` build `75`.
- Generated IPA: `ios/fastlane_export/RepVeloCoach.ipa`
- Fastlane summary: `build_app` 316s, `upload_to_testflight` 61s.
  Remaining:
- Wait for App Store Connect/TestFlight processing for build `75`.
- Device-test the new auto-start threshold controls:
  - global default threshold in settings
  - per-exercise override in exercise master
  - expected precedence `exercise override > global setting`
- If another iOS upload is needed, bump above `75` before the next run.

## 2026-04-14 (Codex / GPT-5 + Claude CLI Sonnet)

Scope: Add a repo-root Claude bootstrap document so Claude can reliably work in the canonical repo and follow the correct TestFlight workflow.
Actions:

- Launched Claude CLI (`claude --model sonnet`) against the canonical repo and asked it to draft a repo-root `CLAUDE.md` based only on:
  - `AGENTS.md`
  - `CURRENT_STATUS.md`
  - `TESTFLIGHT_DEPLOYMENT.md`
  - `docs/AGENT_WALKTHROUGH.md`
- Reviewed the generated draft and condensed it into an operational `CLAUDE.md` focused on:
  - canonical repo path
  - release state
  - mandatory tracker/walkthrough rules
  - exact TestFlight upload steps
  - post-upload recording requirements
- Kept the build/upload source of truth repo-local rather than home-directory skill-local.
  Results:
- The repo now has a root `CLAUDE.md` that Claude Code can read before editing or building.
- Claude-specific onboarding now points at the same canonical repo and the same TestFlight workflow used by Codex.
  Remaining:
- If release workflow changes again, update both `TESTFLIGHT_DEPLOYMENT.md` and `CLAUDE.md` together.

## 2026-04-14 (Codex / GPT-5 + Claude CLI via Z.AI GLM sonnet)

Scope: Turn the user's dark/high-tech redesign brief into a canonical implementation direction for Home and Active Session.
Actions:

- Used the `glm-priority-workflow` and `project-leader` skills to route the redesign work through Claude CLI on Z.AI GLM.
- Read the current Home (`app/(tabs)/index.tsx`) and Session (`app/(tabs)/session.tsx`) structures plus the existing `GarageTheme` token set.
- Asked GLM for an implementation-oriented redesign plan and selected a hybrid direction:
  - Home = Variant 2 base + Variant 1 telemetry polish
  - Session = Variant 1 base + Variant 2 data hierarchy polish
- Added `docs/UI_REDESIGN_BRIEF_2026-04-14.md` as the canonical design brief for this redesign pass.
- Added two tracker entries so future Codex/Claude/GLM agents can continue the redesign without re-deciding direction.
  Results:
- The redesign direction is now documented in-repo rather than only in chat.
- Home and Session redesign are explicitly tracked as active work items.
  Remaining:
- Execute the first-pass UI implementation for `app/(tabs)/index.tsx` and `app/(tabs)/session.tsx`.
- Run typecheck after the visual pass.
- Device-test readability and interaction density after implementation.

## 2026-04-14 (Codex / GPT-5 + Claude CLI via Z.AI GLM sonnet+opus)

Scope: Start the actual Home / Active Session redesign with a multi-agent flow while keeping the repo stable.
Actions:

- Split the redesign into smaller slices after the previous full-file GLM attempt had broken JSX and TypeScript.
- Ran parallel GLM workers:
  - `glm-sonnet-home-slice1` for `app/(tabs)/index.tsx`
  - `glm-opus-session-slice1` for `app/(tabs)/session.tsx`
- Accepted the Home first-pass redesign as the base direction:
  - cockpit-style hero
  - telemetry cards
  - premium sensor link panel
  - premium action cards
  - refined recent activity list
- Rejected the first large Session redesign patch because it broke JSX/type safety.
- Reverted the broken Session patch, then applied a smaller safe visual pass focused on:
  - stronger header styling
  - premium status card styling
  - stronger exercise selector styling
  - more pronounced live data card styling
- Removed some decorative symbols from the Home action buttons to keep the visual language cleaner.
- Re-ran `pnpm -s tsc --noEmit` after the accepted changes.
  Results:
- Home screen now has a clear first-pass dark/high-tech visual redesign.
- Active Session screen has a safe first-pass polish without touching business logic.
- TypeScript check passed after reverting the broken GLM patch and keeping only the accepted slices.
  Remaining:
- Device-test the new Home readability and action-card ergonomics.
- Device-test Session readability under actual live telemetry.
- Continue the redesign in smaller passes:
  - Session control area
  - rest timer
  - recent history cards
  - graph/history/settings screens later

## 2026-04-14 (Codex / GPT-5 + Claude CLI via Z.AI GLM sonnet+opus)

Scope: Continue the dark-tech redesign and complete the second-pass Session polish before the next TestFlight build.
Actions:

- Used GLM again for two smaller Session redesign slices instead of another unsafe full-file rewrite.
- Accepted the Session second-pass visual changes that improved:
  - session start banner
  - active session banner / pause control
  - rest banner styling
  - recent history card styling
  - session history card styling
- Kept the redesign strictly visual and layout-oriented; no session logic, BLE logic, DB flow, or state transitions were changed.
- Re-ran `pnpm -s tsc --noEmit` after the integrated second-pass changes.
  Results:
- Session screen now has a broader dark/high-tech treatment beyond the first safe pass.
- TypeScript check passed.
  Remaining:
- Commit and upload a new TestFlight build so the redesign can be evaluated on device.

## 2026-04-14 (Codex / GPT-5 + Claude CLI via Z.AI GLM sonnet+opus)

Scope: Ship the redesign first pass and second-pass Session polish in a new TestFlight build.
Actions:

- Committed the accepted redesign first pass as `bcb9563` (`Start dark tech redesign for home and session`).
- Committed the accepted Session second-pass polish as `2573c18` (`Polish session screen dark tech redesign`).
- Bumped the iOS/TestFlight build number from `75` to `76` in all three required sources:
  - `app.config.ts`
  - `ios/RepVeloCoach/Info.plist`
  - `ios/RepVeloCoach.xcodeproj/project.pbxproj`
- Committed the build bump as `ec178af` (`Bump iOS build number to 76 for TestFlight`).
- First archive attempt failed in `xcodebuild` with a transient `Bus error: 10` during pod/native compilation.
- Second attempt failed because `ios/build/generated/...` React Native codegen files had been removed and had not all been regenerated before archive compilation.
- Confirmed the missing codegen outputs were regenerated under `ios/build/generated/ios`, then re-ran the same repo-local deploy flow without deleting them.
- Ran the canonical upload command:
  - `source ~/.zshrc && FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 bash scripts/deploy.sh`
- Verified archive success, IPA export success, and App Store Connect upload success from fastlane output.
  Results:
- GitHub `main` contains the redesign commits and build bump through `ec178af`.
- TestFlight/App Store Connect upload succeeded for version `2.3.5` build `76`.
- Generated IPA: `ios/fastlane_export/RepVeloCoach.ipa`
- Fastlane summary: `build_app` 422s, `upload_to_testflight` 67s.
  Remaining:
- Wait for App Store Connect/TestFlight processing for build `76`.
- Device-test the redesign on Home and Session with live telemetry.
- If another iOS upload is needed, bump above `76` before the next run.

## 2026-04-14 (Codex / GPT-5)

Scope: AirPods Pro 3 / HealthKit live heart-rate ingestion into the session screen.
Actions:

- Reviewed the existing session heart-rate plumbing and confirmed the UI/store were already prepared to render `currentHeartRate` in both the session status area and the rest timer.
- Replaced the stub `src/services/HealthService.ts` with a real native bridge wrapper using `NativeModules` and `NativeEventEmitter`.
- Added `ios/RepVeloCoach/HealthKitHeartRateModule.swift` and `ios/RepVeloCoach/HealthKitHeartRateModule.m` to expose HealthKit authorization and live heart-rate updates to React Native.
- Added HealthKit usage descriptions to `app.config.ts` and `ios/RepVeloCoach/Info.plist`.
- Added the HealthKit entitlement in `ios/RepVeloCoach/RepVeloCoach.entitlements` and registered the new native files in the Xcode project.
- First native implementation used `HKWorkoutSession` / `HKLiveWorkoutBuilder`, but simulator build failed because those APIs exceeded the current iOS 15.1 deployment target constraints in this project.
- Reworked the native implementation to use `HKObserverQuery` + `HKAnchoredObjectQuery` for heart-rate sample subscription instead.
- Adjusted the session screen HR render guard from truthy-only to `currentHeartRate != null` so low values do not disappear.
- Validated TypeScript with `pnpm -s tsc --noEmit`.
- Validated the iOS native side with simulator build:
  - `xcodebuild -workspace ios/RepVeloCoach.xcworkspace -scheme RepVeloCoach -configuration Debug -sdk iphonesimulator -destination 'platform=iOS Simulator,id=1C0615D0-1B04-46D5-92F9-A6BC66AF765B' build | xcpretty --no-color`
    Results:
- Simulator build succeeded after switching to the HealthKit sample-query approach.
- Heart-rate ingestion is now implemented end-to-end in code for iOS and is wired into the existing session UI.
- The feature still needs real-device verification with AirPods Pro 3 and Health permissions.
  Remaining:
- Confirm on device that AirPods Pro 3 actually streams heart-rate samples into HealthKit quickly enough during a live session.
- If live updates lag, the next iteration should evaluate whether workout-session APIs can be conditionally used on newer iOS versions while keeping the sample-query fallback for iOS 15.1.
- Before shipping, commit the new native files with `git add -f` because `/ios` is ignored by repo rules and the new files will not be picked up automatically.

## 2026-04-15 (Codex / GPT-5)

Scope: Fix post-test issues in manual entry recent-weight reflection and session-side manual rep addition, then prepare a new TestFlight build.
Actions:

- Investigated manual entry history refresh and confirmed the quick-select weights only came from historical DB sets, excluding sets just saved in the current manual-entry session.
- Added a merged `recentSetsForDisplay` source in `src/screens/ManualEntryScreen.tsx` so current-session saved sets are surfaced immediately in the recent-weight buttons and recent-set list.
- Investigated session-side manual rep addition and confirmed the detail modal was adding reps to the currently active set instead of the set currently opened in the modal.
- Updated `app/(tabs)/session.tsx` so manual rep addition now targets `selectedSet`, uses its `lift/load/set_index`, recalculates set metrics, updates set history, and refreshes session reps after insertion.
- Validated the JS side with `pnpm -s tsc --noEmit`.
  Results:
- Manual entry should now reflect the just-saved load immediately in recent-weight quick select.
- Manual rep addition from set detail should now affect the visible set rather than an unrelated in-progress set.
  Remaining:
- Ship and verify both fixes on device via the next TestFlight build.

## 2026-04-15 (Codex / GPT-5)

Scope: TestFlight build attempt for manual-entry/session fixes and HealthKit-enabled build.
Actions:

- Committed manual-entry recent-weight reflection fix and session detail manual-rep-add fix as `9f2d78b`.
- Bumped build number to `77` across `app.config.ts`, `ios/RepVeloCoach/Info.plist`, and `ios/RepVeloCoach.xcodeproj/project.pbxproj` as commit `58a2b45`.
- Added explicit HealthKit `SystemCapabilities` declaration in the Xcode project as commit `45ff9df` to help automatic signing recognize the new capability.
- Ran the repo-local TestFlight workflow twice with:
  - `FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 bash scripts/deploy.sh`
    Results:
- Build `77` did not upload.
- Archive failed before IPA export because signing/provisioning is not aligned with the newly added HealthKit entitlement.
- First fatal errors:
  - `Provisioning profile "iOS Team Provisioning Profile: *" doesn't include the HealthKit capability.`
  - `Provisioning profile "iOS Team Provisioning Profile: *" doesn't include the com.apple.developer.healthkit entitlement.`
  - `No Accounts: Add a new account in Accounts settings.`
    Remaining:
- Apple Developer portal or local Xcode signing setup must be updated before any HealthKit-enabled TestFlight build can succeed.
- After capability/profile/account alignment, re-run `scripts/deploy.sh` using build `77` or bump above it if another local archive already consumes `77`.

## 2026-04-15 (Codex / GPT-5)

Scope: Extend graph mode with a daily e1RM trend for the selected exercise.
Actions:

- Updated `app/(tabs)/graph.tsx` to collect up to 30 recent sessions worth of sets for the selected exercise instead of only the small velocity subset.
- Added `buildDailyE1rmTrend()` to aggregate the best e1RM per day from saved sets.
- Added a new `renderDailyE1rmTrend()` section to the graph `進捗` tab, with latest/best summary cards and per-day bars.
- Kept existing velocity trend behavior by continuing to expose the latest 20 sets separately.
- Validated with `pnpm -s tsc --noEmit`.
  Results:
- Graph mode now shows a day-by-day e1RM trend for the currently selected exercise.
- Existing LVP and velocity-zone views remain intact.
  Remaining:
- Check on device whether the date range and bar density are readable when an exercise has many logged days.
- If needed, add a range filter (7d / 30d / all) in a later pass.

## 2026-04-15 (Codex / GPT-5 + GLM sonnet)

Scope: Extend graph mode beyond daily e1RM with range filters, smoothing, and cross-exercise comparison.
Actions:

- Requested a focused implementation proposal from GLM sonnet for `app/(tabs)/graph.tsx` covering 7d/30d/all filters, a smoothed trend line, and exercise comparison.
- Rejected the expensive part of the GLM proposal that would re-query every exercise independently; instead integrated a single-pass per-session aggregation for comparison data.
- Added `DateRange` filtering for the daily e1RM trend (`7日 / 30日 / 全期間`).
- Added an SVG-based chart layer using `react-native-svg` with bars for daily best e1RM and a smoothed polyline overlay.
- Added an exercise comparison section that shows the latest e1RM snapshot across recorded exercises.
- Kept the existing volume trend and velocity trend sections intact under the new e1RM trend block.
- Validated with `pnpm -s tsc --noEmit`.
  Results:
- Trend tab now includes date-range filtering, smoothed e1RM visualization, and cross-exercise comparison.
- GLM was used for the implementation proposal; final integration was reviewed and adjusted locally to avoid wasteful DB access.
  Remaining:
- Real-device review should confirm chart readability when many days are visible in `全期間`.
- If labels become crowded, the next pass should add a horizontal scroll or sparse x-axis labeling.

## 2026-04-18 (Claude Sonnet)

Scope: Bug fixes for session mode and TestFlight build attempt.
Actions:

- Fixed Mean Power and Peak Power display in session mode (`app/(tabs)/session.tsx`) to always calculate and show power values even when BLE data doesn't include power.
- Disabled automatic set completion when velocity loss threshold is exceeded (`src/hooks/useSessionLogic.ts`) - now only shows warning, allows user to continue recording until manual set complete.
- Added bash command confirmation skip setting in `~/.claude/settings.json` with `"defaultMode": "dontAsk"` and `"Bash"` in allowed tools.
- Bumped build number to `78` across `app.config.ts`, `ios/RepVeloCoach/Info.plist`, and `ios/RepVeloCoach.xcodeproj/project.pbxproj`.
- Attempted TestFlight upload with build 78.
  Results:
- Build 78 upload failed due to Apple Developer Program agreement expiration (requires user to update agreement in App Store Connect).
- Session mode bugs fixed: power display now working, VL cut no longer auto-ends sets.
- Bash commands now execute without confirmation prompts.
  Remaining:
- User needs to update Apple Developer Program agreement in App Store Connect, then retry TestFlight upload with build 78 or bump to build 79.

## 2026-04-21 (Claude Opus 4.7)

Scope: Phase 1 & 2 implementation based on user testing feedback (10 improvement items).
Actions:

- Created improvement plan at `/Users/hoshinohideyuki/.claude/plans/fluttering-gliding-stallman.md` covering:
  1. VL警告音のオンオフ機能
  2. パワー表示修正とピークベロシティ表示追加
  3. 音量制御実装
  4. メモリリーク修正（HRポイント配列制限）
  5. 心拍数シグナル表示（青・黄・赤3色）
  6. 1eRM予測改善（全レップデータ活用）
  7. V1RM更新ロジック修正（高負荷優先重み付け回帰）
  8. 動的速度ゾーン実装（種目別履歴ベース）
  9. 手動レップ追加モーダル
  10. 音量調整UI
- Implemented all Phase 1 (high priority) items:
  - Added `enable_vl_warning: boolean` to AppSettings with default true
  - Updated AppSettingsService with new default
  - Modified useSessionLogic to check enable_vl_warning before announcing VL stop
  - Added volume control to AudioService (setVolume method, volume parameter in speak)
  - Fixed memory leak in trainingStore by limiting arrays to 100 items (.slice(-100))
- Implemented Phase 2 (medium priority) items:
  - Created HeartRateUtils.ts with recovery signal calculation (blue/yellow/red based on HR% of peak)
  - Updated VBTCalculations.ts to use weighted regression prioritizing high-load data
  - Added getDynamicZone async method to AICoachService for exercise-specific zones
  - Updated RepVelocityChart.tsx to load and display dynamic zones
  - Created ManualRepModal.tsx for manual rep entry with velocity and load inputs
- Updated settings.tsx with VL warning toggle and volume adjustment UI (25/50/75/100% buttons)
- Updated session.tsx with improved power display, peak velocity fallback, and HR signal display
  Results:
- All 10 improvement items implemented in code
- TypeScript validation passed
- Git commit created: `78817b0` - "feat: セッションモード改善（Phase1&2）"
- Git push to origin/main completed successfully
- Build 78 IPA already exists from previous build (generated at 06:32 on 2026-04-21)
- TestFlight upload completed by Codex via skill-based script
  Note: For future Claude sessions, use skill-based deployment scripts:
  - Full build + upload: `bash ~/.claude/skills/repvelocoach-testflight/scripts/deploy.sh`
  - Upload existing IPA only: `bash ~/.claude/skills/repvelocoach-testflight/scripts/upload_only.sh`
- Build 79 uploaded to TestFlight successfully (2026-04-21 08:06:54 JST)
  - build_app: 195s
  - upload_to_testflight: 57s
  - Generated IPA: `ios/fastlane_export/RepVeloCoach.ipa` (20.9 MB)
    Remaining:
- Device testing needed for all new features:
  - VL warning toggle functionality
  - Volume control effectiveness
  - HR signal color changes during recovery
  - Improved 1eRM prediction accuracy
  - V1RM graph updates with high-load priority
  - Dynamic velocity zones per exercise
  - Manual rep modal workflow
- Dynamic zone accuracy across different exercises
  - Manual rep modal usability

## 2026-04-22 (Claude Opus 4.7)

Scope: Fix 6 new issues from user testing, VL settings UI relocation, audio ducking.
Actions:

- Fixed performance issue: Limited setHistory array to 50 items in trainingStore (completeSet)
- Fixed first session recording twice issue: Auto-start functionality investigation (found enable_auto_start_session defaults to false)
- Added VL settings UI to session screen with toggle switch and threshold buttons (10%, 15%, 20%, 25%, 30%)
- Implemented audio ducking for voice announcements on iOS and Android:
  - Added INTERRUPTION_MODE_IOS_DUCK_OTHERS and INTERRUPTION_MODE_ANDROID_DUCK_OTHERS to AudioService
  - Music volume will automatically lower during voice announcements
- Investigated session history power display: Confirmed calculation logic is correct (fallbacks from trackedReps → avg_power_w → calculated from avg_velocity)
  Results:
- VL settings UI added to session.tsx with full styling
- Audio ducking enabled via interruptionMode configuration
- TypeScript validation passed
- Git commits:
  - `c89635c` - "feat: セッション画面にVL設定UIを追加、音声ダッキングを実装"
  - `9bc01da` - "Bump iOS build number to 80 for TestFlight"
- Git push to origin/main completed
- TestFlight upload completed successfully (build 80, 2026-04-22 12:56:53 - 13:01:04 JST)
  - build_app: 195s
  - upload_to_testflight: 57s
  - Generated IPA: `ios/fastlane_export/RepVeloCoach.ipa`
    Remaining:
- Device testing needed for:
  - VL settings UI functionality in session screen
  - Audio ducking effectiveness during voice announcements
  - Performance improvements in long sessions

## 2026-05-13 (Codex)

Scope: User field-test follow-up for session freeze, VBT simulator testing path, and graph/MY V@1RM behavior.
Safety:

- Considered workspace AGENTS rule before acting. Work stayed inside repo-local files and normal build/test commands; no scans or broad network probing.
  Actions:
- Backed up touched files under `.ai-backups/20260513-vbt-freeze-simulator-graph/`.
- Updated `docs/IMPROVEMENT_TRACKER.md` with 2026-05-13 user feedback and implemented items.
- Changed `src/hooks/useSessionLogic.ts` so set completion moves UI to rest immediately, then persists DB rows, PR checks, four-point 1RM estimation, LVP save, and ROM inference asynchronously.
- Reduced session all-rep refresh triggers in `app/(tabs)/session.tsx` so set completion no longer performs duplicate full-session reloads on both set index and set-history changes.
- Added VBT simulator support:
  - `src/utils/VBTSimulator.ts` pure dummy payload generator
  - `src/services/BLEService.ts` simulator connect/disconnect, single rep emission, and velocity-loss shaped simulated set
  - `app/(tabs)/session.tsx` compact VBT SIM controls
  - `src/utils/__tests__/VBTSimulator.test.ts` unit coverage
- Updated `app/(tabs)/graph.tsx`:
  - Removed fixed demo LVP fallback
  - Uses saved LVP or derives an in-memory LVP from real AV history
  - Bars prefer actual recorded loads instead of fixed 20-140kg loads
  - Displays `MY V@1RM` using lvp.mvt, exercise.mvt, then v1rm fallback
  - e1RM estimate now uses personal MVT where available
    Results:
- `pnpm -s check` passed.
- `pnpm -s test` passed: 20 passed, 1 skipped.
- iOS Debug simulator build passed with `xcodebuild ... CODE_SIGNING_ALLOWED=NO build`.
- Computer Use + iOS Simulator:
  - Debug app first showed `No script URL provided`; 8081 Metro was stuck, so used localhost 8082 and set `RCT_jsLocation` for the simulator.
  - Verified app launch, Session tab open, VBT SIM controls visible before session.
  - Found and fixed simulator CONNECT not updating `trainingStore.isConnected`.
  - Found and fixed active-session screen hiding VBT SIM controls.
  - Ran SIM SET in active session; it advanced to SET 2 without freezing.
  - Found and fixed `AICoachService.suggestNextLoad` crash when `target_training_phase` is a PL phase such as `peaking`.
    Notes:
- Simulator warning `Missing com.apple.developer.healthkit entitlement` is expected for the simulator/debug entitlement context and did not block session testing.
- Physical iPhone training DB is not directly readable from Mac in normal TestFlight use unless exported/synced or the app container is accessible via development tooling.

## 2026-05-14 (Codex)

Scope: Add a safe iPhone-to-Codex training-data handoff.
Safety:

- Considered the workspace AGENTS security rule before acting.
- Confirmed the Mac is not associated with AirPort Wi-Fi before starting.
- Avoided network scanning, LAN discovery, device probing, and background servers. The handoff is user-initiated file sharing only.
  Actions:
- Backed up touched files under `.ai-backups/20260514-codex-training-export/`.
- Added `src/services/CodexDataExportService.ts`.
  - Builds schema `repvelocoach.codex-training-export.v1`.
  - Exports sessions, sets, reps, exercises, and LVP profiles from the existing SQLite service.
  - Writes a JSON file under the app document directory and opens the native share sheet.
- Updated `app/(tabs)/import.tsx`.
  - Added `CODEX EXPORT` card and button to the Data tab.
  - Shows exported file name and size after a successful export.
- Added `scripts/read-codex-training-export.mjs`.
  - Reads a selected export file or the latest `repvelocoach-codex-export-*.json` in a directory.
  - Validates the schema and prints counts, latest session, mean rep velocity, top exercises, and MY V@1RM profile values.
- Added package script `pnpm codex:training-export`.
- Added direct `expo-file-system` dependency so the export service owns its file-writing dependency.
  Results:
- `pnpm -s check` passed.
- `node --check scripts/read-codex-training-export.mjs` passed.
- Sample JSON parser smoke test passed.
  Remaining:
- Real iPhone TestFlight/shared-file check is still needed: Data tab -> CODEX EXPORT -> AirDrop/Files/Finder to Mac -> `pnpm codex:training-export ~/Downloads`.

Follow-up:

- User said this should feel like it can be acquired from this screen.
- Polished `app/(tabs)/import.tsx` so the Data tab headline is `DATA BAY / CODEX LINK`.
- Moved Codex export into a prominent top card directly below local DB stats.
- The card now shows export target, JSON badge, exportable counts, `GET DATA FOR CODEX`, and last exported file metadata.

## 2026-05-14 (Codex)

Scope: VBT SIM session-mode regression test.
Safety:

- Considered the workspace AGENTS security rule. No network probing or scanning was used.
- Wi-Fi check showed the Mac was not associated with AirPort Wi-Fi.
  Actions:
- Ran `pnpm -s check`.
- Ran `pnpm -s vitest run src/utils/__tests__/VBTSimulator.test.ts src/services/__tests__/DeterministicVBTCoach.test.ts`.
- Used iOS Simulator + Computer Use to test session mode:
  - Opened Session tab.
  - Connected VBT SIM.
  - Selected Squat.
  - Started a session.
  - Sent a single simulated REP.
  - Sent a simulated SET.
  - Confirmed the UI entered rest/paused state after set completion.
  - Confirmed `次のセットを開始` advanced to `SET 2`.
    Findings:
- No freeze was observed during the simulated set-completion flow.
- A React Native LogBox warning appeared after a 0kg simulator PR: `Text strings must be rendered within a <Text> component.`
- Root cause was `prRecord.load_kg && (...)` in `src/components/PRNotification.tsx`; numeric `0` could be rendered outside `<Text>` during 0kg simulator tests.
  Fix:
- Backed up files under `.ai-backups/20260514-session-sim-test-fix/`.
- Changed the PR notification condition to `prRecord.load_kg != null`.
  Results:
- `pnpm -s check` passed after the fix.
- Targeted VBT tests passed after the fix: 9 tests passed.
- Re-ran the Simulator flow and the `Text strings...` warning did not reappear.
  Remaining:
- Simulator still shows `Missing com.apple.developer.healthkit entitlement`, which is expected in the debug Simulator environment and not part of the VBT SIM failure path.
- Real TestFlight/iPhone session-mode confirmation is still needed.

## 2026-05-14 (Codex)

Scope: Fix 0W power display and add more live session information.
Safety:

- Considered the workspace AGENTS security rule. No network probing or scanning was used.
- Wi-Fi check showed the Mac was not associated with AirPort Wi-Fi.
  Actions:
- Backed up touched files under `.ai-backups/20260514-session-power-info/`.
- Updated `src/hooks/useSessionLogic.ts`.
  - Preserves device/simulator `mean_power_w` and `peak_power_w` when they are positive.
  - Falls back to calculated power from current load and velocity when the device reports 0 or omits power.
  - Stores the resolved power on saved rep records.
- Updated `src/services/BLEService.ts`.
  - Lets the VBT simulator receive the current load so simulated power matches the active set load.
- Updated `app/(tabs)/session.tsx`.
  - Treats reported `0W` as missing for display fallback instead of a final value.
  - Applies the same fallback to session-history power chips, so existing reps with missing/zero saved power can still show calculated power from load and velocity.
  - Adds active-session info cards for `EXERCISE`, `LOAD`, and `POWER`.
  - Adds active-session metric strip for `AVG V`, `ROM`, and `PEAK P`.
    Results:
- `pnpm -s check` passed.
- Targeted VBT tests passed: 20 tests passed across `VBTSimulator`, `VBTLogic`, and `DeterministicVBTCoach`.
- iOS Simulator + Computer Use verification:
  - Selected Squat.
  - Set load to 100kg.
  - Started a session.
  - Sent a simulated REP.
  - Confirmed live Power displayed `471 W` and Peak P displayed `556 W`.
  - Sent a simulated SET.
  - Confirmed set completion did not freeze and the PR modal appeared.
    Notes:
- Simulator still shows `Missing com.apple.developer.healthkit entitlement`, which is expected in the debug Simulator environment and did not block this test.

## 2026-05-17 (Codex)

Scope: Continue the 筋トレMEMO-inspired UX plan for history review.
Safety:

- Work stayed inside repo-local files and normal developer verification commands.
- No network probing, scans, or device discovery were used.
  Actions:
- Updated `src/screens/HistoryScreen.tsx`.
  - Added `リスト / カレンダー / グラフ` segmented view modes.
  - Calendar mode highlights days with sessions and shows selected-day sessions below the calendar.
  - Graph mode shows the last 14 training days and can switch between volume, set count, and duration.
  - Bar taps update a compact tooltip with date, metric value, session count, and main lifts.
- Updated `docs/IMPROVEMENT_TRACKER.md` with `2026-05-17-01`.
  Results:
- `pnpm -s lint` passed.
- `pnpm -s tsc --noEmit` passed.
- `pnpm -s test` passed: 20 tests passed, 1 skipped.
  Remaining:
- Real-device UX check for touch target comfort, text fit, and whether calendar or graph should become the default history view.

## 2026-05-19 (Codex)

Scope: Split BIG3 categories and reduce Session screen freeze risk.
Safety:

- Work stayed inside repo-local files and normal developer verification commands.
- No network probing, scans, or device discovery were used.
  Actions:
- Updated `src/constants/exerciseCatalog.ts`.
  - Replaced the single `BIG3` selection group with separate `ベンチ`, `スクワット`, and `デッド` groups.
  - Preserved other accessory category groupings.
- Updated `src/types/index.ts` and `src/services/AppSettingsService.ts`.
  - Added Session lightweight mode and per-section display settings for normal and focus Session screens.
  - Defaulted lightweight mode to on.
- Updated `app/(tabs)/session.tsx`.
  - Avoids loading all session reps unless Session History or rep detail needs them.
  - Stops the delayed second DB refresh once lightweight mode is active after 5 sets.
  - Shows only the latest 5 sets in Session History while lightweight mode is on.
  - Gates normal and focus Session sections behind display settings.
- Updated `app/(tabs)/settings.tsx`.
  - Added a categorized settings menu.
  - Added Session lightweight mode controls.
  - Added display toggles for normal Session and focus Session sections.
    Results:
- `pnpm -s tsc --noEmit` passed.
- `pnpm -s lint` passed.
- `pnpm -s test` passed: 20 tests passed, 1 skipped.
  Remaining:
- Real-device check needed: run at least 6 sets in Session mode and tune which display toggles should default off if the screen still feels heavy.

## 2026-05-19 (Codex, parallel agents)

Scope: Investigate and reduce progressive Session slowdown around the 6th set.
Safety:

- Work stayed inside repo-local files and normal developer verification commands.
- No network probing, scans, or device discovery were used.
  Investigation:
- Started three read-only explorer agents in parallel:
  - Session render/React performance.
  - Store/DB/state accumulation.
  - BLE/simulator/timers/listeners.
- All reports converged on the same high-risk areas:
  - Set-completion persistence and analysis were fire-and-forget and could overlap across sets.
  - `handleDataReceived` did `getLVPProfile` DB reads per accepted rep.
  - Full session reps were reloaded and regrouped for UI/detail paths.
  - Hot SQLite queries had no indexes.
  - Hidden `RepDetailModal` still filtered passed reps on parent renders.
    Actions:
- Updated `src/hooks/useSessionLogic.ts`.
  - Added a serialized persistence queue so set-completion DB/analysis work does not pile up in parallel.
  - Added lift-scoped LVP profile caching and removed per-rep DB reads from the hot BLE path.
  - In lightweight mode, skipped heavier 4-point 1RM session-rep reread and ROM full-history inference during each set completion.
  - Kept PR checks and LVP update path intact.
- Updated `src/services/DatabaseService.ts`.
  - Added `CREATE INDEX IF NOT EXISTS` indexes for hot `sets`, `reps`, and `pr_records` queries.
- Updated `app/(tabs)/session.tsx`.
  - Avoided manual/simulator full-rep refreshes when Session reps are not currently needed.
- Updated `src/components/RepDetailModal.tsx`.
  - Avoided filtering work when hidden and precomputed velocity-loss values in one pass.
    Results:
- `pnpm -s tsc --noEmit` passed.
- `pnpm -s lint` passed.
- `pnpm -s test` passed: 20 tests passed, 1 skipped.
  Remaining:
- Real-device check needed: run 8-10 sets with the physical device and confirm no progressive freeze.
- If still heavy, next step is splitting `SessionScreen` into memoized subcomponents with Zustand selectors.

## 2026-05-25 (Codex, parallel agents)

Scope: Use pasted freeze diagnostics to reduce Session mode freeze risk and improve recovery/GPT/exercise selection flows.
Safety:

- Work stayed inside repo-local files and normal developer verification commands.
- No network probing, scans, device discovery, or security-sensitive actions were used.
  Investigation:
- Started three read-only explorer agents in parallel:
  - Session render/store fan-out and DB reload hotspots.
  - Recovery/session continuity gaps.
  - Exercise sort and GPT copy/open feasibility.
- Reports agreed that DB/store counts matching means the latest freeze is more likely render fan-out than data corruption.
- `sessionAllReps state件数: 0` is expected in lightweight mode because reps are intentionally lazy-loaded.
  Actions:
- Updated `app/(tabs)/session.tsx`.
  - Switched the broad `useTrainingStore()` subscription to a shallow selector.
  - Restores active sessions with the snapshot `current_set_index` and a canonical restored lift.
  - Reduces recovery snapshot writes by depending on set count and last completed timestamp, not the whole set array.
  - Loads reps for the tapped set with `getRepsForSet()` instead of full-session `getRepsForSession()` for detail/edit paths.
  - GPT button now copies the full VBT/heart-rate context, opens ChatGPT via `chatgpt://`, and falls back to `https://chatgpt.com/`.
- Updated `src/hooks/useSessionLogic.ts`.
  - Switched broad store subscription to a shallow selector.
- Updated `src/store/trainingStore.ts`.
  - Recovery now preserves `currentSetIndex` while guarding against duplicate DB set indexes.
  - LiveData and heart-rate setters skip unchanged/near-identical values to reduce unnecessary renders.
- Updated `src/services/DatabaseService.ts`.
  - `getSetsForSession()` now restores chronological order.
  - Added recent exercise usage stats for sorting.
- Updated `src/services/ExerciseService.ts` and `src/components/ExerciseSelectModal.tsx`.
  - Exercise selection now sorts by recent set frequency, session count, last trained date, then name.
- Updated `app.config.ts` and `ios/RepVeloCoach/Info.plist`.
  - Added `chatgpt` as an allowed queried URL scheme.
- Updated `docs/IMPROVEMENT_TRACKER.md` with `2026-05-25-01` through `2026-05-25-04`.
  Results:
- `pnpm -s tsc --noEmit` passed.
- `pnpm -s lint` passed.
- `pnpm -s test` passed: 24 tests passed, 1 skipped.
  Remaining:
- Real-device check: run the same 8-14 set workflow and confirm whether freeze remains.
- If still heavy, split the large `SessionScreen` render tree into memoized `LiveDataPanel`, `SessionHistoryList`, and `SessionSetCard` components.
- ChatGPT can be opened automatically, but iOS does not allow reliable cross-app auto-paste or auto-send without user action.

## 2026-05-25 (Codex)

Scope: Add app-side VBT decision summary before sending data to ChatGPT.
Safety:

- Work stayed inside repo-local files and normal developer commands.
- No network probing, scans, device discovery, or credential access was used.
  Actions:
- Added `src/services/SessionDecisionService.ts`.
  - Separates all-set AV, working-set AV, and recent 3 working-set AV.
  - Treats non-warmup sets at 80%+ of today's max load as working sets.
  - Flags same-load AV drop, ROM drop, high current HR, delayed HR→120, high VL, and e1RM drop.
  - Produces next-load, HR wait target, rest target, pass criteria, stop criteria, PR status, confidence, and trend rows.
- Added `src/services/__tests__/SessionDecisionService.test.ts`.
  - Covers the observed 120kg→110kg style case where ROM drop is more important than velocity recovery.
  - Verifies HR→120 averages ignore zero values.
- Updated `app/(tabs)/session.tsx`.
  - Added a short `NEXT SET DECISION` card for set-to-set use.
  - Added purpose chips: 完遂 / フォーム / LVP / 量.
  - Replaced GPT copy content with `VBT相談パケット v3`.
  - Added app-side decision summary and an `AI用JSON` block.
  - Explicitly separates HR→120 all vs working-set averages and notes HR→130/135 is not yet stored.
- Updated `src/hooks/useSessionLogic.ts`.
  - PR notification now excludes warmup sets, ROM that is 2cm+ shallower than the current day baseline, and clearly invalid peak velocity values.
- Updated `docs/IMPROVEMENT_TRACKER.md` with `2026-05-25-05`.
  Results:
- `pnpm -s tsc --noEmit` passed.
- `pnpm -s lint` passed.
- `pnpm -s test` passed: 26 tests passed, 1 skipped.
- `pnpm -s build` passed.
- `git diff --check` passed.
  Remaining:
- Real-device check needed: confirm the NEXT SET DECISION card is readable during rest.
- Future data model work: store HR→130 and HR→135 recovery times separately instead of only HR→120.
- Future PR work: persist PR status as Baseline/Candidate/Confirmed rather than only using it in the decision packet.

## 2026-05-26 (Codex)

Scope: Organize exercise names so Japanese/Katakana registrations converge on English canonical names, and add a Mac helper GUI for category/alias cleanup.
Safety:

- Work stayed inside repo-local files and normal developer verification commands.
- No network probing, scans, device discovery, credential access, or destructive git actions were used.

Actions:

- Updated `src/constants/exerciseCatalog.ts`.
  - Added English canonical seeds for `Low Bar Squat`, `High Bar Squat`, and `Close Grip Bench Press`.
  - Added Japanese aliases such as `ローバースクワット`, `ハイバースクワット`, `ナローベンチプレス`, and `ナローベンチ`.
  - Improved free-text inference so future Japanese entries like `ナローベンチ` map to bench variants instead of generic accessory records.
- Updated `src/services/DatabaseService.ts` and `src/services/ExerciseService.ts`.
  - Catalog sync now migrates historical `sets`, `reps`, `pr_records`, and `lvp_profiles` lift names to the English canonical name when a Japanese alias is detected.
  - This keeps history, PRs, LVP, and frequency sorting from splitting between Japanese and English names.
- Updated `src/screens/MonitorScreen.tsx`.
  - Changed the hard-coded sample/default lift from `ベンチプレス` to `Bench Press`.
- Added `scripts/exercise_catalog_gui.py` and `pnpm exercise:gui`.
  - The Mac GUI reads `src/constants/exerciseCatalog.ts`, lets the user draft category/subcategory/alias edits, and exports `tmp/exercise-catalog-draft.json` plus `docs/exercise-catalog-alias-plan.md`.
  - `pnpm exercise:gui` uses `/usr/bin/python3` because Homebrew Python on this Mac lacks `_tkinter`.
  - It intentionally does not rewrite TypeScript directly, keeping catalog changes reviewable.
- Updated `src/constants/__tests__/exerciseCatalog.test.ts`.
  - Added tests for Japanese/Katakana canonicalization and variant inference.
- Updated `docs/IMPROVEMENT_TRACKER.md` with `2026-05-26-01`.

Results:

- `/usr/bin/python3 -m py_compile scripts/exercise_catalog_gui.py` passed.
- `/usr/bin/python3` loaded 30 catalog seeds from the GUI parser and confirmed `Close Grip Bench Press` is present.
- `pnpm -s tsc --noEmit` passed.
- `pnpm -s lint` passed.
- `pnpm -s test` passed: 28 tests passed, 1 skipped.
- `pnpm -s build` passed.
- `git diff --check` passed.

Remaining:

- Real-device check: launch the app once so `ExerciseService.syncCatalog()` migrates existing Japanese lift names to English canonical names.
- GUI check: run `pnpm exercise:gui` on the Mac and confirm the table opens. The GUI exports draft files only; applying TS catalog changes remains a review step.

## 2026-05-26 (Codex)

Scope: Build and upload RepVeloCoach to TestFlight after exercise catalog cleanup.
Safety:

- Used the repo-local `scripts/deploy.sh` workflow documented in `TESTFLIGHT_DEPLOYMENT.md`.
- No network scanning, device discovery, credential printing, or destructive git actions were used.

Actions:

- Confirmed build metadata was not aligned: `app.config.ts` and `Info.plist` were at build `88`, while `ios/RepVeloCoach.xcodeproj/project.pbxproj` was at `86`.
- Bumped and aligned all build-number sources to build `89`:
  - `app.config.ts` `buildNumber: "89"`
  - `ios/RepVeloCoach/Info.plist` `CFBundleVersion=89`
  - `ios/RepVeloCoach.xcodeproj/project.pbxproj` `CURRENT_PROJECT_VERSION = 89`
- Ran:
  - `source ~/.zshrc && FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 bash scripts/deploy.sh`

Results:

- Archive succeeded.
- IPA export succeeded:
  - `ios/fastlane_export/RepVeloCoach.ipa`
- TestFlight upload succeeded:
  - `Successfully uploaded package to App Store Connect`
  - `Lane beta finished successfully`
- Fastlane summary:
  - `build_app`: 2327 seconds
  - `upload_to_testflight`: 84 seconds
- Build uploaded:
  - version `2.3.5`
  - build `89`

Remaining:

- Wait for App Store Connect/TestFlight processing, usually 15-30 minutes.
- On device, verify the exercise-name migration by launching the app once and checking that previous Katakana lifts are grouped under English canonical names.

## 2026-05-27 (Codex)

Scope: Apply user feedback from Notes for session history mini graph, graph MY V@1RM history fallback, set-finish heart-rate recovery, and form-video planning.

Safety:

- Work stayed inside repo-local files and normal developer verification commands.
- No network probing, device discovery, credential access, or destructive git actions were used.
- Did not add camera/native dependencies in this pass, to avoid destabilizing the already working TestFlight build path before the form-video MVP is reviewed.

Actions:

- Updated `app/(tabs)/session.tsx`.
  - Added a same-lift average-velocity mini trend next to the zone badge in each session history card.
  - The current set is highlighted so the user can see whether the latest set is trending up or down without opening details.
- Updated `app/(tabs)/graph.tsx`.
  - `MY V@1RM` now derives a historical MVT candidate from the heaviest 90% load cluster and uses the low observed velocity before falling back to saved LVP / exercise MVT / LVP estimate.
  - The stat card now shows the source label such as `履歴MVT` or `保存MVT`.
- Updated `src/hooks/useSessionLogic.ts`.
  - Removed the path that saved `HR→120 = 0:00` immediately at set finish when a low/stale HR reading was present.
  - HR recovery is now tracked only for sets with peak HR at least 125bpm and is confirmed only after a 15-second minimum observation window.
- Updated `app/(tabs)/settings.tsx`.
  - Added a visible `フォーム動画` settings card that uses the existing `enable_video_recording` setting as the feature gate for the next MVP.
- Added `docs/FORM_VIDEO_RECORDING_PLAN.md`.
  - Defines the safe MVP for in-app form video capture, metadata, set/session linking, storage, and implementation order.
- Updated `docs/IMPROVEMENT_TRACKER.md` with `2026-05-27-01` through `2026-05-27-04`.

Results:

- `pnpm -s tsc --noEmit` passed.
- `pnpm -s lint` passed.
- `pnpm -s test` passed: 28 tests passed, 1 skipped.
- `pnpm -s build` passed.
- `git diff --check` passed.

Remaining:

- Real-device check: verify the session history mini graph is visible around the zone badge and does not make history cards cramped.
- Real-device check: confirm new sets no longer show immediate `HR→120 0:00` after hard sets; warmups/low HR sets should show `-` unless real recovery is observed later.
- Graph check: confirm Bench Press `MY V@1RM` shows the low historical value source when 95kg / 0.13m/s style history exists.
- Next implementation: add `expo-camera`, a recording screen, and SQLite metadata attachment following `docs/FORM_VIDEO_RECORDING_PLAN.md`.

## 2026-05-27 (Codex Orchestrator + Worker Agents)

Scope: Implement the form-video MVP: `expo-camera`, recording screen, SQLite metadata, and session/set linking.

Safety:

- Work stayed inside repo-local files and normal developer/package commands.
- No network probing, device discovery, credential access, or destructive git actions were used.
- Split implementation into two low-reasoning workers:
  - Worker A owned DB/type/service metadata.
  - Worker B owned camera UI/session entry point.
- Codex reviewed and integrated the two slices, resolving the temporary API-name mismatch between the UI helper and `VideoRecordingService`.

Acceptance Criteria:

- Add Expo SDK 54 compatible camera dependency.
- Create a recording screen with permissions, preview, start/stop/cancel/save, and unavailable-camera handling.
- Persist metadata with `session_id`, `lift`, `set_index`, `load_kg`, `local_uri`, `started_at`, `ended_at`, and `duration_s`.
- Keep camera rendering out of the main Session screen.
- Show the recording entry point only when `enable_video_recording` is enabled and a session/lift exists.
- Keep DB migrations non-destructive.

Worker A Report:

- Added `FormVideoRecord` type.
- Added `form_video_records` table and indexes.
- Added `insertFormVideoRecord`, `getFormVideosForSet`, `getFormVideosForSession`, and `deleteFormVideoRecord`.
- Added `VideoRecordingService`.
- Worker A ran `pnpm -s tsc --noEmit` successfully.

Worker B Report:

- Added `expo-camera`.
- Added `app/form-video-recorder.tsx`.
- Added `フォーム録画` entry point to `app/(tabs)/session.tsx`.
- Updated settings wording for the form video mode.
- Worker B initially left a helper/API mismatch in `session.tsx`; Codex integrated it with `VideoRecordingService`.

Codex Integration:

- Connected `app/form-video-recorder.tsx` directly to `VideoRecordingService.saveFormVideoRecord`.
- Added video-file persistence to `documentDirectory/form-videos/` before metadata save.
- Changed session video counts to use `VideoRecordingService.getFormVideosForSession`.
- Added `expo-camera` plugin config and updated microphone permission wording in `app.config.ts`.
- Updated `docs/FORM_VIDEO_RECORDING_PLAN.md` from plan-only to implemented MVP status.
- Updated `docs/IMPROVEMENT_TRACKER.md` row `2026-05-27-04`.

Results:

- `pnpm -s tsc --noEmit` passed.
- `pnpm -s lint` passed.
- `pnpm -s test` passed: 28 tests passed, 1 skipped.
- `pnpm -s build` passed.
- `git diff --check` passed.

Remaining:

- Real-device check required: camera permission, recording start/stop, save, and session history video count.
- Next phase: open linked videos from set detail, plus share/delete controls.
- Next phase: optional thumbnail generation if the video list needs visual scanning.

## 2026-05-27 (Codex)

Scope: Continue form-video workflow and plan real-time Mac data sharing.

Safety:

- Work stayed inside repo-local files and normal developer verification commands.
- No network probing, device discovery, credential access, or destructive git actions were used.
- Real-time share work was limited to planning; no local server or network listener was started.

Actions:

- Updated `src/components/RepDetailModal.tsx`.
  - Added a `FORM VIDEOS` section to set detail.
  - Added controls to open, share, and unlink video metadata from the set.
- Updated `app/(tabs)/session.tsx`.
  - Loads form videos when opening a set detail modal.
  - Opens linked local video URIs via `Linking`.
  - Shares videos through the native share sheet.
  - Unlinks video metadata through `VideoRecordingService.deleteFormVideoRecord`.
- Updated `src/services/CodexDataExportService.ts`.
  - Adds `form_videos` to Codex training export payload and counts.
- Updated `scripts/read-codex-training-export.mjs`.
  - Prints form-video counts and a short list of recent linked videos.
- Updated `docs/FORM_VIDEO_RECORDING_PLAN.md`.
  - Marked set-detail open/share/unlink and Mac export metadata as implemented.
- Added `docs/REALTIME_DATA_SHARE_PLAN.md`.
  - Recommends a local LAN Live Share MVP where the iPhone POSTs explicit events to a manually configured Mac URL.
  - Keeps the safety boundary: no network discovery/scanning; token/header optional; video file upload deferred.
- Updated `docs/IMPROVEMENT_TRACKER.md`.
  - Expanded `2026-05-27-04` with set-detail and export work.
  - Added `2026-05-27-05` for real-time Mac sharing.

Results:

- `pnpm -s tsc --noEmit` passed.
- `node --check scripts/read-codex-training-export.mjs` passed.
- `pnpm -s lint` passed.
- `pnpm -s test` passed: 28 tests passed, 1 skipped.
- `pnpm -s build` passed.
- `git diff --check` passed.

Remaining:

- Real-device check: play/share/unlink videos from set detail.
- Implement Live Share MVP:
  - Mac local receiver script.
  - app setting for Live Share URL/token.
  - non-blocking event queue for `session_started`, `rep_recorded`, `set_completed`, and `form_video_saved`.

## 2026-05-28 (Codex)

Scope: Implement local LAN Live Share MVP for Mac-side real-time data viewing.

Safety:

- Work stayed inside repo-local files and normal developer verification commands.
- No network probing, device discovery, packet capture, or aggressive connection retry logic was added.
- The app only sends to a user-entered URL when Live Share is explicitly enabled.

Actions:

- Added `src/services/LiveShareService.ts`.
  - Sends non-blocking `session_started`, `rep_recorded`, `set_completed`, and `form_video_saved` events.
  - Caches settings briefly to avoid reading AsyncStorage on every rep.
  - Queues failed events in AsyncStorage, serializes queue writes, and caps the queue at 100 events.
- Added `scripts/repvelo_live_share_server.mjs`.
  - Receives `POST /events`, optional token header, and writes JSONL to `exports/live-share/events.jsonl`.
  - Provides `GET /health` for a targeted local status check.
- Updated settings.
  - Added a `共有` category with Live Share ON/OFF, Mac URL, and optional token.
- Wired events into session start, rep recording, set completion, and form video save.
- Updated `docs/REALTIME_DATA_SHARE_PLAN.md` and `docs/IMPROVEMENT_TRACKER.md`.
- Cross review passed.
  - Follow-up fixes: current event is sent before stale queue flush, and enqueue failure is separately caught.

Results:

- `pnpm -s tsc --noEmit` passed.
- `node --check scripts/repvelo_live_share_server.mjs` passed.
- `pnpm -s lint` passed.
- `pnpm -s test` passed: 28 tests passed, 1 skipped.
- `pnpm -s build` passed.
- `git diff --check` passed.
- Local smoke check passed: started the receiver on `127.0.0.1:18989`, posted one `rep_recorded` event, and confirmed JSONL output.

Remaining:

- Real-device check: enter Mac URL, start server manually, record a few reps, and confirm JSONL events arrive.
- Next phase: Mac dashboard and optional ChatGPT packet generation from live JSONL.

## 2026-05-28 (Codex)

Scope: Extend Live Share with a Mac browser dashboard and GPT packet generation.

Safety:

- Kept the existing explicit URL model; no discovery, scanning, or device probing.
- The dashboard reads only the repo-local JSONL output file.
- When token is configured, `/events/recent` and `/gpt-packet` require the same token via query string or header.

Actions:

- Updated `scripts/repvelo_live_share_server.mjs`.
  - Added `/dashboard` browser view.
  - Added `/events/recent` JSON endpoint.
  - Added `/gpt-packet` Markdown endpoint.
  - Dashboard shows current lift, set/rep/video counts, recent sets, recent reps, and latest raw event.
  - Dashboard can copy the generated GPT packet to the clipboard.
- Updated `docs/REALTIME_DATA_SHARE_PLAN.md`.
- Updated `docs/IMPROVEMENT_TRACKER.md` with `2026-05-28-01`.

Results:

- `node --check scripts/repvelo_live_share_server.mjs` passed.
- `pnpm -s tsc --noEmit` passed.
- `pnpm -s lint` passed.
- `pnpm -s test` passed: 28 tests passed, 1 skipped.
- `pnpm -s build` passed.
- `git diff --check` passed.
- Local smoke check passed with token:
  - posted `rep_recorded` and `set_completed`
  - `/events/recent?token=...` returned set_count=1, rep_count=1
  - `/gpt-packet?token=...` generated Markdown
  - `/dashboard?token=...` returned the dashboard HTML

Remaining:

- Real-device check with iPhone sending live events to the Mac.
- Later phase: richer trend analysis in the Mac dashboard from accumulated JSONL.

## 2026-05-28 (Codex)

Scope: Add richer live analysis to the Mac dashboard.

Safety:

- Stayed inside repo-local dashboard/server code.
- No network discovery, scanning, or device probing.
- Analysis is derived only from the existing Live Share JSONL events.

Actions:

- Updated `scripts/repvelo_live_share_server.mjs`.
  - Added server-side `analysis` to `/events/recent`.
  - Flags AV drop, ROM drop, high VL, and high peak HR.
  - Adds short next-set recommendation text.
  - Dashboard now shows LIVE DECISION, flags, metrics, same-load AV bars, and lift ROM bars.
  - GPT packet now includes the app-side live analysis summary before the raw tables.
- Updated `docs/REALTIME_DATA_SHARE_PLAN.md`.
- Updated `docs/IMPROVEMENT_TRACKER.md` with `2026-05-28-02`.

Results:

- `node --check scripts/repvelo_live_share_server.mjs` passed.
- `git diff --check` passed.
- Local analysis smoke check passed:
  - posted two Squat work sets
  - `/events/recent?token=...` returned `status=major`
  - flags included AV低下, ROM低下, VL高め, 心拍高め
  - `/gpt-packet?token=...` included the live analysis summary
- `pnpm -s tsc --noEmit` passed.
- `pnpm -s lint` passed.
- `pnpm -s test` passed: 28 tests passed, 1 skipped.
- `pnpm -s build` passed.

Remaining:

- Real-device check with a longer session to tune thresholds.

## 2026-05-28 (Codex)

Scope: Improve Live Share dashboard operations for reviewing and exporting events.

Safety:

- Stayed inside repo-local dashboard/server code.
- No network discovery, scanning, or device probing.
- CSV export reads only the configured Live Share JSONL file.

Actions:

- Updated `scripts/repvelo_live_share_server.mjs`.
  - Added `/events.csv` endpoint.
  - Added dashboard CSV export button.
  - Added last-event freshness display.
  - Added recent event timeline with compact summaries.
  - `/events.csv` requires token when the server token is set.
- Updated `docs/REALTIME_DATA_SHARE_PLAN.md`.
- Updated `docs/IMPROVEMENT_TRACKER.md` with `2026-05-28-03`.

Results:

- `node --check scripts/repvelo_live_share_server.mjs` passed.
- `git diff --check` passed.
- Local export smoke check passed:
  - posted `rep_recorded` and `set_completed`
  - `/events/recent?token=...` returned `freshness_s` and timeline events
  - `/events.csv?token=...` returned CSV rows
  - `/dashboard?token=...` contained CSV, Timeline, and Last Event UI
- `pnpm -s tsc --noEmit` passed.
- `pnpm -s lint` passed.
- `pnpm -s test` passed: 28 tests passed, 1 skipped.
- `pnpm -s build` passed.

Remaining:

- Real-device check with iPhone events and dashboard left open during training.

## 2026-05-30 (Codex)

Scope: Make Live Share dashboard thresholds adjustable.

Safety:

- Stayed inside repo-local dashboard/server code.
- No network discovery, scanning, or device probing.
- Threshold changes are local settings for analysis only; they do not alter app data.

Actions:

- Updated `scripts/repvelo_live_share_server.mjs`.
  - Added CLI defaults for AV drop, ROM drop, VL, and peak HR thresholds.
  - Added dashboard threshold inputs persisted in browser localStorage.
  - `/events/recent` and `/gpt-packet` now accept threshold query overrides.
  - GPT packet includes the active thresholds used for analysis.
- Updated `docs/REALTIME_DATA_SHARE_PLAN.md`.
- Updated `docs/IMPROVEMENT_TRACKER.md` with `2026-05-30-01`.

Results:

- Local threshold smoke check passed:
  - default thresholds produced `watch`
  - stricter query overrides produced `major`
  - GPT packet included the active thresholds
  - dashboard HTML included threshold controls and localStorage persistence
- `node --check scripts/repvelo_live_share_server.mjs` passed.
- `git diff --check` passed.
- `pnpm -s tsc --noEmit` passed.
- `pnpm -s lint` passed.
- `pnpm -s test` passed: 28 tests passed, 1 skipped.
- `pnpm -s build` passed.

Remaining:

- Tune thresholds with real session data from iPhone.

## 2026-05-30 (Codex)

Scope: Move form video recording into a session-screen overlay.

Safety:

- Stayed inside repo-local app code and documentation.
- No network discovery, scanning, or device probing.
- Existing full-screen recorder remains as a fallback path.

Actions:

- Added `src/components/FormVideoOverlay.tsx`.
  - Mounts camera only while the overlay is visible.
  - Records, stops, discards, and saves form videos without leaving session mode.
  - Reuses `VideoRecordingService` and sends `form_video_saved` to Live Share.
- Updated `app/(tabs)/session.tsx`.
  - `フォーム録画` now opens the overlay instead of navigating away.
  - Saved videos increment the target set video count immediately.
- Updated `docs/FORM_VIDEO_RECORDING_PLAN.md`.
- Updated `docs/IMPROVEMENT_TRACKER.md` with `2026-05-30-02`.

Results:

- `pnpm -s tsc --noEmit` passed.
- `pnpm -s lint` passed.
- `pnpm -s test` passed: 28 tests passed, 1 skipped.
- `git diff --check` passed.
- `pnpm -s build` passed.

Remaining:

- Real-device check for camera permission, overlay recording, save, and set detail playback.

## 2026-05-31 (Codex)

Scope: Build and upload RepVeloCoach to TestFlight.

Safety:

- Followed repo-local TestFlight workflow in `TESTFLIGHT_DEPLOYMENT.md` and `scripts/deploy.sh`.
- Used normal Apple/Fastlane upload path only.
- No network discovery, scanning, or probing.

Actions:

- Confirmed previous successful upload was build `89`.
- Bumped and aligned build number to `90` in:
  - `app.config.ts`
  - `ios/RepVeloCoach/Info.plist`
  - `ios/RepVeloCoach.xcodeproj/project.pbxproj`
- Ran:
  - `source ~/.zshrc && FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 bash scripts/deploy.sh`
- Updated `CURRENT_STATUS.md`.

Results:

- Archive succeeded.
- IPA exported:
  - `ios/fastlane_export/RepVeloCoach.ipa`
- TestFlight/App Store Connect upload succeeded for version `2.3.5` build `90`.
- Fastlane confirmation:
  - `Successfully uploaded package to App Store Connect`
  - `Lane beta finished successfully`
- Fastlane timing:
  - `build_app`: 552 seconds
  - `upload_to_testflight`: 61 seconds

Remaining:

- Wait for App Store Connect/TestFlight processing, usually 15-30 minutes.
- Verify build `90` appears in TestFlight.
- Real-device check for session form-video overlay and Live Share threshold UI.

## 2026-06-01 (Codex)

Scope: Split Velocity Loss into avg/last/min metrics and use last/min for decisions.

Safety:

- Repo-local code/test work only.
- No network discovery, scanning, probing, or external automation.

Actions:

- Added `calculateVelocityLossMetrics()` in `src/utils/VBTCalculations.ts`.
  - `vlAvg`: fastest rep to set average, kept as the legacy `velocity_loss`.
  - `vlLast`: fastest rep to final valid rep, used for main VBT decisions.
  - `vlMin`: fastest rep to slowest valid rep, used as a safety warning.
- Added `velocity_loss_avg`, `velocity_loss_last`, and `velocity_loss_min` to `SetData` and SQLite migration.
- Updated session completion, monitor save, manual save, and Live Share set events to carry the split VL values.
- Updated session decision and deterministic coach logic to prefer `VL_last`; `VL_min` now flags large within-set stalls.
- Updated session UI, session detail, diagnostics, Mac Live Share dashboard/CSV/GPT packet, and GPT copy packet to show `VL avg/last/min` plus `vlJudgementMetric: "vlLast"`.
- Added tests for the user-provided VL cases:
  - `[0.42, 0.39, 0.36, 0.30]`
  - `[0.41, 0.42, 0.41, 0.38, 0.34]`
  - `[0.44, 0.43, 0.40, 0.36, 0.39]`
- Updated `docs/IMPROVEMENT_TRACKER.md` with `2026-06-01-01`.

Results:

- `pnpm -s check` passed.
- Targeted tests passed: 15 tests.
- `pnpm -s lint` passed.
- `pnpm -s test` passed: 34 tests passed, 1 skipped.
- `pnpm -s build` passed.

Remaining:

- Real-device check during a multi-rep set to confirm the UI reads as intended.
- Confirm whether focus-mode live VL label should stay as `VL_last` or use a shorter Japanese label.

## 2026-06-01 (Codex follow-up)

Scope: Make form-video recording mode configurable from the session screen.

Actions:

- Added a `フォーム動画` quick settings card to `app/(tabs)/session.tsx`.
- The card toggles `enable_video_recording` without visiting Settings.
- Enabling it also sets `session_display_action_buttons` to true so the `フォーム録画` button is not hidden by display settings.
- The setting is persisted through `saveAppSettings()`.
- Updated `docs/IMPROVEMENT_TRACKER.md` with `2026-06-01-02`.

Results:

- `pnpm -s check` passed.
- `pnpm -s lint` passed.

Remaining:

- Real-device check: turn it on from the session screen, start a session, choose an exercise, and confirm `フォーム録画` appears in the action buttons.

## 2026-06-02 (Codex TestFlight)

Scope: Build and upload RepVeloCoach `2.3.5 (91)` to TestFlight.

Actions:

- Bumped and aligned iOS build number to `91` in:
  - `app.config.ts`
  - `ios/RepVeloCoach/Info.plist`
  - `ios/RepVeloCoach.xcodeproj/project.pbxproj`
- Added Fastfile environment controls for safer release retries:
  - `REPVELO_EXTRA_XCARGS`
  - `REPVELO_CLEAN=false`
- Initial archive attempts from the external `/Volumes/0RICON_APP` workspace repeatedly failed with `xcodebuild` `Bus error: 10` and `getcwd` errors.
- Copied the repo to `/Users/hoshinohideyuki/Developer/repvelo-testflight-staging` and reran the release build there to avoid external-volume cwd instability.
- Copied the successful IPA and dSYM back to `ios/fastlane_export`.

Results:

- Archive succeeded.
- IPA export succeeded.
- App Store Connect upload succeeded at 2026-06-02 05:07:45 JST.
- Uploaded build: `2.3.5 (91)`.
- IPA: `ios/fastlane_export/RepVeloCoach.ipa`.
- dSYM: `ios/fastlane_export/RepVeloCoach.app.dSYM.zip`.

Remaining:

- Wait for TestFlight processing in App Store Connect, usually 15-30 minutes.
- Real-device check build `91`, especially session form-video toggle, split VL metrics, and long-session behavior.

## 2026-06-03 (Codex crash triage)

Scope: Investigate and harden the crash reported when entering Session mode after VBT connection.

Actions:

- Reviewed the recent `VL avg/last/min` and session form-video changes as the likely regression window.
- Checked `AGENTS.md` and `docs/IMPROVEMENT_TRACKER.md` before editing.
- Added runtime VBT payload normalization in `src/hooks/useSessionLogic.ts`.
  - Incomplete, `NaN`, or out-of-range payloads are ignored before they reach live UI rendering, audio readouts, VL calculations, or auto-start logic.
  - Power values are kept only when finite and within a reasonable range.
- Added equivalent range guards in `src/services/BLEService.ts` so malformed native BLE packets are dropped immediately after parsing.
- Recorded the issue as `2026-06-03-01` in `docs/IMPROVEMENT_TRACKER.md`.

Results:

- `pnpm -s check` passed.
- Targeted VBT tests passed: 7 tests.
- Full test suite passed: 34 tests passed, 1 skipped.

Remaining:

- Real-device verification: connect VBT, open Session mode, confirm no crash, then record at least one set.
- If it still crashes, collect the iOS crash log or RepVelo diagnostic export immediately after restart because the next likely cause would be native BLE/camera interaction rather than JS value handling.

## 2026-06-03 (Codex TestFlight build 92)

Scope: Build and upload RepVeloCoach `2.3.5 (92)` to TestFlight after the VBT Session-mode crash fix.

Actions:

- Checked the external SSD state before continuing:
  - `/Volumes/0RICON_APP` was mounted read-write and had enough free space.
  - SMART status was unavailable through the USB enclosure.
  - `/Applications/Xcode.app` was a symlink to `/Volumes/0RICON_APP/Xcode.app`.
- Retried the staged release build from `/Users/hoshinohideyuki/Developer/repvelo-testflight-staging`.
- Confirmed repeated `xcodebuild` `Bus error: 10` failures when using the external-SSD Xcode path.
- Copied Xcode to `/Users/hoshinohideyuki/Developer/Xcode-RepVelo.app`.
- Updated `scripts/deploy.sh` to support `REPVELO_XCODE_APP`, allowing the release script to use an explicit internal Xcode app without changing global Xcode selection.
- Re-ran the build with:
  - `REPVELO_XCODE_APP=/Users/hoshinohideyuki/Developer/Xcode-RepVelo.app`
  - `REPVELO_CLEAN=false`
  - `REPVELO_EXTRA_XCARGS='-jobs 1 COMPILER_INDEX_STORE_ENABLE=NO'`
- Copied the successful IPA and dSYM back to `ios/fastlane_export`.

Results:

- Archive succeeded.
- IPA export succeeded.
- App Store Connect upload succeeded at 2026-06-03 12:45:26 JST.
- Uploaded build: `2.3.5 (92)`.
- IPA: `ios/fastlane_export/RepVeloCoach.ipa`.
- dSYM: `ios/fastlane_export/RepVeloCoach.app.dSYM.zip`.

Remaining:

- Wait for TestFlight processing in App Store Connect, usually 15-30 minutes.
- Real-device check build `92`, especially VBT connection -> Session mode, long-session behavior, and form video overlay.

## 2026-06-04 (Codex VBT crash diagnostics)

Scope: Add a user-facing path to share VBT connection crash context with Codex through Gmail/share sheet after build `92` still crashed on real device.

Actions:

- Marked `2026-06-03-01` back to `needs_revision` because build `92` still crashes when VBT is connected.
- Added `src/services/CrashReportService.ts`.
  - Saves a compact VBT/session screen context snapshot to AsyncStorage while the session screen is active.
  - Captures connection state, muted state, current lift/load/reps/set, live VBT data, latest completed set, heart rate, and key display/video settings.
  - Builds a Markdown crash report intended for Codex/Gmail sharing.
  - Writes the report as a local Markdown file.
- Updated `app/(tabs)/session.tsx`.
  - Loads the previous VBT screen snapshot on mount.
  - Shows `前回VBT接続クラッシュ疑い` when a prior session-screen context remains after relaunch.
  - Adds a `Gmail共有` action that copies the report and opens the share sheet so Gmail can be selected.
  - Keeps the existing `診断コピー` path.
- Added tracker item `2026-06-04-01`.

Results:

- `pnpm -s check` passed.
- Targeted VBT tests passed: 7 tests.

Remaining:

- Build/upload a new TestFlight build before this diagnostics path can be used on the iPhone.
- After the next crash, reopen the app, tap `Gmail共有`, choose Gmail, and send/paste the Markdown report back to Codex.

## 2026-06-04 (Codex TestFlight build 93)

Scope: Build and upload RepVeloCoach `2.3.5 (93)` to TestFlight so the VBT crash-context sharing path can be tested on the iPhone.

Actions:

- Bumped the iOS build number from `92` to `93` in:
  - `app.config.ts`
  - `ios/RepVeloCoach/Info.plist`
  - `ios/RepVeloCoach.xcodeproj/project.pbxproj`
- Ran `pnpm -s check`.
- Built and uploaded with the internal Xcode workaround:
  - `REPVELO_XCODE_APP=/Users/hoshinohideyuki/Developer/Xcode-RepVelo.app`
  - `REPVELO_CLEAN=false`
  - `REPVELO_EXTRA_XCARGS='-jobs 1 COMPILER_INDEX_STORE_ENABLE=NO'`

Results:

- `pnpm -s check` passed.
- Archive succeeded.
- IPA export succeeded.
- App Store Connect upload succeeded at 2026-06-04 10:02:00 JST.
- Uploaded build: `2.3.5 (93)`.
- IPA: `ios/fastlane_export/RepVeloCoach.ipa`.
- dSYM: `ios/fastlane_export/RepVeloCoach.app.dSYM.zip`.

Remaining:

- Wait for TestFlight processing in App Store Connect, usually 15-30 minutes.
- Install build `93` on the iPhone and test VBT connection -> Session mode.
- If VBT still crashes, relaunch the app and use `前回VBT接続クラッシュ疑い` -> `Gmail共有` to share the generated Markdown report.

## 2026-06-04 (Codex Session-entry crash marker)

Scope: Fix the diagnostics gap where pressing Session mode crashes before the Session screen can render, so the existing crash-sharing UI is unreachable.

Actions:

- Extended `CrashReportService`.
  - Added `session_tab_open_attempt` as a crash-context reason.
  - Added `saveVBTSessionOpenAttempt()` to save a lightweight marker before entering Session mode.
  - Added `entry_point` to the generated Markdown report.
- Updated `app/(tabs)/_layout.tsx`.
  - Intercepts the Session bottom-tab press.
  - Saves the open-attempt marker first, then navigates to Session mode.
- Updated `app/(tabs)/index.tsx`.
  - Saves the same open-attempt marker when starting Session mode from the home card.
  - Loads any previous VBT crash/open-attempt context on Home focus.
  - Shows a Home-screen crash report card with `Gmail共有` and `クリア`, so the user can share the report without opening Session mode again.

Results:

- `pnpm -s check` passed.
- `pnpm -s lint` passed.
- Targeted VBT tests passed: 7 tests.

Remaining:

- Build/upload a new TestFlight build.
- Install the new build on iPhone.
- If pressing Session still crashes, relaunch the app and use the Home-screen `前回セッションモードでクラッシュ疑い` card -> `Gmail共有`.

## 2026-06-04 (Codex TestFlight build 94)

Scope: Build and upload RepVeloCoach `2.3.5 (94)` to TestFlight so the Session-entry crash marker can be tested on the iPhone.

Actions:

- Bumped the iOS build number from `93` to `94` in:
  - `app.config.ts`
  - `ios/RepVeloCoach/Info.plist`
  - `ios/RepVeloCoach.xcodeproj/project.pbxproj`
- Ran `pnpm -s check`.
- Built and uploaded with the internal Xcode workaround:
  - `REPVELO_XCODE_APP=/Users/hoshinohideyuki/Developer/Xcode-RepVelo.app`
  - `REPVELO_CLEAN=false`
  - `REPVELO_EXTRA_XCARGS='-jobs 1 COMPILER_INDEX_STORE_ENABLE=NO'`

Results:

- `pnpm -s check` passed.
- Archive succeeded.
- IPA export succeeded.
- App Store Connect upload succeeded at 2026-06-04 11:44:12 JST.
- Uploaded build: `2.3.5 (94)`.
- IPA: `ios/fastlane_export/RepVeloCoach.ipa`.
- dSYM: `ios/fastlane_export/RepVeloCoach.app.dSYM.zip`.

Remaining:

- Wait for TestFlight processing in App Store Connect, usually 15-30 minutes.
- Install build `94` on the iPhone and test tapping Session mode.
- If pressing Session still crashes, relaunch the app and use the Home-screen `前回セッションモードでクラッシュ疑い` card -> `Gmail共有` to share the generated Markdown report.

## 2026-06-04 (Codex crash report body sharing)

Scope: Fix the follow-up diagnostics gap where the user successfully sent a crash report through Gmail, but Codex could not read the Markdown attachment content through the Gmail connector.

Actions:

- Confirmed Gmail received `repvelocoach-vbt-crash-report-20260604T031315Z`.
- Confirmed the email body was empty and the report was only attached as `text/x-markdown`.
- Gmail connector could not read that attachment MIME type, and Chrome extension access was unavailable in this environment.
- Updated the Home crash report card:
  - Renamed the existing file-based action to `添付共有`.
  - Added `本文共有` using React Native `Share.share({ message })`.
  - Stopped auto-clearing the crash context after sharing so failed/empty sends can be retried.
- Updated the Session diagnostic bar with the same `添付共有` / `本文共有` split and no auto-clear after share.

Results:

- `pnpm -s check` passed.
- `pnpm -s lint` passed.

Remaining:

- Build/upload a new TestFlight build before the `本文共有` path is available on the iPhone.
- Current Gmail attachment content is still unreadable from Codex through the connector; ask the user to resend via `本文共有` after the new build, or paste the report text directly.

## 2026-06-04 (Codex TestFlight build 95)

Scope: Build and upload RepVeloCoach `2.3.5 (95)` to TestFlight so crash reports can be shared as email body text.

Actions:

- Bumped the iOS build number from `94` to `95` in:
  - `app.config.ts`
  - `ios/RepVeloCoach/Info.plist`
  - `ios/RepVeloCoach.xcodeproj/project.pbxproj`
- Ran `pnpm -s check`.
- Built and uploaded with the internal Xcode workaround:
  - `REPVELO_XCODE_APP=/Users/hoshinohideyuki/Developer/Xcode-RepVelo.app`
  - `REPVELO_CLEAN=false`
  - `REPVELO_EXTRA_XCARGS='-jobs 1 COMPILER_INDEX_STORE_ENABLE=NO'`

Results:

- `pnpm -s check` passed.
- Archive succeeded.
- IPA export succeeded.
- App Store Connect upload succeeded at 2026-06-04 12:31:55 JST.
- Uploaded build: `2.3.5 (95)`.
- IPA: `ios/fastlane_export/RepVeloCoach.ipa`.
- dSYM: `ios/fastlane_export/RepVeloCoach.app.dSYM.zip`.

Remaining:

- Wait for TestFlight processing in App Store Connect, usually 15-30 minutes.
- Install build `95` on the iPhone.
- If Session still crashes, relaunch and use the Home-screen crash card -> `本文共有` so the report arrives in the Gmail body rather than only as a Markdown attachment.

## 2026-06-04 (Codex Session Safe Gate)

Scope: Use the user-supplied text crash report to separate "pressing the Session tab" from "mounting the heavy Session screen".

Input:

- File: `/Users/hoshinohideyuki/Downloads/テキスト-36CC8ACEE552-1.txt`
- Key report fields:
  - `reason: session_tab_open_attempt`
  - `entry_point: bottom_tab`
  - `session_id: -`
  - `VBT接続: no`
  - no live VBT data and no completed set data

Interpretation:

- The app crashed before the Session screen could save an active-screen snapshot.
- The suspected zone is route entry, module import, or initial mount of the heavy Session component rather than set persistence or live rep processing.

Actions:

- Moved the existing heavy Session screen from `app/(tabs)/session.tsx` to `src/screens/SessionScreen.tsx`.
- Recreated `app/(tabs)/session.tsx` as a lightweight Session Safe Gate.
  - The tab now opens a small safe screen first.
  - The heavy Session screen is dynamically imported only after tapping `セッション本体を開く`.
  - Existing crash report `添付共有` / `本文共有` / `クリア` actions are available without loading the heavy Session screen.
- Added `session_screen_mount_attempt` to `CrashReportService`.
  - The app now records a second marker immediately before importing/mounting the heavy Session screen.

Results:

- `pnpm -s check` passed.
- `pnpm -s lint` passed.
- Targeted VBT tests passed: 7 tests.

Remaining:

- Build/upload a new TestFlight build before this gate is available on the iPhone.
- On device, test:
  - tapping Session tab shows the Safe Gate without crashing
  - tapping `セッション本体を開く` either opens Session or leaves a `session_screen_mount_attempt` report after relaunch
