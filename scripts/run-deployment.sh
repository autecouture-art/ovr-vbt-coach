#!/bin/bash

# OVR VBT Coach - デプロイメント実行マスタースクリプト
# このスクリプトは 3 つのステップ（App Store Connect、Manus ビルド、TestFlight）を順序立てて実行します

set -e

echo "=========================================="
echo "OVR VBT Coach - デプロイメント実行"
echo "=========================================="
echo ""

# メニュー表示
show_menu() {
    echo "【実行するステップを選択】"
    echo ""
    echo "1. ステップ 1: App Store Connect 登録"
    echo "2. ステップ 2: Manus ビルド実行"
    echo "3. ステップ 3: TestFlight テスター招待"
    echo "4. すべてのステップを実行"
    echo "5. 終了"
    echo ""
    read -p "選択 (1-5): " choice
}

# ステップ 1: App Store Connect 登録
run_step_1() {
    echo ""
    echo "=========================================="
    echo "ステップ 1: App Store Connect 登録"
    echo "=========================================="
    echo ""
    bash scripts/automated-app-store-setup.sh
    echo ""
    read -p "ステップ 1 が完了しましたか？ (y/n): " confirm
    if [ "$confirm" != "y" ]; then
        echo "ステップ 1 をスキップします"
        return 1
    fi
    return 0
}

# ステップ 2: Manus ビルド実行
run_step_2() {
    echo ""
    echo "=========================================="
    echo "ステップ 2: Manus ビルド実行"
    echo "=========================================="
    echo ""
    bash scripts/automated-manus-build.sh
    echo ""
    read -p "ステップ 2 が完了しましたか？ (y/n): " confirm
    if [ "$confirm" != "y" ]; then
        echo "ステップ 2 をスキップします"
        return 1
    fi
    return 0
}

# ステップ 3: TestFlight テスター招待
run_step_3() {
    echo ""
    echo "=========================================="
    echo "ステップ 3: TestFlight テスター招待"
    echo "=========================================="
    echo ""
    bash scripts/automated-testflight-invitation.sh
    echo ""
    read -p "ステップ 3 が完了しましたか？ (y/n): " confirm
    if [ "$confirm" != "y" ]; then
        echo "ステップ 3 をスキップします"
        return 1
    fi
    return 0
}

# メインループ
while true; do
    show_menu
    
    case $choice in
        1)
            run_step_1
            ;;
        2)
            run_step_2
            ;;
        3)
            run_step_3
            ;;
        4)
            echo ""
            echo "すべてのステップを実行します..."
            echo ""
            
            run_step_1 && {
                run_step_2 && {
                    run_step_3
                }
            }
            
            echo ""
            echo "=========================================="
            echo "デプロイメント完了！"
            echo "=========================================="
            echo ""
            echo "次のステップ:"
            echo "  1. テスターからのフィードバック収集（2～5 日）"
            echo "  2. バグ修正と新ビルド提出"
            echo "  3. App Store リリース準備"
            echo ""
            break
            ;;
        5)
            echo "終了します"
            exit 0
            ;;
        *)
            echo "無効な選択です。もう一度選択してください。"
            ;;
    esac
done
