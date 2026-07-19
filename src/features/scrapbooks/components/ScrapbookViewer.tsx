import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { MediaAsset, ScrapbookBlock, ScrapbookPage as ScrapbookPageModel } from '../../../domain/models/scrapbook';
import { formatCompactDateRange, isoDateTimeToDateInput } from '../../../shared/date/dateUtils';
import { TripJournalTimeline } from '../../trips/components/TripJournalTimeline';
import { TripJournalVisual } from '../../trips/components/TripJournalVisual';
import type { TripDetail } from '../../trips/tripService';
import type { ScrapbookDetail } from '../scrapbookService';
import { sortVisibleScrapbookPages } from '../scrapbookPageLogic';
import { ScrapbookMediaImage } from './ScrapbookMediaImage';

type ViewerPage = ScrapbookDetail['pages'][number];

interface PageRendererProps {
  detail: ScrapbookDetail;
  page: ViewerPage;
  tripDetail: TripDetail;
  assetsById: Map<string, MediaAsset>;
  onEdit?: () => void;
  showControls?: boolean;
  showLegacyStory?: boolean;
  showLegacyPhotoFallback?: boolean;
}

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
  const pages = sortVisibleScrapbookPages(detail.pages);
  const assetsById = new Map(mediaAssets.map((asset) => [asset.id, asset]));
  const layout = scrapbook.layoutVariant || scrapbook.coverSettings?.layout || scrapbook.coverLayout;
  const hasStoryPage = detail.pages.some((page) => page.pageKind === 'story');
  const hasPhotoPage = detail.pages.some((page) => page.pageKind === 'photo');
  const firstContentPageId = pages.find((page) => page.pageKind !== 'cover')?.id;
  const endingPageId = [...pages].reverse().find((page) => page.pageKind === 'ending')?.id;

  return (
    <article className={`scrapbook-viewer scrapbook-viewer--${scrapbook.themeId} scrapbook-viewer--layout-${toClassName(layout)}`}>
      {pages.map((page) => (
        <ScrapbookPageRenderer
          key={page.id}
          detail={detail}
          page={page}
          tripDetail={tripDetail}
          assetsById={assetsById}
          onEdit={onEdit}
          showControls
          showLegacyStory={!hasStoryPage && page.id === firstContentPageId}
          showLegacyPhotoFallback={!hasPhotoPage && page.id === endingPageId}
        />
      ))}
    </article>
  );
}

export function ScrapbookPagePreview({
  detail,
  page,
  tripDetail,
}: {
  detail: ScrapbookDetail;
  page: ViewerPage;
  tripDetail: TripDetail;
}) {
  const assetsById = new Map(detail.mediaAssets.map((asset) => [asset.id, asset]));
  const layout = detail.scrapbook.layoutVariant || detail.scrapbook.coverSettings?.layout || detail.scrapbook.coverLayout;
  const hasStoryPage = detail.pages.some((item) => item.pageKind === 'story');
  const hasPhotoPage = detail.pages.some((item) => item.pageKind === 'photo');
  const firstContentPageId = detail.pages
    .filter((item) => !item.isHidden)
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .find((item) => item.pageKind !== 'cover')?.id;
  const endingPageId = [...detail.pages]
    .filter((item) => !item.isHidden)
    .sort((left, right) => right.sortOrder - left.sortOrder)
    .find((item) => item.pageKind === 'ending')?.id;

  return (
    <article className={`scrapbook-viewer scrapbook-viewer--${detail.scrapbook.themeId} scrapbook-viewer--layout-${toClassName(layout)}`}>
      <ScrapbookPageRenderer
        detail={detail}
        page={page}
        tripDetail={tripDetail}
        assetsById={assetsById}
        showLegacyStory={!hasStoryPage && page.id === firstContentPageId}
        showLegacyPhotoFallback={!hasPhotoPage && page.id === endingPageId}
      />
    </article>
  );
}

