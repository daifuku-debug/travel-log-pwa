# Architecture

プロジェクトの現在の層構造と配置ルールです。機能の背景は[Project Context](PROJECT_CONTEXT.md)、MediaAsset固有仕様は[Media Asset Spec](MEDIA_ASSET_SPEC.md)を参照してください。

## 実行構成

- `src/main.tsx`: Reactの起動と本番Service Worker登録
- `src/app/router.tsx`: React Routerのルート、遅延読み込み、GitHub Pages用basename
- `src/shared/layout/AppLayout.tsx`: `Outlet`、Toast、Bottom Navigationを持つAppShell
- `vite.config.ts`: `/travel-log-pwa/`をbaseとするVite設定

## 層の責務

### Domain (`src/domain`)

永続モデル、Repository interface、マスター、純粋な正規化・Migration・判定ロジックを置きます。React、IndexedDB、画面文言への依存を持たせません。

### Feature (`src/features`)

ユースケース、Service、UI非依存ロジック、Hook、機能専用コンポーネントを置きます。ServiceがRepositoryを組み合わせ、UIから永続処理を分離します。テスト可能な処理は、依存注入版ロジックと実Repositoryを接続する薄いServiceへ分ける既存パターンを優先します。

### Infrastructure (`src/infrastructure`)

IndexedDB操作、Local Repository実装、Repository factoryを置きます。`src/domain/repositories`のinterfaceを実装し、論理削除済みデータを通常の`list`／`getById`から除外します。

### Pages・Shared

- `src/pages`: ルート単位の画面構成
- `src/shared`: 共通UI、レイアウト、ナビゲーション、Hook、日付処理、Error
- UIコンポーネントはServiceを利用し、Domain判定やIndexedDB処理を直接持ちません。

## RepositoryとService

Repository interfaceはDomain、Local実装はInfrastructure、複数Repositoryを使う処理とError変換はFeature Serviceが担当します。Repository interface、Store、Indexの追加は永続契約の変更なので、明示されたPhaseでのみ行います。

## IndexedDB

現在のDB名は`travel-log-local-db`、IndexedDB Versionは**10**です。各Storeは`id`をkeyPathとし、追加Indexはありません。

- 旅行: `trips`、`placeVisits`、`tripTransportLegs`
- コレクション: `wishlistItems`、`collections`、`collectionItems`、`collectionVisits`
- 制覇記録: `prefectureVisits`、`tripPrefectureVisits`、`castleVisitSummaries`、`castleVisitEvents`
- スクラップブック: `scrapbooks`、`scrapbookPages`、`scrapbookBlocks`
- 写真: `mediaAssets`、`mediaAssetBlobs`
- その他: `manualTimelineEntries`、`travelGachaDraws`、RPG関連Store、`syncOperations`、`meta`

`MediaAsset` metadataと画像Blobは分離します。metadataは`mediaAssets`、original／thumbnailは`mediaAssetBlobs`へ保存します。

## Backup SchemaとDB Version

- 現在のJSON Backup Schemaは**v12**です。
- 現在のIndexedDB Versionは**10**です。
- Backup Versionは書き出し形式とImport互換性、DB VersionはStore／Index構造を管理する別の番号です。同時に上げる前提ではありません。
- JSONバックアップはMediaAsset metadataを含みますが、写真Blob本体を含みません。
- 完全BackupはPackage Version 1のZIPへv12 Metadataとoriginal／thumbnail Blobを格納します。Package Version、Backup Schema、DB Versionは独立して管理します。
- 完全Backup Exportは必要Storeを同一read-only TransactionでSnapshot化し、UI非依存Validatorの自己検証後だけダウンロード可能にします。詳細は[Backup Spec](BACKUP_SPEC.md)を参照してください。

## Scrapbook構造

```text
Scrapbook
└─ ScrapbookPage (pageKind, sortOrder)
   └─ ScrapbookBlock (type, sortOrder)
```

Viewerは`ScrapbookPage.sortOrder`と`pageKind`で描画し、RendererをViewerとEditorで共用します。`origin`、`sourceRevision`、`userEditedFields`により生成内容とユーザー編集の共存に備えています。

## UI State、Draft、永続保存

- UI State: Sheet、選択、Loading、Pending Fileなど画面内だけの状態
- Page Draft: React State上の編集中データ。変更は共通Rendererのプレビューへ即時反映
- 永続保存: 「記録を更新」時にService経由でIndexedDBへ保存

Draft、Pending File、Object URLは永続参照ではありません。保存失敗時はDraftを保持し、未保存移動では既存Confirmを利用します。

## Migrationと正規化

- 旧Scrapbook／Page／Blockは読込時にv10相当へ補完し、既存レコードを一括更新しません。
- MediaAssetの`usage`、所有関係、`contentHash`も共通の純粋関数で正規化します。
- Backup Importは旧形式を現在形式へ正規化し、未知の将来Versionを拒否します。
- 後方互換フィールドは、削除Phaseが明示されるまで読み取り互換を維持します。

## 訪問日時

- `PlaceVisit.visitedAt`は既存互換の訪問日基準値として維持します。
- 明示された到着・出発は任意の`arrivalAt`／`departureAt`へISO日時で保存します。
- 時刻のない旧データは日付精度として扱い、画面へ`00:00`を補いません。
- 入力は端末のローカル日時、保存はISO日時とし、表示時に端末のローカル日時へ戻します。
- クイック到着・出発も同じ日時生成と`PlaceVisit`保存Serviceを使い、クイック導線内では同一旅行の滞在中を1件に制限します。既存の滞在を勝手に終了しません。

## テスト

`scripts/run-tests.mjs`をNodeのTypeScript型除去機能で実行する単一テストスイートです。現在264件あり、純粋ロジック、保存・互換性、ソース構造上の契約を検証します。通常の検証コマンドは[Workflow](WORKFLOW.md)に従います。

## 主要ディレクトリ

```text
src/app             起動後のルーティング
src/domain          モデル、Repository interface、純粋Domainロジック
src/features        機能別Service、Hook、ロジック、コンポーネント
src/infrastructure  IndexedDBとLocal Repository
src/pages           ルート画面
src/shared          共通UI、Layout、Navigation、Utility
public              PWA、Service Worker、同梱地図データ
docs                データ出典とCodex向け仕様
scripts             テストとデータ更新スクリプト
```
