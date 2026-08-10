# Current status

## Last completed

- 旅行記録MVP T1-T5.5 通しUX監査
- 到着、滞在、旅先記録、出発、移動、次の到着、日付またぎ、再読み込みを連続操作
- P0 1件、P1 3件、P2 3件を[監査レポート](T1_T5_5_UX_AUDIT.md)へ記録
- Latest App Commit: `66becd1`

## Current state

- Backup Schema Version: 12
- IndexedDB Version: 10
- Test count: 305
- Working tree: clean after the audit documentation commit
- Origin difference: `main` is 1 documentation commit ahead of `origin/main`

## Next

- 次Phase: T1-T5.5 UX監査のP0/P1修正
- GitHub Pagesの再読み込み復旧を最優先に、完了済み旅行のライブ操作制限と現在状態の終了フローを安全に整える。
- 今回触らない: GPS・地図・外部API
- 今回触らない: 写真込みBackup Phase 2
- 今回触らない: Model・DB・Backupの拡張

## Known risks

- GitHub Pagesのnested routeを再読み込みすると404になり、旅行中の復帰導線が途切れる
- 完了済み・過去旅行でも現在時刻の訪問・移動を記録でき、旅行期間外データが入る
- 滞在だけを終了できず、「ここを出発」が必ず次の移動区間を作成する
- 詳細編集への自動スクロールが描画時機によって失敗し、保存Errorも編集位置から離れて表示される
- 実機のノッチ／ホームインジケータと、実際の保存失敗からの復帰は未検証
