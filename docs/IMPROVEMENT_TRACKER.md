# RepVeloCoach Improvement Tracker

このファイルは、RepVeloCoach の改善要求の正本です。  
Codex / Claude / GLM / Gemini を含む全エージェントは、改善作業の前にこの表を確認し、作業後に更新してください。

## Rules

- 新しい要望は必ずこの表へ追記する
- 実装前に `status` を `todo` か `in_progress` に更新する
- 実装後は `implemented_in` と `agent_notes` を埋める
- ユーザーテスト後は `user_rating` と `user_feedback` を更新する
- 未達や再修正が必要なら `status` を `needs_revision` に戻す
- 詳細な作業ログは `docs/AGENT_WALKTHROUGH.md` に残し、この表は判断用の要約にする

## User Evaluation Workflow

ユーザーテスト後は、各行を次のどちらかに必ず更新する。

- 達成できた: `status=verified`
- 未達または不十分: `status=needs_revision`

`user_rating` は次の短い値を使う。

- `good`
- `almost`
- `bad`
- `untested`

`user_feedback` には、ユーザーの言葉に近い短文を残す。

例:

- `good | GLMつながった。期待通り`
- `almost | ほぼOKだがカテゴリボタンがまだ縦長`
- `bad | 自動スタートうまくいかない`
- `untested | まだ実機未確認`

## Status Key

- `todo`: 未着手
- `in_progress`: 実装中
- `implemented`: 実装済み、未評価
- `needs_revision`: ユーザーフィードバックで再修正が必要
- `verified`: ユーザー確認まで完了
- `blocked`: 外部要因待ち

## Improvement Table

