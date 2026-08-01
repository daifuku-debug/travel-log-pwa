# Backup Spec

現在の軽量JSON Backupと、写真を含む完全Backup Packageの仕様です。[Architecture](ARCHITECTURE.md)、写真自体の仕様は[Media Asset Spec](MEDIA_ASSET_SPEC.md)を参照してください。

## 軽量Backup

- JSON Backup Schemaは現在**v12**です。
- 旅行、Scrapbook、MediaAsset metadataなどを含み、MediaAsset Blob本体は含みません。
- 旧Versionを現在形式へ正規化し、未知の将来Versionを拒否します。
- 現在のJSON読み込みは端末内Metadataを全置換します。写真Blobの復元には使用できません。

## 完全Backup Package

完全BackupはPackage Version **1**、内包するMetadataは既存のBackup Schema **v12**です。両Versionは独立して管理し、IndexedDB Version 10とも別概念です。

```text
travel-backup-full-YYYY-MM-DD.zip
├── manifest.json
├── metadata.json
└── media/<assetId>/
    ├── original.<ext>
    └── thumbnail.<ext>
```

- `metadata.json`は軽量Backupと同じv12形式です。
- ファイルパスにはAsset IDと用途だけを使い、元ファイル名を含めません。
- 画像は再圧縮せずZIPへ格納します。
- `manifest.json`はPackage Version、作成日時、Metadata Version、Media一覧、件数・容量Summary、警告を保持します。
- 各Media項目はAsset ID、original／thumbnail、パス、MIME、容量、SHA-256 checksum、状態を保持します。
- originalの`contentHash`は完全一致識別、Packageの`checksum`は格納Blob検証という別の役割です。
- Blob欠損時はファイルを作らず`missing`としてmanifestへ記録し、Package作成自体は継続します。

## Export

Metadata Storeと`mediaAssetBlobs`を同一read-only IndexedDB Transactionで取得し、Package内で整合したSnapshotを作ります。Blobは1件ずつHash計算してZIPへ追加し、大量並列処理をしません。

処理段階は`snapshot`、`hashing`、`packaging`、`validating`、`ready`です。CancelまたはErrorでは途中Packageを破棄し、自己検証成功前のZIPはダウンロードできません。

## 自己検証

ValidatorはUIとIndexedDBから独立し、後続Restoreでも再利用できる構造です。次を検証します。

- manifest／metadataの存在と対応Version
- path traversal、重複Path、重複Asset＋kind
- included／missingとZIP Entryの一致
- MIME、容量、SHA-256 checksum
- manifest Summaryと実Entry数

ValidatorはZIPを読み取るだけで、端末内データを変更しません。

## UIと安全性

設定では「軽量Backup（記録のみ）」と「完全Backup（写真を含む）」を分離します。完全Backupは初期版では暗号化されないため、個人写真を含むことと共有しない注意を表示します。

## ZIP依存

`@zip.js/zip.js`をZIP Packageの生成・読取に使用します。大容量データ向けの逐次Entry API、無圧縮格納、AbortSignal、Blob入出力を同じ実装で扱え、後続RestoreのValidatorでも再利用できるためです。ほかのZIP・暗号化ライブラリは追加しません。

## 未対応

- 完全Backup ZIPのRestore
- 一時DB、Import Journal、DB全置換
- 暗号化、パスワード、Cloudflare R2同期
- Metadata統合Import、新規プロファイルRestore
