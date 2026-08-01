import type { EntityId } from '../../../domain/models/common';
import type { MediaAsset } from '../../../domain/models/scrapbook';
import { isCoverOnlyMediaAsset } from '../../../domain/media/mediaAssetUsage';
import { Button } from '../../../shared/ui';
import type { PendingCoverPhoto } from '../useCoverPhotoImport';
import { ScrapbookMediaImage } from './ScrapbookMediaImage';

export function DuplicatePhotoReview({
  pendingPhoto,
  onSelectDuplicate,
  onReuseDuplicate,
  onAddNew,
  onCancel,
}: {
  pendingPhoto: PendingCoverPhoto;
  onSelectDuplicate: (assetId: EntityId) => void;
  onReuseDuplicate: () => void;
  onAddNew: () => void;
  onCancel: () => void;
}) {
  const selectedAsset = pendingPhoto.duplicateMatches.find(
    (asset) => asset.id === pendingPhoto.selectedDuplicateAssetId,
  ) ?? pendingPhoto.duplicateMatches[0];

  return (
    <section className="scrapbook-duplicate-review" aria-live="polite" aria-labelledby="duplicate-photo-heading">
      <header className="scrapbook-duplicate-review__heading">
        <span>Exact match</span>
        <h4 id="duplicate-photo-heading">同じ写真がすでに保存されています</h4>
        <p>既存の写真を使うと、同じ画像を増やさずに表紙へ設定できます。</p>
      </header>

      <div className="scrapbook-duplicate-review__comparison">
        <section aria-labelledby="existing-photo-heading">
          <h5 id="existing-photo-heading">既存の写真</h5>
          {selectedAsset && (
            <div className="scrapbook-duplicate-review__selected">
              <ScrapbookMediaImage
                asset={selectedAsset}
                alt={`${selectedAsset.originalFileName || '保存済み写真'}のプレビュー`}
              />
              <div>
                <strong>{selectedAsset.originalFileName || '保存済み写真'}</strong>
                <span>{isCoverOnlyMediaAsset(selectedAsset) ? '表紙専用' : '旅行写真'}</span>
                <small>{formatSavedDate(selectedAsset.createdAt)}</small>
              </div>
              {isCoverOnlyMediaAsset(selectedAsset) && (
                <span className="scrapbook-cover-editor__usage-badge">表紙専用</span>
              )}
            </div>
          )}
        </section>

        <section aria-labelledby="pending-photo-heading">
          <h5 id="pending-photo-heading">今回選んだ写真</h5>
          <div className="scrapbook-duplicate-review__pending">
            {pendingPhoto.previewUrl && (
              <img src={pendingPhoto.previewUrl} alt={`${pendingPhoto.file.name}の追加前プレビュー`} />
            )}
            <div>
              <strong>{pendingPhoto.file.name || '選択した写真'}</strong>
              <span>
                {formatFileSize(pendingPhoto.file.size)}
                {pendingPhoto.width && pendingPhoto.height
                  ? ` · ${pendingPhoto.width} × ${pendingPhoto.height}px`
                  : ''}
              </span>
            </div>
          </div>
        </section>
      </div>

      {pendingPhoto.duplicateMatches.length > 1 && (
        <fieldset className="scrapbook-duplicate-review__candidates">
          <legend>使用する既存写真</legend>
          <div role="radiogroup" aria-label="完全一致した既存写真">
            {pendingPhoto.duplicateMatches.map((asset) => {
              const selected = asset.id === selectedAsset?.id;
              return (
                <button
                  key={asset.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={`${asset.originalFileName || '保存済み写真'}、${isCoverOnlyMediaAsset(asset) ? '表紙専用' : '旅行写真'}${selected ? '、選択中' : ''}`}
                  className={selected ? 'is-selected' : ''}
                  onClick={() => onSelectDuplicate(asset.id)}
                >
                  <ScrapbookMediaImage asset={asset} alt="" />
                  <span>{isCoverOnlyMediaAsset(asset) ? '表紙専用' : '旅行写真'}</span>
                  {selected && <strong>選択中</strong>}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="scrapbook-duplicate-review__actions">
        <Button variant="primary" disabled={!selectedAsset} onClick={onReuseDuplicate}>既存写真を使う</Button>
        <Button onClick={onAddNew}>新しく追加する</Button>
        <Button variant="ghost" onClick={onCancel}>キャンセル</Button>
      </div>
    </section>
  );
}

function formatSavedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} 保存`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
