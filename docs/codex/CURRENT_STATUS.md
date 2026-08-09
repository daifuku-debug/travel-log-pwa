# Current status

## Last completed

- 旅行記録MVP Phase T5.5: 現在行動UIの統合
- `idle`／`staying`／`moving`／矛盾状態を純粋判定し、旅行詳細の現在行動を一つのセクションへ統合
- 滞在終了＋移動開始、および移動終了＋訪問到着を同一時刻・明示操作で安全に連携
- Latest Phase Commit: `d5eb32b`

## Current state

- Backup Schema Version: 12
- IndexedDB Version: 10
- Test count: 305
- Working tree: clean after this status update
- Origin difference: `main` is 1 commit ahead of `origin/main` before this status commit

## Next

- 次Phase: T1〜T5.5の実旅行検証
- 統合した「いま」から到着、出発、移動到着、旅先クイック記録を連続操作し、現場での迷いやすさを確認する。
- 今回触らない: GPS・移動の自動検出
- 今回触らない: 写真込みBackup Phase 2
- 今回触らない: 地図・外部API連携

## Known risks

- 内蔵ブラウザからローカル開発サーバーへ接続できず、T5.5の4幅目視確認とスクリーンショットは未取得
- 旧移動データは到着先IDがないため、統合UIではユーザーによる既存場所の明示選択が必要
- 食事・買い物は旅行中記録をManualTimelineEntryへ保存し、Scrapbookの表示Blockとは自動同期しない
- 一般出費は交通費集計と分離しており、旅行全体の費用集計は未実装
- 写真込みBackup ZIPのRestore、一時領域、Rollbackは保留中
- Missing Original等の手動復旧、Cloudflare D1／R2同期、Trip削除カスケードは未実装
