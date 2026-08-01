# MediaAsset Spec

現在の写真保存・分類・重複検出・参照検索・整合性診断の仕様です。層の責務は[Architecture](ARCHITECTURE.md)、今後の作業順は[Roadmap](ROADMAP.md)を参照してください。

## モデル

`MediaAsset`は写真metadataで、主なフィールドは次のとおりです。

| フィールド | 現在の用途 |
|---|---|
| `id` | Asset ID |
| `tripId` | 所属旅行 |
| `usage` | `trip`または`cover-only`。未設定・不正値は`trip`へ正規化 |
| `ownerScrapbookId` | `cover-only`の所有Scrapbook。`trip`では保持しない |
| `contentHash` | 原本BlobのSHA-256完全一致Hash |
| `localReference` | original Blob ID |
| `thumbnailReference` | thumbnail Blob ID |
| `storageType` | 現在は主に`local` |
| `mimeType`、`width`、`height`、`fileSize` | 画像metadata |

`MediaAssetUsage`は`'trip' | 'cover-only'`です。`cover-only`に有効な所有先がないImportデータは安全側で`trip`へ戻し、新規保存時はErrorにします。

## 用途

### trip

通常旅行写真として、旅行ギャラリー、写真件数、写真Block候補、TimeMachine、Scrapbook表紙で利用できます。

### cover-only

所有Scrapbookの表紙候補です。通常ギャラリー、通常写真件数、本文Block候補、TimeMachineから除外します。表紙として選択中であれば、Scrapbookの表紙Heroやその派生表示では利用できます。別Scrapbook所有の素材は候補へ出しません。

## 保存フロー

```text
容量・形式検証
→ 画像デコード
→ 原本FileのSHA-256
→ thumbnail生成
→ original Blob保存
→ thumbnail Blob保存
→ MediaAsset metadata保存
```

- 現在の最大ファイルサイズは12MBです。
- JPEG、PNG、WebPを通常対応し、HEIC／HEIFはブラウザでデコードできない場合に明示Errorを返します。
- Hashまたは画像処理に失敗した場合はBlob保存へ進みません。
- 部分保存に失敗した場合は対象AssetのBlobを補償削除し、metadata保存開始後はmetadataも論理削除します。元の保存Errorを優先し、清掃Errorは別に保持します。

## Blob

`mediaAssetBlobs` Storeへoriginalとthumbnailを分離して保存します。

```text
${assetId}:original
${assetId}:thumbnail
```

削除は2キーだけを同一IndexedDB Transactionで直接削除します。Store全体の`clear`、対象外Blobの読込・再保存は禁止です。存在しないキーの削除は冪等に成功します。

## 完全一致重複

- 原本FileのSHA-256を使い、`sha256:<64 lowercase hex>`形式で保存します。
- 同じTripの`trip`写真と、現在のScrapbookが所有する`cover-only`を線形検索します。
- 別Scrapbook所有の`cover-only`、論理削除済みAsset、original Blobがない未Hash Assetは候補から除外します。
- 候補順は`trip`を先にし、その後に所有中の`cover-only`、同用途内では新しい写真を優先します。
- UIでは既存写真の再利用を主要操作とし、明示的な新規追加も可能です。再利用時に用途や所有先は変更しません。
- Perceptual Hashや再圧縮・編集済み画像の類似判定には対応していません。

## 永続参照検索

現在、次の永続フィールドをUI非依存Serviceで検索できます。

- `Scrapbook.coverSettings.photoId`
- 旧互換の`Scrapbook.coverAssetId`
- `Scrapbook.highlightPhotoIds[]`
- Photo／Ticket Blockの`assetId`
- PhotoGrid／Meal／Purchase Blockの`assetIds[]`

論理削除済みScrapbook／Page／Blockと、Home、TimeMachine、Draft、Pending Fileなどの派生・一時参照は含みません。取得失敗はErrorとし、参照ゼロと区別します。

参照一覧では表紙、旧表紙、ハイライト、Page／Blockを区別し、同一Block配列内の重複は件数付きでまとめます。表紙の新旧参照、ハイライト、PhotoGrid／Meal／Purchase配列、任意のTicket写真だけをユーザーの明示選択後に解除できます。写真必須のPhotoBlockは自動解除しません。更新前後に参照を再検索し、参照ゼロになった後だけmetadata論理削除とBlob直接削除を別操作で実行します。

## Integrity Scan

`scanMediaAssetIntegrity`はMediaAsset、Blob、Scrapbook、Page、Blockの生レコードを各Storeから1回ずつ読み、データを書き換えずに次を診断します。

- Orphan Blob、不正形式Blob ID、Missing original／thumbnail、Cleanup Pending
- `localReference`／`thumbnailReference`と決定的Blob IDの不一致
- 不正な`contentHash`形式
- `cover-only`のowner欠損、不存在、論理削除、Trip不一致
- 存在しない、または論理削除済みAssetへの永続参照
- 論理削除済み、または所有元が欠損したPage／Block／Scrapbook内の写真参照

未参照の`trip`写真と未使用の`cover-only`素材は正常です。JSON Backup復元後のMissing Blobも報告しますが、削除可能とは判定しません。一部Storeでも取得に失敗した場合はReportを返さず、部分失敗と完全失敗を区別したErrorにします。設定画面の「写真データ診断」から明示実行し、起動時やBackup前には自動実行しません。

安全に再検証できる次のIssueだけを、ユーザー操作後に修復できます。

- Missing Thumbnail: original Blobから既存画像処理で再生成し、失敗時はMetadataを変更しない
- Cleanup Pending: MediaAssetの論理削除を再確認して決定的な2 Blobキーだけを削除
- Orphan／不正形式Blob: Metadataや有効参照がないことを再確認し、Confirm後に対象キーだけを削除
- Invalid Blob Reference: 既定キーの実Blobと古い参照値を再確認してMetadata参照だけを更新

各処理は`success`／`skipped`／`failed`を区別し、処理後に必ず再Scanします。Missing Original、Dangling Reference、Invalid Cover Owner、Scrapbook／Block参照は表示のみです。

## Backup

- 現在のJSON Backup Schemaは**v12**、IndexedDB Versionは**10**です。
- BackupはMediaAsset metadata、`usage`、所有先、正常な`contentHash`を含みます。
- 写真Blob本体は含みません。復元後にBlobがない場合は既存Fallbackを使用します。
- v11以前のBackupはHashなしで読み込め、用途のない旧MediaAssetは`trip`として扱います。未知の将来Versionは拒否します。
- 完全Backup Package v1は、同じv12 Metadataとoriginal／thumbnail BlobをZIPへ格納し、Blob単位のSHA-256で自己検証します。欠損Blobは削除せずmanifestの警告へ残します。
- 完全Backup ZIPのRestoreは未実装です。詳細は[Backup Spec](BACKUP_SPEC.md)を参照してください。

## 未対応

- Missing Original、Dangling Reference、Invalid Cover Ownerの安全な手動復旧
- 複数Repositoryをまたぐ参照解除の一括Transaction
- Trip／Scrapbook削除時のMediaAssetカスケード
- 写真Blobを含むBackupのRestore
- Cloudflare R2同期
- Perceptual Hash、類似画像検出
