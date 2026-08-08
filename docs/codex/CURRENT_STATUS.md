# Current status

## Last completed

- 旅行記録MVP Phase T1: 訪問場所の日時・滞在記録
- 訪問日と任意の到着・出発時刻を、日付またぎ対応で追加・編集可能
- 現在時刻のワンタップ入力と、旅行詳細・Timeline・TimeMachineへの精度別反映
- 時刻なし旧データとBackup v12を維持し、`00:00`を補わない後方互換
- Latest Phase Commit: `b777c29`

## Current state

- Backup Schema Version: 12
- IndexedDB Version: 10
- Test count: 258
- Working tree: clean after this status update
- Origin difference: `main` is 4 commits ahead of `origin/main`

## Next

- 旅行記録MVP Phase T2候補: 旅行中のクイック訪問記録導線
- 旅行詳細の作品表示を保ちながら、現在地で訪問記録を素早く開始できる入口を整える。
- 今回触らない: GPS自動チェックイン
- 今回触らない: 写真込みBackup Phase 2
- 今回触らない: 移動区間の大規模改修

## Known risks

- 訪問場所の追加フォームは旅行詳細下部の編集領域にあり、旅行中の即時記録にはスクロール量が多い
- 移動区間は訪問場所と同等の日付またぎ日時モデルをまだ持たない
- 旧`visitedAt`だけの記録から正確な到着時刻は復元できない
- 写真込みBackup ZIPのRestore、一時領域、Rollbackは保留中
- Missing Original等の手動復旧、Cloudflare D1／R2同期、Trip削除カスケードは未実装
