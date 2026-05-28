# リアルタイムデータ共有 計画

## 結論

リアルタイム共有は可能。ただし iPhone 内の SQLite を Mac が直接読むのではなく、アプリが明示的に外へ送る方式にする。

## 候補

### 1. ローカルLAN Live Share

- iPhone から Mac の小さなローカルHTTP/WebSocketサーバーへ送信する。
- セッション開始、rep追加、set完了、動画保存のたびにイベントを送る。
- Mac側はダッシュボードやJSONLログとして即時表示できる。
- 会社Wi-Fiではセキュリティ誤検知を避けるため、探索やスキャンはせず、MacのURLを手入力する。

向いている用途:

- トレーニング中にMacでリアルタイム確認。
- Codexがその場でデータを見る。
- 動画メタデータもすぐ反映。

注意:

- Mac側サーバー起動が必要。
- iPhoneとMacが同じネットワーク上にいる必要がある。
- 動画ファイル本体をリアルタイム送信すると重いので、まずはメタデータとイベントだけにする。

### 2. Firebase Sync

- iPhone が Firestore / Storage に保存し、Macが読む。
- 外出先や別ネットワークでも使える。
- 動画本体もStorageに置けるが容量と料金に注意。

向いている用途:

- 長期保存。
- Macが同じWi-Fiにいない時。
- 将来のWebダッシュボード。

注意:

- 認証・課金・オフラインキュー設計が必要。
- 動画アップロードは通信量が大きい。

### 3. Codex Export 自動化

- 現在の `CODEX EXPORT` を手動ではなく、セッション終了時や一定間隔で自動書き出しする。
- 完全リアルタイムではないが実装が軽い。

向いている用途:

- まず壊さずMacで見たい。
- データ量が少ない。

## 推奨MVP

最初はローカルLAN Live Shareを作る。

実装済み。

1. Mac側に `scripts/repvelo_live_share_server.mjs` を追加。
2. iPhone設定に `Live Share URL` / `Live Share ON/OFF` / 任意tokenを追加。
3. アプリは以下のイベントをPOSTする。
   - `session_started`
   - `rep_recorded`
   - `set_completed`
   - `form_video_saved`
4. Mac側は `exports/live-share/events.jsonl` に追記し、最新状態をコンソール表示する。
5. 失敗時は端末内キューに積み、アプリ操作は止めない。

## 使い方

Mac側:

```bash
cd /Volumes/0RICON_APP/Developer/MyFiles/repvelocoach-git-sync-20260320/repo
pnpm live-share:server -- --host 0.0.0.0 --port 8788
```

tokenを使う場合:

```bash
pnpm live-share:server -- --host 0.0.0.0 --port 8788 --token "任意の文字列"
```

iPhone側:

1. 設定 → 共有 → Live Shareを有効化。
2. Mac URLに `http://line93.local:8788` または `http://MacのIP:8788` を入力。
3. tokenを使った場合だけ同じ文字列を入力。
4. セッション開始、rep記録、set完了、フォーム動画保存でイベントが送られる。

確認:

```bash
tail -f exports/live-share/events.jsonl
```

Macダッシュボード:

```text
http://localhost:8788/dashboard
```

tokenを指定した場合:

```text
http://localhost:8788/dashboard?token=任意の文字列
```

GPT相談パケット:

```text
http://localhost:8788/gpt-packet
```

ダッシュボードには直近セット、直近rep、動画メタデータ件数、最新raw eventを表示する。
`GPTパケットをコピー` で直近イベントからMarkdown相談文を生成してクリップボードへコピーできる。

## セキュリティ境界

- ネットワーク探索はしない。
- Mac URL は手入力。
- token を任意で設定し、HTTP header で送る。
- token設定時は `/events/recent` と `/gpt-packet` も token が必要。
- 会社Wi-Fiでは通常のHTTP POSTだけにする。
- 動画ファイル本体の送信は別フェーズ。

## 次フェーズ

- Mac側リアルタイムダッシュボード。実装済み。
- Firestore同期。
- 動画本体の手動アップロード/共有。
- ChatGPT相談パケットをMac側で自動生成。実装済み。
