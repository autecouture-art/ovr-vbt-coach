# App Store Connect セットアップガイド

OVR VBT Coach を App Store Connect で登録し、TestFlight デプロイの準備を整えるための手順です。

## 前提条件

- Apple Developer アカウント（年間 $99）
- App Store Connect へのアクセス権限
- Bundle ID: `space.manus.ovr.vbt.coach.app.t20260125053732`

## ステップ 1: App Store Connect へのログイン

1. **https://appstoreconnect.apple.com** にアクセス
2. Apple ID でログイン
3. **My Apps** セクションを開く

## ステップ 2: 新しいアプリの登録

### 2.1 アプリ作成ページを開く

1. **My Apps** の左上 **「+」** ボタンをクリック
2. **「New App」** を選択

### 2.2 アプリ情報の入力

| 項目 | 値 |
|------|-----|
| **Platform** | iOS |
| **Name** | OVR VBT Coach |
| **Primary Language** | English |
| **Bundle ID** | space.manus.ovr.vbt.coach.app.t20260125053732 |
| **SKU** | ovr-vbt-coach-001 |
| **User Access** | Full Access |

### 2.3 アプリ作成

**「Create」** をクリック

## ステップ 3: アプリ情報の設定

### 3.1 App Information タブ

1. **App Store Connect** → **OVR VBT Coach** → **App Information** を開く
2. 以下を入力：

| 項目 | 値 |
|------|-----|
| **App Name** | OVR VBT Coach |
| **Subtitle** | Real-Time Velocity Training Analytics |
| **Category** | Health & Fitness |
| **Privacy Policy URL** | https://example.com/privacy（後で更新） |

### 3.2 General App Information

1. **App Type** → **App** を選択
2. **Age Rating** → 適切なレーティングを選択
3. **Copyright** → 著作権情報を入力（例：2026 OVR Velocity）

## ステップ 4: アプリの説明と詳細

### 4.1 App Description

1. **App Store** タブを開く
2. **Description** に以下を入力：

```
OVR VBT Coach is a real-time velocity-based training (VBT) analytics platform that helps athletes and coaches optimize workout performance through Bluetooth-connected velocity sensors.

Key Features:
- Real-time velocity tracking during exercises
- Personal Record (PR) detection and notifications
- Velocity Loss calculation for fatigue monitoring
- Session history and analytics dashboard
- Dark mode optimized for gym environments
```

### 4.2 Keywords

```
fitness, training, velocity, VBT, workout, analytics, Bluetooth, personal trainer
```

### 4.3 Support URL

```
https://example.com/support
```

## ステップ 5: スクリーンショットとプレビュー

### 5.1 App Preview

1. **App Preview** セクションで **「+」** をクリック
2. iPhone 15 Pro Max（6.7 インチ）用の 30 秒以下のビデオを追加

**推奨内容**:
- アプリ起動画面
- ホーム画面（本日の累計ボリューム表示）
- BLE 接続画面
- セッション記録画面
- PR 通知表示

### 5.2 Screenshots

各デバイスサイズ（iPhone 6.7 インチ、5.5 インチ、4.7 インチ）用に最低 2 枚のスクリーンショットを追加：

1. **Screenshot 1**: ホーム画面
2. **Screenshot 2**: モニター画面（BLE 接続状態）
3. **Screenshot 3**: セッション履歴画面

## ステップ 6: 価格と配布

### 6.1 Pricing and Availability

1. **Pricing and Availability** タブを開く
2. **Price Tier** → **Free** を選択（テスト用）
3. **Availability** → すべての国を選択

### 6.2 App Availability

1. **Release Type** → **Manual Release** を選択
2. **Regions** → 配布対象国を選択

## ステップ 7: TestFlight 設定

### 7.1 TestFlight タブを開く

1. **TestFlight** タブをクリック
2. **Builds** セクションが表示されます

### 7.2 Internal Testers グループの作成

1. **Internal Testers** セクションで **「+」** をクリック
2. グループ名を入力（例：「Core Team」）
3. テスターのメールアドレスを追加
4. **「Save」** をクリック

### 7.3 External Testers グループの作成（オプション）

1. **External Testers** セクションで **「+」** をクリック
2. グループ名を入力（例：「Beta Testers」）
3. 最大 10,000 人のテスターを追加可能
4. **「Save」** をクリック

## ステップ 8: ビルドのアップロード

### 8.1 Manus からのビルド受け取り

Manus ビルドが完了すると、以下が自動的に実行されます：

1. IPA ファイルが App Store Connect にアップロード
2. ビルドが **Builds** セクションに表示
3. ビルドステータスが「Processing」から「Ready to Test」に変更

### 8.2 ビルドの確認

1. **Builds** セクションで新しいビルドを確認
2. ビルド番号と日時を確認
3. **「Add for Testing」** をクリック

## ステップ 9: テスター招待

### 9.1 Internal Testers への招待

1. **Internal Testers** グループを選択
2. **「Add Build」** をクリック
3. ビルドを選択
4. **「Save」** をクリック

テスターが自動的に招待メールを受け取ります。

### 9.2 External Testers への招待（オプション）

1. **External Testers** グループを選択
2. **「Add Build」** をクリック
3. ビルドを選択
4. テスト期間を設定（最大 90 日）
5. **「Save」** をクリック

## ステップ 10: テスター フィードバックの管理

### 10.1 フィードバック確認

1. **TestFlight** → **Feedback** タブを開く
2. テスターからのフィードバックを確認
3. バグ報告や機能リクエストをレビュー

### 10.2 フィードバック対応

1. バグを修正
2. 新しいビルドを作成
3. **Builds** セクションで新しいビルドをテスターに追加

## ステップ 11: App Store リリース準備

### 11.1 リリース前チェックリスト

- [ ] すべてのスクリーンショットが追加されている
- [ ] App Preview ビデオが追加されている
- [ ] アプリの説明が完成している
- [ ] プライバシーポリシー URL が設定されている
- [ ] サポート URL が設定されている
- [ ] 年齢レーティングが設定されている
- [ ] TestFlight テストが完了している
- [ ] すべてのバグが修正されている

### 11.2 App Store リリース

テストが完了し、すべてのチェックが完了したら：

1. **App Store** タブで **「Submit for Review」** をクリック
2. リリース情報を入力
3. **「Submit」** をクリック

Apple のレビュー期間は通常 24～48 時間です。

## トラブルシューティング

### ビルドが表示されない

1. **Builds** セクションをリロード
2. Manus ビルドログでエラーを確認
3. Bundle ID が正しいか確認

### テスター招待が送信されない

1. テスターのメールアドレスが正しいか確認
2. テスターが Apple ID を持っているか確認
3. **「Resend Invitation」** をクリック

### App Store リジェクト

1. リジェクト理由をレビュー
2. 必要な変更を実施
3. 新しいビルドを提出

## 参考リンク

- [App Store Connect ヘルプ](https://help.apple.com/app-store-connect/)
- [TestFlight ドキュメント](https://developer.apple.com/testflight/)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)
