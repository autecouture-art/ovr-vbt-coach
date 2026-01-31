# App Store Connect 登録準備スクリプト

このドキュメントは、App Store Connect でのアプリ登録を効率化するための準備チェックリストです。

## ステップ 1: 事前準備（ローカル）

### 1.1 必要な情報を確認

```bash
# プロジェクト情報を確認
cat << 'EOF'
=== OVR VBT Coach - App Store Connect 登録情報 ===

アプリ名: OVR VBT Coach
Bundle ID: space.manus.ovr.vbt.coach.app.t20260125053732
SKU: ovr-vbt-coach-001
バージョン: 2.3.0
ビルド番号: 1

カテゴリ: Health & Fitness
サブカテゴリ: Fitness
年齢レーティング: 4+

プライバシーポリシー URL: https://www.ovrvelocity.com/privacy
サポート URL: https://www.ovrvelocity.com/support
サポートメール: support@ovrvelocity.com

著作権: © 2026 OVR Velocity. All rights reserved.
EOF
```

### 1.2 アセット確認

```bash
# すべてのアセットが配置されているか確認
echo "=== アセット確認 ==="
ls -lh assets/images/icon.png
ls -lh assets/images/splash-icon.png
ls -lh assets/images/favicon.png
ls -lh assets/images/android-icon-*.png
ls -lh assets/screenshots/screenshot-*.png

# スクリーンショット数確認
echo "スクリーンショット数: $(ls assets/screenshots/screenshot-*.png | wc -l)"
```

### 1.3 ドキュメント確認

```bash
# すべてのドキュメントが完成しているか確認
echo "=== ドキュメント確認 ==="
test -f APP_STORE_METADATA.md && echo "✓ APP_STORE_METADATA.md" || echo "✗ APP_STORE_METADATA.md"
test -f QUICK_START.md && echo "✓ QUICK_START.md" || echo "✗ QUICK_START.md"
test -f MANUS_BUILD_GUIDE.md && echo "✓ MANUS_BUILD_GUIDE.md" || echo "✗ MANUS_BUILD_GUIDE.md"
test -f DEPLOYMENT_SUMMARY.md && echo "✓ DEPLOYMENT_SUMMARY.md" || echo "✗ DEPLOYMENT_SUMMARY.md"
test -f app.config.ts && echo "✓ app.config.ts" || echo "✗ app.config.ts"
```

## ステップ 2: App Store Connect 登録（Web ブラウザ）

### 2.1 App Store Connect へのログイン

1. https://appstoreconnect.apple.com にアクセス
2. Apple ID でログイン
3. **My Apps** をクリック

### 2.2 新しいアプリ作成

1. **+** ボタンをクリック
2. **New App** を選択
3. 以下を入力:
   - **Platform**: iOS
   - **Name**: OVR VBT Coach
   - **Primary Language**: English
   - **Bundle ID**: space.manus.ovr.vbt.coach.app.t20260125053732
   - **SKU**: ovr-vbt-coach-001
   - **User Access**: Full Access
4. **Create** をクリック

### 2.3 App Information タブ

1. **App Information** タブをクリック
2. 以下を入力:
   - **App Name**: OVR VBT Coach
   - **Subtitle**: Real-Time Velocity Training Analytics
   - **Category**: Health & Fitness
   - **Privacy Policy URL**: https://www.ovrvelocity.com/privacy
   - **Support URL**: https://www.ovrvelocity.com/support
   - **Support Email**: support@ovrvelocity.com

### 2.4 App Store タブ

1. **App Store** タブをクリック
2. **Description** に以下をコピー:

```
OVR VBT Coach is a revolutionary velocity-based training (VBT) analytics platform that empowers athletes and coaches to optimize workout performance through real-time Bluetooth-connected velocity sensors.

REAL-TIME VELOCITY TRACKING
Connect your OVR Velocity sensors via Bluetooth to track bar velocity in real-time during every rep. Get instant feedback on your performance and identify optimal loading zones.

PERSONAL RECORD DETECTION
Automatically detect and celebrate new personal records (PRs) with instant notifications. Track your progress across all exercises and watch your strength grow.

VELOCITY LOSS MONITORING
Monitor velocity loss during your sets to gauge fatigue and optimize recovery. Adjust your training intensity based on real-time performance data.

SESSION ANALYTICS
Review detailed session summaries including total volume, average velocity, and velocity loss trends. Analyze your training data to make informed decisions about your program.

DARK MODE OPTIMIZED
Designed for the gym environment with a dark theme that's easy on the eyes and battery-friendly.

KEY FEATURES:
• Real-time velocity tracking via Bluetooth
• Automatic PR detection and notifications
• Velocity loss calculation for fatigue monitoring
• Comprehensive session analytics
• Dark mode interface
• Offline data storage
• Historical performance tracking

Perfect for:
• Strength athletes
• Powerlifters
• CrossFit athletes
• Personal trainers
• Fitness coaches
• Sports performance specialists

Start optimizing your training today with OVR VBT Coach!
```

