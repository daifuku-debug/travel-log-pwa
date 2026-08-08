# Current status

## Last completed

- 旅行記録MVP Phase T3: クイック移動区間記録
- 現在時刻または直前の訪問出発から移動を開始し、未到着区間を「移動中」として復元
- 「今到着」、日付またぎ、未確定到着地、詳細編集、Timeline即時反映に対応
- Latest Phase Commit: `4e3d4db`

## Current state

- Backup Schema Version: 12
- IndexedDB Version: 10
- Test count: 273
- Working tree: clean after this status update
- Origin difference: `main` is 2 commits ahead of `origin/main`

## Next

- 旅行記録MVP Phase T4候補: 訪問到着と移動到着の明示連携
- 移動中に次の訪問場所へ到着した際、ユーザー確認のうえ両方の到着記録を一度の導線で整合させる。
- 今回触らない: GPS・移動の自動検出
- 今回触らない: 写真込みBackup Phase 2
- 今回触らない: PlaceVisitと移動区間の自動書換え

## Known risks

- PlaceVisitとTripTransportLegは名前・時刻候補でつながるだけで、永続的な相互参照IDを持たない
- 訪問到着と移動到着は別操作のため、片方だけ記録した状態が残り得る
- 複数タブから同時操作した場合、移動中1件の確認と保存は単一Transactionではない
- 写真込みBackup ZIPのRestore、一時領域、Rollbackは保留中
- Missing Original等の手動復旧、Cloudflare D1／R2同期、Trip削除カスケードは未実装
