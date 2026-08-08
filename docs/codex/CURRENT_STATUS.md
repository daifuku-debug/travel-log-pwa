# Current status

## Last completed

- 旅行記録MVP Phase T2: クイック訪問記録
- 場所名だけで現在時刻の到着を保存し、Timelineへ即時反映
- 滞在中の明示、現在時刻での出発、滞在終了、既存詳細編集への接続
- クイック導線では同時滞在を防ぎ、既存の滞在を自動終了しない
- Latest Phase Commit: `5327ead`

## Current state

- Backup Schema Version: 12
- IndexedDB Version: 10
- Test count: 264
- Working tree: clean after this status update
- Origin difference: `main` is 2 commits ahead of `origin/main`

## Next

- 旅行記録MVP Phase T3候補: クイック移動区間記録
- 出発地点から次の訪問場所までの移動を、現在時刻と最小項目で記録できる導線を検討する。
- 今回触らない: GPS・移動の自動検出
- 今回触らない: 写真込みBackup Phase 2
- 今回触らない: 既存移動モデルの全面変更

## Known risks

- 詳細フォームからは複数の到着のみ記録を作成でき、クイック導線では全件の出発完了まで次の到着を開始できない
- 複数タブから同時操作した場合、滞在中1件の確認と保存は単一Transactionではない
- 移動区間は訪問場所と同等の日付またぎ日時モデルをまだ持たない
- 写真込みBackup ZIPのRestore、一時領域、Rollbackは保留中
- Missing Original等の手動復旧、Cloudflare D1／R2同期、Trip削除カスケードは未実装