| id | area | request | status | priority | owner | implemented_in | user_rating | user_feedback | agent_notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-04-13-01 | process | 改善タスク表を作り、複数エージェントが共通参照できるようにする | implemented | high | codex | docs/IMPROVEMENT_TRACKER.md | untested | まだ評価待ち | このファイルを正本化。以後の改善要求はここへ追記する |
| 2026-04-13-02 | session | 直近同重量の速度履歴を表示 | implemented | high | codex | app/(tabs)/session.tsx | untested | まだ評価待ち | セッション画面に同重量カードを追加。詳細モーダルへ遷移可能 |
| 2026-04-13-03 | session | 2回記録される時がある | implemented | critical | codex | src/hooks/useSessionLogic.ts | untested | 実機で再確認が必要 | 800ms 以内の同一 payload を重複レップとして破棄。実機再検証が必要 |
| 2026-04-13-04 | exercise-master | 種目マスターにトレーニング中の意識メモを残せるようにする | implemented | high | glm-sonnet-session | app/(tabs)/settings.tsx, app/(tabs)/session.tsx | untested | まだ評価待ち | 種目マスターで training cue / focus note を編集し、セッション画面で表示 |
| 2026-04-13-05 | device | バッテリー残量表示されなくなった | needs_revision | medium | codex |  | bad | 表示されていない | 現状 UI は CNS BATTERY のみ。センサー電池残量の取得経路は未実装の可能性が高い |
| 2026-04-13-06 | ai-coach | AIコーチへのコンテキストがうまく渡っていない | implemented | high | codex + glm-opus-ai | app/coach-chat.tsx, src/services/LocalLLMService.ts | untested | まだ評価待ち | 同重量履歴、最近のセッションメモ、種目 cue / focus note を context に追加 |
| 2026-04-13-07 | estimation | 本日の1RM予想を4点法ベースで、足りない点は過去履歴から推測して精度を上げる | implemented | high | codex + glm-opus-ai | src/utils/OneRMCalculator.ts, src/hooks/useSessionLogic.ts, src/services/DatabaseService.ts | untested | まだ評価待ち | セット保存後に 4点法 + historical fallback で本日1RMを更新 |
| 2026-04-13-08 | estimation | 種目最低挙上速度 V@1RM を履歴から更新し、最適化ボタンで反映する | implemented | high | codex | app/(tabs)/session.tsx | untested | まだ評価待ち | 履歴から最適化ボタンを追加し、承認時に LVP と種目マスターの mvt を更新 |
| 2026-04-13-09 | graph | グラフモードの種目選択をカテゴリーから選べるようにする | implemented | medium | codex | app/(tabs)/graph.tsx | untested | まだ評価待ち | グラフ画面にカテゴリチップを追加し、カテゴリ起点で種目を選択 |
| 2026-04-13-10 | graph | グラフモードの速度ゾーンを履歴速度から計算する | implemented | medium | codex + glm-opus-ai | app/(tabs)/graph.tsx, src/utils/VelocityZones.ts | untested | まだ評価待ち | グラフ画面で履歴セット速度の percentiles からゾーンを構成。データ不足時は固定値へフォールバック |
| 2026-04-13-11 | session | 自動スタートがうまくいかない | needs_revision | high | codex + glm-sonnet-auto-start-rom | app/(tabs)/settings.tsx, src/hooks/useSessionLogic.ts, src/services/AppSettingsService.ts, src/services/DatabaseService.ts, src/services/ExerciseService.ts | bad | 動作しない | ROM閾値設定化済みだが実機で動作せず。要調査 |
| 2026-04-13-12 | session | 本日のトレーニングメモをセッションモードから残せるようにする | implemented | medium | glm-sonnet-session | app/(tabs)/session.tsx | untested | まだ評価待ち | セッション画面から session note を編集・保存できる |
| 2026-04-13-13 | estimation | 1set毎に速度低下から推定RPEを表示する | implemented | medium | codex + glm-opus-ai | app/(tabs)/session.tsx, src/utils/RPECalculator.ts | untested | まだ評価待ち | セッション履歴に速度低下ベースの推定RPEを表示 |
| 2026-04-13-14 | session | VBTパワーをUI上で確認できるようにする | implemented | medium | codex | app/(tabs)/session.tsx | untested | まだ評価待ち | Live Data に Mean/Peak Power を固定表示し、peak は peak velocity からも補完 |
| 2026-04-14-01 | design | Home screen を dark & high-tech aesthetic に再設計する | implemented | medium | codex + glm-sonnet-home-redesign | app/(tabs)/index.tsx, docs/UI_REDESIGN_BRIEF_2026-04-14.md | untested | first-pass 実装。実機評価待ち | Home は Variant 2 base + telemetry polish を採用。GLM full-file patch を Codex がレビューして採用範囲を整理した |
| 2026-04-14-02 | design | Active Session screen を dark & high-tech aesthetic に再設計する | implemented | high | codex + glm-opus-session-redesign | app/(tabs)/session.tsx, docs/UI_REDESIGN_BRIEF_2026-04-14.md | untested | safe first-pass 実装。実機評価待ち | Session は large GLM patch が JSX/type break を起こしたため却下し、Codex が header/status/live data の安全な visual polish に縮小して採用 |
| 2026-04-14-03 | health | AirPods Pro 3 / HealthKit の心拍数をセッション画面へリアルタイム表示する | implemented | high | codex | src/services/HealthService.ts, ios/RepVeloCoach/HealthKitHeartRateModule.swift, ios/RepVeloCoach/HealthKitHeartRateModule.m, app/(tabs)/session.tsx | untested | 実機で AirPods Pro 3 と権限確認待ち | HealthKit bridge を追加。心拍数は既存の currentHeartRate パイプに流し、セッション画面とインターバルタイマー横へ表示。iOS 15.1 deployment target で simulator build 成功 |

| 2026-04-15-01 | manual-entry | 手動入力で保存直後の重量が直近重量候補に反映されない | implemented | high | codex | src/screens/ManualEntryScreen.tsx | untested | 保存直後の候補反映を再テスト待ち | 現在セッション内で保存した同種目セットを recent 候補へ合流し、DB の過去セットよりも優先表示するよう修正 |
| 2026-04-15-02 | session | セッションモードのレップ詳細から手動レップ追加が効かない | implemented | high | codex | app/(tabs)/session.tsx | untested | 詳細モーダルからの手動追加を再テスト待ち | 手動追加対象を現在進行中セットではなく、詳細モーダルで開いている selectedSet 基準に変更し、追加後にセット再集計と履歴更新を実行 |

