# RepVeloCoach Current Status

## Build 125 Release Attempt (2026-08-25)
- Version/build source metadata is aligned at `2.3.5 (125)`.
- Validation: `pnpm -s check`, `pnpm -s lint`, `pnpm -s test` (294 passed / 1 skipped), and `git diff --check` passed.
- Upload result: **not uploaded**. External `/Applications/Xcode.app` stopped in Pod compilation with `Failed frontend command`; both internal RepVelo Xcode copies rejected `generic/platform=iOS` because the iOS 26.5 platform component is unavailable.
- No new archive, IPA, dSYM, or App Store Connect package was produced. Build 124 release evidence remains protected.
- Next action: repair the internal Xcode iOS 26.5 platform installation or the external-Xcode frontend issue, then retry build 125 without changing its number.

## Current Supervisor Plan (2026-08-18)
- Week12 plan: `2026-08-18-week12-v2`
- Checksum: `fnv1a32:a1e1e9c7`
- Effective: 2026-08-18 through 2026-08-23
- Mac live-plan publish: confirmed, 15 rows, five rows per day
- Result/goal: SQ 152.5kg succeeded at AV 0.24 and ROM 70.4cm; remaining maximum candidates are BP 110kg and DL 172.5kg
- Remaining-day rule: ramp sets must be marked warm-up, manual RPE is mandatory before every heavier attempt, and missing RPE blocks the next increase
- Device state: fetch/apply and `W12-D2` / `W12-D3` row matching are still required; v2 real-device execution is unverified
- Google Sheet: `Week12_BIG3_PR挑戦_スマホ版_20260818_v2` (same version/checksum, no frozen rows or columns)

## Canonical Workspace
- Repo root: /Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo
- Branch: `codex/product-gui-refresh`
- HEAD at record time: current working tree shipped to TestFlight build 123; repository still contains pre-existing uncommitted changes from multiple feature/fix lanes.
- Treat this repo as the only active source of truth.
- Legacy folders such as `/Volumes/0RICON_APP/Developer/MyFiles/RepVeloCoach` and `/Volumes/0RICON_APP/Developer/MyFiles/ovr-vbt-coach-local` are reference/archive only unless explicitly proven newer.

## Latest TestFlight Upload (2026-08-18)
- Version: `2.3.5`
- Build: `123`
- Bundle ID: `com.autecouture.repvelocoach.hh`
- Upload result: succeeded at 2026-08-18 12:54:37 JST. App Store Connect accepted the package; processing/visibility is asynchronous because the lane skips waiting for processing.
- IPA SHA-256: `a59ea0c4aa14932d005a34520f3d5a7239bad21981f1e85599c9fb8f5709a986`
- dSYM SHA-256: `0b5d627ef3fa14c3da681805807bc80c426e4ac6370ae7dfa5e18e4c17608161`
- IPA: `/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo/ios/fastlane_export/RepVeloCoach.ipa`
- dSYM: `/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo/ios/fastlane_export/RepVeloCoach.app.dSYM.zip`
- Archive: `/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo/ios/build/RepVeloCoach.xcarchive`
- Retained copy: `/Volumes/0RICON_APP/Developer/MyFiles/XcodeArchives/RepVeloCoach/123/`
- Command: `GYM_DERIVED_DATA_PATH=/tmp/codex-builds/repvelocoach/build-123 REPVELO_CLEAN=false REPVELO_EXTRA_XCARGS='CODE_SIGN_ENTITLEMENTS=/private/tmp/codex-managed-temp/repvelocoach-testflight-123-20260818/Release.entitlements -jobs 1 COMPILER_INDEX_STORE_ENABLE=NO' FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 bash scripts/deploy.sh`
- Validation: app `pnpm -s check`, `pnpm -s lint`, `pnpm -s test` (285 passed / 1 skipped), Personal MCP `pnpm -s check`, `pnpm -s build`, `pnpm -s test` (49 passed), `git diff --check`, IPA metadata, and retained-copy hash match.
- Entitlements: HealthKit-only temporary Release entitlements were used because the current distribution profile does not include the App Group capability. The source entitlements file was not changed by this release step.
- Device follow-up: TestFlight install, sensor disconnect/reconnect, resumed-session memo cleanup, supervisor plan fetch/apply/rollback, and real-device VBT/audio/video checks remain pending.

