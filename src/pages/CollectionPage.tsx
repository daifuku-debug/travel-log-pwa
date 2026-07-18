import { useState, type FormEvent } from 'react';
import type { Collection, CollectionCategory, CollectionItem } from '../domain/models/collection';
import {
  createCollection,
  createCollectionItem,
  deleteCollection,
  deleteCollectionItem,
  listCollectionDetails,
  setCollectionItemVisited,
  updateCollection,
  updateCollectionItem,
  type CollectionInput,
  type CollectionItemInput,
} from '../features/collections/collectionService';
import { EmptyState, ErrorState, LoadingState } from '../shared/components/PageState';
import { useAsyncData } from '../shared/hooks/useAsyncData';

const EMPTY_COLLECTION: CollectionInput = {
  name: '',
  category: 'custom',
  description: '',
};

const EMPTY_ITEM: CollectionItemInput = {
  name: '',
  prefecture: '',
  country: '',
  address: '',
  officialUrl: '',
  memo: '',
};

const CATEGORY_LABELS: Record<CollectionCategory, string> = {
  castle: '城',
  station: '駅',
  worldHeritage: '世界遺産',
  custom: 'その他',
};

export function CollectionPage() {
  const [reloadKey, setReloadKey] = useState(0);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [editingCollection, setEditingCollection] = useState<Collection | undefined>();
  const [collectionInput, setCollectionInput] = useState<CollectionInput>(EMPTY_COLLECTION);
  const [editingItem, setEditingItem] = useState<CollectionItem | undefined>();
  const [itemCollectionId, setItemCollectionId] = useState<string | undefined>();
  const [itemInput, setItemInput] = useState<CollectionItemInput>(EMPTY_ITEM);
  const [formError, setFormError] = useState('');
  const { data: collections, error, loading } = useAsyncData(listCollectionDetails, [reloadKey]);

  function reload() {
    setReloadKey((value) => value + 1);
  }

  function toggleCollection(collectionId: string) {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(collectionId)) next.delete(collectionId);
      else next.add(collectionId);
      return next;
    });
  }

  function startEditCollection(collection: Collection) {
    setEditingCollection(collection);
    setCollectionInput({
      name: collection.name,
      category: collection.category,
      description: collection.description ?? '',
    });
  }

  function resetCollectionForm() {
    setEditingCollection(undefined);
    setCollectionInput(EMPTY_COLLECTION);
  }

  function startCreateItem(collectionId: string) {
    setEditingItem(undefined);
    setItemCollectionId(collectionId);
    setItemInput(EMPTY_ITEM);
    setOpenIds((current) => new Set(current).add(collectionId));
  }

  function startEditItem(item: CollectionItem) {
    setEditingItem(item);
    setItemCollectionId(item.collectionId);
    setItemInput({
      name: item.name,
      prefecture: item.prefecture ?? '',
      country: item.country ?? '',
      address: item.address ?? '',
      officialUrl: item.officialUrl ?? '',
      memo: item.memo ?? '',
    });
    setOpenIds((current) => new Set(current).add(item.collectionId));
  }

  function resetItemForm() {
    setEditingItem(undefined);
    setItemCollectionId(undefined);
    setItemInput(EMPTY_ITEM);
  }

  async function handleCollectionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    try {
      if (editingCollection) {
        await updateCollection(editingCollection.id, collectionInput);
      } else {
        await createCollection(collectionInput);
      }
      resetCollectionForm();
      reload();
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : '保存に失敗しました。');
    }
  }

  async function handleItemSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!itemCollectionId) return;
    setFormError('');
    try {
      if (editingItem) {
        await updateCollectionItem(editingItem.id, itemInput);
      } else {
        await createCollectionItem(itemCollectionId, itemInput);
      }
      resetItemForm();
      reload();
    } catch (submitError) {
      setFormError(submitError instanceof Error ? submitError.message : '保存に失敗しました。');
    }
  }

  return (
    <>
      <section className="page-heading">
        <h1>コレクション</h1>
        <p>城、駅、世界遺産などの訪問済み管理を行う画面です。</p>
      </section>

      {loading && <LoadingState />}
      {error && <ErrorState error={error} />}

      <div className="grid">
        {formError && <div className="form-errors">{formError}</div>}

        <section className="card">
          <h2>{editingCollection ? 'コレクションを編集' : 'コレクションを追加'}</h2>
          <form className="form form--compact" onSubmit={handleCollectionSubmit}>
            <div className="form-grid">
              <label className="field">
                <span>名前</span>
                <input
                  value={collectionInput.name}
                  onChange={(event) => setCollectionInput({ ...collectionInput, name: event.target.value })}
                />
              </label>
              <label className="field">
                <span>カテゴリ</span>
                <select
                  value={collectionInput.category}
                  onChange={(event) => setCollectionInput({ ...collectionInput, category: event.target.value as CollectionCategory })}
                >
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field">
              <span>説明</span>
              <input
                value={collectionInput.description}
                onChange={(event) => setCollectionInput({ ...collectionInput, description: event.target.value })}
              />
            </label>
            <div className="form-actions">
              <button className="button button--primary" type="submit">
                {editingCollection ? '更新' : '追加'}
              </button>
              {editingCollection && (
                <button className="button" type="button" onClick={resetCollectionForm}>
                  キャンセル
                </button>
              )}
            </div>
          </form>
        </section>

        {itemCollectionId && (
          <section className="card">
            <h2>{editingItem ? '項目を編集' : '項目を追加'}</h2>
            <form className="form form--compact" onSubmit={handleItemSubmit}>
              <label className="field">
                <span>項目名</span>
                <input value={itemInput.name} onChange={(event) => setItemInput({ ...itemInput, name: event.target.value })} />
              </label>
              <div className="form-grid">
                <label className="field">
                  <span>都道府県</span>
                  <input value={itemInput.prefecture} onChange={(event) => setItemInput({ ...itemInput, prefecture: event.target.value })} />
                </label>
                <label className="field">
                  <span>国</span>
                  <input value={itemInput.country} onChange={(event) => setItemInput({ ...itemInput, country: event.target.value })} />
                </label>
              </div>
              <label className="field">
                <span>住所</span>
                <input value={itemInput.address} onChange={(event) => setItemInput({ ...itemInput, address: event.target.value })} />
              </label>
              <label className="field">
                <span>公式URL</span>
                <input value={itemInput.officialUrl} onChange={(event) => setItemInput({ ...itemInput, officialUrl: event.target.value })} />
              </label>
              <label className="field">
                <span>メモ</span>
                <textarea rows={3} value={itemInput.memo} onChange={(event) => setItemInput({ ...itemInput, memo: event.target.value })} />
              </label>
              <div className="form-actions">
                <button className="button button--primary" type="submit">
                  {editingItem ? '項目を更新' : '項目を追加'}
                </button>
                <button className="button" type="button" onClick={resetItemForm}>
                  キャンセル
                </button>
              </div>
            </form>
          </section>
        )}

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
                      <div className="list-item__meta">{CATEGORY_LABELS[collection.category]}</div>
                    </div>
                    <div className="inline-actions">
                      <button className="button" type="button" onClick={() => toggleCollection(collection.id)}>
                        {isOpen ? '閉じる' : '内訳'}
                      </button>
                      <button className="button" type="button" onClick={() => startEditCollection(collection)}>
                        編集
                      </button>
                      <button className="button button--danger" type="button" onClick={async () => {
                        if (!window.confirm(`「${collection.name}」と配下の項目を削除しますか？`)) return;
                        await deleteCollection(collection.id);
                        reload();
                      }}>
                        削除
                      </button>
                    </div>
                  </div>
                  <div className="stat-value">{rate}%</div>
                  <div className="muted">{collection.visitedCount} / {collection.totalCount} 訪問済み</div>

                  <div className="form-actions collection-actions">
                    <button className="button" type="button" onClick={() => startCreateItem(collection.id)}>
                      項目を追加
                    </button>
                  </div>

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
                            <div className="inline-actions">
                              <button
                                className="button"
                                type="button"
                                onClick={async () => {
                                  await setCollectionItemVisited(item.id, !isVisited);
                                  reload();
                                }}
                              >
                                {isVisited ? '未訪問にする' : '訪問済みにする'}
                              </button>
                              <button className="button" type="button" onClick={() => startEditItem(item)}>
                                編集
                              </button>
                              <button className="button button--danger" type="button" onClick={async () => {
                                if (!window.confirm(`「${item.name}」を削除しますか？`)) return;
                                await deleteCollectionItem(item.id);
                                reload();
                              }}>
                                削除
                              </button>
                            </div>
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
      </div>
    </>
  );
}
