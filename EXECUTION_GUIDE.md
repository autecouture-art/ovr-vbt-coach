# OVR VBT Coach - TestFlight デプロイ実行ガイド

App Store Connect 登録、Manus ビルド実行、TestFlight テスター招待を一気に進めるための統合ガイドです。

## 概要

このガイドは 3 つの主要ステップを順序立てて説明します:

1. **App Store Connect でアプリ登録** (15 分)
2. **Manus でビルド実行** (30～60 分)
3. **TestFlight でテスター招待** (10 分)

**合計**: 1～2 時間

## ステップ 1: App Store Connect でアプリ登録（15 分）

### 1.1 準備

```bash
# アセット確認
ls -lh assets/images/icon.png
ls -lh assets/screenshots/screenshot-*.png

# ドキュメント確認
cat APP_STORE_METADATA.md | head -50
```

### 1.2 App Store Connect へのアクセス

1. https://appstoreconnect.apple.com にアクセス
2. Apple ID でログイン
3. **My Apps** をクリック

### 1.3 新しいアプリ作成

1. **+** ボタンをクリック
2. **New App** を選択
3. 以下を入力:

```
Platform: iOS
Name: OVR VBT Coach
Primary Language: English
Bundle ID: space.manus.ovr.vbt.coach.app.t20260125053732
SKU: ovr-vbt-coach-001
User Access: Full Access
```

4. **Create** をクリック

### 1.4 App Information タブ

1. **App Information** タブをクリック
2. 以下を入力:

```
App Name: OVR VBT Coach
Subtitle: Real-Time Velocity Training Analytics
Category: Health & Fitness
Privacy Policy URL: https://www.ovrvelocity.com/privacy
Support URL: https://www.ovrvelocity.com/support
Support Email: support@ovrvelocity.com
```

### 1.5 App Store タブ

1. **App Store** タブをクリック
2. **Description** に以下をコピー（`APP_STORE_METADATA.md` から）:

```
OVR VBT Coach is a revolutionary velocity-based training (VBT) analytics platform...
```

3. **Keywords** に以下をコピー:

```
fitness, training, velocity, VBT, workout, analytics, Bluetooth, personal trainer, strength training, powerlifting, CrossFit, performance tracking, sports science, coaching
```

### 1.6 スクリーンショット アップロード

1. **Screenshots** セクションで iPhone 6.7-inch を選択
2. 5 枚のスクリーンショットをアップロード:
   - `assets/screenshots/screenshot-1-home.png`
   - `assets/screenshots/screenshot-2-ble.png`
   - `assets/screenshots/screenshot-3-monitoring.png`
   - `assets/screenshots/screenshot-4-pr.png`
   - `assets/screenshots/screenshot-5-summary.png`

### 1.7 App Information（続き）

1. **Pricing and Availability** をクリック
2. **Price Tier**: Free を選択
3. **Availability**: All countries を選択

### 1.8 年齢レーティング

1. **App Information** → **Age Rating** をクリック
2. すべてのカテゴリで「No」を選択
3. **Age Rating**: 4+ を確認

### 1.9 確認

- [ ] アプリ名: OVR VBT Coach
- [ ] Bundle ID: space.manus.ovr.vbt.coach.app.t20260125053732
- [ ] スクリーンショット: 5 枚
- [ ] 説明: 入力済み
- [ ] キーワード: 入力済み
- [ ] 価格: Free
- [ ] 年齢レーティング: 4+

**ステップ 1 完了！** ✅

---

## ステップ 2: Manus でビルド実行（30～60 分）

### 2.1 Manus UI へのアクセス

1. https://app.manus.im にアクセス
2. Manus アカウントでログイン
3. **OVR VBT Coach** プロジェクトを選択

### 2.2 プロジェクト確認

Management UI で以下を確認:

```
Project: OVR VBT Coach
Status: Running
Dev Server: https://8081-*.sg1.manus.computer
Platform: Mobile (Expo)
```

### 2.3 Secrets 確認

1. **Settings** → **Secrets** をクリック
2. 必要な環境変数が設定されているか確認

### 2.4 ビルド開始

1. Management UI の **Publish** ボタンをクリック
2. **Build for iOS** を選択
3. ビルド設定を確認:

```
Platform: iOS
Build Type: Release
Deployment Target: TestFlight
App Name: OVR VBT Coach
Bundle ID: space.manus.ovr.vbt.coach.app.t20260125053732
Version: 2.3.0
Build Number: 1
```

