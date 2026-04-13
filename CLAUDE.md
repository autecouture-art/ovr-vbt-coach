# CLAUDE.md

## Canonical Repo

- Active repo: `/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo`
- Branch: `main`

Do not edit any other folder.

Legacy folders such as:
- `/Volumes/0RICON_APP/Developer/MyFiles/RepVeloCoach`
- `/Volumes/0RICON_APP/Developer/MyFiles/ovr-vbt-coach-local`

are archive/reference only. All edits, scripts, builds, and uploads must come from the canonical repo above.

## Current Project State

- App: `RepVelo VBT Coach`
- Bundle ID: `com.autecouture.repvelocoach.hh`
- Marketing version: `2.3.5`
- Latest successful TestFlight upload: build `75`
- Before the next upload, bump all build-number sources above `75`

## Mandatory Repo Rules

These apply to every agent session.

1. Append every work session to `docs/AGENT_WALKTHROUGH.md`.
2. Read and update `docs/IMPROVEMENT_TRACKER.md` for any new feedback or unmet requirement.
3. Record agent/model switches and why they happened.
4. Record troubleshooting, incidents, and resolutions.
5. Record every TestFlight attempt with build number and outcome.

Tracker ratings:
- `good`
- `almost`
- `bad`
- `untested`

After user testing, touched tasks must end as either `verified` or `needs_revision`.

## Release Source Of Truth

For build and upload work, use only these repo-local files:

- `TESTFLIGHT_DEPLOYMENT.md`
- `scripts/deploy.sh`
- `scripts/upload_only.sh`
- `AGENTS.md`
- `CURRENT_STATUS.md`
- `docs/AGENT_WALKTHROUGH.md`
- `docs/IMPROVEMENT_TRACKER.md`

Do not improvise a separate release flow.
Do not depend on `~/.codex/skills/...` for the actual upload path.

## TestFlight Workflow

### 1. Confirm build numbers

Before every upload, verify all three values and keep them aligned:

```bash
cd /Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo
rg -n "buildNumber|CURRENT_PROJECT_VERSION|CFBundleVersion" \
  app.config.ts \
  ios/RepVeloCoach/Info.plist \
  ios/RepVeloCoach.xcodeproj/project.pbxproj
```

Files to update:
- `app.config.ts` -> `buildNumber`
- `ios/RepVeloCoach/Info.plist` -> `CFBundleVersion`
- `ios/RepVeloCoach.xcodeproj/project.pbxproj` -> `CURRENT_PROJECT_VERSION`

### 2. Standard upload

```bash
cd /Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo
source ~/.zshrc
FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 bash scripts/deploy.sh
```

### 3. Success criteria

Successful upload is confirmed by:
- `Successfully uploaded package to App Store Connect`
- `Lane beta finished successfully`

IPA output:
- `ios/fastlane_export/RepVeloCoach.ipa`

### 4. Re-upload existing IPA only

```bash
cd /Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo
source ~/.zshrc
bash scripts/upload_only.sh
```

### 5. After every upload attempt

Always update:
- `docs/AGENT_WALKTHROUGH.md`
- `CURRENT_STATUS.md`

Include:
- build number
- success/failure
- first fatal error if failed
- env overrides used, such as `FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT` and `FASTLANE_XCODEBUILD_SETTINGS_RETRIES`

## Common Upload Failures

- `bundle version must be higher`
  - bump build number in all three files
- `ASC_KEY_ID is not set` or `ASC_ISSUER_ID is not set`
  - run `source ~/.zshrc`
- `Missing App Store Connect key`
  - confirm `fastlane/api_key.p8`
- `xcodebuild -showBuildSettings` timeout
  - rerun with the timeout/retry env vars above

## Collaboration Model

- Claude can implement.
- GLM can be used through Claude CLI when usage limits or task routing make that preferable.
- Codex should review integration, repo correctness, and release safety when needed.

When in doubt:
- trust the canonical repo path
- trust repo-local release scripts
- update the walkthrough and tracker before ending the session
