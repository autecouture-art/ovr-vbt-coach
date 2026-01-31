# WebアプリでのBluetooth接続について

## 問題点

Webブラウザから直接Bluetoothデバイスに接続するには、**Web Bluetooth API**を使用する必要がありますが、以下の制約があります：

### 1. ブラウザサポートの制限
- **Chrome/Edge（Chromiumベース）**: サポートあり
- **Firefox**: サポートなし
- **Safari**: サポートなし（macOS/iOS）
- **Opera**: 限定的なサポート

### 2. セキュリティ制約
- **HTTPS必須**: ローカルホスト（localhost）以外ではHTTPSが必要
- **ユーザー操作必須**: ボタンクリックなどのユーザー操作が必要（自動接続不可）
- **ペアリング制限**: 一部のデバイスはペアリングが必要

### 3. プラットフォーム制約
- **macOS**: Safariでは利用不可（Chrome/Edgeのみ）
- **iOS**: Web Bluetooth APIは完全にサポートされていない
- **Android**: Chromeで利用可能

### 4. 機能制限
- **GATTサービス**: 一部のサービス/キャラクタリスティックにアクセスできない場合がある
- **バックグラウンド動作**: タブが非アクティブになると接続が切断される可能性

## 解決策：サーバー側BLE管理

上記の制約を回避するため、**サーバー側でBLE接続を管理し、WebSocket経由でデータを送信**する方式を実装しました。

### アーキテクチャ

```
[OVR Velocity デバイス]
        ↓ (BLE)
[Pythonサーバー (bleak)]
        ↓ (WebSocket)
[Webブラウザ (Flask-SocketIO)]
```

### 実装内容

1. **サーバー側（vbt_web.py）**
   - `ble_client.py`を使用してBLE接続を管理
   - 受信したデータをWebSocket経由で全クライアントにブロードキャスト
   - データベースにも自動保存

2. **クライアント側（index.html）**
   - WebSocket経由でリアルタイムデータを受信
   - リアルタイム速度表示
   - BLE接続状態の表示

### メリット

✅ **クロスプラットフォーム**: すべてのブラウザで動作  
✅ **セキュリティ**: サーバー側でBLE接続を一元管理  
✅ **安定性**: ブラウザの制約に依存しない  
✅ **拡張性**: 複数のクライアントに同時配信可能  

### 使用方法

1. Webサーバーを起動
   ```bash
   python vbt_web.py
   ```

2. ブラウザでアクセス
   ```
   http://localhost:5001
   ```

3. 「BLE接続」ボタンをクリック
   - サーバー側でBLEデバイスをスキャン
   - 接続後、リアルタイムデータが表示されます

### 将来の拡張

- **Web Bluetooth APIの併用**: 対応ブラウザでは直接接続も可能に
- **複数デバイス対応**: 複数のOVR Velocityデバイスに同時接続
- **データストリーミング**: より高頻度なデータ送信

## 参考資料

- [Web Bluetooth API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API)
- [Chrome Web Bluetooth](https://developer.chrome.com/articles/bluetooth/)
- [Flask-SocketIO Documentation](https://flask-socketio.readthedocs.io/)