## Release State
- App name: RepVelo VBT Coach
- iOS bundle id: `com.autecouture.repvelocoach.hh`
- Marketing version: `2.3.5`
- Local source build number: `124` in `app.config.ts`, `Info.plist`, and Xcode project.
- Latest successful TestFlight upload: build `123` (uploaded 2026-08-18 12:54:37 JST; processing/visibility pending).
- Build 124: archive/upload not completed on 2026-08-21. Two archive attempts stopped before IPA export/upload with `xcodebuild` `Bus error: 10` after the external volume working path became unavailable (`getcwd` failure). No App Store Connect package was created.

## Build Number Status
- `app.config.ts`, `ios/RepVeloCoach/Info.plist`, and `ios/RepVeloCoach.xcodeproj/project.pbxproj` are aligned at build `124`.
- Build 124 remains available for the next archive retry once the external-volume/Xcode stability issue is resolved; do not reuse a lower build number.

## Latest TestFlight Upload (2026-08-17)
- Version: `2.3.5`
- Build: `122`
- Bundle ID: `com.autecouture.repvelocoach.hh`
- Upload result: succeeded at 2026-08-17 10:48:12 JST. A subsequent App Store Connect API read confirmed processing state `VALID`.
- IPA SHA-256: `575afa7fc10f36926818cbfd971fd967742d1e3cc90532c82f591d3d15309b00`
- IPA: `/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo/ios/fastlane_export/RepVeloCoach.ipa`
- dSYM: `/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo/ios/fastlane_export/RepVeloCoach.app.dSYM.zip`
- Archive: `/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo/ios/build/RepVeloCoach.xcarchive`
- Retained copy: `/Volumes/0RICON_APP/Developer/MyFiles/XcodeArchives/RepVeloCoach/122/`
- Command: `GYM_DERIVED_DATA_PATH=/tmp/codex-builds/repvelocoach/build-122 REPVELO_CLEAN=false REPVELO_EXTRA_XCARGS='CODE_SIGN_ENTITLEMENTS=/private/tmp/codex-managed-temp/repvelocoach-testflight-122/Release.entitlements -jobs 1 COMPILER_INDEX_STORE_ENABLE=NO' FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 bash scripts/deploy.sh`
- Validation: `pnpm -s check`, `pnpm -s lint`, `pnpm -s test -- --run` (282 passed / 1 skipped), `git diff --check`, IPA metadata, signed entitlement inspection, retained-copy hash match, and App Store Connect `VALID` readback.
- Entitlements: HealthKit enabled; App Group absent because the current distribution profile does not include it. BREATHFORGE shared-history access is not included in this build.
- Notes: Ships the current dirty working tree, including the athlete-specific SQ/BP/DL gear catalog. TestFlight client visibility/install and real-device gear selector, SQLite migration, session recovery/export, BLE/VBT behavior remain to be confirmed.

## Latest TestFlight Upload (2026-08-06)
- Version: `2.3.5`
- Build: `118`
- Bundle ID: `com.autecouture.repvelocoach.hh`
- Upload result: succeeded at 2026-08-06 08:51:35 JST. App Store Connect reported the package was uploaded and may take a few minutes to become visible.
- IPA: `/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo/ios/fastlane_export/RepVeloCoach.ipa`
- dSYM: `/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo/ios/fastlane_export/RepVeloCoach.app.dSYM.zip`
- Archive: `/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo/ios/build/RepVeloCoach.xcarchive`
- Retained copy: `/Volumes/0RICON_APP/Developer/MyFiles/XcodeArchives/RepVeloCoach/118/`
- Command: `FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 bash scripts/deploy.sh`
- Validation: `pnpm -s check`, `pnpm -s lint`, `pnpm -s test` (241 passed / 1 skipped), `git diff --check`, IPA metadata (`2.3.5`, build `118`, bundle ID `com.autecouture.repvelocoach.hh`).
- Notes: Ships the external-music protection fix for training audio, VL warning beep, speech feedback, app foreground recovery, and muted form-video recording. TestFlight processing/display and real-device music verification remain pending.

