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
  const sourcePrimaryActionRef = useRef<HTMLButtonElement>(null);
  const selectedAsset = mediaAssets.find((asset) => asset.id === selectedPhotoId);
  const isBusy = pendingPhoto?.status === 'validating' || pendingPhoto?.status === 'saving';
  const canApplyPending = Boolean(pendingPhoto?.previewUrl) && pendingPhoto?.status !== 'validating';
  const isSaveError = pendingPhoto?.status === 'error' && Boolean(pendingPhoto.previewUrl);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    setSourceOpen(false);
    onChooseFile(file);
  }

  function openPicker(input: HTMLInputElement | null) {
    input?.click();
    setSourceOpen(false);
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
        className="scrapbook-cover-photo-input"
        type="file"
        accept="image/*"
        aria-label="写真ライブラリまたはファイルから写真を選ぶ"
        aria-hidden="true"
        tabIndex={-1}
        onChange={handleFileChange}
      />
      <input
        ref={cameraInputRef}
        className="scrapbook-cover-photo-input"
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="カメラで表紙写真を撮る"
        aria-hidden="true"
        tabIndex={-1}
        onChange={handleFileChange}
      />

      {pendingPhoto ? (
        <div
          className={`scrapbook-cover-import${pendingPhoto.status === 'error' ? ' has-error' : ''}`}
          aria-busy={isBusy || undefined}
        >
          <div className="scrapbook-cover-import__heading">
            <span>追加前の写真</span>
            <p>この写真を旅行へ保存し、表紙の候補として使います。</p>
          </div>
          {pendingPhoto.previewUrl && (
            <div className="scrapbook-cover-import__preview">
              <img src={pendingPhoto.previewUrl} alt={`${pendingPhoto.file.name}の追加前プレビュー`} />
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
          {pendingPhoto.status === 'saving' && <p className="scrapbook-cover-import__status" role="status">写真を保存しています…</p>}
          {pendingPhoto.error && <InlineError message={pendingPhoto.error} />}
          <div className="scrapbook-cover-import__actions">
            <Button
              variant="primary"
              loading={pendingPhoto.status === 'saving'}
              disabled={!canApplyPending}
              onClick={onApplyPending}
            >
              {isSaveError ? 'もう一度試す' : pendingPhoto.status === 'saving' ? '写真を保存しています' : 'この写真を使う'}
            </Button>
            <Button disabled={isBusy} onClick={() => setSourceOpen(true)}>別の写真を選ぶ</Button>
            <Button variant="ghost" disabled={isBusy} onClick={onCancelPending}>キャンセル</Button>
          </div>
        </div>
      ) : (
        <div className="scrapbook-cover-photo-library">
          <Button variant="primary" onClick={() => setSourceOpen(true)}>新しい写真を追加</Button>

          {selectedAsset && (
            <div className="scrapbook-cover-editor__current-photo">
              <ScrapbookMediaImage asset={selectedAsset} alt={`${selectedAsset.originalFileName || '旅行写真'}、現在の表紙`} />
              <span>現在の表紙</span>
            </div>
          )}

          {mediaAssets.length > 0 ? (
            <div className="scrapbook-cover-editor__photo-library">
              <h4>旅行の写真</h4>
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
          ) : (
            <div className="scrapbook-cover-editor__fallback">
              <TripJournalVisual trip={tripDetail.trip} placeNames={tripDetail.places.map((place) => place.name)} alt="" />
              <p>まだ旅行写真がありません。端末の写真を追加するか、旅の内容から作った表紙を使用できます。</p>
            </div>
          )}
        </div>
      )}

      <BottomSheet
        open={sourceOpen}
        onClose={() => setSourceOpen(false)}
        title="写真を追加"
        description="追加した写真は、この旅行の写真として端末内に保存されます。"
        size="sm"
        initialFocusRef={sourcePrimaryActionRef}
      >
        <div className="scrapbook-photo-source-actions">
          <Button ref={sourcePrimaryActionRef} variant="primary" onClick={() => openPicker(libraryInputRef.current)}>写真を選ぶ</Button>
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
