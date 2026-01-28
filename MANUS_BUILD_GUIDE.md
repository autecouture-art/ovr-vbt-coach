# Manus UI での TestFlight ビルド手順

このドキュメントでは、OVR VBT Coach アプリを Manus UI を使用して iOS ビルドし、TestFlight にデプロイする手順を説明します。

## 前提条件

- Manus アカウント（https://app.manus.im）
- Apple Developer アカウント
- App Store Connect へのアクセス権限
- このプロジェクトの最新チェックポイント（version: 21f572d1）

## ステップ 1: Manus UI へのログイン

1. **https://app.manus.im** にアクセス
2. Manus アカウント認証情報でログイン
3. 左側のプロジェクト一覧から **「OVR VBT Coach」** を選択

## ステップ 2: ビルド設定の確認

### 2.1 プロジェクト情報の確認

Management UI の **Settings** パネルで以下を確認：

| 項目 | 値 |
|------|-----|
| **App Name** | OVR VBT Coach |
| **Bundle ID** | space.manus.ovr.vbt.coach.app.t20260125053732 |
| **Version** | 2.3.0 |
| **Build Number** | 1 |

### 2.2 シークレット（環境変数）の確認

**Settings → Secrets** で以下が設定されていることを確認：

- `EXPO_PUBLIC_API_URL`（バックエンド API URL）
- その他の必要な環境変数

設定されていない場合は、追加してください。

## ステップ 3: iOS ビルドの開始

### 3.1 ビルド設定パネルを開く

1. Management UI の右上 **「Publish」** ボタンをクリック
2. **「Build for iOS」** オプションを選択

### 3.2 ビルド設定の入力

以下の情報を入力：

| 項目 | 値 |
|------|-----|
| **Deployment Target** | TestFlight |
| **Build Type** | Release |
| **Provisioning Profile** | 自動選択（App Store Connect から自動取得） |

### 3.3 ビルド開始

1. **「Start Build」** ボタンをクリック
2. ビルドが開始され、進捗が表示されます
3. 通常 30～60 分でビルドが完成

## ステップ 4: ビルド進捗の監視

### 4.1 ビルドログの確認

- Management UI に **Build Logs** セクションが表示されます
- リアルタイムでビルド進捗を確認できます

### 4.2 ビルド完了の確認

ビルドが完了すると：

1. Manus から確認メールが送信されます
2. Management UI に **「Upload to TestFlight」** ボタンが表示されます
3. ビルド成果物（IPA ファイル）が自動的に App Store Connect にアップロードされます

## ステップ 5: TestFlight へのアップロード

### 5.1 自動アップロード

Manus は以下を自動で実行：

1. IPA ファイルを App Store Connect にアップロード
2. ビルドメタデータの自動入力
3. テスター招待リンクの生成

### 5.2 App Store Connect での確認

1. **https://appstoreconnect.apple.com** にアクセス
2. **My Apps** → **OVR VBT Coach** を選択
3. **TestFlight** タブで新しいビルドが表示されることを確認

## ステップ 6: TestFlight テスターの招待

### 6.1 内部テスターの追加

1. App Store Connect の **TestFlight** タブを開く
2. **Internal Testers** セクションで **「+」** をクリック
3. テスターのメールアドレスを入力
4. **「Add」** をクリック

### 6.2 テスター招待の送信

1. テスターが自動的に招待メールを受け取ります
2. TestFlight アプリをインストールして招待を受け入れます
3. OVR VBT Coach アプリをダウンロード

## ステップ 7: テスト実施

### 7.1 主要機能のテスト

テスターは以下の機能をテストしてください：

| 機能 | テスト内容 |
|------|-----------|
| **アプリ起動** | アプリが正常に起動し、ホーム画面が表示される |
| **BLE 接続** | OVR Velocity センサーとのペアリングが可能 |
| **セッション記録** | セッション開始 → エクササイズ記録 → セッション終了が動作 |
| **PR 検知** | 新しい PR（Personal Record）が検知され、通知が表示される |
| **データ表示** | 本日の累計ボリューム、Velocity Loss が正しく計算・表示される |
| **ダークモード** | ダークテーマが正しく適用されている |

### 7.2 バグ報告

テスターがバグを発見した場合：

1. TestFlight アプリ内の **「Send Feedback」** ボタンをクリック
2. バグの詳細を記入
3. スクリーンショットやビデオを添付
4. **「Send」** をクリック

## ステップ 8: ビルド更新

### 8.1 新しいビルドの提出

バグ修正や機能追加後、新しいビルドを提出：

1. コード変更を実施
2. `todo.md` で完了したタスクをマーク
3. `webdev_save_checkpoint` で新しいチェックポイントを作成
4. Manus UI で **「Build for iOS」** を再度実行
5. **Build Number** を 2 に更新（app.config.ts）

### 8.2 ビルド番号の更新

```typescript
// app.config.ts
ios: {
  buildNumber: "2",  // 前回から +1
  // ...
}
```

## トラブルシューティング

### ビルド失敗時

1. **ビルドログを確認** - Management UI の Build Logs セクションでエラーメッセージを確認
2. **一般的なエラー**:
   - `Provisioning Profile not found` → Apple Developer アカウント設定を確認
   - `Pod install failed` → 依存関係を再インストール（`pnpm install`）
   - `TypeScript errors` → `npm run check` でエラーを修正

### TestFlight アップロード失敗時

1. **App Store Connect の確認** - ビルドが正常にアップロードされているか確認
2. **メタデータの確認** - アプリの説明、スクリーンショット、プライバシーポリシーが設定されているか確認
3. **Manus サポート** - https://help.manus.im でサポートを受ける

## 参考リンク

- [Manus ドキュメント](https://docs.manus.im)
- [App Store Connect ガイド](https://developer.apple.com/app-store-connect/)
- [TestFlight ドキュメント](https://developer.apple.com/testflight/)
- [Expo ビルド ドキュメント](https://docs.expo.dev/build/introduction/)
