#!/bin/bash

# OVR VBT Coach - TestFlight テスター招待スクリプト
# このスクリプトは TestFlight テスター招待の手順をガイドします

set -e

echo "=========================================="
echo "OVR VBT Coach - TestFlight テスター招待ガイド"
echo "=========================================="
echo ""

# アプリ情報
APP_NAME="OVR VBT Coach"
VERSION="2.3.0"
BUILD_NUMBER="1"

echo "【アプリ情報】"
echo "アプリ名: $APP_NAME"
echo "バージョン: $VERSION"
echo "ビルド番号: $BUILD_NUMBER"
echo ""

# 前提条件確認
echo "【前提条件確認】"
echo ""
echo "以下が完了していることを確認してください:"
echo ""
echo "- [ ] App Store Connect でアプリが登録済み"
echo "- [ ] Manus ビルドが完了"
echo "- [ ] App Store Connect でビルドが表示される"
echo "- [ ] ビルドステータス: Ready to Test"
echo ""

# テスター招待手順
echo "【TestFlight テスター招待手順】"
echo ""

echo "ステップ 1: Internal Testers グループ作成"
echo "  1. App Store Connect にログイン"
echo "  2. OVR VBT Coach を選択"
echo "  3. TestFlight タブをクリック"
echo "  4. Internal Testers セクションで + をクリック"
echo "  5. Group Name: 'Core Team' を入力"
echo "  6. Create をクリック"
echo ""

echo "ステップ 2: テスター追加"
echo "  1. Internal Testers → Core Team をクリック"
echo "  2. Add Testers をクリック"
echo "  3. テスターのメールアドレスを入力"
echo "  4. Add をクリック"
echo ""
echo "  テスター例:"
echo "    - tester1@example.com"
echo "    - tester2@example.com"
echo "    - tester3@example.com"
echo ""

echo "ステップ 3: ビルドをテスターグループに追加"
echo "  1. TestFlight → Builds をクリック"
echo "  2. 最新のビルド（$VERSION Build $BUILD_NUMBER）をクリック"
echo "  3. Add Build をクリック"
echo "  4. Internal Testers → Core Team を選択"
echo "  5. Save をクリック"
echo ""

echo "ステップ 4: テスター指示送信"
echo "  以下のテンプレートをテスターに送信:"
echo ""
cat << 'EOF'
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
EOF
echo ""

# テスター監視
echo "=========================================="
echo "テスター監視"
echo "=========================================="
echo ""
echo "App Store Connect で以下を監視してください:"
echo ""
echo "| ステータス | 説明 |"
echo "|-----------|------|"
echo "| Invited | 招待メール送信済み、未応答 |"
echo "| Installed | アプリをインストール |"
echo "| Launched | アプリを起動 |"
echo "| Active | 定期的に使用中 |"
echo ""

# テスト項目
echo "=========================================="
echo "テスト項目"
echo "=========================================="
echo ""
echo "テスターが以下をテストしてください:"
echo ""
echo "- [ ] アプリが正常に起動するか"
echo "- [ ] ホーム画面が表示されるか"
echo "- [ ] BLE 接続画面が表示されるか"
echo "- [ ] OVR Velocity センサーが検出されるか"
echo "- [ ] ペアリングが成功するか"
echo "- [ ] セッション記録画面が表示されるか"
echo "- [ ] リアルタイムデータが表示されるか"
echo "- [ ] PR 通知が表示されるか"
echo "- [ ] 本日のボリューム合計が表示されるか"
echo "- [ ] Velocity Loss が正しく計算されているか"
echo ""

# フィードバック確認
echo "=========================================="
echo "フィードバック確認"
echo "=========================================="
echo ""
echo "テスト期間中、以下を監視してください:"
echo ""
echo "1. App Store Connect で Testers セクションを確認"
echo "2. TestFlight → Feedback をクリック"
echo "3. テスターからのフィードバックを確認"
echo "4. バグレポートを分類"
echo ""

# 次のステップ
echo "=========================================="
echo "次のステップ"
echo "=========================================="
echo ""
echo "テスト期間: 2～5 日"
echo ""
echo "テスト完了後:"
echo "  1. バグ修正"
echo "  2. 新しいビルド提出"
echo "  3. App Store リリース準備"
echo ""
