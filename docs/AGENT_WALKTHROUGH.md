# Agent Walkthrough Log

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
