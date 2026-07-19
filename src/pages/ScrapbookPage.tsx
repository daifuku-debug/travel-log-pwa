import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { MediaAsset, Scrapbook, ScrapbookBlock, ScrapbookPage as ScrapbookPageModel, ScrapbookThemeId } from '../domain/models/scrapbook';
import {
  addPhotoBlockFromFile,
  addPhotoGridBlockFromFiles,
  addScrapbookBlock,
  addScrapbookPage,
  createScrapbookForTrip,
  deleteScrapbookBlock,
  deleteScrapbookPage,
  getScrapbookByTripId,
  moveScrapbookBlock,
  moveScrapbookPage,
  updateScrapbook,
  updateScrapbookBlock,
  updateScrapbookPage,
  type ScrapbookBlockInput,
  type ScrapbookInput,
  type ScrapbookPageInput,
} from '../features/scrapbooks/scrapbookService';
import { getTripDetail } from '../features/trips/tripService';
import { EmptyState, ErrorState } from '../shared/components/PageState';
import { formatDateRange, isoDateTimeToDateInput } from '../shared/date/dateUtils';
import { useAsyncData } from '../shared/hooks/useAsyncData';
import { Badge, Button, Card, InlineError, PageHeader, Skeleton } from '../shared/ui';
import { ScrapbookCover } from '../features/scrapbooks/components/ScrapbookCover';
import { ScrapbookMediaImage } from '../features/scrapbooks/components/ScrapbookMediaImage';
import { ScrapbookPageNavigation } from '../features/scrapbooks/components/ScrapbookPageNavigation';
import { ScrapbookViewer } from '../features/scrapbooks/components/ScrapbookViewer';

const THEME_LABELS: Record<ScrapbookThemeId, string> = {
  classic: 'クラシック',
  journal: '旅日誌',
  minimal: 'ミニマル',
  adventure: '冒険日誌',
};

const EMPTY_PAGE: ScrapbookPageInput = {
  title: '',
  date: '',
  dayNumber: 0,
  layoutType: 'section',
  backgroundStyle: '',
};

const EMPTY_BLOCK: ScrapbookBlockInput = {
  type: 'text',
  text: '',
  locationId: '',
  title: '',
  note: '',
};

