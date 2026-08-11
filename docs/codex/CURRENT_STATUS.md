# Current status

## Last completed

- UX監査 P1-3: 滞在だけを終了できる操作
- 「ここを出発」で移動開始と滞在だけ終了を明示選択できるUIを追加
- 滞在だけ終了は時刻・競合を再検証しPlaceVisitだけを更新
- Latest Phase Commit: `4182f72`

## Current state

- Backup Schema Version: 12
- IndexedDB Version: 10
- Test count: 324
- Working tree: clean after this status update
- Origin difference: `main` is 2 commits ahead of `origin/main`

## Next

- 次Phase: UX監査 P2-1 詳細Editorの保存Error表示
- 詳細Editorの保存失敗を入力位置で表示し、内容を維持したまま再試行できるようにする。
- 今回触らない: GPS・地図・外部API
- 今回触らない: 写真込みBackup Phase 2
- 今回触らない: Model・DB・Backupの拡張

## Known risks

- 詳細Editorの保存Errorは編集位置ではなくページ上部に表示される
- 内蔵ブラウザはService Worker APIを公開しないため、PWA再起動時のfallbackは構成・Build成果物までの確認
- 実機のノッチ／ホームインジケータと、実際の保存失敗からの復帰は未検証
- Tripに明示statusがないため、ライブ可否はローカル日付の開始日・終了日から導出している
