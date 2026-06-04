# RepVeloCoach Current Status

## Canonical Workspace
- Repo root: /Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo
- Branch: main
- HEAD at record time: current `chore: record TestFlight build 94` commit
- Treat this repo as the only active source of truth.
- Legacy folders such as `/Volumes/0RICON_APP/Developer/MyFiles/RepVeloCoach` and `/Volumes/0RICON_APP/Developer/MyFiles/ovr-vbt-coach-local` are reference/archive only unless explicitly proven newer.

## Release State
- App name: RepVelo VBT Coach
- iOS bundle id: `com.autecouture.repvelocoach.hh`
- Marketing version: `2.3.5`
- Native iOS build number in `ios/RepVeloCoach/Info.plist`: `94`
- Expo config build number in `app.config.ts`: `94`
- Latest successful TestFlight upload: build `94` (uploaded 2026-06-04 11:44:12 JST)

## Build Number Status
- `app.config.ts`, `ios/RepVeloCoach/Info.plist`, and `ios/RepVeloCoach.xcodeproj/project.pbxproj` are aligned at build `94`.
- For the next release, bump to a value higher than `94` and keep all three sources synchronized.

## Current Working Tree
- Working tree was clean immediately after recording the successful build `94` upload.

## What Was Implemented Recently
- **Phase 1 & 2 Improvements** (build 78):
  - VL warning toggle in settings
  - Volume control UI (25/50/75/100%)
  - Memory leak fix (array slicing)
  - HR recovery signal display (blue/yellow/red)
  - 1eRM prediction improvement
  - Dynamic velocity zones
  - Manual rep entry modal
- **Build 79 Fixes**:
  - Performance issue: Fixed setHistory memory leak (limited to 50 sets)
  - First session recording twice: Investigated auto-start functionality
- **Build 80 Improvements**:
  - VL settings UI added to session screen (toggle + threshold buttons)
  - Audio ducking implemented for iOS/Android (music lowers during voice announcements)
  - TrainingStore optimized with array size limits
- **Build 89 Improvements**:
  - Session freeze-risk reduction through narrower store subscriptions, lighter recovery/detail loading, and persisted recovery snapshots.
  - VBT decision summary with working-set AV/ROM/HR trends, fatigue/form flags, PR stage handling, and ChatGPT copy packet.
  - AI coach screens/services removed in favor of detailed GPT handoff context.
  - Exercise catalog cleanup: Katakana aliases such as ナローベンチ/ローバー/ハイバー migrate to English canonical names.
  - Mac exercise catalog GUI added via `pnpm exercise:gui`.
- **Build 90 Improvements**:
  - Live Share dashboard thresholds can be adjusted from the Mac dashboard.
  - Session screen form video recording now opens as an overlay instead of leaving the session screen.
  - Existing full-screen recorder remains available as a fallback path.
- **Build 91 Release**:
  - TestFlight rebuild containing the split VL metrics and session-screen form video toggle.
  - Fastlane now supports safer retry controls for low-parallel archives.
- **Build 92 Release**:
  - Hardened VBT/BLE payload handling to prevent crashes when opening Session mode after VBT connection.
  - Confirmed external SSD volume was mounted and writable, but external-Xcode execution still reproduced `xcodebuild` `Bus error: 10`.
  - TestFlight build succeeded by running the staged archive with an internal copy of Xcode via `REPVELO_XCODE_APP`.
- **Build 93 Release**:
  - Added a VBT/session crash-context sharing path from the Session screen, including Markdown generation, clipboard copy, and share-sheet handoff.
- **Build 94 Release**:
  - Added a Session-entry crash marker before navigating to Session mode from both the bottom tab and Home card.
  - Added a Home-screen `前回セッションモードでクラッシュ疑い` card so crash context can be shared after relaunch even if Session mode itself crashes before rendering.
- Previous implementations:
  - Direct GLM mode with local API key
  - AI Coach error reporting improvements
  - Post-set refresh logic
  - Per-set 1RM update
  - Recording-state visual frame
  - Exercise selection improvements
  - Audio session behavior adjustments
  - Persisted settings toggles
  - Per-exercise setup-rep handling
  - Session history expansion with power display
  - Post-hoc set weight editing