export function ScrapbookPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [reloadKey, setReloadKey] = useState(0);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [selectedPageId, setSelectedPageId] = useState<string>();
  const [formError, setFormError] = useState('');
  const { data, error, loading } = useAsyncData(async () => {
    if (!tripId) return undefined;
    const [tripDetail, scrapbookDetail] = await Promise.all([
      getTripDetail(tripId),
      getScrapbookByTripId(tripId),
    ]);
    return { tripDetail, scrapbookDetail };
  }, [tripId, reloadKey]);

  const scrapbookDetail = data?.scrapbookDetail;
  const selectedPage = useMemo(
    () => scrapbookDetail?.pages.find((page) => page.id === selectedPageId) ?? scrapbookDetail?.pages[0],
    [scrapbookDetail, selectedPageId],
  );
  const assetsById = useMemo(() => {
    const map = new Map<string, MediaAsset>();
    scrapbookDetail?.mediaAssets.forEach((asset) => map.set(asset.id, asset));
    return map;
  }, [scrapbookDetail?.mediaAssets]);

  async function handleCreate() {
    if (!tripId) return;
    setFormError('');
    try {
      const scrapbook = await createScrapbookForTrip(tripId);
      setReloadKey((value) => value + 1);
      setMode('edit');
      navigate(`/trips/${tripId}/scrapbook`, { replace: true });
      return scrapbook;
    } catch (createError) {
      setFormError(createError instanceof Error ? createError.message : '作成に失敗しました。');
    }
  }

  return (
    <>
      {(!scrapbookDetail || mode === 'edit') && (
        <PageHeader
          title="旅行スクラップブック"
          description={data?.tripDetail ? `${data.tripDetail.trip.title} / ${formatDateRange(data.tripDetail.trip.startDate, data.tripDetail.trip.endDate)}` : '旅行の思い出を1冊にまとめます。'}
          backTo={tripId ? `/trips/${tripId}` : '/trips'}
          backLabel="旅行詳細へ"
          actions={scrapbookDetail && (
            <div className="scrapbook-mode-actions">
              <Badge variant="warning">編集中</Badge>
              <Button variant="primary" onClick={() => setMode('view')}>閲覧に戻る</Button>
            </div>
          )}
        />
      )}

      {loading && <ScrapbookLoadingState />}
      {error && <ErrorState error={error} />}
      {formError && <InlineError message={formError} />}

      {!loading && !error && data && !data.tripDetail && (
        <EmptyState
          title="旅行が見つかりません"
          description="旅行一覧からスクラップブックを開き直してください。"
          action={<Button to="/trips">旅行一覧へ戻る</Button>}
        />
      )}

      {data?.tripDetail && !scrapbookDetail && (
        <EmptyState
          title="まだスクラップブックがありません"
          description="旅行の日程と訪問場所から、表紙・日付ページ・場所ブロックを自動生成します。"
          action={<Button variant="primary" onClick={() => void handleCreate()}>スクラップブックを作成</Button>}
          secondaryAction={<Button to={`/trips/${data.tripDetail.trip.id}`}>旅行詳細へ戻る</Button>}
        />
      )}

      {scrapbookDetail && data?.tripDetail && mode === 'view' && (
        <ScrapbookViewer
          detail={scrapbookDetail}
          tripDetail={data.tripDetail}
          onEdit={() => setMode('edit')}
        />
      )}

      {scrapbookDetail && data?.tripDetail && mode === 'edit' && (
        <div className={`scrapbook scrapbook-theme-${scrapbookDetail.scrapbook.themeId}`}>
          <ScrapbookCover
            scrapbook={scrapbookDetail.scrapbook}
            subtitle={scrapbookDetail.scrapbook.subtitle || data.tripDetail.trip.purpose || '旅の記録'}
            dateRange={formatDateRange(data.tripDetail.trip.startDate, data.tripDetail.trip.endDate)}
          />

          {mode === 'edit' && (
            <ScrapbookSettingsForm
              scrapbook={scrapbookDetail.scrapbook}
              onSaved={() => setReloadKey((value) => value + 1)}
            />
          )}

          <div className="scrapbook-layout">
            <ScrapbookPageNavigation
              pages={scrapbookDetail.pages}
              selectedPageId={selectedPage?.id}
              editing={mode === 'edit'}
              addPageAction={mode === 'edit' ? <PageForm scrapbookId={scrapbookDetail.scrapbook.id} onSaved={() => setReloadKey((value) => value + 1)} /> : undefined}
              onSelect={setSelectedPageId}
              onMove={(pageId, direction) => void moveScrapbookPage(pageId, direction).then(() => setReloadKey((value) => value + 1))}
            />

            <Card className="scrapbook-page-view">
              {selectedPage ? (
                <>
                  <div className="section-head">
                    <div>
                      <h2>{selectedPage.title}</h2>
                      <p className="muted">{selectedPage.date || '日付なし'}</p>
                    </div>
                    {mode === 'edit' && (
                      <button
                        className="button button--danger"
                        type="button"
                        onClick={async () => {
                          if (!window.confirm(`「${selectedPage.title}」を削除しますか？`)) return;
                          await deleteScrapbookPage(selectedPage.id);
                          setSelectedPageId(undefined);
                          setReloadKey((value) => value + 1);
                        }}
                      >
                        ページ削除
                      </button>
                    )}
                  </div>

                  {mode === 'edit' && (
                    <PageEditForm page={selectedPage} onSaved={() => setReloadKey((value) => value + 1)} />
                  )}

                  <div className="scrapbook-blocks">
                    {selectedPage.blocks.length === 0 ? (
                      <EmptyState
                        title="このページはまだ空です"
                        description={mode === 'edit' ? '下の入力欄から文章や写真を追加できます。' : '編集モードに切り替えると内容を追加できます。'}
                      />
                    ) : (
                      selectedPage.blocks.map((block) => (
                        <ScrapbookBlockView
                          key={block.id}
                          block={block}
                          places={data.tripDetail?.places ?? []}
                          tripId={data.tripDetail!.trip.id}
                          assetsById={assetsById}
                          mode={mode}
                          onSaved={() => setReloadKey((value) => value + 1)}
                        />
                      ))
                    )}
                  </div>

                  {mode === 'edit' && (
                    <BlockForm
                      page={selectedPage}
                      places={data.tripDetail.places}
                      tripId={data.tripDetail.trip.id}
                      onSaved={() => setReloadKey((value) => value + 1)}
                    />
                  )}
                </>
              ) : <EmptyState title="ページを選択してください" />}
            </Card>
          </div>

          <Card title="写真について" variant="subtle">
            <p className="muted">
              写真本体とサムネイルはこの端末のIndexedDBに保存します。GitHub PagesやJSONバックアップには画像本体を含めず、メタデータだけを保存します。
            </p>
          </Card>
        </div>
      )}
    </>
  );
}

