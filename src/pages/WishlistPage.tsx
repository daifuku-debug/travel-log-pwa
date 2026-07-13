import { listWishlistItems } from '../features/wishlist/wishlistService';
import { EmptyState, ErrorState, LoadingState } from '../shared/components/PageState';
import { useAsyncData } from '../shared/hooks/useAsyncData';

export function WishlistPage() {
  const { data: items, error, loading } = useAsyncData(listWishlistItems, []);

  return (
    <>
      <section className="page-heading">
        <h1>欲しいもの</h1>
        <p>旅行中に気になった商品を、後から買うためのメモとして残します。</p>
      </section>

      {loading && <LoadingState />}
      {error && <ErrorState error={error} />}

      {items && items.length === 0 && <EmptyState>まだ欲しいものメモがありません。</EmptyState>}

      {items && items.length > 0 && (
        <div className="list">
          {items.map((item) => (
            <div className="list-item" key={item.id}>
              <div>
                <p className="list-item__title">{item.name}</p>
                <div className="list-item__meta">{item.shopName || 'お店未設定'}</div>
                <p className="muted">{item.memo}</p>
              </div>
              <span className="muted">{item.status === 'want' ? '未購入' : item.status}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