## Latest TestFlight Upload (2026-08-05)
- Version: `2.3.5`
- Build: `117`
- Bundle ID: `com.autecouture.repvelocoach.hh`
- Upload result: succeeded at 2026-08-05 10:24:23 JST. App Store Connect reported the package was uploaded and may take a few minutes to become visible.
- First attempt: build `116` archived/exported but upload was rejected because App Store Connect already had bundle version `116`.
- IPA: `/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo/ios/fastlane_export/RepVeloCoach.ipa`
- dSYM: `/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo/ios/fastlane_export/RepVeloCoach.app.dSYM.zip`
- Archive: `/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo/ios/build/RepVeloCoach.xcarchive`
- Retained copy: `/Volumes/0RICON_APP/Developer/MyFiles/XcodeArchives/RepVeloCoach/117/`
- Command: `FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 bash scripts/deploy.sh`
- Validation: `pnpm -s check`, `pnpm -s lint`, `pnpm -s test` (236 passed / 1 skipped), `git diff --check`, IPA metadata (`2.3.5`, build `117`, bundle ID `com.autecouture.repvelocoach.hh`).
- Notes: TestFlight processing/display and real-device checks remain pending.

## Current Working Tree
- Working tree is dirty with multiple ongoing feature/fix lanes. Do not revert unrelated changes without explicit user approval.

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
- **Build 95 Release**:
  - Split crash report sharing into `添付共有` and `本文共有`.
  - Keeps the crash context after sharing until the user taps `クリア`, so empty/failed Gmail sends can be retried.
- **Build 96 Release**:
  - Added a lightweight Session Safe Gate before the heavy Session screen loads.
  - The Session tab can now show crash-report sharing controls without importing the heavy Session module.
  - The heavy Session screen loads only after tapping `セッション本体を開く`.
  - Added a `session_screen_mount_attempt` crash marker so a relaunch report can distinguish tab entry from heavy-screen mount failure.
- **Build 103 Release**:
  - Settings exercise category editing now uses the same visible groups as the training exercise picker while saving safe internal categories.
  - Manual Entry now has a `チャッピー監督へ相談` button that copies the current draft or latest saved manual set with VBT context and opens ChatGPT.
  - After a suspected `form_video_overlay_open_attempt` crash, form-video mode is disabled on next Session load to avoid repeated crash loops.
- **Build 109 Release**:
  - VLカット閾値到達時のビープを通常の音声フィードバック設定から分離。
  - バンドルWAVを優先再生し、data URI / 短い音声へフォールバックするようにして TestFlight 実機での無音リスクを下げた。
  - Landmine Shoulder Press などで `最新化` 後に MY V@1RM が更新・保存されるようにした。
  - Tempo Bench Press など、種目選択から追加した種目が消える問題を修正。
- **Build 112 Release**:
  - 実機フィードバックを受け、新商品GUIの4タブ構成とSessionDashboardを本番導線から外し、従来の7タブ・ホーム・セッション画面へ戻した。
  - Apps SDK向けローカル同期、VL警告、動画、種目/LVPなどの機能修正は維持した。
  - `pnpm -s check`、`pnpm -s lint`、`pnpm -s test`（163 passed / 1 skipped）、`git diff --check`、Simulator build/launch、cross review PASSを確認した。
- **Build 113 Release**:
  - iPhoneからMacのPersonal MCPへ送るローカル同期に、iOSローカルネットワーク権限説明を追加した。
  - Mac receiverを一時的な`launchctl submit`から永続LaunchAgentへ変更し、再ログイン後も起動する内部ランタイム、専用ログ、health確認、失敗時ロールバックを追加した。
  - iOSの`X-RepVelo-Sync-Token`とMac側の認証ヘッダー不一致を修正し、動画URIや未知の秘密フィールドを保存しないsanitizeを追加した。
  - `pnpm -s check`、`pnpm -s lint`、`pnpm -s test`（163 passed / 1 skipped）、Simulator build/launch、Personal MCP 40 tests、cross review PASSを確認した。
