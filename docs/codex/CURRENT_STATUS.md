# Current status

## Last completed

- 旅行記録MVP Phase T5: 旅先クイック記録
- 食事、買い物、メモ、出費を現在日時と任意の訪問場所で保存
- 旅行詳細での後編集、Timeline・TimeMachineへの時系列表示、Backup v12互換に対応
- Latest Phase Commit: `55f12ad`

## Current state

- Backup Schema Version: 12
- IndexedDB Version: 10
- Test count: 291
- Working tree: clean after this status update
- Origin difference: `main` is 1 commit ahead of `origin/main` before this status commit

## Next

- 次Phase: 未定（T1〜T5の実旅行検証後に決定）
- 実際の旅行中操作で、訪問・移動・食事・買い物・メモ・出費を連続記録した際の迷いやすさを確認する。
- 今回触らない: GPS・移動の自動検出
- 今回触らない: 写真込みBackup Phase 2
- 今回触らない: 地図・外部API連携

## Known risks

- 旧移動データは到着先IDがないため、同一Trip内の単一・完全同名の訪問だけを確認候補にできる
- 詳細移動編集で到着地名を変更すると安全側で連携IDを解除するため、再連携にはクイック導線か個別確認が必要
- 食事・買い物は旅行中記録をManualTimelineEntryへ保存し、Scrapbookの表示Blockとは自動同期しない
- 一般出費は交通費集計と分離しており、旅行全体の費用集計は未実装
- 写真込みBackup ZIPのRestore、一時領域、Rollbackは保留中
- Missing Original等の手動復旧、Cloudflare D1／R2同期、Trip削除カスケードは未実装
