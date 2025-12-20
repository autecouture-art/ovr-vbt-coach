# OVR VBT Coach - 開発者ガイド 🔧

> **最終更新**: 2025-12-20  
> **バージョン**: v2.3 Final

---

## 📋 目次

1. [プロジェクト概要](#プロジェクト概要)
2. [アーキテクチャ](#アーキテクチャ)
3. [プロジェクト構造](#プロジェクト構造)
4. [モジュール詳細](#モジュール詳細)
5. [データフロー](#データフロー)
6. [開発ワークフロー](#開発ワークフロー)
7. [トラブルシューティング](#トラブルシューティング)
8. [今後の改善提案](#今後の改善提案)

---

## プロジェクト概要

**OVR VBT Coach**は、Velocity-Based Training (VBT)とAIコーチングを組み合わせた、トレーニング管理アプリケーションです。

### 主な機能
- 🔗 BLE経由でOVR Velocityセンサーと通信
- 📊 リアルタイムの速度・パワー表示
- 🤖 AI による1RM推定、重量提案、トレーニング調整
- 📈 Load-Velocity Profile (LVP) グラフ
- 🏆 PR（自己ベスト）自動検出と通知
- 📅 カレンダービューでトレーニング履歴閲覧
- 🎤 音声入力対応
- 💪 特殊セット（AMRAP/Drop Set/Superset）サポート

### 技術スタック
- **GUI**: CustomTkinter (Dark mode)
- **BLE通信**: bleak
- **データベース**: SQLite3
- **グラフ**: matplotlib
- **音声**: pyttsx3 (TTS), SpeechRecognition (STT)
- **画像処理**: opencv-python

---

## アーキテクチャ

### システム構成図

```
┌─────────────────────────────────────────────────────────────┐
│                     VBT App (GUI Layer)                     │
│                    vbt_app.py (1064行)                      │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │ VBTApp       │  │ SessionSetup │  │ ManualEntry     │  │
│  │ (Main Window)│  │ Dialog       │  │ Dialog          │  │
│  └──────────────┘  └──────────────┘  └─────────────────┘  │
│         │                 │                   │            │
└─────────┼─────────────────┼───────────────────┼────────────┘
          │                 │                   │
          ▼                 ▼                   ▼
┌─────────────────────────────────────────────────────────────┐
│                   Core Logic Layer                          │
│                  vbt_core.py (752行)                        │
│                                                             │
│  ┌──────────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ TrainingDatabase │  │ AICoach      │  │ AudioCoach   │ │
│  └──────────────────┘  └──────────────┘  └──────────────┘ │
│  ┌──────────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ OneRMCalculator  │  │ VelocityLoss │  │ PRManager    │ │
│  │                  │  │ Manager      │  │              │ │
│  └──────────────────┘  └──────────────┘  └──────────────┘ │
└─────────┬───────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────┐
│                  Data/Communication Layer                    │
│                                                             │
│  ┌──────────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ SQLite Database  │  │ BLE Client   │  │ Data Parser  │ │
│  │ (training_v2.db) │  │ ble_client.py│  │ parser.py    │ │
│  └──────────────────┘  └──────────────┘  └──────────────┘ │
│         │                     │                   │        │
└─────────┼─────────────────────┼───────────────────┼────────┘
          │                     │                   │
          ▼                     ▼                   ▼
   [File System]      [OVR Velocity Device]  [VelocityData]
```

### レイヤー分離

| レイヤー | 責任 | 主要ファイル |
|---------|------|-------------|
| **Presentation** | UI、ユーザー入力、画面表示 | `vbt_app.py` |
| **Business Logic** | トレーニングロジック、AI判定、計算 | `vbt_core.py` |
| **Data Access** | DB操作、BLE通信、データ解析 | `vbt_db_schema.py`, `ble_client.py`, `parser.py` |

---

## プロジェクト構造

```
OVR/
├── 📱 GUI層
│   └── vbt_app.py              # メインGUIアプリケーション (1064行)
│
├── 🧠 ビジネスロジック層
│   └── vbt_core.py             # コアロジック (752行)
│
├── 🔌 データ/通信層
│   ├── ble_client.py           # BLE通信クライアント (347行)
│   ├── parser.py               # データパーサー (171行)
│   └── vbt_db_schema.py        # DBスキーマ定義 (125行)
│
├── 🎥 拡張機能
│   ├── vision_vbt.py           # Vision-VBT (カメラベース速度推定)
│   └── excel_reader.py         # Excelデータインポート
│
├── 🗄️ データベース
│   ├── training_v2.db          # メインDB (SQLite)
│   └── training_data.db        # 旧バージョン
│
├── 📄 ドキュメント
│   ├── README.md               # プロジェクト概要
│   ├── PROJECT_SPEC.md         # 完全仕様書
│   ├── IMPLEMENTATION_STATUS.md # 実装状況
│   ├── UI_WIREFRAME.md         # UIワイヤーフレーム
│   ├── AI_consultation_memo.md # AI相談メモ
│   └── project_memory.md       # プロジェクト記憶
│
├── 🧪 テンプスクリプト (temp)
│   ├── (temp)_*.py             # 一時的な分析/検証スクリプト
│
├── 🎬 実行スクリプト
│   ├── Launch_OVR_VBT.command  # macOS起動スクリプト
│   └── ble_main.py             # BLEスタンドアロン実行
│
├── ⚙️ 設定
│   ├── requirements.txt        # Python依存関係
│   └── .gitignore              # Git除外設定
│
└── 📂 データディレクトリ
    ├── logs/                   # BLEログ
    └── image/                  # 画像/スクリーンショット
```

---

## モジュール詳細

### GUI層 (vbt_app.py)

主要クラス:
- `VBTApp` - メインウィンドウ (5タブ)
- `SessionSetupDialog` - セッション開始設定
- `ManualEntryDialog` - 手動入力
- `CalendarWidget` - カレンダービュー
- `VoiceInputManager` - 音声認識

### ビジネスロジック層 (vbt_core.py)

主要クラス:
- `TrainingDatabase` - DB管理
- `OneRMCalculator` - 1RM推定
- `VelocityLossManager` - V-Loss計算
- `PersonalRecordManager` - PR検出
- `AICoach` - 重量推奨/アドバイス
- `AudioCoach` - 音声フィードバック

### データ/通信層

- `ble_client.py` - BLE通信
- `parser.py` - 16バイトデータ解析
- `vbt_db_schema.py` - 5テーブル定義

---

## 開発ワークフロー

### セットアップ

```bash
# 仮想環境作成
python3 -m venv ~/venv_ovr
source ~/venv_ovr/bin/activate

# 依存関係インストール
pip install -r requirements.txt
pip install "numpy<2"  # matplotlib互換性
pip install "opencv-python<4.9"

# DB初期化
python vbt_db_schema.py

# 起動
python vbt_app.py
```

### デバッグTips

```python
# BLE接続確認
print(f"[DEBUG] Device: {device.name}")

# DB確認
cursor.execute("SELECT * FROM sessions")
print(cursor.fetchall())

# GUI更新強制
self.update_idletasks()
```

---

## トラブルシューティング

### NumPy互換性エラー
```bash
pip install "numpy<2"
```

### BLE接続失敗
- Bluetoothオン/オフ
- デバイスペアリング解除

### Segmentation Fault (macOS)
```python
# 使用禁止
# self.attributes("-topmost", True)

# 代替
self.lift()
self.focus()
```

---

## 今後の改善提案

### 優先度: 高
1. テストコード追加 (`tests/`)
2. 設定ファイル分離 (`config.py`)
3. ログシステム統一 (logging)

### 優先度: 中
4. エラーハンドリング強化
5. データエクスポート (CSV/TrainingPeaks)
6. DBマイグレーション

### 優先度: 低
7. ダークモード切替
8. 多言語対応
9. クラウド同期

---

**Happy Coding! 💪**