- **Build 114 Release**:
  - セット計測中のVLを最重要指標として常時・最大表示し、VL_lastを主値、VL_avg/VL_min/閾値/残量/最新AVを補助表示した。
  - VL警告と表示が同じ有効rep・閾値・丸め規則を使うよう統一し、小型画面ではVL主表示を優先した。
  - `pnpm -s check`、`pnpm -s lint`、`pnpm -s test`（172 passed / 1 skipped）、`git diff --check`、archive/IPA metadataを確認した。
  - TestFlight upload succeeded at 2026-07-22 05:09:46 JST. 実機のVBT入力、VL表示、警告音の最終確認は未実施。
- **Build 115 Release**:
  - `repvelocoach.program_menu.v8` を監督・チャッピーコーチ・アプリの共通実行計画として配信した。
  - Personal MCP経由の監督メニュー取得、差分確認、適用、前版rollback、オフライン保持、相談パケット/exportのplan_id/version/row_id整合を含む。
  - applied v8 row_idを実際の次セット判断へ渡し、stale/期限外planは実行候補から除外してheavy exposureと自動増量を禁止する。
  - `pnpm -s check`、`pnpm -s lint`、`pnpm -s test`（199 passed / 1 skipped）、`git diff --check`、Personal MCP `pnpm -s check && pnpm -s test && pnpm -s build`（43 passed）、Simulator build/launch、IPA metadataを確認した。
  - TestFlight upload succeeded at 2026-07-24 10:02:34 JST. 実機の監督メニュー取得 -> 差分 -> 適用 -> Session row_id -> rollback -> stale block確認は未実施。
- **Build 117 Release**:
  - 手入力お気に入り（Chinning/Dips系の秒入力）と、手入力モード種別の整理を含む現在のdirty worktreeを配信対象としてアップロードした。
  - build `116` はApp Store Connectで既使用だったため、`app.config.ts`、`Info.plist`、Xcode projectをbuild `117`へ揃えて再配信した。
  - `pnpm -s check`、`pnpm -s lint`、`pnpm -s test`（236 passed / 1 skipped）、`git diff --check`、IPA metadataを確認した。
  - TestFlight upload succeeded at 2026-08-05 10:24:23 JST. TestFlight processing/display and real-device verification are still pending.
- **Build 118 Release**:
  - トレーニング中に音楽が止まる問題に対し、AudioServiceを外部音楽優先のMixWithOthersへ統一し、読み上げ/ビープ/録画/foreground復帰の前後で音楽向けAudio modeを再適用した。
  - VL警告では`Speech.stop()`を呼ばず、速度読み上げより短いビープとハプティクスを優先する。
  - フォーム録画はマイク権限不要・ミュート録画へ寄せ、録画が音楽再生を奪いにくい設定へ変更した。
  - `pnpm -s check`、`pnpm -s lint`、`pnpm -s test`（241 passed / 1 skipped）、`git diff --check`、IPA metadataを確認した。
  - TestFlight upload succeeded at 2026-08-06 08:51:35 JST. TestFlight processing/display and実機Apple Music/Spotify確認は未実施。
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
- TestFlight upload succeeded for version `2.3.5` build `114`.
- Build numbers are aligned across all three sources (app.config.ts, Info.plist, project.pbxproj) at `114`.
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

## Latest TestFlight Upload (2026-06-04)
- Version: `2.3.5`
- Build: `95`
- Upload result: succeeded at 2026-06-04 12:31:55 JST
- IPA: `ios/fastlane_export/RepVeloCoach.ipa`
- dSYM: `ios/fastlane_export/RepVeloCoach.app.dSYM.zip`
- Command: `source ~/.zshrc && REPVELO_XCODE_APP=/Users/hoshinohideyuki/Developer/Xcode-RepVelo.app REPVELO_CLEAN=false REPVELO_EXTRA_XCARGS='-jobs 1 COMPILER_INDEX_STORE_ENABLE=NO' FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 bash scripts/deploy.sh`
- Notes: build number was bumped and aligned from 94 to 95 before upload. This build adds a text-body sharing path for crash reports after the first Gmail report arrived as an unreadable Markdown attachment. TestFlight processing may take 15-30 minutes.