| 2026-04-15-03 | graph | グラフモードで各種目の日毎の e1RM 推移を見れるようにし、7日/30日/全期間・平滑線・種目比較を追加する | implemented | medium | codex + glm-sonnet | app/(tabs)/graph.tsx | untested | 実機で視認性確認待ち | GLM案を元に、進捗タブへ日次e1RM、レンジ切替、平滑線、最新e1RMの種目比較を追加。比較集計は単純再クエリを避けて session 走査 1 回で構築 |
| 2026-04-21-01 | session | セッションモードの最初のセッションが2回記録される | todo | critical | | | untested | | 最初のセットのみ2回記録される問題。レップ検出ロジックかDB保存側のバグ可能性 |
| 2026-04-21-02 | audio | 音声アナウンス時に音楽を一時停止/ボリューム下げて、終わったら元に戻す | todo | medium | | | untested | | AudioServiceで音楽再生と連携し、アナウンス中はducking（ボリューム低下）または一時停止を実装 |
| 2026-04-21-03 | session | VL設定をセッション画面で行いたい、オフボタンも欲しい | todo | medium | | | untested | | 現在は設定画面のみ。VL閾値調整とオンオフをセッション画面から直接操作できるUI追加 |
| 2026-04-21-04 | session | セッションヒストリーでパワーが表示されない | needs_revision | medium | codex | app/(tabs)/session.tsx | bad | ライブでは見えるが履歴で見えない | Live表示では動作済みだが、セッション履歴カードでの表示が実装されていない |
| 2026-04-21-05 | performance | セッションが長くなると後半が重くなって固まる | needs_revision | critical | codex | src/store/trainingStore.ts | bad | 長時間使用後に固まる | HRポイント配列を100件に制限済みだ、他の配列や状態蓄積を調査必要 |
| 2026-05-11-01 | ai-ops | GLM解約後はCodexサブスク中心へ移行し、Codex App Serverを安全に導入する | implemented | high | codex | docs/CODEX_APP_SERVER_INTEGRATION.md, scripts/codex-app-server-check.mjs, scripts/codex-app-server-admin.mjs, package.json | untested | サブスク内運用で進めたい。Codex App Serverも導入したい | Phase 1としてApp Serverの安全方針、CLI readiness check、stdio限定admin client雛形、review/testflight/vbt-plan/performance/release-notesプリセットを追加。アプリ内AIはAPI課金なしのVBTルールベースを主軸にする |
| 2026-05-11-02 | vbt-coach | API課金なしで動く deterministic VBT coach engine を作る | implemented | high | codex | src/services/DeterministicVBTCoach.ts, src/services/AICoachService.ts, src/services/__tests__/DeterministicVBTCoach.test.ts | untested | | Average Velocity、VL、MVT、トップシングル、バックオフ判断を純関数サービスへ集約し、既存AICoachServiceから優先利用。ROM品質ゲートと手動入力連携は次フェーズ |
| 2026-05-11-03 | manual-entry | 手動入力でも deterministic VBT coach に必要な速度/VL/ROM情報を扱えるようにする | implemented | high | codex | src/screens/ManualEntryScreen.tsx, src/services/DeterministicVBTCoach.ts, src/hooks/useSessionLogic.ts, src/types/index.ts, src/services/__tests__/DeterministicVBTCoach.test.ts | untested | | 手動入力にAverage Velocity/VL/ROM任意入力とcoach previewを追加。保存時はset avg_velocity/velocity_lossとrep rom_cmへ反映。ROM品質ゲートも追加 |
| 2026-05-13-01 | session | セッションモードで1セットごとに終了後画面が固まる | implemented | critical | codex | src/hooks/useSessionLogic.ts, app/(tabs)/session.tsx | untested | 2026-05-13修正後は未確認 | セット完了後のDB保存、PR判定、4点法推定、LVP/ROM更新をバックグラウンド化し、画面は先に休憩状態へ進めるよう変更。セッション全レップ再読込もセット数変化時に絞った |
| 2026-05-13-02 | test-tools | VBT機器のシミュレーターを作ってダミーデータ入力でテストできるようにする | implemented | high | codex | src/services/BLEService.ts, src/utils/VBTSimulator.ts, src/utils/__tests__/VBTSimulator.test.ts, app/(tabs)/session.tsx | untested | 実機/Simulatorで未確認 | BLEServiceにVBT SIM接続、単発REP、速度低下付きSET生成を追加。セッション画面からダミーレップを流せる |
| 2026-05-13-03 | graph | グラフモードのグラフが固定表示で実データを表示できていない | implemented | high | codex | app/(tabs)/graph.tsx | untested | 2026-05-13修正後は未確認 | デモ固定LVPを廃止し、保存LVPまたは履歴AV付きセット2点以上から算出。バー表示も固定重量ではなく実履歴重量を優先する |
| 2026-05-13-04 | graph | V@1RMを世間的な表示ではなく私のV@1RMにする | implemented | high | codex | app/(tabs)/graph.tsx | untested | 2026-05-13修正後は未確認 | LVPのmvt、種目マスターmvt、v1rmの順で個人MVTを優先し、表示名をMY V@1RMへ変更。推定1RMも個人MVT基準で算出 |
| 2026-05-13-05 | session | VBT SIMを使ったセット完了テストでPLフェーズ名由来の例外が出る | implemented | critical | codex | app/(tabs)/session.tsx, src/services/AICoachService.ts | simulator_checked | SimulatorでSIM SET後にSET 2へ進むことを確認 | CONNECT時にtrainingStoreの接続状態も更新。アクティブセッション画面にもVBT SIM操作を表示。AICoachService.suggestNextLoadは未知ゾーンをstrengthへフォールバック |
| 2026-05-14-01 | data-export | iPhone側のトレーニングデータをCodexが取得できる仕組みを作る | implemented | high | codex | src/services/CodexDataExportService.ts, app/(tabs)/import.tsx, scripts/read-codex-training-export.mjs, package.json | untested | 実機共有テスト待ち | Data画面にCODEX EXPORTを追加。sessions/sets/reps/exercises/LVPをJSON化し、共有シート経由でMacへ渡す。2026-05-14追記: Data画面上部にMac/Codexへ渡すカードとして再配置し、この画面から取得する導線を明確化 |
| 2026-05-14-02 | session | VBT SIMでセッションモードを実操作テストし、不具合が出ないか確認する | implemented | high | codex | src/components/PRNotification.tsx | simulator_checked | SimulatorでVBT SIM接続、Squat選択、セッション開始、SIM SET、休憩、SET 2遷移まで確認 | 0kgテスト時にPR通知のload_kg条件が数値0を描画してReact Native警告を出していたため、nullチェックへ修正。HealthKit entitlement警告はSimulator固有 |
| 2026-05-14-03 | session | Power がずっと 0W 表示になる。セッション開始後画面にもう少し情報が欲しい | implemented | high | codex | app/(tabs)/session.tsx, src/hooks/useSessionLogic.ts, src/services/BLEService.ts | simulator_checked | Simulatorで100kg Squat、SIM REP/SET後にPower 471W、Peak P 556W、SET完了後PRモーダルまで確認 | BLE/Simulatorのmean_power_w/peak_power_wを優先し、0/未提供時は重量×速度で補完。履歴カードも0W保存値に引っ張られないよう補完。アクティブセッション画面にEXERCISE/LOAD/POWERとAVG V/ROM/PEAK Pを追加 |
| 2026-05-16-01 | manual-entry | 筋トレMEMOの学びを反映し、手動入力で今日のサマリーと文脈つき最近候補を見やすくする | implemented | medium | codex | src/screens/ManualEntryScreen.tsx | untested | 実機で入力速度と見やすさ確認待ち | 今日のセット/レップ/総負荷/次セットを上部カード化。最近使った設定に前回時刻、set type、AV/ROM、e1RMを表示し、候補タップで負荷/レップ/VBT値を反映。AI相談は小ボタンとして分離 |
| 2026-05-17-01 | history | 筋トレMEMOの学びを反映し、履歴をカレンダー/グラフで追いやすくする | implemented | medium | codex | src/screens/HistoryScreen.tsx | untested | 実機でスクロール量、日付タップ、グラフタップの操作感確認待ち | 履歴画面にリスト/カレンダー/グラフのセグメント切替を追加。カレンダーは記録日を強調し日付タップで当日セッションを表示。グラフは直近14日のボリューム/セット/時間を切替でき、バータップでツールチップ表示 |