export function ScrapbookPageRenderer(props: PageRendererProps) {
  if (props.page.pageKind === 'cover') return <ScrapbookCoverPage {...props} />;
  return (
    <div className={`scrapbook-viewer__paper scrapbook-viewer__page scrapbook-viewer__page--${props.page.pageKind}`} data-page-kind={props.page.pageKind}>
      {props.page.pageKind === 'story' && <StoryPage {...props} />}
      {props.page.pageKind === 'timeline' && <TimelinePage {...props} />}
      {props.page.pageKind === 'photo' && <PhotoPage {...props} />}
      {props.page.pageKind === 'place' && <PlacePage {...props} />}
      {props.page.pageKind === 'ending' && <EndingPage {...props} />}
      {(props.page.pageKind === 'feature' || props.page.pageKind === 'custom') && <FeaturePage {...props} />}
    </div>
  );
}

function ScrapbookCoverPage({ detail, tripDetail, assetsById, onEdit, showControls }: PageRendererProps) {
  const { scrapbook } = detail;
  const coverAsset = resolveCoverAsset(detail, assetsById);
  const settings = scrapbook.coverSettings;
  const titlePosition = toClassName(settings?.titlePosition || 'bottom-left');
  return (
    <header className={`scrapbook-viewer__cover scrapbook-viewer__cover--${titlePosition}`} data-page-kind="cover">
      {coverAsset ? (
        <ScrapbookMediaImage asset={coverAsset} alt={`${scrapbook.title}の表紙写真`} className="scrapbook-viewer__cover-image" loading="eager" />
      ) : (
        <TripJournalVisual trip={tripDetail.trip} placeNames={tripDetail.places.map((place) => place.name)} alt="" className="scrapbook-viewer__cover-fallback" />
      )}
      <div className="scrapbook-viewer__cover-shade" aria-hidden="true" />
      {showControls && <Link className="scrapbook-viewer__cover-back" to={`/trips/${tripDetail.trip.id}`} aria-label="旅行詳細へ戻る"><span aria-hidden="true">←</span></Link>}
      {showControls && onEdit && <button className="scrapbook-viewer__cover-edit" type="button" onClick={onEdit} aria-label="スクラップブックを編集する">編集</button>}
      <div className="scrapbook-viewer__cover-copy">
        <span className="scrapbook-viewer__edition">Travel journal · {tripDetail.trip.tripType === 'dayTrip' ? 'Day trip' : 'Journey'}</span>
        <h1>{scrapbook.title}</h1>
        {settings?.showSubtitle !== false && <p>{scrapbook.subtitle || tripDetail.trip.purpose || tripDetail.trip.memo || '旅の記録'}</p>}
        {(settings?.showDate !== false || settings?.showLocation !== false) && (
          <div className="scrapbook-viewer__cover-meta">
            {settings?.showDate !== false && <time dateTime={tripDetail.trip.startDate}>{formatCompactDateRange(tripDetail.trip.startDate, tripDetail.trip.endDate)}</time>}
            {settings?.showLocation !== false && tripDetail.places[0]?.name && <span>{tripDetail.places[0].name}</span>}
          </div>
        )}
      </div>
    </header>
  );
}

function StoryPage({ detail, page, tripDetail, assetsById }: PageRendererProps) {
  const blocks = visibleBlocks(page);
  return (
    <ScrapbookSection eyebrow="Story" title={page.title} className="scrapbook-viewer__story">
      <p className="scrapbook-viewer__lead">{buildStoryLead(detail, tripDetail, blocks)}</p>
      <PageBlocks blocks={blocks.filter((block) => block.type !== 'trip_summary')} tripDetail={tripDetail} assetsById={assetsById} />
    </ScrapbookSection>
  );
}

