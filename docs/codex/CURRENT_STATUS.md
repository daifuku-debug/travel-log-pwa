# Current status

## Last completed

- Phase 5-A.2.3-D-C2: 参照ゼロ写真の安全な削除
- 削除直前の永続参照再確認と、参照ゼロ時だけのMetadata論理削除・Blob直接削除を実装
- 参照あり、検索失敗、Metadata失敗、Blob失敗を区別する再試行可能なError設計を追加
- CoverPhotoPanelへ使用状況確認付きの削除導線を追加し、成功時だけ候補一覧を即時更新
- Latest Phase Commit: `cb31364`

## Current state

- Backup Schema Version: 12
- IndexedDB Version: 10
- Test count: 213
- Working tree: clean after this status update
- Origin difference: `main` is 3 commits ahead of `origin/main`

## Next

- Phase 5-A.2.3-D-C3: 参照一覧と明示的な参照解除
- 使用中写真の参照先をユーザーへ示し、確認を伴う明示的な参照解除へ進める。
- 今回触らない: 使用中写真の強制削除
- 今回触らない: Integrity Scan
- 今回触らない: Trip削除カスケード

## Known risks

- 参照付き写真を安全に解除・削除するフローは未実装
- Blob削除失敗後はMetadata論理削除済みとなり、同じAsset IDでの再試行が必要
- JSON Backupは写真Blob本体を含まない
- Orphan Blob／Missing BlobのIntegrity Scanは未実装
- Cloudflare D1／R2同期とTrip削除カスケードは未実装
