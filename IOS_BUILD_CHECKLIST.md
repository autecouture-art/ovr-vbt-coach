# OVR VBT Coach - iOS ビルド準備チェックリスト

このチェックリストを使用して、TestFlight へのビルド提出前にすべての準備が完了していることを確認してください。

---

## アプリ設定

- [x] **app.config.ts の設定**
  - [x] App Name: "OVR VBT Coach"
  - [x] Version: "2.3.0"
  - [x] Build Number: "1"
  - [x] Bundle ID: "space.manus.ovr.vbt.coach.app.t20260125053732"
  - [x] iOS Deployment Target: "13.0"

- [x] **Info.plist の権限設定**
  - [x] NSBluetoothAlwaysUsageDescription
  - [x] NSBluetoothPeripheralUsageDescription
  - [x] NSCameraUsageDescription
  - [x] NSMicrophoneUsageDescription
  - [x] NSPhotoLibraryUsageDescription
  - [x] NSLocationWhenInUseUsageDescription
  - [x] ITSAppUsesNonExemptEncryption: false

---

## 依存関係と環境

- [x] **Node.js と pnpm**
  - [x] Node.js 18+ インストール済み
  - [x] pnpm 9.12.0 インストール済み

- [x] **プロジェクト依存関係**
  - [x] `pnpm install` 実行済み
  - [x] すべての依存関係が正常にインストール

- [x] **TypeScript**
  - [x] `pnpm check` でエラーなし
  - [x] すべての型定義が正しい

- [x] **Linting**
  - [x] `pnpm lint` でエラーなし

---

## アプリアセット

- [ ] **アプリアイコン**
  - [ ] `assets/images/icon.png` (1024×1024px)
  - [ ] `assets/images/android-icon-foreground.png`
  - [ ] `assets/images/android-icon-background.png`
  - [ ] `assets/images/android-icon-monochrome.png`

- [ ] **スプラッシュスクリーン**
  - [ ] `assets/images/splash-icon.png` (200×200px)

- [ ] **ファビコン**
  - [ ] `assets/images/favicon.png`

---

## コード品質

- [ ] **機能テスト**
  - [ ] ホーム画面が正常に表示される
  - [ ] セッション開始が機能する
  - [ ] BLE 接続ロジックが実装されている
  - [ ] データベース操作が機能する

- [ ] **エラーハンドリング**
  - [ ] エラーメッセージが適切に表示される
  - [ ] クラッシュが発生しない

- [ ] **パフォーマンス**
  - [ ] アプリが遅延なく起動する
  - [ ] メモリリークがない
  - [ ] バッテリー消費が適切

---

## ドキュメント

- [x] **README.md**
  - [x] プロジェクト概要が記載されている
  - [x] インストール手順が記載されている
  - [x] 使用方法が記載されている

- [x] **TESTFLIGHT_DEPLOYMENT.md**
  - [x] デプロイ手順が記載されている
  - [x] トラブルシューティングが記載されている

- [x] **design.md**
  - [x] アプリ設計が記載されている
  - [x] スクリーン構成が記載されている
  - [x] ユーザーフローが記載されている

- [x] **todo.md**
  - [x] 実装予定機能が記載されている
  - [x] 完了項目が記載されている

---

## Apple Developer 設定

- [ ] **Apple Developer Program**
  - [ ] アカウント登録済み
  - [ ] 年間費用（$99）支払い済み

- [ ] **App Store Connect**
  - [ ] アプリを登録
  - [ ] Bundle ID を登録
  - [ ] Provisioning Profile を作成
  - [ ] Code Signing Certificate を作成

- [ ] **TestFlight**
  - [ ] 内部テスターを追加
  - [ ] 外部テスターを追加（オプション）

---

## Manus AI 設定

- [ ] **Manus アカウント**
  - [ ] アカウント作成済み
  - [ ] "Develop Apps" 機能が有効

- [ ] **GitHub 連携**
  - [ ] GitHub リポジトリを接続
  - [ ] ブランチ `claude/research-manus-testflight-PvblD` を選択

- [ ] **ビルド設定**
  - [ ] iOS ビルドを選択
  - [ ] TestFlight デプロイを有効化

---

## ビルド前の最終確認

- [ ] **コード確認**
  ```bash
  pnpm check  # TypeScript 型チェック
  pnpm lint   # Linting
  ```

- [ ] **ビルドテスト**
  ```bash
  # ローカルでのビルドテスト（オプション）
  eas build --platform ios --local
  ```

- [ ] **Git コミット**
  ```bash
  git add .
  git commit -m "Prepare for TestFlight deployment v2.3.0"
  git push origin claude/research-manus-testflight-PvblD
  ```

---

## ビルド提出

- [ ] **Manus UI でビルド開始**
  1. https://app.manus.im にログイン
  2. 「Build for iOS」を選択
  3. 「Deploy to TestFlight」を有効化
  4. 「Start Build」をクリック

- [ ] **ビルド完了待機**
  - [ ] ビルドが成功（通常 30～60 分）
  - [ ] メール通知を確認

- [ ] **App Store Connect で確認**
  - [ ] ビルドが表示される
  - [ ] ビルドが処理完了（10～30 分）

---

## TestFlight テスト

- [ ] **内部テスト**
  - [ ] テスターに招待を送信
  - [ ] テスターがアプリをインストール
  - [ ] アプリが正常に起動
  - [ ] 主要機能が動作

- [ ] **フィードバック収集**
  - [ ] テスターからのフィードバックを収集
  - [ ] バグレポートを確認
  - [ ] 改善提案を確認

- [ ] **バグ修正**
  - [ ] 報告されたバグを修正
  - [ ] 新しいビルドをアップロード

---

## App Store 申請準備

- [ ] **メタデータ準備**
  - [ ] アプリ説明文を作成
  - [ ] キーワードを設定
  - [ ] スクリーンショットを準備（5～10 枚）
  - [ ] プレビュー動画を準備（オプション）

- [ ] **法務関連**
  - [ ] プライバシーポリシーを作成
  - [ ] 利用規約を作成
  - [ ] サポート URL を設定

- [ ] **レーティング**
  - [ ] App Store Content Rating を完了
  - [ ] 年齢制限を設定

---

## 完了チェック

すべてのチェック項目を確認してから、ビルドを提出してください。

**チェック完了日**: ________________

**チェック者**: ________________

**ビルド提出日**: ________________

**TestFlight 承認日**: ________________

---

## 次のステップ

1. **TestFlight テスト**: 2～3 週間のテスト期間を設定
2. **フィードバック収集**: テスターからのフィードバックを収集
3. **バグ修正**: 報告されたバグを修正
4. **App Store 申請**: テスト完了後、App Store に申請
5. **リリース**: App Store で公開

---

**Good luck with your TestFlight submission! 🚀**
