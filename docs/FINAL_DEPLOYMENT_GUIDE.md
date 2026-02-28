# OVR VBT Coach - 最終デプロイ完全ガイド

このドキュメントは、OVR VBT Coach を App Store Connect に登録し、TestFlight でテストし、App Store にリリースするための完全なガイドです。

## 概要

OVR VBT Coach は、Velocity-Based Training（VBT）分析プラットフォームです。Bluetooth 接続の OVR Velocity センサーを使用して、リアルタイムでバー速度を追跡し、PR 検知、Velocity Loss 監視、セッション分析を提供します。

**プロジェクト情報**:
- アプリ名: OVR VBT Coach
- Bundle ID: space.manus.ovr.vbt.coach.app.t20260125053732
- バージョン: 2.3.0
- ビルド番号: 1
- プラットフォーム: iOS 15.1+
- 価格: Free

## デプロイフロー

```
1. App Store Connect 登録（15 分）
   ↓
2. Manus ビルド実行（30～60 分）
   ↓
3. TestFlight テスター招待（10 分）
   ↓
4. テスト実施（2～5 日）
   ↓
5. バグ修正と新ビルド提出（1～3 日）
   ↓
6. App Store リリース準備
   ↓
7. Apple レビュー（24～48 時間）
   ↓
8. App Store リリース
```

**合計時間**: 7～14 日

## フェーズ 1: App Store Connect 登録（15 分）

### 1.1 準備

アセットとドキュメントが完成していることを確認:

```bash
ls -lh assets/images/icon.png
ls -lh assets/screenshots/screenshot-*.png
cat APP_STORE_METADATA.md | head -20
```

### 1.2 App Store Connect へのアクセス

1. https://appstoreconnect.apple.com にアクセス
2. Apple ID でログイン
3. **My Apps** をクリック

### 1.3 新しいアプリ作成

1. **+** ボタンをクリック
2. **New App** を選択
3. 以下を入力:

| 項目 | 値 |
|------|-----|
| **Platform** | iOS |
| **Name** | OVR VBT Coach |
| **Primary Language** | English |
| **Bundle ID** | space.manus.ovr.vbt.coach.app.t20260125053732 |
| **SKU** | ovr-vbt-coach-001 |
| **User Access** | Full Access |

4. **Create** をクリック

### 1.4 App Information タブ

入力項目:

| 項目 | 値 |
|------|-----|
| **App Name** | OVR VBT Coach |
| **Subtitle** | Real-Time Velocity Training Analytics |
| **Category** | Health & Fitness |
| **Privacy Policy URL** | https://www.ovrvelocity.com/privacy |
| **Support URL** | https://www.ovrvelocity.com/support |
| **Support Email** | support@ovrvelocity.com |

### 1.5 App Store タブ

1. **Description** に以下をコピー（APP_STORE_METADATA.md から）:

```
OVR VBT Coach is a revolutionary velocity-based training (VBT) analytics platform that empowers athletes and coaches to optimize workout performance through real-time Bluetooth-connected velocity sensors.

[詳細は APP_STORE_METADATA.md を参照]
```

2. **Keywords** に以下をコピー:

```
fitness, training, velocity, VBT, workout, analytics, Bluetooth, personal trainer, strength training, powerlifting, CrossFit, performance tracking, sports science, coaching
```

### 1.6 スクリーンショット アップロード

1. **Screenshots** セクションで iPhone 6.7-inch を選択
2. 5 枚のスクリーンショットをアップロード:
   - screenshot-1-home.png
   - screenshot-2-ble.png
   - screenshot-3-monitoring.png
   - screenshot-4-pr.png
   - screenshot-5-summary.png

### 1.7 Pricing and Availability

1. **Price Tier**: Free を選択
2. **Availability**: All countries を選択

### 1.8 年齢レーティング

1. **Age Rating** をクリック
2. すべてのカテゴリで「No」を選択
3. **Age Rating**: 4+ を確認

### 1.9 チェックリスト

```bash
# 以下を実行して確認
cat scripts/app-store-registration-checklist.txt
```

**フェーズ 1 完了！** ✅

---

## フェーズ 2: Manus ビルド実行（30～60 分）

### 2.1 Manus UI へのアクセス

1. https://app.manus.im にアクセス
2. Manus アカウントでログイン
3. **OVR VBT Coach** プロジェクトを選択

### 2.2 プロジェクト確認

Management UI で以下を確認:

| 項目 | 期待値 |
|------|--------|
| **Project** | OVR VBT Coach |
| **Status** | Running |
| **Dev Server** | https://8081-*.sg1.manus.computer |
| **Platform** | Mobile (Expo) |

### 2.3 ビルド開始

