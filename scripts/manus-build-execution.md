# Manus ビルド実行ガイド

OVR VBT Coach を Manus ビルドシステムで iOS ビルドする詳細ガイドです。

## 前提条件

- ✅ Manus アカウント（https://app.manus.im）
- ✅ OVR VBT Coach プロジェクトが初期化済み
- ✅ app.config.ts が正しく設定済み
- ✅ すべての依存関係がインストール済み

## ビルド実行手順

### ステップ 1: Manus UI へのアクセス

1. https://app.manus.im にアクセス
2. Manus アカウントでログイン
3. プロジェクト一覧から **OVR VBT Coach** を選択

### ステップ 2: プロジェクト情報確認

Management UI で以下を確認:

| 項目 | 値 |
|------|-----|
| **Project Name** | OVR VBT Coach |
| **Project Path** | /home/ubuntu/ovr-vbt-coach-app |
| **Platform** | Mobile (Expo/React Native) |
| **Features** | db, server, user |
| **Dev Server** | Running |
| **Port** | 8081 |

### ステップ 3: Secrets 確認

1. Management UI で **Settings** → **Secrets** をクリック
2. 以下の環境変数が設定されているか確認:
   - `EXPO_PUBLIC_API_URL` (オプション)
   - その他のカスタム環境変数

### ステップ 4: ビルド開始

#### 4.1 Publish ボタンをクリック

1. Management UI の右上にある **Publish** ボタンをクリック
2. **Build for iOS** オプションを選択

#### 4.2 ビルド設定を入力

以下の設定を確認/入力:

```
Platform: iOS
Build Type: Release
Deployment Target: TestFlight
App Name: OVR VBT Coach
Bundle ID: space.manus.ovr.vbt.coach.app.t20260125053732
Version: 2.3.0
Build Number: 1
```

#### 4.3 ビルド開始

1. すべての設定が正しいことを確認
2. **Start Build** をクリック
3. ビルド開始確認メッセージを確認

### ステップ 5: ビルド監視

#### 5.1 ビルド進捗確認

1. Management UI で **Build Logs** セクションを表示
2. リアルタイムでビルドログを監視
3. 進捗状況を確認（0% → 100%）

#### 5.2 ビルドステージ

通常のビルドステージ:

```
1. 依存関係チェック (2～3 分)
2. TypeScript コンパイル (3～5 分)
3. Expo ビルド準備 (2～3 分)
4. iOS ビルド実行 (15～20 分)
5. IPA ファイル生成 (3～5 分)
6. App Store Connect アップロード (3～5 分)
```

**合計**: 30～60 分

#### 5.3 ログ確認

ビルドログで以下を確認:

```
✓ Dependencies installed
✓ TypeScript compiled successfully
✓ Expo build configured
✓ iOS build completed
✓ IPA generated: ovr-vbt-coach-v2.3.0-build1.ipa
✓ Uploaded to App Store Connect
```

### ステップ 6: ビルド完了

#### 6.1 完了通知

- Manus からビルド完了メール受信
- Management UI で完了ステータス表示

#### 6.2 App Store Connect 確認

1. App Store Connect にログイン
2. **OVR VBT Coach** を選択
3. **TestFlight** → **Builds** をクリック
4. 新しいビルドが表示されることを確認

#### 6.3 ビルド情報

```
Build Version: 2.3.0
Build Number: 1
Status: Processing (→ Ready to Test)
Upload Date: [日時]
```

## ビルド失敗時の対応

### 失敗パターン 1: 依存関係エラー

**エラーメッセージ例**:
```
Error: Pod install failed
```

**対応**:
1. ローカルで `pnpm install` を実行
2. `node_modules` を削除して再インストール
3. ビルドを再実行

### 失敗パターン 2: TypeScript エラー

**エラーメッセージ例**:
```
Error: TypeScript compilation failed
```

**対応**:
1. ローカルで `npm run check` を実行
2. エラーを修正
3. `webdev_save_checkpoint` で新しいチェックポイント作成
4. ビルドを再実行

### 失敗パターン 3: Provisioning Profile エラー

**エラーメッセージ例**:
```
Error: Provisioning Profile not found
```

**対応**:
1. Apple Developer アカウント設定を確認
2. Provisioning Profile が有効か確認
3. Bundle ID が正しいか確認
4. https://help.manus.im でサポート受ける

### 失敗パターン 4: App Store Connect アップロード失敗

**エラーメッセージ例**:
```
Error: Failed to upload to App Store Connect
```

**対応**:
1. App Store Connect にログイン可能か確認
2. アプリが登録されているか確認
3. Bundle ID が一致しているか確認
4. ビルドを再実行

## ビルド後の確認

### 確認項目

- [ ] Manus ビルド完了メール受信
- [ ] App Store Connect でビルド表示
- [ ] ビルドステータスが「Ready to Test」
- [ ] IPA ファイルサイズが 50MB～300MB
- [ ] TestFlight でビルド追加可能

### 次のステップ

1. ✅ Manus でビルド実行
2. ⬜ App Store Connect でビルド確認
3. ⬜ TestFlight で Internal Testers にビルド追加
4. ⬜ テスター招待メール送信

## トラブルシューティング

### ビルドが遅い

- 通常 30～60 分
- 1 時間以上かかる場合は、Manus サポートに連絡

### ビルドがスタックしている

1. Management UI を更新
2. ビルドステータスを確認
3. 1 時間以上変わらない場合は、https://help.manus.im でサポート受ける

### ビルド後 App Store Connect に表示されない

1. App Store Connect を更新
2. 5～10 分待機
3. それでも表示されない場合は、Manus サポートに連絡

## 参考リンク

- Manus: https://app.manus.im
- App Store Connect: https://appstoreconnect.apple.com
- Expo Build: https://docs.expo.dev/build/introduction/
- Apple Developer: https://developer.apple.com/

---

**プロジェクト**: OVR VBT Coach v2.3.0
**チェックポイント**: f0c99621
