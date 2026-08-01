# Current status

## Last completed

- Phase 5-A.2.3-D-C1: MediaAsset参照検索基盤
- 表紙、旧表紙、ハイライト、写真参照Blockから永続参照を抽出
- 論理削除を除外し、安定順と参照サマリーを返すUI非依存Serviceを追加
- Repository取得失敗を参照ゼロと区別する安全側のError処理を追加
- Latest Phase Commit: `bc3ebaf`

## Current state

- Backup Schema Version: 12
- IndexedDB Version: 10
- Test count: 206
- Working tree: clean after this verification commit
- Origin difference: `main` is 1 commit ahead of `origin/main`

## Next

- Phase 5-A.2.3-D-C2: 参照ゼロ写真の安全な削除
- 参照検索が成功し、永続参照が0件のMediaAssetだけをmetadataとBlobの両方から安全に削除する。
- 今回触らない: 参照付き写真の自動解除
- 今回触らない: Integrity Scan
- 今回触らない: Trip削除カスケード

## Known risks

- 写真削除UIと削除Serviceは未実装
- 参照付き写真を安全に解除・削除するフローは未実装
- JSON Backupは写真Blob本体を含まない
- Orphan Blob／Missing BlobのIntegrity Scanは未実装
- Cloudflare D1／R2同期とTrip削除カスケードは未実装