## Known Problems To Continue From
- AI Coach direct mode now classifies Z.AI `401` responses more clearly; the latest device screenshot indicates the stored API key is invalid or expired, not that the endpoint is unreachable.
- A likely cause was invalid history shape for Anthropic-compatible requests when conversation history began with an assistant message.
- A local fix has already been applied in working tree:
  - normalize history before sending
  - drop leading assistant messages
  - exclude the welcome message from outbound history
- This fix passed `pnpm -s tsc --noEmit` locally, was committed, and shipped in TestFlight build `72`, but still needs real-device verification.
- Exercise selection ergonomics were improved, but user feedback should still verify category chip sizing and list visibility.
- AirPods Pro 3 / HealthKit live heart-rate ingestion is now implemented with a native iOS bridge; simulator build succeeded, but real-device verification is still required.
- Audio/music resume behavior after voice prompts still needs real-device confirmation.
- AirPods Pro 3 heart-rate flow still needs on-device permission and live-stream validation.

- Historical session detail now supports editing set load, RPE, and notes, with rep/load/session aggregates kept in sync.
- Session heart-rate UI now accepts HealthKit live updates through `currentHeartRate` and shows them in the session telemetry area and rest timer.

## Validation Status
- TypeScript check passed: `pnpm -s tsc --noEmit`
- TestFlight upload succeeded for version `2.3.5` build `94`.
- Build numbers are aligned across all three sources (app.config.ts, Info.plist, project.pbxproj) at `94`.
- Real-device verification is still required for:
  - AI Coach live send success
  - Session detail appearing immediately after set completion
  - Category/exercise picker usability
  - Audio interruption and resume behavior
  - Recent exercise history card behavior
  - Auto-finish on background feature

## Latest TestFlight Upload (2026-05-31)
- Version: `2.3.5`
- Build: `90`
- Upload result: succeeded at 2026-05-31 21:02:56 JST
- IPA: `ios/fastlane_export/RepVeloCoach.ipa`
- Command: `source ~/.zshrc && FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 bash scripts/deploy.sh`
- Notes: build number was bumped and aligned from 89 to 90 before upload. TestFlight processing may take 15-30 minutes.

## Latest TestFlight Upload (2026-06-02)
- Version: `2.3.5`
- Build: `91`
- Upload result: succeeded at 2026-06-02 05:07:45 JST
- IPA: `ios/fastlane_export/RepVeloCoach.ipa`
- dSYM: `ios/fastlane_export/RepVeloCoach.app.dSYM.zip`
- Command: `source ~/.zshrc && REPVELO_CLEAN=false REPVELO_EXTRA_XCARGS='-jobs 1 COMPILER_INDEX_STORE_ENABLE=NO' FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 bash scripts/deploy.sh`
- Notes: external-volume builds repeatedly hit `xcodebuild` `Bus error: 10` with `getcwd` errors, so the repo was copied to `/Users/hoshinohideyuki/Developer/repvelo-testflight-staging` for the archive/upload. The exported IPA and dSYM were copied back to `ios/fastlane_export`. TestFlight processing may take 15-30 minutes.

## Latest TestFlight Upload (2026-06-03)
- Version: `2.3.5`
- Build: `92`
- Upload result: succeeded at 2026-06-03 12:45:26 JST
- IPA: `ios/fastlane_export/RepVeloCoach.ipa`
- dSYM: `ios/fastlane_export/RepVeloCoach.app.dSYM.zip`
- Command: `source ~/.zshrc && REPVELO_XCODE_APP=/Users/hoshinohideyuki/Developer/Xcode-RepVelo.app REPVELO_CLEAN=false REPVELO_EXTRA_XCARGS='-jobs 1 COMPILER_INDEX_STORE_ENABLE=NO' FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 bash scripts/deploy.sh`
- Notes: `/Volumes/0RICON_APP` was mounted read-write with sufficient free space, but `/Applications/Xcode.app` points to the external SSD and repeated archive attempts hit `xcodebuild` `Bus error: 10`. Copying Xcode to `/Users/hoshinohideyuki/Developer/Xcode-RepVelo.app` and using `REPVELO_XCODE_APP` allowed archive, IPA export, and App Store Connect upload to complete. TestFlight processing may take 15-30 minutes.