1. Management UI の **Publish** ボタンをクリック
2. **Build for iOS** を選択
3. ビルド設定を確認:

| 項目 | 値 |
|------|-----|
| **Platform** | iOS |
| **Build Type** | Release |
| **Deployment Target** | TestFlight |
| **App Name** | OVR VBT Coach |
| **Bundle ID** | space.manus.ovr.vbt.coach.app.t20260125053732 |
| **Version** | 2.3.0 |
| **Build Number** | 1 |

4. **Start Build** をクリック

### 2.4 ビルド監視

ビルドステージ（合計 30～60 分）:

| ステージ | 時間 | 確認項目 |
|---------|------|---------|
| 依存関係チェック | 2～3 分 | Dependencies installed |
| TypeScript コンパイル | 3～5 分 | TypeScript compiled successfully |
| Expo ビルド準備 | 2～3 分 | Expo build configured |
| iOS ビルド実行 | 15～20 分 | iOS build completed |
| IPA ファイル生成 | 3～5 分 | IPA generated |
| App Store Connect アップロード | 3～5 分 | Uploaded to App Store Connect |

### 2.5 ビルド完了

- Manus からビルド完了メール受信
- App Store Connect で新しいビルドが表示される

### 2.6 App Store Connect で確認

1. App Store Connect にログイン
2. **OVR VBT Coach** を選択
3. **TestFlight** → **Builds** をクリック
4. 新しいビルドが表示されることを確認

```
Build Version: 2.3.0
Build Number: 1
Status: Processing → Ready to Test
```

### 2.7 チェックリスト

```bash
# 以下を実行して確認
cat scripts/manus-build-checklist.txt
```

**フェーズ 2 完了！** ✅

---

## フェーズ 3: TestFlight テスター招待（10 分）

### 3.1 Internal Testers グループ作成

1. App Store Connect で **OVR VBT Coach** を選択
2. **TestFlight** タブをクリック
3. **Internal Testers** セクションで **+** をクリック
4. **Group Name**: `Core Team` を入力
5. **Create** をクリック

### 3.2 テスター追加

1. **Internal Testers** → **Core Team** をクリック
2. **Add Testers** をクリック
3. テスターのメールアドレスを入力
4. **Add** をクリック

テスター例:

```
tester1@example.com
tester2@example.com
tester3@example.com
```

### 3.3 ビルドをテスターグループに追加

1. **TestFlight** → **Builds** をクリック
2. 最新のビルド（2.3.0 Build 1）をクリック
3. **Add Build** をクリック
4. **Internal Testers** → **Core Team** を選択
5. **Save** をクリック

### 3.4 テスター指示送信

テスターに以下を送信:

```
【OVR VBT Coach TestFlight テスト】

ありがとうございます！OVR VBT Coach のテストにご協力いただきます。

【ステップ 1: TestFlight アプリをダウンロード】
- App Store で「TestFlight」を検索してダウンロード

【ステップ 2: 招待メールを確認】
- 「You're invited to test OVR VBT Coach」メールのリンクをクリック

【ステップ 3: OVR VBT Coach をインストール】
- TestFlight アプリで「Install」をクリック

【テスト項目】
1. アプリが起動するか
2. BLE でセンサーに接続できるか
3. セッション記録が動作するか
4. PR 通知が表示されるか
5. クラッシュしないか

【バグ報告】
- TestFlight アプリ内の「Send Feedback」で報告

テスト期間: [開始日] ～ [終了日]
```

### 3.5 チェックリスト

```bash
# 以下を実行して確認
cat scripts/testflight-invitation-checklist.txt
```

**フェーズ 3 完了！** ✅

---

## フェーズ 4: テスト実施（2～5 日）

### 4.1 テスト監視

App Store Connect で以下を監視:

| ステータス | 説明 |
|-----------|------|
| **Invited** | 招待メール送信済み、未応答 |
| **Installed** | アプリをインストール |
| **Launched** | アプリを起動 |
| **Active** | 定期的に使用中 |

### 4.2 フィードバック確認

1. **TestFlight** → **Feedback** をクリック
2. テスターからのフィードバックを確認
3. バグレポートを分類

### 4.3 テスト項目

テスターが以下をテスト:

- [ ] アプリが正常に起動するか
- [ ] ホーム画面が表示されるか
- [ ] BLE 接続画面が表示されるか
- [ ] OVR Velocity センサーが検出されるか
- [ ] ペアリングが成功するか
- [ ] セッション記録画面が表示されるか
- [ ] リアルタイムデータが表示されるか
- [ ] PR 通知が表示されるか
- [ ] 本日のボリューム合計が表示されるか
- [ ] Velocity Loss が正しく計算されているか

**フェーズ 4 実施中...**