function TimelinePage({ detail, page, tripDetail, assetsById, showLegacyStory }: PageRendererProps) {
  const blocks = visibleBlocks(page);
  return (
    <>
      {showLegacyStory && (
        <ScrapbookSection eyebrow="Story" title="旅のはじまり" className="scrapbook-viewer__story">
          <p className="scrapbook-viewer__lead">{buildStoryLead(detail, tripDetail, blocks)}</p>
        </ScrapbookSection>
      )}
      <ScrapbookSection eyebrow="Journey" title={page.title} className="scrapbook-viewer__timeline">
        <TripJournalTimeline places={tripDetail.places} transportLegs={tripDetail.transportLegs} />
        <PageBlocks blocks={blocks} tripDetail={tripDetail} assetsById={assetsById} />
      </ScrapbookSection>
    </>
  );
}

function PhotoPage({ page, tripDetail, assetsById }: PageRendererProps) {
  const photoBlocks = visibleBlocks(page).filter(isPhotoBlock);
  return (
    <ScrapbookSection eyebrow="Scenes" title={page.title} className="scrapbook-viewer__photos">
      {photoBlocks.length > 0 ? (
        <div className="scrapbook-viewer__photo-sequence">
          {photoBlocks.map((block, index) => <PhotoStory key={block.id} block={block} index={index} assetsById={assetsById} />)}
        </div>
      ) : (
        <div className="scrapbook-viewer__photo-fallback">
          <TripJournalVisual trip={tripDetail.trip} placeNames={tripDetail.places.map((place) => place.name)} alt="" />
          <p>写真の代わりに、旅の記録から生まれた景色を添えています。</p>
        </div>
      )}
    </ScrapbookSection>
  );
}

function PlacePage({ page, tripDetail, assetsById }: PageRendererProps) {
  const blocks = visibleBlocks(page);
  const placeBlocks = blocks.filter(isPlaceBlock);
  return (
    <ScrapbookSection eyebrow="Places" title={page.title} className="scrapbook-viewer__places">
      <PlaceList entries={buildPlaceEntries(placeBlocks, tripDetail, page)} />
      <PageBlocks blocks={blocks.filter((block) => block.type !== 'place')} tripDetail={tripDetail} assetsById={assetsById} />
    </ScrapbookSection>
  );
}

function EndingPage({ detail, page, tripDetail, assetsById, onEdit, showControls, showLegacyPhotoFallback }: PageRendererProps) {
  const photoCount = countPhotos(detail.pages);
  const castleCount = tripDetail.places.filter((place) => place.castleId).length;
  return (
    <>
      {showLegacyPhotoFallback && photoCount === 0 && (
        <ScrapbookSection eyebrow="Scenes" title="旅の景色" className="scrapbook-viewer__photos">
          <div className="scrapbook-viewer__photo-fallback">
            <TripJournalVisual trip={tripDetail.trip} placeNames={tripDetail.places.map((place) => place.name)} alt="" />
            <p>写真の代わりに、旅の記録から生まれた景色を添えています。</p>
          </div>
        </ScrapbookSection>
      )}
      <ScrapbookSection eyebrow="Keepsakes" title={page.title} className="scrapbook-viewer__achievements">
        <PageBlocks blocks={visibleBlocks(page)} tripDetail={tripDetail} assetsById={assetsById} />
        <div className="scrapbook-viewer__achievement-grid">
          <Achievement value={`${tripDetail.places.length}`} label="訪問した場所" />
          <Achievement value={`${photoCount}`} label="残した写真" />
          <Achievement value={`${detail.pages.filter((item) => !item.isHidden).length}`} label="旅のページ" />
          <Achievement value={castleCount > 0 ? `+${castleCount}` : '—'} label="城コレクション" />
        </div>
        <p>{detail.scrapbook.status === 'completed' ? 'この一冊は、旅の記憶として完成しています。' : 'この旅の続きは、いつでもこの一冊に書き足せます。'}</p>
        {showControls && <div className="scrapbook-viewer__closing-actions">
          <Link to={`/trips/${tripDetail.trip.id}/result`}>旅行リザルトを見る <span aria-hidden="true">→</span></Link>
          {onEdit && <button type="button" onClick={onEdit}>この一冊を編集する</button>}
        </div>}
      </ScrapbookSection>
    </>
  );
}

