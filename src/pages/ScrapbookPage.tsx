import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ScrapbookEditor } from '../features/scrapbooks/components/ScrapbookEditor';
import { ScrapbookViewer } from '../features/scrapbooks/components/ScrapbookViewer';
import {
  createScrapbookForTrip,
  getScrapbookByTripId,
} from '../features/scrapbooks/scrapbookService';
import { getTripDetail } from '../features/trips/tripService';
import { EmptyState, ErrorState } from '../shared/components/PageState';
import { formatDateRange } from '../shared/date/dateUtils';
import { useAsyncData } from '../shared/hooks/useAsyncData';
import { Button, InlineError, PageHeader, Skeleton } from '../shared/ui';

export function ScrapbookPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const [reloadKey, setReloadKey] = useState(0);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [editorPageId, setEditorPageId] = useState<string>();
  const [formError, setFormError] = useState('');
  const { data, error, loading } = useAsyncData(async () => {
    if (!tripId) return undefined;
    const [tripDetail, scrapbookDetail] = await Promise.all([
      getTripDetail(tripId),
      getScrapbookByTripId(tripId),
    ]);
    return { tripDetail, scrapbookDetail };
  }, [tripId, reloadKey]);

  async function handleCreate() {
    if (!tripId) return;
    setFormError('');
    try {
      await createScrapbookForTrip(tripId);
      setReloadKey((value) => value + 1);
      setMode('edit');
      navigate(`/trips/${tripId}/scrapbook`, { replace: true });
    } catch (createError) {
      setFormError(createError instanceof Error ? createError.message : '作成に失敗しました。');
    }
  }

  const tripDetail = data?.tripDetail;
  const scrapbookDetail = data?.scrapbookDetail;

  return (
    <>
      {!scrapbookDetail && (
        <PageHeader
          title="旅行スクラップブック"
          description={tripDetail
            ? `${tripDetail.trip.title} / ${formatDateRange(tripDetail.trip.startDate, tripDetail.trip.endDate)}`
            : '旅行の思い出を1冊にまとめます。'}
          backTo={tripId ? `/trips/${tripId}` : '/trips'}
          backLabel="旅行詳細へ"
        />
      )}

      {loading && <ScrapbookLoadingState />}
      {error && <ErrorState error={error} />}
      {formError && <InlineError message={formError} />}

      {!loading && !error && data && !tripDetail && (
        <EmptyState
          title="旅行が見つかりません"
          description="旅行一覧からスクラップブックを開き直してください。"
          action={<Button to="/trips">旅行一覧へ戻る</Button>}
        />
      )}

      {tripDetail && !scrapbookDetail && (
        <EmptyState
          title="まだスクラップブックがありません"
          description="旅行の日程と訪問場所から、表紙・日付ページ・場所ブロックを自動生成します。"
          action={<Button variant="primary" onClick={() => void handleCreate()}>スクラップブックを作成</Button>}
          secondaryAction={<Button to={`/trips/${tripDetail.trip.id}`}>旅行詳細へ戻る</Button>}
        />
      )}

      {scrapbookDetail && tripDetail && mode === 'view' && (
        <ScrapbookViewer
          detail={scrapbookDetail}
          tripDetail={tripDetail}
          onEdit={() => setMode('edit')}
        />
      )}

      {scrapbookDetail && tripDetail && mode === 'edit' && scrapbookDetail.pages.length > 0 && (
        <ScrapbookEditor
          detail={scrapbookDetail}
          tripDetail={tripDetail}
          initialPageId={editorPageId}
          onExit={() => setMode('view')}
          onSelectedPageChange={setEditorPageId}
          onSaved={() => setReloadKey((value) => value + 1)}
        />
      )}

      {scrapbookDetail && mode === 'edit' && scrapbookDetail.pages.length === 0 && (
        <EmptyState
          title="編集できるページがありません"
          description="このスクラップブックにはページがありません。"
          action={<Button onClick={() => setMode('view')}>閲覧に戻る</Button>}
        />
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
