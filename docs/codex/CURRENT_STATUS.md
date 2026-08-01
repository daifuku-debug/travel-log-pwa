# Current status

## Last completed

- 写真込みBackup Phase 1: ZIP Package Exportと自己検証
- v12 Metadataとoriginal／thumbnail BlobをPackage v1 ZIPへ格納
- SHA-256、Path、MIME、容量、Summaryを自己検証し、成功後だけダウンロード可能
- 軽量JSON Backupを維持し、設定画面で完全Backupと明確に分離
- Latest Phase Commit: `d80f975`

## Current state

- Backup Schema Version: 12
- IndexedDB Version: 10
- Test count: 251
- Working tree: clean after this status update
- Origin difference: `main` is 2 commits ahead of `origin/main`

## Next

- 写真込みBackup Phase 2: 検証済みZIPの安全なRestore
- 復元前Preview、一時領域、原子的な全置換、復元後Integrity Scanを実装する。
- 今回触らない: Metadataの統合Import
- 今回触らない: Cloudflare R2同期
- 今回触らない: Trip削除カスケード

## Known risks

- 完全Backup ZIPのRestore、一時領域、Rollbackは未実装
- ZIP生成結果は最終Blobとしてメモリに保持するため、大量写真時のiOS Safari負荷が残る
- 完全Backupは非暗号化で、個人写真を含むファイルの管理をユーザーへ委ねる
- 作成時点でMissing Blobがある場合は警告付きPackageとなり、写真自体は復元できない
- Missing Original等の手動復旧、Cloudflare D1／R2同期、Trip削除カスケードは未実装