function FeaturePage({ page, tripDetail, assetsById }: PageRendererProps) {
  return (
    <ScrapbookSection eyebrow={page.pageKind === 'feature' ? 'Feature' : 'Journal'} title={page.title} className="scrapbook-viewer__feature">
      <PageBlocks blocks={visibleBlocks(page)} tripDetail={tripDetail} assetsById={assetsById} />
    </ScrapbookSection>
  );
}

function ScrapbookSection({ eyebrow, title, className, children }: { eyebrow: string; title: string; className: string; children: ReactNode }) {
  return <section className={`scrapbook-viewer__section ${className}`}><header><span>{eyebrow}</span><h2>{title}</h2></header>{children}</section>;
}

function PageBlocks({ blocks, tripDetail, assetsById }: { blocks: ScrapbookBlock[]; tripDetail: TripDetail; assetsById: Map<string, MediaAsset> }) {
  let photoIndex = 0;
  return blocks.length > 0 ? blocks.map((block) => {
    if (isPhotoBlock(block)) return <PhotoStory key={block.id} block={block} index={photoIndex++} assetsById={assetsById} />;
    if (isPlaceBlock(block)) return <PlaceList key={block.id} entries={buildPlaceEntries([block], tripDetail)} />;
    if (block.type === 'divider') return <hr key={block.id} aria-label={block.label || '区切り'} />;
    if (block.type === 'rpg_result') return <StoryNote key={block.id} title={block.title || '旅の成果'} body="旅行リザルトに残された、この旅の成果。" />;
    return <StoryBlock key={block.id} block={block} />;
  }) : null;
}

