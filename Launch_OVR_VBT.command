#!/bin/bash

# スクリプトのあるディレクトリに移動
cd "$(dirname "$0")"

# 仮想環境のパス（ユーザーのホームディレクトリ配下）
VENV_PATH="$HOME/venv_ovr"

# 仮想環境が存在するか確認
if [ -d "$VENV_PATH" ]; then
    echo "仮想環境をアクティベートします..."
    source "$VENV_PATH/bin/activate"
else
    echo "エラー: 仮想環境が見つかりません ($VENV_PATH)"
    echo "セットアップ手順に従って仮想環境を作成してください。"
    read -p "キーを押して終了..."
    exit 1
fi

# アプリケーション起動
echo "OVR VBT Coach を起動中..."
python vbt_app.py

# アプリ終了後に画面を閉じない（エラー確認用）
echo "アプリケーションが終了しました。"
read -p "キーを押して閉じる..."






