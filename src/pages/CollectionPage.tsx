import { listCollectionsWithProgress } from '../features/collections/collectionService';
import { EmptyState, ErrorState, LoadingState } from '../shared/components/PageState';
import { useAsyncData } from '../shared/hooks/useAsyncData';

export function CollectionPage() {
  const { data: collections, error, loading } = useAsyncData(listCollectionsWithProgress, []);

  return (
    <>
      <section className="page-heading">
        <h1>コレクション</h1>
        <p>城、駅、世界遺産などの訪問済み管理を行う画面です。</p>
      </section>

      {loading && <LoadingState />}
      {error && <ErrorState error={error} />}

      {collections && collections.length === 0 && (
        <EmptyState>まだコレクションがありません。</EmptyState>
      )}

      {collections && collections.length > 0 && (
        <div className="grid grid--two">
          {collections.map((collection) => {
            const rate =
              collection.totalCount === 0
                ? 0
                : Math.round((collection.visitedCount / collection.totalCount) * 100);
            return (
              <section className="card" key={collection.id}>
                <h2>{collection.name}</h2>
                <p className="muted">{collection.description}</p>
                <div className="stat-value">{rate}%</div>
                <div className="muted">
                  {collection.visitedCount} / {collection.totalCount} 訪問済み
                </div>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
