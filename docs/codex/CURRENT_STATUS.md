# Current status

## Last completed

- UX監査 P1-1: 完了済み・過去旅行のライブ操作制限
- 旅行日程からライブ記録可否を返す純粋ロジックを追加
- 完了旅行はライブCTAを隠し、日付確認付きの過去記録追記と詳細編集を維持
- Latest Phase Commit: `111b3b2`

## Current state

- Backup Schema Version: 12
- IndexedDB Version: 10
- Test count: 316
- Working tree: clean after this status update
- Origin difference: `main` is 2 commits ahead of `origin/main`

## Next

- 次Phase: UX監査 P1-2 詳細編集への確実な移動
- 「詳細を編集」後に対象フォームへ確実にスクロール・Focusし、操作結果を見失わないようにする。
- 今回触らない: GPS・地図・外部API
- 今回触らない: 写真込みBackup Phase 2
- 今回触らない: Model・DB・Backupの拡張

## Known risks

- 滞在だけを終了できず、「ここを出発」が必ず次の移動区間を作成する
- 詳細編集への自動スクロールが描画時機によって失敗し、保存Errorも編集位置から離れて表示される
- 内蔵ブラウザはService Worker APIを公開しないため、PWA再起動時のfallbackは構成・Build成果物までの確認
- 実機のノッチ／ホームインジケータと、実際の保存失敗からの復帰は未検証
- Tripに明示statusがないため、ライブ可否はローカル日付の開始日・終了日から導出している
