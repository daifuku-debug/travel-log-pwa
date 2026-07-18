import { useState, type FormEvent } from 'react';
import type { WishlistItem, WishlistStatus } from '../domain/models/wishlist';
import {
  createWishlistItem,
  deleteWishlistItem,
  listWishlistItems,
  updateWishlistItem,
  validateWishlistItemInput,
  type WishlistItemInput,
} from '../features/wishlist/wishlistService';
import { EmptyState, ErrorState, LoadingState } from '../shared/components/PageState';
import { useAsyncData } from '../shared/hooks/useAsyncData';

const EMPTY_INPUT: WishlistItemInput = {
  name: '',
  shopName: '',
  price: '',
  url: '',
  memo: '',
  status: 'want',
};

const STATUS_LABELS: Record<WishlistStatus, string> = {
  want: '未購入',
  bought: '購入済み',
  skipped: '見送り',
};

export function WishlistPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [editingItem, setEditingItem] = useState<WishlistItem>();
  const [actionError, setActionError] = useState('');
  const { data: items, error, loading } = useAsyncData(listWishlistItems, [reloadKey]);

  function reload() {
    setReloadKey((value) => value + 1);
  }

  async function handleDelete(item: WishlistItem) {
    if (!window.confirm(`「${item.name}」を削除しますか？`)) return;
    setActionError('');
    try {
      await deleteWishlistItem(item.id);
      if (editingItem?.id === item.id) setEditingItem(undefined);
      reload();
    } catch (deleteError) {
      setActionError(deleteError instanceof Error ? deleteError.message : '削除に失敗しました。');
    }
  }

  return (
    <>
      <section className="page-heading">
        <h1>欲しいもの</h1>
        <p>旅行中に気になった商品を、後から買うためのメモとして残します。</p>
      </section>

      {loading && <LoadingState />}
      {error && <ErrorState error={error} />}

      <div className="grid">
        {actionError && <div className="form-errors">{actionError}</div>}

        <section className="card">
          <h2>{editingItem ? '欲しいものを編集' : '欲しいものを追加'}</h2>
          <WishlistItemForm
            key={editingItem?.id ?? 'new'}
            item={editingItem}
            submitLabel={editingItem ? '更新' : '追加'}
            onCancel={editingItem ? () => setEditingItem(undefined) : undefined}
            onSubmit={async (input) => {
              if (editingItem) {
                await updateWishlistItem(editingItem.id, input);
                setEditingItem(undefined);
              } else {
                await createWishlistItem(input);
              }
              reload();
            }}
          />
        </section>

        {items && items.length === 0 && <EmptyState>まだ欲しいものメモがありません。</EmptyState>}

        {items && items.length > 0 && (
          <div className="list">
            {items.map((item) => (
              <article className="list-item" key={item.id}>
                <div>
                  <p className="list-item__title">{item.name}</p>
                  <div className="list-item__meta">
                    {item.shopName || 'お店未設定'}
                    {typeof item.price === 'number' ? ` / ${formatPrice(item.price)}` : ''}
                  </div>
                  {item.url && (
                    <p className="muted">
                      <a href={item.url} target="_blank" rel="noreferrer">商品ページを開く</a>
                    </p>
                  )}
                  {item.memo && <p className="muted">{item.memo}</p>}
                </div>
                <div className="inline-actions">
                  <span className="status-badge">{STATUS_LABELS[item.status]}</span>
                  <button className="button" type="button" onClick={() => setEditingItem(item)}>
                    編集
                  </button>
                  <button className="button button--danger" type="button" onClick={() => void handleDelete(item)}>
                    削除
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function WishlistItemForm({
  item,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  item?: WishlistItem;
  submitLabel: string;
  onCancel?: () => void;
  onSubmit: (input: WishlistItemInput) => Promise<void>;
}) {
  const [input, setInput] = useState<WishlistItemInput>(() => itemToInput(item));
  const [formError, setFormError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateWishlistItemInput(input);
    if (errors.length > 0) {
      setFormError(errors.join('\n'));
      return;
    }
    setFormError('');
    try {
      await onSubmit(input);
      if (!item) setInput(EMPTY_INPUT);
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : '保存に失敗しました。');
    }
  }

  return (
    <form className="form form--compact" onSubmit={handleSubmit}>
      {formError && <div className="form-errors">{formError}</div>}
      <label className="field">
        <span>商品名</span>
        <input value={input.name} onChange={(event) => setInput({ ...input, name: event.target.value })} />
      </label>
      <div className="form-grid">
        <label className="field">
          <span>お店</span>
          <input value={input.shopName} onChange={(event) => setInput({ ...input, shopName: event.target.value })} />
        </label>
        <label className="field">
          <span>価格</span>
          <input
            type="number"
            min="0"
            step="1"
            value={input.price}
            onChange={(event) => setInput({ ...input, price: event.target.value })}
          />
        </label>
      </div>
      <div className="form-grid">
        <label className="field">
          <span>状態</span>
          <select value={input.status} onChange={(event) => setInput({ ...input, status: event.target.value as WishlistStatus })}>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>URL</span>
          <input value={input.url} onChange={(event) => setInput({ ...input, url: event.target.value })} />
        </label>
      </div>
      <label className="field">
        <span>メモ</span>
        <textarea rows={3} value={input.memo} onChange={(event) => setInput({ ...input, memo: event.target.value })} />
      </label>
      <div className="form-actions">
        <button className="button button--primary" type="submit">
          {submitLabel}
        </button>
        {onCancel && (
          <button className="button" type="button" onClick={onCancel}>
            キャンセル
          </button>
        )}
      </div>
    </form>
  );
}

function itemToInput(item?: WishlistItem): WishlistItemInput {
  if (!item) return EMPTY_INPUT;
  return {
    name: item.name,
    shopName: item.shopName ?? '',
    price: typeof item.price === 'number' ? String(item.price) : '',
    url: item.url ?? '',
    memo: item.memo ?? '',
    status: item.status,
  };
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(price);
}
