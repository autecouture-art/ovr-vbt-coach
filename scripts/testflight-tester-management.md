# TestFlight テスター招待・管理ガイド

OVR VBT Coach を TestFlight でテストするためのテスター管理ガイドです。

## テスター招待前の準備

### 1. テスター情報収集

テスターから以下の情報を収集:

| 項目 | 説明 |
|------|------|
| **名前** | テスターの名前 |
| **メールアドレス** | Apple ID として使用するメール |
| **デバイス** | iPhone モデル（例: iPhone 15 Pro） |
| **iOS バージョン** | iOS 15.1 以上 |
| **Bluetooth デバイス** | OVR Velocity センサーへのアクセス |

### 2. テスター適格性確認

テスターが以下を満たしているか確認:

- [ ] Apple ID を持っている
- [ ] iPhone を持っている
- [ ] iOS 15.1 以上にアップデート可能
- [ ] TestFlight アプリをインストール可能
- [ ] OVR Velocity センサーへのアクセス可能（オプション）

## TestFlight テスター招待手順

### ステップ 1: App Store Connect でテスターグループ作成

#### 1.1 Internal Testers グループ作成

1. App Store Connect にログイン
2. **OVR VBT Coach** を選択
3. **TestFlight** タブをクリック
4. **Internal Testers** セクションで **+** をクリック
5. **Group Name**: `Core Team` を入力
6. **Create** をクリック

#### 1.2 External Testers グループ作成（オプション）

1. **External Testers** セクションで **+** をクリック
2. **Group Name**: `Beta Testers` を入力
3. **Create** をクリック

### ステップ 2: テスターを追加

#### 2.1 Internal Testers にテスター追加

1. **Internal Testers** → **Core Team** をクリック
2. **Add Testers** をクリック
3. テスターのメールアドレスを入力（複数可）
   - 例: tester1@example.com
   - 例: tester2@example.com
4. **Add** をクリック

#### 2.2 External Testers にテスター追加（オプション）

1. **External Testers** → **Beta Testers** をクリック
2. **Add Testers** をクリック
3. テスターのメールアドレスを入力
4. テスターの名前を入力（オプション）
5. **Add** をクリック

### ステップ 3: ビルドをテスターグループに追加

#### 3.1 ビルド確認

1. **TestFlight** → **Builds** をクリック
2. 最新のビルドを確認（ステータス: Ready to Test）

#### 3.2 Internal Testers にビルド追加

1. ビルドをクリック
2. **Add Build** をクリック
3. **Internal Testers** → **Core Team** を選択
4. **Save** をクリック

#### 3.3 External Testers にビルド追加（オプション）

1. ビルドをクリック
2. **Add Build** をクリック
3. **External Testers** → **Beta Testers** を選択
4. **Save** をクリック

### ステップ 4: テスター招待メール送信

#### 4.1 招待メール確認

- テスターが自動的に招待メールを受け取ります
- メール件名: `You're invited to test OVR VBT Coach`
- メール内容: TestFlight アプリダウンロードリンク

#### 4.2 招待メール再送信

メールが届かない場合:

1. **Internal Testers** → **Core Team** をクリック
2. テスター名を選択
3. **Resend Invitation** をクリック

## テスター指示書

テスターに以下の指示を送信:

### テスター向け指示書

