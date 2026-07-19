import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { MediaAsset, ScrapbookBlock } from '../../../domain/models/scrapbook';
import type { TripDetail } from '../../trips/tripService';
import { TripJournalTimeline } from '../../trips/components/TripJournalTimeline';
import { TripJournalVisual } from '../../trips/components/TripJournalVisual';
import { formatCompactDateRange, isoDateTimeToDateInput } from '../../../shared/date/dateUtils';
import type { ScrapbookDetail } from '../scrapbookService';
import { ScrapbookMediaImage } from './ScrapbookMediaImage';

export function ScrapbookViewer({
  detail,
  tripDetail,
  onEdit,
}: {
  detail: ScrapbookDetail;
  tripDetail: TripDetail;
  onEdit: () => void;
}) {
  const { scrapbook, mediaAssets } = detail;
  const pages = detail.pages.filter((page) => !page.isHidden);
  const blocks = pages.flatMap((page) => page.blocks.filter((block) => !block.isHidden));
  const assetsById = new Map(mediaAssets.map((asset) => [asset.id, asset]));
  const coverAsset = resolveCoverAsset(detail, assetsById);
  const photoBlocks = blocks.filter((block): block is Extract<ScrapbookBlock, { type: 'photo' | 'photo_grid' }> => block.type === 'photo' || block.type === 'photo_grid');
  const storyBlocks = blocks.filter(isStoryBlock);
  const placeBlocks = blocks.filter((block): block is Extract<ScrapbookBlock, { type: 'place' }> => block.type === 'place');
  const photoCount = new Set(photoBlocks.flatMap((block) => block.type === 'photo' ? [block.assetId] : block.assetIds)).size;
  const castleCount = tripDetail.places.filter((place) => place.castleId).length;
  const layout = scrapbook.layoutVariant || scrapbook.coverSettings?.layout || scrapbook.coverLayout;

  return (
    <article className={`scrapbook-viewer scrapbook-viewer--${scrapbook.themeId} scrapbook-viewer--layout-${toClassName(layout)}`}>
      <ScrapbookMagazineCover
        detail={detail}
        tripDetail={tripDetail}
        coverAsset={coverAsset}
        onEdit={onEdit}
      />

      <div className="scrapbook-viewer__paper">
        <ScrapbookSection eyebrow="Story" title="旅のはじまり" className="scrapbook-viewer__story">
          <p className="scrapbook-viewer__lead">{buildStoryLead(detail, tripDetail, storyBlocks)}</p>
          {storyBlocks.map((block) => <StoryBlock key={block.id} block={block} />)}
        </ScrapbookSection>

        <ScrapbookSection eyebrow="Journey" title="旅の流れ" className="scrapbook-viewer__timeline">
          <TripJournalTimeline places={tripDetail.places} transportLegs={tripDetail.transportLegs} />
        </ScrapbookSection>

        <ScrapbookSection eyebrow="Scenes" title="旅の景色" className="scrapbook-viewer__photos">
          {photoBlocks.length > 0 ? (
            <div className="scrapbook-viewer__photo-sequence">
              {photoBlocks.map((block, index) => (
                <PhotoStory key={block.id} block={block} index={index} assetsById={assetsById} />
              ))}
            </div>
          ) : (
            <div className="scrapbook-viewer__photo-fallback">
              <TripJournalVisual trip={tripDetail.trip} placeNames={tripDetail.places.map((place) => place.name)} alt="" />
              <p>写真の代わりに、旅の記録から生まれた景色を添えています。</p>
            </div>
          )}
        </ScrapbookSection>

        <ScrapbookSection eyebrow="Places" title="旅の舞台" className="scrapbook-viewer__places">
          <div className="scrapbook-viewer__place-list">
            {buildPlaceEntries(placeBlocks, tripDetail).map((entry, index) => (
              <article key={entry.id} className="scrapbook-viewer__place">
                <span className="scrapbook-viewer__place-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <h3>{entry.name}</h3>
                  <time dateTime={entry.date}>{formatDisplayDate(entry.date)}</time>
                  <p>{entry.note || 'この旅で訪れた場所。'}</p>
                </div>
              </article>
            ))}
          </div>
        </ScrapbookSection>

        <ScrapbookSection eyebrow="Keepsakes" title="旅の余韻" className="scrapbook-viewer__achievements">
          <div className="scrapbook-viewer__achievement-grid">
            <Achievement value={`${tripDetail.places.length}`} label="訪問した場所" />
            <Achievement value={`${photoCount}`} label="残した写真" />
            <Achievement value={`${pages.length}`} label="旅のページ" />
            <Achievement value={castleCount > 0 ? `+${castleCount}` : '—'} label="城コレクション" />
          </div>
          <p>{scrapbook.status === 'completed' ? 'この一冊は、旅の記憶として完成しています。' : 'この旅の続きは、いつでもこの一冊に書き足せます。'}</p>
          <div className="scrapbook-viewer__closing-actions">
            <Link to={`/trips/${tripDetail.trip.id}/result`}>旅行リザルトを見る <span aria-hidden="true">→</span></Link>
            <button type="button" onClick={onEdit}>この一冊を編集する</button>
          </div>
        </ScrapbookSection>
      </div>
    </article>
  );
}

