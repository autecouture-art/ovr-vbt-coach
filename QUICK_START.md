# OVR VBT Coach - クイックスタートガイド

OVR VBT Coach を TestFlight にデプロイするための最短経路ガイドです。

## 前提条件

- ✅ Manus アカウント（https://app.manus.im）
- ✅ Apple Developer アカウント（$99/年）
- ✅ App Store Connect アクセス権限
- ✅ プロジェクトチェックポイント: `fdd12912`

## 実行手順（最短経路）

### ステップ 1: App Store Connect でアプリ登録（15 分）

```bash
# App Store Connect チェックリストを表示
bash scripts/app-store-connect-checklist.sh
```

**実施内容**:
1. https://appstoreconnect.apple.com にログイン
2. **My Apps** → **+** → **New App** をクリック
3. 以下を入力:
   - Platform: **iOS**
   - Name: **OVR VBT Coach**
   - Bundle ID: **space.manus.ovr.vbt.coach.app.t20260125053732**
   - SKU: **ovr-vbt-coach-001**
4. **Create** をクリック

**参考**: `APP_STORE_METADATA.md` でメタデータを確認

### ステップ 2: アプリ情報を設定（20 分）

1. **App Information** タブで以下を入力:
   - Subtitle: `Real-Time Velocity Training Analytics`
   - Category: `Health & Fitness`
   - Privacy Policy URL: `https://www.ovrvelocity.com/privacy`
   - Support URL: `https://www.ovrvelocity.com/support`

2. **App Store** タブで:
   - Description を入力（`APP_STORE_METADATA.md` から）
   - Keywords を入力
   - Screenshots を 5 枚アップロード（`assets/screenshots/` から）

3. **App Information** で:
   - Age Rating を設定（4+）
   - Copyright を入力

### ステップ 3: Manus でビルド実行（1～2 時間）

1. https://app.manus.im にログイン
2. **OVR VBT Coach** プロジェクトを選択
3. **Publish** → **Build for iOS** をクリック
4. ビルド設定:
   - **Deployment Target**: TestFlight
   - **Build Type**: Release
5. **Start Build** をクリック
6. ビルド進捗を監視（30～60 分）
7. ビルド完了メール受信

### ステップ 4: TestFlight でテスター招待（10 分）

1. App Store Connect で新しいビルドを確認
2. **TestFlight** タブを開く
3. **Internal Testers** グループを作成
4. テスターのメールアドレスを追加
5. ビルドを Internal Testers に追加
6. テスター招待メール送信

### ステップ 5: テスト実施（2～5 日）

テスターが以下をテスト:

| 機能 | テスト内容 |
|------|-----------|
| **起動** | アプリが正常に起動 |
| **BLE** | Velocity センサーに接続可能 |
| **セッション** | セッション記録が動作 |
| **PR** | PR 検知と通知が表示 |
| **データ** | 本日のボリューム、Velocity Loss が正しく表示 |

## ファイル構成

```
ovr-vbt-coach-app/
├── app.config.ts                          # Expo 設定（Bundle ID、権限）
├── package.json                           # 依存関係
├── APP_STORE_METADATA.md                  # App Store メタデータ
├── APP_STORE_CONNECT_SETUP.md             # 詳細セットアップガイド
├── MANUS_BUILD_GUIDE.md                   # Manus ビルド手順
├── DEPLOYMENT_SUMMARY.md                  # 完全デプロイメントフロー
├── TESTFLIGHT_DEPLOYMENT.md               # TestFlight デプロイ手順
├── IOS_BUILD_CHECKLIST.md                 # iOS ビルドチェックリスト
├── QUICK_START.md                         # このファイル
├── assets/
│   ├── images/
│   │   ├── icon.png                       # メインアイコン (1024×1024px)
│   │   ├── splash-icon.png                # スプラッシュスクリーン (200×200px)
│   │   ├── favicon.png                    # ファビコン (32×32px)
│   │   ├── android-icon-foreground.png    # Android アダプティブ (foreground)
│   │   ├── android-icon-background.png    # Android アダプティブ (background)
│   │   └── android-icon-monochrome.png    # Android アダプティブ (monochrome)
│   └── screenshots/
│       ├── screenshot-1-home.png          # ホーム画面
│       ├── screenshot-2-ble.png           # BLE 接続
│       ├── screenshot-3-monitoring.png    # リアルタイム監視
│       ├── screenshot-4-pr.png            # PR 通知
│       └── screenshot-5-summary.png       # セッション要約
├── scripts/
│   └── app-store-connect-checklist.sh     # チェックリストスクリプト
└── todo.md                                # プロジェクトタスク管理
```

## トラブルシューティング

### ビルド失敗時

**症状**: Manus ビルドが失敗

**対応**:
1. Management UI の Build Logs を確認
2. エラーメッセージを記録
3. https://help.manus.im でサポート受ける

### TestFlight アップロード失敗時

**症状**: IPA が App Store Connect にアップロードされない

**対応**:
1. App Store Connect でビルド表示を確認
2. ビルドステータスを確認（Processing → Ready to Test）
3. Manus ビルドログでエラー確認

### テスター招待が送信されない

**症状**: テスターがメール受け取らない

**対応**:
1. メールアドレスが正しいか確認
2. テスターが Apple ID を持っているか確認
3. App Store Connect で「Resend Invitation」をクリック

## 重要な日程

| イベント | 予想時間 |
|---------|---------|
| App Store Connect 登録 | 15 分 |
| アプリ情報設定 | 20 分 |
| Manus ビルド実行 | 30～60 分 |
| TestFlight 設定 | 10 分 |
| テスト実施 | 2～5 日 |
| **合計** | **3～6 日** |

## 次のステップ

1. ✅ App Store Connect でアプリ登録
2. ✅ Manus でビルド実行
3. ✅ TestFlight でテスト実施
4. ⬜ バグ修正と新ビルド提出（必要に応じて）
5. ⬜ App Store にリリース（オプション）

## サポート

問題が発生した場合:

- **Manus**: https://help.manus.im
- **Apple**: https://developer.apple.com/support/
- **Expo**: https://forums.expo.dev/

---

**プロジェクト**: OVR VBT Coach v2.3.0
**チェックポイント**: fdd12912
**最終更新**: 2026 年 1 月 25 日