## Latest TestFlight Upload (2026-06-04)
- Version: `2.3.5`
- Build: `96`
- Upload result: succeeded at 2026-06-04 14:23:36 JST
- IPA: `ios/fastlane_export/RepVeloCoach.ipa`
- dSYM: `ios/fastlane_export/RepVeloCoach.app.dSYM.zip`
- Command: `source ~/.zshrc && REPVELO_XCODE_APP=/Users/hoshinohideyuki/Developer/Xcode-RepVelo.app REPVELO_CLEAN=false REPVELO_EXTRA_XCARGS='-jobs 1 COMPILER_INDEX_STORE_ENABLE=NO' FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 bash scripts/deploy.sh`
- Notes: build number was bumped and aligned from 95 to 96 before upload. This build adds the Session Safe Gate: tapping the Session tab first opens a lightweight diagnostic gate, and the heavy Session screen is dynamically imported only after `セッション本体を開く`. If that second step still crashes, relaunch and share the `session_screen_mount_attempt` report with `本文共有`. TestFlight processing may take 15-30 minutes.

## Latest TestFlight Upload (2026-06-10)
- Version: `2.3.5`
- Build: `103`
- Upload result: succeeded at 2026-06-10 10:04:43 JST
- IPA: `ios/fastlane_export/RepVeloCoach.ipa`
- dSYM: `ios/fastlane_export/RepVeloCoach.app.dSYM.zip`
- Command: `REPVELO_XCODE_APP=/Applications/Xcode.app FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 REPVELO_EXTRA_XCARGS='-jobs 1 COMPILER_INDEX_STORE_ENABLE=NO' bash scripts/deploy.sh`
- Notes: build number was bumped and aligned from 102 to 103 before upload. This build includes Settings exercise category alignment with training picker categories, Manual Entry `チャッピー監督へ相談`, and the form-video crash-loop guard based on the Gmail crash report. TestFlight processing may take 15-30 minutes.

## Latest TestFlight Upload (2026-07-08)
- Version: `2.3.5`
- Build: `109`
- Upload result: succeeded at 2026-07-08 07:38:51 JST
- IPA: `ios/fastlane_export/RepVeloCoach.ipa`
- dSYM: `ios/fastlane_export/RepVeloCoach.app.dSYM.zip`
- Command: `source ~/.zshrc >/dev/null 2>&1 || true; FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 bash scripts/deploy.sh`
- Notes: build number was bumped and aligned from 108/107 mixed state to 109 before upload. This build includes the VL warning beep reliability fix, graph `MY V@1RM` refresh persistence, and exercise-add persistence fixes. TestFlight processing may take 15-30 minutes.

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
1. Device-test build 96 focusing on:
   - Long session behavior around 6+ sets and recovery after relaunch.
   - Session tab should first show the lightweight Safe Gate without crashing.
   - Tap `セッション本体を開く` to verify whether the heavy Session screen now opens.
   - If the heavy screen still crashes, relaunch and use the Safe Gate/Home crash card -> `本文共有` to send the `session_screen_mount_attempt` Markdown crash context in the email body.
   - VBT connection -> Session Safe Gate -> Session body no-crash verification.
   - English canonical exercise migration for existing Katakana lift history.
   - VBT decision card readability during rest.
   - GPT copy/open flow.
   - Session history power display accuracy.
   - Auto-start functionality.
2. Monitor TestFlight processing (usually 15-30 minutes) and verify build appears in TestFlight
3. After device verification, decide next improvements based on user feedback

## Latest TestFlight Upload (2026-07-14)
- Version: `2.3.5`
- Build: `110`
- Bundle ID: `com.autecouture.repvelocoach.hh`
- Upload result: succeeded at 2026-07-14 05:38:46 JST
- IPA: `ios/fastlane_export/RepVeloCoach.ipa`
- dSYM: `ios/fastlane_export/RepVeloCoach.app.dSYM.zip`
- Command: `source ~/.zshrc >/dev/null 2>&1 || true; FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 REPVELO_EXTRA_XCARGS='-jobs 1 COMPILER_INDEX_STORE_ENABLE=NO' bash scripts/deploy.sh`
- Validation: `pnpm -s check`, `pnpm -s lint`, `pnpm -s test`, and `git diff --check` passed before archive. IPA metadata was verified as `2.3.5 (110)` with the expected bundle ID.
- Notes: The current RepVeloCoach working tree was released without reverting pre-existing feature changes. TestFlight processing usually takes 15-30 minutes.

