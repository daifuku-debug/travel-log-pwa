import { listRecentExperience } from '../features/rpg/experienceService';
import { ErrorState, LoadingState } from '../shared/components/PageState';
import { useAsyncData } from '../shared/hooks/useAsyncData';

export function RpgExperiencePage() {
  const { data, error, loading } = useAsyncData(() => listRecentExperience(50), []);

  return (
    <>
      <section className="page-heading">
        <h1>経験値履歴</h1>
        <p>経験値が付与された理由と発生元を確認できます。</p>
      </section>
      {loading && <LoadingState />}
      {error && <ErrorState error={error} />}
      {data && (
        <div className="list">
          {data.length === 0 ? (
            <section className="card">
              <p className="muted">まだ経験値履歴はありません。</p>
            </section>
          ) : data.map((entry) => (
            <div className="list-item" key={entry.id}>
              <div>
                <p className="list-item__title">{entry.reason}</p>
                <div className="list-item__meta">{entry.sourceType} / {entry.earnedAt.slice(0, 10)}</div>
                {entry.effectiveAmount === 0 && <div className="list-item__meta">レベル計算対象外</div>}
              </div>
              <strong>+{entry.amount} EXP</strong>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
