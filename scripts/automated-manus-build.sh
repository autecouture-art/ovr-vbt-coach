#!/bin/bash

# OVR VBT Coach - Manus ビルド実行スクリプト
# このスクリプトは Manus ビルド実行の手順をガイドします

set -e

echo "=========================================="
echo "OVR VBT Coach - Manus ビルド実行ガイド"
echo "=========================================="
echo ""

# プロジェクト情報
PROJECT_NAME="ovr-vbt-coach-app"
APP_NAME="OVR VBT Coach"
BUNDLE_ID="space.manus.ovr.vbt.coach.app.t20260125053732"
VERSION="2.3.0"
BUILD_NUMBER="1"

echo "【プロジェクト情報】"
echo "プロジェクト名: $PROJECT_NAME"
echo "アプリ名: $APP_NAME"
echo "Bundle ID: $BUNDLE_ID"
echo "バージョン: $VERSION"
echo "ビルド番号: $BUILD_NUMBER"
echo ""

# ビルド前チェック
echo "【ビルド前チェック】"
echo ""

check_config() {
    if grep -q "$1" app.config.ts; then
        echo "✓ $1 が設定されています"
        return 0
    else
        echo "✗ $1 が見つかりません"
        return 1
    fi
}

CONFIG_OK=1

check_config "appName" || CONFIG_OK=0
check_config "iosBundleId" || CONFIG_OK=0
check_config "version" || CONFIG_OK=0

echo ""

if [ $CONFIG_OK -eq 0 ]; then
    echo "⚠️  app.config.ts の設定を確認してください"
    exit 1
fi

echo "✓ app.config.ts の設定が完了しています"
echo ""

# Manus ビルド手順
echo "【Manus ビルド実行手順】"
echo ""
echo "1. Manus UI にアクセス"
echo "   https://app.manus.im"
echo ""
echo "2. Manus アカウントでログイン"
echo ""
echo "3. OVR VBT Coach プロジェクトを選択"
echo ""
echo "4. Management UI で以下を確認"
echo "   - Dev Server: Running"
echo "   - Platform: Mobile (Expo)"
echo ""
echo "5. Publish ボタンをクリック"
echo ""
echo "6. Build for iOS を選択"
echo ""
echo "7. ビルド設定を確認"
echo "   - Platform: iOS"
echo "   - Build Type: Release"
echo "   - Deployment Target: TestFlight"
echo "   - App Name: $APP_NAME"
echo "   - Bundle ID: $BUNDLE_ID"
echo "   - Version: $VERSION"
echo "   - Build Number: $BUILD_NUMBER"
echo ""
echo "8. Start Build をクリック"
echo ""

# ビルド監視
echo "【ビルド監視】"
echo ""
echo "ビルドは通常 30～60 分かかります。以下のステージを監視してください:"
echo ""
echo "1. 依存関係チェック（2～3 分）"
echo "   → Dependencies installed"
echo ""
echo "2. TypeScript コンパイル（3～5 分）"
echo "   → TypeScript compiled successfully"
echo ""
echo "3. Expo ビルド準備（2～3 分）"
echo "   → Expo build configured"
echo ""
echo "4. iOS ビルド実行（15～20 分）"
echo "   → iOS build completed"
echo ""
echo "5. IPA ファイル生成（3～5 分）"
echo "   → IPA generated"
echo ""
echo "6. App Store Connect アップロード（3～5 分）"
echo "   → Uploaded to App Store Connect"
echo ""

# ビルド完了確認
echo "=========================================="
echo "ビルド完了確認"
echo "=========================================="
echo ""
echo "以下が完了したら、TestFlight テスター招待を進めてください:"
echo ""
echo "- [ ] Manus からビルド完了メール受信"
echo "- [ ] App Store Connect でビルドが表示される"
echo "- [ ] Build Version: $VERSION"
echo "- [ ] Build Number: $BUILD_NUMBER"
echo "- [ ] Status: Ready to Test"
echo ""
echo "次のステップ: TestFlight テスター招待"
echo "  $ bash scripts/automated-testflight-invitation.sh"
echo ""