## Latest TestFlight Upload (2026-07-17)
- Version: `2.3.5`
- Build: `112`
- Bundle ID: `com.autecouture.repvelocoach.hh`
- Upload result: succeeded at 2026-07-17 10:43:39 JST
- IPA: `ios/fastlane_export/RepVeloCoach.ipa`
- dSYM: `ios/fastlane_export/RepVeloCoach.app.dSYM.zip`
- Archive: `/Volumes/0RICON_APP/Developer/MyFiles/XcodeArchives/RepVeloCoach/112/RepVeloCoach.xcarchive`
- Command: `REPVELO_XCODE_APP=/Users/hoshinohideyuki/Developer/Xcode-26.2-RepVelo.app REPVELO_CLEAN=false REPVELO_EXTRA_XCARGS='-jobs 1 COMPILER_INDEX_STORE_ENABLE=NO' FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 bash scripts/deploy.sh`
- Validation: `pnpm -s check`, `pnpm -s lint`, `pnpm -s test` (163 passed / 1 skipped), `git diff --check`, iPhone Simulator build/launch, and independent cross review passed. Archive metadata was verified as `2.3.5 (112)`.
- Notes: Restored the previous 7-tab navigation, Home, and Session experience after real-device feedback while retaining Apps SDK/local sync and unrelated functional fixes. The external Xcode archive hit `Bus error: 10`; release succeeded using a complete internal copy of Xcode 26.2. TestFlight processing usually takes 15-30 minutes.

## Latest TestFlight Upload (2026-07-18)
- Version: `2.3.5`
- Build: `113`
- Bundle ID: `com.autecouture.repvelocoach.hh`
- Upload result: succeeded at 2026-07-18 10:48:12 JST
- IPA: `ios/fastlane_export/RepVeloCoach.ipa`
- dSYM: `ios/fastlane_export/RepVeloCoach.app.dSYM.zip`
- Archive: `/Volumes/0RICON_APP/Developer/MyFiles/XcodeArchives/RepVeloCoach/113/RepVeloCoach.xcarchive`
- Command: `REPVELO_XCODE_APP=/Users/hoshinohideyuki/Developer/Xcode-26.2-RepVelo.app REPVELO_CLEAN=false REPVELO_EXTRA_XCARGS='-jobs 1 COMPILER_INDEX_STORE_ENABLE=NO' FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 bash scripts/deploy.sh`
- Validation: RepVeloCoach type/lint/163 tests, iPhone 17 Pro Simulator build/launch, Personal MCP type/build/40 tests, persistent LaunchAgent health/auth checks, and independent cross review passed. Archive metadata was verified as `2.3.5 (113)`.
- Notes: The first external-volume archive failed after the SSD disconnected during build. A managed internal staging copy initially lacked part of `node_modules` and generated React Codegen output; dependencies were re-synchronized and `pod install` regenerated Codegen before the successful archive/upload. TestFlight processing usually takes 15-30 minutes.
- Real-device verification: build 113 sync succeeded on 2026-07-19. The Mac snapshot was saved at 09:25:09 JST with 115 sessions / 758 sets / 3795 reps and the persistent receiver remained healthy.

## Latest TestFlight Upload (2026-07-22)
- Version: `2.3.5`
- Build: `114`
- Bundle ID: `com.autecouture.repvelocoach.hh`
- Upload result: succeeded at 2026-07-22 05:09:46 JST
- IPA: `ios/fastlane_export/RepVeloCoach.ipa`
- dSYM: `ios/fastlane_export/RepVeloCoach.app.dSYM.zip`
- Archive: `/Volumes/0RICON_APP/Developer/MyFiles/XcodeArchives/RepVeloCoach/114/RepVeloCoach.xcarchive`
- Command: `REPVELO_XCODE_APP=/Users/hoshinohideyuki/Developer/Xcode-26.2-RepVelo.app REPVELO_CLEAN=false REPVELO_EXTRA_XCARGS='-jobs 1 COMPILER_INDEX_STORE_ENABLE=NO' FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 bash scripts/deploy.sh`
- Validation: `pnpm -s check`, `pnpm -s lint`, `pnpm -s test` (172 passed / 1 skipped), `git diff --check`, archive/IPA export, and archive metadata verification passed.
- Notes: Ships the live Session VL-first display with VL_last as the dominant value and aligned threshold/warning calculations. The cable was replaced before the successful uninterrupted archive. Real-device VBT and warning-beep verification remains required. TestFlight processing usually takes 15-30 minutes.

