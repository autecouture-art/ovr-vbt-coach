# OVR VBT Coach 🏋️‍♂️

**Velocity-Based Training (VBT) アプリケーション with AI Coaching**

OVR Velocity センサーと連携し、リアルタイムで速度・パワーを計測。AIが1RM推定、PR検知、トレーニング調整を自動で行う完全自動VBTコーチアプリ。

![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)
![CustomTkinter](https://img.shields.io/badge/GUI-CustomTkinter-green.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

## ✨ Features

### VBT Mode (BLE Sensor)
- 🔗 OVR Velocity センサーとBLE接続
- ⚡ Mean Velocity / Power / ROM のリアルタイム表示
- 📉 Velocity Loss 自動計算 & アラート
- 🎯 1RM 推定（Load-Velocity Profile）

### Non-VBT Mode (Manual Entry)
- ✏️ 重量 / レップ / RPE の手動入力
- 📊 VBTデータと手動データの混在管理

### Special Sets
- 💪 **AMRAP**: 限界まで追い込み（V-Lossアラート無効）
- 🔻 **Drop Set**: 自動で次の重量を提案（-20%）
- 🔄 **Superset**: A/B種目の自動切り替え

### AI Coaching
- 🤖 過去のLVPと今日の調子から推奨重量を計算
- 🏆 PR（自己ベスト）自動検知 & 通知
- 📈 週次ボリューム比較 & アドバイス

### Additional Features
- 📅 **カレンダービュー**: 過去セッションをカレンダー形式で閲覧
- 🎤 **音声入力**: 「次80キロで5レップ」などの音声コマンド
- 📹 **動画記録**: セットの動画を自動保存（将来のVision-VBT用）

## 🖥️ Screenshots

| Monitor | LVP Graph | Calendar |
|---------|-----------|----------|
| 巨大速度表示 + V-Lossバー | 負荷速度プロファイル | 過去セッション閲覧 |

## 🚀 Installation

### Requirements
- Python 3.9+
- macOS (BLE & Audio tested on macOS)

### Setup

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/ovr-vbt-coach.git
cd ovr-vbt-coach

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Run

```bash
python3 vbt_app.py
```

### Run (Web / Browser)

ブラウザで使いたい場合は、Web版を起動します（既存GUI版はそのまま残っています）。

```bash
python3 web_app.py
```

起動後にブラウザで `http://localhost:8000/` を開いてください。

Or use the macOS shortcut:
```bash
./Launch_OVR_VBT.command
```

## 📦 Dependencies

- `bleak` - BLE communication
- `customtkinter` - Modern GUI
- `pyttsx3` - Text-to-speech
- `numpy` - 1RM calculation
- `matplotlib` - LVP graph
- `SpeechRecognition` - Voice input
- `opencv-python` - Video recording

## 🏗️ Project Structure

```
OVR/
├── vbt_app.py           # Main GUI application
├── vbt_core.py          # Core logic (DB, AI, Audio, V-Loss)
├── ble_client.py        # BLE communication
├── parser.py            # BLE data parser
├── vision_vbt.py        # Video recording module
├── vbt_db_schema.py     # Database schema
├── requirements.txt     # Python dependencies
├── PROJECT_SPEC.md      # Full specification
├── IMPLEMENTATION_STATUS.md  # Implementation progress
└── Launch_OVR_VBT.command    # macOS launcher
```

## 📖 Documentation

- [PROJECT_SPEC.md](PROJECT_SPEC.md) - 完全仕様書
- [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) - 実装状況
- [UI_WIREFRAME.md](UI_WIREFRAME.md) - UIワイヤーフレーム

## 🎯 Roadmap

- [x] VBT Mode (BLE)
- [x] Non-VBT Mode (Manual)
- [x] Special Sets (AMRAP/Drop/Superset)
- [x] 1RM Estimation & LVP Graph
- [x] PR Detection & Notification
- [x] Calendar View
- [x] Voice Input
- [x] Video Recording
- [ ] Vision-VBT (Camera-based velocity estimation)
- [ ] Apple Watch Integration

## 📄 License

MIT License

## 🙏 Acknowledgments

- OVR Velocity device for BLE protocol
- CustomTkinter for the beautiful dark mode UI

---

**Happy Training! 🏋️‍♂️**
