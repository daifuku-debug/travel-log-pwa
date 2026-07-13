import { Link, useNavigate, useParams } from 'react-router-dom';
import { TripForm } from '../features/trips/components/TripForm';
import { createTrip, getTripDetail, updateTrip } from '../features/trips/tripService';
import { EmptyState, ErrorState, LoadingState } from '../shared/components/PageState';
import { useAsyncData } from '../shared/hooks/useAsyncData';

export function TripEditPage({ mode }: { mode: 'create' | 'edit' }) {
  const navigate = useNavigate();
  const { tripId } = useParams();
  const isEdit = mode === 'edit';
  const { data, error, loading } = useAsyncData(
    () => (isEdit && tripId ? getTripDetail(tripId) : Promise.resolve(undefined)),
    [isEdit, tripId],
  );

  return (
    <>
      <section className="page-heading">
        <h1>{isEdit ? '旅行を編集' : '旅行を作成'}</h1>
        <p>旅行・お出かけの基本情報を入力します。</p>
      </section>

      {isEdit && loading && <LoadingState />}
      {error && <ErrorState error={error} />}

      {isEdit && !loading && !error && !data && (
        <EmptyState>
          編集する旅行が見つかりません。 <Link to="/trips">旅行一覧へ戻る</Link>
        </EmptyState>
      )}

      {(!isEdit || data) && (
        <section className="card">
          <TripForm
            trip={data?.trip}
            submitLabel={isEdit ? '旅行を更新' : '旅行を作成'}
            onSubmit={async (input) => {
              const saved = isEdit && tripId ? await updateTrip(tripId, input) : await createTrip(input);
              navigate(`/trips/${saved.id}`);
            }}
          />
        </section>
      )}
    </>
  );
}