function ScrapbookMagazineCover({
  detail,
  tripDetail,
  coverAsset,
  onEdit,
}: {
  detail: ScrapbookDetail;
  tripDetail: TripDetail;
  coverAsset?: MediaAsset;
  onEdit: () => void;
}) {
  const { scrapbook } = detail;
  const titlePosition = toClassName(scrapbook.coverSettings?.titlePosition || 'bottom-left');
  return (
    <header className={`scrapbook-viewer__cover scrapbook-viewer__cover--${titlePosition}`}>
      {coverAsset ? (
        <ScrapbookMediaImage asset={coverAsset} alt={`${scrapbook.title}の表紙写真`} className="scrapbook-viewer__cover-image" loading="eager" />
      ) : (
        <TripJournalVisual trip={tripDetail.trip} placeNames={tripDetail.places.map((place) => place.name)} alt="" className="scrapbook-viewer__cover-fallback" />
      )}
      <div className="scrapbook-viewer__cover-shade" aria-hidden="true" />
      <Link className="scrapbook-viewer__cover-back" to={`/trips/${tripDetail.trip.id}`} aria-label="旅行詳細へ戻る"><span aria-hidden="true">←</span></Link>
      <button className="scrapbook-viewer__cover-edit" type="button" onClick={onEdit} aria-label="スクラップブックを編集する">編集</button>
      <div className="scrapbook-viewer__cover-copy">
        <span className="scrapbook-viewer__edition">Travel journal · {tripDetail.trip.tripType === 'dayTrip' ? 'Day trip' : 'Journey'}</span>
        <h1>{scrapbook.title}</h1>
        <p>{scrapbook.subtitle || tripDetail.trip.purpose || tripDetail.trip.memo || '旅の記録'}</p>
        <div className="scrapbook-viewer__cover-meta">
          <time dateTime={tripDetail.trip.startDate}>{formatCompactDateRange(tripDetail.trip.startDate, tripDetail.trip.endDate)}</time>
          {tripDetail.places[0]?.name && <span>{tripDetail.places[0].name}</span>}
        </div>
      </div>
    </header>
  );
}

function ScrapbookSection({
  eyebrow,
  title,
  className,
  children,
}: {
  eyebrow: string;
  title: string;
  className: string;
  children: ReactNode;
}) {
  return (
    <section className={`scrapbook-viewer__section ${className}`}>
      <header><span>{eyebrow}</span><h2>{title}</h2></header>
      {children}
    </section>
  );
}

function StoryBlock({ block }: { block: ScrapbookBlock }) {
  if (block.type === 'heading') return <h3 className="scrapbook-viewer__story-heading">{block.text}</h3>;
  if (block.type === 'quote') return <blockquote>{block.text}{block.cite && <cite>{block.cite}</cite>}</blockquote>;
  if (block.type === 'trip_summary') return null;
  if (block.type === 'meal') return <StoryNote title={block.name} body={block.body || block.note} />;
  if (block.type === 'ticket') return <StoryNote title={block.title} body={block.body || block.note} />;
  if (block.type === 'purchase') return <StoryNote title={block.name} body={block.body || block.note} />;
  if (block.type === 'text') return <StoryNote title={block.title} body={block.text || block.note} />;
  return null;
}

function StoryNote({ title, body }: { title?: string; body?: string }) {
  if (!body) return null;
  return <div className="scrapbook-viewer__story-note">{title && <h3>{title}</h3>}<p>{body}</p></div>;
}

