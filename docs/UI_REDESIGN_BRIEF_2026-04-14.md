# UI Redesign Brief 2026-04-14

## Goal
RepVeloCoach の Home screen と Active Session screen を、ダークで高級感があり、レーシングダッシュボードのような high-tech aesthetic に再設計する。

## Chosen Direction
- Home: Variant 2 "Minimalist VBT Dashboard" をベースにしつつ、接続カードは Variant 1 の polished telemetry look を取り入れる
- Session: Variant 1 "Pro Session Tracking Active" をベースにしつつ、Variant 2 の data hierarchy と readable dashboard 感を取り入れる
- Accent system: neon orange を primary action、mint/green を live telemetry と positive state、danger red を recording/alert に使う
- Typography: 数値は等幅・高コントラストを優先し、ラベルは condensed な uppercase 方向で整理する
- Scope (phase 1): `app/(tabs)/index.tsx` と `app/(tabs)/session.tsx` のみ。機能追加より、情報の見せ方と操作の質感を優先する

## Home Screen Plan
- Hero を単なるタイトル領域ではなく、driver cockpit 的な command deck に変える
- LINK / MODE / QUEUE を numeric telemetry cards に寄せる
- BLE connection card を status + action の二層構造に整理する
- Main actions は premium action cards として強弱をつける
- Recent sessions は compact activity list にして、日付・sets・volume を一目で読めるようにする
- 余白は減らすが、視線誘導は強める

## Active Session Plan
- Header と session state をより大きく、より明確にする
- Measuring state は枠や glow を使って、いま計測中であることを即判別できるようにする
- Live Data panel を画面の主役にする
- Load / controls / rest timer / intelligence summary を dashboard modules として再配置する
- Recent history や coaching area も dark tech のカードトーンへ統一する
- 機能ロジック (`useSessionLogic`, DB, BLE, router) は変えず、見た目とレイアウト中心で進める

## Risk Boundaries
- BLE 接続・通知ロジックは触らない
- `useTrainingStore` / `useSessionLogic` の state transition は触らない
- DB 保存フローは触らない
- 既存の modal / tooltip / navigation は活かす
- フェーズ 1 では shared theme の大規模破壊は避ける

## Implementation Notes
- GLM worker へは Home / Session を別タスクで渡す
- Home は `sonnet` 相当、Session は `opus` 相当が妥当
- Codex は差分レビューと統合を担当する
- 実装後は `pnpm -s tsc --noEmit` で最低限検証する

## Current Decision
この brief をもとに、まず Home と Session の first-pass redesign を実装し、その後に Graph / History / Settings に波及させる。
