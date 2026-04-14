# RepVeloCoach Current Status

## Canonical Workspace
- Repo root: /Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo
- Branch: main
- HEAD at record time: ec178af (`Bump iOS build number to 76 for TestFlight`)
- Treat this repo as the only active source of truth.
- Legacy folders such as `/Volumes/0RICON_APP/Developer/MyFiles/RepVeloCoach` and `/Volumes/0RICON_APP/Developer/MyFiles/ovr-vbt-coach-local` are reference/archive only unless explicitly proven newer.

## Release State
- App name: RepVelo VBT Coach
- iOS bundle id: `com.autecouture.repvelocoach.hh`
- Marketing version: `2.3.5`
- Native iOS build number in `ios/RepVeloCoach/Info.plist`: `76`
- Expo config build number in `app.config.ts`: `76`
- Latest known successful TestFlight upload: build `76` (uploaded from this repo; processing delay on App Store Connect is normal)

## Important Mismatch
- `app.config.ts`, `ios/RepVeloCoach/Info.plist`, and `ios/RepVeloCoach.xcodeproj/project.pbxproj` are now aligned at build `76`.
- Before the next release, bump to a value higher than `76` and keep all three sources synchronized.

## Current Working Tree
- Working tree was clean immediately before the successful build `76` upload.

## What Was Implemented Recently
- Added direct GLM mode using locally stored API key and API URL.
- Added verification path for GLM connectivity in AI Coach screen.
- Added fallback between Anthropic-compatible and OpenAI-compatible Z.AI endpoints.
- Added richer AI Coach error reporting instead of a generic failure only.
- Added immediate post-set refresh logic so set detail becomes visible sooner after finishing a set.
- Added per-set 1RM update logic in session flow.
- Added recording-state visual frame in session mode.
- Reduced exercise category chip height and improved exercise selection behavior.
- Adjusted audio session behavior to reduce music interruption side effects.
- Added persisted settings toggles for warmup recommendations, rep count readout, velocity readout, and the "もっと速く" cue.
- Added per-exercise setup-rep handling with `ignore_first_rep_as_setup` and session-side setup exclusion.
- Expanded session history with exercise labels, power, and mini velocity charts.
- Added post-hoc set weight editing and tied set-history updates to `lift + set_index`.

## Known Problems To Continue From
- AI Coach direct mode now classifies Z.AI `401` responses more clearly; the latest device screenshot indicates the stored API key is invalid or expired, not that the endpoint is unreachable.
- A likely cause was invalid history shape for Anthropic-compatible requests when conversation history began with an assistant message.
- A local fix has already been applied in working tree:
  - normalize history before sending
  - drop leading assistant messages
  - exclude the welcome message from outbound history
- This fix passed `pnpm -s tsc --noEmit` locally, was committed, and shipped in TestFlight build `72`, but still needs real-device verification.
- Exercise selection ergonomics were improved, but user feedback should still verify category chip sizing and list visibility.
- AirPods/HealthKit heart-rate ingestion is still backed by a stub `HealthService`; the rest-timer UI is ready, but actual live HR capture still needs native integration.
- Audio/music resume behavior after voice prompts still needs real-device confirmation.

- Historical session detail now supports editing set load, RPE, and notes, with rep/load/session aggregates kept in sync.

## Validation Status
- TypeScript check passed after the latest GLM history normalization change: `pnpm -s tsc --noEmit`
- TestFlight upload succeeded for version `2.3.5` build `76`.
- Build numbers are now aligned across all three sources (app.config.ts, Info.plist, project.pbxproj).
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
1. Wait for App Store Connect/TestFlight processing for build `76` (usually 15-30 minutes).
2. Device-test TestFlight build `76`, focusing on:
   - Recent exercise history card behavior
   - Auto-finish on background feature
   - AI Coach send path
   - Session detail appearing immediately after set completion
   - Category/exercise picker usability
   - Audio interruption and resume behavior
3. Only after device verification, decide the next build bump and next TestFlight upload.