## Active Focus

### Current Sprint

- まず `2026-04-13-03` 重複記録
- 次に `2026-04-13-06` AIコーチ文脈
- 次に `2026-04-13-04` `2026-04-13-12` のメモ系導線
- 次に `2026-04-13-07` `2026-04-13-08` `2026-04-13-13` の推定ロジック
- 最後に `2026-04-13-09` `2026-04-13-10` `2026-04-13-11` `2026-04-13-05`

### Latest User Feedback

- 2026-04-21 (Build 79):
  - 最初のセッションが2回記録される (2026-04-21-01)
  - オートスタート機能が動作しない (2026-04-13-11 → needs_revision)
  - 音声アナウンス時に音楽を一時停止/ボリューム調整してほしい (2026-04-21-02)
  - VL設定をセッション画面で行いたい、オフボタンも欲しい (2026-04-21-03)
  - セッションヒストリーでパワーが表示されない (2026-04-21-04)
  - セッションが長くなると後半が重くなって固まる (2026-04-21-05)

## Quick Update Template

ユーザーテスト後は、該当行を次の形で更新する。

- `status=verified, user_rating=good, user_feedback=期待通り`
- `status=needs_revision, user_rating=almost, user_feedback=ほぼOKだがまだ改善必要`
- `status=needs_revision, user_rating=bad, user_feedback=動かない`
