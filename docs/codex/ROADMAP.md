# Roadmap

現在のスクラップブック／MediaAsset周辺の進行状況です。仕様は[Media Asset Spec](MEDIA_ASSET_SPEC.md)、全体像は[Project Context](PROJECT_CONTEXT.md)を参照してください。

| Phase | 状態 | 到達点 |
|---|---|---|
| Phase 5-A.2.3-B | 完了 | 端末写真の検証、一時プレビュー、旅行写真としての保存、表紙Draft適用 |
| Phase 5-A.2.3-C | 完了 | `trip`／`cover-only`用途、所有Scrapbook、保存先選択、表示除外 |
| Phase 5-A.2.3-D-B0 | 完了 | original／thumbnail Blobの2キー直接削除と補償削除の安全化 |
| Phase 5-A.2.3-D-B1 | 完了 | 原本SHA-256、`contentHash`、完全一致検索、Backup v12 |
| Phase 5-A.2.3-D-B2 | 完了 | 完全一致重複確認、既存写真再利用、明示的新規追加 |
| Phase 5-A.2.3-D-C1 | 完了 | MediaAssetの永続参照検索と参照サマリー |
| Phase 5-A.2.3-D-C2 | 次 | 参照ゼロ写真だけを対象にした安全なmetadata＋Blob削除 |
| Phase 5-A.2.3-D-C3 | 未着手 | 参照一覧UI、明示的な参照解除、使用中写真の削除方針 |
| Phase 5-A.2.3-D-D | 未着手 | Integrity Scan、Orphan Blob検出、Missing thumbnail修復 |
| Trip削除カスケード | 別系統 | Trip、Scrapbook、Page、Block、MediaAsset、Blobの整合した削除 |
| 写真込みBackup／R2同期 | 別系統 | Blobを含む復元可能なBackupとCloudflare同期 |

次Phaseでは、参照検索が成功し`references.length === 0`である写真だけを削除対象とし、参照付き写真の自動解除、Integrity Scan、Trip削除カスケードを混ぜません。
