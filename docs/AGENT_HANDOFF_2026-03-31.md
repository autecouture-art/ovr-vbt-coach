# Agent Handoff 2026-03-31

## Start Here
This project must be continued from:
- /Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo

Do not assume similarly named folders are current. Use them only for comparison if a missing asset or older implementation must be recovered.

## Snapshot
- Branch: main
- HEAD: 8ea0d55 (`Fix exercise selection after category`)
- Version: `2.3.5`
- Latest uploaded native build: `71`
- Working tree is dirty with 6 modified app files related to session UX and GLM.

## What The User Cares About Most
- Stable TestFlight builds from the correct repo only.
- AI Coach / GLM actually sending successfully, not only passing status check.
- Session flow clarity on-device.
- Reliable agent handoff so model switches do not lose context.

## Latest Local Changes Not Yet Fully Closed Out
- `src/services/LocalLLMService.ts`
  - direct GLM config from SecureStore
  - endpoint fallback between `/api/anthropic` and `/api/paas/v4/chat/completions`
  - history normalization to avoid bad message ordering
- `app/coach-chat.tsx`
  - direct-connect verification shown in UI
  - outbound history excludes initial welcome message
  - error message now includes short failure detail
- `app/(tabs)/session.tsx` and `src/hooks/useSessionLogic.ts`
  - immediate post-set refresh
  - recording-state framing
  - per-set 1RM update
- `src/components/ExerciseSelectModal.tsx`
  - category chip size and selection UX adjustments
- `src/services/AudioService.ts`
  - attempted reduction of music interruption side effects

## Open Risks
- The latest GLM send fix is type-checked but not yet confirmed on TestFlight after the history normalization patch.
- `app.config.ts` still says iOS build number `65` while native `Info.plist` says `71`.
- If an agent builds next, it must reconcile build numbering first.

## Operational Rules
- Read `AGENTS.md` before continuing.
- Append a dated entry to `docs/AGENT_WALKTHROUGH.md` every session.
- If the active model changes, record the switch explicitly.
- If a TestFlight upload is attempted, record build number, command, retry env vars, and outcome.

## Standard Commands
Validation:
- `pnpm -s tsc --noEmit`

Recent successful upload pattern:
- `FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 bash ~/.codex/skills/testflight-upload/scripts/deploy.sh`

## Immediate Next Action
- Build from the canonical repo after bumping native build number above `71`, then verify AI Coach live send on device.
