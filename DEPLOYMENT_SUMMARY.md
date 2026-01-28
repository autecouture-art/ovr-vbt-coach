# OVR VBT Coach - TestFlight デプロイ完全ガイド

このドキュメントは、OVR VBT Coach アプリを iOS TestFlight にデプロイするための完全なステップバイステップガイドです。

## 概要

OVR VBT Coach は、Bluetooth を使用してリアルタイムで速度データを取得し、VBT（速度ベーストレーニング）分析を提供するモバイルアプリです。本ガイドでは、Manus ビルドシステムを使用して iOS アプリをビルドし、App Store Connect 経由で TestFlight にデプロイする手順を説明します。

## 前提条件

| 項目 | 説明 |
|------|------|
| **Manus アカウント** | https://app.manus.im でログイン可能 |
| **Apple Developer アカウント** | $99/年の年間登録が必要 |
| **App Store Connect アクセス** | Apple Developer アカウントで管理者権限 |
| **プロジェクト情報** | Version: 21f572d1（最新チェックポイント） |

## デプロイメントフロー

```
1. Manus UI でビルド開始
   ↓
2. iOS ビルド実行（30～60 分）
   ↓
3. IPA ファイル生成
   ↓
4. App Store Connect にアップロード
   ↓
5. TestFlight で内部テスト実施
   ↓
6. バグ修正と新ビルド提出（必要に応じて）
   ↓
7. App Store リリース（オプション）
```

## 詳細ガイド

### フェーズ 1: 準備（1～2 時間）

**実施内容**: App Store Connect でアプリを登録し、ビルド前の設定を完了

**必要なドキュメント**:
- `APP_STORE_CONNECT_SETUP.md` - App Store Connect セットアップ手順

**チェックリスト**:
- [ ] Apple Developer アカウントが有効
- [ ] App Store Connect にログイン可能
- [ ] 新しいアプリを登録（Bundle ID: `space.manus.ovr.vbt.coach.app.t20260125053732`）
- [ ] アプリ情報を入力（名前、説明、カテゴリ）
- [ ] プライバシーポリシー URL を設定
- [ ] 年齢レーティングを設定

### フェーズ 2: ビルド実行（1～2 時間）

**実施内容**: Manus UI を使用して iOS ビルドを実行

**必要なドキュメント**:
- `MANUS_BUILD_GUIDE.md` - Manus ビルド手順

**チェックリスト**:
- [ ] Manus UI（https://app.manus.im）にログイン
- [ ] OVR VBT Coach プロジェクトを選択
- [ ] Management UI で Secrets を確認
- [ ] 「Publish」→「Build for iOS」をクリック
- [ ] ビルド設定を入力（TestFlight デプロイ）
- [ ] 「Start Build」をクリック
- [ ] ビルド進捗を監視
- [ ] ビルド完了メール受信

### フェーズ 3: TestFlight 設定（30 分～1 時間）

**実施内容**: TestFlight でテスターを招待し、ビルドを配布

**チェックリスト**:
- [ ] App Store Connect で新しいビルドを確認
- [ ] Internal Testers グループを作成
- [ ] テスターのメールアドレスを追加
- [ ] ビルドを Internal Testers に追加
- [ ] テスター招待メール送信
- [ ] テスターが TestFlight アプリをダウンロード

### フェーズ 4: テスト実施（2～5 日）

**実施内容**: テスターが主要機能をテストし、バグを報告

**テスト対象機能**:

| 機能 | テスト内容 |
|------|-----------|
| **アプリ起動** | アプリが正常に起動し、ホーム画面が表示される |
| **BLE 接続** | OVR Velocity センサーとのペアリングが可能 |
| **セッション記録** | セッション開始 → エクササイズ記録 → セッション終了が動作 |
| **PR 検知** | 新しい PR が検知され、通知が表示される |
| **データ表示** | 本日の累計ボリューム、Velocity Loss が正しく計算・表示される |
| **ダークモード** | ダークテーマが正しく適用されている |
| **クラッシュ** | アプリがクラッシュしない |

**バグ報告方法**:
1. TestFlight アプリ内の「Send Feedback」をクリック
2. バグの詳細を記入
3. スクリーンショットやビデオを添付
4. 「Send」をクリック

