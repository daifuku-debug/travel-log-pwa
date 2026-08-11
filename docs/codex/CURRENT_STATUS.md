# Current status

## Last completed

- UX監査 P0-1: GitHub Pagesの再読み込み404修正
- 既知のReact Router Routeだけを復元する`404.html`と共有SPA fallbackを追加
- Service Worker v4で深いRouteの404をApp Shellへ戻し、asset・API系パスを除外
- Latest Phase Commit: `52d2314`

## Current state

- Backup Schema Version: 12
- IndexedDB Version: 10
- Test count: 312
- Working tree: clean after this status update
- Origin difference: `main` is 2 commits ahead of `origin/main`

## Next

- 次Phase: UX監査 P1-1 完了済み・過去旅行のライブ操作制限
- 旅行期間外の現在時刻記録を防ぎ、過去旅行では履歴編集を主導線にする。
- 今回触らない: GPS・地図・外部API
- 今回触らない: 写真込みBackup Phase 2
- 今回触らない: Model・DB・Backupの拡張

## Known risks

- 完了済み・過去旅行でも現在時刻の訪問・移動を記録でき、旅行期間外データが入る
- 滞在だけを終了できず、「ここを出発」が必ず次の移動区間を作成する
- 詳細編集への自動スクロールが描画時機によって失敗し、保存Errorも編集位置から離れて表示される
- 内蔵ブラウザはService Worker APIを公開しないため、PWA再起動時のfallbackは構成・Build成果物までの確認
- 実機のノッチ／ホームインジケータと、実際の保存失敗からの復帰は未検証
