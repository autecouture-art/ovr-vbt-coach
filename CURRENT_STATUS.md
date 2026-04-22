# RepVeloCoach Current Status

## Canonical Workspace
- Repo root: /Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo
- Branch: main
- HEAD at record time: 9bc01da (`Bump iOS build number to 80 for TestFlight`)
- Treat this repo as the only active source of truth.
- Legacy folders such as `/Volumes/0RICON_APP/Developer/MyFiles/RepVeloCoach` and `/Volumes/0RICON_APP/Developer/MyFiles/ovr-vbt-coach-local` are reference/archive only unless explicitly proven newer.

## Release State
- App name: RepVelo VBT Coach
- iOS bundle id: `com.autecouture.repvelocoach.hh`
- Marketing version: `2.3.5`
- Native iOS build number in `ios/RepVeloCoach/Info.plist`: `80`
- Expo config build number in `app.config.ts`: `80`
- Latest successful TestFlight upload: build `80` (uploaded 2026-04-22 13:01:04 JST)

## Build Number Status
- `app.config.ts`, `ios/RepVeloCoach/Info.plist`, and `ios/RepVeloCoach.xcodeproj/project.pbxproj` are aligned at build `80`.
- For the next release, bump to a value higher than `80` and keep all three sources synchronized.

## Current Working Tree
- Working tree was clean immediately before the successful build `76` upload.

## What Was Implemented Recently (Build 80)
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
- TestFlight upload succeeded for version `2.3.5` build `80`.
- Build numbers are aligned across all three sources (app.config.ts, Info.plist, project.pbxproj) at `80`.
- Real-device verification is still required for:
  - AI Coach live send success
  - Session detail appearing immediately after set completion
  - Category/exercise picker usability
  - Audio interruption and resume behavior
  - Recent exercise history card behavior
  - Auto-finish on background feature

## Build And Upload
Use the repo-local canonical path above. The agent-neutral release workflow is documented in:
- `TESTFLIGHT_DEPLOYMENT.md`
- `scripts/deploy.sh`
- `scripts/upload_only.sh`

Typical upload command:
- `source ~/.zshrc && FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 bash scripts/deploy.sh`

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
1. Device-test build 80 focusing on:
   - VL settings UI functionality (toggle and threshold buttons)
   - Audio ducking effectiveness during voice announcements
   - Performance improvements in long sessions (50+ sets)
   - Session history power display accuracy
   - Auto-start functionality
   - First session recording behavior
2. Monitor TestFlight processing (usually 15-30 minutes) and verify build appears in TestFlight
3. After device verification, decide next improvements based on user feedback
