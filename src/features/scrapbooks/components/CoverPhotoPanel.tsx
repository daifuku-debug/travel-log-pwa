import type { EntityId } from '../../../domain/models/common';
import type { MediaAsset } from '../../../domain/models/scrapbook';
import type { TripDetail } from '../../trips/tripService';
import { TripJournalVisual } from '../../trips/components/TripJournalVisual';
import { ScrapbookMediaImage } from './ScrapbookMediaImage';

export function CoverPhotoPanel({
  selectedPhotoId,
  mediaAssets,
  tripDetail,
  onSelect,
}: {
  selectedPhotoId?: EntityId;
  mediaAssets: MediaAsset[];
  tripDetail: TripDetail;
  onSelect: (photoId: EntityId) => void;
}) {
  const selectedAsset = mediaAssets.find((asset) => asset.id === selectedPhotoId);

  return (
    <section className="scrapbook-cover-panel" aria-labelledby="cover-photo-heading">
      <header className="scrapbook-cover-panel__heading">
        <span>Photo</span>
        <h3 id="cover-photo-heading">この旅の一枚を選ぶ</h3>
        <p>選んだ写真は、上の完成プレビューへすぐに反映されます。</p>
      </header>

      {selectedAsset && (
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
          <p>写真がないため、旅の内容から作った表紙を使用しています。</p>
        </div>
      )}
    </section>
  );
}