function ScrapbookLoadingState() {
  return (
    <div className="scrapbook-loading" aria-live="polite" aria-busy="true">
      <span className="sr-only">スクラップブックを読み込み中...</span>
      <Skeleton variant="block" className="scrapbook-loading__cover" />
      <div className="scrapbook-loading__body">
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
    </div>
  );
}

function ScrapbookSettingsForm({
  scrapbook,
  onSaved,
}: {
  scrapbook: Scrapbook;
  onSaved: () => void;
}) {
  const [input, setInput] = useState<ScrapbookInput>({
    title: scrapbook.title,
    subtitle: scrapbook.subtitle ?? '',
    themeId: scrapbook.themeId,
    status: scrapbook.status,
    isFavorite: scrapbook.isFavorite,
  });

  return (
    <section className="card">
      <h2>ブック設定</h2>
      <form className="form form--compact" onSubmit={async (event) => {
        event.preventDefault();
        await updateScrapbook(scrapbook.id, input);
        onSaved();
      }}>
        <div className="form-grid">
          <label className="field">
            <span>タイトル</span>
            <input value={input.title} onChange={(event) => setInput({ ...input, title: event.target.value })} />
          </label>
          <label className="field">
            <span>テーマ</span>
            <select value={input.themeId} onChange={(event) => setInput({ ...input, themeId: event.target.value as ScrapbookThemeId })}>
              {Object.entries(THEME_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>
        <label className="field">
          <span>サブタイトル</span>
          <input value={input.subtitle} onChange={(event) => setInput({ ...input, subtitle: event.target.value })} />
        </label>
        <div className="form-grid">
          <label className="field">
            <span>状態</span>
            <select value={input.status} onChange={(event) => setInput({ ...input, status: event.target.value as ScrapbookInput['status'] })}>
              <option value="draft">下書き</option>
              <option value="completed">完成</option>
              <option value="archived">アーカイブ</option>
            </select>
          </label>
          <label className="checkbox-field filter-checkbox">
            <input type="checkbox" checked={input.isFavorite} onChange={(event) => setInput({ ...input, isFavorite: event.target.checked })} />
            お気に入り
          </label>
        </div>
        <button className="button button--primary" type="submit">端末に保存</button>
      </form>
    </section>
  );
}

function PageForm({ scrapbookId, onSaved }: { scrapbookId: string; onSaved: () => void }) {
  const [input, setInput] = useState<ScrapbookPageInput>(EMPTY_PAGE);
  return (
    <form className="inline-actions" onSubmit={async (event) => {
      event.preventDefault();
      await addScrapbookPage(scrapbookId, input);
      setInput(EMPTY_PAGE);
      onSaved();
    }}>
      <input className="inline-input" value={input.title} placeholder="ページ名" onChange={(event) => setInput({ ...input, title: event.target.value })} />
      <button className="button" type="submit">追加</button>
    </form>
  );
}

function PageEditForm({ page, onSaved }: { page: ScrapbookPageModel; onSaved: () => void }) {
  const [input, setInput] = useState<ScrapbookPageInput>({
    title: page.title,
    date: page.date ?? '',
    dayNumber: page.dayNumber ?? 0,
    layoutType: page.layoutType,
    backgroundStyle: page.backgroundStyle ?? '',
  });
  return (
    <form className="form form--compact" onSubmit={async (event) => {
      event.preventDefault();
      await updateScrapbookPage(page.id, input);
      onSaved();
    }}>
      <div className="form-grid">
        <label className="field">
          <span>ページ名</span>
          <input value={input.title} onChange={(event) => setInput({ ...input, title: event.target.value })} />
        </label>
        <label className="field">
          <span>日付</span>
          <input type="date" value={input.date} onChange={(event) => setInput({ ...input, date: event.target.value })} />
        </label>
      </div>
      <button className="button" type="submit">ページ保存</button>
    </form>
  );
}

function BlockForm({
  page,
  places,
  tripId,
  onSaved,
}: {
  page: ScrapbookPageModel;
  places: Array<{ id: string; name: string }>;
  tripId: string;
  onSaved: () => void;
}) {
  const [input, setInput] = useState<ScrapbookBlockInput>({ ...EMPTY_BLOCK, locationId: tripId });
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState('');
  return (
    <form className="form form--compact scrapbook-editor" onSubmit={async (event) => {
      event.preventDefault();
      setError('');
      try {
        if (files.length === 1) {
          await addPhotoBlockFromFile(page.id, tripId, files[0], input.note, input.text, input.title);
        } else if (files.length > 1) {
          await addPhotoGridBlockFromFiles(page.id, tripId, files, input.note, input.text, input.title);
        } else {
          await addScrapbookBlock(page.id, { ...input, type: 'text' });
        }
        setInput({ ...EMPTY_BLOCK, locationId: tripId });
        setFiles([]);
        onSaved();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : 'ブロックの追加に失敗しました。');
      }
    }}>
      <h3>ブロック追加</h3>
      {error && <InlineError message={error} compact />}
      <label className="field">
        <span>関連場所</span>
        <select value={input.locationId} onChange={(event) => setInput({ ...input, locationId: event.target.value })}>
          <option value={tripId}>旅行全体</option>
          {places.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
        </select>
      </label>
      <label className="field">
        <span>タイトル</span>
        <input value={input.title} onChange={(event) => setInput({ ...input, title: event.target.value })} />
      </label>
      <label className="field">
        <span>本文・感想</span>
        <textarea rows={3} value={input.text} onChange={(event) => setInput({ ...input, text: event.target.value })} />
      </label>
      <label className="field">
        <span>補足メモ</span>
        <input value={input.note} onChange={(event) => setInput({ ...input, note: event.target.value })} />
      </label>
      <label className="field">
        <span>写真</span>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
        />
        <small className="muted">{files.length > 0 ? `${files.length}枚選択中` : '写真は任意です。写真本体は端末内だけに保存します。'}</small>
      </label>
      <button className="button button--primary" type="submit">ブロック追加</button>
    </form>
  );
}

function ScrapbookBlockView({
  block,
  places,
  tripId,
  assetsById,
  mode,
  onSaved,
}: {
  block: ScrapbookBlock;
  places: Array<{ id: string; name: string; visitedAt?: string; memo?: string }>;
  tripId: string;
  assetsById: Map<string, MediaAsset>;
  mode: 'view' | 'edit';
  onSaved: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const place = block.type === 'place' ? places.find((row) => row.id === block.locationId) : undefined;
  return (
    <article className={`scrapbook-block scrapbook-block-${block.type}`}>
      {isEditing ? (
        <BlockEditForm
          block={block}
          places={places}
          tripId={tripId}
          onCancel={() => setIsEditing(false)}
          onSaved={() => {
            setIsEditing(false);
            onSaved();
          }}
        />
      ) : (
        <BlockContent block={block} place={place} assetsById={assetsById} />
      )}
      {mode === 'edit' && (
        <div className="inline-actions scrapbook-block-actions">
          <button className="button" type="button" onClick={() => void moveScrapbookBlock(block.id, -1).then(onSaved)}>上</button>
          <button className="button" type="button" onClick={() => void moveScrapbookBlock(block.id, 1).then(onSaved)}>下</button>
          <button className="button" type="button" onClick={() => setIsEditing((value) => !value)}>{isEditing ? '閉じる' : '編集'}</button>
          <button className="button button--danger" type="button" onClick={async () => {
            if (!window.confirm('このブロックを削除しますか？')) return;
            await deleteScrapbookBlock(block.id);
            onSaved();
          }}>削除</button>
        </div>
      )}
    </article>
  );
}

function BlockEditForm({
  block,
  places,
  tripId,
  onCancel,
  onSaved,
}: {
  block: ScrapbookBlock;
  places: Array<{ id: string; name: string }>;
  tripId: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [input, setInput] = useState<ScrapbookBlockInput>(blockToInput(block, tripId));
  return (
    <form className="form form--compact scrapbook-editor" onSubmit={async (event) => {
      event.preventDefault();
      await updateScrapbookBlock(block.id, input);
      onSaved();
    }}>
      <div className="form-grid">
        <label className="field">
          <span>種類</span>
          <select value={input.type} onChange={(event) => setInput({ ...input, type: event.target.value as ScrapbookBlockInput['type'] })}>
            <option value="text">本文</option>
            <option value="heading">見出し</option>
            <option value="photo">写真</option>
            <option value="photo_grid">写真グリッド</option>
            <option value="place">訪問場所</option>
            <option value="meal">食事</option>
            <option value="ticket">チケット・紙もの</option>
            <option value="purchase">買ったもの</option>
            <option value="quote">引用・ひとこと</option>
            <option value="divider">区切り</option>
            <option value="trip_summary">旅のまとめ</option>
            <option value="rpg_result">RPGリザルト</option>
          </select>
        </label>
        <label className="field">
          <span>関連場所</span>
          <select value={input.locationId} onChange={(event) => setInput({ ...input, locationId: event.target.value })}>
            <option value={tripId}>旅行全体</option>
            {places.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
          </select>
        </label>
      </div>
      <label className="field">
        <span>タイトル</span>
        <input value={input.title} onChange={(event) => setInput({ ...input, title: event.target.value })} />
      </label>
      <label className="field">
        <span>本文・感想</span>
        <textarea rows={4} value={input.text} onChange={(event) => setInput({ ...input, text: event.target.value })} />
      </label>
      <label className="field">
        <span>補足メモ</span>
        <input value={input.note} onChange={(event) => setInput({ ...input, note: event.target.value })} />
      </label>
      <div className="inline-actions">
        <button className="button button--primary" type="submit">ブロック保存</button>
        <button className="button" type="button" onClick={onCancel}>キャンセル</button>
      </div>
    </form>
  );
}

function BlockContent({
  block,
  place,
  assetsById,
}: {
  block: ScrapbookBlock;
  place?: { name: string; visitedAt?: string; memo?: string };
  assetsById: Map<string, MediaAsset>;
}) {
  if (block.type === 'heading') return <h3>{block.text}</h3>;
  if (block.type === 'place') {
    return (
      <div>
        <h3>{block.titleOverride || place?.name || block.snapshotName}</h3>
        <p className="muted">{place?.visitedAt ? isoDateTimeToDateInput(place.visitedAt) : '訪問日未設定'}</p>
        <p>{block.body || block.caption || place?.memo || '訪問メモはありません。'}</p>
        {block.body && block.caption && <p className="muted">{block.caption}</p>}
      </div>
    );
  }
  if (block.type === 'meal') return <BlockTextContent title={block.name} body={block.body} note={block.note} fallback="食事のメモを追加できます。" />;
  if (block.type === 'ticket') return <BlockTextContent title={block.title} body={block.body} note={block.note} fallback="チケットや紙ものの記録です。" />;
  if (block.type === 'purchase') return <BlockTextContent title={block.name} body={block.body} note={block.note} fallback="買ったものの記録です。" />;
  if (block.type === 'quote') return <blockquote>{block.text}{block.cite ? <cite>{block.cite}</cite> : null}</blockquote>;
  if (block.type === 'divider') return <hr aria-label={block.label || '区切り'} />;
  if (block.type === 'trip_summary') return <div><h3>{block.title || '旅のまとめ'}</h3><p>{block.body || '旅全体の感想を書けます。'}</p></div>;
  if (block.type === 'rpg_result') return <div><h3>{block.title || 'RPGリザルト'}</h3><p className="muted">旅行リザルト画面と連携するためのブロックです。</p></div>;
  if (block.type === 'photo') {
    const asset = assetsById.get(block.assetId);
    return (
      <figure className="scrapbook-photo">
        {block.title && <h3>{block.title}</h3>}
        {asset ? <MediaImage asset={asset} alt={block.altText || block.caption || asset.originalFileName || 'スクラップブック写真'} /> : <div className="empty-state">写真データが見つかりません。</div>}
        {block.body && <p>{block.body}</p>}
        {block.caption && <figcaption>{block.caption}</figcaption>}
      </figure>
    );
  }
  if (block.type === 'photo_grid') {
    return (
      <figure className="scrapbook-photo-grid">
        {block.title && <h3>{block.title}</h3>}
        <div className="scrapbook-photo-grid__items">
          {block.assetIds.map((assetId) => {
            const asset = assetsById.get(assetId);
            return asset ? <MediaImage key={assetId} asset={asset} alt={asset.originalFileName || 'スクラップブック写真'} /> : <div key={assetId} className="empty-state">写真なし</div>;
          })}
        </div>
        {block.body && <p>{block.body}</p>}
        {block.caption && <figcaption>{block.caption}</figcaption>}
      </figure>
    );
  }
  return <BlockTextContent title={block.title} body={block.text} note={block.note} fallback="メモを書く" />;
}

function BlockTextContent({
  title,
  body,
  note,
  fallback,
}: {
  title?: string;
  body?: string;
  note?: string;
  fallback: string;
}) {
  return (
    <div>
      {title && <h3>{title}</h3>}
      <p>{body || note || fallback}</p>
      {body && note && <p className="muted">{note}</p>}
    </div>
  );
}

function MediaImage({ asset, alt }: { asset: MediaAsset; alt: string }) {
  return <ScrapbookMediaImage asset={asset} alt={alt} />;
}

function blockToInput(block: ScrapbookBlock, tripId = ''): ScrapbookBlockInput {
  if (block.type === 'heading') return { ...EMPTY_BLOCK, type: 'heading', text: block.text };
  if (block.type === 'place') return { ...EMPTY_BLOCK, type: 'place', locationId: block.locationId, title: block.snapshotName, text: block.body ?? '', note: block.caption ?? '' };
  if (block.type === 'meal') return { ...EMPTY_BLOCK, type: 'meal', title: block.name, text: block.body ?? '', note: block.note ?? '' };
  if (block.type === 'ticket') return { ...EMPTY_BLOCK, type: 'ticket', title: block.title, text: block.body ?? '', note: block.note ?? '' };
  if (block.type === 'purchase') return { ...EMPTY_BLOCK, type: 'purchase', title: block.name, text: block.body ?? '', note: block.note ?? '' };
  if (block.type === 'quote') return { ...EMPTY_BLOCK, type: 'quote', text: block.text, title: block.cite ?? '' };
  if (block.type === 'divider') return { ...EMPTY_BLOCK, type: 'divider', title: block.label ?? '' };
  if (block.type === 'photo') return { ...EMPTY_BLOCK, type: 'photo', title: block.title ?? block.altText ?? '', text: block.body ?? '', note: block.caption ?? '', assetId: block.assetId };
  if (block.type === 'photo_grid') return { ...EMPTY_BLOCK, type: 'photo_grid', title: block.title ?? '', text: block.body ?? '', note: block.caption ?? '', assetIds: block.assetIds };
  if (block.type === 'trip_summary') return { ...EMPTY_BLOCK, type: 'trip_summary', title: block.title ?? '', text: block.body ?? '' };
  if (block.type === 'rpg_result') return { ...EMPTY_BLOCK, type: 'rpg_result', locationId: block.tripId || tripId, title: block.title ?? '' };
  return { ...EMPTY_BLOCK, type: 'text', title: block.type === 'text' ? block.title ?? '' : '', text: block.type === 'text' ? block.text : '', note: block.type === 'text' ? block.note ?? '' : '' };
}