## Latest TestFlight Upload (2026-06-04)
- Version: `2.3.5`
- Build: `93`
- Upload result: succeeded at 2026-06-04 10:02:00 JST
- IPA: `ios/fastlane_export/RepVeloCoach.ipa`
- dSYM: `ios/fastlane_export/RepVeloCoach.app.dSYM.zip`
- Command: `source ~/.zshrc && REPVELO_XCODE_APP=/Users/hoshinohideyuki/Developer/Xcode-RepVelo.app REPVELO_CLEAN=false REPVELO_EXTRA_XCARGS='-jobs 1 COMPILER_INDEX_STORE_ENABLE=NO' FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 bash scripts/deploy.sh`
- Notes: build number was bumped and aligned from 92 to 93 before upload. This build includes the VBT crash context sharing path added after build 92 still crashed on real device. TestFlight processing may take 15-30 minutes.

## Latest TestFlight Upload (2026-06-04)
- Version: `2.3.5`
- Build: `94`
- Upload result: succeeded at 2026-06-04 11:44:12 JST
- IPA: `ios/fastlane_export/RepVeloCoach.ipa`
- dSYM: `ios/fastlane_export/RepVeloCoach.app.dSYM.zip`
- Command: `source ~/.zshrc && REPVELO_XCODE_APP=/Users/hoshinohideyuki/Developer/Xcode-RepVelo.app REPVELO_CLEAN=false REPVELO_EXTRA_XCARGS='-jobs 1 COMPILER_INDEX_STORE_ENABLE=NO' FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 bash scripts/deploy.sh`
- Notes: build number was bumped and aligned from 93 to 94 before upload. This build adds a pre-navigation Session-entry crash marker and Home-screen share card so the user can relaunch and send crash context without reopening Session mode. TestFlight processing may take 15-30 minutes.

## Build And Upload
Use the repo-local canonical path above. The agent-neutral release workflow is documented in:
- `TESTFLIGHT_DEPLOYMENT.md`
- `scripts/deploy.sh`
- `scripts/upload_only.sh`

Typical upload command:
- `source ~/.zshrc && FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 bash scripts/deploy.sh`

If the external `/Volumes/0RICON_APP` workspace hits `xcodebuild` `Bus error: 10` or `getcwd` errors, copy the repo to an internal staging folder and run:
- `source ~/.zshrc && REPVELO_CLEAN=false REPVELO_EXTRA_XCARGS='-jobs 1 COMPILER_INDEX_STORE_ENABLE=NO' FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 bash scripts/deploy.sh`

If `/Applications/Xcode.app` itself is a symlink to the external SSD and `Bus error: 10` continues from the internal staging folder, use an internal Xcode copy:
- `source ~/.zshrc && REPVELO_XCODE_APP=/Users/hoshinohideyuki/Developer/Xcode-RepVelo.app REPVELO_CLEAN=false REPVELO_EXTRA_XCARGS='-jobs 1 COMPILER_INDEX_STORE_ENABLE=NO' FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 bash scripts/deploy.sh`

Rules:
- Bump `CFBundleVersion` in `ios/RepVeloCoach/Info.plist` before any new upload.
- Report the build number used and whether App Store Connect upload succeeded.
- Append every build attempt and incident to `docs/AGENT_WALKTHROUGH.md`.

## Mandatory Agent Handoff Rules
These are already enforced in `AGENTS.md`:
- Always append work sessions to `docs/AGENT_WALKTHROUGH.md`.
- Record agent/model switches.
- Record incidents, fixes, and confirmed outcomes.
- Record TestFlight build numbers and upload results.

## Recommended Next Steps
1. Device-test build 94 focusing on:
   - Long session behavior around 6+ sets and recovery after relaunch.
   - VBT connection -> Session mode no-crash verification.
   - If Session mode still crashes on tap, relaunch and use the Home-screen `前回セッションモードでクラッシュ疑い` card -> `Gmail共有` to send the Markdown crash context.
   - English canonical exercise migration for existing Katakana lift history.
   - VBT decision card readability during rest.
   - GPT copy/open flow.
   - Session history power display accuracy.
   - Auto-start functionality.
2. Monitor TestFlight processing (usually 15-30 minutes) and verify build appears in TestFlight
3. After device verification, decide next improvements based on user feedback
