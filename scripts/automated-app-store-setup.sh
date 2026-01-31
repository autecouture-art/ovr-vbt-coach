#!/bin/bash

# OVR VBT Coach - App Store Connect 自動セットアップスクリプト
# このスクリプトは App Store Connect での登録を支援するチェックリストを生成します

set -e

echo "=========================================="
echo "OVR VBT Coach - App Store Connect セットアップ"
echo "=========================================="
echo ""

# アプリ情報
APP_NAME="OVR VBT Coach"
BUNDLE_ID="space.manus.ovr.vbt.coach.app.t20260125053732"
SKU="ovr-vbt-coach-001"
VERSION="2.3.0"
BUILD_NUMBER="1"

echo "【アプリ情報】"
echo "アプリ名: $APP_NAME"
echo "Bundle ID: $BUNDLE_ID"
echo "SKU: $SKU"
echo "バージョン: $VERSION"
echo "ビルド番号: $BUILD_NUMBER"
echo ""

# ファイルチェック
echo "【ファイルチェック】"

check_file() {
    if [ -f "$1" ]; then
        echo "✓ $1"
        return 0
    else
        echo "✗ $1 (見つかりません)"
        return 1
    fi
}

MISSING_FILES=0

check_file "assets/images/icon.png" || MISSING_FILES=$((MISSING_FILES + 1))
check_file "assets/screenshots/screenshot-1-home.png" || MISSING_FILES=$((MISSING_FILES + 1))
check_file "assets/screenshots/screenshot-2-ble.png" || MISSING_FILES=$((MISSING_FILES + 1))
check_file "assets/screenshots/screenshot-3-monitoring.png" || MISSING_FILES=$((MISSING_FILES + 1))
check_file "assets/screenshots/screenshot-4-pr.png" || MISSING_FILES=$((MISSING_FILES + 1))
check_file "assets/screenshots/screenshot-5-summary.png" || MISSING_FILES=$((MISSING_FILES + 1))
check_file "APP_STORE_METADATA.md" || MISSING_FILES=$((MISSING_FILES + 1))

echo ""

if [ $MISSING_FILES -gt 0 ]; then
    echo "⚠️  $MISSING_FILES 個のファイルが見つかりません"
    exit 1
fi

echo "✓ すべてのファイルが揃っています"
echo ""

# App Store メタデータ抽出
echo "【App Store メタデータ】"
echo ""

if [ -f "APP_STORE_METADATA.md" ]; then
    echo "=== アプリ説明 ==="
    grep -A 10 "## Description" APP_STORE_METADATA.md | head -15
    echo ""
    
    echo "=== キーワード ==="
    grep -A 5 "## Keywords" APP_STORE_METADATA.md | head -10
    echo ""
fi

# チェックリスト生成
echo "【App Store Connect 登録チェックリスト】"
echo ""
echo "以下の手順に従い、App Store Connect でアプリを登録してください:"
echo ""
echo "1. App Store Connect にログイン"
echo "   https://appstoreconnect.apple.com"
echo ""
echo "2. 新しいアプリを作成"
echo "   - Platform: iOS"
echo "   - Name: $APP_NAME"
echo "   - Bundle ID: $BUNDLE_ID"
echo "   - SKU: $SKU"
echo ""
echo "3. App Information タブで以下を入力"
echo "   - App Name: $APP_NAME"
echo "   - Subtitle: Real-Time Velocity Training Analytics"
echo "   - Category: Health & Fitness"
echo ""
echo "4. App Store タブで以下を入力"
echo "   - Description: APP_STORE_METADATA.md から"
echo "   - Keywords: APP_STORE_METADATA.md から"
echo ""
echo "5. スクリーンショットをアップロード"
echo "   - iPhone 6.7-inch: 5 枚"
echo ""
echo "6. Pricing and Availability"
echo "   - Price Tier: Free"
echo "   - Availability: All countries"
echo ""
echo "7. 年齢レーティング"
echo "   - Age Rating: 4+"
echo ""

# 登録確認
echo "=========================================="
echo "登録完了確認"
echo "=========================================="
echo ""
echo "以下が完了したら、Manus ビルドを開始してください:"
echo ""
echo "- [ ] App Store Connect でアプリが表示される"
echo "- [ ] Bundle ID: $BUNDLE_ID"
echo "- [ ] ステータス: Ready to Submit"
echo ""
echo "次のステップ: Manus ビルド実行"
echo "  $ bash scripts/automated-manus-build.sh"
echo ""