---

## フェーズ 5: バグ修正と新ビルド提出（1～3 日）

### 5.1 バグ修正

1. テスターからのフィードバック確認
2. ローカルでバグを再現
3. バグを修正
4. `todo.md` で完了したタスクをマーク

### 5.2 新ビルド提出

1. app.config.ts で Build Number をインクリメント（1 → 2）
2. `webdev_save_checkpoint` で新しいチェックポイント作成
3. Manus でビルド再実行
4. ビルド完了後、App Store Connect で確認
5. 新しいビルドを同じテスターグループに追加

### 5.3 テスター通知

新しいビルドが利用可能なことをテスターに通知:

```
【OVR VBT Coach - 新しいビルドが利用可能】

新しいビルド（v2.3.0 Build 2）が利用可能になりました。

以下のバグを修正しました:
- [バグ 1]
- [バグ 2]

再度テストしていただき、フィードバックをお願いします。
```

**フェーズ 5 実施中...**

---

## フェーズ 6: App Store リリース準備

### 6.1 テスト完了確認

- [ ] すべてのテスターがテスト完了
- [ ] すべてのバグが修正
- [ ] 新ビルドで修正を確認
- [ ] テスターが最終承認

### 6.2 リリースノート作成

```
## Version 2.3.0 - Release Notes

### New Features
- Real-time velocity tracking via Bluetooth
- Automatic PR detection and notifications
- Velocity loss monitoring
- Comprehensive session analytics

### Bug Fixes
- [バグ 1 修正]
- [バグ 2 修正]

### Improvements
- [改善 1]
- [改善 2]
```

### 6.3 App Store Connect で Submit for Review

1. App Store Connect にログイン
2. **OVR VBT Coach** を選択
3. **App Store** タブをクリック
4. **Version Release** セクションで **Submit for Review** をクリック
5. リリースノートを入力
6. **Submit** をクリック

**フェーズ 6 完了！** ✅

---

## フェーズ 7: Apple レビュー（24～48 時間）

### 7.1 レビュー監視

1. App Store Connect で **Version Release** セクションを監視
2. ステータスを確認:
   - **Waiting for Review**: レビュー待機中
   - **In Review**: レビュー中
   - **Approved**: 承認
   - **Rejected**: 却下

### 7.2 却下時の対応

却下された場合:

1. 却下理由を確認
2. 理由に基づき修正
3. 新しいビルドを提出
4. 再度 Submit for Review をクリック

**フェーズ 7 実施中...**

---

## フェーズ 8: App Store リリース

### 8.1 リリース承認

1. App Store Connect で **Approved** ステータスを確認
2. **Release** をクリック
3. **Release This Version** をクリック

### 8.2 リリース確認

1. App Store で OVR VBT Coach を検索
2. アプリが表示されることを確認
3. ダウンロード数を監視

**フェーズ 8 完了！** ✅

---

## トラブルシューティング

### App Store Connect で登録できない

**症状**: Bundle ID エラー

**対応**:
1. Bundle ID が正しいか確認
2. 既に登録されていないか確認
3. Apple Developer アカウント設定を確認

### Manus ビルドが失敗

**症状**: ビルドエラー

**対応**:
1. Build Logs でエラーメッセージ確認
2. ローカルで `npm run check` 実行
3. エラーを修正
4. ビルド再実行

### TestFlight 招待が送信されない

**症状**: テスターがメール受け取らない

**対応**:
1. メールアドレスが正しいか確認
2. App Store Connect で「Resend Invitation」をクリック
3. スパムフォルダを確認

### Apple レビューで却下

**症状**: 却下理由が表示される

**対応**:
1. 却下理由を確認
2. 理由に基づき修正
3. 新しいビルドを提出
4. 再度 Submit for Review をクリック

---

## 参考ドキュメント

| ドキュメント | 説明 |
|------------|------|
| `EXECUTION_GUIDE.md` | 3 ステップ統合ガイド |
| `APP_STORE_METADATA.md` | App Store メタデータ |
| `QUICK_START.md` | クイックスタートガイド |
| `scripts/prepare-app-store-submission.md` | App Store Connect 詳細ガイド |
| `scripts/manus-build-execution.md` | Manus ビルド詳細ガイド |
| `scripts/testflight-tester-management.md` | TestFlight テスター管理詳細ガイド |

## 参考リンク

- App Store Connect: https://appstoreconnect.apple.com
- Manus: https://app.manus.im
- TestFlight: https://developer.apple.com/testflight/
- Apple Developer: https://developer.apple.com/

---

**プロジェクト**: OVR VBT Coach v2.3.0
**チェックポイント**: c66b42e2
**最終更新**: 2026 年 1 月 25 日
