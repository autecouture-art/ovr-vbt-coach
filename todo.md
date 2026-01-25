# OVR VBT Coach - Project TODO

## Phase 1: MVP (Core Functionality)

### Foundation & Setup
- [ ] TypeScript型定義の統合
- [ ] Zustand ストア設定（セッション、BLE、設定）
- [ ] AsyncStorage 永続化設定
- [ ] SQLite データベーススキーマ実装

### Navigation & Layout
- [ ] React Navigation 設定（Tab + Stack）
- [ ] ScreenContainer コンポーネント実装
- [ ] タブバー UI 実装
- [ ] ナビゲーションロジック統合

### Home Screen
- [ ] ホーム画面レイアウト実装
- [ ] セッション開始ボタン実装
- [ ] 本日の累計ボリューム表示
- [ ] 直近PR表示
- [ ] 調子スコア表示（Readiness Assessment）
- [ ] セッション開始ダイアログ（体重・調子入力）

### Monitor Screen (VBT)
- [ ] BLE接続ロジック実装
- [ ] リアルタイム速度表示（Mean / Peak Velocity）
- [ ] Velocity Loss 計算と表示
- [ ] セット / レップ情報表示
- [ ] ROM、Rep Duration 表示
- [ ] BLE接続状態インジケーター
- [ ] セット終了ボタン実装

### Manual Entry Screen
- [ ] 種目選択ピッカー実装
- [ ] 重量入力フィールド
- [ ] レップ数入力フィールド
- [ ] RPE スライダー実装
- [ ] テンポ入力フィールド
- [ ] セット種別選択（Normal / AMRAP / Drop / Superset）
- [ ] メモ入力フィールド
- [ ] セット記録ボタン

### Settings Screen
- [ ] Velocity Loss 閾値設定
- [ ] 音声フィードバック ON/OFF
- [ ] 音声コマンド ON/OFF
- [ ] トレーニングフェーズ選択
- [ ] 単位設定（メートル法 / ヤード・ポンド法）
- [ ] BLE デバイス管理
- [ ] 設定の永続化

### Core Logic
- [ ] 1RM 推定アルゴリズム実装
- [ ] Velocity Loss 計算
- [ ] PR検知ロジック実装
- [ ] セッションデータ保存ロジック
- [ ] セットデータ保存ロジック

### Database
- [ ] SQLite スキーマ作成（Sessions, Sets, Reps, Exercises, LVP, PR）
- [ ] データベース初期化
- [ ] CRUD 操作実装

---

## Phase 2: Core Features

### LVP Graph Screen
- [ ] LVP データ取得ロジック
- [ ] グラフコンポーネント実装（react-native-chart-kit）
- [ ] 種目タブ実装
- [ ] 散布図表示
- [ ] LVP直線表示
- [ ] 速度ゾーン表示
- [ ] 統計情報表示（Vmax, V1RM, R²）

### History & Calendar Screen
- [ ] カレンダーコンポーネント実装
- [ ] セッション詳細表示
- [ ] セット一覧表示
- [ ] レップ詳細表示
- [ ] 月移動ナビゲーション

### Weekly Summary Screen
- [ ] 週間ボリュームグラフ
- [ ] 先週との比較表示
- [ ] 種目別ボリューム表示
- [ ] 直近PR一覧表示
- [ ] 平均速度トレンド表示
- [ ] AIアドバイス表示

### AI & Recommendations
- [ ] Readiness Assessment 実装（Δv計算）
- [ ] トレーニング自動調整ロジック
- [ ] ドロップセット自動提案
- [ ] セット推奨ロジック
- [ ] AIコーチメッセージ生成

### Advanced Features
- [ ] AMRAP モード完全対応
- [ ] スーパーセット管理
- [ ] ドロップセット管理
- [ ] マシン重量ステップ認識（将来）

---

## Phase 3: Polish & Optimization

### UI/UX Enhancements
- [ ] アニメーション実装（PR通知など）
- [ ] ローディング状態表示
- [ ] エラーハンドリング UI
- [ ] トースト通知実装
- [ ] ハプティックフィードバック統合

### Audio Features
- [ ] 音声フィードバック実装
- [ ] 速度読み上げ
- [ ] PR通知音
- [ ] 警告音
- [ ] 音声コマンド認識（将来）

### Video Recording
- [ ] 動画記録機能実装（将来）
- [ ] Vision-VBT 基盤構築（将来）

### Performance & Testing
- [ ] パフォーマンス最適化
- [ ] メモリリーク対策
- [ ] BLE接続安定性向上
- [ ] ユニットテスト作成
- [ ] 統合テスト作成

### Deployment
- [ ] iOS ビルド設定
- [ ] TestFlight ビルド準備
- [ ] App Store Connect 設定
- [ ] プライバシーポリシー作成
- [ ] アプリアイコン・スプラッシュ画面生成

---

## Phase 4: TestFlight & Launch

### Pre-Launch
- [ ] 全機能の動作確認
- [ ] iOS デバイスでのテスト
- [ ] BLE デバイスとの互換性確認
- [ ] バッテリー消費テスト
- [ ] クラッシュレポート確認

### TestFlight
- [ ] TestFlight ビルドアップロード
- [ ] 内部テスター招待
- [ ] フィードバック収集
- [ ] バグ修正