## Latest TestFlight Upload (2026-07-27)
- Version: `2.3.5`
- Build: `116`
- Bundle ID: `com.autecouture.repvelocoach.hh`
- Upload result: succeeded at 2026-07-27 11:35:32 JST
- IPA: `ios/fastlane_export/RepVeloCoach.ipa`
- dSYM: `ios/fastlane_export/RepVeloCoach.app.dSYM.zip`
- Archive: `/Volumes/0RICON_APP/Developer/MyFiles/XcodeArchives/RepVeloCoach/116/RepVeloCoach.xcarchive`
- Command: `FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 bash scripts/deploy.sh`
- Validation: focused 14 tests, `pnpm -s check`, `pnpm -s lint`, full test suite (204 passed / 1 skipped), independent review, `git diff --check`, archive/IPA export, and App Store Connect upload passed.
- Notes: Removes the stale/missing supervisor-menu hard lock from every manual Session load path. Stale status remains visible, stale automatic suggestions stay conservative, and the separate suggested-load banner is suppressed when the plan is non-executable. TestFlight processing and real-device verification remain required.

## Latest TestFlight Upload (2026-08-07)
- Version: `2.3.5`
- Build: `119`
- Bundle ID: `com.autecouture.repvelocoach.hh`
- Upload result: succeeded at 2026-08-07 10:28:45 JST
- App Store Connect state: `VALID` confirmed
- IPA: `ios/fastlane_export/RepVeloCoach.ipa`
- dSYM: `ios/fastlane_export/RepVeloCoach.app.dSYM.zip`
- Archive: `/Volumes/0RICON_APP/Developer/MyFiles/XcodeArchives/RepVeloCoach/119/RepVeloCoach.xcarchive`
- Command: `FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 bash scripts/deploy.sh`
- Validation: `pnpm -s check`, `pnpm -s lint`, full test suite (251 passed / 1 skipped), `git diff --check`, iPhone 17 Pro Simulator build/launch, VBT SIM LIVE screen visual check, archive/IPA export, IPA metadata verification, upload, and App Store Connect processing passed.
- Notes: Ships the same-exercise/same-load VL-gated REP PR target and the equal-size LIVE `VL_last` / `REPS` display, together with the current dirty-worktree feature set. Simulator confirmed `REPS` updating from 0 to 1 without overlap. Real-device VBT and smallest-iPhone confirmation remain required.

## Latest TestFlight Upload (2026-08-10)
- Version: `2.3.5`
- Build: `120`
- Bundle ID: `com.autecouture.repvelocoach.hh`
- Upload result: succeeded at 2026-08-10 05:40:35 JST
- App Store Connect state: `VALID` confirmed through the official API after upload
- IPA: `/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo/ios/fastlane_export/RepVeloCoach.ipa`
- dSYM: `/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo/ios/fastlane_export/RepVeloCoach.app.dSYM.zip`
- Archive: `/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo/ios/build/RepVeloCoach.xcarchive`
- Retained release evidence: `/Volumes/0RICON_APP/Developer/MyFiles/XcodeArchives/RepVeloCoach/120/`
- Command: `REPVELO_CLEAN=false REPVELO_EXTRA_XCARGS='CODE_SIGN_ENTITLEMENTS=/private/tmp/codex-managed-temp/repvelocoach-testflight-119/Release.entitlements -jobs 1 COMPILER_INDEX_STORE_ENABLE=NO' FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 bash ~/.codex/skills/testflight-upload/scripts/deploy.sh`
- Validation: `pnpm -s check`, `pnpm -s lint`, `pnpm -s test` (257 passed / 1 skipped), `git diff --check`, archive/export, IPA metadata, and App Store Connect upload passed.
- Notes: App Store Connect already contained build `119`, so the release number was advanced to `120`. The source App Group entitlement change was preserved, but the distribution profile did not include that capability. The archive used a task-scoped HealthKit-only entitlement override to complete the upload; this IPA does not grant the BREATHFORGE App Group until the Apple Developer capability/profile is updated with 2FA.
- Simulator: no new launch was performed in this release turn; the existing Simulator and unrelated WorkshopTimer test process were left untouched.

