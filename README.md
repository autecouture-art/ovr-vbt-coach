# OVR VBT Coach 🏋️‍♂️

**Velocity-Based Training (VBT) アプリケーション with AI Coaching**

OVR Velocity センサーと連携し、リアルタイムで速度・パワーを計測。AIが1RM推定、PR検知、トレーニング調整を自動で行う完全自動VBTコーチアプリ。

![React Native](https://img.shields.io/badge/React_Native-0.74-61DAFB.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)
![Expo](https://img.shields.io/badge/Expo-51.0-000020.svg)
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
- Node.js 18+
- npm or yarn
- iOS: macOS with Xcode (for local builds)
- Android: Android Studio (for local builds)
- **OR use Manus AI for cloud builds (recommended)**

### Setup

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/ovr-vbt-coach.git
cd ovr-vbt-coach

# Install dependencies
npm install
# or
yarn install
```

### Run (Development)

```bash
# Start Expo development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Run in web browser
npm run web
```

### Build for Production with Manus AI

このプロジェクトはManus AI経由でTestFlightまでビルド可能です：

1. Manusアカウントにログイン
2. プロジェクトをインポート
3. "Build for iOS"を選択
4. Manusが自動的にビルド＆TestFlightにアップロード

詳細は[Manus Help Center](https://help.manus.im)を参照してください。

## 📦 Dependencies

- `expo` - React Native development platform
- `react-native-ble-plx` - BLE communication
- `expo-sqlite` - Local database
- `react-navigation` - Navigation
- `victory-native` - Charts and graphs
- `zustand` - State management

## 🏗️ Project Structure

```
ovr-vbt-coach/
├── src/
│   ├── components/      # Reusable UI components
│   ├── screens/         # App screens (Home, Monitor, etc.)
│   │   ├── HomeScreen.tsx
│   │   └── MonitorScreen.tsx
│   ├── services/        # Core services
│   │   ├── BLEService.ts       # BLE communication
│   │   └── DatabaseService.ts  # SQLite database
│   ├── utils/           # Utility functions
│   │   └── VBTCalculations.ts  # VBT logic (1RM, V-Loss)
│   ├── types/           # TypeScript type definitions
│   │   └── index.ts
│   └── navigation/      # Navigation configuration
├── App.tsx              # Main app component
├── index.js             # Entry point
├── app.json             # Expo configuration
├── package.json         # Dependencies
├── tsconfig.json        # TypeScript configuration
├── PROJECT_SPEC.md      # Full specification
└── IMPLEMENTATION_STATUS.md  # Implementation progress
```

## 📖 Documentation

- [PROJECT_SPEC.md](PROJECT_SPEC.md) - 完全仕様書
- [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md) - 実装状況
- [UI_WIREFRAME.md](UI_WIREFRAME.md) - UIワイヤーフレーム

## 🎯 Roadmap

### Phase 1: Core Features (Current)
- [x] React Native project structure
- [x] BLE communication with OVR Velocity
- [x] Real-time velocity monitoring
- [x] Velocity Loss calculation
- [x] SQLite database
- [x] 1RM estimation algorithms
- [x] Basic UI (Home & Monitor screens)

### Phase 2: Advanced Features (Next)
- [ ] LVP Graph visualization
- [ ] PR Detection & Notifications
- [ ] Calendar View
- [ ] Manual entry mode (Non-VBT)
- [ ] Special Sets (AMRAP/Drop/Superset)
- [ ] Settings screen

### Phase 3: AI & Cloud (Future)
- [ ] AI coaching recommendations
- [ ] Cloud sync
- [ ] Social features
- [ ] Vision-VBT (Camera-based velocity)
- [ ] Apple Watch Integration

## 📄 License

MIT License

## 🙏 Acknowledgments

- OVR Velocity device for BLE protocol
- CustomTkinter for the beautiful dark mode UI

---

**Happy Training! 🏋️‍♂️**