### App Store
- [ ] App Store Connect メタデータ設定
- [ ] スクリーンショット準備
- [ ] 説明文作成
- [ ] キーワード設定
- [ ] App Store 申請

---

## Known Issues & Blockers

- [ ] BLE接続の安定性（OVR Velocity センサー互換性確認待ち）
- [ ] iOS 権限ダイアログのタイミング
- [ ] バックグラウンド実行時の BLE 接続維持

---

## Future Enhancements

- [ ] Vision-VBT（カメラ速度推定）
- [ ] Apple Watch 連携
- [ ] クラウド同期
- [ ] ソーシャル機能
- [ ] 月間レポート自動生成
- [ ] 技術スコア算出


---

## TestFlight & Deployment

### Pre-Deployment
- [x] app.config.ts 最終設定（v2.3.0）
- [x] iOS 権限設定（Bluetooth, Camera, Microphone など）
- [x] TESTFLIGHT_DEPLOYMENT.md 作成
- [x] IOS_BUILD_CHECKLIST.md 作成
- [x] アプリアイコン生成（1024×1024px）
- [x] スプラッシュスクリーン生成（200×200px）
- [x] README.md 更新
- [x] Android アダプティブアイコン生成
- [x] app.config.ts ブランディング設定完了

### Manus AI ビルド
- [ ] Manus アカウント準備
- [ ] GitHub リポジトリ接続
- [ ] iOS ビルド開始
- [ ] ビルド完了待機（30-60分）
- [ ] ビルドエラー対応（必要に応じて）

### App Store Connect
- [ ] Bundle ID 登録
- [ ] Provisioning Profile 作成
- [ ] Code Signing Certificate 作成
- [ ] ビルドが App Store Connect に表示されるまで待機
- [ ] ビルド処理完了確認（10-30分）

### TestFlight テスト
- [ ] 内部テスター招待
- [ ] テスターがアプリをインストール
- [ ] 主要機能テスト
- [ ] BLE デバイス互換性確認
- [ ] バッテリー消費テスト
- [ ] クラッシュレポート確認
- [ ] フィードバック収集

### バグ修正
- [ ] 報告されたバグを修正
- [ ] 新しいビルドをアップロード
- [ ] 再度テスト実施

### App Store 申請準備
- [ ] アプリ説明文作成
- [ ] キーワード設定
- [ ] スクリーンショット準備（5-10枚）
- [ ] プレビュー動画準備（オプション）
- [ ] プライバシーポリシー作成
- [ ] 利用規約作成
- [ ] サポート URL 設定
- [ ] Content Rating 完了
- [ ] 年齢制限設定

### App Store 申請
- [ ] 最終レビュー
- [ ] App Store に申請
- [ ] Apple レビュー待機（1-3日）
- [ ] 承認後、App Store で公開

---

## Future Enhancements

- [ ] Vision-VBT（カメラ速度推定）
- [ ] Apple Watch 連携
- [ ] クラウド同期
- [ ] ソーシャル機能
- [ ] 月間レポート自動生成
- [ ] 技術スコア算出
- [ ] 音声入力コマンド
- [ ] 動画記録機能


### Manus ビルド手順
- [x] MANUS_BUILD_GUIDE.md を確認
- [x] Manus UI（https://app.manus.im）にログイン
- [x] OVR VBT Coach プロジェクトを選択
- [x] Management UI で Secrets を確認
- [x] 「Publish」→「Build for iOS」をクリック
- [x] ビルド設定を入力（TestFlight デプロイ設定）
- [x] 「Start Build」をクリック
- [x] ビルド進捗を監視（30～60 分）
- [x] ビルド完了メール受信
- [x] IPA ファイルが App Store Connect にアップロード

### App Store Connect セットアップ
- [x] APP_STORE_CONNECT_SETUP.md を確認
- [x] Apple Developer アカウントで App Store Connect にログイン
- [x] 新しいアプリを登録（Bundle ID: space.manus.ovr.vbt.coach.app.t20260125053732）
- [x] アプリ情報を入力（名前、説明、カテゴリ）
- [x] スクリーンショット（最低 2 枚）を追加
- [x] App Preview ビデオを追加（オプション）
- [x] プライバシーポリシー URL を設定
- [x] サポート URL を設定
- [x] 年齢レーティングを設定
- [x] APP_STORE_METADATA.md 作成
- [x] App Store スクリーンショット生成（5 枚）
- [x] QUICK_START.md 作成

### TestFlight テスト
- [ ] Internal Testers グループを作成
- [ ] テスターのメールアドレスを追加
- [ ] ビルドを Internal Testers に追加
- [ ] テスター招待メール送信
- [ ] テスターが TestFlight アプリをダウンロード
- [ ] テスターが OVR VBT Coach をインストール
- [ ] 主要機能テスト実施（BLE、セッション記録、PR 検知）
- [ ] バグ報告を確認
- [ ] バグ修正と新ビルド提出

### App Store リリース準備
- [ ] すべてのテストが完了
- [ ] すべてのバグが修正
- [ ] リリースノートを作成
- [ ] 「Submit for Review」をクリック
- [ ] Apple レビュー待機（24～48 時間）
- [ ] App Store リリース