function PhotoStory({
  block,
  index,
  assetsById,
}: {
  block: Extract<ScrapbookBlock, { type: 'photo' | 'photo_grid' }>;
  index: number;
  assetsById: Map<string, MediaAsset>;
}) {
  const assetIds = block.type === 'photo' ? [block.assetId] : block.assetIds;
  const assets = assetIds.map((id) => assetsById.get(id)).filter((asset): asset is MediaAsset => Boolean(asset));
  const variant = block.layoutVariant || (block.type === 'photo' ? block.displaySize : `grid-${Math.min(block.columns, 3)}`);
  if (assets.length === 0) return null;
  return (
    <figure className={`scrapbook-viewer__photo-story scrapbook-viewer__photo-story--${toClassName(variant)} scrapbook-viewer__photo-story--sequence-${index % 3}`}>
      {block.title && <h3>{block.title}</h3>}
      <div className="scrapbook-viewer__photo-grid">
        {assets.map((asset, assetIndex) => (
          <ScrapbookMediaImage key={asset.id} asset={asset} alt={asset.originalFileName || `${block.title || '旅の写真'} ${assetIndex + 1}`} />
        ))}
      </div>
      {(block.body || block.caption || block.note) && (
        <figcaption>
          {block.body && <p>{block.body}</p>}
          {(block.caption || block.note) && <span>{block.caption || block.note}</span>}
        </figcaption>
      )}
    </figure>
  );
}

function Achievement({ value, label }: { value: string; label: string }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}

function resolveCoverAsset(detail: ScrapbookDetail, assetsById: Map<string, MediaAsset>): MediaAsset | undefined {
  const preferredIds = [
    detail.scrapbook.coverSettings?.photoId,
    detail.scrapbook.coverAssetId,
    ...(detail.scrapbook.highlightPhotoIds ?? []),
  ];
  for (const id of preferredIds) {
    if (id && assetsById.has(id)) return assetsById.get(id);
  }
  for (const page of detail.pages) {
    for (const block of page.blocks) {
      if (block.type === 'photo') return assetsById.get(block.assetId);
      if (block.type === 'photo_grid') {
        const asset = block.assetIds.map((id) => assetsById.get(id)).find(Boolean);
        if (asset) return asset;
      }
    }
  }
  return undefined;
}

function isStoryBlock(block: ScrapbookBlock): boolean {
  return ['text', 'heading', 'meal', 'ticket', 'purchase', 'quote', 'trip_summary'].includes(block.type);
}

function buildStoryLead(detail: ScrapbookDetail, tripDetail: TripDetail, storyBlocks: ScrapbookBlock[]): string {
  const summary = storyBlocks.find((block): block is Extract<ScrapbookBlock, { type: 'trip_summary' }> => block.type === 'trip_summary' && Boolean(block.body));
  if (summary?.body) return summary.body;
  if (tripDetail.trip.memo) return tripDetail.trip.memo;
  if (tripDetail.trip.purpose) return tripDetail.trip.purpose;
  const firstPlace = tripDetail.places[0]?.name;
  return firstPlace ? `${firstPlace}から始まった、${detail.scrapbook.title}の記憶。` : `${detail.scrapbook.title}の記憶をたどる一冊。`;
}

function buildPlaceEntries(
  placeBlocks: Array<Extract<ScrapbookBlock, { type: 'place' }>>,
  tripDetail: TripDetail,
) {
  const byId = new Map(placeBlocks.map((block) => [block.locationId, block]));
  const entries = tripDetail.places.map((place) => {
    const block = byId.get(place.id);
    return {
      id: place.id,
      name: block?.titleOverride || place.name || block?.snapshotName || '訪問場所',
      date: isoDateTimeToDateInput(place.visitedAt) || tripDetail.trip.startDate,
      note: block?.body || block?.caption || block?.note || place.memo || '',
    };
  });
  for (const block of placeBlocks) {
    if (!entries.some((entry) => entry.id === block.locationId)) {
      entries.push({
        id: block.id,
        name: block.titleOverride || block.snapshotName,
        date: tripDetail.trip.startDate,
        note: block.body || block.caption || block.note || '',
      });
    }
  }
  return entries.length > 0 ? entries : [{ id: 'empty', name: '旅の目的地', date: tripDetail.trip.startDate, note: '訪問場所を追加すると、この旅の舞台が並びます。' }];
}

function formatDisplayDate(value: string): string {
  return value ? value.replaceAll('-', '.') : '日付未設定';
}

function toClassName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'default';
}
