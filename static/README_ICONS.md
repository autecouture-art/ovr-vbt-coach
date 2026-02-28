# アイコンファイルについて

PWA機能を完全に有効にするには、以下のアイコンファイルが必要です：

- `icon-192.png` (192x192ピクセル)
- `icon-512.png` (512x512ピクセル)

## アイコンの作成方法

1. **オンラインツールを使用**
   - [PWA Asset Generator](https://www.pwabuilder.com/imageGenerator)
   - [RealFaviconGenerator](https://realfavicongenerator.net/)

2. **デザインツールで作成**
   - ダンベルやVBT関連のアイコンをデザイン
   - 背景色: #1a1a1a（ダークテーマに合わせる）

3. **プレースホルダーとして**
   - 現在はmanifest.jsonで定義されていますが、実際の画像ファイルがない場合はブラウザのデフォルトアイコンが使用されます

## アイコン配置

作成したアイコンを以下のパスに配置してください：
- `/static/icon-192.png`
- `/static/icon-512.png`

配置後、PWAとして「ホーム画面に追加」した際に、カスタムアイコンが表示されます。



