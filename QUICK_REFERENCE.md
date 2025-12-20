# OVR VBT Coach - クイックリファレンス 📝

## よく使うコマンド

```bash
# アプリ起動
python vbt_app.py

# または
./Launch_OVR_VBT.command

# BLEスタンドアロン
python ble_main.py

# DB初期化
python vbt_db_schema.py
```

## ファイル構成

| ファイル | 役割 | 行数 |
|---------|------|------|
| `vbt_app.py` | GUI (メインアプリ) | 1064 |
| `vbt_core.py` | ビジネスロジック | 752 |
| `ble_client.py` | BLE通信 | 347 |
| `parser.py` | データ解析 | 171 |
| `vbt_db_schema.py` | DBスキーマ | 125 |

## 主要クラス

### GUI層
- `VBTApp` - メインウィンドウ
- `SessionSetupDialog` - セッション開始
- `ManualEntryDialog` - 手動入力
- `CalendarWidget` - カレンダー

### ロジック層
- `TrainingDatabase` - DB操作
- `OneRMCalculator` - 1RM推定
- `VelocityLossManager` - V-Loss管理
- `PersonalRecordManager` - PR検出
- `AICoach` - AI推奨
- `AudioCoach` - 音声

### データ層
- `OVRVelocityClient` - BLE通信
- `VelocityData` - データ構造

## DBテーブル

1. `exercises` - 種目マスタ
2. `sessions` - セッション
3. `sets` - セット
4. `reps` - レップ詳細
5. `personal_records` - PR記録

## よくある変更箇所

### 新しいセットタイプ追加
➡️ `vbt_app.py` L427-431 (Radio buttons)

### 新しいPRタイプ追加
➡️ `vbt_core.py` PersonalRecordManager

### 新しいタブ追加
➡️ `vbt_app.py` L373-386 (`_setup_ui`)

### MVT値変更
➡️ `vbt_core.py` L249-254 (MVT_TABLE)

## デバッグ

```python
# BLE
print(f"[DEBUG] Device: {device.name}")

# DB
cursor.execute("SELECT * FROM sessions")
print(cursor.fetchall())

# GUI
self.update_idletasks()
```

## トラブルシューティング

### NumPy Error
```bash
pip install "numpy<2"
```

### BLE接続失敗
- Bluetooth再起動
- デバイス削除

### Segmentation Fault
```python
# 禁止
self.attributes("-topmost", True)

# OK
self.lift()
```

詳細は [DEVELOPER_GUIDE.md](file:///Users/hoshinohideyuki/Library/CloudStorage/GoogleDrive-autecouture@gmail.com/マイドライブ/OVR/DEVELOPER_GUIDE.md) 参照
