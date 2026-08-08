# Current status

## Last completed

- 旅行記録MVP Phase T4: 訪問到着と移動到着の明示連携
- 移動と既存訪問の到着を、確認後に同一timestamp・同一IndexedDB Transactionで更新
- 未登録到着地の明示追加と、クイック訪問から未完了移動への逆方向確認に対応
- Latest Phase Commit: `a964aff`

## Current state

- Backup Schema Version: 12
- IndexedDB Version: 10
- Test count: 284
- Working tree: clean after this status update
- Origin difference: `main` is 2 commits ahead of `origin/main`

## Next

- 次Phase: 未定（T1〜T4の実旅行検証後に決定）
- 実際の旅行中操作で、訪問・移動の開始から到着連携までの迷いやすさと失敗復帰を確認する。
- 今回触らない: GPS・移動の自動検出
- 今回触らない: 写真込みBackup Phase 2
- 今回触らない: 地図・外部API連携

## Known risks

- 旧移動データは到着先IDがないため、同一Trip内の単一・完全同名の訪問だけを確認候補にできる
- 詳細移動編集で到着地名を変更すると安全側で連携IDを解除するため、再連携にはクイック導線か個別確認が必要
- 訪問EXPなどの派生更新は到着記録の2 Store Transaction完了後であり、派生処理失敗時の表示は今後整理が必要
- 写真込みBackup ZIPのRestore、一時領域、Rollbackは保留中
- Missing Original等の手動復旧、Cloudflare D1／R2同期、Trip削除カスケードは未実装