3. **Keywords** に以下をコピー:

```
fitness, training, velocity, VBT, workout, analytics, Bluetooth, personal trainer, strength training, powerlifting, CrossFit, performance tracking, sports science, coaching
```

### 2.5 スクリーンショット アップロード

1. **Screenshots** セクションで各デバイスサイズ用にアップロード:
   - iPhone 6.7-inch: 5 枚
   - iPhone 5.5-inch: 5 枚（オプション）
   - iPhone 4.7-inch: 5 枚（オプション）

2. アップロード対象:
   - `assets/screenshots/screenshot-1-home.png`
   - `assets/screenshots/screenshot-2-ble.png`
   - `assets/screenshots/screenshot-3-monitoring.png`
   - `assets/screenshots/screenshot-4-pr.png`
   - `assets/screenshots/screenshot-5-summary.png`

### 2.6 App Preview（オプション）

1. **App Preview** セクションで 30 秒以下のビデオをアップロード
2. 内容: アプリ起動 → ホーム画面 → BLE 接続 → セッション記録 → PR 通知

### 2.7 App Information（続き）

1. **App Information** タブで:
   - **Age Rating**: 4+
   - **Copyright**: © 2026 OVR Velocity. All rights reserved.

2. **Pricing and Availability**:
   - **Price Tier**: Free
   - **Availability**: All countries

## ステップ 3: TestFlight 設定（Web ブラウザ）

### 3.1 Internal Testers グループ作成

1. **TestFlight** タブをクリック
2. **Internal Testers** セクションで **+** をクリック
3. **Group Name**: Core Team
4. **Add Testers** をクリック
5. テスターのメールアドレスを入力:
   - 例: tester1@example.com
   - 例: tester2@example.com
6. **Save** をクリック

### 3.2 External Testers グループ作成（オプション）

1. **External Testers** セクションで **+** をクリック
2. **Group Name**: Beta Testers
3. テスターを追加（最大 10,000 人）
4. **Save** をクリック

## ステップ 4: Manus ビルド実行

### 4.1 Manus UI へのアクセス

```bash
echo "Manus UI: https://app.manus.im"
echo "プロジェクト: OVR VBT Coach"
```

### 4.2 ビルド開始

1. https://app.manus.im にログイン
2. **OVR VBT Coach** プロジェクトを選択
3. Management UI で **Publish** ボタンをクリック
4. **Build for iOS** を選択
5. ビルド設定:
   - **Deployment Target**: TestFlight
   - **Build Type**: Release
6. **Start Build** をクリック

### 4.3 ビルド監視

```bash
# ビルド進捗を監視（30～60 分）
echo "ビルド進捗を Management UI で確認"
echo "Build Logs セクションでリアルタイムログを表示"
```

### 4.4 ビルド完了

- ビルド完了メール受信
- IPA ファイルが自動的に App Store Connect にアップロード
- App Store Connect の **TestFlight** → **Builds** で新しいビルドを確認

## ステップ 5: TestFlight でビルド追加

### 5.1 ビルド確認

1. App Store Connect にログイン
2. **OVR VBT Coach** を選択
3. **TestFlight** → **Builds** をクリック
4. 新しいビルドが表示されることを確認

### 5.2 Internal Testers にビルド追加

1. **Internal Testers** グループを選択
2. **Add Build** をクリック
3. ビルドを選択
4. **Save** をクリック

### 5.3 テスター招待メール送信

- テスターが自動的に招待メールを受け取ります
- メール内のリンクをクリックして TestFlight アプリをダウンロード

## ステップ 6: テスター指示

テスターに以下を指示:

1. TestFlight アプリをダウンロード
2. 招待メール内のリンクをクリック
3. OVR VBT Coach をインストール
4. 以下をテスト:
   - アプリ起動
   - BLE 接続（OVR Velocity センサーへ）
   - セッション記録
   - PR 検知と通知
   - データ表示（本日のボリューム、Velocity Loss）
5. バグを発見した場合、TestFlight アプリ内の「Send Feedback」で報告

## トラブルシューティング

### ビルドが表示されない

1. Manus ビルドログを確認
2. エラーメッセージを記録
3. https://help.manus.im でサポート受ける

### テスター招待が送信されない

1. メールアドレスが正しいか確認
2. テスターが Apple ID を持っているか確認
3. App Store Connect で「Resend Invitation」をクリック

### App Store Connect でエラー

1. Bundle ID が正しいか確認
2. 必要なメタデータがすべて入力されているか確認
3. スクリーンショットのサイズが正しいか確認（1242×2208px for 6.7-inch）

## 次のステップ

1. ✅ App Store Connect でアプリ登録
2. ✅ Manus でビルド実行
3. ✅ TestFlight でテスター招待
4. ⬜ テスト実施（2～5 日）
5. ⬜ バグ修正と新ビルド提出
6. ⬜ App Store にリリース

---

**参考リンク**:
- App Store Connect: https://appstoreconnect.apple.com
- Manus: https://app.manus.im
- TestFlight: https://developer.apple.com/testflight/