### フェーズ 5: バグ修正と新ビルド（必要に応じて）

**実施内容**: テスターからのフィードバックに基づいてバグを修正し、新しいビルドを提出

**手順**:
1. バグを修正
2. `todo.md` で完了したタスクをマーク
3. `webdev_save_checkpoint` で新しいチェックポイントを作成
4. Manus UI で「Build for iOS」を再度実行
5. `app.config.ts` の Build Number を更新（例：1 → 2）
6. 新しいビルドを TestFlight に追加

### フェーズ 6: App Store リリース（オプション）

**実施内容**: テストが完了し、すべてのバグが修正されたら、App Store にリリース

**チェックリスト**:
- [ ] すべてのテストが完了
- [ ] すべてのバグが修正
- [ ] スクリーンショットが追加されている
- [ ] App Preview ビデオが追加されている
- [ ] リリースノートが作成されている
- [ ] 「Submit for Review」をクリック
- [ ] Apple レビュー待機（24～48 時間）
- [ ] App Store リリース

## トラブルシューティング

### ビルド失敗時

**症状**: Manus ビルドが失敗

**対応**:
1. Management UI の Build Logs セクションでエラーメッセージを確認
2. 一般的なエラー:
   - `Provisioning Profile not found` → Apple Developer アカウント設定を確認
   - `Pod install failed` → 依存関係を再インストール（`pnpm install`）
   - `TypeScript errors` → `npm run check` でエラーを修正
3. エラーを修正して新しいビルドを実行

### TestFlight アップロード失敗時

**症状**: IPA ファイルが App Store Connect にアップロードされない

**対応**:
1. App Store Connect でビルドが表示されているか確認
2. ビルドのステータスを確認（Processing → Ready to Test）
3. Manus ビルドログでエラーを確認
4. https://help.manus.im でサポートを受ける

### テスター招待が送信されない

**症状**: テスターがメールを受け取らない

**対応**:
1. テスターのメールアドレスが正しいか確認
2. テスターが Apple ID を持っているか確認
3. App Store Connect で「Resend Invitation」をクリック

### App Store リジェクト

**症状**: App Store リビューで拒否される

**対応**:
1. リジェクト理由をレビュー
2. 必要な変更を実施
3. 新しいビルドを提出
4. [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) を確認

## 重要なファイル

| ファイル | 説明 |
|---------|------|
| `app.config.ts` | Expo アプリ設定（Bundle ID、権限、バージョン） |
| `MANUS_BUILD_GUIDE.md` | Manus UI でのビルド手順 |
| `APP_STORE_CONNECT_SETUP.md` | App Store Connect セットアップ手順 |
| `TESTFLIGHT_DEPLOYMENT.md` | TestFlight デプロイ手順 |
| `IOS_BUILD_CHECKLIST.md` | iOS ビルド前チェックリスト |
| `todo.md` | プロジェクトタスク管理 |

## 参考リンク

- [Manus ドキュメント](https://docs.manus.im)
- [App Store Connect ヘルプ](https://help.apple.com/app-store-connect/)
- [TestFlight ドキュメント](https://developer.apple.com/testflight/)
- [Expo ビルド ドキュメント](https://docs.expo.dev/build/introduction/)
- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

## サポート

問題が発生した場合は、以下のサポートチャネルを利用してください：

- **Manus サポート**: https://help.manus.im
- **Apple Developer サポート**: https://developer.apple.com/support/
- **Expo コミュニティ**: https://forums.expo.dev/

## 次のステップ

1. **App Store Connect セットアップ** - `APP_STORE_CONNECT_SETUP.md` を参照
2. **Manus ビルド実行** - `MANUS_BUILD_GUIDE.md` を参照
3. **TestFlight テスト** - テスターを招待し、主要機能をテスト
4. **バグ修正** - テスターのフィードバックに基づいてバグを修正
5. **App Store リリース** - テストが完了したら App Store にリリース

---

**最終更新**: 2026 年 1 月 25 日
**プロジェクトバージョン**: 2.3.0
**チェックポイント**: 21f572d1