4. **Start Build** をクリック

### 2.5 ビルド監視

1. Management UI で **Build Logs** を表示
2. リアルタイムでビルド進捗を監視
3. 以下のステージを確認:

```
✓ Dependencies installed
✓ TypeScript compiled
✓ Expo build configured
✓ iOS build completed
✓ IPA generated
✓ Uploaded to App Store Connect
```

### 2.6 ビルド完了

- Manus からビルド完了メール受信
- App Store Connect で新しいビルドが表示される

### 2.7 App Store Connect で確認

1. App Store Connect にログイン
2. **OVR VBT Coach** を選択
3. **TestFlight** → **Builds** をクリック
4. 新しいビルドが表示されることを確認

```
Build Version: 2.3.0
Build Number: 1
Status: Processing → Ready to Test
```

**ステップ 2 完了！** ✅

---

## ステップ 3: TestFlight でテスター招待（10 分）

### 3.1 Internal Testers グループ作成

1. App Store Connect で **OVR VBT Coach** を選択
2. **TestFlight** タブをクリック
3. **Internal Testers** セクションで **+** をクリック
4. **Group Name**: `Core Team` を入力
5. **Create** をクリック

### 3.2 テスター追加

1. **Internal Testers** → **Core Team** をクリック
2. **Add Testers** をクリック
3. テスターのメールアドレスを入力:

```
tester1@example.com
tester2@example.com
tester3@example.com
```

4. **Add** をクリック

### 3.3 ビルドをテスターグループに追加

1. **TestFlight** → **Builds** をクリック
2. 最新のビルド（2.3.0 Build 1）をクリック
3. **Add Build** をクリック
4. **Internal Testers** → **Core Team** を選択
5. **Save** をクリック

### 3.4 テスター招待メール送信

- テスターが自動的に招待メールを受け取ります
- メール件名: `You're invited to test OVR VBT Coach`

### 3.5 テスター指示送信

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

### 3.6 確認

- [ ] Internal Testers グループ作成
- [ ] テスター追加
- [ ] ビルド追加
- [ ] 招待メール送信
- [ ] テスター指示送信

**ステップ 3 完了！** ✅

---

## 全ステップ完了チェックリスト

### App Store Connect

- [ ] アプリ登録完了
- [ ] メタデータ入力完了
- [ ] スクリーンショット 5 枚アップロード
- [ ] 年齢レーティング設定完了

### Manus ビルド

- [ ] ビルド開始
- [ ] ビルド完了（30～60 分）
- [ ] IPA ファイル生成
- [ ] App Store Connect アップロード

### TestFlight

- [ ] Internal Testers グループ作成
- [ ] テスター追加
- [ ] ビルド追加
- [ ] 招待メール送信

## 次のステップ

### テスト実施（2～5 日）

1. テスターが OVR VBT Coach をインストール
2. 主要機能をテスト
3. バグを報告
4. バグ修正と新ビルド提出

### バグ修正手順

1. テスターからのフィードバック確認
2. ローカルでバグ修正
3. `todo.md` で完了したタスクをマーク
4. `webdev_save_checkpoint` で新しいチェックポイント作成
5. Manus でビルド再実行（Build Number: 1 → 2）
6. 新しいビルドをテスターグループに追加

### App Store リリース準備

1. テスト完了確認
2. すべてのバグ修正確認
3. リリースノート作成
4. App Store Connect で「Submit for Review」をクリック
5. Apple レビュー待機（24～48 時間）
6. App Store リリース

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

## 参考ドキュメント

| ドキュメント | 説明 |
|------------|------|
| `APP_STORE_METADATA.md` | App Store メタデータ |
| `QUICK_START.md` | クイックスタートガイド |
| `scripts/prepare-app-store-submission.md` | App Store Connect 登録詳細ガイド |
| `scripts/manus-build-execution.md` | Manus ビルド詳細ガイド |
| `scripts/testflight-tester-management.md` | TestFlight テスター管理詳細ガイド |

## 参考リンク

- App Store Connect: https://appstoreconnect.apple.com
- Manus: https://app.manus.im
- TestFlight: https://developer.apple.com/testflight/
- Apple Developer: https://developer.apple.com/

---

**プロジェクト**: OVR VBT Coach v2.3.0
**チェックポイント**: f0c99621
**最終更新**: 2026 年 1 月 25 日