function StoryBlock({ block }: { block: ScrapbookBlock }) {
  if (block.type === 'heading') return <h3 className="scrapbook-viewer__story-heading">{block.text}</h3>;
  if (block.type === 'quote') return <blockquote>{block.text}{block.cite && <cite>{block.cite}</cite>}</blockquote>;
  if (block.type === 'trip_summary') return <StoryNote title={block.title} body={block.body} />;
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

function PhotoStory({ block, index, assetsById }: { block: Extract<ScrapbookBlock, { type: 'photo' | 'photo_grid' }>; index: number; assetsById: Map<string, MediaAsset> }) {
  const assetIds = block.type === 'photo' ? [block.assetId] : block.assetIds;
  const assets = assetIds.map((id) => assetsById.get(id)).filter((asset): asset is MediaAsset => Boolean(asset));
  const variant = block.layoutVariant || (block.type === 'photo' ? block.displaySize : `grid-${Math.min(block.columns, 3)}`);
  if (assets.length === 0) return null;
  return (
    <figure className={`scrapbook-viewer__photo-story scrapbook-viewer__photo-story--${toClassName(variant)} scrapbook-viewer__photo-story--sequence-${index % 3}`}>
      {block.title && <h3>{block.title}</h3>}
      <div className="scrapbook-viewer__photo-grid">
        {assets.map((asset, assetIndex) => <ScrapbookMediaImage key={asset.id} asset={asset} alt={asset.originalFileName || `${block.title || '旅の写真'} ${assetIndex + 1}`} />)}
      </div>
      {(block.body || block.caption || block.note) && <figcaption>{block.body && <p>{block.body}</p>}{(block.caption || block.note) && <span>{block.caption || block.note}</span>}</figcaption>}
    </figure>
  );
}

function PlaceList({ entries }: { entries: ReturnType<typeof buildPlaceEntries> }) {
  return (
    <div className="scrapbook-viewer__place-list">
      {entries.map((entry, index) => (
        <article key={entry.id} className="scrapbook-viewer__place">
          <span className="scrapbook-viewer__place-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
          <div><h3>{entry.name}</h3><time dateTime={entry.date}>{formatDisplayDate(entry.date)}</time><p>{entry.note || 'この旅で訪れた場所。'}</p></div>
        </article>
      ))}
    </div>
  );
}

function Achievement({ value, label }: { value: string; label: string }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}

function resolveCoverAsset(detail: ScrapbookDetail, assetsById: Map<string, MediaAsset>): MediaAsset | undefined {
  const preferredIds = [detail.scrapbook.coverSettings?.photoId, detail.scrapbook.coverAssetId, ...(detail.scrapbook.highlightPhotoIds ?? [])];
  for (const id of preferredIds) if (id && assetsById.has(id)) return assetsById.get(id);
  for (const page of [...detail.pages].sort((left, right) => left.sortOrder - right.sortOrder)) {
    for (const block of visibleBlocks(page)) {
      if (block.type === 'photo') return assetsById.get(block.assetId);
      if (block.type === 'photo_grid') {
        const asset = block.assetIds.map((id) => assetsById.get(id)).find(Boolean);
        if (asset) return asset;
      }
    }
  }
  return undefined;
}

function visibleBlocks(page: ViewerPage): ScrapbookBlock[] {
  return [...page.blocks].filter((block) => !block.isHidden).sort((left, right) => left.sortOrder - right.sortOrder || left.id.localeCompare(right.id));
}

function isPhotoBlock(block: ScrapbookBlock): block is Extract<ScrapbookBlock, { type: 'photo' | 'photo_grid' }> {
  return block.type === 'photo' || block.type === 'photo_grid';
}

function isPlaceBlock(block: ScrapbookBlock): block is Extract<ScrapbookBlock, { type: 'place' }> {
  return block.type === 'place';
}

function buildStoryLead(detail: ScrapbookDetail, tripDetail: TripDetail, blocks: ScrapbookBlock[]): string {
  const summary = blocks.find((block): block is Extract<ScrapbookBlock, { type: 'trip_summary' }> => block.type === 'trip_summary' && Boolean(block.body));
  if (summary?.body) return summary.body;
  if (tripDetail.trip.memo) return tripDetail.trip.memo;
  if (tripDetail.trip.purpose) return tripDetail.trip.purpose;
  const firstPlace = tripDetail.places[0]?.name;
  return firstPlace ? `${firstPlace}から始まった、${detail.scrapbook.title}の記憶。` : `${detail.scrapbook.title}の記憶をたどる一冊。`;
}

function buildPlaceEntries(placeBlocks: Array<Extract<ScrapbookBlock, { type: 'place' }>>, tripDetail: TripDetail, page?: ScrapbookPageModel) {
  const byId = new Map(placeBlocks.map((block) => [block.locationId, block]));
  const sourcePlaces = placeBlocks.length > 0
    ? tripDetail.places.filter((place) => byId.has(place.id))
    : tripDetail.places.filter((place) => !page?.date || !place.visitedAt || place.visitedAt.slice(0, 10) === page.date);
  const entries = sourcePlaces.map((place) => {
    const block = byId.get(place.id);
    return {
      id: place.id,
      name: block?.titleOverride || place.name || block?.snapshotName || '訪問場所',
      date: isoDateTimeToDateInput(place.visitedAt) || page?.date || tripDetail.trip.startDate,
      note: block?.body || block?.caption || block?.note || place.memo || '',
    };
  });
  for (const block of placeBlocks) {
    if (!entries.some((entry) => entry.id === block.locationId)) entries.push({ id: block.id, name: block.titleOverride || block.snapshotName, date: page?.date || tripDetail.trip.startDate, note: block.body || block.caption || block.note || '' });
  }
  return entries.length > 0 ? entries : [{ id: `empty-${page?.id || 'page'}`, name: '旅の目的地', date: page?.date || tripDetail.trip.startDate, note: '訪問場所を追加すると、この旅の舞台が並びます。' }];
}

function countPhotos(pages: ViewerPage[]): number {
  return new Set(pages.flatMap((page) => visibleBlocks(page).flatMap((block) => block.type === 'photo' ? [block.assetId] : block.type === 'photo_grid' ? block.assetIds : []))).size;
}

function formatDisplayDate(value: string): string {
  return value ? value.replaceAll('-', '.') : '日付未設定';
}

function toClassName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'default';
}
