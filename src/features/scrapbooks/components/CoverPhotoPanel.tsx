import { useRef, useState, type ChangeEvent } from 'react';
import type { EntityId } from '../../../domain/models/common';
import type { MediaAsset } from '../../../domain/models/scrapbook';
import { BottomSheet, Button, InlineError } from '../../../shared/ui';
import type { PendingCoverPhoto } from '../useCoverPhotoImport';
import type { TripDetail } from '../../trips/tripService';
import { TripJournalVisual } from '../../trips/components/TripJournalVisual';
import { ScrapbookMediaImage } from './ScrapbookMediaImage';

export function CoverPhotoPanel({
  selectedPhotoId,
  mediaAssets,
  tripDetail,
  pendingPhoto,
  onSelect,
  onChooseFile,
  onApplyPending,
  onCancelPending,
}: {
  selectedPhotoId?: EntityId;
  mediaAssets: MediaAsset[];
  tripDetail: TripDetail;
  pendingPhoto?: PendingCoverPhoto;
  onSelect: (photoId: EntityId) => void;
  onChooseFile: (file: File) => void;
  onApplyPending: () => void;
  onCancelPending: () => void;
}) {
  const [sourceOpen, setSourceOpen] = useState(false);
  const libraryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const selectedAsset = mediaAssets.find((asset) => asset.id === selectedPhotoId);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setSourceOpen(false);
    onChooseFile(file);
  }

  function openPicker(input: HTMLInputElement | null) {
    setSourceOpen(false);
    input?.click();
  }

  return (
    <section className="scrapbook-cover-panel" aria-labelledby="cover-photo-heading">
      <header className="scrapbook-cover-panel__heading">
        <span>Photo</span>
        <h3 id="cover-photo-heading">この旅の一枚を選ぶ</h3>
        <p>旅行の写真を選ぶか、端末から新しい一枚を追加できます。</p>
      </header>

      <input
        ref={libraryInputRef}
        className="visually-hidden"
        type="file"
        accept="image/*"
        aria-label="写真ライブラリまたはファイルから写真を選ぶ"
        onChange={handleFileChange}
      />
      <input
        ref={cameraInputRef}
        className="visually-hidden"
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="カメラで表紙写真を撮る"
        onChange={handleFileChange}
      />

      <Button variant="primary" onClick={() => setSourceOpen(true)}>写真を追加</Button>

      {pendingPhoto && (
        <div className={`scrapbook-cover-import${pendingPhoto.status === 'error' ? ' has-error' : ''}`}>
          {pendingPhoto.previewUrl && (
            <div className="scrapbook-cover-import__preview">
              <img src={pendingPhoto.previewUrl} alt={`${pendingPhoto.file.name}の追加前プレビュー`} />
              <span>追加前の写真</span>
            </div>
          )}
          <div className="scrapbook-cover-import__details">
            <strong>{pendingPhoto.file.name || '選択した写真'}</strong>
            <span>
              {formatFileSize(pendingPhoto.file.size)}
              {pendingPhoto.width && pendingPhoto.height ? ` · ${pendingPhoto.width} × ${pendingPhoto.height}px` : ''}
            </span>
          </div>
          {pendingPhoto.status === 'validating' && <p className="scrapbook-cover-import__status" role="status">写真を確認しています…</p>}
          {pendingPhoto.error && <InlineError message={pendingPhoto.error} />}
          <div className="scrapbook-cover-import__actions">
            <Button disabled={pendingPhoto.status === 'saving'} onClick={() => setSourceOpen(true)}>別の写真を選ぶ</Button>
            <Button disabled={pendingPhoto.status === 'saving'} onClick={onCancelPending}>キャンセル</Button>
            <Button
              variant="primary"
              loading={pendingPhoto.status === 'saving'}
              disabled={pendingPhoto.status === 'validating' || !pendingPhoto.previewUrl}
              onClick={onApplyPending}
            >
              この写真を使う
            </Button>
          </div>
        </div>
      )}

      {!pendingPhoto && selectedAsset && (
        <div className="scrapbook-cover-editor__current-photo">
          <ScrapbookMediaImage asset={selectedAsset} alt={`${selectedAsset.originalFileName || '旅行写真'}、現在の表紙`} />
          <span>現在の表紙</span>
        </div>
      )}

      {mediaAssets.length > 0 ? (
        <div className="scrapbook-cover-editor__photo-library">
          <h4>写真一覧</h4>
          <div className="scrapbook-cover-editor__photos" role="radiogroup" aria-label="表紙写真">
            {mediaAssets.map((asset) => {
              const selected = selectedPhotoId === asset.id;
              return (
                <button
                  key={asset.id}
                  type="button"
                  className={`scrapbook-cover-editor__photo${selected ? ' is-selected' : ''}`}
                  role="radio"
                  aria-checked={selected}
                  disabled={Boolean(pendingPhoto)}
                  aria-label={`${asset.originalFileName || '旅行写真'}を表紙にする${selected ? '、現在選択中' : ''}`}
                  onClick={() => onSelect(asset.id)}
                >
                  <ScrapbookMediaImage asset={asset} alt="" />
                  {selected && <span>選択中</span>}
                </button>
              );
            })}
          </div>
        </div>
      ) : !pendingPhoto ? (
        <div className="scrapbook-cover-editor__fallback">
          <TripJournalVisual trip={tripDetail.trip} placeNames={tripDetail.places.map((place) => place.name)} alt="" />
          <p>写真がないため、旅の内容から作った表紙を使用しています。</p>
        </div>
      ) : null}

      <BottomSheet
        open={sourceOpen}
        onClose={() => setSourceOpen(false)}
        title="写真を追加"
        description="追加した写真は、この旅行の写真として端末内に保存されます。"
        size="sm"
      >
        <div className="scrapbook-photo-source-actions">
          <Button variant="primary" onClick={() => openPicker(libraryInputRef.current)}>写真を選ぶ</Button>
          <Button onClick={() => openPicker(cameraInputRef.current)}>カメラで撮る</Button>
          <Button variant="ghost" onClick={() => setSourceOpen(false)}>キャンセル</Button>
        </div>
      </BottomSheet>
    </section>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
