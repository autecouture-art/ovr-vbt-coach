# OVR Velocity Project: Context for AI Consultation

## プロジェクト概要
トレーニング用VBTデバイス「OVR Velocity」のMac用クライアントアプリをPythonで開発中。
公式SDKが存在しないため、BLEパケットの解析（リバースエンジニアリング）を行い、データの可視化・記録・コーチング機能（VBT）を実装している。

## 環境・技術スタック
- **OS**: macOS
- **Language**: Python 3.10+
- **Libraries**:
    - `bleak`: BLE通信
    - `customtkinter`: GUI
    - `pyttsx3` / `afplay`: 音声フィードバック
    - `sqlite3`: データ保存
    - `pandas` / `openpyxl`: データ分析・Excel連携

## 現在判明している技術仕様 (The Truth)

### 1. BLE接続
- **Service UUID**: `4fafc201-1fb5-459e-8fcc-c5c9c331914b`
- **Notify Char UUID**: `14001dc2-5089-47d3-84bc-7c3d418389aa`
- **挙動**: レップ終了時にのみ1回データをNotifyで送信（リアルタイム波形なし）。

### 2. データ構造 (16 bytes)
リトルエンディアンの `uint16` × 8フィールドとして解析。

| Field | Byte Offset | パラメータ | 変換式 | ステータス |
|---|---|---|---|---|
| **Field 2** | 4-5 | **Avg Velocity** | `raw / 100.0` (m/s) | ✅ 確定 |
| **Field 4** | 8-9 | **Avg Power** | `raw` (W) | ✅ 確定 |
| **Field 1** | 2-3 | **ROM** | `raw / 10.0 * 2.54` (cm) | ✅ 確定 (元データはinch*10) |
| **Field 6** | 12-13 | **Time to Peak** | `raw / 100.0` (s) | 🟢 ほぼ確定 |
| **Field 5** | 10-11 | *Peak Power?* | `raw` (W)? | 🔺 推測 (Avgより大きい値) |
| **Field 0** | 0-1 | *Peak Velocity?* | Unknown | ❌ 謎 (Avgより小さい値が入ることがある) |
| Field 3 | 6-7 | Unknown | - | - |
| Field 7 | 14-15 | Unknown | - | - |

## 実装済みの機能
1.  **リアルタイム監視**: レップごとの数値をGUI（CustomTkinter）で大きく表示。
2.  **Audio Coach**:
    - 速度（m/s）の読み上げ (TTS)。
    - **Velocity Loss Cutoff**: 設定したパーセンテージ（例: 20%）以上速度が低下したら、警告音と画面フラッシュで通知。
3.  **データ管理**:
    - SQLiteデータベースに全レップを保存。
    - 「Today's Log」と「History」タブで履歴閲覧。
4.  **1RM推定**:
    - その日のセット重量と平均速度から、線形回帰 (Load-Velocity Profile) を用いてリアルタイムに1RMを推定。

## 他のAIに相談したい・ブレストしたい点

### 1. 未解析フィールドの特定 (Field 0 の謎)
- `Field 0` を `Peak Velocity` と仮定したが、`Avg Velocity` (Field 2) よりも低い値が入るケースが多々あり、物理的に矛盾するため棄却した。
- `Peak Velocity` はどこに含まれているのか？あるいは計算で求めるものなのか？
- `Field 3`, `Field 7` の役割は？

### 2. 1RM推定精度の向上
- 現在は当日のデータ点（Load-Velocity）のみで回帰直線を引いている。
- データ点が少ない（アップ中の数セットのみ）段階での精度をどう上げるか？（過去の履歴データの重み付けなど）。

### 3. VBTアプリとしてのUX
- 現在の機能（巨大表示、音声、VLアラート）以外に、トレーニーにとって「最強のVBTアプリ」に必要な機能は何か？
- コンペティター（Vitruve, RepOneなど）にあるキラー機能のアイデア。

---
**補足データ**:
以下は実際のデータ取得例（CSV形式イメージ）
```csv
Timestamp, Field0, Field1, Field2, Field3, Field4, Field5, Field6, Field7
12:00:01,  85,     155,    56,     0,      214,    340,    25,     0
```
- Field 2 (56) -> 0.56 m/s (Avg Velo)
- Field 4 (214) -> 214 W (Avg Power)
- Field 1 (155) -> 15.5 inch -> 39.37 cm (ROM)






