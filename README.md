# RepVelo VBT Coach - iOS モバイルアプリ

**Velocity-Based Training (VBT) アプリケーション with AI Coaching**

RepVelo Velocity センサーと連携し、リアルタイムで速度・パワーを計測。AIが1RM推定、PR検知、トレーニング調整を自動で行う完全自動VBTコーチアプリ。

![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)
![Expo](https://img.shields.io/badge/Expo-54.0-000020.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

---

## ✨ 主要機能

### VBT モード（BLE センサー）
- 🔗 RepVelo Velocity センサーとの BLE 接続
- ⚡ Mean Velocity / Peak Velocity / ROM のリアルタイム表示
- 📉 Velocity Loss 自動計算とアラート
- 🎯 1RM 推定（Load-Velocity Profile）

### ノンVBT モード（手動入力）
- ✏️ 重量 / レップ / RPE の手動入力
- 📊 VBT データと手動データの混在管理

### 特殊セット対応
- 💪 **AMRAP**: 限界まで追い込み（V-Loss アラート無効）
- 🔻 **ドロップセット**: 自動で次の重量を提案（-20%）
- 🔄 **スーパーセット**: A/B 種目の自動切り替え

### AI コーチング
- 🤖 過去の LVP と今日の調子から推奨重量を計算
- 🏆 PR（自己ベスト）自動検知と通知
- 📈 週次ボリューム比較とアドバイス

---

## 🚀 インストール

### 必要な環境
- Node.js 18+
- pnpm 9.12.0+
- iOS: macOS with Xcode（ローカルビルド時）
- **推奨**: Manus AI でのクラウドビルド

### セットアップ

```bash
# リポジトリをクローン
git clone https://github.com/autecouture-art/ovr-vbt-coach.git
cd ovr-vbt-coach

# 依存関係をインストール
pnpm install

# 型チェック
pnpm check

# Lint チェック
pnpm lint
```

### 開発環境での実行

```bash
# 開発サーバーを起動
pnpm dev

# iOS シミュレーターで実行
pnpm ios

# Android エミュレーターで実行
pnpm android

# Web ブラウザで実行
pnpm web
```

---

## 📦 テクノロジースタック

- **フレームワーク**: React Native 0.81 + Expo 54
- **言語**: TypeScript 5.9
- **状態管理**: Zustand
- **ナビゲーション**: React Navigation
- **BLE**: react-native-ble-plx
- **データベース**: expo-sqlite
- **グラフ**: react-native-chart-kit, victory-native
- **スタイリング**: NativeWind (Tailwind CSS)

---

## 🏗️ プロジェクト構造

```
ovr-vbt-coach-app/
├── app/                    # Expo Router アプリケーション
│   ├── _layout.tsx        # ルートレイアウト
│   ├── (tabs)/            # タブナビゲーション
│   └── oauth/             # OAuth コールバック
├── src/
│   ├── components/        # 再利用可能な UI コンポーネント
│   ├── screens/           # アプリスクリーン
│   │   ├── HomeScreen.tsx
│   │   ├── MonitorScreen.tsx
│   │   ├── ManualEntryScreen.tsx
│   │   ├── LVPScreen.tsx
│   │   ├── HistoryScreen.tsx
│   │   └── SettingsScreen.tsx
│   ├── services/          # ビジネスロジック
│   │   ├── BLEService.ts       # BLE 通信
│   │   └── DatabaseService.ts  # SQLite データベース
│   ├── store/             # Zustand ストア
│   │   └── trainingStore.ts
│   ├── types/             # TypeScript 型定義
│   ├── utils/             # ユーティリティ関数
│   │   └── VBTCalculations.ts  # VBT ロジック
│   └── hooks/             # カスタムフック
├── assets/                # アプリアセット
│   └── images/
├── app.config.ts          # Expo 設定
├── package.json           # 依存関係
├── tsconfig.json          # TypeScript 設定
├── tailwind.config.js     # Tailwind 設定
├── design.md              # アプリ設計ドキュメント
├── todo.md                # タスク管理
├── TESTFLIGHT_DEPLOYMENT.md  # TestFlight デプロイガイド
└── IOS_BUILD_CHECKLIST.md    # iOS ビルドチェックリスト
```

---

## 📖 ドキュメント

- **[design.md](./design.md)** - アプリ設計とスクリーン構成
- **[todo.md](./todo.md)** - 実装予定機能と進捗管理
- **[TESTFLIGHT_DEPLOYMENT.md](./TESTFLIGHT_DEPLOYMENT.md)** - TestFlight デプロイ手順
- **[IOS_BUILD_CHECKLIST.md](./IOS_BUILD_CHECKLIST.md)** - iOS ビルド準備チェックリスト

---

## 🎯 TestFlight デプロイ

### クイックスタート

```bash
# 1. 依存関係をインストール
pnpm install

# 2. 型チェック
pnpm check

# 3. Lint チェック
pnpm lint

# 4. Manus UI でビルド開始
# https://app.manus.im にログイン
# → "Build for iOS" を選択
# → "Deploy to TestFlight" を有効化
# → "Start Build" をクリック
```

### 詳細な手順

詳しくは [TESTFLIGHT_DEPLOYMENT.md](./TESTFLIGHT_DEPLOYMENT.md) を参照してください。

### ビルド設定

| 項目 | 値 |
|------|-----|
| **App Name** | RepVelo VBT Coach |
| **Version** | 2.3.0 |
| **Build Number** | 1 |
| **Bundle ID** | space.manus.ovr.vbt.coach.app.t20260125053732 |
| **Deployment Target** | iOS 13.0+ |

---

## 🔧 開発ガイド

### 新しいスクリーンを追加

```tsx
// src/screens/NewScreen.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { ScreenContainer } from '@/components/screen-container';

export default function NewScreen() {
  return (
    <ScreenContainer className="p-4">
      <Text className="text-2xl font-bold text-foreground">
        New Screen
      </Text>
    </ScreenContainer>
  );
}
```

### Zustand ストアを使用

```tsx
import { useTrainingStore } from '@/src/store/trainingStore';

export function MyComponent() {
  const session = useTrainingStore((state) => state.currentSession);
  const startSession = useTrainingStore((state) => state.startSession);

  return (
    <View>
      {/* コンポーネント */}
    </View>
  );
}
```

### BLE デバイスに接続

```tsx
import BLEService from '@/src/services/BLEService';

// BLE サービスを初期化
await BLEService.initialize();

// デバイスをスキャン
await BLEService.scanForDevices();

// デバイスに接続
await BLEService.connectToDevice(deviceId);

// 通知を開始
await BLEService.startNotifications();
```

---

## 🧪 テスト

```bash
# ユニットテストを実行
pnpm test

# テストをウォッチモードで実行
pnpm test:watch

# カバレッジレポートを生成
pnpm test:coverage
```

---

## 🐛 トラブルシューティング

### BLE 接続エラー

```
エラー: "Bluetooth is not powered on"
→ iOS 設定で Bluetooth を有効にしてください
```

### ビルドエラー

```bash
# 依存関係をクリーンインストール
rm -rf node_modules pnpm-lock.yaml
pnpm install

# キャッシュをクリア
pnpm dev -- --clear
```

### TypeScript エラー

```bash
# 型チェックを実行
pnpm check

# 型定義を再生成
pnpm check --noEmit
```

---

## 📄 ライセンス

MIT License

---

## 🙏 謝辞

- RepVelo Velocity デバイスの BLE プロトコル
- Expo フレームワーク
- React Native コミュニティ

---

## 📞 サポート

問題が発生した場合:

1. **Manus Help Center**: https://help.manus.im
2. **Expo Forums**: https://forums.expo.dev
3. **GitHub Issues**: https://github.com/autecouture-art/ovr-vbt-coach/issues

---

**Happy Training! 🏋️‍♂️**
