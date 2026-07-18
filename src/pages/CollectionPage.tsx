import { useState } from 'react';
import { listCollectionDetails } from '../features/collections/collectionService';
import { EmptyState, ErrorState, LoadingState } from '../shared/components/PageState';
import { useAsyncData } from '../shared/hooks/useAsyncData';

export function CollectionPage() {
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const { data: collections, error, loading } = useAsyncData(listCollectionDetails, []);

  function toggleCollection(collectionId: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(collectionId)) {
        next.delete(collectionId);
      } else {
        next.add(collectionId);
      }
      return next;
    });
  }

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
            const isOpen = openIds.has(collection.id);
            return (
              <section className="card" key={collection.id}>
                <div className="section-head">
                  <div>
                    <h2>{collection.name}</h2>
                    <p className="muted">{collection.description}</p>
                  </div>
                  <button className="button" type="button" onClick={() => toggleCollection(collection.id)}>
                    {isOpen ? '閉じる' : '内訳'}
                  </button>
                </div>
                <div className="stat-value">{rate}%</div>
                <div className="muted">{collection.visitedCount} / {collection.totalCount} 訪問済み</div>

                {isOpen && (
                  <div className="collection-detail-list">
                    {collection.items.length === 0 ? (
                      <div className="empty-state">項目がまだありません。</div>
                    ) : collection.items.map(({ item, isVisited, lastVisitedAt }) => (
                      <div className="collection-detail-row" key={item.id}>
                        <div>
                          <strong>{item.name}</strong>
                          <div className="list-item__meta">
                            {[item.prefecture, item.country, item.address].filter(Boolean).join(' / ') || '場所情報なし'}
                          </div>
                          {item.memo && <div className="list-item__meta">{item.memo}</div>}
                        </div>
                        <div className="prefecture-row__right">
                          <span className={`status-badge ${isVisited ? 'achievement-unlocked' : ''}`}>
                            {isVisited ? '訪問済み' : '未訪問'}
                          </span>
                          <span className="list-item__meta">{lastVisitedAt ? lastVisitedAt.slice(0, 10) : '-'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
