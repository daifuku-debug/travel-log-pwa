# Current status

## Last completed

- UX監査 P1-2: 詳細編集への確実な移動
- 訪問・移動・旅先記録をEntity ID付きURLで直接開く編集導線を追加
- 描画後のスクロール、Focus、一時強調とTimeline編集導線を統一
- Latest Phase Commit: `1798322`

## Current state

- Backup Schema Version: 12
- IndexedDB Version: 10
- Test count: 320
- Working tree: clean after this status update
- Origin difference: `main` is 2 commits ahead of `origin/main`

## Next

- 次Phase: UX監査 P1-3 滞在だけを終了できる操作
- 旅の最終地点などで、不要な移動区間を作らず滞在だけを明示的に終了できるようにする。
- 今回触らない: GPS・地図・外部API
- 今回触らない: 写真込みBackup Phase 2
- 今回触らない: Model・DB・Backupの拡張

## Known risks

- 滞在だけを終了できず、「ここを出発」が必ず次の移動区間を作成する
- 詳細Editorの保存Errorは編集位置ではなくページ上部に表示される
- 内蔵ブラウザはService Worker APIを公開しないため、PWA再起動時のfallbackは構成・Build成果物までの確認
- 実機のノッチ／ホームインジケータと、実際の保存失敗からの復帰は未検証
- Tripに明示statusがないため、ライブ可否はローカル日付の開始日・終了日から導出している