```
=== OVR VBT Coach TestFlight テスト指示書 ===

ありがとうございます！OVR VBT Coach のテストにご協力いただきます。

【ステップ 1: TestFlight アプリをダウンロード】
1. App Store で「TestFlight」を検索
2. TestFlight アプリをダウンロード
3. Apple ID でログイン

【ステップ 2: 招待メールを確認】
1. メールボックスで「You're invited to test OVR VBT Coach」を確認
2. メール内のリンクをクリック
3. TestFlight アプリが自動的に開きます

【ステップ 3: OVR VBT Coach をインストール】
1. TestFlight アプリで OVR VBT Coach を検索
2. 「Install」をクリック
3. アプリがインストールされます

【ステップ 4: アプリを起動】
1. TestFlight アプリで OVR VBT Coach を開く
2. または iPhone のホーム画面から直接起動

【テスト項目】

以下の機能をテストしてください:

1. **アプリ起動**
   - アプリが正常に起動するか
   - ホーム画面が表示されるか
   - クラッシュしないか

2. **BLE 接続**（OVR Velocity センサーがある場合）
   - Bluetooth 接続画面が表示されるか
   - OVR Velocity センサーが検出されるか
   - ペアリングが成功するか

3. **セッション記録**
   - 「Start Session」ボタンが動作するか
   - セッション記録画面が表示されるか
   - リアルタイムデータが表示されるか

4. **PR 検知**
   - PR 通知が表示されるか
   - 通知内容が正しいか

5. **データ表示**
   - 本日のボリューム合計が表示されるか
   - Velocity Loss が正しく計算されているか
   - 過去のセッションが表示されるか

6. **UI/UX**
   - ダークモードが正しく表示されるか
   - ボタンが反応するか
   - テキストが読みやすいか

7. **パフォーマンス**
   - アプリが遅いか
   - バッテリー消費が多いか
   - メモリリークがないか

【バグ報告方法】

問題を発見した場合:

1. TestFlight アプリを開く
2. OVR VBT Coach を選択
3. 「Send Feedback」をクリック
4. 以下を記入:
   - **タイトル**: 簡潔な問題説明
   - **説明**: 詳細な問題説明
   - **スクリーンショット**: 問題のスクリーンショット（オプション）
   - **ビデオ**: 問題の再現ビデオ（オプション）
5. 「Send」をクリック

【バグ報告例】

```
タイトル: BLE 接続画面でセンサーが検出されない
説明: 
- iPhone 15 Pro, iOS 18.1
- OVR Sensor 1 を使用
- Bluetooth をオンにしても検出されない
- 他のアプリでは Bluetooth が動作している
スクリーンショット: [添付]
```

【テスト期間】

- テスト期間: [開始日] ～ [終了日]
- 目標: 主要機能の動作確認
- フィードバック期限: [期限]

【質問・サポート】

問題が発生した場合:
- Email: support@ovrvelocity.com
- 返信時間: 営業時間内 24 時間以内

ご協力ありがとうございます！
```

## テスト監視

### テスト進捗確認

1. App Store Connect にログイン
2. **OVR VBT Coach** → **TestFlight** をクリック
3. **Testers** セクションでテスター状況を確認

| ステータス | 説明 |
|-----------|------|
| **Invited** | 招待メール送信済み、未応答 |
| **Installed** | アプリをインストール |
| **Launched** | アプリを起動 |
| **Active** | 定期的に使用中 |
| **Stopped** | テスト停止 |

### フィードバック確認

1. **TestFlight** → **Feedback** をクリック
2. テスターからのフィードバックを確認
3. バグレポートを分類

## バグ修正と新ビルド提出

### バグ修正手順

1. テスターからのフィードバックを確認
2. バグを修正
3. ローカルでテスト
4. `todo.md` で完了したタスクをマーク
5. `webdev_save_checkpoint` で新しいチェックポイント作成
6. Manus UI で新しいビルドを実行

### 新ビルド提出

1. app.config.ts で Build Number をインクリメント（1 → 2）
2. Manus でビルド実行
3. ビルド完了後、App Store Connect で確認
4. 新しいビルドを同じテスターグループに追加
5. テスターに通知

## テスト完了後

### テスト完了チェックリスト

- [ ] すべてのテスターがテスト完了
- [ ] すべてのバグが修正
- [ ] 新ビルドで修正を確認
- [ ] テスターが最終承認

### App Store リリース準備

1. テスト完了を確認
2. リリースノートを作成
3. App Store Connect で「Submit for Review」をクリック
4. Apple レビュー待機（24～48 時間）
5. App Store リリース

## トラブルシューティング

### テスター招待が送信されない

**症状**: テスターがメールを受け取らない

**対応**:
1. メールアドレスが正しいか確認
2. テスターが Apple ID を持っているか確認
3. App Store Connect で「Resend Invitation」をクリック
4. スパムフォルダを確認

### テスターがアプリをインストールできない

**症状**: TestFlight でアプリが表示されない

**対応**:
1. テスターが招待メールを受け取ったか確認
2. TestFlight アプリがインストールされているか確認
3. iOS バージョンが 15.1 以上か確認
4. App Store Connect でテスターが追加されているか確認

### アプリがクラッシュする

**症状**: テスターがアプリ起動時にクラッシュ報告

**対応**:
1. Crash Report を確認
2. ローカルでクラッシュを再現
3. バグを修正
4. 新しいビルドを提出

## 参考リンク

- App Store Connect: https://appstoreconnect.apple.com
- TestFlight: https://developer.apple.com/testflight/
- Apple Developer: https://developer.apple.com/

---

**プロジェクト**: OVR VBT Coach v2.3.0
**チェックポイント**: f0c99621
