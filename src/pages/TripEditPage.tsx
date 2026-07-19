import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { TripForm } from '../features/trips/components/TripForm';
import { createTrip, deleteTrip, getTripDetail, updateTrip } from '../features/trips/tripService';
import { EmptyState, ErrorState, LoadingState } from '../shared/components/PageState';
import { useAsyncData } from '../shared/hooks/useAsyncData';
import { Button, InlineError, PageHeader } from '../shared/ui';

export function TripEditPage({ mode }: { mode: 'create' | 'edit' }) {
  const navigate = useNavigate();
  const { tripId } = useParams();
  const isEdit = mode === 'edit';
  const [deleteError, setDeleteError] = useState('');
  const { data, error, loading } = useAsyncData(
    () => (isEdit && tripId ? getTripDetail(tripId) : Promise.resolve(undefined)),
    [isEdit, tripId],
  );
  const cancelTo = isEdit && tripId ? `/trips/${tripId}` : '/trips';

  async function handleDelete() {
    if (!tripId || !window.confirm('この旅行と紐づく訪問場所を削除しますか？')) return;
    setDeleteError('');
    try {
      await deleteTrip(tripId);
      navigate('/trips');
    } catch (caughtError) {
      setDeleteError(caughtError instanceof Error ? caughtError.message : '旅行の削除に失敗しました。');
    }
  }

  return (
    <>
      <PageHeader
        title={isEdit ? '旅行を編集' : '旅行を作成'}
        description="旅行・お出かけの基本情報を入力します。"
        backTo={cancelTo}
        backLabel={isEdit ? '旅行詳細へ' : '旅行一覧へ'}
      />

      {isEdit && loading && <LoadingState variant="skeleton" message="旅行情報を読み込み中..." />}
      {error && <ErrorState error={error} />}

      {isEdit && !loading && !error && !data && (
        <EmptyState
          title="編集する旅行が見つかりません"
          description="削除されたか、URLが正しくない可能性があります。"
          action={<Button to="/trips">旅行一覧へ戻る</Button>}
        />
      )}

      {(!isEdit || data) && (
        <div className="trip-edit-layout">
          <TripForm
            trip={data?.trip}
            submitLabel={isEdit ? '旅行を更新' : '旅行を作成'}
            cancelTo={cancelTo}
            onSubmit={async (input) => {
              const saved = isEdit && tripId ? await updateTrip(tripId, input) : await createTrip(input);
              navigate(`/trips/${saved.id}`);
            }}
          />

          {isEdit && (
            <section className="trip-edit-danger" aria-labelledby="trip-edit-management-title">
              <h2 id="trip-edit-management-title">旅行の管理</h2>
              <p className="muted">この旅行と紐づく訪問場所・移動区間も削除されます。</p>
              {deleteError && <InlineError message={deleteError} compact />}
              <Button variant="danger" onClick={() => void handleDelete()}>旅行を削除</Button>
            </section>
          )}
        </div>
      )}
    </>
  );
}
