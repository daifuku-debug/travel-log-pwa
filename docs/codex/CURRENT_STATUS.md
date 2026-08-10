# Current status

## Last completed

- 旅行記録MVP Phase T5.5: 現在行動UIのブラウザ検証
- GitHub Pages版で`idle`／`staying`／`moving`の実表示と状態遷移を確認
- 393／430／768／1024pxで横overflowなし、CTA 44px以上、Bottom Navigationと末尾コンテンツの間隔を確認
- 完了済み訪問・移動は「いま」から外れ、Timelineにのみ履歴として残ることを確認
- Latest Phase Commit: `d5eb32b`

## Current state

- Backup Schema Version: 12
- IndexedDB Version: 10
- Test count: 305
- Working tree: clean after this status update
- Origin difference: `main` is 1 commit ahead of `origin/main` after this verification commit

## Next

- 次Phase: T1〜T5.5の実旅行検証
- 統合した「いま」から到着、出発、移動到着、旅先クイック記録を連続操作し、現場での迷いやすさを確認する。
- 今回触らない: GPS・移動の自動検出
- 今回触らない: 写真込みBackup Phase 2
- 今回触らない: 地図・外部API連携

## Known risks

- ローカル開発サーバーは内蔵ブラウザから到達できず最新GitHub Pages版で検証したが、実機のノッチ／ホームインジケータは未検証
- 旧移動データは到着先IDがないため、統合UIではユーザーによる既存場所の明示選択が必要
- 食事・買い物はScrapbookと自動同期せず、一般出費を含む旅行全体の費用集計も未実装
- 写真込みBackup ZIPのRestore、一時領域、Rollbackは保留中
- Missing Original等の手動復旧、Cloudflare D1／R2同期、Trip削除カスケードは未実装
