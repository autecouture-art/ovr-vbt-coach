# Manus AI Deployment Guide

このドキュメントでは、OVR VBT CoachをManus AI経由でTestFlightにデプロイする方法を説明します。

## 前提条件

1. **Apple Developer アカウント**
   - Apple Developer Program への登録（年間 $99）
   - https://developer.apple.com/programs/

2. **Manus アカウント**
   - Manus AI のアカウント作成
   - "Develop Apps" 機能が有効になっていること
   - https://manus.im

## デプロイ手順

### 1. プロジェクトの準備

```bash
# 依存関係のインストール
npm install

# TypeScriptの型チェック
npm run type-check

# Lintのチェック
npm run lint
```

### 2. app.json の設定確認

以下の項目が正しく設定されていることを確認：

- `expo.name`: アプリ名
- `expo.slug`: URL フレンドリーな名前
- `expo.version`: バージョン番号
- `expo.ios.bundleIdentifier`: バンドルID（例: com.yourcompany.ovrvbtcoach）
- `expo.ios.buildNumber`: ビルド番号

### 3. Manus AI でのビルド

#### 方法1: Manus CLI を使用

```bash
# Manus CLI のインストール（初回のみ）
npm install -g manus-cli

# ログイン
manus login

# iOS ビルドの開始
manus build:ios --testflight

# ビルドステータスの確認
manus build:status
```

#### 方法2: Manus Web UI を使用

1. https://app.manus.im にログイン
2. "New Project" をクリック
3. GitHubリポジトリを接続、または手動でアップロード
4. "Build for iOS" を選択
5. "Deploy to TestFlight" オプションを有効化
6. ビルドを開始

### 4. Apple Developer Console での設定

Manus がビルドをアップロードした後：

1. https://appstoreconnect.apple.com にログイン
2. "My Apps" → 該当アプリを選択
3. "TestFlight" タブを開く
4. ビルドが処理されるまで待機（通常 10-30 分）
5. "Internal Testing" または "External Testing" を設定
6. テスターを招待

### 5. TestFlight でのテスト

1. テスターに招待メールが送信される
2. TestFlight アプリをインストール
3. 招待を承認してアプリをインストール
4. フィードバックを収集

## トラブルシューティング

### ビルドエラー

```bash
# 依存関係のクリーンインストール
rm -rf node_modules
npm install

# キャッシュのクリア
npm start -- --clear
```

### BLE権限エラー

`app.json` の `ios.infoPlist` セクションを確認：

```json
{
  "NSBluetoothAlwaysUsageDescription": "This app uses Bluetooth...",
  "NSBluetoothPeripheralUsageDescription": "This app uses Bluetooth..."
}
```

### TypeScript エラー

```bash
# 型定義の再生成
npm run type-check
```

## 注意事項

1. **初回ビルド**: 初回のビルドには通常より時間がかかります（30-60分）
2. **バージョン管理**:
   - `version` はユーザーに表示される（例: 2.3.0）
   - `buildNumber` は Apple が管理（増加する整数）
3. **テスト**: TestFlight では最大 10,000 人の外部テスターを招待可能
4. **有効期限**: TestFlightビルドは 90 日間有効

## 参考リンク

- [Manus AI Documentation](https://help.manus.im)
- [Expo Documentation](https://docs.expo.dev)
- [Apple TestFlight Documentation](https://developer.apple.com/testflight/)
- [App Store Connect](https://appstoreconnect.apple.com)

## サポート

問題が発生した場合：

1. Manus Help Center: https://help.manus.im
2. Expo Forums: https://forums.expo.dev
3. GitHub Issues: https://github.com/YOUR_USERNAME/ovr-vbt-coach/issues