## Latest TestFlight Upload (2026-08-13)
- Version: `2.3.5`
- Build: `121`
- Bundle ID: `com.autecouture.repvelocoach.hh`
- Upload result: succeeded at 2026-08-13 18:17:58 JST
- App Store Connect state: upload accepted; processing is asynchronous because `skip_waiting_for_build_processing` is enabled
- IPA: `/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo/ios/fastlane_export/RepVeloCoach.ipa`
- dSYM: `/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo/ios/fastlane_export/RepVeloCoach.app.dSYM.zip`
- Archive: `/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo/ios/build/RepVeloCoach.xcarchive`
- Retained release evidence: `/Volumes/0RICON_APP/Developer/MyFiles/XcodeArchives/RepVeloCoach/121/`
- Command: `GYM_DERIVED_DATA_PATH=/tmp/codex-builds/repvelocoach/week11-day3-build REPVELO_CLEAN=false REPVELO_EXTRA_XCARGS='CODE_SIGN_ENTITLEMENTS=/private/tmp/codex-managed-temp/repvelocoach-testflight-121/Release.entitlements -jobs 1 COMPILER_INDEX_STORE_ENABLE=NO' FASTLANE_XCODEBUILD_SETTINGS_TIMEOUT=20 FASTLANE_XCODEBUILD_SETTINGS_RETRIES=6 bash scripts/deploy.sh`
- Validation: `pnpm -s check`, `pnpm -s lint`, `pnpm -s test` (274 passed / 1 skipped), supervisor-plan v8 dry run, archive/export, IPA metadata, signed entitlements, SHA-256 copy match, App Store Connect upload, and `VALID` processing state passed.
- Week11-Day3: supervisor plan `2026-08-12-week11-v1`, checksum `fnv1a32:9ce5c5bc`, is valid through 2026-08-18. The user must fetch/apply it on the iPhone and select `W11-D3`; real-device VBT execution remains unverified.
- Notes: Ships the complete two-decimal load path including the Session dashboard. The distribution profile still lacks App Group, so the task-scoped HealthKit-only entitlement override was required; BREATHFORGE shared-history access is absent from this IPA. TestFlight client availability and real-device verification remain required.

## Latest TestFlight Upload (2026-08-21)
- Version: `2.3.5`
- Build: `124`
- Bundle ID: `com.autecouture.repvelocoach.hh`
- Upload result: archive/export and `upload_to_testflight` completed at 2026-08-21 11:45 JST; App Store Connect processing is asynchronous because `skip_waiting_for_build_processing` is enabled.
- IPA: `/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo/ios/fastlane_export/RepVeloCoach.ipa`
- dSYM: `/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo/ios/fastlane_export/RepVeloCoach.app.dSYM.zip`
- Archive: `/Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo/ios/build/RepVeloCoach.xcarchive`
- Retained release evidence: `/Volumes/0RICON_APP/Developer/MyFiles/XcodeArchives/RepVeloCoach/124/`
- Validation: IPA metadata `com.autecouture.repvelocoach.hh`, `2.3.5 (124)`; SHA-256 `da98972b8829fb494e428147e0e1d3f375db9873a78b56b0c119be2997fed1e3`; Fastlane report completed `build_app` and `upload_to_testflight` without failure.
- Notes: After the SSD remount, the same build completed without the earlier `Bus error: 10`. The task-scoped HealthKit-only entitlement override remains in use, so BREATHFORGE App Group access is absent from this IPA. Saved-set gear editing needs physical-device verification.
