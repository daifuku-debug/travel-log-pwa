# Project Context

この文書は、Codexが作業開始時に把握すべき現在の前提をまとめたものです。配置判断は[Architecture](ARCHITECTURE.md)、体験判断は[Product Rules](PRODUCT_RULES.md)、作業手順は[Workflow](WORKFLOW.md)を参照してください。

## アプリの目的

「旅ログ」は、旅行・お出かけの予定、訪問場所、移動、写真、感想、収集記録を端末内へ残し、旅を後から作品として振り返るための個人向けPWAです。スクラップブックでは **My Travel Magazine** を掲げ、自動生成された旅行雑誌をユーザー自身が編集して完成させる体験を中心にしています。

## 現在の主要機能

- ホーム、旅行の作成・一覧・詳細・結果、訪問場所、移動区間
- ページ駆動型スクラップブックViewerと編集室、表紙編集、端末写真追加
- 日本制覇マップ、コレクション、日本100名城・続日本100名城、欲しいもの
- タイムマシン、旅ガチャ、旅行RPG
- IndexedDBへの端末内保存、軽量JSONバックアップ／復元、写真込み完全Backup ZIPの書き出し

## 技術と対応環境

- React 19、TypeScript 5.8、Vite 7、React Router 7
- CSSは`src/styles.css`とCSS Variablesを中心に構成し、外部UIライブラリは使用していません。
- モダンブラウザ上で動作するレスポンシブWebアプリで、スマートフォン利用と393px幅を主基準にしています。
- 画面ルートは遅延読み込みし、`import.meta.env.BASE_URL`を使ってGitHub Pagesのサブパスに対応しています。

## PWAと配信

- `public/manifest.webmanifest`、`public/sw.js`、本番時のService Worker登録でインストールとオフライン利用に対応します。
- 静的アセット、地図データ、主要チャンクをService Workerでキャッシュします。
- GitHub Pagesが現在の公開先です。`main`へのpushでGitHub ActionsがpnpmによるBuildを実行し、`dist`をPagesへ配信します。

## Cloudflareの位置づけ

現在の実データ保存先は端末内IndexedDBだけで、Cloudflareへの実通信、認証、同期Repositoryはありません。WorkersとD1は将来のメタデータ同期候補、R2は写真Blob同期候補ですが、いずれも未実装であり、現時点の保存契約として扱ってはいけません。

## 現在のPhase

現在は、実際の旅行中に素早く使える旅行記録MVPを優先しています。Phase T1で訪問日時、Phase T2で場所名だけのクイック到着、滞在中表示、現在時刻での出発、既存詳細編集への接続を整備しました。スクラップブックPhase 5-AのMediaAssetライフサイクルと写真込みBackup ZIP Exportは完成済みで、写真込みBackup Restoreは保留中です。詳細は[Media Asset Spec](MEDIA_ASSET_SPEC.md)と[Roadmap](ROADMAP.md)を参照してください。

## 大きな残課題

- Missing Original、Dangling Reference、Invalid Cover Ownerの手動復旧
- Trip削除時の関連データ削除
- 旅行中の記録導線の継続改善
- 写真込み完全Backup ZIPの復元、Cloudflare D1／R2同期（現在保留）
- 写真クロップ、焦点位置、より高度なスクラップブック編集
