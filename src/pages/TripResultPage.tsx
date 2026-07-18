import { Link, useParams } from 'react-router-dom';
import { getTripResultView } from '../features/rpg/tripResultService';
import { EmptyState, ErrorState, LoadingState } from '../shared/components/PageState';
import { useAsyncData } from '../shared/hooks/useAsyncData';

export function TripResultPage() {
  const { tripId } = useParams();
  const { data, error, loading } = useAsyncData(
    () => (tripId ? getTripResultView(tripId) : Promise.resolve(undefined)),
    [tripId],
  );

  return (
    <>
      <section className="page-heading">
        <h1>旅行リザルト</h1>
        <p>旅行完了時に獲得した経験値とレベル進捗を確認します。</p>
      </section>
      {loading && <LoadingState />}
      {error && <ErrorState error={error} />}
      {!loading && !error && !data && (
        <EmptyState>
          リザルトがまだありません。 <Link to={tripId ? `/trips/${tripId}` : '/trips'}>旅行詳細へ戻る</Link>
        </EmptyState>
      )}
      {data && (
        <div className="grid">
          <section className="card rpg-hero">
            <div>
              <div className="muted">{data.tripPeriod} / {data.tripTypeLabel}</div>
              <h2>{data.tripTitle}</h2>
              <p className="muted">次のレベルまで {data.nextLevelExp} EXP</p>
            </div>
            <div className="stat-value">+{data.result.totalExp} EXP</div>
          </section>
          <div className="grid grid--two summary-grid">
            <Summary label="レベル" value={`${data.result.oldLevel} → ${data.result.newLevel}`} />
            <Summary label="訪問場所" value={`${data.result.summary.placeVisitCount}`} />
            <Summary label="新規都道府県" value={`${data.result.summary.newPrefectureCodes.length}`} />
            <Summary label="初宿泊都道府県" value={`${data.result.summary.firstStayedPrefectureCodes.length}`} />
          </div>
          <section className="card">
            <h2>新しく解除したもの</h2>
            <p className="muted">実績 {data.result.unlockedAchievementIds.length}件 / 称号 {data.result.unlockedTitleIds.length}件</p>
          </section>
        </div>
      )}
    </>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <h2>{label}</h2>
      <div className="stat-value">{value}</div>
    </div>
  );
}
