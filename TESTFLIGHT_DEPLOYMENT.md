# OVR VBT Coach - TestFlight デプロイガイド

このドキュメントでは、OVR VBT Coach アプリを Manus AI 経由で TestFlight にデプロイする手順を説明します。

## 前提条件

### 1. Apple Developer アカウント
- Apple Developer Program への登録（年間 $99）
- https://developer.apple.com/programs/

### 2. Manus アカウント
- Manus AI のアカウント作成
- "Develop Apps" 機能が有効になっていること
- https://manus.im

### 3. 必要な情報
- **Bundle ID**: `space.manus.ovr.vbt.coach.app.t20260125053732`
- **App Name**: OVR VBT Coach
- **Version**: 2.3.0
- **Build Number**: 1

---

## デプロイ手順

### ステップ 1: プロジェクトの準備確認

```bash
# プロジェクトディレクトリに移動
cd /home/ubuntu/ovr-vbt-coach-app

# 依存関係が正しくインストールされているか確認
pnpm install

# TypeScript の型チェック
pnpm check

# Lint チェック
pnpm lint
```

### ステップ 2: Manus UI でのビルド

#### 方法 1: Manus Web UI を使用（推奨）

1. https://app.manus.im にログイン
2. 左サイドバーから「Develop Apps」をクリック
3. 「New Project」をクリック
4. 以下の情報を入力:
   - **Project Name**: OVR VBT Coach
   - **Repository**: GitHub リポジトリを接続、または手動でコードをアップロード
   - **Branch**: claude/research-manus-testflight-PvblD
5. 「Build for iOS」を選択
6. 「Deploy to TestFlight」オプションを有効化
7. 「Start Build」をクリック

#### 方法 2: Manus CLI を使用

```bash
# Manus CLI のインストール（初回のみ）
npm install -g manus-cli

# Manus にログイン
manus login

# iOS ビルドの開始
manus build:ios --testflight

# ビルドステータスの確認
manus build:status

# ビルドログの確認
manus build:logs
```

### ステップ 3: ビルド中の確認事項

ビルドプロセスは通常 30～60 分かかります。以下をご確認ください:

- **初回ビルド**: 初回は通常より時間がかかります（60 分程度）
- **エラー通知**: ビルドエラーが発生した場合、メールで通知されます
- **ビルドアーティファクト**: 成功時に `.ipa` ファイルが生成されます

### ステップ 4: App Store Connect での設定

Manus がビルドをアップロードした後:

1. https://appstoreconnect.apple.com にログイン
2. 「My Apps」から「OVR VBT Coach」を選択
3. 「TestFlight」タブを開く
4. ビルドが処理されるまで待機（通常 10～30 分）
5. ビルドが表示されたら、以下を設定:

#### 内部テスト（Internal Testing）の設定

```
1. "Internal Testing" セクションを開く
2. "Testers" タブで内部テスターを追加
3. テスターのメールアドレスを入力
4. 招待を送信
```

#### 外部テスト（External Testing）の設定（オプション）

```
1. "External Testing" セクションを開く
2. "Testers" タブで外部テスターを追加
3. 最大 10,000 人まで招待可能
4. テスターのメールアドレスを入力
5. 招待を送信
```

### ステップ 5: TestFlight でのテスト

テスターに招待メールが送信されます:

1. テスターが TestFlight アプリをインストール（App Store から無料）
2. 招待メール内のリンクをタップ
3. TestFlight アプリで招待を承認
4. アプリをインストール
5. フィードバックを送信

---

## トラブルシューティング

### ビルドエラー: "Provisioning Profile Not Found"

**原因**: Apple Developer アカウントの設定が不完全

**解決方法**:
1. App Store Connect で Bundle ID を登録
2. Provisioning Profile を作成
3. Manus で Apple Developer アカウントを再認証

### ビルドエラー: "Code Signing Failed"

**原因**: コード署名証明書の問題

**解決方法**:
1. Apple Developer アカウントで証明書を確認
2. Manus で証明書を更新
3. ビルドを再実行

### ビルドエラー: "Invalid Bundle Identifier"

**原因**: Bundle ID が Apple の規則に違反

**現在の Bundle ID**: `space.manus.ovr.vbt.coach.app.t20260125053732`

**確認事項**:
- ドット区切りの各セグメントが文字で始まっているか
- 特殊文字が含まれていないか

### TestFlight でビルドが表示されない

**原因**: ビルドの処理中

**解決方法**:
1. App Store Connect を再読み込み
2. 10～30 分待機
3. 「Builds」タブを確認

### テスターが招待を受け取らない

**原因**: メールアドレスの入力ミス

**解決方法**:
1. テスターのメールアドレスを確認
2. 招待を再送信
3. スパムフォルダを確認

---

## 注意事項

### バージョン管理

- **Version**: ユーザーに表示される（例: 2.3.0）
- **Build Number**: Apple が管理する整数（増加する必要あり）
- 新しいビルドを提出する際は、Build Number を増やしてください

### TestFlight の有効期限

- TestFlight ビルドは 90 日間有効です
- 90 日後は自動的に削除されます
- 継続的なテストが必要な場合は、定期的に新しいビルドをアップロード

### App Store 申請前

TestFlight テストが完了したら、以下を確認してから App Store に申請してください:

- [ ] すべての機能が正常に動作
- [ ] iOS デバイスでのテスト完了
- [ ] BLE デバイスとの互換性確認
- [ ] バッテリー消費テスト
- [ ] クラッシュレポート確認
- [ ] プライバシーポリシーの準備
- [ ] スクリーンショットの準備
- [ ] 説明文の準備

---

## 参考リンク

- [Manus AI Documentation](https://help.manus.im)
- [Expo Documentation](https://docs.expo.dev)
- [Apple TestFlight Documentation](https://developer.apple.com/testflight/)
- [App Store Connect](https://appstoreconnect.apple.com)
- [Apple Developer Program](https://developer.apple.com/programs/)

---

## サポート

問題が発生した場合:

1. **Manus Help Center**: https://help.manus.im
2. **Expo Forums**: https://forums.expo.dev
3. **Apple Developer Support**: https://developer.apple.com/support/

---

## デプロイ完了後

TestFlight でのテストが完了したら:

1. **フィードバック収集**: テスターからのフィードバックを収集
2. **バグ修正**: 報告されたバグを修正
3. **App Store 申請**: 準備完了後、App Store に申請
4. **リリース**: App Store で公開

**Happy Deployment! 🚀**
