# OVR VBT Coach - デプロイメント開始ガイド

このドキュメントは、OVR VBT Coach を App Store にリリースするためのデプロイメント開始ガイドです。

## 概要

OVR VBT Coach は完全に準備されており、以下の 3 つのステップで App Store にリリースできます:

1. **App Store Connect 登録** (15 分)
2. **Manus ビルド実行** (30～60 分)
3. **TestFlight テスター招待** (10 分)

**合計時間**: 1～2 時間

## クイックスタート

### 方法 1: インタラクティブなマスタースクリプト（推奨）

```bash
cd /home/ubuntu/ovr-vbt-coach-app
bash scripts/run-deployment.sh
```

このスクリプトは以下を行います:

- 3 つのステップをメニュー形式で提示
- 各ステップの詳細ガイドを表示
- 完了確認を取得
- 次のステップへ自動遷移

### 方法 2: 個別ステップの実行

各ステップを個別に実行する場合:

```bash
# ステップ 1: App Store Connect 登録
bash scripts/automated-app-store-setup.sh

# ステップ 2: Manus ビルド実行
bash scripts/automated-manus-build.sh

# ステップ 3: TestFlight テスター招待
bash scripts/automated-testflight-invitation.sh
```

### 方法 3: 詳細ドキュメント参照

詳細なドキュメントを参照する場合:

- **FINAL_DEPLOYMENT_GUIDE.md** - 8 フェーズ完全ガイド
- **EXECUTION_GUIDE.md** - 3 ステップ統合ガイド
- **APP_STORE_METADATA.md** - App Store メタデータ

## ステップ 1: App Store Connect 登録

### 実行方法

```bash
bash scripts/automated-app-store-setup.sh
```

### 概要

- App Store Connect でアプリを新規登録
- アプリ情報（名前、説明、キーワード）を入力
- スクリーンショット 5 枚をアップロード
- 年齢レーティングを設定

### 時間

約 15 分

### チェックリスト

- [ ] App Store Connect にログイン
- [ ] 新しいアプリを作成
- [ ] アプリ情報を入力
- [ ] スクリーンショットをアップロード
- [ ] 年齢レーティングを設定
- [ ] App Store Connect でアプリが表示される

## ステップ 2: Manus ビルド実行

### 実行方法

```bash
bash scripts/automated-manus-build.sh
```

### 概要

- Manus UI で iOS ビルドを開始
- ビルドプロセスを監視（30～60 分）
- ビルド完了を確認
- App Store Connect でビルドが表示されることを確認

### 時間

30～60 分

### チェックリスト

- [ ] Manus UI にアクセス
- [ ] OVR VBT Coach プロジェクトを選択
- [ ] Publish ボタンをクリック
- [ ] Build for iOS を選択
- [ ] Start Build をクリック
- [ ] ビルド進捗を監視
- [ ] ビルド完了メール受信
- [ ] App Store Connect でビルド表示を確認

## ステップ 3: TestFlight テスター招待

### 実行方法

```bash
bash scripts/automated-testflight-invitation.sh
```

### 概要

- Internal Testers グループを作成
- テスターを追加
- ビルドをテスターグループに追加
- テスター指示を送信

### 時間

約 10 分

### チェックリスト

- [ ] Internal Testers グループを作成
- [ ] テスターを追加
- [ ] ビルドをテスターグループに追加
- [ ] テスター指示を送信
- [ ] テスターが招待メールを受け取る

## デプロイメント後

### テスト実施（2～5 日）

- テスターがアプリをインストール
- テスターが主要機能をテスト
- テスターがフィードバックを送信

### バグ修正（1～3 日）

- テスターからのフィードバックを確認
- バグを修正
- 新しいビルドを提出

### App Store リリース準備

- すべてのテストが完了
- すべてのバグが修正
- リリースノートを作成
- App Store に提出

## トラブルシューティング

### App Store Connect で登録できない

**症状**: Bundle ID エラー

**対応**:
1. Bundle ID が正しいか確認: `space.manus.ovr.vbt.coach.app.t20260125053732`
2. 既に登録されていないか確認
3. Apple Developer アカウント設定を確認

### Manus ビルドが失敗

**症状**: ビルドエラー

**対応**:
1. Manus UI で Build Logs を確認
2. ローカルで `npm run check` を実行
3. エラーを修正
4. ビルドを再実行

### TestFlight 招待が送信されない

**症状**: テスターがメール受け取らない

**対応**:
1. メールアドレスが正しいか確認
2. App Store Connect で「Resend Invitation」をクリック
3. スパムフォルダを確認

## 参考情報

| 項目 | 値 |
|------|-----|
| **アプリ名** | OVR VBT Coach |
| **Bundle ID** | space.manus.ovr.vbt.coach.app.t20260125053732 |
| **バージョン** | 2.3.0 |
| **ビルド番号** | 1 |
| **プラットフォーム** | iOS 15.1+ |
| **価格** | Free |

## 参考ドキュメント

- **FINAL_DEPLOYMENT_GUIDE.md** - 8 フェーズ完全ガイド
- **EXECUTION_GUIDE.md** - 3 ステップ統合ガイド
- **APP_STORE_METADATA.md** - App Store メタデータ
- **QUICK_START.md** - クイックスタートガイド

## サポート

問題が発生した場合:

1. **FINAL_DEPLOYMENT_GUIDE.md** の「トラブルシューティング」セクションを確認
2. **Manus サポート**: https://help.manus.im
3. **Apple Developer サポート**: https://developer.apple.com/support/

---

**プロジェクト**: OVR VBT Coach v2.3.0
**チェックポイント**: 18497531
**最終更新**: 2026 年 1 月 25 日

**次のステップ**: `bash scripts/run-deployment.sh` を実行してデプロイメントを開始してください。
