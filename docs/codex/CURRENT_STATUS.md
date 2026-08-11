# Current status

## Last completed

- UX監査 P2-1: 詳細Editorの保存Error表示
- 訪問・移動・旅先記録の保存失敗を各Editor内へ表示
- 入力・dirty状態・編集URLを維持し、共通文言で再試行可能にした
- Latest Phase Commit: `3ab6c0c`

## Current state

- Backup Schema Version: 12
- IndexedDB Version: 10
- Test count: 328
- Working tree: clean after this status update
- Origin difference: `main` is 4 commits ahead of `origin/main`

## Next

- 次Phase: UX監査 P2-2 移動中CTAの文言統一
- 移動中の到着操作が現在時刻を記録することを、既存フローを変えず明確にする。
- 今回触らない: GPS・地図・外部API
- 今回触らない: 写真込みBackup Phase 2
- 今回触らない: Model・DB・Backupの拡張

## Known risks

- 内蔵ブラウザはService Worker APIを公開しないため、PWA再起動時のfallbackは構成・Build成果物までの確認
- 実機のノッチ／ホームインジケータと、端末DBを強制障害にした保存失敗からの復帰は未検証
- Tripに明示statusがないため、ライブ可否はローカル日付の開始日・終了日から導出している
