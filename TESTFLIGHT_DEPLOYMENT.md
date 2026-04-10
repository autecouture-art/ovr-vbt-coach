# RepVeloCoach TestFlight Deployment

このドキュメントは Codex / Claude / GLM / Gemini のどのエージェントでも同じ手順で RepVeloCoach を TestFlight に上げられるようにするための正本です。

## Canonical Repo

- Repo root: `/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo`
- Bundle ID: `com.autecouture.repvelocoach.hh`
- App name: `RepVelo VBT Coach`
- Xcode workspace: `ios/RepVeloCoach.xcworkspace`

## Required Files And Env

必要なもの:

- `fastlane/api_key.p8`
- `RepVeloCoach_AppStore.mobileprovision`
- `ASC_KEY_ID`
- `ASC_ISSUER_ID`
- `bundle` コマンド
- `/Applications/Xcode.app`

補足:

- `ASC_KEY_ID` と `ASC_ISSUER_ID` はシェル初期化ファイルに export 済みでもよい
- スクリプトは `xcode-select` の切替に失敗しても `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer` で続行する

## Build Number Rule

新しい TestFlight 配信前には build number を必ず前回より大きい値に上げる。

確認箇所:

- `app.config.ts`
- `ios/RepVeloCoach/Info.plist`
- `ios/RepVeloCoach.xcodeproj/project.pbxproj`

この repo では `ios/` が ignore されているため、native 側の build metadata は git に乗らないことがある。アップロード前に実ファイル値が正しいことを必ず確認する。

確認コマンド:

```bash
cd /Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo
rg -n "buildNumber|CURRENT_PROJECT_VERSION|CFBundleVersion" app.config.ts ios/RepVeloCoach/Info.plist ios/RepVeloCoach.xcodeproj/project.pbxproj
```

## Standard Upload

通常の build + TestFlight upload:

```bash
cd /Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo
source ~/.zshrc
bash scripts/deploy.sh
```

`xcodebuild -showBuildSettings` が重い環境では以下を使う:

```bash
cd /Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo
source ~/.zshrc
FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 bash scripts/deploy.sh
```

成功判定:

- `Successfully uploaded package to App Store Connect`
- `Lane beta finished successfully`

生成物:

- `ios/fastlane_export/RepVeloCoach.ipa`

## Upload Existing IPA Only

既存 IPA の再アップロード:

```bash
cd /Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo
source ~/.zshrc
bash scripts/upload_only.sh
```

## Reporting Rule

ビルド後は必ず以下を記録する:

- 使用した build number
- 成功/失敗
- 失敗時の最初の致命エラー
- 使用した安定化 env (`FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT`, `FASTLANE_XCODEBUILD_SETTINGS_RETRIES` など)

更新先:

- `docs/AGENT_WALKTHROUGH.md`
- `CURRENT_STATUS.md`

## For Claude

Claude でビルドするときも `~/.codex/skills/...` は前提にしない。
repo 内の以下だけを使う:

- `scripts/deploy.sh`
- `scripts/upload_only.sh`
- `TESTFLIGHT_DEPLOYMENT.md`
- `AGENTS.md`
- `CURRENT_STATUS.md`

## Common Failure Patterns

- `bundle version must be higher`
  - build number を上げる
- `ASC_KEY_ID is not set` / `ASC_ISSUER_ID is not set`
  - `source ~/.zshrc` して env を読み直す
- `Missing App Store Connect key`
  - `fastlane/api_key.p8` の有無を確認
- `xcodebuild -showBuildSettings` timeout
  - timeout/retries env を付けて再実行
- Pods / Expo / JS bundle warnings
  - 多くは既知警告。最初の fatal error が出るまでは止めない
